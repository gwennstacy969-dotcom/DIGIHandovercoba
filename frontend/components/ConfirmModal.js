import React from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import tw from 'twrnc';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function ConfirmModal({ 
  visible, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Ya, Hapus', 
  cancelText = 'Batal',
  confirmColor,
  icon,
  iconColor,
  iconBgColor
}) {
  const isVerification = confirmText.toLowerCase().includes('verifikasi') || confirmText.toLowerCase().includes('setuju');
  const isDelete = !isVerification && (confirmText.toLowerCase().includes('hapus') || icon === 'trash-2');

  const resolvedIcon = icon || (isVerification ? 'check-circle' : 'trash-2');
  const resolvedColor = confirmColor || (isVerification ? '#0055A5' : '#EF4444');
  const resolvedIconColor = iconColor || resolvedColor;
  const resolvedBg = iconBgColor || (isVerification ? 'bg-blue-50' : 'bg-red-50');
  const glowBg = isVerification ? 'bg-blue-50' : 'bg-red-50';

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={[
        tw`flex-1 justify-center items-center bg-black/40 px-6`,
        Platform.OS === 'web' ? { zIndex: 99999, elevation: 99999 } : {}
      ]}>
        <View style={tw`bg-white w-full max-w-sm rounded-[35px] p-8 items-center shadow-2xl relative overflow-hidden`}>
          
          {/* Subtle glow effect */}
          <View style={tw`absolute -top-10 -right-10 w-32 h-32 ${glowBg} rounded-full`} />
          
          <View style={tw`w-20 h-20 ${resolvedBg} rounded-full items-center justify-center mb-5 shadow-sm border-4 border-white z-10`}>
            {resolvedIcon === 'check-circle' ? (
              <Feather name="check-circle" size={34} color={resolvedIconColor} />
            ) : resolvedIcon === 'shield-check' ? (
              <Ionicons name="shield-checkmark" size={34} color={resolvedIconColor} />
            ) : (
              <Feather name={resolvedIcon} size={32} color={resolvedIconColor} />
            )}
          </View>

          <Text style={tw`text-2xl font-black text-gray-800 mb-2 tracking-tight text-center z-10`}>{title}</Text>
          <Text style={tw`text-center text-gray-500 font-medium mb-8 z-10 px-2 leading-5`}>{message}</Text>

          <View style={tw`flex-row justify-between w-full z-10`}>
            <TouchableOpacity 
              style={tw`flex-1 bg-gray-100 py-4 rounded-2xl items-center mr-2`} 
              onPress={onCancel}
            >
              <Text style={tw`text-gray-600 font-bold`}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                tw`flex-1 py-4 rounded-2xl items-center ml-2 shadow-lg`,
                { backgroundColor: resolvedColor }
              ]} 
              onPress={onConfirm}
            >
              <Text style={tw`text-white font-bold`}>{confirmText}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}
