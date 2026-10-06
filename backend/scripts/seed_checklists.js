const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_ITEMS = [
  { category: 'A', name: 'Kondisi Rem', severity: 'Major' },
  { category: 'A', name: 'Kondisi Wiper', severity: 'Minor' },
  { category: 'A', name: 'Kondisi Kompartemen Tangki', severity: 'Major' },
  { category: 'A', name: 'Keberadaan DCP/ CO2', severity: 'Major' },
  { category: 'A', name: 'Oli Mesin', severity: 'Major' },
  { category: 'A', name: 'Air Radiator', severity: 'Minor' },
  { category: 'A', name: 'Keberadaan STNK', severity: 'Major' },
  { category: 'A', name: 'Keberadaan Surat Keur', severity: 'Major' },
  { category: 'A', name: 'Keberadaan Surat Tera', severity: 'Major' },
  { category: 'A', name: 'Keberadaan Kotak P3K', severity: 'Minor' },
  { category: 'A', name: 'Keberadaan Flame Trap', severity: 'Major' },
  { category: 'A', name: 'Keberadaan Tools Kit termasuk dongkrak', severity: 'Minor' },
  { category: 'A', name: 'Keberadaan Selang bongkar', severity: 'Major' },
  { category: 'A', name: 'Keberadaan Grounding Cable', severity: 'Major' },
  { category: 'A', name: 'Keberadaan Spill Kit', severity: 'Minor' },
  { category: 'B', name: 'Membawa SIM Sesuai Kendaraan', severity: 'Major' },
  { category: 'B', name: 'ID/ HSE Paspor Berlaku', severity: 'Major' },
  { category: 'B', name: 'Dokumen KIM', severity: 'Major' },
  { category: 'B', name: 'Menggunakan Seragam Kerja', severity: 'Minor' },
  { category: 'B', name: 'Menggunakan Safety Shoes', severity: 'Major' },
  { category: 'B', name: 'Menggunakan Safety Helm', severity: 'Major' },
  { category: 'B', name: 'Menggunakan Safety Glove', severity: 'Minor' },
  { category: 'B', name: 'Membawa Jas Hujan', severity: 'Minor' },
  { category: 'B', name: 'Membawa Buku Saku AMT', severity: 'Minor' }
];

async function main() {
  const count = await prisma.checklistItem.count();
  if (count === 0) {
    for (const item of DEFAULT_ITEMS) {
      await prisma.checklistItem.create({
        data: {
          category: item.category,
          name: item.name,
          severity: item.severity
        }
      });
    }
    console.log('Seeded checklist items.');
  } else {
    console.log('Checklist items already seeded.');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
