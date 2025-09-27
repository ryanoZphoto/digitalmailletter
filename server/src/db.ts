import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = (pino as any)();

let prisma: PrismaClient | null = null;
let connected = false;

async function init() {
  if (prisma) return { prisma, connected };
  try {
    prisma = new PrismaClient();
    // try a simple query to validate connection
    await prisma.$connect();
    connected = true;
    logger.info('Prisma connected to database');
  } catch (e) {
    logger.warn('Prisma failed to connect; falling back to file store', { error: String(e) });
    prisma = null;
    connected = false;
  }
  return { prisma, connected };
}

export { init };
