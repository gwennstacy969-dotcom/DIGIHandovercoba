import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import Toast from 'react-native-toast-message';
import React, { useState, useEffect, useMemo } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { API_URL } from '../../config';
import TextLogo from '../../components/TextLogo';
import { View, Text, FlatList, TouchableOpacity, TextInput, Platform, Modal, Animated, Image, Easing, Alert, ScrollView, KeyboardAvoidingView } from 'react-native';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

const API_BASE = { toString: () => `${API_URL}/api` }; // Sesuaikan IP backend

const { Dimensions } = require('react-native');
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';
import { handleLogoutAndReset } from '../../utils/authHelper';

export default function WorkerListScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
  const [workers, setWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const handleLogout = () => setIsLogoutVisible(true);
  const handleCancelLogout = () => setIsLogoutVisible(false);
  const confirmLogout = async () => {
    setIsLogoutVisible(false);
    await handleLogoutAndReset(navigation);
  };
  const [loading, setLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  const isLargeScreen = Platform.OS === 'web' && screenWidth > 768;
  const numCols = isLargeScreen ? 3 : 1;

  // Modal CRUD Worker
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('AMT');
  const [jabatan, setJabatan] = useState('AMT I');

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [notificationModal, setNotificationModal] = useState({ visible: false, title: '', message: '', type: 'success' });
  const showNotification = (title, message, type = 'success') => {
    setNotificationModal({ visible: true, title, message, type });
  };

  const [filterJabatan, setFilterJabatan] = useState('Semua');
  const [sortBy, setSortBy] = useState('Abjad');

  const orb1TranslateY = React.useRef(new Animated.Value(0)).current;
  const orb2TranslateY = React.useRef(new Animated.Value(0)).current;
  const orb3TranslateY = React.useRef(new Animated.Value(0)).current;

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

    const loadUserAndFetch = async () => {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
      fetchWorkers();
    };
    loadUserAndFetch();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/workers`, { headers });
      setWorkers(res.data);
    } catch (error) {
      console.log('Error fetching workers:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = useMemo(() => { return workers.filter((item) => { const searchLower = (searchQuery || '').toLowerCase().trim(); const matchesSearch = (item.name || '').toLowerCase().includes(searchLower) || (item.username || '').toLowerCase().includes(searchLower); let matchesJabatan = true; if (filterJabatan !== 'Semua') { matchesJabatan = item.jabatan === filterJabatan; } return matchesSearch && matchesJabatan; }).sort((a, b) => { if (sortBy === 'Abjad') { return (a.name || '').localeCompare(b.name || ''); } else if (sortBy === 'NIP') { return (a.username || '').localeCompare(b.username || ''); } return 0; }); }, [workers, searchQuery, filterJabatan, sortBy]);

  const openAddModal = () => {
    setSelectedWorker(null);
    setName('');
    setUsername('');
    setPassword('');
    setJabatan('AMT I');
    setRole('AMT');
    setManageModalVisible(true);
  };

  const closeManageModal = () => {
    setManageModalVisible(false);
    setSelectedWorker(null);
    setName('');
    setUsername('');
    setPassword('');
    setJabatan('');
  };

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: manageModalVisible, close: closeManageModal },
      { isOpen: confirmModalVisible, close: () => setConfirmModalVisible(false) },
      { isOpen: isLogoutVisible, close: handleCancelLogout },
      { isOpen: notificationModal.visible, close: () => setNotificationModal(prev => ({ ...prev, visible: false })) }
    ]
  });

  const openEditModal = (worker) => {
    setSelectedWorker(worker);
    setName(worker.name);
    setUsername(worker.username);
    setPassword(''); // biarkan kosong jika tidak diubah
    setJabatan(worker.jabatan || 'AMT I');
    setRole(worker.role || 'AMT');
    setManageModalVisible(true);
  };

  const handleSaveWorker = async () => {
    if (!name.trim() || !username.trim() || (!selectedWorker && !password.trim())) {
      showNotification('Data Tidak Lengkap', 'Nama, Username, dan Password (untuk pekerja baru) wajib diisi.', 'info');
      return;
    }

    try {
      const data = {
        name: name.trim(),
        username: username.trim(),
        role: role || 'AMT',
        jabatan: (jabatan || 'AMT I').trim()
      };
      if (password && password.trim() !== '') {
        data.password = password.trim();
      }

      if (selectedWorker) {
        // Update
        await axios.put(`${API_BASE}/workers/${selectedWorker.id}`, data);
        showNotification('Berhasil', `Data pekerja '${name}' berhasil diperbarui!`, 'success');
      } else {
        // Create
        await axios.post(`${API_BASE}/workers`, data);
        showNotification('Berhasil', `Pekerja baru '${name}' berhasil ditambahkan!`, 'success');
        setSearchQuery('');
      }
      closeManageModal();
      fetchWorkers();
    } catch (error) {
      showNotification('Gagal Menyimpan', error.response?.data?.error || error.message, 'error');
    }
  };

  const handleDeleteWorker = () => {
    if (!selectedWorker) return;
    setWorkerToDelete(selectedWorker);
    setManageModalVisible(false);
    setConfirmModalVisible(true);
  };

  const confirmDelete = async () => {
    if(!workerToDelete) return;
    try {
      await axios.delete(`${API_BASE}/workers/${workerToDelete.id}`);
      setConfirmModalVisible(false);
      setManageModalVisible(false);
      fetchWorkers();
      showNotification('Berhasil!', 'Data pekerja berhasil dihapus.', 'success');
    } catch (error) {
      console.error(error);
      setConfirmModalVisible(false);
      showNotification('Error', 'Gagal menghapus pekerja', 'error');
    }
  };

  const renderItem = ({ item }) => {
    return (
      <View style={[
        tw`bg-white p-5 rounded-2xl mb-4 shadow-sm border border-gray-100 flex-row justify-between items-center`,
        isLargeScreen ? { width: 'calc(33.333% - 11px)' } : tw`w-full`
      ]}>
        <View style={tw`flex-row items-center flex-1`}>
          <View style={tw`w-12 h-12 rounded-full items-center justify-center mr-3 bg-blue-100`}>
            <Feather name="user" size={24} color="#0055A5" />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-lg font-black text-gray-800`} numberOfLines={1}>{item.name}</Text>
            <Text style={tw`text-sm font-bold text-gray-500`}>@{item.username} • {item.jabatan || item.role}</Text>
          </View>
        </View>

        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <TouchableOpacity onPress={() => openEditModal(item)} style={tw`p-2 bg-gray-50 rounded-full border border-gray-200`}>
            <Feather name="edit-2" size={18} color="#4B5563" />
          </TouchableOpacity>
        )}
      </View>
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
        {isLargeScreen && (
          <WebSidebar
            user={user}
            activeMenu={'WorkerList'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>

        <WebNavbar
          user={user}
          title="Daftar Pekerja"
          subtitle="Kelola Akun Awak Mobil Tangki (AMT)"
          navigation={navigation}
          showBack={true}
          rightAction={
            isLargeScreen && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') ? (
              <TouchableOpacity
                onPress={openAddModal}
                style={tw`flex-row items-center bg-[#0055A5] px-4 py-2.5 rounded-2xl shadow-md`}
              >
                <Feather name="user-plus" size={18} color="white" />
                <Text style={tw`text-white font-bold text-sm ml-2`}>Tambah Pekerja</Text>
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
                placeholder="Cari Nama atau Username..."
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
              <TouchableOpacity onPress={() => setSortBy('Abjad')} style={tw`px-4 py-2 rounded-full mr-2 border ${sortBy === 'Abjad' ? 'bg-[#0055A5] border-[#0055A5]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${sortBy === 'Abjad' ? 'text-white' : 'text-gray-500'}`}>Urut Abjad</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSortBy('NIP')} style={tw`px-4 py-2 rounded-full mr-2 border ${sortBy === 'NIP' ? 'bg-[#0055A5] border-[#0055A5]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${sortBy === 'NIP' ? 'text-white' : 'text-gray-500'}`}>Urut NIP</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setFilterJabatan('Semua')} style={tw`px-4 py-2 rounded-full mr-2 border ${filterJabatan === 'Semua' ? 'bg-[#00A651] border-[#00A651]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${filterJabatan === 'Semua' ? 'text-white' : 'text-gray-500'}`}>Semua AMT</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterJabatan('AMT I')} style={tw`px-4 py-2 rounded-full mr-2 border ${filterJabatan === 'AMT I' ? 'bg-[#00A651] border-[#00A651]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${filterJabatan === 'AMT I' ? 'text-white' : 'text-gray-500'}`}>AMT I</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterJabatan('AMT II')} style={tw`px-4 py-2 rounded-full mr-4 border ${filterJabatan === 'AMT II' ? 'bg-[#00A651] border-[#00A651]' : 'bg-white border-gray-200'}`}>
                <Text style={tw`text-xs font-bold ${filterJabatan === 'AMT II' ? 'text-white' : 'text-gray-500'}`}>AMT II</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={tw`px-6 mt-2 mb-2`}>
            <Text style={tw`text-gray-500 font-bold uppercase tracking-widest text-xs`}>{filteredWorkers.length} Pekerja Terdaftar</Text>
          </View>

          <FlatList key={numCols} numColumns={numCols} columnWrapperStyle={isLargeScreen ? tw`justify-start gap-4` : undefined}
            style={tw`flex-1`}
            contentContainerStyle={tw`p-6 pb-30 w-full max-w-7xl mx-auto`}
            data={filteredWorkers}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            initialNumToRender={Platform.OS === 'web' ? 350 : 20}
            maxToRenderPerBatch={Platform.OS === 'web' ? 100 : 20}
            windowSize={Platform.OS === 'web' ? 50 : 10}
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View style={tw`items-center mt-20`}>
                <Feather name="users" size={60} color="#CBD5E1" />
                <Text style={tw`text-center text-gray-400 font-bold mt-4 text-lg`}>
                  {loading ? 'Memuat data pekerja...' : 'Tidak ada data pekerja.'}
                </Text>
              </View>
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

      {/* MANAGE WORKER MODAL (ADD / EDIT) */}
      <Modal visible={manageModalVisible} transparent={true} animationType="fade" onRequestClose={closeManageModal}>
        <View style={tw`flex-1 justify-center items-center bg-black/60 p-4`}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`w-full max-w-xl`}>
            <View style={tw`bg-white rounded-[30px] p-6 shadow-2xl w-full mx-auto max-h-[90%]`}>
              <View style={tw`flex-row justify-between items-start mb-6`}>
                <View style={tw`flex-1 mr-3`}>
                  <Text style={tw`text-2xl font-black text-gray-800`}>{selectedWorker ? 'Ubah Data Pekerja' : 'Tambah Pekerja Baru'}</Text>
                  <Text style={tw`text-xs font-bold text-gray-500 mt-1`}>Akses operasional checklist kendaraan dan serah terima shift</Text>
                </View>
                <TouchableOpacity 
                  onPress={closeManageModal} 
                  style={tw`w-9 h-9 bg-gray-100 rounded-full items-center justify-center shrink-0 mt-0.5`}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Nama Lengkap</Text>
                <TextInput
                  style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`}
                  placeholder="Masukkan nama lengkap"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  autoComplete="off"
                />
              </View>

              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Username (Untuk Login)</Text>
                <TextInput
                  style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`}
                  placeholder="Masukkan username / NIP (tanpa spasi)"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                />
              </View>

              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Hak Akses Sistem</Text>
                <View style={tw`p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex-row items-center`}>
                  <View style={tw`w-10 h-10 bg-blue-100 rounded-xl items-center justify-center mr-3`}>
                    <Feather name="truck" size={20} color="#0055A5" />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-extrabold text-[#0055A5] text-sm`}>AWAK MOBIL TANGKI (AMT)</Text>
                    <Text style={tw`text-[11px] text-blue-800 mt-0.5`}>Akses pengisian checklist kendaraan dan serah terima shift armada.</Text>
                  </View>
                </View>
              </View>

              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Jabatan / Posisi AMT</Text>
                <View style={tw`flex-row justify-between gap-3`}>
                  <TouchableOpacity
                    style={tw`flex-1 p-3.5 rounded-xl border ${jabatan === 'AMT I' ? 'border-[#0055A5] bg-blue-50' : 'border-slate-200 bg-slate-50'} items-center flex-row justify-center`}
                    onPress={() => setJabatan('AMT I')}
                  >
                    <View style={tw`w-4 h-4 rounded-full mr-2 items-center justify-center border ${jabatan === 'AMT I' ? 'border-[#0055A5]' : 'border-slate-400'}`}>
                      {jabatan === 'AMT I' && <View style={tw`w-2 h-2 rounded-full bg-[#0055A5]`} />}
                    </View>
                    <Text style={tw`font-extrabold ${jabatan === 'AMT I' ? 'text-[#0055A5]' : 'text-gray-600'}`}>AMT I (Supir)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`flex-1 p-3.5 rounded-xl border ${jabatan === 'AMT II' ? 'border-[#0055A5] bg-blue-50' : 'border-slate-200 bg-slate-50'} items-center flex-row justify-center`}
                    onPress={() => setJabatan('AMT II')}
                  >
                    <View style={tw`w-4 h-4 rounded-full mr-2 items-center justify-center border ${jabatan === 'AMT II' ? 'border-[#0055A5]' : 'border-slate-400'}`}>
                      {jabatan === 'AMT II' && <View style={tw`w-2 h-2 rounded-full bg-[#0055A5]`} />}
                    </View>
                    <Text style={tw`font-extrabold ${jabatan === 'AMT II' ? 'text-[#0055A5]' : 'text-gray-600'}`}>AMT II (Kernet)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={tw`mb-6`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>
                  Password {selectedWorker ? '(Kosongkan jika tidak ingin diubah)' : '(Wajib)'}
                </Text>
                <TextInput
                  style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`}
                  placeholder={selectedWorker ? "Ketik sandi baru untuk mengganti" : "Ketik sandi akun baru"}
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              </View>

              <View style={tw`flex-row justify-between w-full mb-6`}>
                {selectedWorker ? (
                  <>
                    <TouchableOpacity
                      style={tw`flex-1 bg-red-100 p-4 rounded-xl mr-2 items-center`}
                      onPress={handleDeleteWorker}
                    >
                      <Text style={tw`text-red-700 font-bold`}>Hapus Pekerja</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={tw`flex-1 bg-[#0055A5] p-4 rounded-xl ml-2 items-center shadow-lg shadow-blue-500/40`}
                      onPress={handleSaveWorker}
                    >
                      <Text style={tw`text-white font-bold`}>Simpan Perubahan</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={tw`flex-1 bg-[#0055A5] p-4 rounded-xl items-center shadow-lg shadow-blue-500/40`}
                    onPress={handleSaveWorker}
                  >
                    <Text style={tw`text-white font-black text-lg tracking-wide`}>SIMPAN PEKERJA BARU</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    
      <ConfirmModal visible={confirmModalVisible} title="Konfirmasi Hapus" message={workerToDelete ? `Apakah Anda yakin ingin menghapus ${workerToDelete.name}?` : ''} onConfirm={confirmDelete} onCancel={() => setConfirmModalVisible(false)} />

      {/* Modal Kustom Notifikasi */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={notificationModal.visible}
        onRequestClose={() => setNotificationModal({ ...notificationModal, visible: false })}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/50 px-4`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[30px] p-8 items-center shadow-2xl`}>
            <View style={tw`${notificationModal.type === 'success' ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-full mb-4`}>
              <Ionicons name={notificationModal.type === 'success' ? 'checkmark-circle' : notificationModal.type === 'info' ? 'information-circle' : 'close-circle'} size={40} color={notificationModal.type === 'success' ? '#10B981' : notificationModal.type === 'info' ? '#3B82F6' : '#EF4444'} />
            </View>
            <Text style={tw`text-2xl font-black text-gray-800 mb-2`}>{notificationModal.title}</Text>
            <Text style={tw`text-gray-500 text-center text-base mb-6 leading-relaxed`}>
              {notificationModal.message}
            </Text>
            <TouchableOpacity
              style={tw`w-full ${notificationModal.type === 'success' ? 'bg-[#0055A5]' : notificationModal.type === 'info' ? 'bg-[#3B82F6]' : 'bg-[#ED1C24]'} py-4 rounded-2xl items-center shadow-md`}
              onPress={() => setNotificationModal({ ...notificationModal, visible: false })}
            >
              <Text style={tw`text-white font-bold`}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}
