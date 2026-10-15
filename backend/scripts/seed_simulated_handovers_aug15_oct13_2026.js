/**
 * SEED SIMULASI HANDOVER MT — DIGIHANDOVER PERTAMINA
 * Periode: 15 Agustus 2026 – 13 Oktober 2026 (60 hari)
 *
 * Seluruh data adalah DATA SIMULASI/DEMO.
 * Usage:
 *   node scripts/seed_simulated_handovers_aug15_oct13_2026.js --dry-run
 *   node scripts/seed_simulated_handovers_aug15_oct13_2026.js --apply
 *   node scripts/seed_simulated_handovers_aug15_oct13_2026.js --rollback
 *   node scripts/seed_simulated_handovers_aug15_oct13_2026.js --validate-only
 */

'use strict';

const { assertNotProduction } = require('./_production_guard');
assertNotProduction('seed_simulated_handovers_aug15_oct13_2026.js');

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { createId } = require('@paralleldrive/cuid2');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SEED_MARKER          = 'SIMULASI/DEMO-AUG15-OCT13-2026';
const SEED_PREFIX          = '[SIMULASI/DEMO] ';
const PERIOD_START_STR     = '2026-08-15';
const PERIOD_END_STR       = '2026-10-13';
const SPECIAL_VEHICLE      = 'B9106SEI';   // bushing history terkuat (April + Juni 2026)
const INCIDENT_DATE        = '2026-09-27';
const BLOCKED_DATE         = '2026-09-28';
const REPAIR_DATE          = '2026-09-29';
const DEPOT_LAT            = -7.6187;
const DEPOT_LNG            = 109.1442;
const RANDOM_SEED          = 42;

const args        = process.argv.slice(2);
const IS_APPLY    = args.includes('--apply');
const IS_ROLLBACK = args.includes('--rollback');
const IS_VALIDATE = args.includes('--validate-only');
const IS_DRY_RUN  = !IS_APPLY && !IS_ROLLBACK && !IS_VALIDATE;

// ─── SEEDED RNG ───────────────────────────────────────────────────────────────

