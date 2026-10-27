import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Platform, Modal, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';
import { handleLogoutAndReset } from '../../utils/authHelper';

const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

export default function ActiveSessionsScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN']);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  // Revoke Modal
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Logout state
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const handleLogout = () => setIsLogoutVisible(true);
  const handleCancelLogout = () => setIsLogoutVisible(false);
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

  useEffect(() => {
    const loadUserAndFetch = async () => {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
      fetchActiveSessions();
    };
    loadUserAndFetch();
  }, []);

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: revokeModalVisible, close: () => setRevokeModalVisible(false) },
      { isOpen: isLogoutVisible, close: () => setIsLogoutVisible(false) }
    ]
  });

  const fetchActiveSessions = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admins/sessions/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setSessions(res.data.activeSessions || []);
      }
    } catch (error) {
      console.log('Error fetching active sessions:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRevokeModal = (target) => {
    setTargetUser(target);
    setRevokeReason('');
    setFeedback(null);
    setRevokeModalVisible(true);
  };

  const handleRevokeSession = async () => {
    if (!revokeReason.trim()) {
      setFeedback({ type: 'error', message: 'Alasan pencabutan sesi wajib diisi demi kepatuhan audit log.' });
      return;
    }

    try {
      setRevoking(true);
      setFeedback(null);
      const token = await AsyncStorage.getItem('token');
      const res = await axios.post(`${API_URL}/api/admins/sessions/${targetUser.id}/revoke`, {
        reason: revokeReason.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setRevokeModalVisible(false);
        fetchActiveSessions();
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.error || 'Gagal mencabut sesi pengguna.'
      });
    } finally {
      setRevoking(false);
    }
  };

  const formatRemainingMinutes = (seconds) => {
    if (seconds <= 0) return 'Kadaluarsa';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`}>
      <View style={tw`flex-1 flex-row`}>
        {Platform.OS === 'web' && isLargeScreen && (
          <WebSidebar
            user={user}
            activeMenu="ActiveSessions"
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}

        <View style={tw`flex-1 flex-col`}>
          {Platform.OS === 'web' ? (
            <WebNavbar
              title="Manajemen Sesi Aktif"
              subtitle="Pantau & Cabut Sesi Pengguna Sistem"
              navigation={navigation}
              showBack={true}
              onBack={() => navigation.navigate('AdminDashboard')}
            />
          ) : (
            <View style={tw`p-4 bg-white border-b border-gray-200 flex-row items-center justify-between`}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2`}>
                <Feather name="arrow-left" size={24} color="#1E293B" />
              </TouchableOpacity>
              <Text style={tw`text-lg font-black text-gray-800`}>Sesi Aktif</Text>
              <View style={tw`w-8`} />
            </View>
          )}

          <View style={tw`flex-1 p-4 sm:p-6`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={tw`text-sm font-bold text-gray-600`}>
                Total Sesi Berjalan: <Text style={tw`text-[#0055A5] font-black`}>{sessions.length}</Text>
              </Text>
              <TouchableOpacity
                onPress={fetchActiveSessions}
                style={tw`bg-[#0055A5] px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm`}
              >
                <Feather name="refresh-cw" size={14} color="#FFFFFF" />
                <Text style={tw`text-xs font-bold text-white`}>Segarkan</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={tw`flex-1 justify-center items-center`}>
                <ActivityIndicator size="large" color="#0055A5" />
                <Text style={tw`mt-3 text-sm text-gray-500 font-medium`}>Memeriksa sesi pengguna...</Text>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={tw`pb-12`}
                ListEmptyComponent={
                  <View style={tw`py-12 items-center`}>
                    <Feather name="user-x" size={48} color="#CBD5E1" />
                    <Text style={tw`mt-3 text-gray-500 font-medium`}>Tidak ada sesi pengguna yang sedang aktif</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isCurrentSelf = user?.id === item.id;
                  return (
                    <View
                      style={[
                        tw`bg-white p-4 rounded-2xl mb-3 border border-gray-100 flex-col sm:flex-row sm:items-center justify-between shadow-sm`,
                        { ...glassStyle }
                      ]}
                    >
                      <View style={tw`flex-1 mb-3 sm:mb-0 mr-3`}>
                        <View style={tw`flex-row items-center gap-2 mb-1`}>
                          <Text style={tw`text-base font-black text-gray-800`}>{item.name}</Text>
                          <View style={tw`px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200`}>
                            <Text style={tw`text-[10px] font-black text-blue-700`}>{item.role}</Text>
                          </View>
                          {isCurrentSelf && (
                            <View style={tw`px-2 py-0.5 rounded-full bg-green-50 border border-green-200`}>
                              <Text style={tw`text-[10px] font-black text-green-700`}>Sesi Anda</Text>
                            </View>
                          )}
                        </View>
                        <Text style={tw`text-xs text-gray-500`}>@{item.username} • {item.jabatan || 'Staf Operasional'}</Text>

                        <View style={tw`flex-row flex-wrap gap-x-4 gap-y-1 mt-2`}>
                          <Text style={tw`text-xs text-gray-400`}>
                            Mulai: <Text style={tw`text-gray-700 font-medium`}>{new Date(item.sessionStartedAt).toLocaleTimeString('id-ID')}</Text>
                          </Text>
                          <Text style={tw`text-xs text-gray-400`}>
                            Aktivitas Terakhir: <Text style={tw`text-gray-700 font-medium`}>{new Date(item.sessionLastActivityAt).toLocaleTimeString('id-ID')}</Text>
                          </Text>
                          <Text style={tw`text-xs text-amber-600 font-medium`}>
                            Sisa Idle: {formatRemainingMinutes(item.remainingIdleSeconds)}
                          </Text>
                          <Text style={tw`text-xs text-blue-600 font-medium`}>
                            Sisa Maks: {formatRemainingMinutes(item.remainingAbsoluteSeconds)}
                          </Text>
                        </View>
                      </View>

                      {!isCurrentSelf && (
                        <TouchableOpacity
                          onPress={() => handleOpenRevokeModal(item)}
                          style={tw`bg-red-50 hover:bg-red-100 border border-red-200 px-3.5 py-2 rounded-xl flex-row items-center self-start sm:self-center gap-1.5`}
                        >
                          <Feather name="log-out" size={14} color="#DC2626" />
                          <Text style={tw`text-xs font-bold text-red-600`}>Cabut Sesi</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </View>

      {/* Revoke Confirmation Modal */}
      <Modal visible={revokeModalVisible} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/60 justify-center items-center p-4`}>
          <View style={tw`bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl`}>
            <View style={tw`w-12 h-12 bg-red-100 rounded-full items-center justify-center self-center mb-3`}>
              <Feather name="alert-triangle" size={24} color="#DC2626" />
            </View>

            <Text style={tw`text-lg font-black text-gray-800 text-center mb-1`}>
              Cabut Sesi Pengguna
            </Text>
            <Text style={tw`text-xs text-gray-500 text-center mb-4`}>
              Pengguna <Text style={tw`font-bold text-gray-800`}>{targetUser?.name}</Text> akan langsung dikeluarkan dari sistem secara seketika.
            </Text>

            {feedback && (
              <View style={tw`mb-3 p-3 rounded-xl bg-red-50 border border-red-200`}>
                <Text style={tw`text-xs text-red-700 font-medium`}>{feedback.message}</Text>
              </View>
            )}

            <Text style={tw`text-xs font-bold text-gray-700 mb-1.5 uppercase`}>
              Alasan Pencabutan (Wajib)
            </Text>
            <TextInput
              style={tw`border border-gray-300 rounded-xl p-3 text-sm text-gray-800 mb-4 h-20 text-top`}
              placeholder="Contoh: Permintaan reset keamanan, pergantian perangkat, dll."
              multiline
              value={revokeReason}
              onChangeText={setRevokeReason}
            />

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                onPress={() => setRevokeModalVisible(false)}
                disabled={revoking}
                style={tw`flex-1 bg-gray-100 py-3 rounded-xl items-center`}
              >
                <Text style={tw`text-gray-700 font-bold text-sm`}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRevokeSession}
                disabled={revoking}
                style={tw`flex-1 bg-red-600 py-3 rounded-xl items-center flex-row justify-center gap-2`}
              >
                {revoking && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text style={tw`text-white font-bold text-sm`}>Ya, Cabut Sesi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

