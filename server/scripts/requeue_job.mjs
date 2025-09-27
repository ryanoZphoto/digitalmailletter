import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function requeue(id) {
  await prisma.$connect();
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    console.error('Job not found', id);
    await prisma.$disconnect();
    process.exit(1);
  }
  const newOptions = { ...(typeof job.options === 'object' ? job.options : {}), attempts: 0 };
  await prisma.job.update({ where: { id }, data: { status: 'submitted', options: newOptions } });
  console.log('Requeued', id);
  await prisma.$disconnect();
}

if (process.argv.length < 3) {
  console.error('Usage: node requeue_job.mjs <jobId>');
  process.exit(1);
}

requeue(process.argv[2]).catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch {} process.exit(1); });
