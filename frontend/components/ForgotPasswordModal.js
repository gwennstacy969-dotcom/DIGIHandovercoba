import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 justify-center items-center bg-black/50 px-4`}>
        <View style={tw`bg-white w-full max-w-sm rounded-[30px] p-8 items-center shadow-2xl`}>
          <View style={tw`bg-red-50 p-4 rounded-full mb-4`}>
            <Ionicons name="help-buoy" size={40} color="#ED1C24" />
          </View>
          <Text style={tw`text-2xl font-black text-gray-800 mb-2`}>Lupa Password?</Text>
          <Text style={tw`text-gray-500 text-center text-base mb-6 leading-relaxed`}>
            Kirimkan notifikasi ke Admin untuk mereset akun Anda? (Pastikan Anda telah mengisi Username Anda di layar login)
          </Text>

          <View style={tw`w-full flex-row justify-between`}>
            <TouchableOpacity
              style={tw`flex-1 bg-gray-100 py-4 rounded-2xl mr-2 items-center`}
              onPress={onClose}
            >
              <Text style={tw`text-gray-600 font-bold`}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={tw`flex-1 ${isSubmitting ? 'bg-gray-300' : 'bg-[#ED1C24]'} py-4 rounded-2xl ml-2 items-center shadow-md`}
              onPress={onSubmit}
              disabled={isSubmitting}
            >
              <Text style={tw`text-white font-bold`}>
                {isSubmitting ? 'Mengirim...' : 'Kirim Notif'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
