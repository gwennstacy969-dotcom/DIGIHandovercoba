import React, { useEffect, useState, useRef } from 'react';
import { API_URL } from '../../config';
import TextLogo from '../../components/TextLogo';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, ScrollView, Animated, Easing, Platform, Alert, Image, Modal, RefreshControl } from 'react-native';
import tw from 'twrnc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import axios from 'axios';
import WebSidebar from '../../components/WebSidebar';
import NotificationSheet from '../../components/NotificationSheet';
import WebNavbar from '../../components/WebNavbar';
import { handleLogoutAndReset } from '../../utils/authHelper';

const PERTAMINA_BLUE = ['#003366', '#0055A5'];
const PERTAMINA_RED = ['#ED1C24', '#B30000'];
const PERTAMINA_GREEN = ['#00A651', '#007A3E'];
const GLASS_BG = 'rgba(255, 255, 255, 0.7)';

// Helper untuk efek Glassmorphism di Web
const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useDashboardBackHandler } from '../../hooks/useDashboardBackHandler';

export default function AdminDashboardScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN', 'ADMIN']);
  const [user, setUser] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [activeIssuesCount, setActiveIssuesCount] = useState(0);
  const [allHandovers, setAllHandovers] = useState([]);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState('Home');
  const [previousMenu, setPreviousMenu] = useState('Home');
  const [displayedAlertsCount, setDisplayedAlertsCount] = useState(4);
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAlerts(),
      fetchNotifications()
    ]);
    setRefreshing(false);
  }, []);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  // Animasi Background Orbs
  const floatAnim1 = React.useRef(new Animated.Value(0)).current;
  const floatAnim2 = React.useRef(new Animated.Value(0)).current;
  const floatAnim3 = React.useRef(new Animated.Value(0)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim1, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, { toValue: 1, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim2, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim3, { toValue: 1, duration: 12000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim3, { toValue: 0, duration: 12000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 1500, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();
  }, []);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  const isLargeScreen = screenWidth > 768;
  const lastFetchTimeRef = useRef(0);

  const loadData = async (isFocus = false) => {
    const now = Date.now();
    if (isFocus && now - lastFetchTimeRef.current < 2000) return;
    lastFetchTimeRef.current = now;

    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);
        if (userData.role === 'SUPER_ADMIN' || userData.role === 'PENGAWAS' || userData.role === 'ADMIN') {
          fetchAlerts();
          fetchNotifications();
        }
      } else {
        setUser(null);
        await handleLogoutAndReset(navigation);
        return;
      }
    } catch (e) {
      console.log('Error loading user data:', e.message);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(true);
    });
    return unsubscribe;
  }, [navigation]);

  const fetchAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const vehicleRes = await axios.get(`${API_URL}/api/vehicles`, { headers });
      const activeVehicles = vehicleRes.data;
      setVehiclesCount(activeVehicles.length);
      const activePolisi = activeVehicles.map(v => v.noPolisi);

      const res = await axios.get(`${API_URL}/api/handovers`, { headers });
      const dataHandovers = res.data.data || res.data;
      setAllHandovers(dataHandovers);
      
      const issueRes = await axios.get(`${API_URL}/api/issues/ongoing`, { headers });
      const activeIssues = issueRes.data.filter(issue => activePolisi.includes(issue.handover.noPolisi));
      
      setActiveIssuesCount(activeIssues.length);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Hanya ambil handover hari ini, tampilkan semua (Baik & Buruk)
      const todaysHandovers = dataHandovers.filter(h => new Date(h.timestamp) >= today);
      
      setAlerts(todaysHandovers);
    } catch (error) {
      console.log("Gagal mengambil data alert:", error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        await handleLogoutAndReset(navigation);
      }
    } finally {
      setLoadingAlerts(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadNotificationsCount(res.data.notifications.filter(n => !n.isRead).length);
      }
    } catch (error) {
      console.log("Gagal mengambil notifikasi:", error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        await handleLogoutAndReset(navigation);
      }
    }
  };

  const handleReadNotification = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (error) {
      console.log("Gagal update notifikasi:", error.message);
    }
  };

  const handleLogout = () => {
    setPreviousMenu(activeMenu);
    setActiveMenu('Logout');
    setIsLogoutVisible(true);
  };

  const handleCancelLogout = () => {
    setIsLogoutVisible(false);
    setActiveMenu(previousMenu);
  };

  const confirmLogout = async () => {
    setIsLogoutVisible(false);
    await handleLogoutAndReset(navigation);
  };

  useDashboardBackHandler({
    isLogoutVisible,
    setIsLogoutVisible,
    handleLogout,
    handleCancelLogout,
    showNotificationsModal,
    setShowNotificationsModal,
  });

  if (!user) {
    return (
      <View style={tw`flex-1 bg-[#F4F7FA] justify-center items-center`}>
        <ActivityIndicator size="large" color="#0055A5" />
      </View>
    );
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAdmin = user.role === 'ADMIN';
  const isPengawas = user.role === 'PENGAWAS';
  const isAMT = user.role === 'AMT' || user.role === 'USER';

  const canSeeOverview = isSuperAdmin || isAdmin || isPengawas;
  const canSeeActions = isSuperAdmin || isAdmin || isAMT;

  const getRoleLabel = () => {
    if (isSuperAdmin) return 'Super Admin';
    if (isAdmin) return 'Admin';
    if (isPengawas) return 'Pengawas';
    return 'Awak Mobil Tangki';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi,';
    if (hour < 15) return 'Selamat Siang,';
    if (hour < 18) return 'Selamat Sore,';
    return 'Selamat Malam,';
  };

  const getInitials = () => {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return 'A\u200BD';
    if (user.role === 'PENGAWAS') return 'P\u200BS';
    const parts = user.name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + '\u200B' + parts[1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  const orb1TranslateY = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const orb2TranslateY = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const orb3TranslateY = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const spinInterpolate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });

  const renderAlertItem = ({ item }) => {
    const isBad = item.status !== 'Siap Operasi (Normal)' && item.issue?.status !== 'RESOLVED';
    const badItems = item.items ? item.items.filter(i => !i.isGood) : [];
    const issueCount = badItems.length;
    const firstIssue = badItems[0]?.name || 'Kendala operasional';
    const remainingCount = issueCount - 1;
    
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('HandoverDetail', { handover: item, handoverId: item.id })}
        style={[
          tw`p-4 rounded-3xl border border-white/70 justify-between ${Platform.OS === 'web' && isLargeScreen ? '' : 'mb-4'}`,
          {
            backgroundColor: 'rgba(255,255,255,0.85)',
            ...glassStyle,
            shadowColor: isBad ? '#ED1C24' : '#00A651',
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            minHeight: 148,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {})
          }
        ]}
      >
        {/* Top Header Row */}
        <View style={tw`flex-row items-center`}>
          <View style={[
            tw`w-12 h-12 rounded-2xl items-center justify-center mr-3.5 border`,
            isBad ? tw`bg-red-100/90 border-red-200/80` : tw`bg-emerald-100/90 border-emerald-200/80`
          ]}>
            <Feather name={isBad ? "alert-triangle" : "check-circle"} size={24} color={isBad ? "#ED1C24" : "#059669"} />
          </View>
          <View style={tw`flex-1`}>
            <View style={tw`flex-row justify-between items-center mb-0.5`}>
              <Text style={tw`text-lg font-black text-gray-800 tracking-wide`}>{item.noPolisi}</Text>
              <View style={[
                tw`px-3 py-1 rounded-full`,
                isBad ? tw`bg-red-500` : tw`bg-emerald-500`
              ]}>
                <Text style={tw`text-[10px] text-white font-extrabold uppercase tracking-widest`}>
                  {isBad ? 'Kritis' : 'Aman'}
                </Text>
              </View>
            </View>
            <Text style={tw`text-xs text-gray-500 font-semibold uppercase tracking-wider`} numberOfLines={1}>
              {item.shift} • {item.user?.name || 'Driver'}
            </Text>
          </View>
        </View>

        {/* Bottom Status Summary Bar (Fixed neat height, identical structure for both) */}
        <View style={[
          tw`mt-3 px-3.5 py-2.5 rounded-2xl flex-row items-center justify-between border`,
          isBad ? tw`bg-red-50/80 border-red-200/60` : tw`bg-emerald-50/80 border-emerald-200/60`
        ]}>
          <View style={tw`flex-1 mr-2`}>
            <Text style={[
              tw`text-xs font-black tracking-tight`,
              isBad ? tw`text-red-700` : tw`text-emerald-700`
            ]}>
              {isBad ? `⚠️ ${issueCount > 0 ? `${issueCount} Kendala Ditemukan` : 'Status Unit Kritis'}` : '✓ Siap Operasi (Normal)'}
            </Text>
            <Text style={[
              tw`text-[11px] font-medium mt-0.5`,
              isBad ? tw`text-red-600` : tw`text-emerald-600`
            ]} numberOfLines={1}>
              {isBad 
                ? `• ${firstIssue}${remainingCount > 0 ? ` (+${remainingCount} lainnya)` : ''}`
                : '• Seluruh item checklist lengkap & sesuai standar'
              }
            </Text>
          </View>
          <View style={[
            tw`flex-row items-center bg-white/90 px-2.5 py-1.5 rounded-xl border shadow-sm`,
            isBad ? tw`border-red-200/80` : tw`border-emerald-200/80`
          ]}>
            <Text style={[
              tw`text-[10px] font-bold mr-0.5`,
              isBad ? tw`text-red-600` : tw`text-emerald-600`
            ]}>Detail</Text>
            <Feather name="chevron-right" size={12} color={isBad ? "#ED1C24" : "#059669"} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-[#F4F7FA]`}>
      {/* Animated Background Orbs for Premium Vibe */}
      <Animated.View style={[tw`absolute -top-20 -left-10 w-[35rem] h-[35rem] rounded-full opacity-15`, { transform: [{ translateY: orb1TranslateY }] }]}>
        <LinearGradient colors={['#0055A5', '#003366']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -top-20 -right-20 w-[25rem] h-[25rem] rounded-full opacity-15`, { transform: [{ translateY: orb3TranslateY }] }]}>
        <LinearGradient colors={['#00A651', '#007A3B']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -bottom-40 -right-10 w-[30rem] h-[30rem] rounded-full opacity-15`, { transform: [{ translateY: orb2TranslateY }] }]}>
        <LinearGradient colors={['#ED1C24', '#B30000']} style={tw`flex-1 rounded-full`} />
      </Animated.View>

      <SafeAreaView style={tw`flex-1 ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>

        {/* Modal Notifikasi */}
        <NotificationSheet
          visible={showNotificationsModal}
          notifications={notifications}
          onClose={() => setShowNotificationsModal(false)}
          onRead={handleReadNotification}
        />

        {/* ULTRA PREMIUM SIDEBAR */}
        {isLargeScreen && user && (
          <WebSidebar 
            user={user} 
            activeMenu={activeMenu} 
            navigation={navigation} 
            handleLogout={handleLogout} 
            unreadNotificationsCount={unreadNotificationsCount} 
          />
        )}
        
        {/* MAIN CONTENT AREA */}
        <View style={tw`flex-1 relative`}>

          {/* STICKY NAVBAR (Floating Modern Style - Sama persis Mobile & Web) */}
          {user && (
            <WebNavbar user={user} navigation={navigation} />
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`${isLargeScreen ? 'p-6 max-w-7xl mx-auto w-full' : 'p-6 pt-6 pb-32 w-full'}`}>

            {/* Title Section */}
            <View style={tw`mb-6`}>
              <Text style={tw`text-[11px] font-black text-[#0055A5] uppercase tracking-widest mb-1`}>SISTEM TERINTEGRASI PERTAMINA</Text>
              <Text style={tw`text-3xl font-black text-gray-800 tracking-tighter`}>
                Overview <Text style={tw`text-[#ED1C24]`}>Hari Ini.</Text>
              </Text>
            </View>

            {/* SUPER CARDS */}
            {canSeeOverview && (
              <>
                <View style={tw`flex-row justify-between mb-4`}>
                  <TouchableOpacity
                    style={[tw`flex-1 p-5 rounded-[28px] border border-white/60 mr-3 justify-between`, { backgroundColor: 'rgba(255,255,255,0.8)', ...glassStyle, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20 }]}
                    onPress={() => navigation.navigate('VehicleList')}
                  >
                    <View style={tw`w-12 h-12 bg-blue-100 rounded-full items-center justify-center mb-5`}>
                      <Feather name="truck" size={22} color="#0055A5" />
                    </View>
                    <View>
                      <Text style={tw`text-4xl font-black text-gray-800 tracking-tighter`}>{vehiclesCount}</Text>
                      <Text style={tw`text-[11px] text-gray-500 font-black uppercase tracking-widest mt-1.5`}>Total Kendaraan</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[tw`flex-1 p-5 rounded-[28px] border border-white/60 ml-3 justify-between`, { backgroundColor: 'rgba(255,255,255,0.8)', ...glassStyle, shadowColor: '#ED1C24', shadowOpacity: 0.1, shadowRadius: 20 }]}
                    onPress={() => navigation.navigate('IssueList')}
                  >
                    <View style={tw`w-12 h-12 bg-red-100 rounded-full items-center justify-center mb-5`}>
                      <Feather name="alert-circle" size={22} color="#ED1C24" />
                    </View>
                    <View>
                      <Text style={tw`text-4xl font-black text-[#ED1C24] tracking-tighter`}>{activeIssuesCount}</Text>
                      <Text style={tw`text-[11px] text-red-400 font-black uppercase tracking-widest mt-1.5`}>Isu Ditemukan</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[tw`w-full p-4 sm:p-5 rounded-[28px] border border-white/60 mb-4 flex-row items-center justify-between`, { backgroundColor: 'rgba(255,255,255,0.8)', ...glassStyle, shadowColor: '#00A651', shadowOpacity: 0.1, shadowRadius: 20 }]}
                  onPress={() => navigation.navigate('WorkerList')}
                >
                  <View style={tw`flex-row items-center flex-1 min-w-0 mr-3`}>
                    <View style={tw`w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-3.5 shrink-0`}>
                      <Feather name="users" size={22} color="#00A651" />
                    </View>
                    <View style={tw`flex-1 min-w-0 justify-center py-0.5`}>
                      <Text style={tw`text-lg sm:text-xl font-black text-gray-800 tracking-tight leading-tight`} numberOfLines={1}>Daftar Pekerja</Text>
                      <Text style={tw`text-[10px] sm:text-[11px] text-green-600 font-black uppercase tracking-wider mt-1 leading-normal`} numberOfLines={1}>Manajemen Akun</Text>
                    </View>
                  </View>
                  <View style={tw`w-9 h-9 bg-green-50 rounded-full items-center justify-center shrink-0`}>
                    <Feather name="chevron-right" size={20} color="#00A651" />
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* Daftar Pengawas Full Width Card */}
            <TouchableOpacity
              style={[tw`w-full p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] border border-white/60 mb-4 flex-row items-center justify-between`, { backgroundColor: 'rgba(255,255,255,0.8)', ...glassStyle, shadowColor: '#F59E0B', shadowOpacity: 0.1, shadowRadius: 20 }]}
              onPress={() => navigation.navigate('PengawasList')}
            >
              <View style={tw`flex-row items-center flex-1 min-w-0 mr-3`}>
                <View style={tw`w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-full items-center justify-center mr-3.5 sm:mr-4 shrink-0`}>
                  <Feather name="shield" size={24} color="#F59E0B" />
                </View>
                <View style={tw`flex-1 min-w-0 justify-center py-0.5`}>
                  <Text style={tw`text-lg sm:text-2xl font-black text-gray-800 tracking-tight leading-tight`} numberOfLines={1}>Daftar Pengawas</Text>
                  <Text style={tw`text-[10px] sm:text-xs text-orange-600 font-black uppercase tracking-wider mt-1 leading-normal`} numberOfLines={1}>Manajemen Akun</Text>
                </View>
              </View>
              <View style={tw`w-9 h-9 sm:w-10 sm:h-10 bg-orange-50 rounded-full items-center justify-center shrink-0`}>
                <Feather name="chevron-right" size={20} color="#F59E0B" />
              </View>
            </TouchableOpacity>

            {/* Daftar Admin Full Width Card */}
            {(isSuperAdmin || isAdmin) && (
              <TouchableOpacity
                style={[tw`w-full p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] border border-white/60 mb-4 flex-row items-center justify-between`, { backgroundColor: 'rgba(255,255,255,0.8)', ...glassStyle, shadowColor: '#0055A5', shadowOpacity: 0.1, shadowRadius: 20 }]}
                onPress={() => navigation.navigate('AdminList')}
              >
                <View style={tw`flex-row items-center flex-1 min-w-0 mr-3`}>
                  <View style={tw`w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-full items-center justify-center mr-3.5 sm:mr-4 shrink-0`}>
                    <Feather name="user-check" size={24} color="#0055A5" />
                  </View>
                  <View style={tw`flex-1 min-w-0 justify-center py-0.5`}>
                    <Text style={tw`text-lg sm:text-2xl font-black text-gray-800 tracking-tight leading-tight`} numberOfLines={1}>Daftar Admin</Text>
                    <Text style={tw`text-[10px] sm:text-xs text-blue-600 font-black uppercase tracking-wider mt-1 leading-normal`} numberOfLines={1}>Manajemen Akses Sistem</Text>
                  </View>
                </View>
                <View style={tw`w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-full items-center justify-center shrink-0`}>
                  <Feather name="chevron-right" size={20} color="#0055A5" />
                </View>
              </TouchableOpacity>
            )}

            {/* Manajer Checklist Full Width Card */}
            {(isSuperAdmin || isAdmin) && (
              <TouchableOpacity
                style={[tw`w-full p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] border border-white/60 mb-10 flex-row items-center justify-between`, { backgroundColor: 'rgba(255,255,255,0.8)', ...glassStyle, shadowColor: '#00A651', shadowOpacity: 0.1, shadowRadius: 20 }]}
                onPress={() => navigation.navigate('ChecklistManager')}
              >
                <View style={tw`flex-row items-center flex-1 min-w-0 mr-3`}>
                  <View style={tw`w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-full items-center justify-center mr-3.5 sm:mr-4 shrink-0`}>
                    <Feather name="check-square" size={24} color="#00A651" />
                  </View>
                  <View style={tw`flex-1 min-w-0 justify-center py-0.5`}>
                    <Text style={tw`text-lg sm:text-2xl font-black text-gray-800 tracking-tight leading-tight`} numberOfLines={1}>Manajer Checklist</Text>
                    <Text style={tw`text-[10px] sm:text-xs text-green-600 font-black uppercase tracking-wider mt-1 leading-normal`} numberOfLines={1} ellipsizeMode="tail">Konfigurasi Pertanyaan Inspeksi</Text>
                  </View>
                </View>
                <View style={tw`w-9 h-9 sm:w-10 sm:h-10 bg-green-50 rounded-full items-center justify-center shrink-0`}>
                  <Feather name="chevron-right" size={20} color="#00A651" />
                </View>
              </TouchableOpacity>
            )}



            {/* Action Card */}
            {canSeeActions && (
              <View style={tw`flex-row justify-between mb-10`}>
                <TouchableOpacity style={tw`flex-1 mr-3`} onPress={() => navigation.navigate('Scanner', { type: 'mulai' })}>
                  <LinearGradient colors={PERTAMINA_GREEN} style={tw`p-5 rounded-[40px] shadow-xl shadow-green-900/20 relative overflow-hidden h-56 justify-between`}>
                    <View style={tw`absolute -right-12 -bottom-12 opacity-10`}>
                      <Ionicons name="qr-code" size={180} color="white" />
                    </View>
                    <View style={tw`w-14 h-14 bg-white/20 rounded-2xl items-center justify-center border border-white/30 shadow-sm`}>
                      <Feather name="log-in" size={24} color="white" />
                    </View>
                    <View style={tw`mt-6`}>
                      <Text style={tw`text-green-200 font-bold text-[10px] uppercase tracking-widest mb-1`}>SCAN QR</Text>
                      <Text style={tw`text-white font-bold text-2xl tracking-tight leading-7`}>Mulai{"\n"}Pekerjaan</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={tw`flex-1 ml-3`} onPress={() => navigation.navigate('Scanner', { type: 'akhiri' })}>
                  <LinearGradient colors={['#dc2626', '#7f1d1d']} style={tw`p-5 rounded-[40px] shadow-xl shadow-red-900/20 relative overflow-hidden h-56 justify-between`}>
                    <View style={tw`absolute -right-12 -bottom-12 opacity-10`}>
                      <Ionicons name="qr-code" size={180} color="white" />
                    </View>
                    <View style={tw`w-14 h-14 bg-white/20 rounded-2xl items-center justify-center border border-white/30 shadow-sm`}>
                      <Feather name="log-out" size={24} color="white" />
                    </View>
                    <View style={tw`mt-6`}>
                      <Text style={tw`text-red-200 font-bold text-[10px] uppercase tracking-widest mb-1`}>SCAN QR</Text>
                      <Text style={tw`text-white font-bold text-2xl tracking-tight leading-7`}>Akhiri{"\n"}Pekerjaan</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {canSeeOverview && (
              <TouchableOpacity style={tw`w-full mb-10`} onPress={() => navigation.navigate('History')}>
                <LinearGradient colors={PERTAMINA_BLUE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tw`p-8 rounded-[40px] shadow-2xl shadow-blue-500/40 relative overflow-hidden`}>
                  <View style={tw`absolute -right-10 -top-10 opacity-20`}>
                    <Ionicons name="documents" size={200} color="white" />
                  </View>
                  <View style={tw`w-16 h-16 bg-white/20 rounded-2xl items-center justify-center mb-8`}>
                    <Feather name="database" size={32} color="white" />
                  </View>
                  <Text style={tw`text-blue-200 font-bold text-sm uppercase tracking-widest mb-2`}>Arsip Database</Text>
                  <Text style={tw`text-white font-black text-3xl tracking-tight`}>Lihat Seluruh Laporan</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Live Feed / Alerts */}
            {canSeeOverview && (
              <View>
                <View style={tw`flex-row justify-between items-center mb-6`}>
                  <Text style={tw`text-2xl font-black text-gray-800 tracking-tight`}>Live Record Handover</Text>
                  <View style={tw`bg-blue-100 px-4 py-1.5 rounded-full`}>
                    <Text style={tw`text-blue-600 text-xs font-black uppercase tracking-widest`}>Hari Ini</Text>
                  </View>
                </View>

                {loadingAlerts ? (
                  <ActivityIndicator size="large" color="#ED1C24" style={tw`my-10`} />
                ) : alerts.length > 0 ? (
                  <View>
                    <View
                      style={[
                        tw`w-full`,
                        Platform.OS === 'web' && isLargeScreen ? {
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 16,
                          width: '100%'
                        } : (isLargeScreen ? tw`flex-row flex-wrap justify-between` : tw`flex-col`)
                      ]}
                    >
                      {alerts.slice(0, displayedAlertsCount).map(item => (
                        <View
                          key={item.id}
                          style={[
                            Platform.OS === 'web' && isLargeScreen
                              ? { width: '100%' }
                              : (isLargeScreen ? tw`w-[48.5%]` : tw`w-full`)
                          ]}
                        >
                          {renderAlertItem({ item })}
                        </View>
                      ))}
                    </View>
                    {alerts.length > displayedAlertsCount && (
                      <TouchableOpacity 
                        style={tw`mt-4 bg-white/60 border border-gray-200 py-3 rounded-2xl items-center justify-center`} 
                        onPress={() => setDisplayedAlertsCount(prev => prev + 4)}
                      >
                        <Text style={tw`text-blue-600 font-bold text-sm tracking-wide`}>Tampilkan Lebih Banyak</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={[tw`items-center justify-center py-16 px-6 rounded-[35px] border border-white/60`, { backgroundColor: 'rgba(255,255,255,0.6)', ...glassStyle }]}>
                    <View style={tw`w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-6`}>
                      <Feather name="inbox" size={48} color="#9CA3AF" />
                    </View>
                    <Text style={tw`text-gray-800 font-black text-2xl tracking-tight`}>Belum Ada Laporan</Text>
                    <Text style={tw`text-gray-500 text-center text-sm mt-3 font-semibold px-4`}>Belum ada pekerja yang mengirimkan form handover hari ini.</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>

        {/* ULTRA PREMIUM BOTTOM NAVIGATION (MOBILE ONLY) */}
        {!isLargeScreen && (
          <View style={tw`absolute bottom-8 self-center w-11/12 bg-white rounded-full flex-row justify-around items-center py-5 shadow-2xl shadow-gray-400/50 z-50`}>

            <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('AdminDashboard')}>
              {activeMenu === 'Home' && !isLogoutVisible && (
                <>
                  <View style={tw`absolute -top-5 w-8 h-1 overflow-hidden rounded-full`}>
                    <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                      <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                    </Animated.View>
                  </View>
                  <View style={tw`absolute -bottom-5 w-8 h-1 overflow-hidden rounded-full`}>
                    <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                      <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                    </Animated.View>
                  </View>
                </>
              )}
              <Feather name="grid" size={26} color={activeMenu === 'Home' && !isLogoutVisible ? '#1F2937' : '#9CA3AF'} />
            </TouchableOpacity>

            {(isSuperAdmin || isAdmin) && (
              <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('ChecklistManager')}>
                {activeMenu === 'Checklist' && !isLogoutVisible && (
                  <>
                    <View style={tw`absolute -top-5 w-8 h-1 overflow-hidden rounded-full`}>
                      <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                        <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                      </Animated.View>
                    </View>
                    <View style={tw`absolute -bottom-5 w-8 h-1 overflow-hidden rounded-full`}>
                      <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                        <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                      </Animated.View>
                    </View>
                  </>
                )}
                <Feather name="check-square" size={26} color={activeMenu === 'Checklist' && !isLogoutVisible ? '#1F2937' : '#9CA3AF'} />
              </TouchableOpacity>
            )}

            {isAMT && (
              <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('History')}>
                {activeMenu === 'History' && !isLogoutVisible && (
                  <>
                    <View style={tw`absolute -top-5 w-8 h-1 overflow-hidden rounded-full`}>
                      <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                        <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                      </Animated.View>
                    </View>
                    <View style={tw`absolute -bottom-5 w-8 h-1 overflow-hidden rounded-full`}>
                      <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                        <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                      </Animated.View>
                    </View>
                  </>
                )}
                <Feather name="file-text" size={26} color={activeMenu === 'History' && !isLogoutVisible ? '#1F2937' : '#9CA3AF'} />
              </TouchableOpacity>
            )}


            {(isSuperAdmin || isPengawas || user?.role === 'ADMIN') && (
              <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('MessageCenter')}>
                {activeMenu === 'Messages' && !isLogoutVisible && (
                  <>
                    <View style={tw`absolute -top-5 w-8 h-1 overflow-hidden rounded-full`}>
                      <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                        <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                      </Animated.View>
                    </View>
                    <View style={tw`absolute -bottom-5 w-8 h-1 overflow-hidden rounded-full`}>
                      <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                        <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                      </Animated.View>
                    </View>
                  </>
                )}
                <View style={tw`relative`}>
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color={activeMenu === 'Messages' && !isLogoutVisible ? '#1F2937' : '#9CA3AF'} />
                  {/* RED DOT BADGE */}
                  {unreadNotificationsCount > 0 && (
                      <View style={tw`absolute -top-2 -right-2 bg-red-500 rounded-full min-w-[18px] min-h-[18px] items-center justify-center border border-white px-[2px]`}>
                        <Text style={tw`text-white text-[10px] font-bold`}>{unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}</Text>
                      </View>
                    )}
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={handleLogout}>
              {activeMenu === 'Logout' && (
                <>
                  <View style={tw`absolute -top-5 w-8 h-1 overflow-hidden rounded-full`}>
                    <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate || 0 }] }]}>
                      <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                    </Animated.View>
                  </View>
                  <View style={tw`absolute -bottom-5 w-8 h-1 overflow-hidden rounded-full`}>
                    <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate || 0 }] }]}>
                      <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tw`flex-1`} />
                    </Animated.View>
                  </View>
                </>
              )}
              <Feather name="log-out" size={26} color={activeMenu === 'Logout' ? '#ED1C24' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>

      {/* Logout Modal */}
      <Modal
        visible={isLogoutVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelLogout}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-3xl p-6 items-center shadow-2xl relative overflow-hidden`}>
            <Image source={require('../../assets/logo.png')} style={[tw`absolute opacity-10`, { width: 250, height: 250, top: -50, right: -50 }]} resizeMode="contain" />
            <View style={tw`w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4`}>
              <Feather name="log-out" size={32} color="#ED1C24" />
            </View>
            <Text style={tw`text-2xl font-black text-gray-800 mb-2`}>Konfirmasi Keluar</Text>
            <Text style={tw`text-center text-gray-500 font-medium mb-8 px-4`}>
              Apakah Anda yakin ingin keluar dari akun ini?
            </Text>
            <View style={tw`flex-row w-full`}>
              <TouchableOpacity
                style={tw`flex-1 bg-gray-100 p-4 rounded-xl mr-2 items-center`}
                onPress={handleCancelLogout}
              >
                <Text style={tw`font-bold text-gray-600`}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 bg-[#ED1C24] p-4 rounded-xl ml-2 items-center shadow-lg shadow-red-500/30`}
                onPress={confirmLogout}
              >
                <Text style={tw`font-bold text-white`}>Ya, Keluar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
