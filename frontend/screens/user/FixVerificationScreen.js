import Toast from 'react-native-toast-message';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet, ActivityIndicator, Image, Modal, Platform, Dimensions } from 'react-native';
import { API_URL } from '../../config';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import { handleLogoutAndReset } from '../../utils/authHelper';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';

const getPhotoUrl = (path, token) => {
  if (!path) return `${API_URL}/uploads/default.png${token ? '?token=' + token : ''}`;
  const cleanPath = path.replace(/\\/g, '/');
  let url = cleanPath.startsWith('http') ? cleanPath : `${API_URL}/${cleanPath.replace(/^\/+/, '')}`;
  if (token && !url.includes('?token=')) {
    url += `?token=${token}`;
  }
  return url;
};

export default function FixVerificationScreen({ route, navigation }) {
  const { noPolisi, issueId, handoverId } = route.params || {};
  const [issue, setIssue] = useState(null);
  const [brokenItems, setBrokenItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState('');

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const s = Dimensions.addEventListener('change', onChange);
    return () => s?.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user').then(str => {
      if (str) setUser(JSON.parse(str));
    });
    AsyncStorage.getItem('token').then(t => setAuthToken(t || ''));
  }, []);

  const handleLogout = async () => {
    await handleLogoutAndReset(navigation);
  };

  // Camera & Location State
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [activeItemId, setActiveItemId] = useState(null);
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const cameraRef = useRef(null);

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: !!selectedPreviewPhoto, close: () => setSelectedPreviewPhoto(null) },
      { isOpen: isCameraOpen, close: () => setIsCameraOpen(false) },
      { isOpen: showSuccessModal, close: () => setShowSuccessModal(false) },
    ]
  });

  useEffect(() => {
    fetchIssue();
    getLocation();
  }, []);

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'info',
        text1: `Izin Lokasi Ditolak`,
        text2: `Harap berikan izin GPS untuk mengambil foto bukti perbaikan.`
      });
      return;
    }
    try {
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 5000
      });
      setLocation(loc.coords);
    } catch (e) {
      console.log('Location error:', e);
      Toast.show({
        type: 'error',
        text1: `Error`,
        text2: `Gagal mendapatkan lokasi. Pastikan GPS aktif.`
      });
    }
  };

  const fetchIssue = async () => {
    try {
      let activeIssue = null;
      const targetId = issueId || (noPolisi && !noPolisi.includes(' ') && noPolisi.length > 15 ? noPolisi : null);

      // 1. Coba fetch langsung via endpoint /api/issues/:id jika ada targetId
      if (targetId) {
        try {
          const detailRes = await axios.get(`${API_URL}/api/issues/${targetId}`);
          if (detailRes.data && (detailRes.data.handover || detailRes.data.id)) {
            activeIssue = detailRes.data;
          }
        } catch (e) {
          console.log('Direct issue lookup by id fallback:', e.message);
        }
      }

      // 2. Fallback ke /api/issues/ongoing
      if (!activeIssue) {
        const res = await axios.get(`${API_URL}/api/issues/ongoing`);
        const ongoingIssues = res.data || [];
        activeIssue = ongoingIssues.find(iss => 
          (targetId && (iss.id === targetId || iss.handoverId === targetId)) ||
          (issueId && iss.id === issueId) ||
          (handoverId && iss.handoverId === handoverId) ||
          (noPolisi && (iss.handover?.noPolisi === noPolisi || iss.id === noPolisi || iss.handoverId === noPolisi))
        );
      }
      
      if (activeIssue && activeIssue.handover) {
        setIssue(activeIssue);
        // Only get items that are not good and not yet repaired
        const items = (activeIssue.handover.items || []).filter(i => !i.isGood && !i.isRepaired).map(i => ({
          ...i,
          repairStatus: 'RUSAK', // initial status
          repairNote: '',
          photo: null
        }));
        setBrokenItems(items);
      } else {
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'Tidak ada isu aktif untuk kendaraan ini.'
        });
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Gagal memuat data isu.'
      });
    } finally {
      setLoading(false);
    }
  };

  const setItemStatus = (index, statusValue) => {
    const newItems = [...brokenItems];
    newItems[index].repairStatus = statusValue;
    setBrokenItems(newItems);
  };

  const updateItemNote = (index, text) => {
    const newItems = [...brokenItems];
    newItems[index].repairNote = text;
    setBrokenItems(newItems);
  };

  const openCamera = (itemId) => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    if (!location) {
      Toast.show({
        type: 'info',
        text1: `Tunggu`,
        text2: `Sedang mencari lokasi. Pastikan GPS aktif.`
      });
      getLocation();
      return;
    }
    setActiveItemId(itemId);
    setIsCameraOpen(true);
  };

  const takePicture = async () => {
    if (cameraRef.current && activeItemId) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      const index = brokenItems.findIndex(i => i.id === activeItemId);
      if (index !== -1) {
        const newItems = [...brokenItems];
        newItems[index].photo = photo;
        setBrokenItems(newItems);
      }
      setIsCameraOpen(false);
      setActiveItemId(null);
    }
  };

  const submitVerification = async () => {
    if (submitting) return;

    // Validate
    const itemsToRepair = brokenItems.filter(i => i.repairStatus === 'BAIK');
    if (itemsToRepair.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'Peringatan',
        text2: 'Tidak ada item yang diverifikasi sebagai NORMAL.'
      });
      return;
    }

    // Check if notes and photos are provided for BAIK items
    for (const item of itemsToRepair) {
      const isCategoryB = item.category === 'B' || item.name.toLowerCase().includes('buku saku');
      if (!item.repairNote.trim()) {
        Toast.show({
          type: 'info',
          text1: 'Peringatan',
          text2: isCategoryB 
            ? `Catatan kelengkapan untuk ${item.name} wajib diisi.`
            : `Catatan perbaikan untuk ${item.name} wajib diisi.`
        });
        return;
      }
      if (!isCategoryB && !item.photo) {
        Toast.show({
          type: 'info',
          text1: 'Peringatan',
          text2: `Bukti foto untuk perbaikan ${item.name} wajib dilampirkan.`
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      const itemsData = itemsToRepair.map(i => ({
        id: i.id,
        repairNote: i.repairNote
      }));
      formData.append('itemsData', JSON.stringify(itemsData));

      // Append photos
      itemsToRepair.forEach(item => {
        if (item.photo) {
          const rawFilename = item.photo.uri.split('/').pop() || `photo_${item.id}.jpg`;
          const match = /\.(\w+)$/.exec(rawFilename);
          const ext = match ? match[1].toLowerCase() : 'jpg';
          const type = ext === 'png' ? 'image/png' : 'image/jpeg';
          const filename = rawFilename.endsWith('.jpg') || rawFilename.endsWith('.jpeg') || rawFilename.endsWith('.png')
            ? rawFilename
            : `${rawFilename}.jpg`;

          formData.append(`photo_${item.id}`, {
            uri: Platform.OS === 'android' ? item.photo.uri : item.photo.uri.replace('file://', ''),
            name: filename,
            type
          });
        }
      });

      const token = await AsyncStorage.getItem('token');
      const res = await axios.post(`${API_URL}/api/issues/${issue.id}/verify-repair`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 45000,
      });

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Submit verification error:', error?.response?.data || error.message);
      Toast.show({
        type: 'error',
        text1: 'Gagal Mengirim',
        text2: error?.response?.data?.error || 'Gagal mengirim verifikasi perbaikan. Periksa koneksi internet.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={tw`flex-1 bg-gray-50 ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
        {isLargeScreen && user && (
          <WebSidebar
            user={user}
            activeMenu={'Home'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}
        <View style={tw`flex-1 justify-center items-center bg-gray-50`}>
          <ActivityIndicator size="large" color="#0055A5" />
          <Text style={tw`mt-4 text-gray-500 font-medium`}>Memuat Data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50 ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
      {isLargeScreen && user && (
        <WebSidebar
          user={user}
          activeMenu={'Home'}
          navigation={navigation}
          handleLogout={handleLogout}
        />
      )}
      <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
        <WebNavbar showBack={true}
          user={user}
          activeMenu={'FixVerification'}
          title="Verifikasi Perbaikan"
          subtitle={`Truk: ${issue?.handover?.noPolisi || noPolisi}`}
          onBack={() => {
            if (navigation && navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else if (navigation && typeof navigation.replace === 'function') {
              navigation.replace('UserDashboard');
            }
          }}
        />

        <ScrollView style={tw`flex-1 px-4 py-6 max-w-4xl mx-auto w-full`} showsVerticalScrollIndicator={false}>
        {brokenItems.length === 0 ? (
          <View style={tw`items-center mt-20`}>
            <View style={tw`w-24 h-24 bg-blue-50 rounded-full items-center justify-center mb-4`}>
              <Ionicons name="time-outline" size={60} color="#0055A5" />
            </View>
            <Text style={tw`text-xl font-bold text-gray-800 mb-2`}>Sedang Ditinjau</Text>
            <Text style={tw`text-gray-500 text-center font-medium px-4 leading-6 mb-6`}>
              Bukti perbaikan Anda telah dikirim dan saat ini sedang ditinjau oleh Admin / Pengawas.
            </Text>
            <TouchableOpacity 
              style={tw`bg-[#0055A5] px-6 py-3 rounded-xl items-center shadow-md`}
              onPress={() => navigation.goBack()}
            >
              <Text style={tw`text-white font-bold`}>Kembali ke Beranda</Text>
            </TouchableOpacity>
          </View>
        ) : (
          brokenItems.map((item, index) => {
            const isCategoryB = item.category === 'B' || item.name.toLowerCase().includes('buku saku');
            const statusPrevLabel = 'STATUS SEBELUMNYA: ISU';
            const btnDoneLabel = 'NORMAL';
            const btnNotDoneLabel = 'ISU';
            const noteLabel = isCategoryB ? 'Catatan Kelengkapan' : 'Catatan Perbaikan';
            const notePlaceholder = isCategoryB ? 'Contoh: Buku saku AMT sudah dibawa dan lengkap...' : 'Contoh: Komponen sudah diganti/diperbaiki...';
            const photoLabel = isCategoryB ? 'Bukti Foto (Opsional)' : 'Bukti Foto';

            return (
              <View key={item.id} style={tw`bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100`}>
                <View style={tw`flex-row justify-between items-start mb-3`}>
                  <View style={tw`flex-1 mr-4`}>
                    <Text style={tw`text-xs font-bold text-gray-400 uppercase tracking-wider mb-1`}>
                      {isCategoryB ? 'B. PERLENGKAPAN AMT' : 'A. PERLENGKAPAN TANGKI'}
                    </Text>
                    <Text style={tw`font-bold text-gray-800 text-base mb-1`}>{item.name}</Text>
                    <Text style={tw`text-xs ${isCategoryB ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50'} font-bold self-start px-2 py-1 rounded`}>
                      {statusPrevLabel}
                    </Text>
                    {item.adminRejectionNote ? (
                      <View style={tw`bg-red-100 p-3 rounded-lg mt-3 border border-red-200`}>
                        <Text style={tw`text-xs font-bold text-red-800 mb-1`}>DITOLAK ADMIN:</Text>
                        <Text style={tw`text-sm text-red-700`}>{item.adminRejectionNote}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Foto Temuan Kerusakan Awal saat Handover */}
                {(() => {
                  const damagePhoto = (issue?.handover?.photos || []).find(p => {
                    const cleanPType = (p.type || '').replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
                    const cleanIName = (item.name || '').replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
                    return cleanPType.includes(cleanIName) || cleanIName.includes(cleanPType);
                  });
                  if (!damagePhoto) return null;
                  return (
                    <View style={tw`mb-3 bg-red-50/70 p-3 rounded-xl border border-red-100`}>
                      <Text style={tw`text-xs font-bold text-red-800 mb-1.5`}>Foto Temuan Kerusakan Awal:</Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedPreviewPhoto({
                            title: 'Foto Kerusakan Awal',
                            subtitle: item.name,
                            url: `${API_URL}/${damagePhoto.previewUrl || damagePhoto.url}`,
                            type: 'Temuan Serah Terima'
                          });
                          setPreviewRotation(0);
                        }}
                        style={tw`relative rounded-xl overflow-hidden`}
                      >
                        <Image 
                          source={{ uri: getPhotoUrl(damagePhoto.previewUrl || damagePhoto.url, authToken) }}
                          style={tw`w-full h-36 rounded-xl bg-gray-100`} 
                          resizeMode="cover" 
                        />
                        <View style={tw`absolute bottom-2 right-2 bg-black/60 px-2.5 py-1 rounded-full flex-row items-center border border-white/20`}>
                          <Ionicons name="scan-outline" size={12} color="white" style={tw`mr-1`} />
                          <Text style={tw`text-white text-[10px] font-bold`}>Ketuk untuk Zoom / Putar</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                <View style={tw`flex-row bg-gray-100 p-1 rounded-xl mb-4`}>
                  <TouchableOpacity
                    style={tw`flex-1 py-2 rounded-lg items-center ${item.repairStatus === 'BAIK' ? 'bg-green-500 shadow' : 'bg-transparent'}`}
                    onPress={() => setItemStatus(index, 'BAIK')}
                  >
                    <Text style={tw`font-bold text-xs ${item.repairStatus === 'BAIK' ? 'text-white' : 'text-gray-500'}`}>{btnDoneLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`flex-1 py-2 rounded-lg items-center ${item.repairStatus === 'RUSAK' ? 'bg-red-500 shadow' : 'bg-transparent'}`}
                    onPress={() => setItemStatus(index, 'RUSAK')}
                  >
                    <Text style={tw`font-bold text-xs ${item.repairStatus === 'RUSAK' ? 'text-white' : 'text-gray-500'}`}>{btnNotDoneLabel}</Text>
                  </TouchableOpacity>
                </View>

                {item.repairStatus === 'BAIK' && (
                  <View style={tw`mt-2 border-t border-gray-100 pt-3`}>
                    <Text style={tw`text-gray-700 font-semibold mb-2 text-sm`}>{noteLabel} <Text style={tw`text-red-500`}>*</Text></Text>
                    <TextInput
                      style={tw`bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-sm text-gray-700 min-h-[80px]`}
                      placeholder={notePlaceholder}
                      placeholderTextColor="#9CA3AF"
                      multiline
                      value={item.repairNote}
                      onChangeText={(text) => updateItemNote(index, text)}
                    />

                    <Text style={tw`text-gray-700 font-semibold mb-2 text-sm`}>
                      {photoLabel} {!isCategoryB && <Text style={tw`text-red-500`}>*</Text>}
                    </Text>
                    {item.photo ? (
                      <View style={tw`relative mb-2 rounded-xl overflow-hidden`}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => {
                            setSelectedPreviewPhoto({
                              title: 'Foto Bukti Perbaikan Anda',
                              subtitle: item.name,
                              url: item.photo.uri,
                              isLocal: true,
                              type: 'Bukti Perbaikan'
                            });
                            setPreviewRotation(0);
                          }}
                        >
                          <Image source={{ uri: item.photo.uri }} style={tw`w-full h-44 rounded-xl`} resizeMode="cover" />
                          <View style={tw`absolute bottom-2 right-2 bg-black/60 px-2.5 py-1 rounded-full flex-row items-center border border-white/20`}>
                            <Ionicons name="scan-outline" size={12} color="white" style={tw`mr-1`} />
                            <Text style={tw`text-white text-[10px] font-bold`}>Ketuk untuk Zoom / Putar</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={tw`absolute top-2 right-2 bg-red-500 p-2 rounded-full shadow-md z-10`}
                          onPress={() => {
                            const newItems = [...brokenItems];
                            newItems[index].photo = null;
                            setBrokenItems(newItems);
                          }}
                        >
                          <Ionicons name="trash" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={tw`bg-blue-50 border border-blue-200 border-dashed rounded-xl p-6 items-center justify-center mb-2`}
                        onPress={() => openCamera(item.id)}
                      >
                        <Ionicons name="camera" size={32} color="#0055A5" />
                        <Text style={tw`text-blue-700 font-semibold mt-2`}>Ambil Foto Bukti</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {brokenItems.length > 0 && (
          <TouchableOpacity
            style={tw`w-full mb-10 mt-4 opacity-${submitting ? '50' : '100'}`}
            onPress={submitVerification}
            disabled={submitting}
          >
            <LinearGradient colors={['#00A651', '#007A3D']} style={tw`p-4 rounded-xl items-center`}>
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={tw`text-white font-bold text-lg`}>Kirim Verifikasi</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
      </View>

      {/* CAMERA MODAL */}
      <Modal 
        visible={isCameraOpen} 
        animationType="slide" 
        transparent={false}
        onShow={() => setIsCameraReady(true)}
      >
        <View style={tw`flex-1 bg-black relative`}>
          {isCameraOpen && (
            <>
              {isCameraReady ? (
                <CameraView style={tw`absolute inset-0`} facing="back" ref={cameraRef} />
              ) : (
                <View style={tw`flex-1 items-center justify-center`}>
                  <ActivityIndicator color="white" size="large" />
                  <Text style={tw`text-white mt-4 font-bold`}>Menyiapkan Kamera...</Text>
                </View>
              )}
              
              <View style={tw`absolute top-12 left-0 right-0 items-center px-4`} pointerEvents="none">
                <Text style={tw`bg-black/70 text-white p-3 rounded-full font-bold text-lg text-center`}>
                  Ambil Foto Bukti Perbaikan
                </Text>
                {location && (
                  <Text style={tw`text-white bg-black/50 text-xs px-2 py-1 mt-2 rounded`}>
                    GPS Aktif: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={tw`absolute top-12 left-4 bg-black/50 p-2 rounded-full z-10`}
                onPress={() => { setIsCameraOpen(false); setIsCameraReady(false); setActiveItemId(null); }}
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>

              <View style={tw`flex-1 justify-center items-center`} pointerEvents="none">
                <View style={tw`w-72 h-96 border-2 border-dashed border-white/40 rounded-3xl relative shadow-2xl bg-white/5 items-center justify-center`}>
                  <Ionicons name="scan-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={tw`text-white/90 font-bold text-xs mt-3 bg-black/50 px-3.5 py-1.5 rounded-full border border-white/20`}>
                    Ambil foto bukti secara tegak (Portrait)
                  </Text>
                </View>
              </View>

              <View style={tw`absolute bottom-12 w-full flex-row justify-center`}>
                <TouchableOpacity 
                  style={tw`w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-lg`} 
                  onPress={takePicture}
                />
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* MODAL SUKSES (BERHASIL KIRIM) */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View style={tw`flex-1 justify-center items-center bg-slate-900/80 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[40px] p-8 items-center shadow-2xl border border-white/20`}>
            <View style={tw`w-28 h-28 bg-green-50 rounded-full items-center justify-center mb-6 border-8 border-green-100`}>
              <Ionicons name="checkmark-done" size={60} color="#2ECC71" />
            </View>
            <Text style={tw`text-2xl font-black text-gray-800 mb-3 text-center tracking-tight`}>Verifikasi Terkirim!</Text>
            <Text style={tw`text-gray-500 text-center mb-8 font-medium leading-6`}>
              Bukti perbaikan telah berhasil dikirim dan sedang menunggu persetujuan admin.
            </Text>
            <TouchableOpacity 
              style={tw`w-full bg-[#0055A5] p-4 rounded-2xl items-center shadow-lg`}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.popToTop();
              }}
            >
              <Text style={tw`text-white font-bold text-[15px]`}>Kembali ke Menu Utama</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL FULL SCREEN PREVIEW FOTO DENGAN ROTASI */}
      <Modal 
        visible={!!selectedPreviewPhoto} 
        transparent={true} 
        animationType="fade" 
        onRequestClose={() => {
          setSelectedPreviewPhoto(null);
          setPreviewRotation(0);
        }}
      >
        <View style={tw`flex-1 bg-black/95 justify-center items-center`}>
          {/* Glass Navbar */}
          <View style={tw`absolute top-0 w-full pt-12 pb-5 px-6 flex-row justify-between items-center z-50 bg-black/60 border-b border-white/10`}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-white font-black text-xl tracking-wide`} numberOfLines={1}>
                {selectedPreviewPhoto?.title || 'Preview Foto'}
              </Text>
              <Text style={tw`text-blue-300 font-bold text-xs uppercase tracking-widest mt-0.5`}>
                {selectedPreviewPhoto?.subtitle} {selectedPreviewPhoto?.type ? `• ${selectedPreviewPhoto.type}` : ''}
              </Text>
            </View>
            <View style={tw`flex-row items-center gap-2`}>
              <TouchableOpacity
                style={tw`flex-row items-center px-3.5 py-2 bg-white/20 rounded-full border border-white/30 active:scale-95`}
                onPress={() => setPreviewRotation(prev => (prev + 90) % 360)}
              >
                <Ionicons name="refresh" size={16} color="white" style={tw`mr-1.5`} />
                <Text style={tw`text-white font-bold text-xs`}>Putar 90° ({previewRotation}°)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`p-2.5 bg-white/20 rounded-full border border-white/30`}
                onPress={() => {
                  setSelectedPreviewPhoto(null);
                  setPreviewRotation(0);
                }}
              >
                <Ionicons name="close" size={22} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {selectedPreviewPhoto && (
            <View style={tw`w-full h-full justify-center items-center p-4 pt-24`}>
              <View style={tw`w-full h-[80%] bg-black/40 rounded-3xl overflow-hidden border border-white/10 relative justify-center items-center`}>
                <Image
                  source={{ uri: getPhotoUrl(selectedPreviewPhoto.url, authToken) }}
                  style={[tw`w-full h-full`, { transform: [{ rotate: `${previewRotation}deg` }] }]}
                  resizeMode="contain"
                />

                {/* Bottom Info Banner */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  style={tw`absolute bottom-0 w-full p-5 pt-12`}
                  pointerEvents="none"
                >
                  <View style={tw`flex-row items-center`}>
                    <View style={tw`w-10 h-10 bg-[#0055A5] rounded-xl items-center justify-center mr-3 border border-white/20`}>
                      <Ionicons name="camera" size={20} color="white" />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-white font-extrabold text-sm`}>{selectedPreviewPhoto.title}</Text>
                      <Text style={tw`text-gray-300 text-xs mt-0.5`}>
                        {selectedPreviewPhoto.subtitle}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}
