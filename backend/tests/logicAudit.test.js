const request = require('supertest');
const { submitHandoverSchema, vehicleSchema } = require('../src/validators/schemas');

describe('Logic Audit Fixes Verification', () => {
  describe('Schema & Vehicle Status Defaults', () => {
    it('vehicleSchema should default status to READY_TO_START', () => {
      const { value, error } = vehicleSchema.validate({
        noPolisi: 'B 1234 XYZ',
        barcode: 'BC1234'
      });
      expect(error).toBeUndefined();
      expect(value.status).toBe('READY_TO_START');
    });

    it('submitHandoverSchema should accept valid handover status and reject invalid', () => {
      const valid = submitHandoverSchema.validate({
        noPolisi: 'B 1234 XYZ',
        shift: '1',
        type: 'mulai',
        status: 'Siap Operasi (Normal)',
        items: []
      });
      expect(valid.error).toBeUndefined();

      const invalid = submitHandoverSchema.validate({
        noPolisi: 'B 1234 XYZ',
        shift: '1',
        type: 'mulai',
        status: 'StatusNgawur',
        items: []
      });
      expect(invalid.error).toBeDefined();
    });
  });
});
