import dotenv from 'dotenv';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJobs, writeJobs } from './store.js';

dotenv.config();

// Import PrismaClient conditionally to avoid crashes when DATABASE_URL is invalid
let prisma: any = null;

import lob from './providers/lob.js';
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

    // Process the job using Lob API
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

export default { processJob, pollLoop };
