const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany({ where: { type: 'AUTH' } });
  console.log(notifs);
  
  const reqs = await prisma.passwordResetRequest.findMany();
  console.log(reqs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
