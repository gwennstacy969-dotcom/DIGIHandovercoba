import React, { useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated, Image } from 'react-native';
import tw from 'twrnc';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';

export default function WebSidebar({ user, activeMenu, navigation, handleLogout, unreadNotificationsCount = 0 }) {
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isManagement = isSuperAdmin || isAdmin;
  const isPengawas = user?.role === 'PENGAWAS';

  const [internalUnreadCount, setInternalUnreadCount] = useState(unreadNotificationsCount || 0);

  useEffect(() => {
    setInternalUnreadCount(unreadNotificationsCount);
  }, [unreadNotificationsCount]);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted && res.data && res.data.notifications) {
           setInternalUnreadCount(res.data.notifications.filter(n => !n.isRead).length);
        }
      } catch (error) {
         console.log('Sidebar notification error:', error.message);
      }
    };
    
    if (user) {
      fetchUnread();
    }
    
    let unsubscribe;
    if (navigation && navigation.addListener) {
       unsubscribe = navigation.addListener('focus', () => {
         if (user) fetchUnread();
       });
    }

    return () => {
       isMounted = false;
       if (unsubscribe) unsubscribe();
    };
  }, [user, navigation]);

  // Baca posisi scroll terakhir dari sessionStorage agar sidebar tidak loncat ke atas
  const getSavedScrollY = () => {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      try {
        const val = sessionStorage.getItem('sidebarScrollY');
        if (val) return parseFloat(val) || 0;
      } catch (_) {}
    }
    return 0;
  };

  const initialScrollY = useRef(getSavedScrollY()).current;
  const currentScrollY = useRef(initialScrollY);
  const scrollY = useRef(new Animated.Value(initialScrollY)).current;
  const scrollViewRef = useRef(null);
  const isRestored = useRef(initialScrollY <= 0);

  // Inisialisasi dimensi realistis agar indikator scrollbar tidak berkedip
  const [contentHeight, setContentHeight] = useState(700);
  const [visibleHeight, setVisibleHeight] = useState(550);
  const [trackHeight, setTrackHeight] = useState(350);

  // Tinggi kapsul 3-warna yang ideal dan proporsional pada zoom standar 100%
  const thumbHeight = Math.max(40, Math.min(60, Math.round((visibleHeight / Math.max(1, contentHeight)) * trackHeight)));
  const maxScroll = Math.max(1, contentHeight - visibleHeight);
  const maxThumbTravel = Math.max(0, trackHeight - thumbHeight);

  // Restore posisi scroll secara instan sebelum browser paint (useLayoutEffect)
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || initialScrollY <= 0) return;
    const restore = () => {
      try {
        const inner = scrollViewRef.current?.getNode ? scrollViewRef.current.getNode() : scrollViewRef.current;
        const domNode = inner?.getScrollableNode ? inner.getScrollableNode() : null;
        if (domNode && domNode.scrollTop !== initialScrollY) {
          domNode.scrollTop = initialScrollY;
        }
        if (inner?.scrollTo) {
          inner.scrollTo({ y: initialScrollY, animated: false });
        }
      } catch (_) {}
    };

    restore();
    const raf1 = requestAnimationFrame(() => {
      restore();
      isRestored.current = true;
    });
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(restore));
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [initialScrollY]);

  // Helper navigasi: simpan posisi scroll saat ini lalu pindah halaman
  const navigateTo = useCallback((routeName) => {
    if (Platform.OS === 'web') {
      try {
        const inner = scrollViewRef.current?.getNode ? scrollViewRef.current.getNode() : scrollViewRef.current;
        const domNode = inner?.getScrollableNode ? inner.getScrollableNode() : null;
        const y = domNode?.scrollTop ?? currentScrollY.current ?? 0;
        sessionStorage.setItem('sidebarScrollY', y.toString());
      } catch (_) {}
    }
    if (navigation && typeof navigation.replace === 'function') {
      navigation.replace(routeName);
    } else if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(routeName);
    }
  }, [navigation]);

  const thumbTranslateY = scrollY.interpolate({
    inputRange: [0, maxScroll],
    outputRange: [0, maxThumbTravel],
    extrapolate: 'clamp',
  });

  const handleTrackClick = (e) => {
    if (Platform.OS !== 'web' || !scrollViewRef.current) return;
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const ratio = Math.max(0, Math.min(1, (clickY - thumbHeight / 2) / Math.max(1, rect.height - thumbHeight)));
      const targetY = ratio * maxScroll;
      if (typeof scrollViewRef.current.scrollTo === 'function') {
        scrollViewRef.current.scrollTo({ y: targetY, animated: true });
      } else if (scrollViewRef.current.getNode && typeof scrollViewRef.current.getNode().scrollTo === 'function') {
        scrollViewRef.current.getNode().scrollTo({ y: targetY, animated: true });
      }
    } catch (err) { }
  };

  // Hanya tampil di web dan saat user terautentikasi (dieksekusi SETELAH seluruh React hooks selesai didaftarkan)
  if (Platform.OS !== 'web' || !user) return null;

  const getRoleLabel = () => {
    if (isSuperAdmin) return 'Super Admin';
    if (isAdmin) return 'Admin';
    if (isPengawas) return 'Pengawas';
    return 'Pekerja';
  };

  // Zero-width space (\u200B) diselipkan agar Google Translate TIDAK menerjemahkan 'AD' menjadi 'IKLAN'
  const getInitials = () => {
    if (isSuperAdmin || isAdmin) return 'A\u200BD';
    if (isPengawas) return 'P\u200BS';
    const parts = (user.name || '').trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + '\u200B' + parts[1][0]).toUpperCase();
    }
    return (user.name || 'U').substring(0, 2).toUpperCase();
  };

  const renderSectionHeader = (title) => (
    <View style={tw`flex-row items-center my-2.5 px-1`}>
      <View style={tw`flex-1 h-[2px] bg-gray-200/90`} />
      <Text style={tw`px-2.5 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider`}>
        {title}
      </Text>
      <View style={tw`flex-1 h-[2px] bg-gray-200/90`} />
    </View>
  );

  const renderMenuItem = ({ label, iconComponent, active, onPress, badge }) => (
    <TouchableOpacity
      style={[
        tw`flex-row items-center justify-between px-3 py-2.5 mb-1.5 rounded-[16px] border`,
        active ? {
          backgroundColor: '#0055A5',
          borderColor: '#00488C',
          shadowColor: '#0055A5',
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        } : {
          backgroundColor: '#FFFFFF',
          borderColor: '#F1F5F9',
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={tw`flex-row items-center flex-1`}>
        {iconComponent}
        <Text
          style={[
            tw`ml-3 text-[13px]`,
            active ? tw`text-white font-extrabold` : tw`text-gray-800 font-bold`
          ]}
          className="notranslate"
          translate="no"
        >
          {label}
        </Text>
      </View>
      {badge}
    </TouchableOpacity>
  );

  return (
    <View style={[
      tw`my-4 ml-4 flex-row items-stretch select-none`,
      {
        height: Platform.OS === 'web' ? 'calc(100vh - 32px)' : undefined,
        maxHeight: Platform.OS === 'web' ? 'calc(100vh - 32px)' : undefined,
      }
    ]}>
      {/* 1. Main Sidebar Card - Ukuran ramping & proporsional (295px) untuk Zoom 100% */}
      <View style={[
        tw`bg-white rounded-[32px] border border-gray-100 flex-col overflow-hidden relative`,
        {
          width: 260,
          shadowColor: '#000',
          shadowOpacity: 0.07,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        }
      ]}>
        {/* Faint Pertamina Brand Ribbons Watermark at bottom */}
        <View style={[tw`absolute bottom-0 left-0 right-0 h-36 overflow-hidden pointer-events-none opacity-20`, { zIndex: 0 }]}>
          <View style={[tw`absolute -bottom-10 -left-10 w-56 h-8 bg-[#0055A5] -rotate-25 rounded-full`]} />
          <View style={[tw`absolute -bottom-4 -left-4 w-56 h-8 bg-[#ED1C24] -rotate-25 rounded-full`]} />
          <View style={[tw`absolute bottom-2 left-2 w-56 h-8 bg-[#52B848] -rotate-25 rounded-full`]} />
        </View>

        {/* Header: Logo Pertamina */}
        <View style={tw`pt-5 pb-2 items-center justify-center flex-row z-10`}>
          <Image
            source={require('../assets/logo.png')}
            style={{ width: 34, height: 34 }}
            resizeMode="contain"
          />
          <Text style={tw`text-[17px] font-black tracking-wider text-gray-900 ml-2.5`}>
            PERTAMINA
          </Text>
        </View>

        {/* Profile Card */}
        <View style={[
          tw`mx-3.5 mt-1 mb-2 bg-white rounded-[22px] p-3.5 items-center border border-gray-100/90 z-10`,
          {
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }
        ]}>
          <View style={tw`w-12 h-12 rounded-full bg-[#1E5EAA] items-center justify-center mb-1.5 shadow-sm`}>
            <Text style={tw`text-base font-black text-white tracking-wide`} className="notranslate" translate="no">
              {getInitials()}
            </Text>
          </View>
          <Text style={tw`text-[15px] font-black text-gray-800 text-center tracking-tight`} numberOfLines={1}>
            {user.name || 'User'}
          </Text>
          <View style={tw`bg-[#EBF3FC] mt-1 px-3 py-0.5 rounded-full`}>
            <Text style={tw`text-[10px] text-[#475569] font-black uppercase tracking-widest`}>
              {getRoleLabel().toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Scrollable Navigation Menu */}
        <Animated.ScrollView
          ref={scrollViewRef}
          contentOffset={{ x: 0, y: initialScrollY }}
          style={[
            tw`flex-1 z-10`,
            Platform.OS === 'web' ? {
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            } : {}
          ]}
          contentContainerStyle={tw`pl-3.5 pr-5.5 pt-1 pb-5`}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            if (!isRestored.current && Math.abs(y - initialScrollY) > 50) {
              // Ignore spurious initial onScroll events (usually 0) before we restore
              return;
            }
            scrollY.setValue(y);
            currentScrollY.current = y;
            if (Platform.OS === 'web') {
              sessionStorage.setItem('sidebarScrollY', y.toString());
            }
          }}
          scrollEventThrottle={16}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onLayout={(e) => setVisibleHeight(e.nativeEvent.layout.height)}
        >
          {/* Section: Menu Utama */}
          {renderSectionHeader('MENU UTAMA')}

          {/* Beranda */}
          {renderMenuItem({
            label: 'Beranda',
            iconComponent: <Feather name="grid" size={20} color={activeMenu === 'Home' ? '#FFFFFF' : '#0055A5'} />,
            active: activeMenu === 'Home',
            onPress: () => {
              if (isSuperAdmin || isAdmin) navigateTo('AdminDashboard');
              else if (isPengawas) navigateTo('PengawasDashboard');
              else navigateTo('UserDashboard');
            }
          })}

          {/* Lihat Seluruh Laporan */}
          {renderMenuItem({
            label: 'Lihat Seluruh Laporan',
            iconComponent: <Feather name="file-text" size={20} color={activeMenu === 'History' ? '#FFFFFF' : '#991B1B'} />,
            active: activeMenu === 'History',
            onPress: () => navigateTo('History')
          })}

          {/* Section: Manajemen */}
          {(isManagement || isPengawas) && (
            <>
              {renderSectionHeader('MANAJEMEN')}

              {/* Manajer Checklist (Khusus Admin / Super Admin) */}
              {isManagement && renderMenuItem({
                label: 'Manajer Checklist',
                iconComponent: <Feather name="check-square" size={20} color={activeMenu === 'Checklist' ? '#FFFFFF' : '#991B1B'} />,
                active: activeMenu === 'Checklist',
                onPress: () => navigateTo('ChecklistManager')
              })}

              {/* Daftar Kendaraan */}
              {renderMenuItem({
                label: 'Daftar Kendaraan',
                iconComponent: <Feather name="truck" size={20} color={activeMenu === 'VehicleList' ? '#FFFFFF' : '#0055A5'} />,
                active: activeMenu === 'VehicleList',
                onPress: () => navigateTo('VehicleList')
              })}

              {/* Isu Ditemukan */}
              {renderMenuItem({
                label: 'Isu Ditemukan',
                iconComponent: <Feather name="alert-triangle" size={20} color={activeMenu === 'IssueList' ? '#FFFFFF' : '#991B1B'} />,
                active: activeMenu === 'IssueList',
                onPress: () => navigateTo('IssueList')
              })}

              {/* Daftar Pekerja */}
              {renderMenuItem({
                label: 'Daftar Pekerja',
                iconComponent: <Feather name="users" size={20} color={activeMenu === 'WorkerList' ? '#FFFFFF' : '#991B1B'} />,
                active: activeMenu === 'WorkerList',
                onPress: () => navigateTo('WorkerList')
              })}

              {/* Daftar Pengawas (Khusus Admin / Super Admin) */}
              {isManagement && renderMenuItem({
                label: 'Daftar Pengawas',
                iconComponent: <Feather name="shield" size={20} color={activeMenu === 'PengawasList' ? '#FFFFFF' : '#0055A5'} />,
                active: activeMenu === 'PengawasList',
                onPress: () => navigateTo('PengawasList')
              })}

              {/* Daftar Admin (Khusus Admin / Super Admin) */}
              {isManagement && renderMenuItem({
                label: 'Daftar Admin',
                iconComponent: <Feather name="user-check" size={20} color={activeMenu === 'AdminList' ? '#FFFFFF' : '#0055A5'} />,
                active: activeMenu === 'AdminList',
                onPress: () => navigateTo('AdminList')
              })}
            </>
          )}

          {/* Section: Komunikasi */}
          {renderSectionHeader('KOMUNIKASI')}

          {/* Pesan & Notifikasi */}
          {renderMenuItem({
            label: 'Pesan & Notifikasi',
            iconComponent: <Ionicons name="chatbubble-ellipses-outline" size={20} color={activeMenu === 'Messages' ? '#FFFFFF' : '#0055A5'} />,
            active: activeMenu === 'Messages',
            onPress: () => navigateTo('MessageCenter'),
            badge: internalUnreadCount > 0 ? (
              <View style={tw`w-5 h-5 rounded-full bg-[#ED1C24] items-center justify-center`}>
                <Text style={tw`text-white text-[11px] font-black`}>
                  {internalUnreadCount > 99 ? '99+' : internalUnreadCount}
                </Text>
              </View>
            ) : null
          })}

          {/* Slogan / Tagline */}
          <Text style={tw`text-[11.5px] font-bold text-gray-400 tracking-wider text-center mt-3.5 mb-2`}>
            Energi untuk Negeri
          </Text>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[
              tw`flex-row items-center px-3.5 py-3 rounded-[18px] bg-white border border-gray-100 mb-1.5`,
              {
                shadowColor: '#000',
                shadowOpacity: 0.04,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
              Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}
            ]}
            onPress={() => {
              if (Platform.OS === 'web') {
                try {
                  sessionStorage.removeItem('sidebarScrollY');
                } catch (_) {}
              }
              if (handleLogout) handleLogout();
            }}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={20} color="#991B1B" />
            <Text style={tw`ml-3.5 font-bold text-[14px] text-[#991B1B]`} className="notranslate" translate="no">
              Sign Out
            </Text>
          </TouchableOpacity>
        </Animated.ScrollView>

        {/* 2. Scrollbar Track 3-Warna Pertamina Proporsional (Zoom 100%) */}
        <View
          style={[
            tw`absolute top-48 bottom-6 rounded-full overflow-hidden flex-col items-center justify-start z-30`,
            {
              right: 5,
              width: 5,
              backgroundColor: 'rgba(241, 245, 249, 0.8)',
              borderColor: 'rgba(226, 232, 240, 0.7)',
              borderWidth: 1,
            },
            Platform.OS === 'web' ? { cursor: 'pointer' } : {}
          ]}
          onLayout={(e) => setTrackHeight(e.nativeEvent.layout.height)}
          onClick={handleTrackClick}
        >
          <Animated.View
            style={[
              tw`rounded-full overflow-hidden flex-col`,
              {
                width: 5,
                height: thumbHeight,
                transform: [{ translateY: thumbTranslateY }],
                shadowColor: '#0055A5',
                shadowOpacity: 0.3,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 3,
              }
            ]}
          >
            <View style={tw`flex-1 bg-[#ED1C24]`} />
            <View style={tw`flex-1 bg-[#0055A5]`} />
            <View style={tw`flex-1 bg-[#52B848]`} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
