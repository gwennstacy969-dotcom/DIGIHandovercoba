import Toast from 'react-native-toast-message';
import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from '../config';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import tw from 'twrnc';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REQUIRED_PHOTOS = ['Depan', 'Belakang', 'Kanan', 'Kiri'];

export default function CameraScreen({ route, navigation }) {
  const { noPolisi, shift, items, odoMeter } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [userRole, setUserRole] = useState('USER');
  const [photos, setPhotos] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
        type: 'info',
        text1: `Izin Lokasi Ditolak`,
        text2: `Harap berikan izin GPS untuk melanjutkan.`
      });
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-white px-6`}>
        <Text style={tw`text-center mb-6 text-lg text-gray-700`}>Kami butuh izin kamera untuk mengambil foto kendaraan</Text>
        <TouchableOpacity style={tw`bg-blue-600 p-4 rounded-xl`} onPress={requestPermission}>
          <Text style={tw`text-white font-bold`}>Berikan Izin Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  
  const goToDashboard = () => {
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      navigation.navigate('AdminDashboard');
    } else if (userRole === 'PENGAWAS') {
      navigation.navigate('PengawasDashboard');
    } else {
      navigation.navigate('UserDashboard');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      const newPhotos = { ...photos, [REQUIRED_PHOTOS[currentStep]]: photo };
      setPhotos(newPhotos);
      
      if (currentStep < REQUIRED_PHOTOS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        submitHandover(newPhotos);
      }
    }
  };

  const submitHandover = async (allPhotos) => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = JSON.parse(userStr);
      setUserRole(user?.role || 'USER');

      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('noPolisi', noPolisi);
      formData.append('shift', shift);
      
      // Merge items with odoMeter for category C
      const finalItems = [...items, { category: 'C', name: `Odo Meter: ${odoMeter}`, isGood: true }];
      formData.append('items', JSON.stringify(finalItems));

      if (location) {
        formData.append('locationLat', location.latitude);
        formData.append('locationLng', location.longitude);
      }

      // Add photos
      REQUIRED_PHOTOS.forEach(step => {
        const p = allPhotos[step];
        if (p) {
          const filename = p.uri.split('/').pop();
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;
          formData.append('photos', { uri: p.uri, name: filename, type });
        }
      });

      // API call (adjust IP address if testing on real device)
      const res = await axios.post(`${API_URL}/api/handovers`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLoading(false);
      Toast.show({ type: 'success', text1: 'Sukses', text2: 'Handover berhasil disimpan!' }); setTimeout(() => goToDashboard(), 1000);
    } catch (error) {
      setLoading(false);
      console.error(error);
      Toast.show({
        type: 'error',
        text1: `Error`,
        text2: `Gagal mengirim data handover.`
      });
    }
  };

  if (loading) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-black`}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={tw`text-white mt-4`}>Mengunggah Data...</Text>
      </View>
    );
  }

  const stepName = REQUIRED_PHOTOS[currentStep];

  return (
    <View style={tw`flex-1 bg-black`}>
      <CameraView style={StyleSheet.absoluteFillObject} facing="back" ref={cameraRef} />
      <View style={tw`absolute top-12 left-0 right-0 items-center px-4`} pointerEvents="none">
        <Text style={tw`bg-black/70 text-white p-3 rounded-full font-bold text-lg text-center`}>
          Ambil Foto: Tampak {stepName} ({currentStep + 1}/4)
        </Text>
        {location && (
          <Text style={tw`text-white bg-black/50 text-xs px-2 py-1 mt-2 rounded`}>
            GPS Aktif: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
        )}
      </View>
      <View style={tw`absolute bottom-12 w-full flex-row justify-center`}>
        <TouchableOpacity 
          style={tw`w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-lg`} 
          onPress={takePicture}
        />
      </View>
    </View>
  );
}
