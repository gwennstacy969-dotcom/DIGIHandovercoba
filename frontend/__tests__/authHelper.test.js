import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDashboardRoute } from '../utils/authHelper.js';

describe('authHelper - getDashboardRoute', () => {
  it('returns AdminDashboard for SUPER_ADMIN or ADMIN role string', () => {
    assert.strictEqual(getDashboardRoute('SUPER_ADMIN'), 'AdminDashboard');
    assert.strictEqual(getDashboardRoute('ADMIN'), 'AdminDashboard');
  });

  it('returns AdminDashboard for user object with SUPER_ADMIN or ADMIN role', () => {
    assert.strictEqual(getDashboardRoute({ role: 'SUPER_ADMIN' }), 'AdminDashboard');
    assert.strictEqual(getDashboardRoute({ role: 'ADMIN' }), 'AdminDashboard');
  });

  it('returns PengawasDashboard for PENGAWAS role', () => {
    assert.strictEqual(getDashboardRoute('PENGAWAS'), 'PengawasDashboard');
    assert.strictEqual(getDashboardRoute({ role: 'PENGAWAS' }), 'PengawasDashboard');
  });

  it('returns UserDashboard for AMT or other roles', () => {
    assert.strictEqual(getDashboardRoute('AMT'), 'UserDashboard');
    assert.strictEqual(getDashboardRoute('USER'), 'UserDashboard');
    assert.strictEqual(getDashboardRoute({ role: 'AMT' }), 'UserDashboard');
    assert.strictEqual(getDashboardRoute(null), 'UserDashboard');
  });
});
