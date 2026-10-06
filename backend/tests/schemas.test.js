const { loginSchema, submitHandoverSchema } = require('../src/validators/schemas');

describe('Validation Schemas', () => {
  it('loginSchema should validate correct input', () => {
    const { error } = loginSchema.validate({ username: 'admin', password: 'password123' });
    expect(error).toBeUndefined();
  });

  it('loginSchema should fail on missing password', () => {
    const { error } = loginSchema.validate({ username: 'admin' });
    expect(error).toBeDefined();
  });

  it('submitHandoverSchema should validate correct status', () => {
    const validData = {
      noPolisi: 'B 1234 CD',
      shift: 'Pagi',
      status: 'Aman',
      items: '[]'
    };
    const { error } = submitHandoverSchema.validate(validData);
    expect(error).toBeUndefined();
  });
  
  it('submitHandoverSchema should fail on invalid status', () => {
    const invalidData = {
      noPolisi: 'B 1234 CD',
      shift: 'Pagi',
      items: '[]',
      status: 'Rusak Berat', // Not in enum
    };
    const { error } = submitHandoverSchema.validate(invalidData);
    expect(error).toBeDefined();
  });
});
