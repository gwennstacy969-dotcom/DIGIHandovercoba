const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.passwordResetRequest.deleteMany({});
  console.log('deleted');
}

main().catch(console.error).finally(() => prisma.$disconnect());
