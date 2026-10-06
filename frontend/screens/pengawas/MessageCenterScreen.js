import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, Animated, Easing, Dimensions, Image, Modal, ActivityIndicator, ScrollView } from 'react-native';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../config';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';

const glassStyle = Platform.OS === 'web' ? { backdropFilter: 'blur(24px)' } : {};

import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';
import { handleLogoutAndReset } from '../../utils/authHelper';

export default function MessageCenterScreen({ navigation }) {
  useRoleGuard(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS', 'AMT']);
  const [messages, setMessages] = useState([]);
  const unreadNotificationsCount = 0;
  const [loading, setLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState('Messages');
  const [previousMenu, setPreviousMenu] = useState('Messages');
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const isLargeScreen = screenWidth > 768;

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: !!selectedMessage, close: () => setSelectedMessage(null) },
      { isOpen: isLogoutVisible, close: () => setIsLogoutVisible(false) },
    ]
  });

  const orb1TranslateY = React.useRef(new Animated.Value(0)).current;
  const orb2TranslateY = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const subscription = Dimensions.addEventListener('change', onChange);
    
    const loadUser = async () => {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setUser(JSON.parse(userStr));
    };
    loadUser();
    fetchMessages();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1TranslateY, { toValue: -40, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orb1TranslateY, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2TranslateY, { toValue: 50, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orb2TranslateY, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 1500, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();
    
    return () => subscription?.remove();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setMessages(res.data.notifications.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type ? n.type.toLowerCase() : 'info',
          read: n.isRead,
          time: new Date(n.createdAt).toLocaleString('id-ID'),
          actionType: n.actionType || null,
          actionId: n.actionId || null,
          noPolisi: n.noPolisi || null,
        })));
      }
    } catch (error) {
      console.log("Error fetching notifications:", error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        await handleLogoutAndReset(navigation);
      }
    } finally {
      setLoading(false);
    }
  };

  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });

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

  const markAsRead = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    } catch (error) {
      console.log("Error updating notification:", error.message);
    }
  };

  const markAllAsRead = () => {
    messages.filter(m => !m.read).forEach(m => markAsRead(m.id));
  };

  // === Fungsi navigasi berdasarkan actionType ===
  const handleNotificationAction = (item) => {
    setSelectedMessage(null);
    if (!item.actionType) return;

    switch (item.actionType) {
      case 'VIEW_ISSUE':
        // Admin/Pengawas → buka IssueDetail jika ada actionId atau noPolisi, atau IssueList
        if (item.actionId || item.noPolisi) {
          navigation.navigate('IssueDetail', { 
            issueId: item.actionId,
            handoverId: item.actionId,
            actionId: item.actionId,
            noPolisi: item.noPolisi
          });
        } else {
          navigation.navigate('IssueList');
        }
        break;
      case 'VIEW_HANDOVER':
        // Langsung navigasi ke detail riwayat handover yang dimaksud
        if (item.actionId) {
          navigation.navigate('HandoverDetail', { 
            handoverId: item.actionId, 
            noPolisi: item.noPolisi 
          });
        } else if (item.noPolisi) {
          navigation.navigate('History', { noPolisi: item.noPolisi });
        } else {
          navigation.navigate('History');
        }
        break;
      case 'SCAN_REPAIR':
        // Langsung arahkan ke Verifikasi Perbaikan jika data truk/isu ada, atau buka Scanner
        if (item.noPolisi || item.actionId) {
          navigation.navigate('FixVerification', { 
            noPolisi: item.noPolisi || item.actionId,
            issueId: item.actionId,
            handoverId: item.actionId
          });
        } else {
          navigation.navigate('Scanner', { type: 'mulai' });
        }
        break;
      default:
        break;
    }
  };

  // === Helper: Teks tombol aksi berdasarkan actionType ===
  const getActionLabel = (actionType) => {
    switch (actionType) {
      case 'VIEW_ISSUE': return 'Lihat Isu Kendaraan';
      case 'VIEW_HANDOVER': return 'Lihat Riwayat';
      case 'SCAN_REPAIR': return 'Scan QR Perbaikan';
      default: return null;
    }
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'VIEW_ISSUE': return 'alert-circle';
      case 'VIEW_HANDOVER': return 'document-text';
      case 'SCAN_REPAIR': return 'qr-code';
      default: return 'arrow-forward';
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case 'VIEW_ISSUE': return ['#ED1C24', '#B91C1C'];
      case 'VIEW_HANDOVER': return ['#0055A5', '#1E3A5F'];
      case 'SCAN_REPAIR': return ['#00A651', '#166534'];
      default: return ['#6B7280', '#4B5563'];
    }
  };

  // === Ikon & warna berdasarkan tipe notifikasi ===
  const getNotifStyle = (type) => {
    switch (type) {
      case 'error':
        return { icon: 'alert-circle', color: '#ED1C24', bg: 'bg-red-100' };
      case 'warning':
        return { icon: 'warning', color: '#F59E0B', bg: 'bg-amber-100' };
      case 'success':
        return { icon: 'checkmark-circle', color: '#00A651', bg: 'bg-green-100' };
      case 'auth':
        return { icon: 'key', color: '#F59E0B', bg: 'bg-amber-100' };
      default:
        return { icon: 'information-circle', color: '#3B82F6', bg: 'bg-blue-100' };
    }
  };

  const renderMessage = ({ item }) => {
    const handlePress = () => {
      setSelectedMessage(item);
      if (!item.read) markAsRead(item.id);
    };
    const isUnread = !item.read;
    const style = getNotifStyle(item.type);

    return (
      <TouchableOpacity 
        style={tw`bg-white p-5 rounded-2xl mb-4 shadow-sm border ${isUnread ? 'border-blue-200' : 'border-gray-100'} flex-row items-start`}
        onPress={handlePress}
      >
        <View style={tw`w-12 h-12 rounded-full items-center justify-center mr-4 mt-1 ${style.bg}`}>
          <Ionicons name={style.icon} size={24} color={style.color} />
        </View>
        <View style={tw`flex-1`}>
          <View style={tw`flex-row justify-between items-center mb-1`}>
            <Text style={tw`text-base font-black ${isUnread ? 'text-gray-900' : 'text-gray-600'} flex-1 mr-2`} numberOfLines={1}>{item.title}</Text>
            {isUnread && <View style={tw`w-2.5 h-2.5 bg-blue-500 rounded-full ml-2`} />}
          </View>
          <Text style={tw`text-sm font-medium ${isUnread ? 'text-gray-700' : 'text-gray-400'} leading-5 mb-2`} numberOfLines={2}>{item.message}</Text>
          <View style={tw`flex-row justify-between items-center`}>
            <Text style={tw`text-xs font-bold text-gray-400`}>{item.time}</Text>
            {item.actionType && (
              <TouchableOpacity 
                style={tw`flex-row items-center bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100`}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  if (!item.read) markAsRead(item.id);
                  handleNotificationAction(item);
                }}
              >
                <Ionicons name={getActionIcon(item.actionType)} size={14} color={getActionColor(item.actionType)[0]} />
                <Text style={[tw`text-xs font-bold ml-1.5`, { color: getActionColor(item.actionType)[0] }]}>{getActionLabel(item.actionType)}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-[#F4F7FA]`}>
      <Animated.View style={[tw`absolute -top-20 -left-10 w-[30rem] h-[30rem] rounded-full opacity-15`, { transform: [{ translateY: orb1TranslateY }] }]}>
        <LinearGradient colors={['#3B82F6', '#1E40AF']} style={tw`flex-1 rounded-full`} />
      </Animated.View>
      <Animated.View style={[tw`absolute -bottom-20 -right-20 w-[25rem] h-[25rem] rounded-full opacity-15`, { transform: [{ translateY: orb2TranslateY }] }]}>
        <LinearGradient colors={['#60A5FA', '#2563EB']} style={tw`flex-1 rounded-full`} />
      </Animated.View>

      <SafeAreaView style={tw`flex-1 relative ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
        
        {isLargeScreen && (
          <WebSidebar 
            user={user} 
            activeMenu={'Messages'} 
            navigation={navigation} 
            handleLogout={handleLogout || (() => { setIsLogoutVisible(true); })} 
            unreadNotificationsCount={unreadNotificationsCount || 0} 
          />
        )}

        {/* MAIN CONTENT AREA */}
        <View style={tw`flex-1 relative`}>
          <WebNavbar
            user={user}
            title="Pesan & Notifikasi"
            subtitle="Pusat informasi dan pemberitahuan"
            navigation={navigation}
            showBack={true}
            onBack={() => {
              if (!user) { navigation.goBack(); return; }
              if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                navigation.replace('AdminDashboard');
              } else if (user.role === 'PENGAWAS') {
                navigation.replace('PengawasDashboard');
              } else {
                navigation.replace('UserDashboard');
              }
            }}
            rightAction={
              <TouchableOpacity onPress={markAllAsRead} style={tw`flex-row items-center bg-[#0055A5] px-3.5 py-2 rounded-xl shadow-sm active:scale-95`}>
                <Ionicons name="checkmark-done" size={18} color="white" />
                <Text style={tw`text-white font-bold text-xs ml-1.5`}>{isLargeScreen ? 'Tandai Dibaca' : 'Baca Semua'}</Text>
              </TouchableOpacity>
            }
          />

        {loading ? (
          <View style={tw`flex-1 items-center justify-center mt-20`}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={tw`p-6 pb-30 w-full max-w-4xl mx-auto`}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={
              <View style={tw`items-center mt-20`}>
                <Ionicons name="chatbubble-outline" size={60} color="#CBD5E1" />
                <Text style={tw`text-center text-gray-400 font-bold mt-4 text-lg`}>Tidak ada pesan baru.</Text>
              </View>
            }
          />
        )}
      
        {/* MODAL DETAIL PESAN */}
        <Modal visible={!!selectedMessage} transparent={true} animationType="fade">
          <View style={tw`flex-1 justify-center items-center bg-black/50 px-6`}>
            <View style={tw`bg-white w-full max-w-sm rounded-[30px] p-6 shadow-2xl`}>
              {/* Header */}
              <View style={tw`flex-row items-center mb-4 pb-4 border-b border-gray-100`}>
                <View style={tw`w-10 h-10 rounded-full items-center justify-center mr-3 ${getNotifStyle(selectedMessage?.type).bg}`}>
                  <Ionicons name={getNotifStyle(selectedMessage?.type).icon} size={20} color={getNotifStyle(selectedMessage?.type).color} />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={tw`text-lg font-black text-gray-800`}>{selectedMessage?.title}</Text>
                  <Text style={tw`text-xs text-gray-400 font-bold`}>{selectedMessage?.time}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedMessage(null)} style={tw`p-1`}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Isi pesan */}
              <ScrollView style={tw`max-h-48 mb-6`}>
                <Text style={tw`text-gray-600 text-sm leading-relaxed`}>
                  {selectedMessage?.message}
                </Text>
              </ScrollView>

              {/* No Polisi badge jika ada */}
              {selectedMessage?.noPolisi && (
                <View style={tw`flex-row items-center mb-4 p-3 bg-gray-50 rounded-xl`}>
                  <Ionicons name="car" size={18} color="#6B7280" />
                  <Text style={tw`text-gray-700 font-bold ml-2`}>Kendaraan: {selectedMessage.noPolisi}</Text>
                </View>
              )}

              {/* Tombol Aksi (jika ada actionType) */}
              {selectedMessage?.actionType && getActionLabel(selectedMessage.actionType) && (
                <TouchableOpacity
                  style={tw`w-full mb-3 rounded-2xl overflow-hidden shadow-md`}
                  onPress={() => handleNotificationAction(selectedMessage)}
                >
                  <LinearGradient
                    colors={getActionColor(selectedMessage.actionType)}
                    style={tw`py-4 px-5 flex-row items-center justify-center`}
                  >
                    <Ionicons name={getActionIcon(selectedMessage.actionType)} size={20} color="white" />
                    <Text style={tw`text-white font-bold ml-2 text-[15px]`}>{getActionLabel(selectedMessage.actionType)}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Tombol Tutup */}
              <TouchableOpacity
                style={tw`w-full bg-gray-100 py-4 rounded-2xl items-center`}
                onPress={() => setSelectedMessage(null)}
              >
                <Text style={tw`text-gray-600 font-bold`}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
      </View>
      </SafeAreaView>

      {/* BOTTOM NAVBAR */}
      {!isLargeScreen && user && (
        <View style={tw`absolute bottom-8 self-center w-11/12 bg-white rounded-full flex-row justify-around items-center py-5 shadow-2xl shadow-gray-400/50 z-50`}>
          <TouchableOpacity 
            style={tw`items-center justify-center px-4 relative`} 
            onPress={() => {
              if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                navigation.replace('AdminDashboard');
              } else if (user.role === 'PENGAWAS') {
                navigation.replace('PengawasDashboard');
              } else {
                navigation.replace('UserDashboard');
              }
            }}
          >
            <Feather name="grid" size={26} color="#9CA3AF" />
          </TouchableOpacity>

          {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
            <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('ChecklistManager')}>
              <Feather name="check-square" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {(user.role === 'AMT' || user.role === 'USER') && (
            <TouchableOpacity style={tw`items-center justify-center px-4 relative`} onPress={() => navigation.replace('History')}>
              <Feather name="file-text" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={tw`items-center justify-center px-4 relative`}>
            {activeMenu === 'Messages' && !isLogoutVisible && (
              <>
                <View style={tw`absolute -top-5 w-8 h-1 overflow-hidden rounded-full`}>
                  <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                    <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={tw`flex-1`} />
                  </Animated.View>
                </View>
                <View style={tw`absolute -bottom-5 w-8 h-1 overflow-hidden rounded-full`}>
                  <Animated.View style={[tw`h-full w-[64px]`, { transform: [{ translateX: slideInterpolate }] }]}>
                    <LinearGradient colors={['#0055A5', '#ED1C24', '#00A651', '#0055A5', '#ED1C24']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={tw`flex-1`} />
                  </Animated.View>
                </View>
              </>
            )}
            <View style={tw`relative`}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={activeMenu === 'Messages' && !isLogoutVisible ? '#1F2937' : '#9CA3AF'} />
              {messages.some(m => !m.read) && (
                <View style={tw`absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white`} />
              )}
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
  );
}
