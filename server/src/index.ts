import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import cors from 'cors';
import pino from 'pino';
// Import db init conditionally to avoid Prisma crashes
import { readJobs, writeJobs, readConfig, writeConfig } from './store.js';
import { validateAddressFields, toAlpha2, initCountries } from './address.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

dotenv.config();

const logger = (pino as any)({ level: process.env.LOG_LEVEL || 'info' });

const app = express();

// Initialize countries (loads json locale)
initCountries().catch((e) => {
  console.warn('Failed to initialize country data', e);
});
const CORS_OPTIONS = {
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  credentials: false,
};
app.use(cors(CORS_OPTIONS));
// Ensure preflight requests get proper CORS response
app.options('*', cors(CORS_OPTIONS));

// Fallback explicit preflight handler: some clients expect these headers on OPTIONS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', Array.isArray(CORS_OPTIONS.origin) ? origin : String(CORS_OPTIONS.origin));
    res.setHeader('Access-Control-Allow-Methods', (CORS_OPTIONS.methods || []).join(', '));
    res.setHeader('Access-Control-Allow-Headers', (CORS_OPTIONS.allowedHeaders || []).join(', '));
    res.setHeader('Access-Control-Max-Age', '600');
    return res.status(204).end();
  }
  next();
});
// Stripe webhook must receive the raw body for signature verification.
// Define it BEFORE the JSON parser so the raw body is preserved for this route.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    logger.info('Webhook received', { 
      hasStripe: !!stripe, 
      hasSignature: !!req.headers['stripe-signature'],
      bodyLength: req.body?.length 
    });
    
    if (!stripe) return res.status(503).end();
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    
    let event: any;
    try {
      event = endpointSecret
        ? stripe.webhooks.constructEvent(req.body as Buffer, sig, endpointSecret)
        : (JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)) as any);
    } catch (webhookError) {
      logger.error('Webhook signature verification failed', { error: String(webhookError) });
      return res.status(400).send('Webhook signature verification failed');
    }
    
    logger.info('Webhook event type', { type: event?.type });
    
    if ((event as any).type === 'checkout.session.completed') {
      const session = (event as any).data.object as any;
      
      // Handle both payload format and individual metadata fields
      let payload: any = {};
      if (session.metadata?.payload) {
        try {
          payload = JSON.parse(session.metadata.payload);
        } catch (e) {
          logger.warn('Failed to parse payload from metadata', { error: String(e) });
        }
      } else if (session.metadata) {
        // Use individual metadata fields as fallback
        // For now, create a basic job with minimal data since we don't have full form data
        payload = {
          templateId: session.metadata.templateId || 'tpl-default',
          sender: { 
            name: session.metadata.sender || session.customer_details?.name || 'Unknown Sender',
            address_line1: 'Address Not Provided',
            address_city: 'Unknown',
            address_state: 'Unknown',
            address_zip: '00000',
            address_country: 'US'
          },
          recipient: { 
            name: session.metadata.recipient || 'Unknown Recipient',
            address_line1: 'Address Not Provided',
            address_city: 'Unknown',
            address_state: 'Unknown',
            address_zip: '00000',
            address_country: 'US'
          },
          body: session.metadata.body || 'Letter content not provided',
          subject: session.metadata.subject || 'Letter from Digital Mail Letter',
          customerEmail: session.customer_details?.email || session.customer_email
        };
      }
      
      if (payload && (payload.templateId || payload.sender || payload.recipient)) {
        // Create job directly
        const id = nanoid(12);
        const now = new Date().toISOString();
        
        // Normalize addresses
        const normalizeAddress = (a: any) => {
          if (a.address_line1) {
            const country = toAlpha2(a.address_country || 'US');
            return {
              name: a.name || '',
              address_line1: a.address_line1 || '',
              address_line2: a.address_line2 || '',
              address_city: a.address_city || '',
              address_state: a.address_state || '',
              address_zip: a.address_zip || '',
              address_country: country
            };
          }
          return { name: a.name || '', address: a.address || '' };
        };

        const job = {
          id,
          createdAt: now,
          status: 'submitted',
          templateId: payload.templateId || 'tpl-default',
          body: payload.body || '',
          subject: payload.subject || '',
          fields: payload.fields || {},
          sender: payload.sender?.address_line1 ? normalizeAddress(payload.sender) : { name: payload.sender?.name || '', address: '' },
          recipient: payload.recipient?.address_line1 ? normalizeAddress(payload.recipient) : { name: payload.recipient?.name || '', address: '' },
          serviceLevel: payload.serviceLevel || 'first_class',
          options: payload.options || [],
          tracking: {
            provider: 'pending',
            code: '',
            events: [{ at: now, status: 'submitted' }]
          },
          stripeSessionId: session.id,
          customerEmail: payload.customerEmail || session.customer_email || session.customer_details?.email
        };

        // Save job
        logger.info('Creating job', { jobId: id, sessionId: session.id });
        const { init } = await import('./db.js');
        const { prisma, connected } = await init();
        
        if (connected && prisma) {
          try {
            await prisma.job.create({ data: job });
            logger.info({ jobId: id, sessionId: session.id }, 'Job created in database');
          } catch (e) {
            logger.error({ err: String(e), jobId: id }, 'DB write failed, falling back to file');
            const jobs = readJobs();
            jobs.push(job);
            writeJobs(jobs);
            logger.info({ jobId: id }, 'Job saved to file store');
          }
        } else {
          logger.warn('Database not connected, using file store');
          const jobs = readJobs();
          jobs.push(job);
          writeJobs(jobs);
          logger.info({ jobId: id }, 'Job saved to file store');
        }
        
        // Trigger immediate job processing
        try {
          const { processJobFromFile } = await import('./worker.js');
          await processJobFromFile(job);
          logger.info({ jobId: id }, 'Job processed immediately');
        } catch (e) {
          logger.warn({ jobId: id, err: String(e) }, 'Immediate processing failed, will be picked up by worker');
        }

        // Send receipt email
        if (job.customerEmail) {
          await sendReceiptEmail(job, job.customerEmail);
        }

        logger.info({ sessionId: session.id, jobId: id }, 'Job created from Stripe webhook');
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook error', err);
    res.status(400).send('Webhook Error');
  }
});

