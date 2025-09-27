import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import { PrismaClient } from '@prisma/client';
import lob from './providers/lob.js';
import { htmlToPdfBuffer } from './pdf.js';

dotenv.config();

const prisma = new PrismaClient();

async function loadTemplate(name = 'letter') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const file = path.join(__dirname, '..', 'templates', `${name}.hbs`);
  const src = await fs.readFile(file, 'utf8');
  return Handlebars.compile(src);
}

async function ensureTmp() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const tmp = path.join(__dirname, '..', 'tmp');
  await fs.mkdir(tmp, { recursive: true });
  return tmp;
}

async function runOnce() {
  console.log('Debug runner starting — connecting to DB');
  await prisma.$connect();
  const jobs = await prisma.job.findMany({ where: { status: 'submitted' }, orderBy: { createdAt: 'asc' } });
  if (!jobs.length) {
    console.log('No submitted jobs found');
    await prisma.$disconnect();
    return;
  }

  const tmp = await ensureTmp();

  for (const job of jobs) {
    console.log('Processing job', job.id);
    try {
      const tplName = job.templateId || 'letter';
      const template = await loadTemplate(tplName);
      let data: any = {};
      if (job.body) {
        try {
          data = JSON.parse(job.body as unknown as string);
        } catch {
          // body wasn't JSON — treat it as a plain text body
          data = { body: job.body };
        }
      }
      const html = template({ ...data, sender: job.sender, recipient: job.recipient });
      const htmlPath = path.join(tmp, `${job.id}.html`);
      await fs.writeFile(htmlPath, html, 'utf8');
      console.log('Saved rendered HTML to', htmlPath);

      const pdfBuf = await htmlToPdfBuffer(html);
      const pdfPath = path.join(tmp, `${job.id}.pdf`);
      await fs.writeFile(pdfPath, pdfBuf);
      console.log('Saved PDF to', pdfPath);

      // Attempt to send via Lob
      console.log('Calling Lob adapter for job', job.id);
      const to = job.recipient as any;
      const from = job.sender as any;
      const tracking = await lob.sendLetterPDF({ to, from, pdfBuffer: Buffer.from(pdfBuf), description: tplName });
      console.log('Lob response:', tracking);
      await prisma.job.update({ where: { id: job.id }, data: { status: 'sent', tracking: tracking as any } });
      console.log('Job marked sent', job.id);
    } catch (err: any) {
      console.error('Full error for job', job.id, err && err.stack ? err.stack : err);
      const currentOptions = (job.options && typeof job.options === 'object') ? job.options as any : {};
      const attempts = (currentOptions.attempts || 0) + 1;
      const nextStatus = attempts >= Number(process.env.RETRY_MAX || 3) ? 'failed' : 'retrying';
      await prisma.job.update({ where: { id: job.id }, data: { status: nextStatus, options: { ...currentOptions, attempts } as any } });
    }
  }

  await prisma.$disconnect();
}

if (process.env.NODE_ENV !== 'test') {
  runOnce().catch((e) => {
    console.error('Debug runner failed', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
