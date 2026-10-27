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

export default function AuditLogScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN']);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('Semua');
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

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
      fetchAuditLogs();
    };
    loadUserAndFetch();
  }, []);

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: detailModalVisible, close: () => setDetailModalVisible(false) },
      { isOpen: isLogoutVisible, close: () => setIsLogoutVisible(false) }
    ]
  });

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
      }
    } catch (error) {
      console.log('Error fetching audit logs:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    let color = '#0055A5';
    let bg = 'bg-blue-100';
    let text = 'text-blue-800';

    if (action.includes('CREATE') || action.includes('SUCCESS')) {
      bg = 'bg-green-100';
      text = 'text-green-800';
    } else if (action.includes('DELETE') || action.includes('REVOKE') || action.includes('REJECTED')) {
      bg = 'bg-red-100';
      text = 'text-red-800';
    } else if (action.includes('UPDATE') || action.includes('MAINTENANCE')) {
      bg = 'bg-amber-100';
      text = 'text-amber-800';
    }

    return (
      <View style={tw`px-2.5 py-1 rounded-full ${bg}`}>
        <Text style={tw`text-[11px] font-bold ${text}`}>{action}</Text>
      </View>
    );
  };

  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase().trim();
    const actionMatch = filterAction === 'Semua' || log.action.includes(filterAction);
    const searchMatch = !query ||
      log.action.toLowerCase().includes(query) ||
      (log.user?.name && log.user.name.toLowerCase().includes(query)) ||
      (log.user?.username && log.user.username.toLowerCase().includes(query)) ||
      (log.details && log.details.toLowerCase().includes(query));
    return actionMatch && searchMatch;
  });

  return (
    <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`}>
      <View style={tw`flex-1 flex-row`}>
        {Platform.OS === 'web' && isLargeScreen && (
          <WebSidebar
            user={user}
            activeMenu="AuditLog"
            navigation={navigation}
            handleLogout={handleLogout}
          />
        )}

        <View style={tw`flex-1 flex-col`}>
          {Platform.OS === 'web' ? (
            <WebNavbar
              title="Audit Log Sistem"
              subtitle="Pencatatan Keamanan & Aktivitas Super Admin"
              navigation={navigation}
              showBack={true}
              onBack={() => navigation.navigate('AdminDashboard')}
            />
          ) : (
            <View style={tw`p-4 bg-white border-b border-gray-200 flex-row items-center justify-between`}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2`}>
                <Feather name="arrow-left" size={24} color="#1E293B" />
              </TouchableOpacity>
              <Text style={tw`text-lg font-black text-gray-800`}>Audit Log Sistem</Text>
              <View style={tw`w-8`} />
            </View>
          )}

          <View style={tw`flex-1 p-4 sm:p-6`}>
            {/* Search & Filter */}
            <View style={tw`flex-row gap-3 mb-4`}>
              <View style={tw`flex-1 flex-row items-center bg-white px-4 py-2.5 rounded-2xl border border-gray-200 shadow-sm`}>
                <Feather name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={tw`flex-1 ml-2.5 text-sm text-gray-800`}
                  placeholder="Cari aktivitas, admin, atau detail..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity
                onPress={fetchAuditLogs}
                style={tw`bg-[#0055A5] px-4 py-2.5 rounded-2xl items-center justify-center flex-row shadow-sm`}
              >
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={tw`flex-1 justify-center items-center`}>
                <ActivityIndicator size="large" color="#0055A5" />
                <Text style={tw`mt-3 text-sm text-gray-500 font-medium`}>Memuat catatan aktivitas...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredLogs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={tw`pb-12`}
                ListEmptyComponent={
                  <View style={tw`py-12 items-center`}>
                    <Feather name="shield" size={48} color="#CBD5E1" />
                    <Text style={tw`mt-3 text-gray-500 font-medium`}>Belum ada aktivitas audit log tercatat</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedLog(item);
                      setDetailModalVisible(true);
                    }}
                    style={[
                      tw`bg-white p-4 rounded-2xl mb-3 border border-gray-100 flex-row items-center justify-between shadow-sm`,
                      { ...glassStyle }
                    ]}
                  >
                    <View style={tw`flex-1 mr-3`}>
                      <View style={tw`flex-row items-center gap-2 mb-1`}>
                        {getActionBadge(item.action)}
                        <Text style={tw`text-xs text-gray-400 font-mono`}>
                          {new Date(item.createdAt).toLocaleString('id-ID')}
                        </Text>
                      </View>
                      <Text style={tw`text-sm font-bold text-gray-800`}>
                        {item.user ? `${item.user.name} (@${item.user.username})` : 'Sistem / Anonim'}
                      </Text>
                      <Text style={tw`text-xs text-gray-500 mt-0.5`} numberOfLines={1}>
                        {item.details || 'Tidak ada detail tambahan'}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </View>

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <View style={tw`flex-1 bg-black/50 justify-center items-center p-4`}>
          <View style={tw`bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={tw`text-lg font-black text-gray-800`}>Detail Audit Log</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedLog && (
              <ScrollView style={tw`max-h-96`}>
                <View style={tw`mb-3`}>
                  <Text style={tw`text-xs text-gray-400 font-bold uppercase`}>Aksi</Text>
                  <Text style={tw`text-base font-black text-gray-800`}>{selectedLog.action}</Text>
                </View>
                <View style={tw`mb-3`}>
                  <Text style={tw`text-xs text-gray-400 font-bold uppercase`}>Pelaksana</Text>
                  <Text style={tw`text-sm font-bold text-gray-800`}>
                    {selectedLog.user ? `${selectedLog.user.name} (@${selectedLog.user.username} - ${selectedLog.user.role})` : 'Sistem'}
                  </Text>
                </View>
                <View style={tw`mb-3`}>
                  <Text style={tw`text-xs text-gray-400 font-bold uppercase`}>Waktu Eksekusi</Text>
                  <Text style={tw`text-sm font-medium text-gray-700`}>
                    {new Date(selectedLog.createdAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}
                  </Text>
                </View>
                <View style={tw`mb-3`}>
                  <Text style={tw`text-xs text-gray-400 font-bold uppercase`}>Detail Parameter</Text>
                  <View style={tw`bg-gray-50 p-3 rounded-xl border border-gray-200 mt-1`}>
                    <Text style={tw`text-xs font-mono text-gray-700`}>
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                        } catch (_) {
                          return selectedLog.details || '-';
                        }
                      })()}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={() => setDetailModalVisible(false)}
              style={tw`mt-4 bg-[#0055A5] py-3 rounded-2xl items-center`}
            >
              <Text style={tw`text-white font-bold text-sm`}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

