import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Storage key untuk IP kustom
export const CUSTOM_API_URL_KEY = '@custom_server_url';

// 1. Dapatkan fallback IP default (dari .env / Expo Go / Web / Default IP)
export const getDefaultApiUrl = () => {
  // Prioritas 1: Environment variable (dari .env)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  let host = 'localhost';
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.location?.hostname) {
        host = window.location.hostname;
      }
    } else if (Constants.expoConfig?.hostUri) {
      const parsed = Constants.expoConfig.hostUri.split(':')[0];
      if (parsed) host = parsed;
    } else if (Constants.manifest?.debuggerHost) {
      const parsed = Constants.manifest.debuggerHost.split(':')[0];
      if (parsed) host = parsed;
    } else if (Constants.manifest2?.extra?.expoGo?.debuggerHost) {
      const parsed = Constants.manifest2.extra.expoGo.debuggerHost.split(':')[0];
      if (parsed) host = parsed;
    }
  } catch (e) {
    // Standalone APK: Constants.manifest bisa null, jangan crash
    console.warn('getDefaultApiUrl fallback ke localhost:', e?.message);
  }
  return `http://${host}:3000`;
};

// URL Aktif yang diekspor
export let API_URL = getDefaultApiUrl();

// Fungsi untuk load URL tersimpan di AsyncStorage saat startup
export const loadSavedApiUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem(CUSTOM_API_URL_KEY);
    if (saved && saved.trim()) {
      API_URL = saved.trim().replace(/\/+$/, '');
      return API_URL;
    }
  } catch (e) {
    console.warn('Gagal memuat saved API_URL:', e);
  }
  API_URL = getDefaultApiUrl();
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
};

