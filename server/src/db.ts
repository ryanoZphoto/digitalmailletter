import pino from 'pino';

const logger = (pino as any)();

let prisma: any = null;
let connected = false;

async function init() {
  if (prisma !== undefined) return { prisma, connected };
  
  // Check if DATABASE_URL is properly formatted
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('postgresql://') || dbUrl.includes('[AUTO_SET_BY_RAILWAY]')) {
    logger.warn('DATABASE_URL not properly configured; falling back to file store', { dbUrl: dbUrl ? 'set but invalid' : 'not set' });
    prisma = null;
    connected = false;
    return { prisma, connected };
  }
  
  try {
    // Only import PrismaClient if we have a valid DATABASE_URL
    const { PrismaClient } = await import('@prisma/client');
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
