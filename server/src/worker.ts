import dotenv from 'dotenv';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJobs, writeJobs } from './store.js';

dotenv.config();

// Import PrismaClient conditionally to avoid crashes when DATABASE_URL is invalid
let prisma: any = null;

import lob, { sendViaTemplate, lobInline } from './providers/lob.js';
import { htmlToPdfBuffer } from './pdf.js';

const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const RETRY_MAX = Number(process.env.RETRY_MAX || 3);

async function loadTemplate(name = 'letter') {
  // Resolve template path relative to this file; works reliably on Windows and Unix
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const file = path.join(__dirname, '..', 'templates', `${name}.hbs`);
  const src = await fs.readFile(file, 'utf8');
  return Handlebars.compile(src);
}

async function initPrisma() {
  if (prisma) return prisma;
  
  // Check if DATABASE_URL is properly formatted
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('postgresql://') || dbUrl.includes('[AUTO_SET_BY_RAILWAY]')) {
    console.warn('DATABASE_URL not properly configured; worker will use file store');
    return null;
  }
  
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('Worker connected to database');
    return prisma;
  } catch (e) {
    console.warn('Worker failed to connect to database; using file store', e);
    return null;
  }
}

async function processJobFromFile(job: any) {
  try {
    console.log('Processing job from file store:', job.id);
    
    // Update job status to processing
    job.status = 'processing';
    const jobs = readJobs();
    const jobIndex = (jobs as any[]).findIndex((j: any) => j.id === job.id);
    if (jobIndex >= 0) {
      jobs[jobIndex] = job;
      writeJobs(jobs);
    }

    // Decide path: template mapping vs local HTML->PDF
    const cfgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'config.json');
    let mapping: any = null;
    try {
      const raw = await fs.readFile(cfgPath, 'utf8');
      const cfg = JSON.parse(raw || '{}');
      mapping = (cfg.templates || []).find((t: any) => t.id === (job.templateId || 'tpl-default')) || null;
    } catch {}

    if (mapping && mapping.lob) {
      const resource: 'letters' | 'postcards' | 'self_mailers' = mapping.category === 'Postcards' ? 'postcards' : (mapping.category === 'Self-Mailers' ? 'self_mailers' : 'letters');
      const to = job.recipient as any;
      const from = job.sender as any;
      const merge = (job.body ? (JSON.parse(job.body || '{}')) : {}) as any;
      let tracking: any;
      if (mapping.lob.file || mapping.lob.front || mapping.lob.back || mapping.lob.inside || mapping.lob.outside) {
        // If IDs provided, use template path
        tracking = await sendViaTemplate({
          resource,
          to,
          from,
          template: mapping.lob.file ? { file: mapping.lob.file } : undefined,
          postcardTemplates: mapping.lob.front && mapping.lob.back ? { front: mapping.lob.front, back: mapping.lob.back } : undefined,
          selfMailerTemplates: mapping.lob.inside && mapping.lob.outside ? { inside: mapping.lob.inside, outside: mapping.lob.outside } : undefined,
          mergeVariables: merge,
          color: Array.isArray(job.options) && job.options.includes('color'),
          doubleSided: Array.isArray(job.options) && job.options.includes('double_sided'),
          mailType: 'usps_first_class',
          description: job.templateId,
        });
      } else {
        // No IDs: inline HTML path
        if (resource === 'letters') {
          const template = await loadTemplate(job.templateId || 'letter');
          const html = template({ ...merge, sender: job.sender, recipient: job.recipient });
          tracking = await lobInline.sendInline({ resource: 'letters', to, from, letterHtml: html, color: true, doubleSided: false, mailType: 'usps_first_class', description: job.templateId });
        } else if (resource === 'postcards') {
          const front = `<html><body style=\"margin:36px;font-family:Arial\"><h1>${merge.headline || 'Hello'}</h1><p>${merge.subheadline || ''}</p></body></html>`;
          const back = `<html><body style=\"margin:36px;font-family:Arial\"><div>${merge.body || ''}</div><p>${merge.cta_text || ''}</p></body></html>`;
          tracking = await lobInline.sendInline({ resource: 'postcards', to, from, postcardFrontHtml: front, postcardBackHtml: back, mailType: 'usps_first_class', description: job.templateId });
        } else {
          const inside = `<html><body style=\"margin:36px;font-family:Arial\"><h2>${merge.headline || 'Update'}</h2><div>${merge.body || ''}</div></body></html>`;
          const outside = `<html><body style=\"margin:36px;font-family:Arial\"><h3>${merge.subheadline || ''}</h3></body></html>`;
          tracking = await lobInline.sendInline({ resource: 'self_mailers', to, from, selfInsideHtml: inside, selfOutsideHtml: outside, mailType: 'usps_first_class', description: job.templateId });
        }
      }
      job.status = 'completed';
      job.tracking = tracking;
      if (jobIndex >= 0) { jobs[jobIndex] = job; writeJobs(jobs); }
      console.log('Job processed via template:', job.id, job.status);
      return;
    }

    // Fallback: Process via local HTML template and PDF
    const template = await loadTemplate(job.templateId || 'letter');
    let data: any = {};
    if (job.body) {
      try {
        data = JSON.parse(job.body as unknown as string);
      } catch {
        data = { body: job.body };
      }
    }

    const html = template({ ...data, sender: job.sender, recipient: job.recipient });
    
    let pdf: Buffer;
    try {
      const pdfUint8 = await htmlToPdfBuffer(html);
      pdf = Buffer.from(pdfUint8);
    } catch (pdfError) {
      console.error('PDF generation failed, using fallback:', pdfError);
      // Fallback: Create a simple text-based PDF or use a basic HTML template
      const fallbackHtml = `
        <html>
          <head><title>Letter</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Letter from ${job.sender?.name || 'Unknown'}</h2>
            <p><strong>To:</strong> ${job.recipient?.name || 'Unknown'}</p>
            <p><strong>Address:</strong> ${job.recipient?.address_line1 || ''} ${job.recipient?.address_city || ''}, ${job.recipient?.address_state || ''} ${job.recipient?.address_zip || ''}</p>
            <hr>
            <div>${data.body || 'Letter content'}</div>
          </body>
        </html>
      `;
      
      try {
        const fallbackPdf = await htmlToPdfBuffer(fallbackHtml);
        pdf = Buffer.from(fallbackPdf);
      } catch (fallbackError) {
        console.error('Fallback PDF generation also failed:', fallbackError);
        throw new Error('PDF generation completely failed: ' + String(pdfError));
      }
    }

    const to = job.recipient as any;
    const from = job.sender as any;

    const tracking = await lob.sendLetterPDF({ to, from, pdfBuffer: pdf, description: (job.templateId ?? undefined) as any });
    
    // Update job status to completed
    job.status = 'completed';
    job.tracking = tracking;
    
    // Save updated job
    if (jobIndex >= 0) {
      jobs[jobIndex] = job;
      writeJobs(jobs);
    }
    
    console.log('Job processed from file store:', job.id, job.status);
  } catch (error) {
    console.error('Error processing job from file store:', job.id, error);
    job.status = 'failed';
    job.error = String(error);
    
    // Add error event to tracking
    if (!job.tracking) job.tracking = { provider: 'pending', code: '', events: [] };
    job.tracking.events.push({
      at: new Date().toISOString(),
      status: 'failed',
      details: String(error)
    });
    
    const jobs = readJobs();
    const jobIndex = (jobs as any[]).findIndex((j: any) => j.id === job.id);
    if (jobIndex >= 0) {
      jobs[jobIndex] = job;
      writeJobs(jobs);
    }
  }
}

