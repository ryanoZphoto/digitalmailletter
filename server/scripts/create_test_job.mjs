import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const job = await prisma.job.create({
    data: {
      templateId: 'letter',
      body: JSON.stringify({
        subject: 'Test letter from debug script',
        body: 'This is a test letter created by create_test_job.mjs'
      }),
      sender: {
        name: process.env.MAIL_FROM_NAME || 'Test Sender',
        address_line1: '123 Main St',
        address_line2: '',
        city: 'Anytown',
        state: 'CA',
        postal_code: '94105',
        country: process.env.MAIL_FROM_COUNTRY || 'US'
      },
      recipient: {
        name: 'Test Recipient',
        address_line1: '456 Market St',
        address_line2: 'Apt 7',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94103',
        country: 'US'
      },
      service: 'lob',
      options: {},
      status: 'submitted',
      tracking: {}
    }
  });
  console.log('Created job', job.id);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Failed to create job', e);
  try { await prisma.$disconnect(); } catch (err) {}
  process.exit(1);
});