// JSON parser for all other routes
app.use(bodyParser.json({ limit: '2mb' }));

// Development-friendly Content Security Policy
// Allows the local devtools and frontend to connect to the API during development.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    // Keep this permissive but scoped to localhost/dev. Do NOT use in production.
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self' http://localhost:4000 ws://localhost:4000 http://localhost:3001",
        "font-src 'self' data:",
        "frame-ancestors 'none'",
      ].join('; ')
    );
    next();
  });
}

// Respond to Chrome DevTools .well-known lookup to avoid CSP/connect noise in devtools
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  // Return 204 No Content; devtools will treat this as 'not available' without creating a 404 noise.
  res.status(204).end();
});

// No explicit '/' route. Root is served by the React build via the static/catch-all handlers below.

  // Lightweight favicon handler to avoid 404 noise in browser devtools.
  // Browsers commonly request /favicon.ico automatically; returning 204 stops
  // the console error without serving an actual icon. We add caching so the
  // browser won't re-request it frequently.
  app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(204).end();
  });

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Test PDF generation endpoint
app.get('/api/test-pdf', async (req, res) => {
  try {
    const { htmlToPdfBuffer } = await import('./pdf.js');
    const testHtml = '<html><body><h1>Test PDF</h1><p>This is a test PDF generation.</p></body></html>';
    const pdfBuffer = await htmlToPdfBuffer(testHtml);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'PDF generation failed', details: String(error) });
  }
});

// ----- Payments (Stripe Checkout) -----
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_CENTS = Number(process.env.PRICE_CENTS || 250);
const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET, { apiVersion: '2023-10-16' }) : (null as any);

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@digitalmailletter.com';

