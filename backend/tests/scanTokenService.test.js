const scanTokenService = require('../src/services/scanTokenService');

describe('ScanTokenService Unit Tests', () => {
  const userId = 'USR-001';
  const vehicleId = 'VH-001';
  const noPolisi = 'B9810TEI';
  const processType = 'mulai';

  it('1. should issue a valid token', () => {
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, processType);
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes hex
  });

  it('2. should validate and consume a valid token', () => {
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, processType);
    const result = scanTokenService.consume(token, userId, vehicleId, processType);

    expect(result.valid).toBe(true);
    expect(result.payload.noPolisi).toBe(noPolisi);
    expect(result.payload.processType).toBe(processType);
  });

  it('3. should reject when token is missing', () => {
    const result = scanTokenService.consume(null, userId, vehicleId, processType);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Token scan tidak ditemukan');
  });

  it('4. should reject token if user does not match', () => {
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, processType);
    const result = scanTokenService.consume(token, 'DIFFERENT_USER', vehicleId, processType);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('tidak cocok dengan pengguna');
  });

  it('5. should reject token if vehicle does not match', () => {
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, processType);
    const result = scanTokenService.consume(token, userId, 'DIFFERENT_VEHICLE', processType);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('tidak cocok dengan kendaraan');
  });

  it('6. should reject token if processType does not match (mulai vs akhiri)', () => {
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, 'mulai');
    const result = scanTokenService.consume(token, userId, vehicleId, 'akhiri');

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('bukan "akhiri"');
  });

  it('7. should enforce single-use (token cannot be used twice)', () => {
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, processType);
    const firstUse = scanTokenService.consume(token, userId, vehicleId, processType);
    expect(firstUse.valid).toBe(true);

    const secondUse = scanTokenService.consume(token, userId, vehicleId, processType);
    expect(secondUse.valid).toBe(false);
  });

  it('8. should reject expired token', () => {
    // TTL -1ms so it is immediately expired
    const token = scanTokenService.issue(userId, vehicleId, noPolisi, processType, -100);
    const result = scanTokenService.consume(token, userId, vehicleId, processType);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('kedaluwarsa');
  });
});

