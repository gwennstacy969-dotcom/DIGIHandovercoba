import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Storage key untuk IP kustom
export const CUSTOM_API_URL_KEY = '@custom_server_url';

// Helper untuk deteksi host IP dari Expo Go / Metro
export const getExpoHost = () => {
  try {
    const hostUri = Constants.expoConfig?.hostUri
      || Constants.expoGoConfig?.debuggerHost
      || Constants.manifest?.debuggerHost
      || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const parsed = hostUri.split(':')[0];
      if (parsed && parsed !== 'localhost' && parsed !== '127.0.0.1') {
        return parsed;
      }
    }
    if (Constants.linkingUri) {
      const match = Constants.linkingUri.match(/:\/\/(.[^/:]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
    if (Constants.experienceUrl) {
      const match = Constants.experienceUrl.match(/:\/\/(.[^/:]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

// 1. Dapatkan fallback IP default (dari .env / Expo Go / Web / Default IP)
export const getDefaultApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '') : null;

  // Web browser
  if (Platform.OS === 'web') {
    // Jika env berupa HTTPS remote (produksi / tunnel), prioritaskan
    if (envUrl && envUrl.startsWith('https://')) {
      return envUrl;
    }

    // Pada Web browser, tentukan endpoint dinamis berdasarkan host pemanggil
    if (typeof window !== 'undefined' && window.location) {
      const { protocol, hostname, port } = window.location;

      // Jika dibuka di browser lokal (localhost / 127.0.0.1), gunakan localhost:3000
      // Ini mencegah timeout jika envUrl berisi IP LAN yang telah berganti DHCP
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//localhost:3000`;
      }

      // Jika di hosting produksi tanpa port khusus atau port 80/443 (reverse proxy)
      if (!port || port === '80' || port === '443') {
        return `${protocol}//${hostname}`;
      }

      // Jika dibuka dari perangkat lain via LAN IP (misal http://192.168.1.14:8081)
      return `${protocol}//${hostname}:3000`;
    }

    if (envUrl) {
      return envUrl;
    }
    return 'http://localhost:3000';
  }

  // Mobile: Jika env berupa tunnel atau HTTPS remote, prioritaskan
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl;
  }

  // Mobile dalam Expo Go: Deteksi host IP aktif dari debugger/Metro (paling akurat saat ganti Wi-Fi)
  const expoHost = getExpoHost();
  if (expoHost) {
    return `http://${expoHost}:3000`;
  }

  // Android Emulator fallback jika mengarah ke localhost
  if (Platform.OS === 'android' && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    return 'http://10.0.2.2:3000';
  }

  // Jika env URL ada dan valid IPv4 lokal (bukan localhost)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // Fallback default resmi untuk Standalone APK / Production
  return 'https://pertamina-handover.com';
};

// URL Aktif yang diekspor
export let API_URL = getDefaultApiUrl();
export const getApiUrl = () => API_URL || getDefaultApiUrl();

// Helper untuk mengklasifikasikan kegagalan request API secara akurat
export const classifyApiError = (error) => {
  if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
    return {
      type: 'TIMEOUT',
      isTimeout: true,
      message: 'Koneksi ke server melebihi batas waktu (timeout). Server mungkin sibuk atau tidak terjangkau.'
    };
  }
  if (!error.response) {
    return {
      type: 'NETWORK_ERROR',
      isNetworkError: true,
      message: `Tidak dapat terhubung ke server backend di ${API_URL}. Pastikan backend aktif dan jaringan stabil.`
    };
  }
  const status = error.response.status;
  if (status === 401) {
    return {
      type: 'AUTH_UNAUTHORIZED',
      isAuthError: true,
      message: error.response.data?.error || 'Sesi telah berakhir atau tidak valid. Silakan login kembali.'
    };
  }
  if (status === 403) {
    return {
      type: 'AUTH_FORBIDDEN',
      isAuthError: true,
      message: error.response.data?.error || 'Akses ditolak: Anda tidak memiliki izin untuk fitur ini.'
    };
  }
  if (status >= 500) {
    return {
      type: 'SERVER_ERROR',
      isServerError: true,
      message: error.response.data?.error || 'Terjadi kesalahan pada sistem backend (5xx).'
    };
  }
  return {
    type: 'CLIENT_ERROR',
    isClientError: true,
    message: error.response.data?.error || 'Permintaan tidak valid (4xx).'
  };
};

// Fungsi untuk load URL saat startup (membersihkan URL tersimpan lama)
export const loadSavedApiUrl = async () => {
  try {
    // Bersihkan custom server url lama agar selalu sinkron dengan server hosting / environment
    await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
  } catch (e) {
    // ignore
  }
  API_URL = getDefaultApiUrl();
  axios.defaults.baseURL = API_URL;
  console.log(`[CONFIG] loadSavedApiUrl() -> using default: ${API_URL} (Platform: ${Platform.OS})`);
  return API_URL;
};

// Fungsi untuk simpan URL kustom baru secara dinamis
export const saveApiUrl = async (newUrl) => {
  try {
    let clean = (newUrl || '').trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    API_URL = clean;
    await AsyncStorage.setItem(CUSTOM_API_URL_KEY, clean);
    return clean;
  } catch (e) {
    console.error('Gagal menyimpan API_URL:', e);
    throw e;
  }
};

// Fungsi untuk reset kembali ke default
export const resetApiUrl = async () => {
  try {
    await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
    API_URL = getDefaultApiUrl();
    return API_URL;
  } catch (e) {
    console.error('Gagal reset API_URL:', e);
    throw e;
  }
};

export default {
  get API_URL() {
    return API_URL;
  },
  getDefaultApiUrl,
  loadSavedApiUrl,
  saveApiUrl,
  resetApiUrl,
  getExpoHost,
};
