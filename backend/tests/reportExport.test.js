const request = require('supertest');
const app = require('../index');
const prisma = require('../src/config/prisma');
const TokenManager = require('../src/utils/TokenManager');
const ExcelJS = require('exceljs');

const binaryParser = (res, callback) => {
  const data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(data)));
};

describe('Report Export API (Excel & PDF) - Isolated Test Fixtures', () => {
  jest.setTimeout(30000);

  const testSuffix = `RPT_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let testAdmin;
  let testSuperAdmin;
  let testPengawas;
  let testAmt;

  let adminToken;
  let superAdminToken;
  let pengawasToken;
  let amtToken;

  beforeAll(async () => {
    // Buat fixture pengguna unik yang terdaftar secara sah di database tes
    testAdmin = await prisma.user.create({
      data: {
        username: `adm_${testSuffix}`,
        password: 'hashed_password_test',
        name: `Admin Test ${testSuffix}`,
        role: 'ADMIN',
        jabatan: 'Admin Operasional'
      }
    });

    testSuperAdmin = await prisma.user.create({
      data: {
        username: `sa_${testSuffix}`,
        password: 'hashed_password_test',
        name: `Super Admin Test ${testSuffix}`,
        role: 'SUPER_ADMIN',
        jabatan: 'Super Administrator'
      }
    });

    testPengawas = await prisma.user.create({
      data: {
        username: `peng_${testSuffix}`,
        password: 'hashed_password_test',
        name: `Pengawas Test ${testSuffix}`,
        role: 'PENGAWAS',
        jabatan: 'Pengawas Lapangan'
      }
    });

    testAmt = await prisma.user.create({
      data: {
        username: `amt_${testSuffix}`,
        password: 'hashed_password_test',
        name: `AMT Test ${testSuffix}`,
        role: 'AMT',
        jabatan: 'Driver AMT 1'
      }
    });

    // Terbitkan token JWT otentik yang valid untuk masing-masing role
    adminToken = TokenManager.generateAccessToken(testAdmin);
    superAdminToken = TokenManager.generateAccessToken(testSuperAdmin);
    pengawasToken = TokenManager.generateAccessToken(testPengawas);
    amtToken = TokenManager.generateAccessToken(testAmt);
  });

  afterAll(async () => {
    try {
      // Bersihkan seluruh user fixture setelah pengujian selesai
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [testAdmin.id, testSuperAdmin.id, testPengawas.id, testAmt.id]
          }
        }
      });
    } catch (_) {}
    await prisma.$disconnect();
  });

  describe('Authorization enforcement (RBAC)', () => {
    it('should reject PENGAWAS role from exporting Excel with 403', async () => {
      const res = await request(app)
        .get('/api/reports/excel')
        .set('Authorization', `Bearer ${pengawasToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/tidak diizinkan/i);
    });

    it('should reject PENGAWAS role from exporting PDF with 403', async () => {
      const res = await request(app)
        .get('/api/reports/pdf')
        .set('Authorization', `Bearer ${pengawasToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/tidak diizinkan/i);
    });

    it('should reject AMT role from exporting Excel with 403', async () => {
      const res = await request(app)
        .get('/api/reports/excel')
        .set('Authorization', `Bearer ${amtToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/reports/excel');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/excel (ADMIN & SUPER_ADMIN)', () => {
    it('should return valid Excel file with required headers and sheets for ADMIN', async () => {
      const res = await request(app)
        .get('/api/reports/excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

      // Parse the returned buffer as an Excel workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      // Verify Sheets exist
      const sheet1 = workbook.getWorksheet('Laporan Handover');
      expect(sheet1).toBeDefined();

      const sheet2 = workbook.getWorksheet('Detail Temuan & Perbaikan');
      expect(sheet2).toBeDefined();

      const sheet3 = workbook.getWorksheet('Rekap & Statistik');
      expect(sheet3).toBeDefined();

      // Verify required fields in Sheet 1 headers (Row 5)
      const headerRow5 = sheet1.getRow(5).values;
      expect(headerRow5).toContain('ID Handover');
      expect(headerRow5).toContain('Tanggal & Waktu');
      expect(headerRow5).toContain('No. Polisi');
      expect(headerRow5).toContain('Kru AMT');
      expect(headerRow5).toContain('Jabatan');

      // Verify required fields in Sheet 2 headers (Row 4)
      const headerRow4 = sheet2.getRow(4).values;
      expect(headerRow4).toContain('Handover ID');
      expect(headerRow4).toContain('Tanggal & Waktu');
      expect(headerRow4).toContain('No. Polisi');
      expect(headerRow4).toContain('Kru AMT');
      expect(headerRow4).toContain('Jabatan');
    });

    it('should allow SUPER_ADMIN to export Excel (inherited permission)', async () => {
      const res = await request(app)
        .get('/api/reports/excel')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('should support search query filter for Excel export', async () => {
      const res = await request(app)
        .get('/api/reports/excel?search=AA8410OP')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });

  describe('GET /api/reports/pdf (ADMIN & SUPER_ADMIN)', () => {
    it('should return valid PDF file for ADMIN', async () => {
      const res = await request(app)
        .get('/api/reports/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');

      // PDF starts with %PDF-
      const pdfHeader = res.body.slice(0, 5).toString('utf-8');
      expect(pdfHeader).toBe('%PDF-');
    });

    it('should allow SUPER_ADMIN to export PDF (inherited permission)', async () => {
      const res = await request(app)
        .get('/api/reports/pdf')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');

      const pdfHeader = res.body.slice(0, 5).toString('utf-8');
      expect(pdfHeader).toBe('%PDF-');
    });

    it('should support single handover export via handoverId', async () => {
      const res = await request(app)
        .get('/api/reports/pdf?handoverId=dummy-test-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');

      const pdfHeader = res.body.slice(0, 5).toString('utf-8');
      expect(pdfHeader).toBe('%PDF-');
    });
  });
});
