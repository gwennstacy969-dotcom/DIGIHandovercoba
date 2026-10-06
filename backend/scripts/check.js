const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const latest = await prisma.handover.findFirst({
    orderBy: { timestamp: 'desc' },
    include: { items: true, photos: true }
  });
  console.log(JSON.stringify(latest, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
