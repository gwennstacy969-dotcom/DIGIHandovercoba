const request = require('supertest');
const express = require('express');
const vehicleRoutes = require('../src/routes/vehicles');
const scanTokenService = require('../src/services/scanTokenService');
const prisma = require('../src/config/prisma');

// Mock prisma for isolated route testing
jest.mock('../src/config/prisma', () => ({
  vehicle: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  handover: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  }
}));

// Mock authenticateToken to simulate logged in user
jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'USR-TEST-001', role: 'AMT', name: 'Budi Santoso' };
    next();
  },
  authorizeRole: () => (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/vehicles', vehicleRoutes);

describe('GET /api/vehicles/scan/:barcode Endpoint Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should find vehicle when scanned with exact registered barcode', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      id: 'VH-001',
      noPolisi: 'B9810TEI',
      barcode: 'BC_B9810TEI',
      status: 'Active'
    });
    prisma.handover.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/vehicles/scan/BC_B9810TEI?processType=mulai');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.vehicle.noPolisi).toBe('B9810TEI');
    expect(typeof res.body.scanToken).toBe('string');
  });

  it('2. should query database using barcode column ONLY, never matching noPolisi column', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      id: 'VH-001',
      noPolisi: 'B9810TEI',
      barcode: 'BC_B9810TEI',
      status: 'Active'
    });
    prisma.handover.findFirst.mockResolvedValue(null);

    await request(app).get('/api/vehicles/scan/BC_B9810TEI');

    const callArgs = prisma.vehicle.findFirst.mock.calls[0][0];
    const orConditions = callArgs.where.OR;

    // Every condition in OR must check 'barcode', none should check 'noPolisi'
    const hasNoPolisiCheck = orConditions.some(cond => 'noPolisi' in cond);
    expect(hasNoPolisiCheck).toBe(false);

    const allBarcodeChecks = orConditions.every(cond => 'barcode' in cond);
    expect(allBarcodeChecks).toBe(true);
  });

  it('3. should reject scan when barcode is not registered in database (returns 404)', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/vehicles/scan/BARCODE_UNKNOWN');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('tidak terdaftar di sistem');
  });
});

