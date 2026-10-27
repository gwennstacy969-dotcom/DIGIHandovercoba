import AsyncStorageRaw from '@react-native-async-storage/async-storage';
import axios from 'axios';

const storage = AsyncStorageRaw.default || AsyncStorageRaw;

const getApiUrl = () => {
  if (axios.defaults.baseURL) return axios.defaults.baseURL;
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'http://localhost:3000';
};

let isLoggingOut = false;

/**
 * Fungsi logout terpusat yang:
 * 1. Mencegah double-tap / race condition logout execution (idempotent).
 * 2. Mengirim request terautentikasi ke POST /api/auth/logout agar sesi aktif di server dilepas seketika.
 * 3. Hanya menganggap sesi server terbebas setelah server mengonfirmasi sukses (200) atau sesi memang sudah tidak aktif (401).
 * 4. Jika request server gagal karena masalah jaringan/timeout, fungsi mengembalikan kegagalan dan tidak menghapus kredensial lokal
 *    (kecuali force: true dioperkan secara eksplisit).
 * 5. Menghapus seluruh kredensial auth dari local storage dan axios headers setelah konfirmasi server.
 * 6. Mereset stack navigasi ke screen 'Login' tanpa riwayat kembali.
 * 
 * @param {object} navigation Objek navigasi React Navigation
 * @param {object|string} [options={}] Opsi logout: { message, force, isExpired }
 * @returns {Promise<{ success: boolean, serverSessionCleared: boolean, error?: string, canRetry?: boolean }>}
 */
export const handleLogoutAndReset = async (navigation, options = {}) => {
  if (isLoggingOut) return { success: false, serverSessionCleared: false, reason: 'ALREADY_IN_PROGRESS' };
  isLoggingOut = true;

  const sessionExpiredMessage = typeof options === 'string' ? options : options?.message;
  const isForce = Boolean(options?.force);
  const isExpired = Boolean(options?.isExpired || sessionExpiredMessage);

  let serverSessionCleared = false;
  let serverError = null;

  try {
    const token = await storage.getItem('token');

    // Jika logout dipicu oleh session yang sudah expired/revoked dari server
    if (isExpired) {
      serverSessionCleared = true;
    } else if (token) {
      try {
        const baseUrl = getApiUrl();
        const response = await axios.post(`${baseUrl}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 6000
        });

        if (response.data?.success) {
          serverSessionCleared = true;
        } else {
          serverError = response.data?.error || 'Gagal memutus sesi server';
        }
      } catch (apiErr) {
        // Jika server mengembalikan 401 (Unauthorized / Session Expired / Revoked),
        // ini membuktikan sesi server memang sudah tidak aktif/sudah dicabut
        if (apiErr.response?.status === 401) {
          serverSessionCleared = true;
        } else {
          serverError = apiErr.response?.data?.error || apiErr.message || 'Gagal terhubung ke server untuk mencabut sesi';
          console.warn('Logout server request failed:', serverError);
        }
      }
    } else {
      // Tidak ada token lokal tersimpan
      serverSessionCleared = true;
    }

    // Jika sesi server BELUM berhasil dicabut dan bukan mode force/expired:
    // Jangan hapus token lokal dan jangan reset navigasi agar akun tidak terkunci di server tanpa bisa logout
    if (!serverSessionCleared && !isForce) {
      return {
        success: false,
        serverSessionCleared: false,
        error: serverError || 'Gagal memutus sesi di server. Periksa koneksi internet Anda dan coba lagi.',
        canRetry: true
      };
    }

    // Pembersihan lokal dilakukan HANYA setelah server mengonfirmasi atau jika force/expired
    await storage.multiRemove(['user', 'token', 'refreshToken']);
    delete axios.defaults.headers.common['Authorization'];

    // Navigasi ke halaman login dengan reset stack
    const loginParams = sessionExpiredMessage ? { sessionExpiredMessage } : undefined;

    if (navigation && typeof navigation.reset === 'function') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: loginParams }],
      });
    } else if (navigation && typeof navigation.replace === 'function') {
      navigation.replace('Login', loginParams);
    }

    return {
      success: true,
      serverSessionCleared: true
    };
  } catch (error) {
    console.error('Logout error while handling reset:', error);
    return { success: false, serverSessionCleared: false, error: error.message };
  } finally {
    isLoggingOut = false;
  }
};

export const getDashboardRoute = (roleOrUser) => {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'AdminDashboard';
  if (role === 'PENGAWAS') return 'PengawasDashboard';
  return 'UserDashboard';
};