const transporter = EMAIL_USER && EMAIL_PASS ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  // More reliable configuration
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 15000,   // 15 seconds
  socketTimeout: 30000,     // 30 seconds
  pool: false, // Disable pooling for reliability
  tls: {
    rejectUnauthorized: false
  }
} as any) : null;

// Email receipt function
async function sendReceiptEmail(job: any, customerEmail: string) {
  if (!transporter) {
    logger.warn('Email not configured, skipping receipt email');
    return;
  }

  try {
    const mailOptions = {
      from: EMAIL_FROM,
      to: customerEmail,
      subject: `Letter Confirmation - ${job.tracking.code || 'Processing'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">✅ Your Letter Has Been Sent!</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Confirmation Details</h3>
            <p><strong>Tracking Code:</strong> <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${job.tracking.code || 'Processing...'}</code></p>
            <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">${job.status.toUpperCase()}</span></p>
            <p><strong>Order Date:</strong> ${new Date(job.createdAt).toLocaleDateString()}</p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>From</h3>
            <p><strong>${job.sender.name}</strong></p>
            <p>${job.sender.address_line1}</p>
            <p>${job.sender.address_city}, ${job.sender.address_state} ${job.sender.address_zip}</p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>To</h3>
            <p><strong>${job.recipient.name}</strong></p>
            <p>${job.recipient.address_line1}</p>
            <p>${job.recipient.address_city}, ${job.recipient.address_state} ${job.recipient.address_zip}</p>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>What happens next?</h3>
            <ul>
              <li>Your letter will be printed and prepared for mailing within 24 hours</li>
              <li>It will be sent via USPS First Class Mail</li>
              <li>Delivery typically takes 3-5 business days</li>
            </ul>
          </div>

          <p style="color: #7f8c8d; font-size: 14px;">
            Thank you for using Digital Mail Letter! If you have any questions, please contact support.
          </p>
        </div>
      `
    };

    // Send email with timeout handling
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email timeout')), 15000)
    );
    
    await Promise.race([emailPromise, timeoutPromise]);
    logger.info({ jobId: job.id, email: customerEmail }, 'Receipt email sent');
  } catch (error) {
    logger.error({ error: String(error), jobId: job.id }, 'Failed to send receipt email');
    // Don't throw - email failure shouldn't break the job
  }
}

app.post('/api/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
  try {
    const { payload } = req.body || {};
    if (!payload) return res.status(400).json({ error: 'Missing payload' });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        { price_data: { currency: 'usd', product_data: { name: 'Physical Letter' }, unit_amount: STRIPE_PRICE_CENTS }, quantity: 1 }
      ],
      success_url: `${req.protocol}://${req.get('host')}?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}?canceled=1`,
      metadata: { 
        payload: JSON.stringify(payload)
      }
    });
    res.json({ id: session.id, url: session.url });
  } catch (e) {
    logger.error(String(e));
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// (Webhook route defined earlier to preserve raw body)

// --- Simple password login for Admin ---
function readCookies(req: express.Request): Record<string, string> {
  const header = String(req.headers.cookie || '');
  return header.split(';').reduce((acc, part) => {
    const i = part.indexOf('=');
    if (i > -1) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      acc[k] = decodeURIComponent(v);
    }
    return acc;
  }, {} as Record<string, string>);
}

