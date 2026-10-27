import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, AppState } from 'react-native';
import tw from 'twrnc';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { handleLogoutAndReset } from '../utils/authHelper';

const WARNING_THRESHOLD_SECONDS = 120; // 2 menit sebelum timeout
const PING_THROTTLE_MS = 30000; // Minimal 30 detik antar ping aktivitas

export default function SessionManager({ navigationRef }) {
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const [isAbsoluteWarning, setIsAbsoluteWarning] = useState(false);
  const lastActivityPingRef = useRef(0);
  const checkIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Logout dan bersihkan sesi secara terpusat
  const performLogout = useCallback(async (reasonMessage = 'Sesi Anda telah berakhir. Silakan login kembali.') => {
    try {
      setShowWarningModal(false);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      await handleLogoutAndReset(navigationRef, reasonMessage);
    } catch (err) {
      console.log('Error during auto-logout:', err.message);
    }
  }, [navigationRef]);

  // Ping aktivitas pengguna (hanya dipanggil saat interaksi nyata)
  const sendActivityPing = useCallback(async () => {
    const now = Date.now();
    if (now - lastActivityPingRef.current < PING_THROTTLE_MS) return;
    lastActivityPingRef.current = now;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      await axios.post(`${API_URL}/api/auth/session/activity`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });
      // Jika warning modal sedang aktif, tutup setelah ping berhasil
      setShowWarningModal(false);
    } catch (error) {
      if (error.response?.status === 401 && error.response?.data?.isSessionExpired) {
        performLogout(error.response.data.error || 'Sesi Anda telah berakhir.');
      }
    }
  }, [performLogout]);

  // Daftarkan handler statis untuk touch capture lintas platform
  useEffect(() => {
    SessionManager.recordActivity = sendActivityPing;
    return () => {
      SessionManager.recordActivity = null;
    };
  }, [sendActivityPing]);

  // Periksa status sesi ke backend tanpa mereset idle timer
  const checkSessionStatus = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      if (!token || !userStr) {
        setShowWarningModal(false);
        return;
      }

      const res = await axios.get(`${API_URL}/api/auth/session/status`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 6000
      });

      if (!res.data?.success) {
        performLogout('Sesi Anda tidak valid atau telah dicabut.');
        return;
      }

      // Mendukung kedua kontrak: res.data.session.* maupun top-level res.data.*
      const rawSession = res.data.session;
      const remainingIdleSeconds = rawSession?.remainingIdleSeconds !== undefined
        ? rawSession.remainingIdleSeconds
        : Math.max(0, Math.floor((res.data.remainingIdleMs || 0) / 1000));

      const remainingAbsoluteSeconds = rawSession?.remainingAbsoluteSeconds !== undefined
        ? rawSession.remainingAbsoluteSeconds
        : Math.max(0, Math.floor((res.data.remainingAbsoluteMs || 0) / 1000));

      const isExpired = rawSession?.isExpired || false;

      if (isExpired || remainingIdleSeconds <= 0 || remainingAbsoluteSeconds <= 0) {
        const msg = remainingAbsoluteSeconds <= 0
          ? 'Batas maksimum sesi 8 jam telah tercapai demi kepatuhan keamanan. Silakan login kembali.'
          : 'Sesi Anda telah berakhir karena tidak ada aktivitas. Silakan login kembali.';
        performLogout(msg);
        return;
      }

      const effectiveRemaining = Math.min(remainingIdleSeconds, remainingAbsoluteSeconds);
      if (effectiveRemaining <= WARNING_THRESHOLD_SECONDS) {
        setRemainingSeconds(effectiveRemaining);
        setIsAbsoluteWarning(remainingAbsoluteSeconds <= WARNING_THRESHOLD_SECONDS);
        setShowWarningModal(true);
      } else {
        setShowWarningModal(false);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        performLogout(error.response?.data?.error || 'Sesi Anda telah berakhir.');
      }
    }
  }, [performLogout]);

  // Setup event listeners untuk deteksi interaksi nyata pengguna pada Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleUserEvent = () => {
        sendActivityPing();
      };

      window.addEventListener('mousedown', handleUserEvent);
      window.addEventListener('keydown', handleUserEvent);
      window.addEventListener('touchstart', handleUserEvent);
      window.addEventListener('scroll', handleUserEvent);

      return () => {
        window.removeEventListener('mousedown', handleUserEvent);
        window.removeEventListener('keydown', handleUserEvent);
        window.removeEventListener('touchstart', handleUserEvent);
        window.removeEventListener('scroll', handleUserEvent);
      };
    } else {
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          // Hanya refresh status, tidak auto-extend activity tanpa touch
          checkSessionStatus();
        }
      });
      return () => subscription.remove();
    }
  }, [sendActivityPing, checkSessionStatus]);

  // Interval berkala untuk polling status sesi (setiap 20 detik)
  useEffect(() => {
    checkIntervalRef.current = setInterval(checkSessionStatus, 20000);
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkSessionStatus]);

  // Countdown timer saat modal peringatan terbuka
  useEffect(() => {
    if (showWarningModal) {
      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            performLogout(
              isAbsoluteWarning
                ? 'Batas maksimum sesi 8 jam telah tercapai. Silakan login kembali.'
                : 'Sesi Anda telah berakhir karena tidak ada aktivitas.'
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showWarningModal, isAbsoluteWarning, performLogout]);

  const handleKeepLoggedIn = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        await axios.post(`${API_URL}/api/auth/session/activity`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowWarningModal(false);
      checkSessionStatus();
    } catch (err) {
      performLogout('Gagal memperbarui sesi.');
    }
  };

  if (!showWarningModal) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <Modal visible={showWarningModal} transparent animationType="fade">
      <View style={tw`flex-1 bg-black/60 justify-center items-center p-4`}>
        <View style={tw`bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100`}>
          <View style={tw`w-14 h-14 bg-amber-100 rounded-full items-center justify-center self-center mb-4`}>
            <Feather name="clock" size={28} color="#D97706" />
          </View>

          <Text style={tw`text-xl font-black text-gray-800 text-center mb-2`}>
            {isAbsoluteWarning ? 'Batas Waktu Sesi Maksimum' : 'Peringatan Waktu Tidak Aktif'}
          </Text>

          <Text style={tw`text-sm text-gray-600 text-center mb-5 leading-5`}>
            {isAbsoluteWarning
              ? 'Sesi login Anda akan berakhir secara otomatis dalam 2 menit demi kepatuhan batas 8 jam. Silakan simpan pekerjaan Anda.'
              : 'Tidak ada aktivitas terdeteksi. Sesi Anda akan ditutup secara otomatis untuk menjaga keamanan data.'}
          </Text>

          {/* Countdown display */}
          <View style={tw`bg-amber-50 border border-amber-200 rounded-2xl py-3 px-4 mb-6 items-center`}>
            <Text style={tw`text-xs font-bold text-amber-800 uppercase tracking-wider mb-1`}>
              Sisa Waktu Sesi
            </Text>
            <Text style={tw`text-3xl font-black text-amber-600 tracking-tight font-mono`}>
              {timeFormatted}
            </Text>
          </View>

          <View style={tw`flex-col gap-3`}>
            {!isAbsoluteWarning && (
              <TouchableOpacity
                onPress={handleKeepLoggedIn}
                style={tw`bg-[#0055A5] py-3.5 px-5 rounded-2xl items-center shadow-md`}
              >
                <Text style={tw`text-white font-bold text-base`}>Tetap Login</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => performLogout('Anda memilih untuk keluar dari sistem.')}
              style={tw`bg-gray-100 py-3.5 px-5 rounded-2xl items-center`}
            >
              <Text style={tw`text-gray-700 font-bold text-base`}>Logout Sekarang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
