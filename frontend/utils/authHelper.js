import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/**
 * Fungsi logout terpusat yang menghapus seluruh kredensial auth dari storage,
 * menghapus Authorization header di axios, dan mereset stack navigasi ke 'Login'
 * sehingga riwayat navigasi (dashboard dll) terhapus total dan tidak bisa dibalikkan via tombol Back Android.
 */
export const handleLogoutAndReset = async (navigation) => {
  try {
    await AsyncStorage.multiRemove(['user', 'token', 'refreshToken']);
  } catch (error) {
    console.error('Logout error while clearing storage:', error);
  }

  delete axios.defaults.headers.common['Authorization'];

  if (navigation && typeof navigation.reset === 'function') {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  } else if (navigation && typeof navigation.replace === 'function') {
    navigation.replace('Login');
  }
};

export const getDashboardRoute = (roleOrUser) => {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'AdminDashboard';
  if (role === 'PENGAWAS') return 'PengawasDashboard';
  return 'UserDashboard';
};
