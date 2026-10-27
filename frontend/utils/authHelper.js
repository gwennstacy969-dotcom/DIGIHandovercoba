import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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
 * 3. Menghapus seluruh kredensial auth dari local storage dan axios headers.
 * 4. Mereset stack navigasi ke screen 'Login' tanpa riwayat kembali.
 */
export const handleLogoutAndReset = async (navigation, options = {}) => {
  if (isLoggingOut) return { success: false, reason: 'ALREADY_IN_PROGRESS' };
  isLoggingOut = true;

  const sessionExpiredMessage = typeof options === 'string' ? options : options?.message;
  let serverSessionCleared = false;

  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const baseUrl = getApiUrl();
        const response = await axios.post(`${baseUrl}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 6000
        });
        if (response.data?.success) {
          serverSessionCleared = true;
        }
      } catch (apiErr) {
        // Jika status 401 atau isSessionExpired, sesi server memang sudah tidak aktif
        if (apiErr.response?.status === 401) {
          serverSessionCleared = true;
        } else {
          console.warn('Logout server notification failed or timed out:', apiErr.message);
        }
      }
    } else {
      serverSessionCleared = true;
    }

    // Pembersihan lokal
    await AsyncStorage.multiRemove(['user', 'token', 'refreshToken']);
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
      serverSessionCleared
    };
  } catch (error) {
    console.error('Logout error while clearing storage:', error);
    return { success: false, error: error.message };
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
