const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_ITEMS = [
  { name: 'Kondisi Rem', severity: 'Major' },
  { name: 'Kondisi Wiper', severity: 'Minor' },
  { name: 'Kondisi Kompartemen Tangki', severity: 'Major' },
  { name: 'Keberadaan DCP/ CO2', severity: 'Major' },
  { name: 'Oli Mesin', severity: 'Major' },
  { name: 'Air Radiator', severity: 'Minor' },
  { name: 'Keberadaan STNK', severity: 'Major' },
  { name: 'Keberadaan Surat Keur', severity: 'Major' },
  { name: 'Keberadaan Surat Tera', severity: 'Major' },
  { name: 'Keberadaan Kotak P3K', severity: 'Minor' },
  { name: 'Keberadaan Flame Trap', severity: 'Major' },
  { name: 'Keberadaan Tools Kit termasuk dongkrak', severity: 'Minor' },
  { name: 'Keberadaan Selang bongkar', severity: 'Major' },
  { name: 'Keberadaan Grounding Cable', severity: 'Major' },
  { name: 'Keberadaan Spill Kit', severity: 'Minor' },
  { name: 'Membawa SIM Sesuai Kendaraan', severity: 'Major' },
  { name: 'ID/ HSE Paspor Berlaku', severity: 'Major' },
  { name: 'Dokumen KIM', severity: 'Major' },
  { name: 'Menggunakan Seragam Kerja', severity: 'Minor' },
  { name: 'Menggunakan Safety Shoes', severity: 'Major' },
  { name: 'Menggunakan Safety Helm', severity: 'Major' },
  { name: 'Menggunakan Safety Glove', severity: 'Minor' },
  { name: 'Membawa Jas Hujan', severity: 'Minor' },
  { name: 'Membawa Buku Saku AMT', severity: 'Minor' }
];

async function fixData() {
  const checklists = await prisma.checklistItem.findMany();
  const checklistMap = new Map();
  
  // Fill from default
  for (const item of DEFAULT_ITEMS) {
    checklistMap.set(item.name.toLowerCase().trim(), item.severity);
  }
  
  // Override with database checklist
  for (const item of checklists) {
    if (item.severity) {
        checklistMap.set(item.name.toLowerCase().trim(), item.severity);
    }
  }
  
  const brokenItems = await prisma.handoverItem.findMany({
    where: { isGood: false }
  });
  
  let updatedCount = 0;
  
  for (const item of brokenItems) {
    let newName = item.name;
    
    // Extract base name
    const nameMatch = newName.match(/^(.*?)\s*\[(?:MAJOR|MINOR)\]/i);
    let baseName = newName;
    if (nameMatch) {
      baseName = nameMatch[1];
    } else {
        const dashSplit = newName.split(' - ');
        baseName = dashSplit[0];
    }
    baseName = baseName.trim();
    
    // Find correct severity
    const correctSeverity = checklistMap.get(baseName.toLowerCase()) || 'Minor';
    
    // Determine the note part
    let note = '';
    const noteMatch = item.name.match(/-\s*(.*)$/);
    if (noteMatch) {
      note = noteMatch[1].trim();
    }
    
    const reconstructed = `${baseName} [${correctSeverity.toUpperCase()}]${note ? ' - ' + note : ''}`;
    
    if (item.name !== reconstructed) {
      await prisma.handoverItem.update({
        where: { id: item.id },
        data: { name: reconstructed }
      });
      console.log(`Updated ID ${item.id}: "${item.name}" -> "${reconstructed}"`);
      updatedCount++;
    }
  }
  
  console.log(`Fixed ${updatedCount} items.`);
}

fixData().catch(console.error).finally(() => prisma.$disconnect());
