import Toast from 'react-native-toast-message';
import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Dimensions, Modal } from 'react-native';
import tw from 'twrnc';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';

const getPhotoUrl = (path, token) => {
  if (!path) return `${API_URL}/uploads/default.png${token ? '?token=' + token : ''}`;
  const cleanPath = path.replace(/\\/g, '/');
  let url = cleanPath.startsWith('http') ? cleanPath : `${API_URL}/${cleanPath.replace(/^\/+/, '')}`;
  if (token && !url.includes('?token=')) {
    url += `?token=${token}`;
  }
  return url;
};
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';
import { handleLogoutAndReset } from '../../utils/authHelper';

export default function IssueDetailScreen({ route, navigation }) {
  useRoleGuard(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS', 'AMT']);
  const targetId = route.params?.issueId || route.params?.handoverId || route.params?.actionId || route.params?.id;
  const targetNopol = route.params?.noPolisi;

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  const handleLogout = async () => {
    await handleLogoutAndReset(navigation);
  };

  const [issue, setIssue] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [loading, setLoading] = useState(true);
  
  // evaluations: { [itemId]: { approved: true/false, reason: string } }
  const [evaluations, setEvaluations] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState(null);
  const [previewRotation, setPreviewRotation] = useState(0);

  useSubpageBackHandler({
    navigation,
    user: currentUser,
    modals: [
      { isOpen: !!selectedPreviewPhoto, close: () => setSelectedPreviewPhoto(null) },
      { isOpen: confirmModalVisible, close: () => setConfirmModalVisible(false) },
      { isOpen: resolveModalVisible, close: () => setResolveModalVisible(false) },
    ]
  });

  useEffect(() => {
    loadUser();
    fetchIssueDetail();
    AsyncStorage.getItem('token').then(t => setAuthToken(t || ''));
  }, [targetId, targetNopol]);

  const loadUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setCurrentUser(JSON.parse(userStr));
    } catch (e) {
      console.log('Error loading user:', e);
    }
  };

  const getAuthHeaders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch (e) {
      return {};
    }
  };

  const fetchIssueDetail = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      let foundIssue = null;

      // 1. Coba fetch langsung via endpoint /api/issues/:id jika ada targetId
      if (targetId) {
        try {
          const res = await axios.get(`${API_URL}/api/issues/${targetId}`, { headers });
          if (res.data && res.data.id) {
            foundIssue = res.data;
          }
        } catch (err) {
          // Lanjut ke fallback jika 404
        }
      }

      // 2. Fallback: jika belum ketemu dan ada targetNopol, coba endpoint /api/issues/:noPolisi
      if (!foundIssue && targetNopol) {
        try {
          const res = await axios.get(`${API_URL}/api/issues/${encodeURIComponent(targetNopol)}`, { headers });
          if (res.data && res.data.id) {
            foundIssue = res.data;
          }
        } catch (err) {
          // Lanjut ke fallback daftar semua
        }
      }

      // 3. Fallback: ambil semua issues dan cari berdasarkan ID, handoverId, atau noPolisi
      if (!foundIssue) {
        const res = await axios.get(`${API_URL}/api/issues`, { headers });
        const allIssues = res.data || [];
        const cleanTargetNopol = targetNopol ? targetNopol.replace(/\s+/g, '').toUpperCase() : null;

        foundIssue = allIssues.find(i => {
          const matchId = targetId && (
            i.id === targetId || 
            i.handoverId === targetId || 
            i.handover?.id === targetId
          );
          if (matchId) return true;

          if (cleanTargetNopol && i.handover?.noPolisi) {
            const cleanIssueNopol = i.handover.noPolisi.replace(/\s+/g, '').toUpperCase();
            if (cleanIssueNopol === cleanTargetNopol) return true;
          }
          return false;
        });
      }

      if (foundIssue) {
        setIssue(foundIssue);
        // Initialize evaluations for items that are not good
        const initialEvals = {};
        const brokenItems = (foundIssue.handover?.items || []).filter(i => !i.isGood);
        brokenItems.forEach(item => {
          initialEvals[item.id] = { 
            approved: item.isRepaired ? true : null,
            reason: item.adminRejectionNote || '' 
          };
        });
        setEvaluations(initialEvals);
      } else {
        setIssue(null);
      }
    } catch (error) {
      console.error('Error fetching issue detail:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Gagal memuat data isu kendaraan.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (itemId) => {
    setEvaluations(prev => ({ ...prev, [itemId]: { approved: true, reason: '' } }));
  };

  const handleReject = (itemId) => {
    setEvaluations(prev => ({ ...prev, [itemId]: { ...prev[itemId], approved: false } }));
  };

  const updateReason = (itemId, text) => {
    setEvaluations(prev => ({ ...prev, [itemId]: { ...prev[itemId], reason: text } }));
  };

  const submitEvaluation = async () => {
    if (!issue || !issue.handover?.items) return;
    const brokenItems = issue.handover.items.filter(i => !i.isGood);
    const hasUnevaluated = brokenItems.some(i => evaluations[i.id]?.approved === null);
    
    if (hasUnevaluated) {
      Toast.show({
        type: 'info',
        text1: 'Belum Selesai',
        text2: 'Mohon evaluasi semua kerusakan (Terima/Tolak) sebelum mengirim.'
      });
      return;
    }

    const hasRejectedWithoutReason = brokenItems.some(i => evaluations[i.id]?.approved === false && (!evaluations[i.id]?.reason || evaluations[i.id].reason.trim() === ''));
    
    if (hasRejectedWithoutReason) {
      Toast.show({
        type: 'info',
        text1: 'Alasan Diperlukan',
        text2: 'Untuk perbaikan yang ditolak, alasan penolakan wajib diisi.'
      });
      return;
    }

    setConfirmModalVisible(true);
  };

  const confirmEvaluate = async () => {
    if (!issue) return;
    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const evalArray = Object.keys(evaluations).map(itemId => ({
        itemId,
        approved: evaluations[itemId].approved,
        reason: evaluations[itemId].reason
      }));

      await axios.post(`${API_URL}/api/issues/${issue.id}/evaluate-repair`, { evaluations: evalArray }, { headers });
      Toast.show({ type: 'success', text1: 'Sukses', text2: 'Verifikasi perbaikan berhasil dikirim.' });
      setConfirmModalVisible(false);
      setTimeout(() => navigation.goBack(), 1200);
    } catch (error) {
      console.error('Error evaluating repair:', error);
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Terjadi kesalahan saat mengirim evaluasi.'
      });
      setConfirmModalVisible(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectResolve = async () => {
    if (!issue) return;
    setIsResolving(true);
    try {
      const headers = await getAuthHeaders();
      await axios.put(`${API_URL}/api/issues/${issue.id}/resolve`, {}, { headers });
      Toast.show({
        type: 'success',
        text1: 'Isu Diselesaikan',
        text2: `Kendaraan ${issue.handover?.noPolisi || ''} telah diaktifkan kembali.`
      });
      setResolveModalVisible(false);
      setTimeout(() => navigation.goBack(), 1200);
    } catch (error) {
      console.error('Error resolving issue:', error);
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Terjadi kesalahan saat menyelesaikan isu kendaraan.'
      });
      setResolveModalVisible(false);
    } finally {
      setIsResolving(false);
    }
  };

  // Helper untuk mencari foto kerusakan awal saat serah terima
  const getHandoverDamagePhoto = (itemName) => {
    if (!issue?.handover?.photos) return null;
    const clean = itemName.replace(/\[MAJOR\]|\[MINOR\]/gi, '').trim().toLowerCase();
    return issue.handover.photos.find(p => {
      const pType = (p.type || '').toLowerCase();
      return pType.includes(clean) || clean.includes(pType.replace('kerusakan:', '').trim());
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={tw`flex-1 bg-[#F4F7FA] ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
        {isLargeScreen && currentUser && (
          <WebSidebar
            user={currentUser}
            activeMenu={'IssueList'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color="#ED1C24" />
          <Text style={tw`text-gray-500 font-bold mt-4 text-sm`}>Memuat data isu kendaraan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!issue) {
    return (
      <SafeAreaView style={tw`flex-1 bg-[#F4F7FA] ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
        {isLargeScreen && currentUser && (
          <WebSidebar
            user={currentUser}
            activeMenu={'IssueList'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}
        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
          {/* Header */}
          <WebNavbar showBack={true}
            user={currentUser}
            activeMenu={'IssueList'}
            title="Detail Isu Kendaraan"
            subtitle="Isu Tidak Ditemukan"
            onBack={() => {
              if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else if (navigation && typeof navigation.replace === 'function') {
                navigation.replace('IssueList');
              }
            }}
          />

          {/* Empty State Card */}
          <View style={tw`flex-1 items-center justify-center p-6`}>
            <View style={tw`w-24 h-24 bg-red-100 rounded-full items-center justify-center mb-5`}>
              <Ionicons name="alert-circle-outline" size={54} color="#ED1C24" />
            </View>
            <Text style={tw`text-xl font-black text-gray-800 text-center mb-2`}>Isu Tidak Ditemukan</Text>
            <Text style={tw`text-sm text-gray-500 text-center leading-relaxed mb-6 max-w-xs`}>
              Isu untuk kendaraan ini mungkin telah diselesaikan, atau riwayat data telah diperbarui.
            </Text>
            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity 
                style={tw`bg-[#0055A5] px-6 py-3.5 rounded-2xl flex-row items-center shadow-md`}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={18} color="white" style={tw`mr-2`} />
                <Text style={tw`text-white font-bold text-sm`}>Kembali</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={tw`bg-gray-100 px-6 py-3.5 rounded-2xl flex-row items-center`}
                onPress={fetchIssueDetail}
              >
                <Ionicons name="refresh" size={18} color="#4B5563" style={tw`mr-2`} />
                <Text style={tw`text-gray-700 font-bold text-sm`}>Coba Lagi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const brokenItems = (issue.handover?.items || []).filter(i => !i.isGood);
  const canAdminResolve = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'PENGAWAS';

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-[#F4F7FA]`} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={tw`flex-1 ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
        {isLargeScreen && currentUser && (
          <WebSidebar
            user={currentUser}
            activeMenu={'IssueList'}
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}

        <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
          {/* Header diganti WebNavbar untuk konsistensi */}
          <WebNavbar showBack={true}
            user={currentUser}
            activeMenu={'IssueList'}
            title="Detail Isu Kendaraan"
            subtitle={issue.handover?.noPolisi || 'Kendaraan'}
            onBack={() => {
              if (navigation && navigation.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else if (navigation && typeof navigation.replace === 'function') {
                navigation.replace('IssueList');
              }
            }}
            rightAction={
              issue.handoverId ? (
                <TouchableOpacity 
                  style={tw`flex-row items-center bg-white/90 px-4 py-2 rounded-xl border border-blue-100 shadow-sm mr-2`}
                  onPress={() => navigation.navigate('HandoverDetail', { 
                    handoverId: issue.handoverId, 
                    handover: issue.handover,
                    noPolisi: issue.handover?.noPolisi 
                  })}
                >
                  <Feather name="file-text" size={16} color="#0055A5" />
                  <Text style={tw`text-xs font-bold text-[#0055A5] ml-2`}>Lihat Handover</Text>
                </TouchableOpacity>
              ) : null
            }
          />

          <ScrollView contentContainerStyle={tw`p-5 pb-36 max-w-5xl mx-auto w-full`} showsVerticalScrollIndicator={false}>
          {/* Status Banner */}
          <View style={tw`mb-5`}>
            {issue.status === 'ONGOING' && (
              <View style={tw`bg-amber-50 border border-amber-200 rounded-2xl p-4 flex-row items-start shadow-sm`}>
                <View style={tw`w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3 mt-0.5`}>
                  <Ionicons name="time" size={22} color="#D97706" />
                </View>
                <View style={tw`flex-1`}>
                  <View style={tw`flex-row items-center justify-between mb-1`}>
                    <Text style={tw`text-sm font-black text-amber-800 uppercase tracking-wider`}>Sedang Dalam Perbaikan</Text>
                    <View style={tw`bg-amber-200/80 px-2 py-0.5 rounded-full`}>
                      <Text style={tw`text-[10px] font-black text-amber-900`}>DIBLOKIR</Text>
                    </View>
                  </View>
                  <Text style={tw`text-xs text-amber-700 leading-relaxed`}>
                    Kendaraan ini dilaporkan memiliki kendala pada serah terima. AMT sedang melakukan perbaikan atau belum mengirim foto bukti verifikasi.
                  </Text>
                </View>
              </View>
            )}

            {issue.status === 'PENDING_APPROVAL' && (
              <View style={tw`bg-blue-50 border border-blue-200 rounded-2xl p-4 flex-row items-start shadow-sm`}>
                <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3 mt-0.5`}>
                  <Ionicons name="checkmark-circle" size={22} color="#0055A5" />
                </View>
                <View style={tw`flex-1`}>
                  <View style={tw`flex-row items-center justify-between mb-1`}>
                    <Text style={tw`text-sm font-black text-blue-800 uppercase tracking-wider`}>Menunggu Persetujuan</Text>
                    <View style={tw`bg-blue-200 px-2 py-0.5 rounded-full`}>
                      <Text style={tw`text-[10px] font-black text-blue-900`}>REVIEW</Text>
                    </View>
                  </View>
                  <Text style={tw`text-xs text-blue-700 leading-relaxed`}>
                    AMT telah mengunggah bukti perbaikan. Silakan periksa setiap bukti dan beri persetujuan untuk mengaktifkan kendaraan kembali.
                  </Text>
                </View>
              </View>
            )}

            {issue.status === 'RESOLVED' && (
              <View style={tw`bg-green-50 border border-green-200 rounded-2xl p-4 flex-row items-start shadow-sm`}>
                <View style={tw`w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3 mt-0.5`}>
                  <Ionicons name="checkmark-done-circle" size={22} color="#16A34A" />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={tw`text-sm font-black text-green-800 uppercase tracking-wider mb-1`}>Isu Telah Selesai</Text>
                  <Text style={tw`text-xs text-green-700 leading-relaxed`}>
                    Kendaraan ini telah selesai diperbaiki dan telah disetujui untuk kembali beroperasi normal.
                  </Text>
                  {issue.resolvedAt && (
                    <Text style={tw`text-[11px] text-green-600 font-bold mt-1.5`}>
                      Diselesaikan pada: {new Date(issue.resolvedAt).toLocaleString('id-ID')}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Card Info Ringkas Kendaraan */}
          <View style={tw`bg-white p-5 rounded-2xl mb-6 shadow-sm border border-gray-100`}>
            <Text style={tw`text-xs font-black text-gray-400 uppercase tracking-wider mb-3`}>Informasi Serah Terima Terkait</Text>
            <View style={tw`flex-row justify-between items-center py-2 border-b border-gray-50`}>
              <Text style={tw`text-xs font-bold text-gray-500`}>Nomor Polisi</Text>
              <Text style={tw`text-sm font-black text-gray-800`}>{issue.handover?.noPolisi || '-'}</Text>
            </View>
            <View style={tw`flex-row justify-between items-center py-2 border-b border-gray-50`}>
              <Text style={tw`text-xs font-bold text-gray-500`}>Pelapor / AMT</Text>
              <Text style={tw`text-sm font-bold text-gray-800`}>{issue.handover?.amt1 || issue.handover?.user?.name || '-'}</Text>
            </View>
            <View style={tw`flex-row justify-between items-center py-2 border-b border-gray-50`}>
              <Text style={tw`text-xs font-bold text-gray-500`}>Waktu Laporan</Text>
              <Text style={tw`text-xs font-bold text-gray-700`}>
                {new Date(issue.createdAt || issue.handover?.createdAt).toLocaleString('id-ID')}
              </Text>
            </View>
            <View style={tw`flex-row justify-between items-center pt-2`}>
              <Text style={tw`text-xs font-bold text-gray-500`}>Shift</Text>
              <Text style={tw`text-xs font-bold text-gray-700`}>Shift {issue.handover?.shift || '-'} ({issue.handover?.type || 'mulai'})</Text>
            </View>
          </View>

          {/* Section Daftar Kerusakan */}
          <View style={tw`mb-4 flex-row items-center justify-between`}>
            <Text style={tw`text-base font-black text-gray-800`}>Daftar Temuan Kerusakan ({brokenItems.length})</Text>
            <View style={tw`bg-red-50 px-2.5 py-1 rounded-full border border-red-100`}>
              <Text style={tw`text-[11px] font-black text-red-600`}>Perlu Ditindaklanjuti</Text>
            </View>
          </View>

          {brokenItems.length === 0 ? (
            <View style={tw`bg-white p-6 rounded-2xl items-center justify-center border border-gray-100 shadow-sm`}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
              <Text style={tw`text-gray-600 font-bold mt-2 text-center`}>Tidak ada item spesifik yang rusak.</Text>
            </View>
          ) : (
            brokenItems.map((item, index) => {
              const evalState = evaluations[item.id];
              const isApproved = evalState?.approved === true;
              const isRejected = evalState?.approved === false;
              const handoverPhoto = getHandoverDamagePhoto(item.name);

              return (
                <View key={item.id} style={tw`bg-white p-5 rounded-2xl mb-5 shadow-sm border ${isApproved ? 'border-green-300' : isRejected ? 'border-red-300' : 'border-gray-200'}`}>
                  {/* Category & Name */}
                  <View style={tw`flex-row items-center mb-3 pb-3 border-b border-gray-100`}>
                    <View style={tw`w-10 h-10 rounded-full ${item.category === "B" ? "bg-blue-100" : "bg-red-100"} items-center justify-center mr-3`}>
                      <Ionicons name={item.category === "B" ? "person" : "construct"} size={20} color={item.category === "B" ? "#0055A5" : "#ED1C24"} />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-black text-gray-400 uppercase tracking-wider`}>
                        {item.category === "B" ? "B. PERLENGKAPAN AMT" : "A. PERLENGKAPAN TANGKI"}
                      </Text>
                      <Text style={tw`text-base font-black text-gray-800`}>{item.name}</Text>
                    </View>
                    <View style={tw`bg-red-100 px-2 py-0.5 rounded-full`}>
                      <Text style={tw`text-[10px] font-black text-red-700`}>RUSAK</Text>
                    </View>
                  </View>

                  {/* Foto Temuan Kerusakan Awal saat Handover */}
                  {handoverPhoto && (
                    <View style={tw`mb-4`}>
                      <Text style={tw`text-xs font-bold text-gray-600 mb-1.5`}>Foto Temuan Saat Serah Terima:</Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedPreviewPhoto({
                            title: 'Foto Temuan Kerusakan',
                            subtitle: item.name,
                            url: handoverPhoto.previewUrl || handoverPhoto.url,
                            type: item.category === "B" ? "Perlengkapan AMT" : "Perlengkapan Tangki",
                            nopol: issue.handover?.noPolisi,
                            timestamp: issue.handover?.timestamp
                          });
                          setPreviewRotation(0);
                        }}
                        style={tw`relative rounded-xl overflow-hidden shadow-sm`}
                      >
                        <Image 
                          source={{ uri: getPhotoUrl(handoverPhoto.previewUrl || handoverPhoto.url, authToken) }}
                          style={tw`w-full h-48 rounded-xl bg-gray-100`} 
                          resizeMode="cover"
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.75)']}
                          style={tw`absolute inset-0 justify-end p-3`}
                        >
                          <View style={tw`flex-row items-center justify-between`}>
                            <View style={tw`flex-row items-center bg-black/60 px-2.5 py-1 rounded-full border border-white/20`}>
                              <Ionicons name="scan-outline" size={13} color="white" style={tw`mr-1.5`} />
                              <Text style={tw`text-white text-[11px] font-bold`}>Ketuk untuk Zoom / Putar</Text>
                            </View>
                            <View style={tw`bg-red-500/90 px-2 py-0.5 rounded`}>
                              <Text style={tw`text-white text-[10px] font-bold`}>Temuan Handover</Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Info Perbaikan dari AMT */}
                  <View style={tw`mb-3`}>
                    {item.repairNote ? (
                      <View style={tw`bg-blue-50 p-3 rounded-xl mb-3 border border-blue-100`}>
                        <Text style={tw`text-xs font-bold text-blue-800 mb-0.5`}>
                          {item.category === "B" ? "Catatan Kelengkapan (AMT):" : "Catatan Perbaikan (AMT):"}
                        </Text>
                        <Text style={tw`text-sm text-gray-700`}>{item.repairNote}</Text>
                      </View>
                    ) : (
                      <View style={tw`bg-amber-50/70 p-3 rounded-xl mb-3 border border-amber-100 flex-row items-center`}>
                        <Ionicons name="time-outline" size={16} color="#D97706" style={tw`mr-2`} />
                        <Text style={tw`text-xs text-amber-800 font-medium flex-1`}>Belum ada catatan perbaikan dari AMT.</Text>
                      </View>
                    )}

                    {item.repairPhotoUrl ? (
                      <View style={tw`mb-3`}>
                        <Text style={tw`text-xs font-bold text-gray-600 mb-1.5`}>Foto Bukti Perbaikan (AMT):</Text>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => {
                            setSelectedPreviewPhoto({
                              title: 'Foto Bukti Perbaikan (AMT)',
                              subtitle: item.name,
                              url: item.repairPhotoUrl,
                              type: 'Bukti Perbaikan Selesai',
                              nopol: issue.handover?.noPolisi,
                              timestamp: issue.updatedAt || issue.createdAt
                            });
                            setPreviewRotation(0);
                          }}
                          style={tw`relative rounded-xl overflow-hidden shadow-sm`}
                        >
                          <Image 
                            source={{ uri: getPhotoUrl(item.repairPhotoUrl, authToken) }}
                            style={tw`w-full h-48 rounded-xl bg-gray-100`} 
                            resizeMode="cover"
                          />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.75)']}
                            style={tw`absolute inset-0 justify-end p-3`}
                          >
                            <View style={tw`flex-row items-center justify-between`}>
                              <View style={tw`flex-row items-center bg-black/60 px-2.5 py-1 rounded-full border border-white/20`}>
                                <Ionicons name="scan-outline" size={13} color="white" style={tw`mr-1.5`} />
                                <Text style={tw`text-white text-[11px] font-bold`}>Ketuk untuk Zoom / Putar</Text>
                              </View>
                              <View style={tw`bg-green-600/90 px-2 py-0.5 rounded`}>
                                <Text style={tw`text-white text-[10px] font-bold`}>Bukti Perbaikan</Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={tw`bg-gray-50 p-3 rounded-xl border border-gray-100 flex-row items-center`}>
                        <Ionicons name="image-outline" size={16} color="#9CA3AF" style={tw`mr-2`} />
                        <Text style={tw`text-xs text-gray-400 font-medium`}>Belum ada foto bukti perbaikan yang diunggah.</Text>
                      </View>
                    )}
                  </View>

                  {/* Evaluasi Admin jika PENDING_APPROVAL */}
                  {issue.status === 'PENDING_APPROVAL' && (
                    <View style={tw`mt-2 pt-3 border-t border-gray-100`}>
                      <Text style={tw`text-xs font-bold text-gray-600 mb-2`}>Keputusan Evaluasi:</Text>
                      <View style={tw`flex-row gap-3 mb-2`}>
                        <TouchableOpacity 
                          style={tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl border ${isApproved ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`}
                          onPress={() => handleApprove(item.id)}
                        >
                          <Ionicons name="checkmark-circle" size={18} color={isApproved ? "white" : "#9CA3AF"} style={tw`mr-1.5`} />
                          <Text style={tw`font-bold text-xs ${isApproved ? 'text-white' : 'text-gray-600'}`}>Setujui (Selesai)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl border ${isRejected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300'}`}
                          onPress={() => handleReject(item.id)}
                        >
                          <Ionicons name="close-circle" size={18} color={isRejected ? "white" : "#9CA3AF"} style={tw`mr-1.5`} />
                          <Text style={tw`font-bold text-xs ${isRejected ? 'text-white' : 'text-gray-600'}`}>Tolak</Text>
                        </TouchableOpacity>
                      </View>

                      {isRejected && (
                        <View style={tw`mt-2`}>
                          <Text style={tw`text-xs font-bold text-red-600 mb-1`}>Alasan Penolakan (Wajib):</Text>
                          <TextInput
                            style={tw`bg-red-50 border border-red-200 p-2.5 rounded-xl text-xs text-gray-800`}
                            placeholder="Tulis alasan penolakan untuk AMT..."
                            placeholderTextColor="#999"
                            value={evalState?.reason || ''}
                            onChangeText={(text) => updateReason(item.id, text)}
                            multiline
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Status jika RESOLVED */}
                  {issue.status === 'RESOLVED' && (
                    <View style={tw`mt-2 pt-2 border-t border-gray-100 flex-row items-center`}>
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={tw`mr-1.5`} />
                      <Text style={tw`text-xs font-bold text-green-700`}>Telah Disetujui & Selesai</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* Opsi Bypass Selesai Langsung untuk Admin jika status ONGOING */}
          {issue.status === 'ONGOING' && canAdminResolve && (
            <View style={tw`mt-2 mb-6 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm`}>
              <Text style={tw`text-xs font-bold text-gray-700 mb-1`}>Tindakan Langsung Admin / Pengawas</Text>
              <Text style={tw`text-[11px] text-gray-400 mb-3`}>
                Jika kendaraan sudah diperiksa langsung di lapangan atau isu telah terselesaikan tanpa verifikasi sistem, Anda dapat menyelesaikan isu dan membuka blokir kendaraan sekarang.
              </Text>
              <TouchableOpacity
                style={tw`bg-green-600 py-3 rounded-xl flex-row items-center justify-center shadow-sm`}
                onPress={() => setResolveModalVisible(true)}
              >
                <Ionicons name="checkmark-done" size={18} color="white" style={tw`mr-2`} />
                <Text style={tw`text-white font-bold text-xs`}>Buka Blokir & Selesaikan Isu</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button untuk PENDING_APPROVAL */}
        {issue.status === 'PENDING_APPROVAL' && (
          <View style={tw`absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 shadow-lg`}>
            <TouchableOpacity 
              style={tw`w-full bg-[#0055A5] p-4 rounded-2xl items-center shadow-lg ${isSubmitting ? 'opacity-70' : ''}`}
              onPress={submitEvaluation}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={tw`text-white font-black text-base`}>Kirim Hasil Evaluasi</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        </View>

        {/* Confirm Modal Evaluasi */}
        <ConfirmModal
          visible={confirmModalVisible}
          title="Konfirmasi Verifikasi"
          message="Apakah Anda yakin ingin mengirim hasil verifikasi perbaikan ini?"
          confirmText="Ya, Kirim"
          confirmColor="#0055A5"
          icon="check-circle"
          onConfirm={confirmEvaluate}
          onCancel={() => setConfirmModalVisible(false)}
        />

        {/* Confirm Modal Direct Resolve */}
        <ConfirmModal
          visible={resolveModalVisible}
          title="Buka Blokir Kendaraan?"
          message={`Apakah Anda yakin ingin menyelesaikan isu dan membuka blokir untuk kendaraan ${issue.handover?.noPolisi || ''}?`}
          confirmText="Ya, Selesaikan"
          confirmColor="#16A34A"
          icon="checkmark-done-circle"
          onConfirm={handleDirectResolve}
          onCancel={() => setResolveModalVisible(false)}
        />

        {/* Modal Full Screen Image Viewer (Preview Foto Detail & Putar) */}
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
                  {selectedPreviewPhoto?.subtitle} {selectedPreviewPhoto?.nopol ? `• ${selectedPreviewPhoto.nopol}` : ''}
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
                          {selectedPreviewPhoto.timestamp ? new Date(selectedPreviewPhoto.timestamp).toLocaleString('id-ID') : 'Foto Dokumentasi'}
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
    </KeyboardAvoidingView>
  );
}
