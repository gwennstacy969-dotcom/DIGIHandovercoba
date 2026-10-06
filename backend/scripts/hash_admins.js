const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['SUPER_ADMIN', 'PENGAWAS', 'ADMIN']
      }
    }
  });

  for (const user of users) {
    if (!user.password.startsWith('$2b$')) {
      // It's a plain text password, hash it!
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log(`Updated password for admin: ${user.username}`);
    } else {
      console.log(`Admin ${user.username} is already hashed.`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
