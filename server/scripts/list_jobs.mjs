import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  console.log(jobs.map(j => ({ id: j.id, status: j.status, createdAt: j.createdAt })));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch {} process.exit(1); });