let _s = RANDOM_SEED;
function rand() {
  _s = (_s * 1664525 + 1013904223) & 0xffffffff;
  return (_s >>> 0) / 4294967296;
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toWIB(dateStr, h, m = 0, s = 0) {
  return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}+07:00`);
}

function allDates(from, to) {
  const dates = [];
  const [sy, sm, sd] = from.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const end = new Date(to + 'T12:00:00Z');
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function gps() {
  return {
    lat: parseFloat((DEPOT_LAT + (rand() - 0.5) * 0.003).toFixed(7)),
    lng: parseFloat((DEPOT_LNG + (rand() - 0.5) * 0.003).toFixed(7)),
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient({ log: [] });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SEED SIMULASI HANDOVER MT — DIGIHandover Pertamina         ║');
  console.log('║  Periode: 15 Agustus – 13 Oktober 2026 (60 hari)            ║');
  console.log(`║  Mode: ${IS_APPLY ? 'APPLY    ' : IS_ROLLBACK ? 'ROLLBACK ' : IS_VALIDATE ? 'VALIDATE ' : 'DRY RUN  '}                                                  ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── LOAD MASTER DATA ──────────────────────────────────────────────────────
  console.log('[1/6] Memuat master data...');

  const vehicles = await prisma.vehicle.findMany({ orderBy: { noPolisi: 'asc' } });
  const users    = await prisma.user.findMany({ where: { deletedAt: null }, select: { id:true, name:true, role:true, jabatan:true } });
  const items    = await prisma.checklistItem.findMany({ orderBy: [{ category:'asc' },{ name:'asc' }] });

  const amt1Users  = users.filter(u => u.role==='AMT' && u.jabatan?.includes('AMT I') && !u.jabatan?.includes('AMT II') && !u.name.includes('Demo'));
  const amt2Users  = users.filter(u => u.role==='AMT' && u.jabatan?.includes('AMT II') && !u.name.includes('Demo'));
  const adminUsers = users.filter(u => u.role==='ADMIN' || u.role==='PENGAWAS');

  console.log(`  ✓ ${vehicles.length} kendaraan | AMT I: ${amt1Users.length} | AMT II: ${amt2Users.length} | Admin: ${adminUsers.length}`);
  console.log(`  ✓ ${items.length} checklist items`);

  const specVehicle = vehicles.find(v => v.noPolisi === SPECIAL_VEHICLE);
  if (!specVehicle) { console.error(`  ❌ ${SPECIAL_VEHICLE} tidak ada di DB!`); await prisma.$disconnect(); process.exit(1); }

  // Corrective historis — referensi, BUKAN temuan baru
  console.log('\n  [ Corrective Historis — Referensi, bukan temuan baru di periode ini ]');
  const corrRef = [
    { p:'B9805SFU', d:'03 Feb 2026', u:'PERBAIKAN TEMUAN GCU', ada: vehicles.some(v=>v.noPolisi==='B9805SFU') },
    { p:'B9022SFV', d:'13 Feb 2026', u:'PENGGANTIAN TORQUE ROD', ada: true },
    { p:'B9106SEI', d:'04 Apr 2026', u:'PENGGANTIAN BUSHING PER TRAILER', ada: true },
    { p:'B9106SEI', d:'02 Jun 2026', u:'PERBAIKAN BUSHING PER TRAILER AXLE 2 KANAN DAN KIRI', ada: true },
    { p:'B9077SEI', d:'26 Jul 2026', u:'PERBAIKAN PENGGANTIAN DRAIN COK', ada: true },
  ];
  corrRef.forEach((c,i) => console.log(`  ${i+1}. ${c.p.padEnd(12)} | ${c.d.padEnd(14)} | ${c.ada?'✓ ADA di master':'⚠️  TIDAK ADA'} | ${c.u}`));
  if (!corrRef[0].ada) console.log('  ⚠️  B9805SFU tidak terdaftar di master kendaraan — dilewati dari seeding.');

  // Identitas Dedi Irmawan
  const deniAditya = users.find(u => u.name === 'Deni Aditya Irnawan');
  const dediSantoso = users.find(u => u.name === 'DEDI SANTOSO');
  console.log('\n  [ Identifikasi "Dedi Irmawan" ]');
  console.log('  ⚠️  "Dedi Irmawan" tidak ditemukan persis di database.');
  console.log(`  → Kandidat 1: "${deniAditya?.name}" (AMT I) — id: ${deniAditya?.id}`);
  console.log(`  → Kandidat 2: "${dediSantoso?.name}" (AMT I) — id: ${dediSantoso?.id}`);
  console.log('  → Keputusan: Menggunakan "Deni Aditya Irnawan" sebagai AMT 1 pada kejadian 27 Sept');
  console.log('    (ditemukan di data existing: N9326UI mulai 26-09-2026, amt2="Deni Aditya Irnawan")');
  console.log('    Perbedaan ejaan "Dedi Irmawan" vs "Deni Aditya Irnawan" dilaporkan ke user.');

  // ── ROLLBACK ──────────────────────────────────────────────────────────────
  if (IS_ROLLBACK) {
    console.log('\n[ROLLBACK] Menghapus data simulasi...');
    const simHv = await prisma.handover.findMany({ where: { notes: { contains: SEED_MARKER } }, select: { id:true } });
    console.log(`  Ditemukan ${simHv.length} records simulasi`);
    if (simHv.length > 0) {
      await prisma.handover.deleteMany({ where: { id: { in: simHv.map(h=>h.id) } } });
      console.log(`  ✓ ${simHv.length} records berhasil dihapus`);
    }
    await prisma.$disconnect();
    console.log('\n✅ Rollback selesai.\n');
    return;
  }

  // ── VALIDATE ONLY ─────────────────────────────────────────────────────────
  if (IS_VALIDATE) {
    console.log('\n[VALIDATE] Hasil validasi:');
    console.log(`  ${vehicles.length >= 45 ? '✓' : '❌'} Kendaraan: ${vehicles.length} (need >= 45)`);
    console.log(`  ${amt1Users.length >= 2 ? '✓' : '❌'} AMT I: ${amt1Users.length}`);
    console.log(`  ${amt2Users.length >= 2 ? '✓' : '❌'} AMT II: ${amt2Users.length}`);
    console.log(`  ${adminUsers.length >= 1 ? '✓' : '❌'} Admin: ${adminUsers.length}`);
    console.log(`  ${specVehicle ? '✓' : '❌'} Incident vehicle ${SPECIAL_VEHICLE}: ${specVehicle ? 'ADA' : 'TIDAK ADA'}`);
    await prisma.$disconnect();
    return;
  }

  // ── BUILD DAY PLANS ───────────────────────────────────────────────────────
  console.log('\n[2/6] Menyusun rencana harian...');

  const dates   = allDates(PERIOD_START_STR, PERIOD_END_STR);
  const plates  = vehicles.map(v => v.noPolisi);
  const verifier = adminUsers[0];
  const incAmt1 = deniAditya || amt1Users[0];
  const incAmt2 = amt2Users.find(u => u.id !== incAmt1.id) || amt2Users[0];

  let totalSiklus = 0;
  const dayPlans = [];

  for (const dateStr of dates) {
    const isIncident = dateStr === INCIDENT_DATE;
    const isBlocked  = dateStr === BLOCKED_DATE;
    const isRepair   = dateStr === REPAIR_DATE;

    // Excluded on blocked date
    const excluded   = isBlocked ? [SPECIAL_VEHICLE] : [];
    const available  = plates.filter(p => !excluded.includes(p));

    const targetCount = randInt(37, 43);
    let chosen = shuffle(available).slice(0, Math.min(targetCount, available.length));
    // Guarantee special vehicle appears on incident date
    if (isIncident && !chosen.includes(SPECIAL_VEHICLE)) {
      // Replace last element with special vehicle to keep count stable
      chosen = [...chosen.slice(0, chosen.length - 1), SPECIAL_VEHICLE];
    }

    const cycles = chosen.map(noPolisi => {
      const isSpecial = isIncident && noPolisi === SPECIAL_VEHICLE;
      const a1Idx = randInt(0, amt1Users.length - 1);
      const a2Idx = randInt(0, amt2Users.length - 1);
      const a1 = isSpecial ? incAmt1 : amt1Users[a1Idx];
      // Ensure AMT2 is not same person as AMT1 (shift index if collision)
      const rawA2 = isSpecial ? incAmt2 : amt2Users[a2Idx];
      const a2 = (rawA2.id === a1.id) ? amt2Users[(a2Idx + 1) % amt2Users.length] : rawA2;
      const reporter = isSpecial ? incAmt1 : (amt1Users[randInt(0, amt1Users.length - 1)]);
      const mH = randInt(5, 9), mM = randInt(0, 59);
      const aH = isSpecial ? 15 : Math.min(mH + randInt(7, 10), 22);
      const aM = randInt(0, 59);
      return { noPolisi, a1Name: a1.name, a1Id: a1.id, a2Name: a2.name, a2Id: a2.id, reporterId: reporter.id, mH, mM, aH, aM, isSpecial };
    });

    totalSiklus += cycles.length;
    dayPlans.push({ dateStr, cycles, isIncident, isBlocked, isRepair });
  }

  console.log(`  ✓ ${dates.length} hari | ~${totalSiklus} siklus rencana`);

  // Validate counts
  let daysInRange = 0;
  for (const dp of dayPlans) {
    if (dp.cycles.length >= 35 && dp.cycles.length <= 45) daysInRange++;
  }
  console.log(`  ✓ Hari dalam range 35-45: ${daysInRange}/${dates.length}`);

  // Validate blocked
  const blockedDay = dayPlans.find(d => d.dateStr === BLOCKED_DATE);
  const hasBlocked = !blockedDay?.cycles.find(c => c.noPolisi === SPECIAL_VEHICLE);
  console.log(`  ${hasBlocked ? '✓' : '❌'} ${SPECIAL_VEHICLE} ${hasBlocked ? 'tidak ada' : 'MASIH ADA'} pada ${BLOCKED_DATE} (target: tidak ada)`);

  // AMT distribution check
  const namesAmt1 = new Set(), namesAmt2 = new Set(), pairsSeen = new Set();
  dayPlans.slice(0, 10).forEach(dp => dp.cycles.forEach(c => {
    namesAmt1.add(c.a1Name); namesAmt2.add(c.a2Name);
    pairsSeen.add(`${c.a1Name}||${c.a2Name}`);
  }));
  console.log(`  ✓ Unique AMT I (10 hari pertama): ${namesAmt1.size}`);
  console.log(`  ✓ Unique AMT II (10 hari pertama): ${namesAmt2.size}`);
  console.log(`  ✓ Unique pasangan (10 hari pertama): ${pairsSeen.size}`);

  // ── DRY RUN SUMMARY ───────────────────────────────────────────────────────
  if (IS_DRY_RUN) {
    console.log('\n[DRY RUN] Sampel rencana:');
    const incidentDayIdx = dayPlans.findIndex(d => d.dateStr === INCIDENT_DATE);
    const blockedDayIdx  = dayPlans.findIndex(d => d.dateStr === BLOCKED_DATE);
    const repairDayIdx   = dayPlans.findIndex(d => d.dateStr === REPAIR_DATE);
    [dayPlans[0], dayPlans[19], incidentDayIdx>=0?dayPlans[incidentDayIdx]:null, blockedDayIdx>=0?dayPlans[blockedDayIdx]:null, repairDayIdx>=0?dayPlans[repairDayIdx]:null, dayPlans[59]].filter(Boolean).forEach(dp => {
      const tag = (dp.isIncident ? ' ← INCIDENT' : '') + (dp.isBlocked ? ' ← BLOCKED' : '') + (dp.isRepair ? ' ← REPAIR' : '');
      console.log(`  ${dp.dateStr}: ${dp.cycles.length} kendaraan${tag}`);
      dp.cycles.slice(0, 2).forEach(c => console.log(`    ${c.noPolisi.padEnd(12)} AMT1: ${c.a1Name.padEnd(30)} AMT2: ${c.a2Name}`));
      if (dp.cycles.length > 2) console.log(`    ... (${dp.cycles.length - 2} lagi)`);
    });

    const incDay = dayPlans.find(d => d.dateStr === INCIDENT_DATE);
    const incCycle = incDay?.cycles.find(c => c.isSpecial);
    console.log(`\n  [ Kejadian Khusus 27 Sept ]`);
    if (incCycle) {
      console.log(`  ✓ Kendaraan : ${incCycle.noPolisi}`);
      console.log(`  ✓ AMT 1     : ${incCycle.a1Name} (id: ${incCycle.a1Id})`);
      console.log(`  ✓ AMT 2     : ${incCycle.a2Name}`);
      console.log(`  ✓ Jam akhiri: ${incCycle.aH}:${String(incCycle.aM).padStart(2,'0')} WIB (sore hari)`);
      console.log(`  ✓ Temuan    : Kondisi Kompartemen Tangki [MAJOR] → Bushing Per Trailer & Torque Rod perlu diperiksa`);
      console.log(`  ✓ Issue     : Akan dibuat dengan status ONGOING`);
    } else {
      console.log(`  ⚠️  ${SPECIAL_VEHICLE} tidak masuk dalam siklus ${INCIDENT_DATE} (kemungkinan tidak diseleksi acak)`); 
      console.log('  → Script --apply akan memastikan kendaraan ini masuk dalam hari incident');
    }
    // Validate blocked
    const blockedDay2 = dayPlans.find(d => d.dateStr === BLOCKED_DATE);
    console.log(`\n  [ Blokir 28 Sept ]`);
    if (blockedDay2) {
      const hasIt = blockedDay2.cycles.find(c => c.noPolisi === SPECIAL_VEHICLE);
      console.log(`  ${hasIt ? '❌ GAGAL' : '✓ OK'} — ${SPECIAL_VEHICLE} ${hasIt ? 'MASIH ADA di 28 Sept' : 'dikecualikan dari 28 Sept'}`);
      console.log(`  ✓ Kendaraan lain operasional: ${blockedDay2.cycles.length}`);
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('DRY RUN selesai. Tidak ada data yang ditulis ke database.');
    console.log('Untuk menerapkan: node scripts/seed_simulated_handovers_aug15_oct13_2026.js --apply');
    await prisma.$disconnect();
    return;
  }

  // ── APPLY ─────────────────────────────────────────────────────────────────
  console.log('\n[3/6] Menulis data ke database...');

  // Check existing to prevent duplicate
  const existingCount = await prisma.handover.count({ where: { notes: { contains: SEED_MARKER } } });
  if (existingCount > 0) {
    console.log(`\n⚠️  Sudah ada ${existingCount} records simulasi. Jalankan --rollback dulu.\n`);
    await prisma.$disconnect();
    return;
  }

  // Env safety check
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    console.error('\n❌ DATABASE_URL bukan local dev environment. Dibatalkan!');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`  Target DB: ${dbUrl.replace(/:([^:@]+)@/,':***@')}`);

  let created = 0, errors = 0;
  let incidentAkhiriId = null;

  for (const dp of dayPlans) {
    process.stdout.write(`\r  Menulis ${dp.dateStr} (${dp.cycles.length} kendaraan)...        `);

    // Build checklist items (no handoverId — Prisma injects it automatically in nested create)
    const mkItems = (hasBad) => {
      const rows = items.map(it => {
        const bad = hasBad && it.name === 'Kondisi Kompartemen Tangki';
        return {
          id: createId(),
          category: it.category,
          name: bad ? `${it.name} [MAJOR] - ${SEED_PREFIX}Bushing Per Trailer & Torque Rod perlu diperiksa` : it.name,
          isGood: !bad,
          severity: bad ? 'MAJOR' : null,
          notes: bad ? `${SEED_PREFIX}Komponen bushing per trailer dan torque rod: keausan signifikan. Ref: corrective ${SPECIAL_VEHICLE} Apr & Jun 2026.` : null,
          isRepaired: false,
          repairNote: null,
          repairPhotoUrl: null,
          adminRejectionNote: null,
        };
      });
      rows.push({ id: createId(), category: 'C', name: `Odo Meter: ${randInt(50000,200000)}`, isGood: true, severity: null, notes: null, isRepaired: false, repairNote: null, repairPhotoUrl: null, adminRejectionNote: null });
      return rows;
    };

    const datePrefix = `HO-${dp.dateStr.replace(/-/g, '')}-`;
    const CHUNK_SIZE = 6;

    for (let i = 0; i < dp.cycles.length; i += CHUNK_SIZE) {
      const chunk = dp.cycles.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (c, idxInChunk) => {
        const globalIdx = i + idxInChunk + 1;
        const noMulai = `${datePrefix}${String(globalIdx * 2 - 1).padStart(4, '0')}`;
        const noAkhiri = `${datePrefix}${String(globalIdx * 2).padStart(4, '0')}`;

        try {
          const mulaiTs = toWIB(dp.dateStr, c.mH, c.mM, randInt(0,59));
          const akhiriTs = toWIB(dp.dateStr, c.aH, c.aM, randInt(0,59));
          const shift = `${String(c.mH).padStart(2,'0')}:${String(c.mM).padStart(2,'0')}`;
          const gps1 = gps(), gps2 = gps();
          const notesBase = SEED_PREFIX + SEED_MARKER;

          // Create MULAI
          const mulaiId = createId();
          await prisma.handover.create({
            data: {
              id: mulaiId,
              handoverNo: noMulai,
              noPolisi: c.noPolisi,
              shift,
              status: 'Siap Operasi (Normal)',
              type: 'mulai',
              locationLat: gps1.lat,
              locationLng: gps1.lng,
              amt1: c.a1Name,
              amt2: c.a2Name,
              timestamp: mulaiTs,
              userId: c.reporterId,
              createdAt: mulaiTs,
              updatedAt: mulaiTs,
              notes: notesBase,
              items: { create: mkItems(false) }
            }
          });

          // Create AKHIRI
          const akhiriId = createId();
          const akhiriStatus = c.isSpecial ? 'Ada Masalah' : 'Siap Operasi (Normal)';
          const akhiriNotes = c.isSpecial
            ? notesBase + ' | KEJADIAN KHUSUS 27 SEPT 2026 — TEMUAN BUSHING PER TRAILER MAJOR SAAT AKHIRI'
            : notesBase;

          await prisma.handover.create({
            data: {
              id: akhiriId,
              handoverNo: noAkhiri,
              noPolisi: c.noPolisi,
              shift,
              status: akhiriStatus,
              type: 'akhiri',
              locationLat: gps2.lat,
              locationLng: gps2.lng,
              amt1: c.a1Name,
              amt2: c.a2Name,
              timestamp: akhiriTs,
              userId: c.reporterId,
              createdAt: akhiriTs,
              updatedAt: akhiriTs,
              notes: akhiriNotes,
              items: { create: mkItems(c.isSpecial) },
              ...(c.isSpecial ? {
                issue: { create: { id: createId(), status: 'ONGOING', createdAt: akhiriTs, updatedAt: akhiriTs } }
              } : {})
            }
          });

          if (c.isSpecial) incidentAkhiriId = akhiriId;
          created += 2;
        } catch (err) {
          errors++;
          if (process.env.DEBUG) console.error(`\n  ❌ ${c.noPolisi} ${dp.dateStr}: ${err.message}`);
        }
      }));
    }

    // Handle repair on 29 Sept
    if (dp.isRepair && incidentAkhiriId) {
      try {
        const repairTs = toWIB(REPAIR_DATE, 8, randInt(0,30), 0);
        const hvWithIssue = await prisma.handover.findUnique({
          where: { id: incidentAkhiriId },
          include: { issue: true, items: true }
        });
        if (hvWithIssue?.issue) {
          // Mark bad items as repaired
          for (const item of hvWithIssue.items.filter(i => !i.isGood)) {
            await prisma.handoverItem.update({
              where: { id: item.id },
              data: {
                isRepaired: true,
                repairNote: SEED_PREFIX + 'Bushing Per Trailer dan Torque Rod telah diperiksa dan diganti. Komponen berfungsi normal. Diverifikasi Tim Workshop. [SIMULASI/DEMO]',
                repairPhotoUrl: 'uploads/SIMULASI_DEMO_repair_bushing_torque_rod_B9106SEI.jpg',
              }
            });
          }
          // Resolve issue
          await prisma.issue.update({
            where: { id: hvWithIssue.issue.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: repairTs,
              resolvedBy: (verifier?.name || 'ADMIN') + ' [SIMULASI/DEMO]',
              updatedAt: repairTs,
            }
          });
          // Restore vehicle status
          await prisma.vehicle.update({
            where: { noPolisi: SPECIAL_VEHICLE },
            data: { status: 'READY_TO_START', updatedAt: repairTs }
          });
          console.log(`\n  ✓ Repair + verifikasi ${SPECIAL_VEHICLE} selesai ${REPAIR_DATE}`);
        }
      } catch (err) {
        console.error(`\n  ❌ Repair error: ${err.message}`);
        errors++;
      }
    }

    // Block vehicle after incident
    if (dp.isIncident && incidentAkhiriId) {
      try {
        await prisma.vehicle.update({
          where: { noPolisi: SPECIAL_VEHICLE },
          data: { status: 'Maintenance', updatedAt: toWIB(INCIDENT_DATE, 15, 30, 0) }
        });
      } catch (e) { /* ignore */ }
    }
  }

  console.log(`\n\n[4/6] Ringkasan penulisan:`);
  console.log(`  ✓ Created: ${created} handover records`);
  console.log(`  ❌ Errors: ${errors}`);

  // ── FINAL VALIDATION ──────────────────────────────────────────────────────
  console.log('\n[5/6] Validasi akhir...');

  const simTotal = await prisma.handover.count({ where: { notes: { contains: SEED_MARKER } } });
  console.log(`  ✓ Total simulasi di DB: ${simTotal}`);

  const issueCheck = incidentAkhiriId
    ? await prisma.issue.findFirst({ where: { handoverId: incidentAkhiriId } })
    : null;
  console.log(`  ${issueCheck ? '✓' : '❌'} Issue temuan 27 Sept: ${issueCheck ? issueCheck.status : 'TIDAK DITEMUKAN'}`);

  const specVehicleNow = await prisma.vehicle.findUnique({ where: { noPolisi: SPECIAL_VEHICLE } });
  console.log(`  ✓ Status ${SPECIAL_VEHICLE} setelah selesai: ${specVehicleNow?.status}`);

  await prisma.$disconnect();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ SEEDING SIMULASI SELESAI                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch(async e => { console.error('\n❌ Fatal:', e.message); process.exit(1); });
