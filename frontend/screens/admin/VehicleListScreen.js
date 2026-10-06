import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import React, { useState, useEffect, useMemo } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { API_URL } from '../../config';
import TextLogo from '../../components/TextLogo';
import { View, Text, FlatList, TouchableOpacity, TextInput, Platform, Modal, Animated, Image, Easing, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Linking } from 'react-native';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_BASE = { toString: () => `${API_URL}/api` };
const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

const { Dimensions } = require('react-native');
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';
import { handleLogoutAndReset } from '../../utils/authHelper';

export default function VehicleListScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [returnToManageModal, setReturnToManageModal] = useState(false);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (returnToManageModal) {
        setManageModalVisible(true);
        setReturnToManageModal(false);
      }
    });
    return unsubscribe;
  }, [navigation, returnToManageModal]);

  const isLargeScreen = Platform.OS === 'web' && screenWidth > 768;
  const numCols = isLargeScreen ? 3 : 1;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Semua');
  const [tempSelectedStatus, setTempSelectedStatus] = useState('Semua');
  const [selectedMonth, setSelectedMonth] = useState('Semua');
  const [user, setUser] = useState(null);
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const handleLogout = () => setIsLogoutVisible(true);
  const handleCancelLogout = () => setIsLogoutVisible(false);
  const confirmLogout = async () => {
    setIsLogoutVisible(false);
    await handleLogoutAndReset(navigation);
  };

  // Modal Manage Vehicle (Detail/Edit/Delete)
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [fullScreenBarcode, setFullScreenBarcode] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Modal Add / Edit Vehicle
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newNoPolisi, setNewNoPolisi] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newType, setNewType] = useState('');
  const [newKapasitas, setNewKapasitas] = useState(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);

  // Force Release Modal
  const [forceReleaseModalVisible, setForceReleaseModalVisible] = useState(false);
  const [vehicleToForceRelease, setVehicleToForceRelease] = useState(null);
  const [isForceReleasing, setIsForceReleasing] = useState(false);

  // Custom Success Notification Modal
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Custom Warning Modal
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const showWarningModal = (title, message) => {
    setWarningTitle(title);
    setWarningMessage(message);
    setWarningModalVisible(true);
  };

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: fullScreenBarcode, close: () => setFullScreenBarcode(false) },
      { isOpen: forceReleaseModalVisible, close: () => setForceReleaseModalVisible(false) },
      { isOpen: confirmModalVisible, close: () => setConfirmModalVisible(false) },
      { isOpen: addModalVisible, close: () => setAddModalVisible(false) },
      { isOpen: manageModalVisible, close: () => setManageModalVisible(false) },
      { isOpen: successModalVisible, close: () => setSuccessModalVisible(false) },
      { isOpen: warningModalVisible, close: () => setWarningModalVisible(false) },
      { isOpen: isLogoutVisible, close: handleCancelLogout },
    ]
  });

  const orb1TranslateY = React.useRef(new Animated.Value(0)).current;
  const orb2TranslateY = React.useRef(new Animated.Value(0)).current;
  const orb3TranslateY = React.useRef(new Animated.Value(0)).current;

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const [vehicleRes, issueRes] = await Promise.all([
        axios.get(`${API_BASE}/vehicles`),
        axios.get(`${API_BASE}/issues/ongoing`)
      ]);

      const vehiclesData = vehicleRes.data;
      const activeIssues = issueRes.data;

      const updatedVehicles = vehiclesData.map(vehicle => {
        const hasIssue = activeIssues.some(issue => issue.handover.noPolisi === vehicle.noPolisi);
        vehicle.dynamicStatus = hasIssue ? 'Isu' : 'Normal';
        return vehicle;
      });

      setVehicles(updatedVehicles);
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: `Error`,
        text2: `Gagal memuat data kendaraan`
      });
    } finally {
      setLoading(false);
    }
  };

  const showSuccessModal = (message) => {
    setSuccessMessage(message);
    setSuccessModalVisible(true);
  };

  const handleDownloadBarcode = async () => {
    if (!selectedVehicle) return;

    const imageUrl = `${API_BASE}/vehicles/poster/${selectedVehicle.barcode}`;

    if (Platform.OS === 'web') {
      try {
        window.open(`${API_BASE}/vehicles/poster/${selectedVehicle.barcode}?download=true`, '_blank');
        
        setFullScreenBarcode(false);
        setManageModalVisible(false);
        
        setTimeout(() => {
          showSuccessModal(`Poster barcode untuk kendaraan ${selectedVehicle.noPolisi} berhasil diunduh!`);
        }, 300);
      } catch (err) {
        console.error('Download error:', err);
      }
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Toast.show({
        type: 'error',
        text1: `Gagal`,
        text2: `Fitur berbagi tidak tersedia di perangkat ini.`
      });
        return;
      }

      const cleanPlate = (selectedVehicle.noPolisi || selectedVehicle.barcode).replace(/\s+/g, '');
      const fileUri = FileSystem.documentDirectory + `QR_Handover_${cleanPlate}.png`;
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Simpan Poster Barcode ${selectedVehicle.noPolisi}`,
        UTI: 'public.png'
      });

      setFullScreenBarcode(false);
      setManageModalVisible(false);
    } catch (error) {
      console.error(error);
      try {
        if (imageUrl && (await Linking.canOpenURL(imageUrl))) {
          await Linking.openURL(imageUrl);
          setFullScreenBarcode(false);
          Toast.show({ type: 'info', text1: 'Membuka Barcode', text2: 'Gambar template barcode dibuka di browser perangkat Anda.' });
          return;
        }
      } catch (linkErr) {
        console.error('Fallback link error:', linkErr);
      }
      Toast.show({ type: 'error', text1: 'Gagal', text2: error.message || 'Terjadi kesalahan saat memproses barcode.' });
    }
  };

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(orb1TranslateY, { toValue: -50, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(orb1TranslateY, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(orb2TranslateY, { toValue: 60, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(orb2TranslateY, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(orb3TranslateY, { toValue: -70, duration: 12000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(orb3TranslateY, { toValue: 0, duration: 12000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();

    const loadUser = async () => {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setUser(JSON.parse(userStr));
    };

    loadUser();
    fetchVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = item.noPolisi.toLowerCase().includes(q) || (item.brand && item.brand.toLowerCase().includes(q));
      const isIssue = item.dynamicStatus === 'Isu' || item.status === 'Buruk' || item.status === 'Maintenance' || item.status === 'Isu';
      const status = isIssue ? 'Isu' : 'Normal';
      const matchesStatus = selectedStatus === 'Semua' || status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [vehicles, searchQuery, selectedStatus]);

  const openManageModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setManageModalVisible(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setNewNoPolisi(''); setNewBrand(''); setNewType(''); setNewKapasitas(null); setNewBarcode('');
    setAddModalVisible(true);
  };

  const openEditModal = (vehicle) => {
    setIsEditMode(true);
    setSelectedVehicle(vehicle);
    setNewNoPolisi(vehicle.noPolisi);
    setNewBrand(vehicle.brand || '');
    setNewType(vehicle.jenisKendaraan || '');
    setNewKapasitas(vehicle.kapasitas || null);
    setNewBarcode(vehicle.barcode || '');
    setManageModalVisible(false);
    setAddModalVisible(true);
  };

  const handleForceReleaseShift = (vehicle) => {
    setVehicleToForceRelease(vehicle);
    setManageModalVisible(false);
    setForceReleaseModalVisible(true);
  };

  const handleCancelForceRelease = () => {
    setForceReleaseModalVisible(false);
    setManageModalVisible(true);
  };

  const confirmForceRelease = async () => {
    if (!vehicleToForceRelease) return;
    setIsForceReleasing(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE}/handovers/force-release`,
        { noPolisi: vehicleToForceRelease.noPolisi, reason: 'Force Release oleh Pengawas/Admin dari Daftar Kendaraan' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setForceReleaseModalVisible(false);
      setManageModalVisible(false);
      showSuccessModal(res.data.message || `Shift untuk kendaraan ${vehicleToForceRelease.noPolisi} berhasil ditutup paksa.`);
      fetchVehicles();
    } catch (err) {
      setForceReleaseModalVisible(false);
      showWarningModal('Gagal Force Release', err.response?.data?.error || 'Gagal melakukan force release.');
    } finally {
      setIsForceReleasing(false);
    }
  };

  const handleDeleteVehicle = (vehicle) => {
    setVehicleToDelete(vehicle);
    setManageModalVisible(false);
    setConfirmModalVisible(true);
  };

  const handleCancelDelete = () => {
    setConfirmModalVisible(false);
    setManageModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await axios.delete(`${API_BASE}/vehicles/${vehicleToDelete.id}`);
      setManageModalVisible(false);
      setConfirmModalVisible(false);
      fetchVehicles();
      showSuccessModal('Kendaraan berhasil dihapus!');
    } catch (error) {
      console.error(error);
      showWarningModal('Gagal', 'Gagal menghapus kendaraan');
      setConfirmModalVisible(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!newNoPolisi) {
      Toast.show({
        type: 'info',
        text1: `Data Tidak Lengkap`,
        text2: `Nomor Polisi wajib diisi.`
      });
      return;
    }

    const generatedBarcode = newNoPolisi.replace(/\s+/g, '').toUpperCase();

    // Cek duplikasi
    const isDuplicateBarcode = vehicles.some(v => v.barcode.toLowerCase() === generatedBarcode.toLowerCase() && (!isEditMode || v.id !== selectedVehicle?.id));
    const isDuplicateNoPolisi = vehicles.some(v => v.noPolisi.toLowerCase() === newNoPolisi.toLowerCase() && (!isEditMode || v.id !== selectedVehicle?.id));

    if (isDuplicateBarcode || isDuplicateNoPolisi) {
      showWarningModal(
        "Plat Terdaftar!",
        `Plat nomor "${newNoPolisi}" sudah ada di database. Silakan periksa kembali.`
      );
      return;
    }

    try {
      if (isEditMode && selectedVehicle) {
        await axios.put(`${API_BASE}/vehicles/${selectedVehicle.id}`, {
          noPolisi: newNoPolisi,
          brand: newBrand,
          jenisKendaraan: newType,
          kapasitas: newKapasitas,
          barcode: generatedBarcode
        });
        showSuccessModal('Kendaraan berhasil diperbarui!');
      } else {
        await axios.post(`${API_BASE}/vehicles`, {
          noPolisi: newNoPolisi,
          brand: newBrand,
          jenisKendaraan: newType,
          kapasitas: newKapasitas,
          barcode: generatedBarcode
        });
        showSuccessModal('Kendaraan baru berhasil ditambahkan!');
      }

      setAddModalVisible(false);
      fetchVehicles();
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: `Error`,
        text2: `Gagal menyimpan kendaraan`
      });
    }
  };

  const renderItem = ({ item }) => {
    // Gunakan dynamicStatus yang sudah dikalkulasi dari laporan handover terbaru
    const isIssue = item.dynamicStatus === 'Isu' || item.status === 'Buruk' || item.status === 'Maintenance' || item.status === 'Isu';
    const currentStatus = isIssue ? 'Isu' : 'Normal';

    return (
      <TouchableOpacity
        style={[
          tw`bg-white p-5 rounded-2xl mb-4 shadow-sm border ${isIssue ? 'border-red-100' : 'border-gray-100'} flex-row justify-between items-center`,
          isLargeScreen ? { width: 'calc(33.333% - 11px)' } : tw`w-full`
        ]}
        onPress={() => openManageModal(item)}
        activeOpacity={0.7}
      >
        <View style={tw`flex-row items-center flex-1`}>
          <View style={tw`w-12 h-12 rounded-full items-center justify-center mr-3 ${isIssue ? 'bg-red-100' : 'bg-green-100'}`}>
            <MaterialCommunityIcons name="truck" size={26} color={isIssue ? "#ED1C24" : "#00A651"} />
          </View>
          <View style={tw`flex-1 pr-2`}>
            <Text style={tw`text-xl font-black ${isIssue ? 'text-red-900' : 'text-gray-800'}`}>{item.noPolisi}</Text>
            <Text style={tw`text-sm font-bold text-gray-500`} numberOfLines={1}>
              {item.brand ? `${item.brand} • ` : ''}{item.kapasitas ? `Mobil Tanki ${item.kapasitas} KL` : (item.jenisKendaraan || 'Mobil Tanki')}
            </Text>
          </View>
        </View>

        <View style={tw`items-end`}>
          <View style={tw`px-3 py-1.5 rounded-lg mb-1 flex-row items-center ${isIssue ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <View style={tw`w-1.5 h-1.5 rounded-full mr-1.5 ${isIssue ? 'bg-red-500' : 'bg-green-500'}`} />
            <Text style={tw`text-[10px] font-black uppercase tracking-widest ${isIssue ? 'text-red-600' : 'text-green-600'}`}>
              {currentStatus}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-[#F4F7FA]`}>
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
        {isLargeScreen && user && (
          <WebSidebar
            user={user}
            activeMenu={'VehicleList'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>

        <WebNavbar
          user={user}
          title="Daftar Kendaraan"
          subtitle="Monitoring & Kelola Armada Mobil Tangki"
          navigation={navigation}
          showBack={true}
          rightAction={
            isLargeScreen && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') ? (
              <TouchableOpacity
                onPress={openAddModal}
                style={tw`flex-row items-center bg-[#0055A5] px-4 py-2.5 rounded-2xl shadow-md`}
              >
                <MaterialCommunityIcons name="truck-plus" size={18} color="white" />
                <Text style={tw`text-white font-bold text-sm ml-2`}>Tambah Kendaraan</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { minHeight: 0, overflow: 'hidden' } : {}]}>
          <View style={tw`px-6 pt-2`}>
            <View style={tw`flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-3`}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={tw`flex-1 ml-3 text-gray-800 font-medium`}
                placeholder="Cari Plat Nomor atau Merk..."
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row`}>
              <TouchableOpacity onPress={() => setSelectedStatus('Semua')} style={tw`px-4 py-2 rounded-full mr-2 border ${selectedStatus === 'Semua' ? 'bg-[#0055A5] border-[#0055A5]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${selectedStatus === 'Semua' ? 'text-white' : 'text-gray-500'}`}>Semua Kendaraan</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedStatus('Normal')} style={tw`px-4 py-2 rounded-full mr-2 border ${selectedStatus === 'Normal' ? 'bg-[#00A651] border-[#00A651]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${selectedStatus === 'Normal' ? 'text-white' : 'text-gray-500'}`}>Normal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedStatus('Isu')} style={tw`px-4 py-2 rounded-full mr-4 border ${selectedStatus === 'Isu' ? 'bg-[#ED1C24] border-[#ED1C24]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${selectedStatus === 'Isu' ? 'text-white' : 'text-gray-500'}`}>Isu (Perbaikan)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={tw`px-6 mt-4 mb-2 flex-row justify-between items-center`}>
            <Text style={tw`text-gray-500 font-bold uppercase tracking-widest text-xs`}>{filteredVehicles.length} Kendaraan Terdaftar</Text>
            {loading && <ActivityIndicator size="small" color="#0055A5" />}
          </View>

          <FlatList key={numCols} numColumns={numCols} columnWrapperStyle={isLargeScreen ? tw`justify-start gap-4` : undefined}
            style={tw`flex-1`}
            contentContainerStyle={tw`p-6 pb-30 w-full max-w-7xl mx-auto`}
            data={filteredVehicles}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            initialNumToRender={Platform.OS === 'web' ? 100 : 20}
            maxToRenderPerBatch={Platform.OS === 'web' ? 50 : 20}
            windowSize={Platform.OS === 'web' ? 30 : 10}
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              !loading && (
                <View style={tw`items-center mt-20`}>
                  <Ionicons name="car-sport-outline" size={60} color="#CBD5E1" />
                  <Text style={tw`text-center text-gray-400 font-bold mt-4 text-lg`}>Tidak ada kendaraan yang sesuai.</Text>
                </View>
              )
            }
          />
        </View>

        {/* Floating Action Button (Only for Admin on Mobile) */}
        {!isLargeScreen && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <TouchableOpacity
            style={tw`absolute bottom-6 right-6 bg-[#0055A5] w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-blue-500/50 z-40`}
            onPress={openAddModal}
          >
            <Feather name="plus" size={28} color="white" />
          </TouchableOpacity>
        )}

      
        </View>
      </SafeAreaView>

      {/* MANAGE VEHICLE MODAL (For ADMIN & PENGAWAS) */}
      {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'PENGAWAS') && (
        <Modal visible={manageModalVisible && !fullScreenBarcode} transparent={true} animationType="fade" onRequestClose={() => setManageModalVisible(false)}>
          <View style={tw`flex-1 justify-center items-center bg-black/60 p-4`}>
            {selectedVehicle && (
              user?.role === 'PENGAWAS' ? (
                <View style={tw`bg-white w-full max-w-md rounded-[35px] shadow-2xl overflow-hidden`}>
                  <LinearGradient colors={['#00A651', '#007A3B']} style={tw`px-6 pt-8 pb-10`}>
                    <View style={tw`flex-row justify-between items-start mb-2`}>
                      <View>
                        <Text style={tw`text-green-200 font-bold text-xs uppercase tracking-widest mb-1`}>Mode Pemantauan</Text>
                        <Text style={tw`text-white text-3xl font-black tracking-tight`}>{selectedVehicle.noPolisi}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setManageModalVisible(false)} style={tw`p-2 bg-white/20 rounded-full`}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>

                  <View style={tw`px-6 pt-6 pb-8 bg-white -mt-5 rounded-t-[25px]`}>
                    <View style={tw`flex-row justify-between mb-4`}>
                      <View style={tw`flex-1 mr-2 bg-gray-50 p-4 rounded-2xl border border-gray-100`}>
                        <Text style={tw`text-xs text-gray-400 uppercase font-bold mb-1`}>Merk / Tipe / Kapasitas</Text>
                        <Text style={tw`text-base font-black text-gray-800`}>{selectedVehicle.brand ? `${selectedVehicle.brand} • ` : ''}{selectedVehicle.jenisKendaraan || 'Mobil Tanki'}{selectedVehicle.kapasitas ? ` (${selectedVehicle.kapasitas} KL)` : ''}</Text>
                      </View>
                      <View style={tw`flex-1 ml-2 bg-gray-50 p-4 rounded-2xl border border-gray-100`}>
                        <Text style={tw`text-xs text-gray-400 uppercase font-bold mb-1`}>Status Saat Ini</Text>
                        <View style={tw`flex-row items-center mt-1`}>
                          <View style={tw`w-2 h-2 rounded-full mr-2 ${selectedVehicle.dynamicStatus === 'Isu' || selectedVehicle.status === 'Buruk' || selectedVehicle.status === 'Maintenance' || selectedVehicle.status === 'Isu' ? 'bg-red-500' : 'bg-green-500'}`} />
                          <Text style={tw`text-sm font-black ${selectedVehicle.dynamicStatus === 'Isu' || selectedVehicle.status === 'Buruk' || selectedVehicle.status === 'Maintenance' || selectedVehicle.status === 'Isu' ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedVehicle.dynamicStatus === 'Isu' || selectedVehicle.status === 'Buruk' || selectedVehicle.status === 'Maintenance' || selectedVehicle.status === 'Isu' ? 'Ada Isu' : 'Normal'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* BARCODE UNTUK PENGAWAS */}
                    <View style={tw`flex-row items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6`}>
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-xs text-gray-400 uppercase font-bold mb-1`}>Data Barcode</Text>
                        <Text style={tw`text-base font-black text-gray-800 mb-1`}>{selectedVehicle.barcode}</Text>
                        <Text style={tw`text-[10px] text-gray-500 font-bold`}>TAP GAMBAR UNTUK PERBESAR</Text>
                      </View>
                      <TouchableOpacity
                        style={tw`w-20 h-20 bg-white rounded-xl shadow-sm items-center justify-center p-1 border border-gray-200`}
                        onPress={() => setFullScreenBarcode(true)}
                      >
                        <Image
                          source={{ uri: `${API_URL}/barcodes/${selectedVehicle.barcode}.png` }}
                          style={tw`w-full h-full`}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={tw`w-full bg-amber-50 p-4 rounded-2xl border border-amber-200 flex-row justify-center items-center mb-3`}
                      onPress={() => handleForceReleaseShift(selectedVehicle)}
                    >
                      <Feather name="refresh-cw" size={18} color="#D97706" />
                      <Text style={tw`text-amber-800 font-bold ml-2 text-base`}>Tutup Paksa Shift (Force Release)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={tw`w-full bg-[#0055A5] p-5 rounded-2xl flex-row justify-center items-center shadow-lg shadow-blue-500/40`}
                      onPress={() => { setManageModalVisible(false); setReturnToManageModal(true); navigation.navigate('History', { noPolisi: selectedVehicle.noPolisi }); }}
                    >
                      <Feather name="file-text" size={20} color="white" />
                      <Text style={tw`text-white font-black text-lg ml-3 tracking-wide`}>Lihat Riwayat Inspeksi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={tw`bg-white w-full max-w-md rounded-[30px] p-6 shadow-2xl overflow-hidden`}>
                  <View style={tw`flex-row justify-between items-center mb-6 border-b border-gray-100 pb-4`}>
                    <View>
                      <Text style={tw`text-xl font-black text-gray-800`}>Detail Kendaraan</Text>
                      <Text style={tw`text-blue-600 font-bold`}>{selectedVehicle.noPolisi}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setManageModalVisible(false)} style={tw`p-2 bg-gray-100 rounded-full`}>
                      <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={tw`flex-row mb-6`}>
                    <View style={tw`flex-1 justify-center`}>
                      <Text style={tw`text-xs text-gray-500 uppercase font-bold mb-1`}>Merk / Tipe / Kapasitas</Text>
                      <Text style={tw`text-base font-black text-gray-800 mb-3`}>{selectedVehicle.brand ? `${selectedVehicle.brand} • ` : ''}{selectedVehicle.jenisKendaraan || 'Mobil Tanki'}{selectedVehicle.kapasitas ? ` (${selectedVehicle.kapasitas} KL)` : ''}</Text>

                      <Text style={tw`text-xs text-gray-500 uppercase font-bold mb-1`}>Status Truk</Text>
                      <Text style={tw`text-base font-black ${selectedVehicle.dynamicStatus === 'Isu' || selectedVehicle.status === 'Buruk' || selectedVehicle.status === 'Maintenance' || selectedVehicle.status === 'Isu' ? 'text-red-600' : 'text-green-600'} mb-3`}>
                        {selectedVehicle.dynamicStatus === 'Isu' || selectedVehicle.status === 'Buruk' || selectedVehicle.status === 'Maintenance' || selectedVehicle.status === 'Isu' ? 'Isu (Perlu Perbaikan)' : 'Normal (Siap Operasi)'}
                      </Text>

                      <Text style={tw`text-xs text-gray-500 uppercase font-bold mb-1`}>Data Barcode</Text>
                      <Text style={tw`text-base font-black text-gray-800`}>{selectedVehicle.barcode}</Text>
                    </View>

                    <TouchableOpacity
                      style={tw`w-32 h-32 bg-gray-100 rounded-xl items-center justify-center p-2`}
                      onPress={() => setFullScreenBarcode(true)}
                    >
                      <Image
                        source={{ uri: `${API_URL}/barcodes/${selectedVehicle.barcode}.png` }}
                        style={tw`w-full h-full`}
                        resizeMode="contain"
                      />
                      <Text style={tw`text-[8px] text-gray-400 mt-1 text-center font-bold`}>TAP UNTUK PERBESAR</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={tw`w-full bg-amber-50 p-3.5 rounded-xl border border-amber-200 flex-row justify-center items-center mb-3`}
                    onPress={() => handleForceReleaseShift(selectedVehicle)}
                  >
                    <Feather name="refresh-cw" size={16} color="#D97706" />
                    <Text style={tw`text-amber-800 font-bold ml-2 text-sm`}>Tutup Paksa Shift (Force Release)</Text>
                  </TouchableOpacity>

                  <View style={tw`flex-row justify-between`}>
                    <TouchableOpacity
                      style={tw`bg-green-50 p-4 rounded-xl items-center flex-1 mr-2 border border-green-200`}
                      onPress={() => { setManageModalVisible(false); setReturnToManageModal(true); navigation.navigate('History', { noPolisi: selectedVehicle.noPolisi }); }}
                    >
                      <Text style={tw`text-green-700 font-bold`}>Lihat Riwayat</Text>
                    </TouchableOpacity>

                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                      <TouchableOpacity style={tw`bg-blue-50 p-4 rounded-xl items-center flex-1 mx-1 border border-blue-200`} onPress={() => openEditModal(selectedVehicle)}>
                        <Text style={tw`text-blue-600 font-bold`}>Edit</Text>
                      </TouchableOpacity>
                    )}

                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                      <TouchableOpacity style={tw`bg-red-50 p-4 rounded-xl items-center flex-1 ml-2 border border-red-200`} onPress={() => handleDeleteVehicle(selectedVehicle)}>
                        <Text style={tw`text-red-600 font-bold`}>Hapus</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            )}
          </View>
        </Modal>
      )}

      {/* ADD / EDIT VEHICLE MODAL (ONLY FOR ADMIN) */}
      {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
        <Modal visible={addModalVisible} transparent={true} animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`flex-1 justify-center items-center bg-black/60 p-4`}>
            <View style={[tw`bg-white rounded-[30px] shadow-2xl w-full max-w-md`, { maxHeight: '90%' }]}>
              <ScrollView contentContainerStyle={tw`p-6`} showsVerticalScrollIndicator={false}>
                <View style={tw`flex-row justify-between items-center mb-6`}>
                  <Text style={tw`text-2xl font-black text-gray-800 flex-1 mr-3`}>{isEditMode ? 'Edit Kendaraan' : 'Tambah Kendaraan'}</Text>
                  <TouchableOpacity 
                    onPress={() => { setAddModalVisible(false); if (isEditMode) setManageModalVisible(true); }} 
                    style={tw`w-9 h-9 bg-gray-100 rounded-full items-center justify-center shrink-0`}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={tw`mb-4`}>
                  <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Nomor Polisi</Text>
                  <TextInput style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`} placeholder={vehicles.length > 0 ? `Misal: ${vehicles[0].noPolisi}` : "Misal: B 1234 XYZ"} value={newNoPolisi} onChangeText={setNewNoPolisi} autoCapitalize="characters" />
                </View>

                <View style={tw`mb-4`}>
                  <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Merek Kendaraan</Text>
                  <TextInput style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`} placeholder="Misal: Hino 500" value={newBrand} onChangeText={setNewBrand} />
                </View>

                <View style={tw`mb-4`}>
                  <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Tipe / Kapasitas (KL)</Text>
                  <TouchableOpacity
                    style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 flex-row justify-between items-center`}
                    onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                  >
                    <Text style={tw`text-black font-bold`}>{newType || "Pilih Tipe / Kapasitas"}</Text>
                    <Feather name={showTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                  
                  {showTypeDropdown && (
                    <View style={tw`bg-white mt-2 rounded-xl border border-slate-200 shadow-sm overflow-hidden`}>
                      {[{label: 'Mobil Tanki 8 KL', kapasitas: 8}, {label: 'Mobil Tanki 16 KL', kapasitas: 16}, {label: 'Mobil Tanki 24 KL', kapasitas: 24}].map((typeOption, index) => (
                        <TouchableOpacity
                          key={typeOption.label}
                          style={tw`p-4 ${index < 2 ? 'border-b border-slate-100' : ''} ${newType === typeOption.label ? 'bg-blue-50' : ''}`}
                          onPress={() => {
                            setNewType(typeOption.label);
                            setNewKapasitas(typeOption.kapasitas);
                            setShowTypeDropdown(false);
                          }}
                        >
                          <Text style={tw`font-bold ${newType === typeOption.label ? 'text-blue-600' : 'text-gray-700'}`}>{typeOption.label} ({typeOption.kapasitas} KL)</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={tw`mb-8`}>
                  {/* Barcode input removed as it is auto-generated from NoPolisi */}
                  <Text style={tw`text-[10px] text-gray-400 mt-1`}>*Barcode akan otomatis digenerate dari Nomor Polisi saat disimpan.</Text>
                </View>

                <TouchableOpacity style={tw`bg-[#0055A5] p-4 rounded-2xl items-center shadow-lg shadow-blue-500/40 mb-4`} onPress={handleSaveVehicle}>
                  <Text style={tw`text-white font-black text-lg tracking-wide`}>{isEditMode ? 'SIMPAN PERUBAHAN' : 'SIMPAN KENDARAAN'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      <ConfirmModal visible={confirmModalVisible} title="Hapus Kendaraan" message={vehicleToDelete ? `Yakin ingin menghapus ${vehicleToDelete.noPolisi}? Semua data barcode terkait juga akan dihapus.` : ''} onConfirm={confirmDelete} onCancel={handleCancelDelete} />

      {/* FORCE RELEASE CONFIRMATION MODAL */}
      <Modal visible={forceReleaseModalVisible} transparent={true} animationType="fade" onRequestClose={handleCancelForceRelease}>
        <View style={[
          tw`flex-1 justify-center items-center bg-black/60 px-6`,
          Platform.OS === 'web' ? { zIndex: 99999, elevation: 99999 } : {}
        ]}>
          <View style={tw`bg-white w-full max-w-sm rounded-[32px] p-7 items-center shadow-2xl border border-amber-100 relative overflow-hidden`}>
            {/* Background Decorative Accents */}
            <View style={tw`absolute -top-10 -right-10 w-32 h-32 bg-amber-50 rounded-full`} />
            <View style={tw`absolute -bottom-10 -left-10 w-32 h-32 bg-orange-50 rounded-full`} />
            <Image source={require('../../assets/logo.png')} style={[tw`absolute opacity-5`, { width: 220, height: 220, top: -40, right: -40 }]} resizeMode="contain" />

            <View style={tw`bg-amber-100 px-3.5 py-1 rounded-full mb-3 z-10`}>
              <Text style={tw`text-amber-800 font-black text-[10px] uppercase tracking-wider`}>FORCE RELEASE SHIFT</Text>
            </View>

            <View style={tw`w-20 h-20 bg-amber-50 rounded-full items-center justify-center mb-4 shadow-lg shadow-amber-200 border-2 border-amber-200 z-10`}>
              <Feather name="refresh-cw" size={32} color="#D97706" />
            </View>

            <Text style={tw`text-xl font-black text-gray-800 mb-2 tracking-tight text-center z-10`}>Konfirmasi Force Release</Text>
            <Text style={tw`text-center text-gray-500 font-medium mb-4 text-xs leading-5 z-10 px-2`}>
              Tutup paksa shift gantung untuk kendaraan <Text style={tw`font-bold text-gray-800`}>{vehicleToForceRelease?.noPolisi}</Text>? Status mobil akan diselesaikan dan siap untuk Mulai Pekerjaan baru.
            </Text>

            <View style={tw`w-full bg-amber-50/80 rounded-2xl p-3.5 border border-amber-200/70 mb-6 z-10`}>
              <View style={tw`flex-row justify-between items-center mb-1.5`}>
                <Text style={tw`text-xs text-amber-900/70 font-semibold`}>Kendaraan:</Text>
                <Text style={tw`text-xs text-amber-900 font-extrabold`}>{vehicleToForceRelease?.noPolisi}</Text>
              </View>
              <View style={tw`flex-row justify-between items-center`}>
                <Text style={tw`text-xs text-amber-900/70 font-semibold`}>Tindakan:</Text>
                <Text style={tw`text-xs text-amber-800 font-bold`}>Selesaikan Shift Secara Paksa</Text>
              </View>
            </View>

            <View style={tw`flex-row justify-between w-full z-10`}>
              <TouchableOpacity
                style={tw`flex-1 bg-gray-100 py-3.5 rounded-2xl items-center mr-2 border border-gray-200`}
                onPress={handleCancelForceRelease}
                disabled={isForceReleasing}
              >
                <Text style={tw`text-gray-700 font-bold text-sm`}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 bg-[#D97706] py-3.5 rounded-2xl items-center ml-2 shadow-lg shadow-amber-500/30 flex-row justify-center`}
                onPress={confirmForceRelease}
                disabled={isForceReleasing}
              >
                {isForceReleasing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={tw`text-white font-black text-sm tracking-wide`}>Ya, Tutup Shift</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={tw`flex-row items-center justify-center mt-4 z-10`}>
              <View style={tw`flex-row items-center mr-2`}>
                <View style={tw`w-1 h-3.5 rounded-full bg-[#ED1C24] mr-0.5`} />
                <View style={tw`w-1 h-3.5 rounded-full bg-[#2ECC71] mr-0.5`} />
                <View style={tw`w-1 h-3.5 rounded-full bg-[#0055A5]`} />
              </View>
              <Text style={tw`text-[10px] font-bold text-gray-400 uppercase tracking-widest`}>DigiHandover</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS NOTIFICATION MODAL */}
      <Modal visible={successModalVisible} transparent={true} animationType="fade">
        <View style={[
          tw`flex-1 justify-center items-center bg-black/40 px-6`,
          Platform.OS === 'web' ? { zIndex: 9999999, elevation: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } : {}
        ]}>
          <View style={tw`bg-white w-full max-w-sm rounded-[35px] p-8 items-center shadow-2xl border border-green-100 relative overflow-hidden`}>
            <View style={tw`absolute -top-10 -right-10 w-32 h-32 bg-green-50 rounded-full`} />
            <View style={tw`absolute -bottom-10 -left-10 w-32 h-32 bg-blue-50 rounded-full`} />
            <Image source={require('../../assets/logo.png')} style={[tw`absolute opacity-5`, { width: 250, height: 250, top: -50, right: -50 }]} resizeMode="contain" />

            <View style={tw`w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-5 shadow-lg shadow-green-500/30 z-10 border-4 border-white`}>
              <Feather name="check-circle" size={40} color="#00A651" />
            </View>

            <Text style={tw`text-2xl font-black text-gray-800 mb-2 tracking-tight z-10 text-center`}>Sukses!</Text>
            <Text style={tw`text-center text-gray-500 font-medium mb-6 z-10 px-4`}>{successMessage}</Text>

            <TouchableOpacity style={tw`w-full bg-[#00A651] py-3 rounded-xl items-center shadow-md mb-4 z-10`} onPress={() => setSuccessModalVisible(false)}>
              <Text style={tw`text-white font-bold`}>OK</Text>
            </TouchableOpacity>

            <View style={tw`flex-row items-center justify-center mt-2 z-10`}>
              <View style={tw`flex-row items-center mr-2`}>
                <View style={tw`w-1 h-4 rounded-full bg-[#ED1C24] mr-0.5`} />
                <View style={tw`w-1 h-4 rounded-full bg-[#2ECC71] mr-0.5`} />
                <View style={tw`w-1 h-4 rounded-full bg-[#0055A5]`} />
              </View>
              <Text style={tw`text-xs font-bold text-gray-400 uppercase tracking-widest`}>DigiHandover</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* WARNING NOTIFICATION MODAL */}
      <Modal visible={warningModalVisible} transparent={true} animationType="fade">
        <View style={[
          tw`flex-1 justify-center items-center bg-black/40 px-6`,
          Platform.OS === 'web' ? { zIndex: 9999999, elevation: 9999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } : {}
        ]}>
          <View style={tw`bg-white w-full max-w-sm rounded-[35px] p-8 items-center shadow-2xl border border-red-100 relative overflow-hidden`}>
            {/* Background Accent */}
            <View style={tw`absolute -top-10 -right-10 w-32 h-32 bg-red-50 rounded-full`} />
            <View style={tw`absolute -bottom-10 -left-10 w-32 h-32 bg-orange-50 rounded-full`} />

            <Image source={require('../../assets/logo.png')} style={[tw`absolute opacity-5`, { width: 250, height: 250, bottom: -50, left: -50 }]} resizeMode="contain" />

            <View style={tw`w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-5 shadow-lg shadow-red-500/30 z-10 border-4 border-white`}>
              <Feather name="alert-triangle" size={40} color="#ED1C24" />
            </View>

            <Text style={tw`text-2xl font-black text-gray-800 mb-2 tracking-tight z-10 text-center`}>{warningTitle}</Text>
            <Text style={tw`text-center text-gray-500 font-medium mb-8 z-10 px-4`}>
              {warningMessage}
            </Text>

            <TouchableOpacity
              style={tw`bg-[#ED1C24] px-8 py-4 rounded-2xl shadow-lg shadow-red-500/30 z-10 w-full items-center`}
              onPress={() => setWarningModalVisible(false)}
            >
              <Text style={tw`text-white text-sm font-black tracking-widest uppercase`}>OK, MENGERTI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LOGOUT CONFIRMATION MODAL */}
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

      {/* FULL SCREEN BARCODE MODAL */}
      {fullScreenBarcode && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setFullScreenBarcode(false)}>
          <View style={[tw`flex-1 bg-black/90 justify-center items-center`, Platform.OS === 'web' ? { zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } : {}]}>
            <TouchableOpacity 
              style={tw`absolute inset-0 w-full h-full`} 
              activeOpacity={1} 
              onPress={() => setFullScreenBarcode(false)} 
            />
            {selectedVehicle && (
              <View style={tw`items-center z-10 w-full max-w-sm px-6`} pointerEvents="box-none">
                <View style={tw`w-full flex-row justify-end mb-4`}>
                  <TouchableOpacity onPress={() => setFullScreenBarcode(false)} style={tw`p-3 bg-white/20 rounded-full`}>
                    <Ionicons name="close" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={tw`text-white text-3xl font-black mb-6 text-center tracking-tight`}>{selectedVehicle.noPolisi}</Text>
                <View style={tw`w-72 h-72 bg-white rounded-3xl p-4 shadow-2xl items-center justify-center`}>
                  <Image
                    source={{ uri: `${API_URL}/barcodes/${selectedVehicle.barcode}.png` }}
                    style={tw`w-full h-full`}
                    resizeMode="contain"
                  />
                </View>

                <TouchableOpacity style={tw`bg-[#0055A5] mt-6 px-8 py-4 rounded-full flex-row items-center shadow-lg shadow-blue-500/50 w-full justify-center`} onPress={handleDownloadBarcode}>
                  <Feather name="download" size={20} color="white" />
                  <Text style={tw`text-white font-bold text-base ml-3 tracking-wide`}>Simpan Poster Barcode</Text>
                </TouchableOpacity>

                <Text style={tw`text-gray-300 text-xs mt-4 text-center px-4 leading-relaxed`}>Poster resmi Pertamina beserta QR code dan plat nomor akan diunduh dalam kualitas HD (siap cetak untuk truk).</Text>
              </View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}