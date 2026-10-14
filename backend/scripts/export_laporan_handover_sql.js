/**
 * EXPORT LAPORAN HANDOVER KE FILE SQL
 * 
 * Menghasilkan:
 * 1. data/laporan_handover_saja.sql     -> Khusus tabel `handover` saja (4.818 baris)
 * 2. data/laporan_handover_lengkap.sql  -> Tabel `handover`, `issue`, `amt_issue`, dan `handoveritem`
 */

'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const prisma = require('../src/config/prisma');

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    const y = v.getUTCFullYear();
    const m = pad(v.getUTCMonth() + 1);
    const d = pad(v.getUTCDate());
    const h = pad(v.getUTCHours());
    const mi = pad(v.getUTCMinutes());
    const s = pad(v.getUTCSeconds());
    const ms = String(v.getUTCMilliseconds()).padStart(3, '0');
    return `'${y}-${m}-${d} ${h}:${mi}:${s}.${ms}'`;
  }
  const str = String(v);
  return "'" + str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '\\0').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
}

async function exportSql() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  GENERATE FILE SQL LAPORAN HANDOVER PERTAMINA                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const outDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sqlHandoverOnlyPath = path.join(outDir, 'laporan_handover_saja.sql');
  const sqlHandoverLengkapPath = path.join(outDir, 'laporan_handover_lengkap.sql');

  console.log('[1/4] Mengambil data riwayat handover dari database...');
  const handovers = await prisma.handover.findMany({
    orderBy: { timestamp: 'asc' }
  });
  console.log(`  ✓ Ditemukan ${handovers.length} data handover.`);

  // ─── 1. FILE: laporan_handover_saja.sql ─────────────────────────────────────
  console.log('\n[2/4] Membuat data/laporan_handover_saja.sql...');
  const streamSolo = fs.createWriteStream(sqlHandoverOnlyPath, { encoding: 'utf-8' });

  streamSolo.write(`-- ========================================================\n`);
  streamSolo.write(`-- DIGIHANDOVER PERTAMINA PATRA NIAGA FT MAOS\n`);
  streamSolo.write(`-- DUMP DATA: KHUSUS LAPORAN HANDOVER SAJA\n`);
  streamSolo.write(`-- Total Records: ${handovers.length} baris\n`);
  streamSolo.write(`-- Periode: 15 Agustus 2026 - 13 Oktober 2026\n`);
  streamSolo.write(`-- Tanggal Export: ${new Date().toISOString()}\n`);
  streamSolo.write(`-- ========================================================\n\n`);
  streamSolo.write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  streamSolo.write(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`);
  streamSolo.write(`SET time_zone = "+00:00";\n`);
  streamSolo.write(`SET NAMES utf8mb4;\n\n`);

  streamSolo.write(`-- Struktur Tabel \`handover\`\n`);
  streamSolo.write(`DROP TABLE IF EXISTS \`handover\`;\n`);
  streamSolo.write(`CREATE TABLE \`handover\` (\n`);
  streamSolo.write(`  \`id\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamSolo.write(`  \`handoverNo\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamSolo.write(`  \`noPolisi\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamSolo.write(`  \`shift\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamSolo.write(`  \`status\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamSolo.write(`  \`type\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mulai',\n`);
  streamSolo.write(`  \`locationLat\` double DEFAULT NULL,\n`);
  streamSolo.write(`  \`locationLng\` double DEFAULT NULL,\n`);
  streamSolo.write(`  \`amt1\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamSolo.write(`  \`amt2\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamSolo.write(`  \`timestamp\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`);
  streamSolo.write(`  \`notes\` text COLLATE utf8mb4_unicode_ci,\n`);
  streamSolo.write(`  \`userId\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamSolo.write(`  \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`);
  streamSolo.write(`  \`updatedAt\` datetime(3) NOT NULL,\n`);
  streamSolo.write(`  PRIMARY KEY (\`id\`),\n`);
  streamSolo.write(`  KEY \`Handover_userId_fkey\` (\`userId\`),\n`);
  streamSolo.write(`  KEY \`handover_createdAt_status_noPolisi_idx\` (\`createdAt\`,\`status\`,\`noPolisi\`)\n`);
  streamSolo.write(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`);

  streamSolo.write(`-- Dumping data untuk tabel \`handover\` (${handovers.length} baris)\n`);

  const CHUNK_SIZE = 500;
  for (let i = 0; i < handovers.length; i += CHUNK_SIZE) {
    const chunk = handovers.slice(i, i + CHUNK_SIZE);
    const rowsSql = chunk.map(h => {
      return `(${sqlVal(h.id)}, ${sqlVal(h.handoverNo)}, ${sqlVal(h.noPolisi)}, ${sqlVal(h.shift)}, ${sqlVal(h.status)}, ${sqlVal(h.type)}, ${sqlVal(h.locationLat)}, ${sqlVal(h.locationLng)}, ${sqlVal(h.amt1)}, ${sqlVal(h.amt2)}, ${sqlVal(h.timestamp)}, ${sqlVal(h.notes)}, ${sqlVal(h.userId)}, ${sqlVal(h.createdAt)}, ${sqlVal(h.updatedAt)})`;
    }).join(',\n');

    streamSolo.write(`INSERT INTO \`handover\` (\`id\`, \`handoverNo\`, \`noPolisi\`, \`shift\`, \`status\`, \`type\`, \`locationLat\`, \`locationLng\`, \`amt1\`, \`amt2\`, \`timestamp\`, \`notes\`, \`userId\`, \`createdAt\`, \`updatedAt\`) VALUES\n${rowsSql};\n\n`);
  }

  streamSolo.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  streamSolo.end();
  console.log(`  ✓ Tersimpan di: ${sqlHandoverOnlyPath}`);

  // ─── 2. FILE: laporan_handover_lengkap.sql ──────────────────────────────────
  console.log('\n[3/4] Mengambil data isu kendaraan, kepatuhan AMT, dan checklist items...');
  const [issues, amtIssues] = await Promise.all([
    prisma.issue.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.amtIssue.findMany({ orderBy: { createdAt: 'asc' } })
  ]);
  console.log(`  ✓ Isu Kendaraan: ${issues.length} | Kepatuhan AMT: ${amtIssues.length}`);

  console.log('\n[4/4] Membuat data/laporan_handover_lengkap.sql (Handover + Isu + Kepatuhan AMT + Checklist)...');
  const streamFull = fs.createWriteStream(sqlHandoverLengkapPath, { encoding: 'utf-8' });

  streamFull.write(`-- ========================================================\n`);
  streamFull.write(`-- DIGIHANDOVER PERTAMINA PATRA NIAGA FT MAOS\n`);
  streamFull.write(`-- DUMP DATA: LAPORAN HANDOVER LENGKAP & INSPEKSI\n`);
  streamFull.write(`-- Meliputi: \`handover\`, \`issue\`, \`amt_issue\`, \`handoveritem\`\n`);
  streamFull.write(`-- Total Handover: ${handovers.length} baris\n`);
  streamFull.write(`-- Periode: 15 Agustus 2026 - 13 Oktober 2026\n`);
  streamFull.write(`-- Tanggal Export: ${new Date().toISOString()}\n`);
  streamFull.write(`-- ========================================================\n\n`);
  streamFull.write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  streamFull.write(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`);
  streamFull.write(`SET time_zone = "+00:00";\n`);
  streamFull.write(`SET NAMES utf8mb4;\n\n`);

  // Tabel handover
  streamFull.write(`-- Struktur Tabel \`handover\`\n`);
  streamFull.write(`DROP TABLE IF EXISTS \`handover\`;\n`);
  streamFull.write(`CREATE TABLE \`handover\` (\n`);
  streamFull.write(`  \`id\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`handoverNo\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`noPolisi\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`shift\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`status\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`type\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mulai',\n`);
  streamFull.write(`  \`locationLat\` double DEFAULT NULL,\n`);
  streamFull.write(`  \`locationLng\` double DEFAULT NULL,\n`);
  streamFull.write(`  \`amt1\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`amt2\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`timestamp\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`);
  streamFull.write(`  \`notes\` text COLLATE utf8mb4_unicode_ci,\n`);
  streamFull.write(`  \`userId\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`);
  streamFull.write(`  \`updatedAt\` datetime(3) NOT NULL,\n`);
  streamFull.write(`  PRIMARY KEY (\`id\`),\n`);
  streamFull.write(`  KEY \`Handover_userId_fkey\` (\`userId\`),\n`);
  streamFull.write(`  KEY \`handover_createdAt_status_noPolisi_idx\` (\`createdAt\`,\`status\`,\`noPolisi\`)\n`);
  streamFull.write(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`);

  for (let i = 0; i < handovers.length; i += CHUNK_SIZE) {
    const chunk = handovers.slice(i, i + CHUNK_SIZE);
    const rowsSql = chunk.map(h => {
      return `(${sqlVal(h.id)}, ${sqlVal(h.handoverNo)}, ${sqlVal(h.noPolisi)}, ${sqlVal(h.shift)}, ${sqlVal(h.status)}, ${sqlVal(h.type)}, ${sqlVal(h.locationLat)}, ${sqlVal(h.locationLng)}, ${sqlVal(h.amt1)}, ${sqlVal(h.amt2)}, ${sqlVal(h.timestamp)}, ${sqlVal(h.notes)}, ${sqlVal(h.userId)}, ${sqlVal(h.createdAt)}, ${sqlVal(h.updatedAt)})`;
    }).join(',\n');

    streamFull.write(`INSERT INTO \`handover\` (\`id\`, \`handoverNo\`, \`noPolisi\`, \`shift\`, \`status\`, \`type\`, \`locationLat\`, \`locationLng\`, \`amt1\`, \`amt2\`, \`timestamp\`, \`notes\`, \`userId\`, \`createdAt\`, \`updatedAt\`) VALUES\n${rowsSql};\n\n`);
  }

  // Tabel issue (Isu Kendaraan)
  streamFull.write(`-- Struktur Tabel \`issue\`\n`);
  streamFull.write(`DROP TABLE IF EXISTS \`issue\`;\n`);
  streamFull.write(`CREATE TABLE \`issue\` (\n`);
  streamFull.write(`  \`id\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`handoverId\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`status\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ONGOING',\n`);
  streamFull.write(`  \`resolvedAt\` datetime(3) DEFAULT NULL,\n`);
  streamFull.write(`  \`repairRequestedAt\` datetime(3) DEFAULT NULL,\n`);
  streamFull.write(`  \`resolvedBy\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`);
  streamFull.write(`  \`updatedAt\` datetime(3) NOT NULL,\n`);
  streamFull.write(`  PRIMARY KEY (\`id\`),\n`);
  streamFull.write(`  UNIQUE KEY \`Issue_handoverId_key\` (\`handoverId\`)\n`);
  streamFull.write(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`);

  if (issues.length > 0) {
    const issuesSql = issues.map(iss => {
      return `(${sqlVal(iss.id)}, ${sqlVal(iss.handoverId)}, ${sqlVal(iss.status)}, ${sqlVal(iss.resolvedAt)}, ${sqlVal(iss.repairRequestedAt)}, ${sqlVal(iss.resolvedBy)}, ${sqlVal(iss.createdAt)}, ${sqlVal(iss.updatedAt)})`;
    }).join(',\n');
    streamFull.write(`INSERT INTO \`issue\` (\`id\`, \`handoverId\`, \`status\`, \`resolvedAt\`, \`repairRequestedAt\`, \`resolvedBy\`, \`createdAt\`, \`updatedAt\`) VALUES\n${issuesSql};\n\n`);
  }

  // Tabel amt_issue (Kepatuhan AMT)
  streamFull.write(`-- Struktur Tabel \`amt_issue\`\n`);
  streamFull.write(`DROP TABLE IF EXISTS \`amt_issue\`;\n`);
  streamFull.write(`CREATE TABLE \`amt_issue\` (\n`);
  streamFull.write(`  \`id\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`handoverId\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`userId\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`amtName\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`amtRole\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT 'AMT_1',\n`);
  streamFull.write(`  \`itemName\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`category\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'B',\n`);
  streamFull.write(`  \`status\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',\n`);
  streamFull.write(`  \`notes\` text COLLATE utf8mb4_unicode_ci,\n`);
  streamFull.write(`  \`actionTaken\` text COLLATE utf8mb4_unicode_ci,\n`);
  streamFull.write(`  \`resolvedAt\` datetime(3) DEFAULT NULL,\n`);
  streamFull.write(`  \`resolvedBy\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n`);
  streamFull.write(`  \`updatedAt\` datetime(3) NOT NULL,\n`);
  streamFull.write(`  PRIMARY KEY (\`id\`),\n`);
  streamFull.write(`  KEY \`amt_issue_handoverId_idx\` (\`handoverId\`),\n`);
  streamFull.write(`  KEY \`amt_issue_userId_idx\` (\`userId\`),\n`);
  streamFull.write(`  KEY \`amt_issue_status_idx\` (\`status\`)\n`);
  streamFull.write(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`);

  if (amtIssues.length > 0) {
    const amtIssuesSql = amtIssues.map(ai => {
      return `(${sqlVal(ai.id)}, ${sqlVal(ai.handoverId)}, ${sqlVal(ai.userId)}, ${sqlVal(ai.amtName)}, ${sqlVal(ai.amtRole)}, ${sqlVal(ai.itemName)}, ${sqlVal(ai.category)}, ${sqlVal(ai.status)}, ${sqlVal(ai.notes)}, ${sqlVal(ai.actionTaken)}, ${sqlVal(ai.resolvedAt)}, ${sqlVal(ai.resolvedBy)}, ${sqlVal(ai.createdAt)}, ${sqlVal(ai.updatedAt)})`;
    }).join(',\n');
    streamFull.write(`INSERT INTO \`amt_issue\` (\`id\`, \`handoverId\`, \`userId\`, \`amtName\`, \`amtRole\`, \`itemName\`, \`category\`, \`status\`, \`notes\`, \`actionTaken\`, \`resolvedAt\`, \`resolvedBy\`, \`createdAt\`, \`updatedAt\`) VALUES\n${amtIssuesSql};\n\n`);
  }

  // Tabel handoveritem (Checklist Items)
  streamFull.write(`-- Struktur Tabel \`handoveritem\`\n`);
  streamFull.write(`DROP TABLE IF EXISTS \`handoveritem\`;\n`);
  streamFull.write(`CREATE TABLE \`handoveritem\` (\n`);
  streamFull.write(`  \`id\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`category\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`name\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`isGood\` tinyint(1) NOT NULL,\n`);
  streamFull.write(`  \`handoverId\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,\n`);
  streamFull.write(`  \`severity\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`notes\` text COLLATE utf8mb4_unicode_ci,\n`);
  streamFull.write(`  \`repairNote\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`repairPhotoUrl\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  \`isRepaired\` tinyint(1) NOT NULL DEFAULT '0',\n`);
  streamFull.write(`  \`adminRejectionNote\` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n`);
  streamFull.write(`  PRIMARY KEY (\`id\`),\n`);
  streamFull.write(`  KEY \`HandoverItem_handoverId_fkey\` (\`handoverId\`)\n`);
  streamFull.write(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`);

  const totalItems = await prisma.handoverItem.count();
  console.log(`  ✓ Mengekspor ${totalItems} item checklist ke SQL...`);

  const ITEM_CHUNK = 2000;
  for (let offset = 0; offset < totalItems; offset += ITEM_CHUNK) {
    const chunk = await prisma.handoverItem.findMany({
      skip: offset,
      take: ITEM_CHUNK
    });

    const itemsSql = chunk.map(it => {
      return `(${sqlVal(it.id)}, ${sqlVal(it.category)}, ${sqlVal(it.name)}, ${sqlVal(it.isGood)}, ${sqlVal(it.handoverId)}, ${sqlVal(it.severity)}, ${sqlVal(it.notes)}, ${sqlVal(it.repairNote)}, ${sqlVal(it.repairPhotoUrl)}, ${sqlVal(it.isRepaired)}, ${sqlVal(it.adminRejectionNote)})`;
    }).join(',\n');

    streamFull.write(`INSERT INTO \`handoveritem\` (\`id\`, \`category\`, \`name\`, \`isGood\`, \`handoverId\`, \`severity\`, \`notes\`, \`repairNote\`, \`repairPhotoUrl\`, \`isRepaired\`, \`adminRejectionNote\`) VALUES\n${itemsSql};\n\n`);
    process.stdout.write(`\r    Progress: ${Math.min(offset + ITEM_CHUNK, totalItems)} / ${totalItems} items... `);
  }

  streamFull.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  streamFull.end();
  console.log('Selesai!');
  console.log(`  ✓ Tersimpan di: ${sqlHandoverLengkapPath}`);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RINGKASAN FILE SQL BERHASIL DIBUAT                          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  1. data/laporan_handover_saja.sql    : ${(fs.statSync(sqlHandoverOnlyPath).size / 1024).toFixed(1)} KB (Tabel handover)  ║`);
  console.log(`║  2. data/laporan_handover_lengkap.sql : ${(fs.statSync(sqlHandoverLengkapPath).size / 1024 / 1024).toFixed(1)} MB (Semua relasi)║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

exportSql()
  .catch(e => {
    console.error('❌ Gagal export SQL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