function setAdminCookie(res: express.Response, enabled: boolean) {
  const value = enabled ? '1' : '';
  const maxAge = enabled ? 7 * 24 * 60 * 60 : 0; // 7 days
  res.setHeader('Set-Cookie', `admin=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cookies = readCookies(req);
  if (cookies['admin'] === '1') return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Login/Logout endpoints
app.post('/api/admin/login', (req, res) => {
  const configured = process.env.ADMIN_PASSWORD || '';
  if (!configured) return res.status(503).json({ error: 'ADMIN_PASSWORD not configured' });
  const password = String((req.body && req.body.password) || '');
  if (password && password === configured) {
    setAdminCookie(res, true);
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/admin/logout', (req, res) => {
  setAdminCookie(res, false);
  res.json({ ok: true });
});

// Admin API: health and jobs management (minimal)
app.get('/api/admin/health', requireAdmin, async (req, res) => {
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { connected } = await init();
  res.json({ ok: true, env: process.env.NODE_ENV || 'development', dbConnected: connected, time: new Date().toISOString() });
});

app.get('/api/admin/jobs', requireAdmin, async (req, res) => {
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { prisma, connected } = await init();
  if (connected && prisma) {
    try {
      const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' } });
      return res.json(jobs);
    } catch {}
  }
  return res.json(readJobs());
});

// Error monitoring endpoint
app.get('/api/admin/errors', requireAdmin, async (req, res) => {
  try {
    const jobs = readJobs();
    const failedJobs = (jobs as any[]).filter((job: any) => 
      job.status === 'failed' || 
      (job.tracking && job.tracking.events && 
       job.tracking.events.some((e: any) => e.status === 'failed'))
    );
    
    const errors = failedJobs.map((job: any) => ({
      id: job.id,
      createdAt: job.createdAt,
      status: job.status,
      error: job.error || 'Unknown error',
      lastEvent: job.tracking?.events?.[job.tracking.events.length - 1] || null,
      customerEmail: job.customerEmail
    }));
    
    res.json(errors);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

// System health endpoint
app.get('/api/admin/health', requireAdmin, async (req, res) => {
  try {
    const jobs = readJobs();
    const stats = {
      total: jobs.length,
      completed: jobs.filter((j: any) => j.status === 'completed').length,
      failed: jobs.filter((j: any) => j.status === 'failed').length,
      processing: jobs.filter((j: any) => j.status === 'processing').length,
      submitted: jobs.filter((j: any) => j.status === 'submitted').length,
      last24h: jobs.filter((j: any) => 
        new Date(j.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length
    };
    
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch health stats' });
  }
});

app.post('/api/admin/jobs/:id/requeue', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { prisma, connected } = await init();
  if (connected && prisma) {
    try {
      await prisma.job.update({ where: { id }, data: { status: 'submitted' } });
      return res.json({ ok: true });
    } catch {}
  }
  const jobs = readJobs();
  const j = (jobs as any[]).find((jj: any) => jj.id === id);
  if (!j) return res.status(404).json({ error: 'Job not found' });
  j.status = 'submitted';
  if (!j.tracking) j.tracking = { provider: 'mock', code: 'T' + id.toUpperCase(), events: [] } as any;
  (j.tracking.events = j.tracking.events || []).push({ at: now, status: 'requeued' });
  writeJobs(jobs);
  res.json({ ok: true });
});

app.delete('/api/admin/jobs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { prisma, connected } = await init();
  if (connected && prisma) {
    try {
      await prisma.job.delete({ where: { id } });
      return res.json({ ok: true });
    } catch {}
  }
  const jobs = (readJobs() as any[]).filter((jj: any) => jj.id !== id);
  writeJobs(jobs);
  res.json({ ok: true });
});

app.get('/api/config', async (req, res) => {
  const cfg = readConfig();
  if (cfg) return res.json(cfg);
  // default config
  return res.json({ templates: [], serviceLevels: [] });
});

const LetterSchema = z.object({
  templateId: z.string().nullable().optional(),
  customBody: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  fields: z.record(z.string()).optional(),
  sender: z.object({ 
    name: z.string(),
    address_line1: z.string(),
    address_line2: z.string().optional(),
    address_city: z.string(),
    address_state: z.string(),
    address_zip: z.string(),
    address_country: z.string()
  }),
  recipient: z.object({ 
    name: z.string(),
    address_line1: z.string(),
    address_line2: z.string().optional(),
    address_city: z.string(),
    address_state: z.string(),
    address_zip: z.string(),
    address_country: z.string()
  }),
  serviceLevel: z.string().optional(),
  options: z.array(z.string()).optional(),
});

app.post('/api/letters', async (req, res) => {
  const parse = LetterSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const payload = parse.data;
  logger.info({ payload }, 'create letter');

  // Try initialize DB; if not connected, fallback to file store
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { prisma, connected } = await init();
  const id = nanoid(12);
  const now = new Date().toISOString();
  // normalize/validate sender/recipient addresses for structured fields
  const normalizeAddress = (a: any) => {
    // if it's already structured, try to normalize country
    const copy = { ...a };
    if (copy.address_country) {
      const c = toAlpha2(copy.address_country);
      if (c) copy.address_country = c;
    }
    return copy;
  };

  const sender = normalizeAddress(payload.sender);
  const recipient = normalizeAddress(payload.recipient);

  // validate addresses
  const sCheck = validateAddressFields(sender);
  const rCheck = validateAddressFields(recipient);
  if (!sCheck.ok) return res.status(400).json({ error: `sender.${sCheck.missing || 'address'} invalid` });
  if (!rCheck.ok) return res.status(400).json({ error: `recipient.${rCheck.missing || 'address'} invalid` });

  // Prepare body content - prioritize 'body' over 'customBody' for new API
  const bodyContent = payload.body || payload.customBody || null;
  
  // Prepare template data including subject
  const templateData = {
    body: bodyContent,
    subject: payload.subject || null,
    ...payload.fields
  };

  const job = {
    id,
    createdAt: now,
    status: 'submitted',
    templateId: payload.templateId || null,
    body: JSON.stringify(templateData),
    fields: payload.fields || {},
    sender,
    recipient,
    serviceLevel: payload.serviceLevel || 'first_class',
    options: payload.options || [],
    tracking: { provider: 'mock', code: 'T' + id.toUpperCase(), events: [{ at: now, status: 'submitted' }] }
  };

  if (connected && prisma) {
    try {
      await prisma.job.create({ data: {
        id: job.id,
        templateId: job.templateId,
        body: job.body || '',
        sender: job.sender as any,
        recipient: job.recipient as any,
        service: job.serviceLevel,
        options: job.options as any,
        status: job.status,
        tracking: job.tracking as any,
      }});
      return res.status(201).json({ id: job.id, tracking: job.tracking, status: job.status });
    } catch (e) {
      logger.error({ err: String(e) }, 'DB write failed, falling back to file');
    }
  }

  // Fallback to file store
  const jobs = readJobs();
  jobs.push(job);
  writeJobs(jobs);
  return res.status(201).json({ id: job.id, tracking: job.tracking, status: job.status });
});

// List jobs (reads from DB if connected, otherwise file store)
app.get('/api/jobs', async (req, res) => {
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { prisma, connected } = await init();
  if (connected && prisma) {
    try {
      const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' } });
      return res.json(jobs);
    } catch (e) {
      logger.warn({ err: String(e) }, 'DB read failed, falling back to file');
    }
  }
  return res.json(readJobs());
});

// Get job by Stripe session ID
app.get('/api/jobs/by-session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  // Import db init conditionally
  const { init } = await import('./db.js');
  const { prisma, connected } = await init();
  
  if (connected && prisma) {
    try {
      const job = await prisma.job.findFirst({ 
        where: { stripeSessionId: sessionId },
        orderBy: { createdAt: 'desc' }
      });
      if (job) return res.json(job);
    } catch (e) {
      logger.warn({ err: String(e) }, 'DB read failed, falling back to file');
    }
  }
  
  // Fallback to file store
  const jobs = readJobs();
  const job = (jobs as any[]).find((j: any) => j.stripeSessionId === sessionId);
  if (job) return res.json(job);
  
  return res.status(404).json({ error: 'Job not found' });
});

// Template preview endpoint
app.get('/api/templates/:templateId/preview', async (req, res) => {
  try {
    const { templateId } = req.params;
    const Handlebars = (await import('handlebars')).default;
    const fs = (await import('fs')).promises;
    const path = (await import('path')).default;
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.hbs`);
    
    // Check if template exists
    try {
      await fs.access(templatePath);
    } catch {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    
    // Sample data for preview
    const sampleData = {
      sender: {
        name: 'John Smith',
        company: 'Acme Corporation',
        title: 'CEO',
        address_line1: '123 Business Ave',
        address_line2: 'Suite 100',
        address_city: 'San Francisco',
        address_state: 'CA',
        address_zip: '94102',
        address_country: 'US'
      },
      recipient: {
        name: 'Jane Doe',
        company: 'ABC Company',
        address_line1: '456 Main Street',
        address_line2: 'Floor 5',
        address_city: 'New York',
        address_state: 'NY',
        address_zip: '10001',
        address_country: 'US'
      },
      currentDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      greeting: 'Dear Jane Doe,',
      body: getTemplatePreviewContent(templateId),
      closing: getTemplateClosing(templateId),
      subject: getTemplateSubject(templateId),
      invoiceNumber: 'INV-2025-001',
      dueDate: 'January 30, 2025',
      total: '$1,250.00',
      paymentTerms: 'Net 30 Days',
      reference: 'Q4 Consulting Services'
    };
    
    const html = template(sampleData);
    
    // Set headers to allow iframe embedding
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', 'frame-ancestors \'self\' http://localhost:3001');
    
    res.send(html);
  } catch (error) {
    logger.error('Template preview error:', error);
    res.status(500).json({ error: 'Failed to generate template preview' });
  }
});

