import React, { useState, useEffect } from 'react';
import TextLogo from './components/TextLogo';
import { View, Image, Text, ActivityIndicator, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import axios from 'axios';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#00A651', backgroundColor: '#fff', borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}
      text2Style={{ fontSize: 14, color: '#666' }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#ED1C24', backgroundColor: '#fff', borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
      text1Style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}
      text2Style={{ fontSize: 14, color: '#666' }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#0055A5', backgroundColor: '#fff', borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
      text1Style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}
      text2Style={{ fontSize: 14, color: '#666' }}
    />
  )
};

// Screens
import LoginScreen from './screens/shared/LoginScreen';
import HistoryScreen from './screens/shared/HistoryScreen';
import HandoverDetailScreen from './screens/shared/HandoverDetailScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import WorkerListScreen from './screens/admin/WorkerListScreen';
import PengawasListScreen from './screens/admin/PengawasListScreen';
import VehicleListScreen from './screens/admin/VehicleListScreen';
import ChecklistManagerScreen from './screens/admin/ChecklistManagerScreen';
import AdminListScreen from './screens/admin/AdminListScreen';
import PengawasDashboardScreen from './screens/pengawas/PengawasDashboardScreen';
import IssueListScreen from './screens/pengawas/IssueListScreen';
import IssueDetailScreen from './screens/pengawas/IssueDetailScreen';
import MessageCenterScreen from './screens/pengawas/MessageCenterScreen';
import UserDashboardScreen from './screens/user/UserDashboardScreen';
import ScannerScreen from './screens/user/ScannerScreen';
import HandoverFormScreen from './screens/user/HandoverFormScreen';
import FixVerificationScreen from './screens/user/FixVerificationScreen';

import { API_URL, loadSavedApiUrl } from './config';

const Stack = createNativeStackNavigator();

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr = typeof atob === 'function' ? atob(base64) : '';
    if (!jsonStr) return false;
    const parsed = JSON.parse(jsonStr);
    if (!parsed.exp) return false;
    // Beri buffer 10 detik
    return Date.now() >= (parsed.exp * 1000 - 10000);
  } catch (e) {
    return true;
  }
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    // Bypass ngrok browser warning page
    axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

    // Interceptor global untuk membersihkan session jika token expired / unauthorized
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const errMessage = error.response?.data?.error || '';
        
        const isAuthError = status === 401 || (status === 403 && (errMessage.includes('Token') || errMessage.includes('kadaluarsa')));

        if (isAuthError && !originalRequest._retry && originalRequest.url !== `${API_URL}/api/auth/refresh`) {
          originalRequest._retry = true;
          try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            if (refreshToken) {
              const refreshRes = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
              if (refreshRes.data?.token) {
                const newToken = refreshRes.data.token;
                await AsyncStorage.setItem('token', newToken);
                axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                return axios(originalRequest); // Retry the original request
              }
            }
          } catch (refreshErr) {
            console.log('Refresh token gagal pada interceptor, session berakhir.');
          }
        }

        if (isAuthError) {
          await AsyncStorage.multiRemove(['user', 'token', 'refreshToken']);
          delete axios.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    const determineRoute = async () => {
      try {
        await loadSavedApiUrl();

        // Pada Web browser: Tetap pertahankan session jika token masih valid agar tidak logout saat refresh (F5)
        const userStr = await AsyncStorage.getItem('user');
        let token = await AsyncStorage.getItem('token');
        const refreshToken = await AsyncStorage.getItem('refreshToken');

        if (userStr && token) {
          // Validasi apakah token JWT sudah kadaluarsa
          if (isTokenExpired(token)) {
            if (refreshToken) {
              try {
                const refreshRes = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
                if (refreshRes.data?.token) {
                  token = refreshRes.data.token;
                  await AsyncStorage.setItem('token', token);
                } else {
                  throw new Error('Refresh token gagal');
                }
              } catch (refreshErr) {
                console.log('Sesi login telah berakhir, silakan login kembali');
                await AsyncStorage.multiRemove(['user', 'token', 'refreshToken']);
                return 'Login';
              }
            } else {
              console.log('Token telah kadaluarsa, reset session ke Login');
              await AsyncStorage.multiRemove(['user', 'token', 'refreshToken']);
              return 'Login';
            }
          }

          const user = JSON.parse(userStr);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            return 'AdminDashboard';
          } else if (user.role === 'PENGAWAS') {
            return 'PengawasDashboard';
          } else {
            return 'UserDashboard';
          }
        } else {
          return 'Login';
        }
      } catch (error) {
        console.error('Failed to load user from AsyncStorage:', error);
        return 'Login'; // Fallback ke Login jika error
      }
    };

    const runChecks = async () => {
      // Tampilkan animasi loading screen sekitar 1 detik (1000ms)
      const [route] = await Promise.all([
        determineRoute(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
      setInitialRoute(route);
    };

    runChecks();
  }, []);

  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      )
    ]).start();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!initialRoute ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            alignItems: 'center'
          }}>
            <Image
              source={require('./assets/exact_digihandover_logo.png')}
              style={{ width: 260, height: 42, resizeMode: 'contain', marginBottom: 28 }}
            />
            <ActivityIndicator size="large" color="#0055A5" />
          </Animated.View>
        </View>
      ) : (
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              animation: Platform.OS === 'web' ? 'none' : 'fade_from_bottom', // Instant on web, smooth transition on mobile
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="PengawasDashboard" component={PengawasDashboardScreen} />
            <Stack.Screen name="UserDashboard" component={UserDashboardScreen} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
            <Stack.Screen name="HandoverForm" component={HandoverFormScreen} />
            <Stack.Screen name="FixVerification" component={FixVerificationScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="HandoverDetail" component={HandoverDetailScreen} />
            <Stack.Screen name="VehicleList" component={VehicleListScreen} />
            <Stack.Screen name="IssueList" component={IssueListScreen} />
            <Stack.Screen name="IssueDetail" component={IssueDetailScreen} />
            <Stack.Screen name="MessageCenter" component={MessageCenterScreen} />
            <Stack.Screen name="ChecklistManager" component={ChecklistManagerScreen} />
            <Stack.Screen name="WorkerList" component={WorkerListScreen} />
            <Stack.Screen name="PengawasList" component={PengawasListScreen} />
            <Stack.Screen name="AdminList" component={AdminListScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
      <Toast config={toastConfig} position="top" topOffset={50} />
    </SafeAreaProvider>
  );
}