async function processJob(jobId: string) {
  const prismaClient = await initPrisma();
  if (!prismaClient) {
    console.log('Worker using file store - job processing disabled');
    return;
  }
  
  const job = await prismaClient.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    // update status -> processing
    await prismaClient.job.update({ where: { id: jobId }, data: { status: 'processing' } });

    const template = await loadTemplate(job.templateId || 'letter');
    let data: any = {};
    if (job.body) {
      try {
        data = JSON.parse(job.body as unknown as string);
      } catch {
        data = { body: job.body };
      }
    }

    const html = template({ ...data, sender: job.sender, recipient: job.recipient });
  const pdfUint8 = await htmlToPdfBuffer(html);
  const pdf = Buffer.from(pdfUint8);

    const to = job.recipient as any;
    const from = job.sender as any;

  const tracking = await lob.sendLetterPDF({ to, from, pdfBuffer: pdf, description: (job.templateId ?? undefined) as any });

    await prismaClient.job.update({ where: { id: jobId }, data: { status: 'sent', tracking: tracking as any } });
  } catch (err) {
  const currentOptions = (job.options && typeof job.options === 'object') ? job.options as any : {};
  const attempts = (currentOptions.attempts || 0) + 1;
  const nextStatus = attempts >= RETRY_MAX ? 'failed' : 'retrying';
  await prismaClient.job.update({ where: { id: jobId }, data: { status: nextStatus, options: { ...currentOptions, attempts } as any } });
    console.error('Job processing failed', jobId, err);
  }
}

async function pollLoop() {
  const prismaClient = await initPrisma();
  if (!prismaClient) {
    console.log('Worker using file store - polling enabled');
    // Process jobs from file store
    try {
      const jobs = readJobs();
      const pendingJobs = (jobs as any[]).filter((j: any) => j.status === 'submitted');
      for (const job of pendingJobs) {
        await processJobFromFile(job);
      }
    } catch (e) {
      console.error('File store polling error:', e);
    }
    return;
  }
  
  // naive concurrency: fetch up to WORKER_CONCURRENCY jobs and process them
  const jobs = await prismaClient.job.findMany({ where: { status: 'submitted' }, take: WORKER_CONCURRENCY });
  for (const j of jobs) {
    processJob(j.id).catch((e) => console.error(e));
  }
}

if (process.env.NODE_ENV !== 'test') {
  console.log('Worker starting...');
  // Start polling immediately - initPrisma will handle database connection
  setInterval(pollLoop, 5000);
  pollLoop();
}

export { processJobFromFile };
export default { processJob, pollLoop, processJobFromFile };
