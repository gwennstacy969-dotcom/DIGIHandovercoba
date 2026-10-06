import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated, Image } from 'react-native';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function WebNavbar({
  user,
  title,
  subtitle,
  navigation,
  showBack = false,
  onBack,
  rightAction,
  style,
}) {
  // Animasi rotasi halus untuk border pelangi avatar (Pertamina tricolor) di dashboard
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!title) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: false,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [spinAnim, title]);

  // Sembunyikan navbar jika tidak ada title DAN user belum ada
  if (!title && !user) return null;

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Dynamic greeting berdasarkan waktu lokal (untuk dashboard)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'SELAMAT PAGI,';
    if (hour < 15) return 'SELAMAT SIANG,';
    if (hour < 18) return 'SELAMAT SORE,';
    return 'SELAMAT MALAM,';
  };

  // Inisial avatar yang elegan (menggunakan zero-width space \u200B agar Chrome tidak auto-translate 'AD' ke 'IKLAN')
  const getInitials = () => {
    if (!user) return 'PT';
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return 'A\u200BD';
    if (user.role === 'PENGAWAS') return 'P\u200BS';
    if (!user.name) return 'PT';
    const parts = user.name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + '\u200B' + parts[1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <View
      style={[
        tw`mx-4 sm:mx-5 mt-3 mb-2 rounded-[26px] overflow-hidden relative z-20 border ${
          title ? 'border-gray-100 bg-white' : 'border-blue-50/80 bg-white'
        }`,
        {
          height: 72,
          shadowColor: '#0055A5',
          shadowOpacity: 0.10,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
        style,
      ]}
    >
      {/* Aksen Coretan Geometris Khas Pertamina */}
      {title ? (
        // Non-Beranda: Garis utuh standar tanpa logo (tetap original)
        <View style={tw`absolute top-[-2px] right-[-2px] opacity-25`} pointerEvents="none">
          <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#ED1C24] rounded-bl-[42px]`, { top: 0, right: 0, width: 96, height: 96 }]} />
          <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#00A651] rounded-bl-[32px]`, { top: 0, right: 0, width: 74, height: 74 }]} />
          <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#0055A5] rounded-bl-[22px]`, { top: 0, right: 0, width: 52, height: 52 }]} />
        </View>
      ) : (
        // Khusus Beranda: Garis terputus rapi sebelum logo dan menyambung kembali di bawah logo
        <>
          {/* Segmen Atas: Masuk dari sudut kanan atas, berhenti tepat di atas logo */}
          <View
            style={[
              tw`absolute right-[-2px] opacity-25`,
              { top: -2, height: 21, width: 110, overflow: 'hidden' },
            ]}
            pointerEvents="none"
          >
            <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#ED1C24] rounded-bl-[42px]`, { top: 0, right: 0, width: 96, height: 96 }]} />
            <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#00A651] rounded-bl-[32px]`, { top: 0, right: 0, width: 74, height: 74 }]} />
            <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#0055A5] rounded-bl-[22px]`, { top: 0, right: 0, width: 52, height: 52 }]} />
          </View>

          {/* Segmen Bawah: Menyambung lengkungan geometris tepat di bawah logo */}
          <View
            style={[
              tw`absolute right-[-2px] opacity-25`,
              { top: 52, height: 22, width: 110, overflow: 'hidden' },
            ]}
            pointerEvents="none"
          >
            <View style={{ position: 'absolute', top: -54, right: 0 }}>
              <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#ED1C24] rounded-bl-[42px]`, { top: 0, right: 0, width: 96, height: 96 }]} />
              <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#00A651] rounded-bl-[32px]`, { top: 0, right: 0, width: 74, height: 74 }]} />
              <View style={[tw`absolute border-b-[3.5px] border-l-[3.5px] border-[#0055A5] rounded-bl-[22px]`, { top: 0, right: 0, width: 52, height: 52 }]} />
            </View>
          </View>
        </>
      )}

      {/* Aksen Coretan Geometris Khas Pertamina - Bawah Kiri (Terputus rapi agar tidak menimpa teks salam/judul) */}
      <>
        {/* Segmen Atas Kiri: Masuk dari sudut kiri atas, berhenti tepat sebelum teks */}
        <View
          style={[
            tw`absolute left-[-2px] opacity-25`,
            { top: -2, height: 21, width: 110, overflow: 'hidden' },
          ]}
          pointerEvents="none"
        >
          <View style={{ position: 'absolute', bottom: -55, left: 0 }}>
            <View style={[tw`absolute border-t-[3.5px] border-r-[3.5px] border-[#ED1C24] rounded-tr-[42px]`, { bottom: 0, left: 0, width: 96, height: 96 }]} />
            <View style={[tw`absolute border-t-[3.5px] border-r-[3.5px] border-[#00A651] rounded-tr-[32px]`, { bottom: 0, left: 0, width: 74, height: 74 }]} />
            <View style={[tw`absolute border-t-[3.5px] border-r-[3.5px] border-[#0055A5] rounded-tr-[22px]`, { bottom: 0, left: 0, width: 52, height: 52 }]} />
          </View>
        </View>

        {/* Segmen Bawah Kiri: Lengkungan keluar dari bawah teks menuju sudut kiri bawah */}
        <View
          style={[
            tw`absolute left-[-2px] opacity-25`,
            { bottom: -2, height: 22, width: 110, overflow: 'hidden' },
          ]}
          pointerEvents="none"
        >
          <View style={{ position: 'absolute', bottom: 0, left: 0 }}>
            <View style={[tw`absolute border-t-[3.5px] border-r-[3.5px] border-[#ED1C24] rounded-tr-[42px]`, { bottom: 0, left: 0, width: 96, height: 96 }]} />
            <View style={[tw`absolute border-t-[3.5px] border-r-[3.5px] border-[#00A651] rounded-tr-[32px]`, { bottom: 0, left: 0, width: 74, height: 74 }]} />
            <View style={[tw`absolute border-t-[3.5px] border-r-[3.5px] border-[#0055A5] rounded-tr-[22px]`, { bottom: 0, left: 0, width: 52, height: 52 }]} />
          </View>
        </View>
      </>
      {/* Content Overlay */}
      <View style={tw`flex-1 flex-row items-center justify-between px-3.5 sm:px-5 relative z-10`}>
        {/* SISI KIRI: Profil User atau Judul Halaman */}
        {title ? (
          <View style={tw`flex-row items-center flex-1 pr-2 sm:pr-4 min-w-0`}>
            {(showBack || (navigation && navigation.canGoBack && navigation.canGoBack())) && (
              <TouchableOpacity
                onPress={() => {
                  if (onBack) {
                    onBack();
                  } else if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                    navigation.goBack();
                  } else if (navigation && typeof navigation.replace === 'function') {
                    navigation.replace(user?.role === 'PENGAWAS' ? 'PengawasDashboard' : user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? 'AdminDashboard' : 'UserDashboard');
                  }
                }}
                style={tw`w-[44px] h-[44px] bg-gray-50 rounded-full items-center justify-center mr-3.5 shadow-sm border border-gray-200/90 active:scale-95`}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={22} color="#1A2E44" />
              </TouchableOpacity>
            )}
            <View style={tw`flex-1 min-w-0 justify-center`}>
              <Text style={tw`text-[19px] sm:text-xl font-black text-[#1A2E44] tracking-tight leading-tight`} numberOfLines={1} className="notranslate" translate="no">
                {title}
              </Text>
              {subtitle ? (
                <Text style={tw`text-[12px] sm:text-xs font-bold text-[#4B637B] mt-0.5 tracking-normal`} numberOfLines={1} className="notranslate" translate="no">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={tw`flex-row items-center flex-1 pr-2 sm:pr-3 min-w-0`}>
            {/* Avatar Pill dengan Rainbow Ring Border (Warna khas Pertamina: Merah, Hijau, Biru) */}
            <View style={tw`w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] mr-2.5 sm:mr-3 justify-center items-center relative shadow-sm shrink-0`}>
              <Animated.View
                style={[
                  tw`absolute w-full h-full rounded-full overflow-hidden`,
                  { transform: [{ rotate: spinInterpolate }] },
                ]}
              >
                <LinearGradient
                  colors={['#ED1C24', '#00A651', '#0055A5', '#F58220', '#ED1C24']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={tw`flex-1 w-full h-full`}
                />
              </Animated.View>
              <View style={tw`w-[36px] h-[36px] sm:w-[40px] sm:h-[40px] rounded-full bg-white items-center justify-center border border-gray-100`}>
                <Text style={tw`text-[#1A2E44] font-black text-[13px] sm:text-[15px] tracking-widest`} className="notranslate" translate="no">
                  {getInitials()}
                </Text>
              </View>
            </View>

            {/* Greeting & User Name */}
            <View style={tw`justify-center flex-1 min-w-0 mr-2`}>
              <Text style={tw`text-[#4B637B] text-[9.5px] sm:text-[11px] font-black uppercase tracking-[1.2px] sm:tracking-[1.4px] mb-0.5`} numberOfLines={1}>
                {getGreeting()}
              </Text>
              <Text
                style={tw`text-[#1A2E44] text-[15px] sm:text-[18px] font-black tracking-tight leading-tight`}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {user?.name || 'User'}
              </Text>
            </View>
          </View>
        )}

        {/* SISI KANAN: Custom Action Buttons dan Logo Handover */}
        <View style={tw`flex-row items-center gap-2 sm:gap-3 z-20 shrink-0`}>
          {rightAction && (
            <View style={tw`flex-row items-center`}>
              {rightAction}
            </View>
          )}

          {!title && (
            <View style={tw`items-end justify-center py-1`}>
              <Image
                source={require('../assets/exact_digihandover_logo.png')}
                style={[
                  tw`w-[96px] sm:w-[124px]`,
                  {
                    height: Platform.OS === 'web' ? 20 : 17,
                    resizeMode: 'contain',
                  },
                ]}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
