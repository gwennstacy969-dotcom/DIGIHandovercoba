import React, { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Hook untuk menangani tombol Back fisik / gestur Android pada halaman Dashboard (Beranda).
 * Sesuai kebutuhan:
 * 1. Jika ada modal notifikasi terbuka, tutup modal tersebut.
 * 2. Jika modal konfirmasi keluar sudah terbuka, batalkan/tutup modal tersebut.
 * 3. Jika sedang di beranda dan belum ada konfirmasi keluar, buka modal Konfirmasi Keluar.
 * Tombol kembali TIDAK akan langsung menutup aplikasi tanpa konfirmasi.
 */
export function useDashboardBackHandler({
  isLogoutVisible,
  setIsLogoutVisible,
  handleLogout,
  handleCancelLogout,
  showNotificationsModal,
  setShowNotificationsModal,
}) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBackPress = () => {
        // 1. Tutup modal notifikasi jika terbuka
        if (showNotificationsModal && setShowNotificationsModal) {
          setShowNotificationsModal(false);
          return true;
        }

        // 2. Batalkan modal logout jika sedang terbuka
        if (isLogoutVisible) {
          if (handleCancelLogout) {
            handleCancelLogout();
          } else if (setIsLogoutVisible) {
            setIsLogoutVisible(false);
          }
          return true;
        }

        // 3. Tampilkan modal Konfirmasi Keluar
        if (handleLogout) {
          handleLogout();
        } else if (setIsLogoutVisible) {
          setIsLogoutVisible(true);
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      isLogoutVisible,
      setIsLogoutVisible,
      handleLogout,
      handleCancelLogout,
      showNotificationsModal,
      setShowNotificationsModal,
    ])
  );
}
