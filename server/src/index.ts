import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import cors from 'cors';
import pino from 'pino';
import { init } from './db.js';
import { readJobs, writeJobs, readConfig, writeConfig } from './store.js';
import { validateAddressFields, toAlpha2, initCountries } from './address.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';

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

// Root route: provide a small landing page so navigating to http://localhost:4000/ doesn't 404
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Mail My Forms — API</title>
        <style>body{font-family:system-ui,Segoe UI,Arial;padding:24px;background:#f6f8fb;color:#0b1020}</style>
      </head>
      <body>
        <h1>Mail My Forms — API</h1>
        <p>This server exposes a small JSON API.</p>
        <ul>
          <li><a href="/api/health">/api/health</a></li>
          <li><a href="/api/config">/api/config</a></li>
          <li>POST <code>/api/letters</code> to create a job (see README)</li>
        </ul>
      </body>
    </html>
  `);
});

  // Lightweight favicon handler to avoid 404 noise in browser devtools.
  // Browsers commonly request /favicon.ico automatically; returning 204 stops
  // the console error without serving an actual icon. We add caching so the
  // browser won't re-request it frequently.
  app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(204).end();
  });

app.get('/api/health', (req, res) => res.json({ ok: true }));

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
app.listen(PORT, '::', () => {
  logger.info(`Server running on [::]:${PORT}`);
  logger.info(`Frontend available at [::]:${PORT}`);
  logger.info(`API endpoints at [::]:${PORT}/api/*`);
});
