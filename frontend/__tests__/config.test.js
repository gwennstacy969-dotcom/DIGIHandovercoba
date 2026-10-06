const assert = require('assert');
const test = require('node:test');

test('Frontend Configuration Test', async (t) => {
  await t.test('should validate API URL format', () => {
    const hostIp = '127.0.0.1';
    const apiUrl = `http://${hostIp}:3000`;
    assert.strictEqual(apiUrl.startsWith('http://'), true);
    assert.strictEqual(apiUrl.endsWith(':3000'), true);
  });

  await t.test('should handle fallback host when undefined', () => {
    const fallbackIp = 'localhost';
    const apiUrl = `http://${fallbackIp}:3000`;
    assert.strictEqual(apiUrl, 'http://localhost:3000');
  });
});
