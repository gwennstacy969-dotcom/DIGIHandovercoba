import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export function useRoleGuard(allowedRoles) {
  const navigation = useNavigation();

  useEffect(() => {
    let isMounted = true;
    const checkRole = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (!userStr) {
          if (isMounted) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
          return;
        }

        if (userStr && isMounted) {
          const user = JSON.parse(userStr);
          if (!allowedRoles.includes(user.role)) {
            // Jika role tidak diizinkan, redirect ke dashboard yang sesuai
            const targetDashboard = (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')
              ? 'AdminDashboard'
              : user.role === 'PENGAWAS'
              ? 'PengawasDashboard'
              : 'UserDashboard';
            navigation.replace(targetDashboard);
          }
        }
      } catch (error) {
        console.log('Role guard error:', error);
      }
    };
    
    const unsubscribe = navigation.addListener('focus', () => {
      checkRole();
    });

    checkRole(); // Cek saat mount pertama kali

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigation, allowedRoles]);
}
