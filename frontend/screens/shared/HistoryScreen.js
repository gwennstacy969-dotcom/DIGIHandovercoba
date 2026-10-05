import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import TextLogo from '../../components/TextLogo';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Dimensions, Platform, Modal, Animated, Image, Easing, ScrollView, Linking, Alert } from 'react-native';
import tw from 'twrnc';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import { handleLogoutAndReset } from '../../utils/authHelper';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';

const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

export default function HistoryScreen({ route, navigation }) {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filter states (applied)
  const [searchQuery, setSearchQuery] = useState(route?.params?.noPolisi || '');
  const [selectedStatus, setSelectedStatus] = useState('Semua');
  const [selectedMonth, setSelectedMonth] = useState('Semua');
  const [selectedYear, setSelectedYear] = useState('Semua');
  const defaultDateObj = new Date();
  const defaultDate = `${defaultDateObj.getFullYear()}-${String(defaultDateObj.getMonth() + 1).padStart(2, '0')}-${String(defaultDateObj.getDate()).padStart(2, '0')}`;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [tempQuickSelect, setTempQuickSelect] = useState('Semua');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // Temp filter states (inside modal, only applied on TERAPKAN)
  const [tempStatus, setTempStatus] = useState('Semua');
  const [tempMonth, setTempMonth] = useState('Semua');
  const [tempYear, setTempYear] = useState('Semua');
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [activeMenu, setActiveMenu] = useState('History');
  const [previousMenu, setPreviousMenu] = useState('History');

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: showStartPicker, close: () => setShowStartPicker(false) },
      { isOpen: showEndPicker, close: () => setShowEndPicker(false) },
      { isOpen: isFilterVisible, close: () => setIsFilterVisible(false) },
      { isOpen: showExportModal, close: () => setShowExportModal(false) },
      { isOpen: isLogoutVisible, close: () => setIsLogoutVisible(false) },
    ]
  });
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadNotificationsCount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.notifications) {
        setUnreadNotificationsCount(res.data.notifications.filter(n => !n.isRead).length);
      }
    } catch (error) {
      console.log('Error fetching notifications:', error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadNotificationsCount();
    });
    return unsubscribe;
  }, [navigation]);

  const onChangeStart = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) {
      const s = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      setTempStartDate(s);
      setTempQuickSelect(null);
    }
  };

  const onChangeEnd = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) {
      const e = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      setTempEndDate(e);
      setTempQuickSelect(null);
    }
  };

  const fadeAnim = React.useRef(new Animated.Value(0.3)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const floatAnim1 = React.useRef(new Animated.Value(0)).current;
  const floatAnim2 = React.useRef(new Animated.Value(0)).current;
  const floatAnim3 = React.useRef(new Animated.Value(0)).current;

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth > 768;
  const numCols = isLargeScreen && Platform.OS === "web" ? 3 : 1;

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 1500, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();

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
  }, [fadeAnim, slideAnim]);

  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });
  const orb1TranslateY = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const orb2TranslateY = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const orb3TranslateY = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });

  useEffect(() => {
    const loadUserAndHistory = async () => {
      const userStr = await AsyncStorage.getItem('user');
      let userData = null;
      if (userStr) {
        userData = JSON.parse(userStr);
        setUser(userData);
        fetchUnreadNotificationsCount();
      }
      fetchHistory(userData);
    };
    loadUserAndHistory();
  }, []);

  const fetchHistory = async (userData, pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      const res = await axios.get(`${API_URL}/api/handovers?page=${pageNum}&limit=20`);
      let data = res.data.data || res.data; // fallback jika API lama

      if (userData && (userData.role === 'AMT' || userData.role === 'USER')) {
        data = data.filter(h => 
          h.userId === userData.id || 
          (h.user && h.user.id === userData.id) ||
          (h.amt1 && userData.name && h.amt1.trim().toLowerCase() === userData.name.trim().toLowerCase()) ||
          (h.amt2 && userData.name && h.amt2.trim().toLowerCase() === userData.name.trim().toLowerCase())
        );
      }

      if (pageNum === 1) {
        setHandovers(data);
      } else {
        setHandovers(prev => [...prev, ...data]);
      }

      if (res.data.meta) {
        setHasMore(pageNum < res.data.meta.totalPages);
      } else {
        setHasMore(false); // If backend doesn't support meta yet
      }
      setPage(pageNum);
    } catch (error) {
      console.log('Gagal fetch history:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchHistory(user, page + 1);
    }
  };

  const handleExportExcel = async () => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      Toast.show({ type: 'error', text1: 'Akses Ditolak', text2: 'Hanya Admin yang dapat mengekspor laporan.' });
      return;
    }
    try {
      const token = await AsyncStorage.getItem('token');
      let queryParams = `?token=${token}`;
      if (selectedStatus && selectedStatus !== 'Semua') queryParams += `&status=${selectedStatus}`;
      if (selectedShift && selectedShift !== 'Semua') queryParams += `&shift=${selectedShift}`;
      if (selectedMonth && selectedMonth !== 'Semua') queryParams += `&month=${selectedMonth}`;
      if (selectedYear && selectedYear !== 'Semua') queryParams += `&year=${selectedYear}`;
      if (startDate && endDate) {
        queryParams += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (searchQuery && searchQuery.trim() !== '') {
        queryParams += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const url = `${API_URL}/api/reports/excel${queryParams}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        const fileUri = `${FileSystem.documentDirectory}Laporan_Handover.xlsx`;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri);

        if (downloadRes.status === 200) {
          if (await Sharing.isAvailableAsync()) {
            try {
              await Sharing.shareAsync(downloadRes.uri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Bagikan Laporan Handover',
                UTI: 'com.microsoft.excel.xls'
              });
            } catch (shareErr) {
              Toast.show({ type: 'error', text1: 'Gagal Membagikan', text2: 'Tidak dapat membuka file: ' + shareErr.message });
            }
          } else {
            Toast.show({ type: 'success', text1: 'Sukses', text2: 'File berhasil diunduh ke perangkat Anda.' });
          }
        } else {
          Toast.show({ type: 'error', text1: 'Gagal', text2: 'Gagal mengunduh file Excel dari server. Status: ' + downloadRes.status });
        }
      }
    } catch (err) {
      console.log('Gagal export excel:', err);
      try {
        if (await Linking.canOpenURL(url)) {
          await Linking.openURL(url);
          Toast.show({ type: 'info', text1: 'Membuka Browser', text2: 'File diunduh melalui browser perangkat Anda.' });
          return;
        }
      } catch (linkErr) {
        console.log('Fallback linking failed:', linkErr);
      }
      Toast.show({ type: 'error', text1: 'Gagal Mengunduh', text2: 'Tidak dapat mengunduh Excel: ' + err.message });
    }
  };

  const handleExportPdf = async () => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      Toast.show({ type: 'error', text1: 'Akses Ditolak', text2: 'Hanya Admin yang dapat mengekspor laporan.' });
      return;
    }
    let url = '';
    try {
      const token = await AsyncStorage.getItem('token');
      let queryParams = `?token=${token}`;
      if (selectedStatus && selectedStatus !== 'Semua') queryParams += `&status=${selectedStatus}`;
      if (selectedMonth && selectedMonth !== 'Semua') queryParams += `&month=${selectedMonth}`;
      if (selectedYear && selectedYear !== 'Semua') queryParams += `&year=${selectedYear}`;
      if (startDate && endDate) {
        queryParams += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (searchQuery && searchQuery.trim() !== '') {
        queryParams += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      url = `${API_URL}/api/reports/pdf${queryParams}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        const fileUri = `${FileSystem.documentDirectory}Laporan_Handover.pdf`;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri);

        if (downloadRes.status === 200) {
          if (await Sharing.isAvailableAsync()) {
            try {
              await Sharing.shareAsync(downloadRes.uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Bagikan Laporan Handover (PDF)',
                UTI: 'com.adobe.pdf'
              });
            } catch (shareErr) {
              Toast.show({ type: 'error', text1: 'Gagal Membagikan', text2: 'Tidak dapat membuka file: ' + shareErr.message });
            }
          } else {
            Toast.show({ type: 'success', text1: 'Sukses', text2: 'File PDF berhasil diunduh ke perangkat Anda.' });
          }
        } else {
          Toast.show({ type: 'error', text1: 'Gagal', text2: 'Gagal mengunduh file PDF dari server. Status: ' + downloadRes.status });
        }
      }
    } catch (err) {
      console.log('Gagal export PDF:', err);
      try {
        if (url && (await Linking.canOpenURL(url))) {
          await Linking.openURL(url);
          Toast.show({ type: 'info', text1: 'Membuka Browser', text2: 'File PDF dibuka/diunduh melalui browser perangkat Anda.' });
          return;
        }
      } catch (linkErr) {
        console.log('Fallback linking failed:', linkErr);
      }
      Toast.show({ type: 'error', text1: 'Gagal Mengunduh', text2: 'Tidak dapat mengunduh PDF: ' + err.message });
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

  const getDashboardRoute = () => {
    if (!user) return 'Login';
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return 'AdminDashboard';
    if (user.role === 'PENGAWAS') return 'PengawasDashboard';
    return 'UserDashboard';
  };

  // Compute dynamic filter options from handovers data
  const BULAN_LIST = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const uniqueYears = [...new Set(handovers.map(h => new Date(h.timestamp).getFullYear()))].sort((a, b) => b - a);
  const uniqueMonths = [...new Set(handovers.map(h => {
    const d = new Date(h.timestamp);
    return BULAN_LIST[d.getMonth()];
  }))].sort((a, b) => BULAN_LIST.indexOf(a) - BULAN_LIST.indexOf(b));

  const hasDateFilter = !!(startDate && endDate);
  const activeFilterCount = [
    selectedStatus !== 'Semua',
    selectedMonth !== 'Semua',
    selectedYear !== 'Semua',
    hasDateFilter
  ].filter(Boolean).length;

  const openFilterModal = () => {
    // Sync temp states from current applied states
    setTempStatus(selectedStatus);
    setTempMonth(selectedMonth);
    setTempYear(selectedYear);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    
    // Check if the current applied dates match a quick select
    const dObj = new Date();
    const defaultDate = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
    let d7 = new Date(); d7.setDate(d7.getDate() - 7);
    const last7 = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;
    const monthStart = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-01`;
    const dEnd = new Date(dObj.getFullYear(), dObj.getMonth() + 1, 0);
    const monthEnd = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, '0')}-${String(dEnd.getDate()).padStart(2, '0')}`;

    if (!startDate && !endDate) {
      setTempQuickSelect('Semua');
    } else if (startDate === defaultDate && endDate === defaultDate) {
      setTempQuickSelect('Hari Ini');
    } else if (startDate === last7 && endDate === defaultDate) {
      setTempQuickSelect('7 Hari Terakhir');
    } else if (startDate === monthStart && endDate === monthEnd) {
      setTempQuickSelect('Bulan Ini');
    } else {
      setTempQuickSelect(null);
    }
    
    setIsFilterVisible(true);
  };

  const applyFilters = () => {
    setSelectedStatus(tempStatus);
    setSelectedMonth(tempMonth);
    setSelectedYear(tempYear);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setIsFilterVisible(false);
  };

  const resetTempFilters = () => {
    setTempStatus('Semua');
    setTempMonth('Semua');
    setTempYear('Semua');
    setTempStartDate('');
    setTempEndDate('');
    setTempQuickSelect('Semua');
  };

  const resetAllFilters = () => {
    setSelectedStatus('Semua');
    setSelectedMonth('Semua');
    setSelectedYear('Semua');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const filteredHandovers = handovers.filter((item) => {
    // Abaikan sesi dummy NOT_STARTED jika ada
    if (item.status === 'NOT_STARTED') return false;

    // Search bar (untuk cari Nopol, Nama AMT, Tanggal)
    let matchesSearch = true;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const dateStr = new Date(item.timestamp).toLocaleString('id-ID');
      matchesSearch =
        item.noPolisi.toLowerCase().includes(q) ||
        (item.user && item.user.name.toLowerCase().includes(q)) ||
        (item.amt1 && item.amt1.toLowerCase().includes(q)) ||
        (item.amt2 && item.amt2.toLowerCase().includes(q)) ||
        dateStr.toLowerCase().includes(q);
    }

    const isNormal = item.status === 'Siap Operasi (Normal)';

    let matchesStatus = true;
    if (selectedStatus === 'Normal') matchesStatus = isNormal;
    if (selectedStatus === 'Isu') matchesStatus = !isNormal;

    let matchesMonth = true;
    if (selectedMonth !== 'Semua') {
      const itemMonth = BULAN_LIST[new Date(item.timestamp).getMonth()];
      matchesMonth = itemMonth === selectedMonth;
    }

    let matchesYear = true;
    if (selectedYear !== 'Semua') {
      matchesYear = new Date(item.timestamp).getFullYear() === parseInt(selectedYear);
    }

    let matchesDateRange = true;
    if (startDate && endDate) {
      const d = new Date(item.timestamp);
      const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchesDateRange = itemDateStr >= startDate && itemDateStr <= endDate;
    }

    return matchesSearch && matchesStatus && matchesMonth && matchesYear && matchesDateRange;
  });

  const renderItem = ({ item }) => {
    const isNormal = item.status === 'Siap Operasi (Normal)';
    const isResolved = item.issue && item.issue.status === 'RESOLVED';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HandoverDetail', { handover: item })}
        style={[
          tw`bg-white p-5 rounded-2xl mb-4 shadow-md border ${isNormal ? "border-green-100" : (isResolved ? "border-blue-200" : "border-red-200")}`,
          isLargeScreen ? { width: 'calc(33.333% - 11px)' } : tw`w-full`
        ]}
      >
        <View style={tw`flex-row justify-between items-start mb-3`}>
          <View style={[tw`flex-row items-center flex-1 mr-3`, { minWidth: 0 }]}>
            <View style={[tw`w-12 h-12 rounded-full items-center justify-center mr-3 ${isNormal ? 'bg-green-100' : (isResolved ? 'bg-blue-100' : 'bg-red-100')}`, { flexShrink: 0 }]}>
              <Ionicons name={isNormal ? "checkmark-circle" : (isResolved ? "checkmark-done-circle" : "warning")} size={28} color={isNormal ? "#00A651" : (isResolved ? "#0055A5" : "#ED1C24")} />
            </View>
            <View style={[tw`flex-1`, { minWidth: 0 }]}>
              <Text style={tw`text-xl font-black text-gray-800`}>{item.noPolisi}</Text>
              <View style={tw`flex-row items-center flex-wrap gap-1.5 mt-0.5`}>
                <Text style={tw`text-sm font-semibold text-gray-600`}>Shift {item.shift}</Text>
                {item.type ? (
                  <View style={tw`px-2 py-0.5 rounded-full ${item.type === 'mulai' ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50 border border-purple-200'}`}>
                    <Text style={tw`text-[10px] font-bold ${item.type === 'mulai' ? 'text-[#0055A5]' : 'text-purple-700'}`}>
                      {item.type === 'mulai' ? 'Mulai' : 'Akhiri'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={tw`text-xs text-gray-500 mt-1`} numberOfLines={1} ellipsizeMode="tail">
                {item.amt1 
                  ? `AMT: ${item.amt1}${item.amt2 ? ` & ${item.amt2}` : ''}` 
                  : (item.user ? `${item.user.name}${item.user.jabatan ? ` (${item.user.jabatan})` : ''}` : '-')}
              </Text>
            </View>
          </View>
          <View style={[tw`px-3 py-1.5 rounded-full border ${isNormal ? 'bg-[#E8F8F0] border-[#00A651]' : (isResolved ? 'bg-[#EBF3FA] border-[#0055A5]' : 'bg-[#FDE8E9] border-[#ED1C24]')}`, { flexShrink: 0 }]}>
            <Text style={tw`text-xs font-bold ${isNormal ? 'text-[#00A651]' : (isResolved ? 'text-[#0055A5]' : 'text-[#ED1C24]')}`}>
              {isNormal ? 'NORMAL' : (isResolved ? 'SELESAI' : 'ISU')}
            </Text>
          </View>
        </View>

        <Text style={tw`text-xs text-gray-400 mb-2`}>Tanggal: {new Date(item.timestamp).toLocaleString()}</Text>

        {!isNormal && (
          <View style={tw`mt-2 bg-red-50 p-3 rounded-xl border border-red-100`}>
            <Text style={tw`text-red-800 font-bold mb-1 text-sm`}>Detail Kendala:</Text>
            {item.items.filter(i => !i.isGood).map((issue, idx) => {
              const showSeverity = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'PENGAWAS');
              const displayName = showSeverity ? issue.name : issue.name.replace(/\s*\[MAJOR\]|\s*\[MINOR\]/gi, '').trim();
              return (
                <Text key={idx} style={tw`text-red-600 text-xs my-1`}>• {displayName}</Text>
              );
            })}
          </View>
        )}

        {/* Tap indicator & Photo counter */}
        {item.photos && item.photos.length > 0 ? (
          <View style={tw`flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100`}>
            <View style={tw`flex-row items-center bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100`}>
              <Ionicons name="camera" size={13} color="#0055A5" style={tw`mr-1`} />
              <Text style={tw`text-[11px] font-black text-[#0055A5]`}>{item.photos.length} Foto</Text>
            </View>
            <View style={tw`flex-row items-center`}>
              <Text style={tw`text-xs text-[#0055A5] font-bold mr-1`}>Lihat Detail & Preview</Text>
              <Ionicons name="chevron-forward" size={14} color="#0055A5" />
            </View>
          </View>
        ) : (
          <View style={tw`flex-row items-center justify-end mt-3 pt-3 border-t border-gray-100`}>
            <Text style={tw`text-xs text-[#0055A5] font-bold mr-1`}>Lihat Detail</Text>
            <Ionicons name="chevron-forward" size={14} color="#0055A5" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-[#F4F7FA]`}>
      {/* 3 Animated Background Orbs for Premium Vibe (Fainter) */}
      <Animated.View style={[tw`absolute -top-20 -left-10 w-[35rem] h-[35rem] rounded-full opacity-15`, { transform: [{ translateY: orb1TranslateY }] }]}>
        <LinearGradient colors={['#0055A5', '#003366']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -top-20 -right-20 w-[25rem] h-[25rem] rounded-full opacity-15`, { transform: [{ translateY: orb3TranslateY }] }]}>
        <LinearGradient colors={['#00A651', '#007A3B']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -bottom-40 -right-10 w-[30rem] h-[30rem] rounded-full opacity-15`, { transform: [{ translateY: orb2TranslateY }] }]}>
        <LinearGradient colors={['#ED1C24', '#B30000']} style={tw`flex-1 rounded-full`} />
      </Animated.View>

      <SafeAreaView style={tw`flex-1 relative ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>

        
        {isLargeScreen && user && (
          <WebSidebar 
            user={user} 
            activeMenu={'History'} 
            navigation={navigation} 
            handleLogout={handleLogout || (() => { setIsLogoutVisible(true); })} 
            unreadNotificationsCount={unreadNotificationsCount || 0} 
          />
        )}

        {/* MAIN CONTENT AREA */}
        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
        {/* STICKY NAVBAR (Floating Modern Style - Sama persis Mobile & Web) */}
        <WebNavbar
          user={user}
          title="Lihat Seluruh Laporan"
          subtitle="Data Riwayat Handover & Inspeksi"
          navigation={navigation}
          showBack={true}
          onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace(getDashboardRoute())}
          rightAction={
            isLargeScreen && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? (
              <View style={tw`flex-row gap-3`}>
                <TouchableOpacity onPress={handleExportPdf} style={tw`bg-[#ED1C24] px-4 py-2 rounded-xl flex-row items-center shadow-md active:scale-95`}>
                  <Ionicons name="document-outline" size={16} color="white" />
                  <Text style={tw`text-white font-bold text-xs ml-1.5`}>Export PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleExportExcel} style={tw`bg-[#00A651] px-4 py-2 rounded-xl flex-row items-center shadow-md active:scale-95`}>
                  <Ionicons name="document-text" size={16} color="white" />
                  <Text style={tw`text-white font-bold text-xs ml-1.5`}>Export Excel</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { minHeight: 0, overflow: 'hidden' } : {}]}>
          {/* Modern Search & Filter Button with comfortable spacing */}
          <View style={tw`px-6 pt-2 pb-3 mb-2 flex-row items-center justify-between z-10 border-b border-gray-100/60`}>
            <View style={tw`flex-1 flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mr-3`}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={tw`flex-1 ml-3 text-gray-800 font-medium`}
                placeholder={user && (user.role === 'AMT' || user.role === 'USER') ? "Cari berdasarkan Nopol..." : "Cari Nopol atau Nama AMT..."}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={tw`bg-[#0055A5] p-3 rounded-2xl shadow-md shadow-blue-500/30 relative`}
              onPress={openFilterModal}
            >
              <Feather name="filter" size={22} color="white" />
              {activeFilterCount > 0 && (
                <View style={tw`absolute -top-2 -right-2 w-5 h-5 bg-[#ED1C24] rounded-full items-center justify-center`}>
                  <Text style={tw`text-white text-[10px] font-black`}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>



          {/* Filter Modal */}
          <Modal
            visible={isFilterVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsFilterVisible(false)}
          >
            <View style={tw`flex-1 justify-end bg-black/40`}>
              <View style={tw`bg-white rounded-t-[30px] shadow-2xl max-h-[85%]`}>
                {/* Header */}
                <View style={tw`flex-row justify-between items-center p-6 pb-4 border-b border-gray-100`}>
                  <View>
                    <Text style={tw`text-2xl font-black text-gray-800`}>Filter Riwayat</Text>
                    <Text style={tw`text-xs text-gray-400 font-medium mt-1`}>{activeFilterCount > 0 ? `${activeFilterCount} filter aktif` : 'Tidak ada filter aktif'}</Text>
                  </View>
                  <View style={tw`flex-row items-center gap-2`}>
                    {activeFilterCount > 0 && (
                      <TouchableOpacity onPress={resetTempFilters} style={tw`px-4 py-2 bg-red-50 rounded-full border border-red-200`}>
                        <Text style={tw`text-xs font-bold text-red-500`}>Reset</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setIsFilterVisible(false)} style={tw`p-2 bg-gray-100 rounded-full`}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={tw`px-6`} showsVerticalScrollIndicator={false}>
                  {/* Status Filter */}
                  <Text style={tw`text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider flex-row items-center`}>
                    <Ionicons name="shield-checkmark" size={14} color="#9CA3AF" />  Status
                  </Text>
                  <View style={tw`flex-row flex-wrap mb-5`}>
                    {['Semua', 'Normal', 'Isu'].map(status => (
                      <TouchableOpacity
                        key={status}
                        style={tw`px-4 py-2.5 rounded-full mr-2 mb-2 border ${tempStatus === status ? 'bg-[#0055A5] border-[#0055A5]' : 'bg-transparent border-gray-300'}`}
                        onPress={() => setTempStatus(status)}
                      >
                        <Text style={tw`text-sm font-bold ${tempStatus === status ? 'text-white' : 'text-gray-600'}`}>{status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Rentang Waktu Cepat (Banking App Style) */}
                  <Text style={tw`text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider flex-row items-center`}>
                    <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />  Pilih Cepat
                  </Text>
                  <View style={tw`flex-row flex-wrap mb-5`}>
                    {[
                      { label: 'Semua', getRange: () => ['', ''] },
                      { label: 'Hari Ini', getRange: () => { const d = new Date(); const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return [s, s] } },
                      { label: '7 Hari Terakhir', getRange: () => { const d = new Date(); const e = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; d.setDate(d.getDate() - 7); const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return [s, e] } },
                      { label: 'Bulan Ini', getRange: () => { const d = new Date(); const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; const dEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0); const e = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, '0')}-${String(dEnd.getDate()).padStart(2, '0')}`; return [s, e] } },
                    ].map(preset => (
                      <TouchableOpacity
                        key={preset.label}
                        style={tw`px-4 py-2.5 rounded-full mr-2 mb-2 border ${tempQuickSelect === preset.label ? 'bg-[#0055A5] border-[#0055A5]' : 'bg-transparent border-gray-300'}`}
                        onPress={() => {
                          const [s, e] = preset.getRange();
                          setTempStartDate(s);
                          setTempEndDate(e);
                          setTempYear('Semua');
                          setTempMonth('Semua');
                          setTempQuickSelect(preset.label);
                        }}
                      >
                        <Text style={tw`text-sm font-bold ${tempQuickSelect === preset.label ? 'text-white' : 'text-gray-600'}`}>{preset.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Date Range Filter Custom */}
                  <Text style={tw`text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider flex-row items-center`}>
                    <Ionicons name="calendar" size={14} color="#9CA3AF" />  Rentang Kustom
                  </Text>
                  <View style={tw`flex-row items-center justify-between mb-5`}>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-xs text-gray-400 mb-1 font-bold`}>Dari Tanggal</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={tempStartDate || ''}
                          onChange={(e) => {
                            setTempStartDate(e.target.value);
                            setTempQuickSelect(null);
                          }}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          style={{ padding: 12, borderRadius: 16, border: '1px solid #E5E7EB', width: '100%', outline: 'none', fontFamily: 'inherit', backgroundColor: '#F9FAFB', fontWeight: 'bold', color: '#1F2937', cursor: 'pointer' }}
                        />
                      ) : (
                        <>
                          <TouchableOpacity 
                            onPress={() => setShowStartPicker(true)}
                            style={tw`p-3 border border-gray-200 rounded-2xl bg-gray-50 flex-row items-center justify-between`}
                          >
                            <Text style={tw`${tempStartDate ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}`}>{tempStartDate || 'Pilih tanggal'}</Text>
                            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                          {showStartPicker && (
                            <DateTimePicker
                              value={tempStartDate ? new Date(tempStartDate) : new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                              onValueChange={(event, date) => onChangeStart(event, date)} onDismiss={() => setShowStartPicker(false)}
                            />
                          )}
                        </>
                      )}
                    </View>
                    <View style={tw`px-3 mt-4`}>
                      <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-xs text-gray-400 mb-1 font-bold`}>Sampai Tanggal</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          type="date"
                          value={tempEndDate || ''}
                          onChange={(e) => {
                            setTempEndDate(e.target.value);
                            setTempQuickSelect(null);
                          }}
                          onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          style={{ padding: 12, borderRadius: 16, border: '1px solid #E5E7EB', width: '100%', outline: 'none', fontFamily: 'inherit', backgroundColor: '#F9FAFB', fontWeight: 'bold', color: '#1F2937', cursor: 'pointer' }}
                        />
                      ) : (
                        <>
                          <TouchableOpacity 
                            onPress={() => setShowEndPicker(true)}
                            style={tw`p-3 border border-gray-200 rounded-2xl bg-gray-50 flex-row items-center justify-between`}
                          >
                            <Text style={tw`${tempEndDate ? 'text-gray-800 font-bold' : 'text-gray-400 font-medium'}`}>{tempEndDate || 'Pilih tanggal'}</Text>
                            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                          {showEndPicker && (
                            <DateTimePicker
                              value={tempEndDate ? new Date(tempEndDate) : new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                              onValueChange={(event, date) => onChangeEnd(event, date)} onDismiss={() => setShowEndPicker(false)}
                            />
                          )}
                        </>
                      )}
                    </View>
                  </View>

                </ScrollView>

                {/* Apply Button */}
                <View style={tw`p-6 pt-4 border-t border-gray-100`}>
                  <TouchableOpacity
                    style={tw`bg-[#0055A5] p-4 rounded-2xl items-center shadow-lg shadow-blue-500/40`}
                    onPress={applyFilters}
                  >
                    <Text style={tw`text-white font-black text-lg tracking-wide`}>TERAPKAN FILTER</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {loading ? (
            <View style={tw`flex-1 justify-center items-center`}>
              <View style={tw`items-center justify-center -mt-10`}>
                <Animated.View style={[tw`mb-2`, { opacity: fadeAnim }]}><TextLogo style={{ transform: [{ scale: 0.9 }] }} /></Animated.View>
                <ActivityIndicator size="large" color="#0055A5" />
                <Text style={tw`mt-2 text-gray-500 font-bold tracking-widest uppercase text-xs`}>Memuat Data...</Text>
              </View>
            </View>
          ) : (
            <FlatList key={numCols} numColumns={numCols} columnWrapperStyle={isLargeScreen ? tw`justify-start gap-4` : undefined}
              style={tw`flex-1`}
              contentContainerStyle={tw`p-6 pb-32 w-full max-w-7xl mx-auto`}
              data={filteredHandovers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              initialNumToRender={Platform.OS === 'web' ? 50 : 15}
              maxToRenderPerBatch={Platform.OS === 'web' ? 50 : 15}
              windowSize={Platform.OS === 'web' ? 30 : 10}
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={true}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                hasMore ? (
                  <View style={tw`py-4 items-center`}>
                    <ActivityIndicator size="small" color="#0055A5" />
                  </View>
                ) : (
                  <View style={tw`py-4 items-center`}>
                    <Text style={tw`text-gray-400 text-xs font-medium`}>Semua riwayat telah dimuat</Text>
                  </View>
                )
              }
              ListEmptyComponent={
                <View style={tw`items-center mt-20`}>
                  <Ionicons name="document-text-outline" size={60} color="#CBD5E1" />
                  <Text style={tw`text-center text-gray-400 font-medium mt-4 text-lg`}>Tidak ada data yang sesuai filter.</Text>
                </View>
              }
            />
          )}

          {/* Tombol Ekspor Laporan (Mobile Only - Hanya Admin) */}
          {!isLargeScreen && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
            <TouchableOpacity
              style={tw`absolute bottom-28 right-6 z-40 bg-[#0055A5] px-5 py-3.5 rounded-full flex-row items-center shadow-2xl shadow-blue-600/50 border border-white/40 active:scale-95`}
              onPress={() => setShowExportModal(true)}
            >
              <Feather name="download" size={18} color="white" />
              <Text style={tw`text-white font-black text-sm ml-2 tracking-wide`}>Ekspor Laporan</Text>
            </TouchableOpacity>
          )}

          {/* MODAL PILIH FORMAT EKSPOR (MOBILE) */}
          <Modal
            visible={showExportModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowExportModal(false)}
          >
            <View style={tw`flex-1 justify-end sm:justify-center items-center bg-black/50 px-4 sm:px-0 z-50`}>
              <View style={tw`bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl relative overflow-hidden pb-8 sm:pb-6`}>
                
                {/* Header Modal */}
                <View style={tw`flex-row justify-between items-center mb-2`}>
                  <View style={tw`flex-row items-center`}>
                    <View style={tw`w-11 h-11 bg-blue-50 rounded-2xl items-center justify-center mr-3 border border-blue-100`}>
                      <Feather name="download" size={22} color="#0055A5" />
                    </View>
                    <View>
                      <Text style={tw`text-xl font-black text-gray-900 tracking-tight`}>Pilih Format Ekspor</Text>
                      <Text style={tw`text-xs text-gray-400 font-medium`}>Pilih format dokumen laporan handover</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowExportModal(false)}
                    style={tw`w-9 h-9 bg-gray-100 rounded-full items-center justify-center`}
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={tw`h-[1px] bg-gray-100 my-4`} />

                {/* Pilihan Format */}
                <View style={tw`gap-3`}>
                  {/* Opsi PDF */}
                  <TouchableOpacity
                    style={tw`p-4 rounded-2xl border-2 border-red-100 bg-red-50/50 flex-row items-center active:scale-[0.98] active:bg-red-100/60`}
                    onPress={() => {
                      setShowExportModal(false);
                      handleExportPdf();
                    }}
                  >
                    <View style={tw`w-12 h-12 rounded-xl bg-[#ED1C24] items-center justify-center shadow-md shadow-red-500/30 mr-3.5`}>
                      <Ionicons name="document-outline" size={26} color="white" />
                    </View>
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center justify-between mb-0.5`}>
                        <Text style={tw`text-base font-black text-gray-800`}>Dokumen PDF (.pdf)</Text>
                        <View style={tw`bg-red-100 px-2 py-0.5 rounded-full`}>
                          <Text style={tw`text-red-700 font-bold text-[10px]`}>Siap Cetak</Text>
                        </View>
                      </View>
                      <Text style={tw`text-xs text-gray-500 leading-4`}>Format berita acara serah terima resmi Pertamina Patra Niaga</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#9CA3AF" style={tw`ml-2`} />
                  </TouchableOpacity>

                  {/* Opsi Excel */}
                  <TouchableOpacity
                    style={tw`p-4 rounded-2xl border-2 border-green-100 bg-green-50/50 flex-row items-center active:scale-[0.98] active:bg-green-100/60`}
                    onPress={() => {
                      setShowExportModal(false);
                      handleExportExcel();
                    }}
                  >
                    <View style={tw`w-12 h-12 rounded-xl bg-[#00A651] items-center justify-center shadow-md shadow-green-500/30 mr-3.5`}>
                      <Ionicons name="document-text" size={26} color="white" />
                    </View>
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center justify-between mb-0.5`}>
                        <Text style={tw`text-base font-black text-gray-800`}>Spreadsheet Excel (.xlsx)</Text>
                        <View style={tw`bg-green-100 px-2 py-0.5 rounded-full`}>
                          <Text style={tw`text-green-700 font-bold text-[10px]`}>Data Rekap</Text>
                        </View>
                      </View>
                      <Text style={tw`text-xs text-gray-500 leading-4`}>Rekapitulasi data lengkap untuk analisis dan pengolahan tabel</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#9CA3AF" style={tw`ml-2`} />
                  </TouchableOpacity>
                </View>

                {/* Tombol Batal */}
                <TouchableOpacity
                  style={tw`w-full bg-gray-100 py-3.5 rounded-2xl items-center mt-5 active:bg-gray-200`}
                  onPress={() => setShowExportModal(false)}
                >
                  <Text style={tw`text-gray-700 font-bold text-sm`}>Batal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

                  </View>

        {/* ULTRA PREMIUM BOTTOM NAVIGATION (MOBILE ONLY) */}
          {!isLargeScreen && user && (
            <View style={tw`absolute bottom-8 self-center w-11/12 bg-white rounded-full flex-row justify-around items-center py-5 shadow-2xl shadow-gray-400/50 z-50`}>
              <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace(getDashboardRoute())}>
                <Feather name="grid" size={26} color="#9CA3AF" />
              </TouchableOpacity>

              {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
                <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('ChecklistManager')}>
                  <Feather name="check-square" size={26} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {user && (user.role === 'AMT' || user.role === 'USER') && (
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

              <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('MessageCenter')}>
                <View style={tw`relative`}>
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color="#9CA3AF" />
                  {unreadNotificationsCount > 0 && <View style={tw`absolute -top-2 -right-2 bg-red-500 rounded-full min-w-[18px] min-h-[18px] items-center justify-center border border-white px-[2px]`}><Text style={tw`text-white text-[10px] font-bold`}>{unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}</Text></View>}
                </View>
              </TouchableOpacity>

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
      </SafeAreaView>
    </View>
  );
}