// Live preview with user-provided data
app.post('/api/templates/:templateId/preview', async (req, res) => {
  try {
    const { templateId } = req.params;
    const Handlebars = (await import('handlebars')).default;
    const fs = (await import('fs')).promises;
    const path = (await import('path')).default;
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.hbs`);
    try {
      await fs.access(templatePath);
    } catch {
      return res.status(404).json({ error: 'Template not found' });
    }

    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const payload = (req.body || {}) as any;
    const sender = payload.sender || {};
    const recipient = payload.recipient || {};
    const html = template({
      sender,
      recipient,
      subject: payload.subject || '',
      body: payload.body || '',
      currentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://www.digitalmailletter.com");
    res.send(html);
  } catch (error) {
    logger.error('Live template preview error:', error);
    res.status(500).json({ error: 'Failed to generate live template preview' });
  }
});

function getTemplatePreviewContent(templateId: string): string {
  switch (templateId) {
    case 'tpl-default':
      return `Thank you for your interest in our business services. We are pleased to inform you that we have reviewed your proposal and would like to schedule a meeting to discuss the next steps.<br /><br />

Our team has been impressed with your company's track record and we believe there are significant opportunities for collaboration. We would like to propose a meeting next week to discuss the details of our partnership.<br /><br />

Please let us know your availability, and we will arrange a convenient time for both parties.`;

    case 'tpl-formal':
      return `This letter serves as formal notification regarding the matter discussed in our previous correspondence dated December 15, 2024.<br /><br />

After careful consideration and review of all relevant documentation, we have reached a decision that requires immediate attention and response from your organization.<br /><br />

Please be advised that all parties involved must comply with the terms and conditions outlined in Section 3.2 of the original agreement. Failure to respond within the specified timeframe may result in further legal action.<br /><br />

We request your prompt attention to this matter and look forward to your written response within ten (10) business days of receipt of this letter.`;

    case 'tpl-personal':
      return `I hope this letter finds you in good health and spirits. It has been far too long since we last spoke, and I wanted to reach out to catch up and share some exciting news.<br /><br />

Life has been treating me well lately. I recently started a new position at a wonderful company, and I'm enjoying the challenges and opportunities it brings. The work is fulfilling, and my colleagues are fantastic.<br /><br />

I would love to hear about what you've been up to lately. Perhaps we could arrange to meet for coffee or dinner sometime soon? I miss our conversations and would enjoy spending time together again.<br /><br />

Please give my regards to your family, and I hope to hear from you soon.`;

    case 'tpl-invoice':
      return `<table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Consulting Services - Q4 Strategy Review</td>
            <td>25 hours</td>
            <td>$50.00</td>
            <td>$1,250.00</td>
          </tr>
        </tbody>
      </table>`;

    default:
      return 'This is a sample letter content that will be replaced with your actual message when you create a letter using this template.';
  }
}

function getTemplateClosing(templateId: string): string {
  switch (templateId) {
    case 'tpl-formal':
      return 'Respectfully yours,';
    case 'tpl-personal':
      return 'With love and best wishes,';
    case 'tpl-invoice':
      return 'Thank you for your business,';
    default:
      return 'Best regards,';
  }
}

function getTemplateSubject(templateId: string): string {
  switch (templateId) {
    case 'tpl-formal':
      return 'Formal Notice - Action Required';
    case 'tpl-personal':
      return 'Catching Up';
    case 'tpl-invoice':
      return 'Invoice for Q4 Consulting Services';
    default:
      return 'Business Correspondence';
  }
}


const PORT = Number(process.env.PORT || 4000);

// Simple admin UI (token prompt) – placed before static/catch-all
app.get('/admin', (req, res) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Admin • Digital Mail Letter</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;margin:0;background:#0b1020;color:#e8ecf8}header{padding:16px 20px;border-bottom:1px solid #243049}main{padding:16px 20px}button{background:#5b7cfa;border:0;color:white;padding:8px 12px;border-radius:6px;cursor:pointer}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #243049;padding:8px 6px;text-align:left}code{background:#111826;padding:2px 6px;border-radius:4px}</style>
  </head><body>
  <header><strong>Admin</strong> · <span id="health">loading…</span> <button id="refresh" style="margin-left:10px">Refresh</button></header>
  <main>
    <div style="margin:8px 0 16px 0"><form id="login" style="display:inline">Password: <input id="pwd" type="password" placeholder="Admin password" autocomplete="new-password" style="width:220px"> <button>Login</button></form> <button id="logout" style="margin-left:8px;background:#334155">Logout</button></div>
    
    <div id="stats" style="display:none;margin:16px 0;padding:16px;background:#1e293b;border-radius:8px">
      <h3 style="margin-top:0">System Health</h3>
      <div id="stats-content"></div>
    </div>
    
    <div id="errors" style="display:none;margin:16px 0;padding:16px;background:#7f1d1d;border-radius:8px">
      <h3 style="margin-top:0;color:#fca5a5">Recent Errors</h3>
      <div id="errors-content"></div>
    </div>
    
    <h3>Jobs</h3>
    <table><thead><tr><th>Id</th><th>Status</th><th>Template</th><th>Created</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table>
    <p style="opacity:.8;margin-top:18px">Tip: Keep this page private. Token is stored in session only.</p>
  </main>
    <script>
  const $ = sel=>document.querySelector(sel);
  async function req(path, opts={}){
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts.headers||{}));
    const r = await fetch(path, { headers, credentials: 'include', ...opts });
    if(!r.ok){ const t = await r.text(); throw new Error(t) } return await r.json();
  }
  async function load(){
    try{ const h = await req('/api/admin/health'); $('#health').textContent = 'OK • ' + h.env; }catch(e){ $('#health').textContent = 'Unauthorized or down'; return; }
    
    // Load system stats
    try{ 
      const stats = await req('/api/admin/health'); 
      $('#stats').style.display = 'block';
      $('#stats-content').innerHTML = 
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px">' +
          '<div><strong>Total:</strong> ' + stats.total + '</div>' +
          '<div><strong>Completed:</strong> ' + stats.completed + '</div>' +
          '<div><strong>Failed:</strong> ' + stats.failed + '</div>' +
          '<div><strong>Processing:</strong> ' + stats.processing + '</div>' +
          '<div><strong>Submitted:</strong> ' + stats.submitted + '</div>' +
          '<div><strong>Last 24h:</strong> ' + stats.last24h + '</div>' +
        '</div>';
    }catch(e){ $('#stats').style.display = 'none'; }
    
    // Load errors
    try{ 
      const errors = await req('/api/admin/errors'); 
      if(errors.length > 0) {
        $('#errors').style.display = 'block';
        $('#errors-content').innerHTML = errors.map(e => 
          '<div style="margin:8px 0;padding:8px;background:#991b1b;border-radius:4px">' +
            '<strong>' + e.id + '</strong> - ' + e.status + ' (' + new Date(e.createdAt).toLocaleString() + ')<br>' +
            '<small>' + e.error + '</small>' +
          '</div>'
        ).join('');
      } else {
        $('#errors').style.display = 'none';
      }
    }catch(e){ $('#errors').style.display = 'none'; }
    
    try{ const jobs = await req('/api/admin/jobs'); const tbody = $('#rows'); tbody.innerHTML='';
      (jobs||[]).forEach(j=>{ const tr=document.createElement('tr'); 
        const statusColor = j.status === 'failed' ? '#ef4444' : j.status === 'completed' ? '#10b981' : j.status === 'processing' ? '#f59e0b' : '#6b7280';
        tr.innerHTML='<td><code>'+(j.id||'')+'</code></td><td style="color:'+statusColor+'">'+(j.status||'')+'</td><td>'+(j.templateId||'')+'</td><td>'+(j.createdAt||'')+'</td><td>'+
        '<button data-a="requeue" data-id="'+j.id+'">Requeue</button>'+
        '<button data-a="delete" data-id="'+j.id+'" style="background:#ef4444;margin-left:6px">Delete</button></td>'; tbody.appendChild(tr); });
    }catch(e){ /* ignore */ }
  }
  document.addEventListener('click', async (e)=>{
    const t=e.target; if(!(t instanceof HTMLElement)) return; const a=t.getAttribute('data-a'); const id=t.getAttribute('data-id');
    if(a==='requeue'){ await req('/api/admin/jobs/'+id+'/requeue', { method:'POST' }); await load(); }
    if(a==='delete'){ if(confirm('Delete job '+id+'?')){ await req('/api/admin/jobs/'+id, { method:'DELETE' }); await load(); } }
  });
  document.getElementById('login').addEventListener('submit', async (e)=>{ e.preventDefault(); try { await req('/api/admin/login', { method:'POST', body: JSON.stringify({ password: $('#pwd').value }) }); await load(); } catch(err){ alert('Login failed'); } });
  document.getElementById('logout').onclick = async ()=>{ try{ await req('/api/admin/logout', { method:'POST' }); $('#pwd').value=''; $('#health').textContent = 'Not logged in'; $('#rows').innerHTML=''; }catch{} };
  $('#refresh').onclick = load;
  // Don't load data on page load - wait for login
  $('#health').textContent = 'Not logged in';
  </script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Serve static files from React build (AFTER all API routes)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

logger.info(`Serving static files from: ${publicPath}`);

// Check if public directory exists
import fs from 'fs';
try {
  const files = fs.readdirSync(publicPath);
  logger.info(`Public directory contents: ${files.join(', ')}`);
} catch (error) {
  logger.error(`Public directory not found at: ${publicPath}`);
}

app.use(express.static(publicPath));

// Serve sitemap.xml with correct content-type
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(sitemapPath);
});

// Serve robots.txt
app.get('/robots.txt', (req, res) => {
  const robotsPath = path.join(__dirname, 'robots.txt');
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(robotsPath);
});

// Serve React app for all non-API routes (catch-all)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(publicPath, 'index.html');
  logger.info(`Attempting to serve: ${indexPath} for path: ${req.path}`);
  
  // Check if index.html exists
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    logger.error(`index.html not found at: ${indexPath}`);
    res.status(500).send(`
      <h1>Frontend Not Found</h1>
      <p>The React build files are missing.</p>
      <p>Expected location: ${indexPath}</p>
      <p>Public path: ${publicPath}</p>
      <p><a href="/api/health">Check API Health</a></p>
    `);
  }
});
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on 0.0.0.0:${PORT}`);
  logger.info(`Frontend available at 0.0.0.0:${PORT}`);
  logger.info(`API endpoints at 0.0.0.0:${PORT}/api/*`);
});

// Start background worker in-process so paid jobs are sent
import('./worker.js')
  .then(() => logger.info('Background worker started'))
  .catch((e) => logger.error('Failed to start worker', e));
