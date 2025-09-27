import { PrismaClient } from '@prisma/client';
(async function(){
  const p = new PrismaClient();
  try {
    await p.job.update({ where: { id: 'dU1Zak1AERp5' }, data: { status: 'submitted' } });
    console.log('requeued');
  } catch (e) {
    console.error('requeue failed', e);
  } finally {
    await p.$disconnect();
  }
})();
