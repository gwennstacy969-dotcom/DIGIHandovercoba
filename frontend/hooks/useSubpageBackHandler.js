import React, { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboardRoute } from '../utils/authHelper';

/**
 * Hook untuk menangani tombol Back Android pada subhalaman / halaman sekunder.
 * Memastikan bahwa menekan tombol kembali tidak langsung keluar aplikasi,
 * melainkan kembali ke halaman sebelumnya atau langsung kembali ke Beranda (Dashboard).
 *
 * @param {object} navigation - React Navigation object
 * @param {object|string} user - Data user atau role untuk menentukan dashboard
 * @param {Array<{ isOpen: boolean, close: () => void }>} modals - Daftar modal aktif yang perlu ditutup lebih dulu
 * @param {function} onBack - Custom back action (opsional)
 */
export function useSubpageBackHandler({
  navigation,
  user,
  modals = [],
  onBack,
}) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBackPress = () => {
        // 1. Jika ada modal yang sedang terbuka di halaman ini, tutup modal tersebut terlebih dahulu
        if (Array.isArray(modals)) {
          for (const modal of modals) {
            if (modal && modal.isOpen) {
              modal.close();
              return true;
            }
          }
        }

        // 2. Jika ada custom back action
        if (onBack) {
          const handled = onBack();
          if (handled !== false) return true;
        }

        // 3. Kembali ke halaman sebelumnya di stack jika ada
        if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
          navigation.goBack();
          return true;
        }

        // 4. Jika stack kosong / tidak bisa goBack (misal dibuka via replace), kembali ke Beranda (Dashboard)
        const targetDashboard = getDashboardRoute(user);
        if (navigation && typeof navigation.replace === 'function') {
          navigation.replace(targetDashboard);
        } else if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate(targetDashboard);
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, user, modals, onBack])
  );
}
