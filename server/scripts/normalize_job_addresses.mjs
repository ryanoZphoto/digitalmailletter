import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function normalize(jobId) {
  await prisma.$connect();
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    console.error('Job not found', jobId);
    await prisma.$disconnect();
    process.exit(1);
  }

  const defaultToObj = (o) => {
    if (!o || typeof o !== 'object') return {};
    // Map older keys to newer lob-style keys if needed
    return {
      name: o.name || o.fullName || o.name,
      company: o.company || o.org,
      address_line1: o.address_line1 || o.address1 || o.line1 || o.address || '',
      address_line2: o.address_line2 || o.address2 || o.line2 || '',
      address_city: o.address_city || o.city || o.town || '',
      address_state: o.address_state || o.state || o.region || '',
      address_zip: o.address_zip || o.postal_code || o.zip || '',
      address_country: o.address_country || o.country || o.country_code || o.countryName || ''
    };
  };

  const sender = defaultToObj(job.sender);
  const recipient = defaultToObj(job.recipient);

  await prisma.job.update({ where: { id: jobId }, data: { sender, recipient, status: 'submitted' } });
  console.log('Normalized job', jobId);
  await prisma.$disconnect();
}

if (process.argv.length < 3) {
  console.error('Usage: node normalize_job_addresses.mjs <jobId>');
  process.exit(1);
}

normalize(process.argv[2]).catch(async (e) => {
  console.error('Failed', e);
  try { await prisma.$disconnect(); } catch (err) {}
  process.exit(1);
});
