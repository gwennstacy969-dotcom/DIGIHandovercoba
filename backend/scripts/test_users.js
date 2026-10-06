const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(u => {
  console.log(u.slice(0, 5));
  prisma.$disconnect();
});
