import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock untuk window.localStorage agar AsyncStorage dapat berjalan di Node test runner
const memoryStorage = new Map();
global.window = {
  localStorage: {
    getItem: (k) => memoryStorage.get(k) || null,
    setItem: (k, v) => memoryStorage.set(k, String(v)),
    removeItem: (k) => memoryStorage.delete(k),
    clear: () => memoryStorage.clear()
  }
};

import AsyncStorageRaw from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getDashboardRoute, handleLogoutAndReset } from '../utils/authHelper.js';

const AsyncStorage = AsyncStorageRaw.default || AsyncStorageRaw;

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

describe('authHelper - handleLogoutAndReset Integration & Security Contract', () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  it('1. Sesi server berhasil dicabut -> bersihkan storage lokal dan navigasi ke Login', async () => {
    // Setup AsyncStorage dengan data login
    await AsyncStorage.setItem('token', 'valid-test-token-123');
    await AsyncStorage.setItem('user', JSON.stringify({ id: 'U1', role: 'ADMIN' }));

    // Mock axios post untuk sukses logout (200 OK)
    const originalPost = axios.post;
    axios.post = async (url) => {
      if (url.includes('/api/auth/logout')) {
        return { data: { success: true, message: 'Berhasil logout' } };
      }
      return originalPost(url);
    };

    let navigatedRoute = null;
    const mockNav = {
      reset: ({ routes }) => {
        navigatedRoute = routes[0]?.name;
      }
    };

    const result = await handleLogoutAndReset(mockNav);

    // Kembalikan mock
    axios.post = originalPost;

    assert.equal(result.success, true);
    assert.equal(result.serverSessionCleared, true);
    assert.equal(navigatedRoute, 'Login');

    // Pastikan storage lokal bersih
    const storedToken = await AsyncStorage.getItem('token');
    assert.equal(storedToken, null);
  });

  it('2. Request server gagal/timeout tanpa force -> jangan klaim sukses dan JANGAN hapus storage lokal', async () => {
    await AsyncStorage.setItem('token', 'active-token-456');

    // Mock axios post melempar network error / timeout
    const originalPost = axios.post;
    axios.post = async () => {
      const netError = new Error('Network timeout: server unreachable');
      netError.code = 'ECONNABORTED';
      throw netError;
    };

    let resetCalled = false;
    const mockNav = {
      reset: () => { resetCalled = true; },
      replace: () => { resetCalled = true; }
    };

    const result = await handleLogoutAndReset(mockNav, { force: false });

    // Kembalikan mock
    axios.post = originalPost;

    // Server session TIDAK boleh dilaporkan terbebas
    assert.equal(result.success, false);
    assert.equal(result.serverSessionCleared, false);
    assert.equal(result.canRetry, true);
    assert.equal(resetCalled, false, 'Navigasi tidak boleh di-reset jika sesi server belum terkonfirmasi lepas');

    // Kredensial lokal harus tetap utuh agar user tidak terkunci dari sesi aktifnya
    const tokenAfter = await AsyncStorage.getItem('token');
    assert.equal(tokenAfter, 'active-token-456');
  });

  it('3. Server merespons 401 Unauthorized -> membuktikan sesi sudah tidak aktif di server -> bersihkan lokal', async () => {
    await AsyncStorage.setItem('token', 'revoked-token-789');

    // Mock axios melempar 401
    const originalPost = axios.post;
    axios.post = async () => {
      const err = new Error('Unauthorized');
      err.response = { status: 401, data: { isSessionExpired: true } };
      throw err;
    };

    let navigatedTo = null;
    const mockNav = {
      reset: ({ routes }) => { navigatedTo = routes[0]?.name; }
    };

    const result = await handleLogoutAndReset(mockNav);
    axios.post = originalPost;

    assert.equal(result.success, true);
    assert.equal(result.serverSessionCleared, true);
    assert.equal(navigatedTo, 'Login');

    const tokenAfter = await AsyncStorage.getItem('token');
    assert.equal(tokenAfter, null);
  });

  it('4. Logout dengan opsi force: true saat jaringan offline -> tetap bersihkan lokal dengan pemberitahuan', async () => {
    await AsyncStorage.setItem('token', 'forced-token-999');

    const originalPost = axios.post;
    axios.post = async () => {
      throw new Error('No internet connection');
    };

    let resetCalled = false;
    const mockNav = {
      reset: () => { resetCalled = true; }
    };

    const result = await handleLogoutAndReset(mockNav, { force: true });
    axios.post = originalPost;

    assert.equal(result.success, true);
    assert.equal(result.serverSessionCleared, true);
    assert.equal(resetCalled, true);

    const tokenAfter = await AsyncStorage.getItem('token');
    assert.equal(tokenAfter, null);
  });
});
