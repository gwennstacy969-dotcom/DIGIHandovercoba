import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS } from './AppModal';

/**
 * DIGI Handover Design System - NotificationSheet
 * Bottom sheet notifikasi (Admin / Pengawas). Presentational only:
 * data & handler (onRead) tetap berasal dari screen.
 */
const KIND = {
  danger: { icon: 'alert-circle', accent: '#ED1C24', soft: '#FDECEC' },
  success: { icon: 'checkmark-circle', accent: '#00A651', soft: '#E8F7EF' },
  info: { icon: 'information-circle', accent: '#0055A5', soft: '#E6F0FA' },
};

const resolveKind = (n) => {
  const text = `${n?.type || ''} ${n?.title || ''}`.toLowerCase();
  if (/major|rusak|blokir|diblokir|isu|issue/.test(text)) return KIND.danger;
  if (/selesai|resolved|disetujui|diperbaiki|berhasil|sukses/.test(text)) return KIND.success;
  return KIND.info;
};

const formatTime = (d) => {
  try {
    return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

export default function NotificationSheet({ visible, notifications = [], onClose, onRead }) {
  const { width } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  const unread = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const sheetWidth = Math.min(width, 640);

  return (
    <Modal visible={!!visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          tw`flex-1 justify-end items-center`,
          { backgroundColor: 'rgba(15,23,42,0.55)' },
          Platform.OS === 'web' ? { zIndex: 99999 } : null,
        ]}
      >
        <TouchableOpacity style={tw`absolute inset-0`} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            tw`bg-white rounded-t-[30px] overflow-hidden`,
            {
              width: sheetWidth,
              height: '80%',
              transform: [{ translateY }],
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 24,
            },
          ]}
        >
          {/* Accent line Pertamina */}
          <View style={tw`flex-row h-1.5`}>
            <View style={[tw`flex-1`, { backgroundColor: APP_COLORS.red }]} />
            <View style={[tw`flex-1`, { backgroundColor: APP_COLORS.blue }]} />
            <View style={[tw`flex-1`, { backgroundColor: APP_COLORS.green }]} />
          </View>

          {/* Header */}
          <View style={tw`flex-row items-center px-6 pt-5 pb-4 border-b border-gray-100`}>
            <View style={[tw`w-11 h-11 rounded-2xl items-center justify-center mr-3`, { backgroundColor: '#E6F0FA' }]}>
              <Ionicons name="notifications" size={22} color={APP_COLORS.blue} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-[20px] font-black text-[#111827]`}>Notifikasi</Text>
              <Text style={tw`text-[12px] font-semibold ${unread > 0 ? 'text-[#ED1C24]' : 'text-[#6B7280]'}`}>
                {unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={tw`w-9 h-9 rounded-full bg-gray-100 items-center justify-center`}
            >
              <Ionicons name="close" size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={tw`px-5 pt-4 pb-8`} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={tw`items-center justify-center py-14`}>
                <View style={tw`w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4`}>
                  <Ionicons name="notifications-off-outline" size={38} color="#9CA3AF" />
                </View>
                <Text style={tw`text-[#6B7280] font-bold`}>Belum ada notifikasi</Text>
              </View>
            ) : (
              notifications.map((notif) => {
                const kind = resolveKind(notif);
                return (
                  <TouchableOpacity
                    key={notif.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (!notif.isRead && onRead) onRead(notif.id);
                    }}
                    style={[
                      tw`mb-3 rounded-2xl flex-row overflow-hidden ${notif.isRead ? 'bg-[#F8FAFC]' : 'bg-white'}`,
                      {
                        borderWidth: 1,
                        borderColor: notif.isRead ? '#EEF2F6' : '#F3D1D3',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: notif.isRead ? 0 : 0.06,
                        shadowRadius: 6,
                        elevation: notif.isRead ? 0 : 2,
                      },
                    ]}
                  >
                    <View style={{ width: 4, backgroundColor: notif.isRead ? '#E5E7EB' : kind.accent }} />
                    <View style={tw`flex-1 flex-row p-4`}>
                      <View
                        style={[
                          tw`w-10 h-10 rounded-xl items-center justify-center mr-3`,
                          { backgroundColor: notif.isRead ? '#EEF2F6' : kind.soft },
                        ]}
                      >
                        <Ionicons name={kind.icon} size={22} color={notif.isRead ? '#9CA3AF' : kind.accent} />
                      </View>
                      <View style={tw`flex-1`}>
                        <View style={tw`flex-row items-center justify-between`}>
                          <Text
                            style={tw`flex-1 text-[14px] font-extrabold ${notif.isRead ? 'text-[#4B5563]' : 'text-[#111827]'}`}
                            numberOfLines={2}
                          >
                            {notif.title}
                          </Text>
                          {!notif.isRead && <View style={[tw`w-2.5 h-2.5 rounded-full ml-2`, { backgroundColor: APP_COLORS.red }]} />}
                        </View>
                        <Text style={tw`text-[13px] leading-5 mt-1 text-[#6B7280]`}>{notif.message}</Text>
                        <Text style={tw`text-[11px] mt-2 font-semibold text-[#9CA3AF]`}>{formatTime(notif.createdAt)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
