import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, Platform, Animated, Easing, Modal, ActivityIndicator, Linking } from 'react-native';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import { getItemOptionLabels } from '../../utils/checklistHelper';
import { handleLogoutAndReset } from '../../utils/authHelper';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';

const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

const activeMenu = 'History';
export default function HandoverDetailScreen({ route, navigation }) {
  const initialHandover = route.params?.handover || null;
  const handoverId = route.params?.handoverId || route.params?.id || initialHandover?.id;

  const [handover, setHandover] = useState(initialHandover);
  const [loading, setLoading] = useState(!initialHandover && !!handoverId);
  const [fetchError, setFetchError] = useState(null);
  const [authToken, setAuthToken] = useState('');

  const floatAnim1 = React.useRef(new Animated.Value(0)).current;
  const floatAnim2 = React.useRef(new Animated.Value(0)).current;
  const floatAnim3 = React.useRef(new Animated.Value(0)).current;

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth > 768;
  const [user, setUser] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoRotation, setPhotoRotation] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: !!selectedPhoto, close: () => setSelectedPhoto(null) },
      { isOpen: showExportModal, close: () => setShowExportModal(false) },
    ]
  });

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    AsyncStorage.getItem('token').then(t => setAuthToken(t || ''));
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user').then(str => {
      if (str) setUser(JSON.parse(str));
    });
  }, []);

  const handleLogout = async () => {
    await handleLogoutAndReset(navigation);
  };

  const handleExportExcel = async () => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      Toast.show({ type: 'error', text1: 'Akses Ditolak', text2: 'Hanya Admin yang dapat mengekspor laporan.' });
      return;
    }
    if (!handover?.id) return;

    try {
      setExporting(true);
      const token = await AsyncStorage.getItem('token');
      const url = `${API_URL}/api/reports/excel?token=${token}&handoverId=${handover.id}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        const fileUri = `${FileSystem.documentDirectory}Detail_Handover_${handover.noPolisi || 'Report'}.xlsx`;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });

        if (downloadRes.status === 200) {
          if (await Sharing.isAvailableAsync()) {
            try {
              await Sharing.shareAsync(downloadRes.uri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Bagikan Detail Handover',
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
        const token = await AsyncStorage.getItem('token');
        const fallbackUrl = `${API_URL}/api/reports/excel?token=${token}&handoverId=${handover.id}`;
        if (await Linking.canOpenURL(fallbackUrl)) {
          await Linking.openURL(fallbackUrl);
          Toast.show({ type: 'info', text1: 'Membuka Browser', text2: 'File diunduh melalui browser perangkat Anda.' });
          return;
        }
      } catch (linkErr) {
        console.log('Fallback linking failed:', linkErr);
      }
      Toast.show({ type: 'error', text1: 'Gagal Mengunduh', text2: 'Tidak dapat mengunduh Excel: ' + err.message });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      Toast.show({ type: 'error', text1: 'Akses Ditolak', text2: 'Hanya Admin yang dapat mengekspor laporan.' });
      return;
    }
    if (!handover?.id) return;

    try {
      setExporting(true);
      const token = await AsyncStorage.getItem('token');
      const url = `${API_URL}/api/reports/pdf?token=${token}&handoverId=${handover.id}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        const fileUri = `${FileSystem.documentDirectory}Detail_Handover_${handover.noPolisi || 'Report'}.pdf`;
        const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });

        if (downloadRes.status === 200) {
          if (await Sharing.isAvailableAsync()) {
            try {
              await Sharing.shareAsync(downloadRes.uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Bagikan Detail Handover (PDF)',
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
        const token = await AsyncStorage.getItem('token');
        const fallbackUrl = `${API_URL}/api/reports/pdf?token=${token}&handoverId=${handover.id}`;
        if (await Linking.canOpenURL(fallbackUrl)) {
          await Linking.openURL(fallbackUrl);
          Toast.show({ type: 'info', text1: 'Membuka Browser', text2: 'File PDF dibuka/diunduh melalui browser perangkat Anda.' });
          return;
        }
      } catch (linkErr) {
        console.log('Fallback linking failed:', linkErr);
      }
      Toast.show({ type: 'error', text1: 'Gagal Mengunduh', text2: 'Tidak dapat mengunduh PDF: ' + err.message });
    } finally {
      setExporting(false);
    }
  };

  const fetchHandoverDetail = async (idToFetch) => {
    const targetId = idToFetch || handoverId || initialHandover?.id;
    if (!targetId) {
      setFetchError('ID Riwayat handover tidak ditemukan.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setFetchError(null);
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/handovers/${targetId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      if (response.ok && data.success && data.handover) {
        setHandover(data.handover);
      } else {
        setFetchError(data.error || 'Data riwayat handover tidak ditemukan.');
      }
    } catch (err) {
      console.error('Error fetching handover detail:', err);
      setFetchError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = handoverId || initialHandover?.id;
    if (id) {
      fetchHandoverDetail(id);
    }
  }, [handoverId, initialHandover]);

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
  }, []);

  const orb1TranslateY = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const orb2TranslateY = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const orb3TranslateY = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });

  if (loading) {
    return (
      <View style={tw`flex-1 bg-[#F4F7FA]`}>
        <SafeAreaView style={tw`flex-1 relative ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
          {isLargeScreen && user && (
            <WebSidebar
              user={user}
              activeMenu={'History'}
              navigation={navigation}
              handleLogout={handleLogout}
            />
          )}
          <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
            <WebNavbar showBack={true}
              user={user}
              activeMenu={'History'}
              title="Detail Handover"
              subtitle="Memuat riwayat..."
              onBack={() => {
                if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                  navigation.goBack();
                } else if (navigation && typeof navigation.replace === 'function') {
                  navigation.replace('History');
                }
              }}
            />
            <View style={tw`flex-1 items-center justify-center p-6`}>
              <ActivityIndicator size="large" color="#0055A5" />
              <Text style={tw`mt-4 text-base font-bold text-gray-600`}>Memuat riwayat handover...</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (fetchError || !handover) {
    return (
      <View style={tw`flex-1 bg-[#F4F7FA]`}>
        <SafeAreaView style={tw`flex-1 relative ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
          {isLargeScreen && user && (
            <WebSidebar
              user={user}
              activeMenu={'History'}
              navigation={navigation}
              handleLogout={handleLogout}
            />
          )}
          <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
            <WebNavbar showBack={true}
              user={user}
              activeMenu={'History'}
              title="Detail Handover"
              subtitle="Data Tidak Ditemukan"
              onBack={() => {
                if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                  navigation.goBack();
                } else if (navigation && typeof navigation.replace === 'function') {
                  navigation.replace('History');
                }
              }}
            />
            <View style={tw`flex-1 items-center justify-center p-6`}>
              <View style={tw`w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4`}>
                <Ionicons name="alert-circle" size={36} color="#ED1C24" />
              </View>
              <Text style={tw`text-lg font-bold text-gray-800 text-center mb-2`}>{fetchError || 'Data riwayat tidak ditemukan'}</Text>
              {handoverId ? (
                <TouchableOpacity
                  onPress={() => fetchHandoverDetail()}
                  style={tw`mt-4 px-6 py-3 bg-[#0055A5] rounded-xl shadow-md`}
                >
                  <Text style={tw`text-white font-bold`}>Coba Lagi</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => navigation.navigate('History')}
                  style={tw`mt-4 px-6 py-3 bg-[#0055A5] rounded-xl shadow-md`}
                >
                  <Text style={tw`text-white font-bold`}>Buka Semua Riwayat</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isNormal = handover?.status === 'Siap Operasi (Normal)';
  const isResolved = handover?.issue && handover.issue.status === 'RESOLVED';

  const getPhotoUrl = (photoObjOrString) => {
    if (!photoObjOrString) return null;
    let path = typeof photoObjOrString === 'string' 
      ? photoObjOrString 
      : (photoObjOrString.url || photoObjOrString.previewUrl || photoObjOrString.thumbnailUrl);
    if (!path) return null;
    let url = `${API_URL}/${path.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    if (authToken && !url.includes('?token=')) {
      url += `?token=${authToken}`;
    }
    return url;
  };

  // Parse items by category
  const itemsA = (handover?.items || []).filter(i => i.category === 'A');
  const itemsB = (handover?.items || []).filter(i => i.category === 'B');
  const itemsC = (handover?.items || []).filter(i => i.category === 'C' && !i.name?.startsWith('Catatan Foto:'));
  const legacyPhotoNote = (handover?.items || []).find(i => i.category === 'C' && i.name?.startsWith('Catatan Foto:'))?.name?.replace('Catatan Foto:', '').trim();
  const effectiveNotes = (handover?.notes && handover.notes.trim()) || legacyPhotoNote;

  // Parse name to extract original name, severity, and catatan
  // Format from submit: "Nama Item [SEVERITY] - catatan"
  const parseItemName = (rawName) => {
    let name = rawName;
    let severity = null;
    let catatan = '';

    // Extract severity [MAJOR] or [MINOR]
    const severityMatch = name.match(/\s*\[(MAJOR|MINOR)\]/i);
    if (severityMatch) {
      severity = severityMatch[1];
      name = name.replace(severityMatch[0], '');
    }

    // Extract catatan after " - "
    const catatanIdx = name.indexOf(' - ');
    if (catatanIdx !== -1) {
      catatan = name.substring(catatanIdx + 3).trim();
      name = name.substring(0, catatanIdx).trim();
    }

    return { name: name.trim(), severity, catatan };
  };

  const photos = handover?.photos || [];

  const renderChecklistItem = (item, index) => {
    const parsed = parseItemName(item.name);
    const isBaik = item.isGood;
    const optionLabels = getItemOptionLabels(item);

    // Sembunyikan keterangan Major/Minor untuk role USER/AMT
    const showSeverity = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'PENGAWAS');
    const displayName = showSeverity ? parsed.name : parsed.name.replace(/\s*\[MAJOR\]|\s*\[MINOR\]/gi, '').trim();

    const cleanParsedName = parsed.name.replace(/[^a-zA-Z0-9 ]/g, "").trim().toLowerCase();
    const damagePhoto = photos.find(p => {
      if (!p.type || !p.type.toLowerCase().startsWith('kerusakan:')) return false;
      try {
        const decodedType = decodeURIComponent(p.type).toLowerCase();
        return decodedType.includes(cleanParsedName) || decodedType.replace(/[^a-zA-Z0-9 ]/g, "").includes(cleanParsedName.replace(/ /g, ""));
      } catch (e) {
        return p.type.toLowerCase().includes(cleanParsedName);
      }
    });

    return (
      <View key={item.id || index} style={tw`border-b border-gray-100 py-4 px-5`}>
        <View style={tw`flex-row items-start`}>
          {/* Status Icon */}
          <View style={tw`w-10 h-10 rounded-full items-center justify-center mr-3 mt-0.5 ${isBaik ? 'bg-green-100' : 'bg-red-100'}`}>
            <Ionicons
              name={isBaik ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={isBaik ? '#00A651' : '#ED1C24'}
            />
          </View>

          {/* Item Details */}
          <View style={tw`flex-1`}>
            <Text style={tw`font-bold text-base ${isBaik ? 'text-gray-800' : 'text-red-700'}`}>
              {displayName}
            </Text>

            <View style={tw`flex-row items-center mt-1.5 flex-wrap gap-2`}>
              {/* Status Badge */}
              <View style={tw`px-3 py-1 rounded-full ${isBaik ? 'bg-green-100' : 'bg-red-100'}`}>
                <Text style={tw`text-xs font-bold ${isBaik ? 'text-green-700' : 'text-red-600'}`}>
                  {isBaik ? optionLabels.good : optionLabels.bad}
                </Text>
              </View>

              {/* Severity Badge (only for non-good items) */}
              {!isBaik && parsed.severity && showSeverity && (
                <View style={tw`px-3 py-1 rounded-full ${parsed.severity.toUpperCase() === 'MAJOR' ? 'bg-red-500' : 'bg-yellow-400'}`}>
                  <Text style={tw`text-xs font-bold ${parsed.severity.toUpperCase() === 'MAJOR' ? 'text-white' : 'text-yellow-900'}`}>
                    {parsed.severity.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Catatan */}
            {!isBaik && parsed.catatan ? (
              <View style={tw`mt-3 bg-red-50 p-3 rounded-xl border border-red-100`}>
                <Text style={tw`text-xs font-bold text-red-800 uppercase tracking-wider mb-1`}>Catatan:</Text>
                <Text style={tw`text-sm text-red-700 leading-5`}>{parsed.catatan}</Text>
              </View>
            ) : null}

            {/* Foto Kerusakan */}
            {!isBaik && damagePhoto && (
              <View style={tw`mt-3 bg-red-50 p-3 rounded-xl border border-red-100`}>
                <View style={tw`flex-row items-center mb-2`}>
                  <Ionicons name="camera" size={16} color="#ED1C24" style={tw`mr-2`} />
                  <Text style={tw`text-xs font-bold text-red-800 uppercase tracking-wider`}>Foto Kerusakan</Text>
                </View>
                <TouchableOpacity onPress={() => { setSelectedPhoto(damagePhoto); setPhotoRotation(0); }}>
                  <Image source={{ uri: getPhotoUrl(damagePhoto) }} style={tw`w-full h-32 rounded-lg mt-1`} />
                </TouchableOpacity>
              </View>
            )}

            {/* Repair Info */}
            {item.isRepaired && (
              <View style={tw`mt-3 bg-green-50 p-3 rounded-xl border border-green-200`}>
                <View style={tw`flex-row items-center mb-2`}>
                  <Ionicons name="construct" size={16} color="#00A651" style={tw`mr-2`} />
                  <Text style={tw`text-xs font-bold text-green-800 uppercase tracking-wider`}>Sudah Diperbaiki</Text>
                </View>
                {item.repairNote ? (
                  <Text style={tw`text-sm text-green-700 leading-5 mb-2`}>{item.repairNote}</Text>
                ) : null}
                {item.repairPhotoUrl ? (
                  <TouchableOpacity onPress={() => { setSelectedPhoto({ type: 'Perbaikan', url: item.repairPhotoUrl }); setPhotoRotation(0); }}>
                    <Image source={{ uri: getPhotoUrl(item.repairPhotoUrl) }} style={tw`w-full h-32 rounded-lg mt-2`} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const generalPhotos = photos.filter(p => !p.type?.toLowerCase().startsWith('kerusakan:'));

  return (
    <View style={tw`flex-1 bg-[#F4F7FA]`}>
      {/* Animated Background Orbs */}
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
            handleLogout={handleLogout}
          />
        )}

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
          {/* Navbar */}
          <WebNavbar showBack={true}
            user={user}
            activeMenu={'History'}
            title="Detail Handover"
            subtitle={`Truk: ${handover?.noPolisi || '-'}`}
            onBack={() => {
              if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else if (navigation && typeof navigation.replace === 'function') {
                navigation.replace('History');
              }
            }}
            rightAction={
              isLargeScreen && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                <View style={tw`flex-row items-center gap-2.5`}>
                  <TouchableOpacity onPress={handleExportPdf} disabled={exporting} style={tw`bg-[#ED1C24] px-4 py-2 rounded-xl flex-row items-center shadow-md active:scale-95`}>
                    <Ionicons name="document-outline" size={16} color="white" />
                    <Text style={tw`text-white font-bold text-xs ml-1.5`}>Export PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleExportExcel} disabled={exporting} style={tw`bg-[#00A651] px-4 py-2 rounded-xl flex-row items-center shadow-md active:scale-95`}>
                    <Ionicons name="document-text" size={16} color="white" />
                    <Text style={tw`text-white font-bold text-xs ml-1.5`}>Export Excel</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />

          <ScrollView contentContainerStyle={tw`px-6 pt-2 pb-32 w-full max-w-4xl mx-auto`} showsVerticalScrollIndicator={false}>

            {/* Header Card */}
            <View style={tw`bg-white p-6 rounded-3xl mb-5 shadow-md border border-gray-100`}>
              <View style={tw`flex-row justify-between items-start mb-4`}>
                <View style={[tw`flex-row items-center flex-1 mr-3`, { minWidth: 0 }]}>
                  <View style={[tw`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isNormal ? 'bg-green-100' : (isResolved ? 'bg-blue-100' : 'bg-red-100')}`, { flexShrink: 0 }]}>
                    <Ionicons
                      name={isNormal ? 'checkmark-circle' : (isResolved ? 'checkmark-done-circle' : 'warning')}
                      size={32}
                      color={isNormal ? '#00A651' : (isResolved ? '#0055A5' : '#ED1C24')}
                    />
                  </View>
                  <View style={[tw`flex-1`, { minWidth: 0 }]}>
                    <Text style={tw`text-2xl font-black text-gray-800 tracking-tight`}>{handover.noPolisi}</Text>
                    <View style={tw`flex-row items-center flex-wrap gap-2 mt-1.5`}>
                      <Text style={tw`text-sm text-gray-600 font-bold`}>Shift {handover.shift}</Text>
                      {handover.type ? (
                        <View style={tw`px-2.5 py-0.5 rounded-full ${handover.type === 'mulai' ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50 border border-purple-200'} flex-row items-center`}>
                          <Ionicons
                            name={handover.type === 'mulai' ? 'play-circle' : 'checkmark-done-circle'}
                            size={13}
                            color={handover.type === 'mulai' ? '#0055A5' : '#7C3AED'}
                            style={tw`mr-1`}
                          />
                          <Text style={tw`text-xs font-bold ${handover.type === 'mulai' ? 'text-[#0055A5]' : 'text-purple-700'}`}>
                            {handover.type === 'mulai' ? 'Mulai Perjalanan' : 'Akhiri Perjalanan'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={[tw`px-4 py-2 rounded-full ${isNormal ? 'bg-green-100' : (isResolved ? 'bg-blue-100' : 'bg-red-500')}`, { flexShrink: 0 }]}>
                  <Text style={tw`text-xs font-black ${isNormal ? 'text-green-700' : (isResolved ? 'text-blue-700' : 'text-white')}`}>
                    {isNormal ? 'NORMAL' : (isResolved ? 'SELESAI' : 'ISU')}
                  </Text>
                </View>
              </View>

              <View style={tw`bg-gray-50 rounded-2xl p-4`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <View style={tw`bg-blue-100 p-2 rounded-xl mr-3`}>
                    <Ionicons name="calendar" size={18} color="#0055A5" />
                  </View>
                  <View>
                    <Text style={tw`text-xs text-gray-400 font-bold uppercase tracking-wider`}>Tanggal & Waktu</Text>
                    <Text style={tw`text-sm font-bold text-gray-800`}>{new Date(handover.timestamp || handover.createdAt || Date.now()).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</Text>
                  </View>
                </View>

                {handover.locationLat && handover.locationLng && (
                  <View style={tw`flex-row items-center mb-3`}>
                    <View style={tw`bg-green-100 p-2 rounded-xl mr-3`}>
                      <Ionicons name="location" size={18} color="#00A651" />
                    </View>
                    <View>
                      <Text style={tw`text-xs text-gray-400 font-bold uppercase tracking-wider`}>Lokasi GPS</Text>
                      <Text style={tw`text-sm font-bold text-gray-800`}>{handover.locationLat.toFixed(5)}, {handover.locationLng.toFixed(5)}</Text>
                    </View>
                  </View>
                )}

                {/* Awak Mobil Tangki (AMT) & Pelapor */}
                <View style={tw`mt-2 pt-3 border-t border-gray-200/70`}>
                  <Text style={tw`text-xs text-gray-400 font-bold uppercase tracking-wider mb-2.5`}>Awak Mobil Tangki (AMT)</Text>
                  <View style={tw`flex-row flex-wrap gap-2.5`}>
                    {handover.amt1 ? (
                      <View style={tw`flex-row items-center bg-white px-3.5 py-2.5 rounded-xl border border-gray-200 shadow-sm mr-2 mb-1`}>
                        <View style={tw`w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2.5`}>
                          <Ionicons name="person" size={16} color="#0055A5" />
                        </View>
                        <View>
                          <Text style={tw`text-[10px] text-gray-400 font-bold uppercase`}>AMT 1 (Driver Utama)</Text>
                          <Text style={tw`text-xs font-black text-gray-800`}>{handover.amt1}</Text>
                        </View>
                      </View>
                    ) : null}

                    {handover.amt2 ? (
                      <View style={tw`flex-row items-center bg-white px-3.5 py-2.5 rounded-xl border border-gray-200 shadow-sm mr-2 mb-1`}>
                        <View style={tw`w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2.5`}>
                          <Ionicons name="person" size={16} color="#4F46E5" />
                        </View>
                        <View>
                          <Text style={tw`text-[10px] text-gray-400 font-bold uppercase`}>AMT 2 (Driver Pendamping)</Text>
                          <Text style={tw`text-xs font-black text-gray-800`}>{handover.amt2}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Diinput Oleh */}
                    <View style={tw`flex-row items-center bg-white px-3.5 py-2.5 rounded-xl border border-gray-200 shadow-sm mb-1`}>
                      <View style={tw`w-8 h-8 rounded-full bg-emerald-100 items-center justify-center mr-2.5`}>
                        <Ionicons name="create-outline" size={16} color="#059669" />
                      </View>
                      <View>
                        <Text style={tw`text-[10px] text-gray-400 font-bold uppercase`}>Diinput Oleh</Text>
                        <Text style={tw`text-xs font-black text-gray-800`}>
                          {handover.user?.name || '-'} {handover.user?.jabatan ? `(${handover.user.jabatan})` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Kategori A */}
            {itemsA.length > 0 && (
              <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-5`}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                  <View style={tw`bg-green-100 p-2 rounded-xl mr-3 shadow-sm`}>
                    <Ionicons name="construct" size={24} color="#00A651" />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-extrabold text-lg text-gray-800`}>A. Perlengkapan Tangki</Text>
                    <Text style={tw`text-xs text-gray-400 font-medium mt-0.5`}>{itemsA.filter(i => i.isGood).length}/{itemsA.length} item normal</Text>
                  </View>
                  <View style={tw`px-3 py-1.5 rounded-full ${itemsA.every(i => i.isGood) ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Text style={tw`text-xs font-bold ${itemsA.every(i => i.isGood) ? 'text-green-700' : 'text-red-600'}`}>
                      {itemsA.every(i => i.isGood) ? 'SEMUA NORMAL' : `${itemsA.filter(i => !i.isGood).length} ISU`}
                    </Text>
                  </View>
                </LinearGradient>
                {itemsA.map((item, idx) => renderChecklistItem(item, idx))}
              </View>
            )}

            {/* Kategori B */}
            {itemsB.length > 0 && (
              <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-5`}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                  <View style={tw`bg-blue-100 p-2 rounded-xl mr-3 shadow-sm`}>
                    <Ionicons name="person-circle" size={24} color="#0055A5" />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-extrabold text-lg text-gray-800`}>B. Perlengkapan AMT</Text>
                    <Text style={tw`text-xs text-gray-400 font-medium mt-0.5`}>{itemsB.filter(i => i.isGood).length}/{itemsB.length} item normal</Text>
                  </View>
                  <View style={tw`px-3 py-1.5 rounded-full ${itemsB.every(i => i.isGood) ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Text style={tw`text-xs font-bold ${itemsB.every(i => i.isGood) ? 'text-green-700' : 'text-red-600'}`}>
                      {itemsB.every(i => i.isGood) ? 'SEMUA NORMAL' : `${itemsB.filter(i => !i.isGood).length} ISU`}
                    </Text>
                  </View>
                </LinearGradient>
                {itemsB.map((item, idx) => renderChecklistItem(item, idx))}
              </View>
            )}

            {/* Kategori C */}
            {itemsC.length > 0 && (
              <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-5`}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                  <View style={tw`bg-amber-100 p-2 rounded-xl mr-3 shadow-sm`}>
                    <Ionicons name="speedometer" size={24} color="#D97706" />
                  </View>
                  <Text style={tw`font-extrabold text-lg text-gray-800`}>C. Info Tambahan</Text>
                </LinearGradient>
                {itemsC.map((item, idx) => (
                  <View key={item.id || idx} style={tw`py-4 px-5 flex-row items-center border-b border-gray-100`}>
                    <View style={tw`w-10 h-10 rounded-full items-center justify-center mr-3 bg-amber-50`}>
                      <Ionicons name="information-circle" size={24} color="#D97706" />
                    </View>
                    <Text style={tw`font-bold text-base text-gray-800 flex-1`}>{item.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Foto Kendaraan */}
            <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-5`}>
              <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                <View style={tw`bg-red-50 p-2 rounded-xl mr-3 shadow-sm`}>
                  <Ionicons name="camera" size={24} color="#ED1C24" />
                </View>
                <Text style={tw`font-extrabold text-lg text-gray-800`}>Foto Kendaraan</Text>
              </LinearGradient>
              
              {generalPhotos.length > 0 ? (
                <View style={tw`flex-row flex-wrap p-4 gap-3`}>
                  {generalPhotos.map((photo, idx) => (
                    <TouchableOpacity
                      key={photo.id || idx}
                      style={tw`w-[47%] aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm relative`}
                      onPress={() => {
                        setSelectedPhoto(photo);
                        setPhotoRotation(0);
                      }}
                    >
                      <Image
                        source={{ uri: getPhotoUrl(photo) }}
                        style={tw`w-full h-full`}
                        resizeMode="cover"
                      />
                      <View style={tw`absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-full flex-row items-center border border-white/20`}>
                        <Ionicons name="scan-outline" size={12} color="white" style={tw`mr-1`} />
                        <Text style={tw`text-white text-[10px] font-bold`}>Preview</Text>
                      </View>
                      <View style={tw`absolute bottom-0 left-0 right-0 bg-black/60 py-2 px-3`}>
                        <Text style={tw`text-white text-xs font-bold`}>{photo.type || `Foto ${idx + 1}`}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={tw`p-6 items-center justify-center`}>
                  <Ionicons name="images-outline" size={48} color="#CBD5E1" />
                  <Text style={tw`text-gray-400 font-bold mt-2 text-center`}>Tidak ada foto kendaraan yang diunggah</Text>
                </View>
              )}
            </View>

            {/* Catatan Umum */}
            {effectiveNotes ? (
              <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-5`}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                  <View style={tw`bg-gray-100 p-2 rounded-xl mr-3 shadow-sm`}>
                    <Ionicons name="document-text" size={24} color="#4B5563" />
                  </View>
                  <Text style={tw`font-extrabold text-lg text-gray-800`}>Catatan Umum</Text>
                </LinearGradient>
                <View style={tw`p-5 bg-gray-50`}>
                  <Text style={tw`text-gray-700 text-sm leading-6`}>{effectiveNotes}</Text>
                </View>
              </View>
            ) : null}

            {/* Issue Status Card */}
            {handover.issue && (
              <View style={tw`bg-white rounded-3xl shadow-md border overflow-hidden mb-5 ${isResolved ? 'border-blue-200' : 'border-red-200'}`}>
                <LinearGradient colors={isResolved ? ['#EFF6FF', '#DBEAFE'] : ['#FEF2F2', '#FEE2E2']} style={tw`p-5 flex-row items-center`}>
                  <View style={tw`w-12 h-12 rounded-full items-center justify-center mr-4 ${isResolved ? 'bg-blue-100' : 'bg-red-100'}`}>
                    <Ionicons
                      name={isResolved ? 'checkmark-done-circle' : 'alert-circle'}
                      size={28}
                      color={isResolved ? '#0055A5' : '#ED1C24'}
                    />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-black text-base ${isResolved ? 'text-blue-800' : 'text-red-800'}`}>
                      {isResolved ? 'Isu Telah Diselesaikan' : 'Isu Sedang Ditangani'}
                    </Text>
                    {isResolved && handover.issue.resolvedAt && (
                      <Text style={tw`text-xs text-blue-500 font-medium mt-1`}>
                        Diselesaikan: {new Date(handover.issue.resolvedAt).toLocaleString('id-ID')}
                      </Text>
                    )}
                    {!isResolved && (
                      <Text style={tw`text-xs text-red-500 font-medium mt-1`}>
                        Menunggu tindak lanjut dari pengawas/admin
                      </Text>
                    )}
                  </View>
                </LinearGradient>
              </View>
            )}

          </ScrollView>

          {/* Tombol Ekspor Floating (Mobile Only - Hanya Admin) */}
          {!isLargeScreen && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
            <TouchableOpacity
              style={tw`absolute bottom-8 right-6 z-40 bg-[#0055A5] px-5 py-3.5 rounded-full flex-row items-center shadow-2xl shadow-blue-600/50 border border-white/40 active:scale-95`}
              onPress={() => setShowExportModal(true)}
            >
              <Feather name="download" size={18} color="white" />
              <Text style={tw`text-white font-black text-sm ml-2 tracking-wide`}>Ekspor Detail</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Modal Pilihan Ekspor (Mobile) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showExportModal}
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={tw`flex-1 bg-black/60 justify-center items-center px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl`}>
            <View style={tw`flex-row items-center justify-between pb-4 border-b border-gray-100`}>
              <View style={tw`flex-row items-center`}>
                <View style={tw`w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center mr-3 border border-blue-100`}>
                  <Feather name="download" size={20} color="#0055A5" />
                </View>
                <View>
                  <Text style={tw`text-lg font-black text-gray-800`}>Ekspor Detail Handover</Text>
                  <Text style={tw`text-xs text-gray-400 font-medium`}>Pilih format file</Text>
                </View>
              </View>
              <TouchableOpacity
                style={tw`p-2 bg-gray-50 rounded-full`}
                onPress={() => setShowExportModal(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={tw`py-4 gap-3`}>
              {/* Opsi PDF */}
              <TouchableOpacity
                style={tw`flex-row items-center p-4 bg-red-50/60 rounded-2xl border border-red-100 active:scale-98`}
                onPress={() => {
                  setShowExportModal(false);
                  handleExportPdf();
                }}
              >
                <View style={tw`w-12 h-12 rounded-xl bg-[#ED1C24] items-center justify-center mr-3.5 shadow-md shadow-red-500/30`}>
                  <Ionicons name="document-text" size={24} color="white" />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={tw`font-black text-gray-800 text-sm`}>Dokumen PDF (.pdf)</Text>
                  <Text style={tw`text-xs text-gray-500 mt-0.5`}>Laporan resmi detail inspeksi</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Opsi Excel */}
              <TouchableOpacity
                style={tw`flex-row items-center p-4 bg-green-50/60 rounded-2xl border border-green-100 active:scale-98`}
                onPress={() => {
                  setShowExportModal(false);
                  handleExportExcel();
                }}
              >
                <View style={tw`w-12 h-12 rounded-xl bg-[#00A651] items-center justify-center mr-3.5 shadow-md shadow-green-500/30`}>
                  <Ionicons name="grid" size={24} color="white" />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={tw`font-black text-gray-800 text-sm`}>Lembar Kerja Excel (.xlsx)</Text>
                  <Text style={tw`text-xs text-gray-500 mt-0.5`}>Rekap checklist & data lengkap</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={tw`p-3 bg-gray-100 rounded-xl items-center mt-1`}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={tw`text-gray-600 font-bold text-xs`}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Full Screen Image Viewer (Premium Theme) */}
      <Modal visible={!!selectedPhoto} transparent={true} animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={tw`flex-1 bg-black/90 justify-center items-center`}>
          {/* Glass Navbar */}
          <View style={tw`absolute top-0 w-full pt-12 pb-5 px-6 flex-row justify-between items-center z-50 bg-black/60 border-b border-white/10`}>
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-white font-black text-xl tracking-wide`}>
                Preview Foto Detail
              </Text>
              <Text style={tw`text-blue-300 font-bold text-xs uppercase tracking-widest mt-0.5`}>
                Sisi {selectedPhoto?.type || 'Kendaraan'} {handover?.noPolisi ? `• ${handover.noPolisi}` : ''}
              </Text>
            </View>
            <View style={tw`flex-row items-center gap-2`}>
              <TouchableOpacity
                style={tw`flex-row items-center px-3.5 py-2 bg-white/20 rounded-full border border-white/30 active:scale-95`}
                onPress={() => setPhotoRotation(prev => (prev + 90) % 360)}
              >
                <Ionicons name="refresh" size={16} color="white" style={tw`mr-1.5`} />
                <Text style={tw`text-white font-bold text-xs`}>Putar 90° ({photoRotation}°)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`p-2.5 bg-white/20 rounded-full border border-white/30`}
                onPress={() => {
                  setSelectedPhoto(null);
                  setPhotoRotation(0);
                }}
              >
                <Ionicons name="close" size={22} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {selectedPhoto && (
            <View style={tw`w-full h-full justify-center items-center p-4 pt-24`}>
              <View style={tw`w-full h-[80%] bg-black/40 rounded-3xl overflow-hidden border border-white/10 relative justify-center items-center`}>
                <Image
                  source={{ uri: getPhotoUrl(selectedPhoto) }}
                  style={[tw`w-full h-full`, { transform: [{ rotate: `${photoRotation}deg` }] }]}
                  resizeMode="contain"
                />

                {/* Overlay Gradient for Aesthetics */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  style={tw`absolute bottom-0 w-full p-6 pt-20`}
                  pointerEvents="none"
                >
                  <View style={tw`flex-row items-center`}>
                    <View style={tw`w-12 h-12 bg-[#0055A5] rounded-2xl items-center justify-center mr-4 border border-white/30`}>
                      <Ionicons name="camera" size={24} color="white" />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-white font-extrabold text-base tracking-wider`}>Dokumentasi Visual</Text>
                      <Text style={tw`text-blue-200 font-medium text-xs mt-0.5`}>{new Date(handover.timestamp).toLocaleString('id-ID')}</Text>
                      {handover.locationLat && handover.locationLng && (
                        <Text style={tw`text-[#2ECC71] font-bold text-xs mt-1`}>
                          📍 {handover.locationLat.toFixed(5)}, {handover.locationLng.toFixed(5)}
                        </Text>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
