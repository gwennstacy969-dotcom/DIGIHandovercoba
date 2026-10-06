const request = require('supertest');
const app = require('../index');
const TokenManager = require('../src/utils/TokenManager');
const ExcelJS = require('exceljs');

const binaryParser = (res, callback) => {
  const data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(data)));
};

describe('Report Export API (Excel & PDF)', () => {
  const adminUser = { id: 'USR-0001', username: 'yoan', role: 'ADMIN', name: 'Yoann' };
  const nonAdminUser = { id: 'USR-0010', username: 'haula', role: 'PENGAWAS', name: 'haula' };

  const adminToken = TokenManager.generateAccessToken(adminUser);
  const nonAdminToken = TokenManager.generateAccessToken(nonAdminUser);

  describe('Authorization enforcement', () => {
    it('should reject non-admin from exporting Excel with 403', async () => {
      const res = await request(app)
        .get('/api/reports/excel')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject non-admin from exporting PDF with 403', async () => {
      const res = await request(app)
        .get('/api/reports/pdf')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/reports/excel');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/excel', () => {
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

  describe('GET /api/reports/pdf', () => {
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
