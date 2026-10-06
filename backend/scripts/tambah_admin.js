const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

// Mengambil input dari perintah terminal
const username = process.argv[2];
const password = process.argv[3];
const name = process.argv[4];
const role = process.argv[5] ? process.argv[5].toUpperCase() : 'ADMIN';

if (!username || !password || !name) {
  console.log("=========================================");
  console.log("CARA PENGGUNAAN SKRIP TAMBAH ADMIN/PENGAWAS");
  console.log("=========================================");
  console.log("Ketik di terminal dengan format berikut:");
  console.log("node tambah_admin.js <username> <password> \"<nama lengkap>\" <role>");
  console.log("\nContoh nambah Admin:");
  console.log("node tambah_admin.js budi rahasia123 \"Budi Santoso\" ADMIN");
  console.log("\nContoh nambah Pengawas:");
  console.log("node tambah_admin.js andi sandi321 \"Andi Wijaya\" PENGAWAS");
  process.exit(1);
}

async function main() {
  try {
    // Mengecek apakah username sudah dipakai
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      console.log(`Gagal: Username '${username}' sudah digunakan oleh orang lain!`);
      return;
    }

    // Mengenkripsi password secara otomatis
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Memasukkan ke database
    await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
        name: name,
        role: role
      }
    });

    console.log(`\nSukses! Berhasil menambahkan ${role} baru:`);
    console.log(`- Nama     : ${name}`);
    console.log(`- Username : ${username}`);
    console.log(`(Password sudah otomatis dienkripsi dan aman)\n`);

  } catch (error) {
    console.error("Terjadi kesalahan:", error.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
