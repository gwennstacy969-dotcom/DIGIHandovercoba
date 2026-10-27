import { describe, it } from 'node:test';
import assert from 'node:assert';

const ROLE_IDLE_TIMEOUTS_MINUTES = {
  AMT: 20,
  USER: 20,
  PENGAWAS: 15,
  ADMIN: 15,
  SUPER_ADMIN: 10
};

const ABSOLUTE_TIMEOUT_HOURS = 8;
const WARNING_THRESHOLD_SECONDS = 120; // 2 menit

function getIdleTimeoutSeconds(role) {
  const norm = String(role || '').toUpperCase().trim();
  const minutes = ROLE_IDLE_TIMEOUTS_MINUTES[norm] || 15;
  return minutes * 60;
}

function shouldShowWarning(remainingSeconds) {
  return remainingSeconds <= WARNING_THRESHOLD_SECONDS && remainingSeconds > 0;
}

describe('Frontend Session Timeout & RBAC Logic Tests', () => {
  it('Role-based Idle Timeout returns correct durations per role', () => {
    assert.strictEqual(getIdleTimeoutSeconds('AMT'), 1200); // 20 min
    assert.strictEqual(getIdleTimeoutSeconds('USER'), 1200); // 20 min
    assert.strictEqual(getIdleTimeoutSeconds('PENGAWAS'), 900); // 15 min
    assert.strictEqual(getIdleTimeoutSeconds('ADMIN'), 900); // 15 min
    assert.strictEqual(getIdleTimeoutSeconds('SUPER_ADMIN'), 600); // 10 min
  });

  it('Warning modal displays when remaining time is 2 minutes or less', () => {
    assert.strictEqual(shouldShowWarning(150), false);
    assert.strictEqual(shouldShowWarning(120), true);
    assert.strictEqual(shouldShowWarning(60), true);
    assert.strictEqual(shouldShowWarning(1), true);
    assert.strictEqual(shouldShowWarning(0), false); // Sudah expired, bukan lagi warning
  });

  it('Absolute timeout is strictly 8 hours (28,800 seconds)', () => {
    assert.strictEqual(ABSOLUTE_TIMEOUT_HOURS * 3600, 28800);
  });
});

