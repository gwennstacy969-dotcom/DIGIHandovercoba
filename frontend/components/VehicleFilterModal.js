import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';

export default function VehicleFilterModal({
  visible,
  onClose,
  selectedStatus,
  onApply,
}) {
  const [tempStatus, setTempStatus] = useState(selectedStatus || 'Semua');

  useEffect(() => {
    if (visible) {
      setTempStatus(selectedStatus || 'Semua');
    }
  }, [visible, selectedStatus]);

  const handleApply = () => {
    onApply(tempStatus);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-center items-center bg-black/60 p-4`}>
        <View style={tw`bg-white rounded-[30px] p-6 shadow-2xl w-full max-w-md`}>
          <View style={tw`flex-row justify-between items-center mb-6`}>
            <Text style={tw`text-2xl font-black text-gray-800`}>Filter Kendaraan</Text>
            <TouchableOpacity onPress={onClose} style={tw`p-2 bg-gray-100 rounded-full`}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={tw`text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider`}>
            Berdasarkan Status Isu
          </Text>

          <View style={tw`flex-row flex-wrap mb-6`}>
            {['Semua', 'Normal', 'Isu'].map((status) => (
              <TouchableOpacity
                key={status}
                style={tw`px-5 py-2.5 rounded-full mr-3 mb-3 border ${
                  tempStatus === status
                    ? status === 'Isu'
                      ? 'bg-[#ED1C24] border-[#ED1C24]'
                      : 'bg-[#0055A5] border-[#0055A5]'
                    : 'bg-transparent border-gray-300'
                }`}
                onPress={() => setTempStatus(status)}
              >
                <Text
                  style={tw`text-sm font-bold ${
                    tempStatus === status ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={tw`bg-[#0055A5] p-4 rounded-2xl items-center shadow-lg shadow-blue-500/40`}
            onPress={handleApply}
          >
            <Text style={tw`text-white font-black text-lg tracking-wide`}>TERAPKAN FILTER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
