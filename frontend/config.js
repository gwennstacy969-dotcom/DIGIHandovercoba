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
  // Web browser
  if (Platform.OS === 'web') {
    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
    }
    const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost';
    return `http://${host}:3000`;
  }

  // Mobile: Jika env berupa tunnel atau HTTPS remote, prioritaskan
  const envUrl = process.env.EXPO_PUBLIC_API_URL ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '') : null;
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl;
  }

  // Mobile dalam Expo Go: Deteksi host IP aktif dari debugger/Metro (paling akurat saat ganti Wi-Fi)
  const expoHost = getExpoHost();
  if (expoHost) {
    return `http://${expoHost}:3000`;
  }

  // Jika env URL ada dan valid IPv4 lokal (bukan localhost atau IP usang)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('192.168.1.33')) {
    return envUrl;
  }

  // Fallback default LAN
  return 'http://192.168.1.3:3000';
};

// URL Aktif yang diekspor
export let API_URL = getDefaultApiUrl();
export const getApiUrl = () => API_URL || getDefaultApiUrl();

// Fungsi untuk load URL tersimpan di AsyncStorage saat startup
export const loadSavedApiUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem(CUSTOM_API_URL_KEY);
    if (saved && saved.trim()) {
      const clean = saved.trim().replace(/\/+$/, '');
      // Bersihkan jika tersimpan localhost atau IP lama yang sudah mati pada mobile
      if (Platform.OS !== 'web' && (clean.includes('localhost') || clean.includes('127.0.0.1') || clean.includes('192.168.1.33'))) {
        console.warn('[CONFIG] Purging obsolete saved IP on mobile:', clean);
        await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
      } else {
        API_URL = clean;
        console.log(`[CONFIG] loadSavedApiUrl() -> using CUSTOM_API_URL: ${API_URL}`);
        return API_URL;
      }
    }
  } catch (e) {
    console.warn('Gagal memuat saved API_URL:', e);
  }
  API_URL = getDefaultApiUrl();
  console.log(`[CONFIG] loadSavedApiUrl() -> using default: ${API_URL}`);
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
