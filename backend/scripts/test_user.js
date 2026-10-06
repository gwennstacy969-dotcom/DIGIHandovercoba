const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({ where: { username: '0325.02.104' } }).then(u => {
  console.log(u);
  prisma.$disconnect();
});
