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
      const isValidId = (v: any) => typeof v === 'string' && /^tmpl_/.test(v);
      const hasValidLetter = isValidId(mapping.lob.file);
      const hasValidPostcard = isValidId(mapping.lob.front) && isValidId(mapping.lob.back);
      const hasValidSelfMailer = isValidId(mapping.lob.inside) && isValidId(mapping.lob.outside);

      const canUseSaved = (resource === 'letters' && hasValidLetter) || (resource === 'postcards' && hasValidPostcard) || (resource === 'self_mailers' && hasValidSelfMailer);

      if (canUseSaved) {
        // Use saved template path with merge variables
        tracking = await sendViaTemplate({
          resource,
          to,
          from,
          template: resource === 'letters' ? { file: mapping.lob.file } : undefined,
          postcardTemplates: resource === 'postcards' ? { front: mapping.lob.front, back: mapping.lob.back } : undefined,
          selfMailerTemplates: resource === 'self_mailers' ? { inside: mapping.lob.inside, outside: mapping.lob.outside } : undefined,
          mergeVariables: merge,
          color: Array.isArray(job.options) && job.options.includes('color'),
          doubleSided: Array.isArray(job.options) && job.options.includes('double_sided'),
          mailType: 'usps_first_class',
          description: job.templateId,
          metadata: { templateId: job.templateId || '', jobId: job.id },
        });
      } else {
        console.warn('Invalid or missing Lob template IDs; using inline HTML for job', { jobId: job.id, templateId: job.templateId, resource });
        // No IDs: inline HTML path
        if (resource === 'letters') {
          const template = await loadTemplate(job.templateId || 'letter');
          const html = template({ ...merge, sender: job.sender, recipient: job.recipient });
          tracking = await lobInline.sendInline({ resource: 'letters', to, from, letterHtml: html, color: true, doubleSided: false, mailType: 'usps_first_class', description: job.templateId });
        } else if (resource === 'postcards') {
          // USPS-safe postcard layout: reserve right panel for address/barcode
          const front = `<html><body style="width:6in;height:4in;margin:0"><div style="position:relative;width:6in;height:4in"><div style="position:absolute;left:0;top:0;width:6in;height:4in;overflow:hidden"><div style="position:absolute;left:0;top:0;right:0;bottom:0;padding:0.25in;font-family:Arial,sans-serif;color:#111"><h1 style="margin:0 0 .1in 0;font-size:28px">${merge.headline || ''}</h1><p style="margin:.05in 0 .1in 0;font-size:14px">${merge.subheadline || ''}</p></div></div></div></body></html>`;
          const back = `<html><body style="width:6in;height:4in;margin:0"><div style="position:relative;width:6in;height:4in;font-family:Arial,sans-serif;color:#111"><div style="position:absolute;left:0;top:0;width:3.5in;height:4in;padding:.25in;box-sizing:border-box"><div style="font-size:12px;line-height:1.4">${merge.body || ''}</div><div style="margin-top:.1in;font-weight:600;font-size:12px">${merge.cta_text || ''}</div></div><div style="position:absolute;right:0;top:0;width:2.5in;height:4in;padding:.25in;box-sizing:border-box"><div style="position:absolute;right:.25in;top:.3in;width:2in;height:2.75in;border:1px solid #eee"></div></div></div></body></html>`;
          tracking = await lobInline.sendInline({ resource: 'postcards', to, from, postcardFrontHtml: front, postcardBackHtml: back, mailType: 'usps_first_class', description: job.templateId });
        } else {
          const inside = `<html><body style="width:11in;height:9in;margin:0"><div style="padding:.5in;font-family:Arial,sans-serif"><h2 style="margin-top:0;font-size:20px">${merge.headline || ''}</h2><div style="font-size:12px;line-height:1.5">${merge.body || ''}</div></div></body></html>`;
          const outside = `<html><body style="width:11in;height:9in;margin:0"><div style="position:relative;width:11in;height:9in;font-family:Arial,sans-serif"><div style="position:absolute;right:0.75in;top:0.75in;width:4in;height:2.75in;border:1px solid #eee"></div><div style="position:absolute;left:.5in;top:.5in;right:4.25in;bottom:.5in"><h3 style="margin-top:0;font-size:18px">${merge.subheadline || ''}</h3></div></div></body></html>`;
          tracking = await lobInline.sendInline({ resource: 'self_mailers', to, from, selfInsideHtml: inside, selfOutsideHtml: outside, mailType: 'usps_first_class', description: job.templateId });
        }
      }
      job.status = 'completed';
      job.tracking = tracking;
      if (jobIndex >= 0) { jobs[jobIndex] = job; writeJobs(jobs); }
      console.log('Job processed via template:', job.id, job.status);
      return;
    }
    // No mapping present: always send via inline HTML (no PDF fallback)
    const resource: 'letters' = 'letters';
    const to = job.recipient as any;
    const from = job.sender as any;
    let data: any = {};
    if (job.body) {
      try { data = JSON.parse(job.body as unknown as string); } catch { data = { body: job.body }; }
    }
    const template = await loadTemplate(job.templateId || 'letter');
    const html = template({ ...data, sender: job.sender, recipient: job.recipient });
    const tracking = await lobInline.sendInline({ resource: 'letters', to, from, letterHtml: html, color: true, doubleSided: false, mailType: 'usps_first_class', description: job.templateId });
    job.status = 'completed';
    job.tracking = tracking;
    if (jobIndex >= 0) { jobs[jobIndex] = job; writeJobs(jobs); }
    console.log('Job processed via inline HTML (no fallback):', job.id, job.status);
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
    const to = job.recipient as any;
    const from = job.sender as any;
    const tracking = await lobInline.sendInline({ resource: 'letters', to, from, letterHtml: html, color: true, doubleSided: false, mailType: 'usps_first_class', description: job.templateId });

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
