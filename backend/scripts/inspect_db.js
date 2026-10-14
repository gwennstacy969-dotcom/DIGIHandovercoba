const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: 'AMT' },
    select: { id: true, name: true, jabatan: true },
    orderBy: { jabatan: 'asc' }
  });
  const amt1 = users.filter(u => u.jabatan && u.jabatan.includes('AMT I') && !u.jabatan.includes('AMT II'));
  const amt2 = users.filter(u => u.jabatan && u.jabatan.includes('AMT II'));
  const other = users.filter(u => !amt1.includes(u) && !amt2.includes(u));
  console.log(`\nAMT I drivers (${amt1.length}):`);
  amt1.forEach(u => console.log(`  ${u.name.padEnd(45)} | ${u.jabatan} | ${u.id}`));
  console.log(`\nAMT II drivers (${amt2.length}):`);
  amt2.forEach(u => console.log(`  ${u.name.padEnd(45)} | ${u.jabatan} | ${u.id}`));
  console.log(`\nOther/unclear (${other.length}):`);
  other.forEach(u => console.log(`  ${u.name.padEnd(45)} | ${u.jabatan || 'null'} | ${u.id}`));

  // Check for "dedi" or "deni" pattern
  const dediSearch = users.filter(u => u.name.toLowerCase().includes('dedi') || u.name.toLowerCase().includes('deni'));
  console.log('\n=== Dedi/Deni pattern search ===');
  dediSearch.forEach(u => console.log(`  ${u.name} | ${u.jabatan} | ${u.id}`));

  // Count vehicles
  const vehicles = await prisma.vehicle.count();
  console.log(`\nTotal vehicles: ${vehicles}`);

  // Admin/pengawas users (for verifier)
  const adminUsers = await prisma.user.findMany({
    where: { deletedAt: null, role: { in: ['ADMIN', 'PENGAWAS'] } },
    select: { id: true, name: true, role: true }
  });
  console.log('\nAdmin/Pengawas users:');
  adminUsers.forEach(u => console.log(`  ${u.role.padEnd(15)} | ${u.name} | ${u.id}`));
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
