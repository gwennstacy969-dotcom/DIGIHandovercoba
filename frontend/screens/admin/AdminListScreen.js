import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { View, Text, FlatList, TouchableOpacity, TextInput, Platform, Modal, Animated, Easing, ScrollView, Dimensions, KeyboardAvoidingView } from 'react-native';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};
const API_BASE = { toString: () => `${API_URL}/api` };

import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';
import { handleLogoutAndReset } from '../../utils/authHelper';

export default function AdminListScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN', 'ADMIN']);
  const [admins, setAdmins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  // Logout state
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const handleLogout = () => setIsLogoutVisible(true);
  const confirmLogout = async () => {
    setIsLogoutVisible(false);
    await handleLogoutAndReset(navigation);
  };

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  const isLargeScreen = Platform.OS === 'web' && screenWidth > 768;
  const numCols = isLargeScreen ? 3 : 1;

  // Modal CRUD Admin
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [jabatan, setJabatan] = useState('');
  const [filterRole, setFilterRole] = useState('Semua');
  const [sortBy, setSortBy] = useState('Nama');

  // Custom Notification Modal
  const [notificationModal, setNotificationModal] = useState({ visible: false, title: '', message: '', type: 'info' });
  const showNotification = (title, message, type = 'info') => {
    setNotificationModal({ visible: true, title, message, type });
  };

  // Background Animation Orbs
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
      fetchAdmins();
    };
    loadUserAndFetch();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/admins`, { headers });
      setAdmins(res.data);
    } catch (error) {
      console.log('Error fetching admins:', error.message);
      showNotification('Gagal Memuat Data', error.response?.data?.error || 'Tidak dapat mengambil daftar admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = admins.filter((item) => {
    const searchLower = searchQuery.toLowerCase().trim();
    return item.name.toLowerCase().includes(searchLower) ||
           item.username.toLowerCase().includes(searchLower) ||
           (item.jabatan && item.jabatan.toLowerCase().includes(searchLower));
  }).sort((a, b) => {
    if (sortBy === 'Nama') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (sortBy === 'Username') {
      return (a.username || '').localeCompare(b.username || '');
    }
    return 0;
  });

  const openAddModal = () => {
    setSelectedAdmin(null);
    setName('');
    setUsername('');
    setPassword('');
    setRole('ADMIN');
    setJabatan('Administrator Distribusi');
    setManageModalVisible(true);
  };

  const closeManageModal = () => {
    setManageModalVisible(false);
    setSelectedAdmin(null);
    setName('');
    setUsername('');
    setPassword('');
  };

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: manageModalVisible, close: closeManageModal },
      { isOpen: confirmModalVisible, close: () => setConfirmModalVisible(false) },
      { isOpen: isLogoutVisible, close: () => setIsLogoutVisible(false) },
      { isOpen: notificationModal.visible, close: () => setNotificationModal(prev => ({ ...prev, visible: false })) }
    ]
  });

  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setName(admin.name);
    setUsername(admin.username);
    setPassword('');
    setRole(admin.role);
    setJabatan(admin.jabatan || '');
    setManageModalVisible(true);
  };

  const handleSaveAdmin = async () => {
    if (!name.trim() || !username.trim() || (!selectedAdmin && !password.trim())) {
      showNotification('Data Tidak Lengkap', 'Nama, Username, dan Password (untuk admin baru) wajib diisi.', 'error');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = {
        name: name.trim(),
        username: username.trim(),
        role,
        jabatan: jabatan.trim()
      };
      if (password.trim() !== '') {
        payload.password = password.trim();
      }

      if (selectedAdmin) {
        await axios.put(`${API_BASE}/admins/${selectedAdmin.id}`, payload, { headers });
        showNotification('Berhasil', `Data admin '${name}' berhasil diperbarui.`, 'success');
      } else {
        await axios.post(`${API_BASE}/admins`, payload, { headers });
        showNotification('Berhasil', `Admin baru '${name}' berhasil ditambahkan.`, 'success');
      }

      setManageModalVisible(false);
      fetchAdmins();
    } catch (error) {
      showNotification('Gagal Menyimpan', error.response?.data?.error || error.message, 'error');
    }
  };

  const handleDeleteAdmin = () => {
    if (!selectedAdmin) return;
    if (user && user.id === selectedAdmin.id) {
      showNotification('Aksi Ditolak', 'Anda tidak dapat menghapus akun Anda sendiri yang sedang digunakan saat ini.', 'error');
      return;
    }
    setAdminToDelete(selectedAdmin);
    setManageModalVisible(false);
    setConfirmModalVisible(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_BASE}/admins/${adminToDelete.id}`, { headers });
      showNotification('Berhasil', `Akun admin '${adminToDelete.name}' berhasil dihapus.`, 'success');
      setConfirmModalVisible(false);
      fetchAdmins();
    } catch (error) {
      showNotification('Gagal Menghapus', error.response?.data?.error || error.message, 'error');
      setConfirmModalVisible(false);
    }
  };

  const renderItem = ({ item }) => {
    const isSelf = user?.id === item.id;

    return (
      <View style={[
        tw`bg-white p-5 rounded-2xl mb-4 shadow-sm border border-gray-100 flex-row justify-between items-center`,
        isLargeScreen ? { width: 'calc(33.333% - 11px)' } : tw`w-full`
      ]}>
        <View style={tw`flex-row items-center flex-1 pr-3`}>
          <View style={tw`w-12 h-12 rounded-full items-center justify-center mr-3 bg-blue-100`}>
            <Feather name="user-check" size={24} color="#0055A5" />
          </View>
          <View style={tw`flex-1`}>
            <View style={tw`flex-row items-center flex-wrap gap-1.5 mb-0.5`}>
              <Text style={tw`text-lg font-black text-gray-800`} numberOfLines={1}>{item.name}</Text>
              {isSelf && (
                <View style={tw`bg-green-100 px-2 py-0.5 rounded-full`}>
                  <Text style={tw`text-[10px] font-bold text-green-700`}>Akun Anda</Text>
                </View>
              )}
            </View>
            <Text style={tw`text-xs font-bold text-gray-500 mb-1.5`}>@{item.username} • {item.jabatan || 'Administrator'}</Text>
            <View style={tw`flex-row items-center`}>
              <View style={tw`px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200`}>
                <Text style={tw`text-[11px] font-extrabold text-blue-700`}>
                  ADMIN (AKSES PENUH)
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={tw`p-2.5 bg-gray-50 rounded-full border border-gray-200 hover:bg-gray-100`}
        >
          <Feather name="edit-2" size={18} color="#4B5563" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-[#F4F7FA]`}>
      {/* Background Decorative Ambient Orbs */}
      <Animated.View style={[tw`absolute -top-20 -left-10 w-[35rem] h-[35rem] rounded-full opacity-15`, { transform: [{ translateY: orb1TranslateY }] }]}>
        <LinearGradient colors={['#0055A5', '#003366']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -top-20 -right-20 w-[25rem] h-[25rem] rounded-full opacity-15`, { transform: [{ translateY: orb3TranslateY }] }]}>
        <LinearGradient colors={['#F59E0B', '#B45309']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -bottom-40 -right-10 w-[30rem] h-[30rem] rounded-full opacity-15`, { transform: [{ translateY: orb2TranslateY }] }]}>
        <LinearGradient colors={['#ED1C24', '#B30000']} style={tw`flex-1 rounded-full`} />
      </Animated.View>

      <SafeAreaView style={tw`flex-1 ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
        {isLargeScreen && (
          <WebSidebar
            user={user}
            activeMenu={'AdminList'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
          {/* Header Card */}
          <WebNavbar
            user={user}
            title="Daftar Administrator"
            subtitle="Kelola Akun Admin & Hak Akses Sistem"
            navigation={navigation}
            showBack={true}
            rightAction={
              isLargeScreen ? (
                <TouchableOpacity
                  onPress={openAddModal}
                  style={tw`flex-row items-center bg-[#0055A5] px-4 py-2.5 rounded-2xl shadow-md`}
                >
                  <Feather name="user-plus" size={18} color="white" />
                  <Text style={tw`text-white font-bold text-sm ml-2`}>Tambah Admin</Text>
                </TouchableOpacity>
              ) : null
            }
          />

          {/* Search & Filter Bar */}
          <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { minHeight: 0, overflow: 'hidden' } : {}]}>
            <View style={tw`px-6 pt-2`}>
              <View style={tw`flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-3`}>
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                  style={tw`flex-1 ml-3 text-gray-800 font-medium`}
                  placeholder="Cari Nama, Username, atau Jabatan..."
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
            </View>

            <View style={tw`px-6 mt-1 mb-2`}>
              <Text style={tw`text-gray-500 font-bold uppercase tracking-widest text-xs`}>
                {filteredAdmins.length} Administrator Terdaftar
              </Text>
            </View>

            <FlatList
              key={numCols}
              numColumns={numCols}
              columnWrapperStyle={isLargeScreen ? tw`justify-start gap-4` : undefined}
              style={tw`flex-1`}
              contentContainerStyle={tw`p-6 pb-30 w-full max-w-7xl mx-auto`}
              data={filteredAdmins}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <View style={tw`items-center mt-20`}>
                  <Feather name="shield" size={60} color="#CBD5E1" />
                  <Text style={tw`text-center text-gray-400 font-bold mt-4 text-lg`}>
                    {loading ? 'Memuat data administrator...' : 'Tidak ada data administrator.'}
                  </Text>
                </View>
              }
            />
          </View>

          {/* Floating Action Button (Only on Mobile) */}
          {!isLargeScreen && (
            <TouchableOpacity
              style={tw`absolute bottom-6 right-6 bg-[#0055A5] w-16 h-16 rounded-full items-center justify-center shadow-lg shadow-blue-500/50 z-40`}
              onPress={openAddModal}
            >
              <Feather name="plus" size={28} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* MANAGE ADMIN MODAL (ADD / EDIT) */}
      <Modal visible={manageModalVisible} transparent={true} animationType="fade" onRequestClose={closeManageModal}>
        <View style={tw`flex-1 justify-center items-center bg-black/60 p-4`}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`w-full max-w-xl`}>
            <View style={tw`bg-white rounded-[30px] p-6 shadow-2xl w-full mx-auto max-h-[90%]`}>
              <View style={tw`flex-row justify-between items-start mb-6`}>
                <View style={tw`flex-1 mr-3`}>
                  <Text style={tw`text-2xl font-black text-gray-800`}>{selectedAdmin ? 'Ubah Data Admin' : 'Tambah Admin Baru'}</Text>
                  <Text style={tw`text-xs font-bold text-gray-500 mt-1`}>Akses pengawasan dan konfigurasi sistem</Text>
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
                  placeholder="Masukkan username (tanpa spasi)"
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
                    <Feather name="shield" size={20} color="#0055A5" />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-extrabold text-[#0055A5] text-sm`}>ADMINISTRATOR</Text>
                    <Text style={tw`text-[11px] text-blue-800 mt-0.5`}>Akses penuh ke seluruh modul, armada, dan manajemen sistem.</Text>
                  </View>
                </View>
              </View>

              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>Jabatan / Divisi</Text>
                <TextInput
                  style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`}
                  placeholder="Contoh: Admin Distribusi / IT Terminal"
                  placeholderTextColor="#9CA3AF"
                  value={jabatan}
                  onChangeText={setJabatan}
                  autoComplete="off"
                />
              </View>

              <View style={tw`mb-6`}>
                <Text style={tw`text-xs font-bold text-gray-500 uppercase mb-2`}>
                  Password {selectedAdmin ? '(Kosongkan jika tidak ingin diubah)' : '(Wajib)'}
                </Text>
                <TextInput
                  style={tw`bg-slate-50 p-4 rounded-xl border border-slate-200 text-black font-bold`}
                  placeholder={selectedAdmin ? "Ketik sandi baru untuk mengganti" : "Ketik sandi akun baru"}
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              </View>

              <View style={tw`flex-row justify-between w-full mb-6`}>
                {selectedAdmin ? (
                  <>
                    <TouchableOpacity
                      style={tw`flex-1 bg-red-100 p-4 rounded-xl mr-2 items-center`}
                      onPress={handleDeleteAdmin}
                    >
                      <Text style={tw`text-red-700 font-bold`}>Hapus Admin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={tw`flex-1 bg-[#0055A5] p-4 rounded-xl ml-2 items-center shadow-lg shadow-blue-500/40`}
                      onPress={handleSaveAdmin}
                    >
                      <Text style={tw`text-white font-bold`}>Simpan Perubahan</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={tw`flex-1 bg-[#0055A5] p-4 rounded-xl items-center shadow-lg shadow-blue-500/40`}
                    onPress={handleSaveAdmin}
                  >
                    <Text style={tw`text-white font-black text-lg tracking-wide`}>SIMPAN ADMIN BARU</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL KONFIRMASI HAPUS ADMIN */}
      <Modal visible={confirmModalVisible} animationType="fade" transparent={true} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={tw`flex-1 justify-center items-center bg-black/50`}>
          <View style={tw`bg-white w-11/12 max-w-sm rounded-3xl p-6 items-center shadow-xl`}>
            <View style={tw`w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4`}>
              <Feather name="alert-triangle" size={32} color="#EF4444" />
            </View>
            <Text style={tw`text-xl font-black text-gray-800 mb-2`}>Hapus Admin?</Text>
            <Text style={tw`text-center text-gray-500 font-bold mb-6`}>
              Apakah Anda yakin ingin menonaktifkan akun admin <Text style={tw`text-red-500`}>{adminToDelete?.name}</Text> (@{adminToDelete?.username})?
            </Text>
            <View style={tw`flex-row w-full justify-between gap-3`}>
              <TouchableOpacity onPress={() => setConfirmModalVisible(false)} style={tw`flex-1 p-4 rounded-xl border border-gray-200 bg-gray-50 items-center`}>
                <Text style={tw`font-bold text-gray-600`}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDeleteAdmin} style={tw`flex-1 p-4 rounded-xl bg-red-500 items-center shadow-lg shadow-red-500/30`}>
                <Text style={tw`font-bold text-white`}>Ya, Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL NOTIFIKASI KUSTOM */}
      <Modal visible={notificationModal.visible} transparent={true} animationType="fade">
        <View style={tw`flex-1 justify-center items-center bg-black/40 px-6 z-50`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[35px] p-8 items-center shadow-2xl ${notificationModal.type === 'success' ? 'border-green-100' : 'border-red-100'} relative overflow-hidden`}>
            <View style={tw`w-20 h-20 ${notificationModal.type === 'success' ? 'bg-green-100' : 'bg-red-100'} rounded-full items-center justify-center mb-5 shadow-lg z-10 border-4 border-white`}>
              <Feather name={notificationModal.type === 'success' ? 'check-circle' : 'alert-triangle'} size={40} color={notificationModal.type === 'success' ? '#00A651' : '#ED1C24'} />
            </View>
            <Text style={tw`text-2xl font-black text-gray-800 mb-2 tracking-tight z-10 text-center`}>{notificationModal.title}</Text>
            <Text style={tw`text-center text-gray-500 font-medium mb-8 z-10 px-4`}>
              {notificationModal.message}
            </Text>
            <TouchableOpacity
              style={tw`${notificationModal.type === 'success' ? 'bg-[#00A651]' : 'bg-[#ED1C24]'} px-8 py-4 rounded-2xl shadow-lg z-10 w-full items-center`}
              onPress={() => setNotificationModal({ ...notificationModal, visible: false })}
            >
              <Text style={tw`text-white text-sm font-black tracking-widest uppercase`}>OK, MENGERTI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
