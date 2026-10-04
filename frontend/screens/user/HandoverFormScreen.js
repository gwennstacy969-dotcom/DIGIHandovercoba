import React, { useState, useRef, useEffect, useMemo } from 'react';
import { API_URL } from '../../config';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, StyleSheet, Image, ActivityIndicator, Dimensions, Platform } from 'react-native';
import tw from 'twrnc';
import TextLogo from '../../components/TextLogo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebSidebar from '../../components/WebSidebar';
import WebNavbar from '../../components/WebNavbar';
import { getItemOptionLabels } from '../../utils/checklistHelper';
import { handleLogoutAndReset } from '../../utils/authHelper';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';


const DEFAULT_ITEMS = [
  { id: 'A1', category: 'A', name: 'Kondisi Rem', severity: 'Major' },
  { id: 'A2', category: 'A', name: 'Kondisi Wiper', severity: 'Minor' },
  { id: 'A3', category: 'A', name: 'Kondisi Kompartemen Tangki', severity: 'Major' },
  { id: 'A4', category: 'A', name: 'Keberadaan DCP/ CO2', severity: 'Major' },
  { id: 'A5', category: 'A', name: 'Oli Mesin', severity: 'Major' },
  { id: 'A6', category: 'A', name: 'Air Radiator', severity: 'Minor' },
  { id: 'A7', category: 'A', name: 'Keberadaan STNK', severity: 'Major' },
  { id: 'A8', category: 'A', name: 'Keberadaan Surat Keur', severity: 'Major' },
  { id: 'A9', category: 'A', name: 'Keberadaan Surat Tera', severity: 'Major' },
  { id: 'A10', category: 'A', name: 'Keberadaan Kotak P3K', severity: 'Minor' },
  { id: 'A11', category: 'A', name: 'Keberadaan Flame Trap', severity: 'Major' },
  { id: 'A12', category: 'A', name: 'Keberadaan Tools Kit termasuk dongkrak', severity: 'Minor' },
  { id: 'A13', category: 'A', name: 'Keberadaan Selang bongkar', severity: 'Major' },
  { id: 'A14', category: 'A', name: 'Keberadaan Grounding Cable', severity: 'Major' },
  { id: 'A15', category: 'A', name: 'Keberadaan Spill Kit', severity: 'Minor' },
  { id: 'B1', category: 'B', name: 'Membawa SIM Sesuai Kendaraan', severity: null },
  { id: 'B2', category: 'B', name: 'ID/ HSE Paspor Berlaku', severity: null },
  { id: 'B3', category: 'B', name: 'Dokumen KIM', severity: null },
  { id: 'B4', category: 'B', name: 'Menggunakan Seragam Kerja', severity: null },
  { id: 'B5', category: 'B', name: 'Menggunakan Safety Shoes', severity: null },
  { id: 'B6', category: 'B', name: 'Menggunakan Safety Helm', severity: null },
  { id: 'B7', category: 'B', name: 'Menggunakan Safety Glove', severity: null },
  { id: 'B8', category: 'B', name: 'Membawa Jas Hujan', severity: null },
  { id: 'B9', category: 'B', name: 'Membawa Buku Saku AMT', severity: null }
];

const REQUIRED_PHOTOS = ['Depan', 'Belakang', 'Kanan', 'Kiri'];
const PERTAMINA_BLUE = ['#4A90E2', '#0055A5']; // Softer aesthetic blue gradient
const PERTAMINA_RED = ['#FF4B4B', '#ED1C24'];
const PERTAMINA_GREEN = ['#2ECC71', '#00A651'];

const isAmt2Jabatan = (jbt) => {
  const upper = (jbt || '').toUpperCase();
  return upper.includes('AMT II') || upper.includes('AMT 2') || /\b(II|2)\b/.test(upper);
};

const isAmt1Jabatan = (jbt) => {
  if (isAmt2Jabatan(jbt)) return false;
  const upper = (jbt || '').toUpperCase();
  return upper.includes('AMT I') || upper.includes('AMT 1') || /\b(I|1)\b/.test(upper) || (!upper.includes('II') && !upper.includes('2'));
};

export default function HandoverFormScreen({ route, navigation }) {
  const { noPolisi: initialNoPolisi, type, lastHandover } = route?.params || {};
  const [noPolisi, setNoPolisi] = useState(initialNoPolisi || '');

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;
  const [user, setUser] = useState(null);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const s = Dimensions.addEventListener('change', onChange);
    return () => s?.remove();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const str = await AsyncStorage.getItem('user');
        if (str) {
          const parsed = JSON.parse(str);
          setUser(parsed);
        }
      } catch (error) {
        console.error('Gagal membaca data user:', error);
        setUser(null);
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    await handleLogoutAndReset(navigation);
  };

  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  const [shift, setShift] = useState(`${currentHour}:${currentMinute}`);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [selectedMinute, setSelectedMinute] = useState(currentMinute);
  const [odoMeter, setOdoMeter] = useState('');

  // Deteksi angka odometer dari handover sebelumnya jika tersedia
  const previousOdometer = useMemo(() => {
    if (lastHandover && lastHandover.items) {
      const odoItem = lastHandover.items.find(i => i.name && i.name.toLowerCase().includes('odo'));
      if (odoItem) {
        const match = odoItem.name.match(/\d[\d.,]*/);
        if (match) {
          const num = parseInt(match[0].replace(/[.,]/g, ''), 10);
          return isNaN(num) ? null : num;
        }
      }
    }
    return null;
  }, [lastHandover]);
  const [amt1, setAmt1] = useState('');
  const [amt2, setAmt2] = useState('');
  const [isAmt1Locked, setIsAmt1Locked] = useState(false);
  const [isAmt2Locked, setIsAmt2Locked] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [filteredWorkers1, setFilteredWorkers1] = useState([]);
  const [filteredWorkers2, setFilteredWorkers2] = useState([]);
  const [showWorkers1, setShowWorkers1] = useState(false);
  const [showWorkers2, setShowWorkers2] = useState(false);

  // Checklist State (Mulai dari null/kosong)
  const [items, setItems] = useState([]);

  // B5: Kelompokkan item checklist secara dinamis berdasarkan kategori
  const categoryGroups = useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const cat = item.category || 'A';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [items]);

  const getCategoryMeta = (cat) => {
    switch (cat) {
      case 'A':
        return { title: 'A. Perlengkapan Tangki', icon: 'construct', color: '#00A651', bg: 'bg-green-100' };
      case 'B':
        return { title: 'B. Perlengkapan AMT', icon: 'person-circle', color: '#0055A5', bg: 'bg-blue-100' };
      case 'C':
        return { title: 'Catatan Tambahan', icon: 'clipboard', color: '#6366F1', bg: 'bg-indigo-100' };
      case 'D':
        return { title: 'D. Catatan Lain-lain', icon: 'list', color: '#6366F1', bg: 'bg-indigo-100' };
      default:
        return { title: `Kategori ${cat}`, icon: 'list', color: '#6366F1', bg: 'bg-indigo-100' };
    }
  };

  // Camera & Photo State
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [notes, setNotes] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsUpdatedAt, setGpsUpdatedAt] = useState(null);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [photos, setPhotos] = useState({ Depan: null, Belakang: null, Kanan: null, Kiri: null });
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('USER');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedWithMajorIssue, setSubmittedWithMajorIssue] = useState(false);
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationTitle, setValidationTitle] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const isSubmittingRef = useRef(false);
  const cameraRef = useRef(null);


  const showValidationError = (title, message) => {
    setValidationTitle(title);
    setValidationMessage(message);
    setValidationModalVisible(true);
  };

  const hasUnsavedChanges = () => {
    const hasChecked = items.some(item => item.status !== null);
    const hasPhotos = Object.values(photos).some(p => p !== null && p !== undefined);
    const hasNotes = Boolean(notes && notes.trim());
    const hasOdoChanged = Boolean(odoMeter && odoMeter !== (previousOdometer ? String(previousOdometer) : ''));
    return hasChecked || hasPhotos || hasNotes || hasOdoChanged;
  };

  const handleBackPress = () => {
    if (hasUnsavedChanges()) {
      setShowExitConfirmModal(true);
    } else {
      goToDashboard();
    }
  };

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: !!previewPhoto, close: () => setPreviewPhoto(null) },
      { isOpen: isCameraOpen, close: () => setIsCameraOpen(false) },
      { isOpen: showExitConfirmModal, close: () => setShowExitConfirmModal(false) },
      { isOpen: showConfirmSubmitModal, close: () => setShowConfirmSubmitModal(false) },
      { isOpen: showGpsModal, close: () => setShowGpsModal(false) },
      { isOpen: validationModalVisible, close: () => setValidationModalVisible(false) },
    ],
    onBack: () => {
      handleBackPress();
      return true;
    }
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isSubmittingRef.current || showSuccessModal || !hasUnsavedChanges()) {
        return;
      }
      e.preventDefault();
      setShowExitConfirmModal(true);
    });
    return unsubscribe;
  }, [navigation, items, photos, notes, odoMeter, previousOdometer, showSuccessModal]);

  useEffect(() => {

    const loadWorkers = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_URL}/api/workers`, { headers });
        const sorted = (res.data || []).sort((a, b) => a.name.localeCompare(b.name));
        setWorkers(sorted);
      } catch (e) {
        console.error("Gagal load workers:", e);
      }
    };
    loadWorkers();

    const loadChecklist = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_URL}/api/checklists`, { headers });
        let sourceItems = res.data;
        if (!sourceItems || sourceItems.length === 0) {
          sourceItems = DEFAULT_ITEMS;
        }
        setItems(sourceItems.map(item => {
          let status = null;
          let catatan = '';
          if (lastHandover && lastHandover.items) {
            const pastItem = lastHandover.items.find(i => i.name === item.name && i.category === item.category);
            if (pastItem && !pastItem.isGood && !pastItem.isRepaired) {
              status = 'RUSAK';
              catatan = pastItem.repairNote || 'Masih rusak sejak inspeksi sebelumnya.';
            }
          }
          return {
            category: item.category,
            name: item.name,
            status: status,
            severity: item.category === 'B' ? null : (item.severity && item.severity !== '-' ? item.severity : 'Minor'),
            catatan: catatan
          };
        }));
      } catch (e) {
        console.error("Gagal mengambil checklist dari API, menggunakan default:", e);
        setItems(DEFAULT_ITEMS.map(item => {
          let status = null;
          let catatan = '';
          if (lastHandover && lastHandover.items) {
            const pastItem = lastHandover.items.find(i => i.name === item.name && i.category === item.category);
            if (pastItem && !pastItem.isGood && !pastItem.isRepaired) {
              status = 'RUSAK';
              catatan = pastItem.repairNote || 'Masih rusak sejak inspeksi sebelumnya.';
            }
          }
          return {
            category: item.category,
            name: item.name,
            status: status,
            severity: item.category === 'B' ? null : (item.severity && item.severity !== '-' ? item.severity : 'Minor'),
            catatan: catatan
          };
        }));
      }
    };
    loadChecklist();

    (async () => {
      try {
        // Ambil User Role agar goToDashboard berfungsi benar
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setUserRole(user.role || 'USER');

          if (type === 'akhiri' && lastHandover) {
            // Sepaket otomatis terisi dari scan mulai!
            if (lastHandover.amt1) {
              setAmt1(lastHandover.amt1);
              setIsAmt1Locked(true);
            }
            if (lastHandover.amt2) {
              setAmt2(lastHandover.amt2);
              setIsAmt2Locked(true);
            }
          } else if (user.role === 'AMT' || user.role === 'USER') {
            const isAmt2User = isAmt2Jabatan(user.jabatan);
            if (isAmt2User) {
              setAmt2(user.name);
              setIsAmt2Locked(true);
              setAmt1('');
              setIsAmt1Locked(false);
            } else {
              setAmt1(user.name);
              setIsAmt1Locked(true);
              setAmt2('');
              setIsAmt2Locked(false);
            }
          }
        }
      } catch (err) {
        console.log("User fetch failed on mount:", err);
      }
    })();
  }, []);

  // FUNGSI PENGAMBILAN LOKASI GPS (Dipanggil sekali saat mount, dan saat user menekan refresh)
  const refreshLocation = async (silent = true) => {
    try {
      if (!silent) setGpsLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(null);
        setGpsError("Izin lokasi tidak diberikan.");
        if (!silent) Alert.alert("Izin Ditolak", "Aplikasi membutuhkan izin lokasi untuk melanjutkan.");
        return null;
      }

      const isServiceEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!isServiceEnabled) {
        setLocation(null);
        setGpsError("Layanan lokasi (GPS) belum aktif di HP.");
        if (!silent) {
          Alert.alert("GPS Tidak Aktif", "Silakan nyalakan GPS / Layanan Lokasi di HP Anda, lalu coba lagi.");
        }
        return null;
      }

      // Coba ambil lokasi terakhir (last known) jika masih baru (1 menit)
      let freshLoc = await Location.getLastKnownPositionAsync({
        maxAge: 60000 
      }).catch(() => null);

      if (!freshLoc) {
        // Jika tidak ada lokasi terakhir, minta posisi baru (Balanced mode agar cepat)
        freshLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (freshLoc?.coords) {
        setLocation(freshLoc.coords);
        setGpsUpdatedAt(new Date());
        setGpsError(null);
        return freshLoc.coords;
      }
    } catch (err) {
      console.error('GPS error:', err);
      // Fallback jika getCurrentPosition gagal (misal susah sinyal GPS)
      try {
         const fallbackLoc = await Location.getLastKnownPositionAsync();
         if (fallbackLoc?.coords) {
           setLocation(fallbackLoc.coords);
           setGpsUpdatedAt(new Date());
           setGpsError(null);
           return fallbackLoc.coords;
         }
      } catch (fallbackErr) {
         console.error('Fallback GPS error:', fallbackErr);
      }

      setLocation(null);
      if (err?.message?.includes('unsatisfied device settings')) {
        setGpsError("GPS belum aktif / mode hemat daya.");
      } else if (err?.message?.includes('Not authorized')) {
        setGpsError("Izin lokasi ditolak.");
      } else {
        setGpsError("Sinyal GPS lemah. Cari ruang terbuka.");
      }
    } finally {
      if (!silent) setGpsLoading(false);
    }
    return null;
  };

  // EFFECT: Inisialisasi GPS — permission diminta SEKALI, lalu ambil lokasi sekali saja.
  useEffect(() => {
    let isMounted = true;

    const initLocation = async () => {
      try {
        // Request permission SEKALI saja
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setGpsError('Izin lokasi belum diberikan.');
          }
          return;
        }

        if (!isMounted) return;

        // Ambil posisi awal sekali saja saat form dibuka
        await refreshLocation(true);
      } catch (error) {
        console.error('Gagal inisialisasi GPS:', error);
        if (isMounted) {
          setGpsError('GPS tidak dapat digunakan.');
        }
      }
    };

    initLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // AUTOCOMPLETE LOGIC (Sorted Alphabetically & Dedicated for AMT 1 vs AMT 2)
  const handleSearchAmt1 = (text) => {
    setAmt1(text);
    setShowWorkers2(false);
    const filtered = workers
      .filter(w => isAmt1Jabatan(w.jabatan) && (text.length === 0 || w.name.toLowerCase().includes(text.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name));
    setFilteredWorkers1(filtered);
    setShowWorkers1(true);
  };
  const handleSearchAmt2 = (text) => {
    setAmt2(text);
    setShowWorkers1(false);
    const filtered = workers
      .filter(w => isAmt2Jabatan(w.jabatan) && (text.length === 0 || w.name.toLowerCase().includes(text.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name));
    setFilteredWorkers2(filtered);
    setShowWorkers2(true);
  };
  const selectAmt1 = (name) => { setAmt1(name); setShowWorkers1(false); };
  const selectAmt2 = (name) => { setAmt2(name); setShowWorkers2(false); };

  // UPDATE ITEMS LOGIC
  const setItemStatus = (index, statusValue) => {
    const newItems = [...items];
    newItems[index].status = statusValue;
    if (statusValue === 'BAIK') {
      newItems[index].catatan = '';
      // Hapus foto kerusakan item ini jika user memilih atau membatalkan ke BAIK
      setPhotos(prev => {
        if (!prev[`item_${index}`]) return prev;
        const nextPhotos = { ...prev };
        delete nextPhotos[`item_${index}`];
        return nextPhotos;
      });
    }
    setItems(newItems);
  };

  const updateItemSeverity = (index, severity) => {
    const newItems = [...items];
    newItems[index].severity = severity;
    setItems(newItems);
  };

  const updateItemCatatan = (index, text) => {
    const newItems = [...items];
    newItems[index].catatan = text;
    setItems(newItems);
  };

  // CAMERA LOGIC
  const openCameraFor = async (type) => {
    if (!permission) return;
    if (!permission.granted) {
      Alert.alert('Izin Diperlukan', 'Kami butuh izin kamera untuk mengambil foto.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Berikan Izin', onPress: requestPermission }
      ]);
      return;
    }

    if (!location) {
      Alert.alert('GPS Belum Siap', 'Silakan tunggu atau perbarui lokasi GPS di bagian Info Perjalanan sebelum mengambil foto.');
      return;
    }

    // Pengecekan instan: Pastikan GPS masih menyala saat ini
    const isServiceEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!isServiceEnabled) {
      setLocation(null);
      setGpsError("Layanan lokasi (GPS) dimatikan.");
      Alert.alert('GPS Dimatikan', 'Sistem mendeteksi GPS Anda dimatikan. Harap nyalakan kembali dan perbarui lokasi sebelum mengambil foto.');
      return;
    }

    // Buka kamera langsung tanpa menunggu (instan)
    setActivePhotoType(type);
    setPreviewPhoto(null);
    setIsCameraReady(false);
    setIsCameraOpen(true);
  };

  const takePicture = () => {
    if (cameraRef.current && !loading) {
      setLoading(true);

      // Beri jeda sedikit agar UI (Loading Indicator) ter-render mulus sebelum membebani Native Camera
      setTimeout(async () => {
        try {
          const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });

          const now = new Date();
          const timestampStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          let locStr = 'Lokasi tidak ditemukan';
          if (location) {
            locStr = `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}`;
          }

          setPreviewPhoto({ ...photo, timestampStr, locStr });
        } catch (error) {
          console.error("Gagal mengambil foto:", error);
        } finally {
          setLoading(false);
        }
      }, 50); // 50ms sudah cukup untuk 3 frame UI (60fps)
    }
  };

  const savePhoto = () => {
    setPhotos({ ...photos, [activePhotoType]: previewPhoto });
    setIsCameraOpen(false);
    setPreviewPhoto(null);
    setActivePhotoType(null);
  };

  // SUBMIT LOGIC

  // Menerima role sebagai parameter agar tidak bergantung pada state yang mungkin masih stale
  const goToDashboard = (role) => {
    const r = role || userRole;
    if (r === 'SUPER_ADMIN' || r === 'ADMIN') {
      navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
    } else if (r === 'PENGAWAS') {
      navigation.reset({ index: 0, routes: [{ name: 'PengawasDashboard' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'UserDashboard' }] });
    }
  };

  const handleSubmit = async () => {
    // Guard double-tap
    if (loading || isSubmittingRef.current) return;

    // 1. Validasi Info Dasar & Odometer
    if (!location) {
      showValidationError("GPS Belum Siap", "Lokasi belum terdeteksi. Silakan periksa status GPS Anda sebelum mengirim laporan.");
      return;
    }

    // Pengecekan instan: Pastikan GPS masih menyala saat ini
    const isServiceEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!isServiceEnabled) {
      setLocation(null);
      setGpsError("Layanan lokasi (GPS) dimatikan.");
      showValidationError("GPS Dimatikan", "Sistem mendeteksi GPS Anda telah dimatikan. Harap nyalakan kembali dan perbarui lokasi di Info Perjalanan.");
      return;
    }

    if (!noPolisi || !odoMeter || !shift) {
      showValidationError("Perhatian", "Informasi perjalanan (Plat, Shift, Odo Meter) tidak boleh kosong.");
      return;
    }

    if (!amt1 || amt1.trim() === '') {
      showValidationError("AMT 1 Wajib Diisi", "Harap masukkan atau pilih nama petugas AMT 1.");
      return;
    }

    if (amt1 && amt2 && amt1.trim().toLowerCase() === amt2.trim().toLowerCase()) {
      showValidationError("Data AMT Duplikat", "Petugas AMT 1 dan AMT 2 tidak boleh orang yang sama.");
      return;
    }

    const currentOdoNum = parseInt(odoMeter.replace(/[^0-9]/g, ''), 10);
    if (isNaN(currentOdoNum) || currentOdoNum <= 0) {
      showValidationError("Odometer Tidak Valid", "Harap masukkan angka odometer yang valid (hanya angka positif).");
      return;
    }

    if (type === 'akhiri' && previousOdometer && currentOdoNum < previousOdometer) {
      showValidationError(
        "Peringatan Odometer",
        `Odometer Akhir (${currentOdoNum.toLocaleString('id-ID')} km) tidak boleh lebih kecil dari Odometer Awal (${previousOdometer.toLocaleString('id-ID')} km). Harap periksa kembali angka odometer fisik kendaraan.`
      );
      return;
    }

    // 2. Validasi Wajib Isi Semua Checklist
    const emptyItem = items.find(item => item.status === null);
    if (emptyItem) {
      showValidationError("Form Belum Lengkap", `Anda belum mengecek item:\n"${emptyItem.name}"\n\nHarap pilih [NORMAL] atau [ISU]!`);
      return;
    }

    // 3. Deteksi Blokir Major (Hanya berlaku untuk Kategori A / Mobil Tangki)
    const hasMajor = items.some(item => item.status === 'RUSAK' && item.category === 'A' && item.severity === 'Major');
    if (hasMajor) {
      // Untuk notifikasi peringatan saja sebelum lanjut (bisa diabaikan jika butuh blocking)
      // showValidationError("KENDARAAN DIBLOKIR", "Terdapat temuan MAJOR. Kendaraan diblokir dan laporan akan langsung diteruskan ke Admin!");
    }

    // 4. (Dihapus) Validasi Catatan sekarang opsional (tidak wajib diisi)

    // 5. Validasi Foto Lengkap
    const missingPhotos = REQUIRED_PHOTOS.filter(p => !photos[p]);
    if (missingPhotos.length > 0) {
      showValidationError("Foto Belum Lengkap", `Harap ambil foto wajib untuk sisi: ${missingPhotos.join(', ')}`);
      return;
    }

    // 6. Validasi Wajib Foto Kerusakan
    const missingIssuePhotos = items.filter((item, idx) => item.status === 'RUSAK' && item.category === 'A' && !photos[`item_${idx}`]);
    if (missingIssuePhotos.length > 0) {
      showValidationError("Foto Kerusakan Belum Lengkap", `Harap ambil foto untuk kerusakan pada item:\n"${missingIssuePhotos[0].name}"`);
      return;
    }

    // SEMUA VALIDASI LULUS -> Tampilkan modal konfirmasi
    setShowConfirmSubmitModal(true);
  };

  const confirmAndSubmit = async () => {
    setShowConfirmSubmitModal(false);
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : { id: 1, role: 'USER' }; // Fallback for dev
      const currentRole = user.role || 'USER'; // Simpan di variabel lokal, jangan andalkan state

      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('noPolisi', noPolisi);
      formData.append('shift', shift);
      formData.append('type', type || 'mulai');
      formData.append('amt1', amt1 || '');
      formData.append('amt2', amt2 || '');

      const finalItems = items.map(i => ({
        ...i,
        isGood: i.status === 'BAIK',
        name: i.name + (i.status === 'RUSAK' && i.category === 'A' && i.severity ? ` [${i.severity.toUpperCase()}]` : '') + (i.catatan ? ` - ${i.catatan}` : '')
      }));
      finalItems.push({ category: 'C', name: `Odo Meter: ${odoMeter}`, isGood: true });
      formData.append('items', JSON.stringify(finalItems));
      if (notes && notes.trim()) {
        formData.append('notes', notes.trim());
      }

      let currentLoc = location;

      if (currentLoc) {
        formData.append('locationLat', currentLoc.latitude);
        formData.append('locationLng', currentLoc.longitude);
      }

      for (const key of Object.keys(photos)) {
        const p = photos[key];
        if (p) {
          // Determine the friendly name for the backend
          let photoName = `photo_${key}.jpg`;
          if (key.startsWith('item_')) {
            const idx = parseInt(key.split('_')[1]);
            // JANGAN KIRIM foto kerusakan jika item tersebut statusnya BUKAN RUSAK!
            if (!items[idx] || items[idx].status !== 'RUSAK') {
              continue;
            }
            const itemName = items[idx]?.name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
            photoName = `Kerusakan_${itemName}.jpg`;
          }

          const filename = p.uri.split('/').pop();
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          if (Platform.OS === 'web') {
            try {
              const res = await fetch(p.uri);
              const blob = await res.blob();
              formData.append('photos', blob, photoName);
            } catch (err) {
              console.log("Failed to append web photo:", err);
            }
          } else {
            formData.append('photos', { uri: p.uri, name: photoName, type });
          }
        }
      }

      const token = await AsyncStorage.getItem('token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(`${API_URL}/api/handovers`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...authHeaders
        },
      });

      const issueItems = finalItems.filter(i => !i.isGood);
      const hasMajorIssue = issueItems.some(i => i.category === 'A' && i.name.includes('[MAJOR]'));

      if (issueItems.length > 0 && response.data.handover) {
        // Jika ada temuan, backend bisa mengirim notifikasi email dll (diurus di backend)
        console.log("Handover dengan temuan berhasil disubmit:", response.data.handover.id);
      }

      setLoading(false);

      if (hasMajorIssue) {
        setSubmittedWithMajorIssue(true);
      }

      // Tampilkan Modal Sukses Cantik
      setShowSuccessModal(true);

      // Otomatis kembali ke dashboard (lebih lama jika diblokir agar sempat dibaca)
      setTimeout(() => {
        setShowSuccessModal(false);
        setSubmittedWithMajorIssue(false); // Reset state
        goToDashboard(currentRole);
      }, hasMajorIssue ? 4000 : 2500);

    } catch (error) {
      setLoading(false);
      isSubmittingRef.current = false;
      console.error(error);
      showValidationError('Error', 'Gagal mengirim laporan. Pastikan Backend sudah menyala dan internet stabil.');
    }
  };

  // RENDER ITEM CHECKLIST
  const renderChecklistItem = (item) => {
    const originalIdx = items.findIndex(x => x.name === item.name);
    const isBaik = item.status === 'BAIK';
    const isRusak = item.status === 'RUSAK';
    const optionLabels = getItemOptionLabels(item);

    return (
      <View key={originalIdx} style={tw`border-b border-gray-100 p-5 ${isRusak ? 'bg-red-50/50' : isBaik ? 'bg-green-50/30' : 'bg-white'}`}>
        <View style={tw`flex-col`}>
          <Text style={tw`text-gray-800 font-bold text-base mb-4 ${isRusak ? 'text-red-700' : ''}`}>{item.name}</Text>
          <View style={tw`flex-row justify-between gap-3`}>
            {/* Tombol BAIK */}
            <TouchableOpacity
              style={tw`flex-1 rounded-xl overflow-hidden shadow-sm`}
              onPress={() => setItemStatus(originalIdx, 'BAIK')}
            >
              <LinearGradient
                colors={isBaik ? PERTAMINA_GREEN : ['#F3F4F6', '#E5E7EB']}
                style={tw`py-3 px-2 items-center justify-center border ${isBaik ? 'border-transparent' : 'border-gray-200'} rounded-xl`}
              >
                <Text style={tw`font-extrabold text-sm ${isBaik ? 'text-white' : 'text-gray-500'}`} numberOfLines={1}>
                  {optionLabels.good}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Tombol RUSAK */}
            <TouchableOpacity
              style={tw`flex-1 rounded-xl overflow-hidden shadow-sm`}
              onPress={() => setItemStatus(originalIdx, 'RUSAK')}
            >
              <LinearGradient
                colors={isRusak ? PERTAMINA_RED : ['#F3F4F6', '#E5E7EB']}
                style={tw`py-3 px-2 items-center justify-center border ${isRusak ? 'border-transparent' : 'border-gray-200'} rounded-xl`}
              >
                <Text style={tw`font-extrabold text-sm ${isRusak ? 'text-white' : 'text-gray-500'}`} numberOfLines={1}>
                  {optionLabels.bad}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Tambahan Jika RUSAK (Langsung Minta Catatan, Severity otomatis dari setting Admin) */}
        {isRusak && (
          <View style={tw`mt-4 pt-4 border-t border-red-200`}>
            <View style={tw`flex-row items-center mb-3 justify-between`}>
              <Text style={tw`text-xs font-bold text-red-800 uppercase tracking-wider`}>Detail Kerusakan / Catatan:</Text>
            </View>

            <View style={tw`bg-white rounded-xl shadow-sm border border-red-100 p-1`}>
              <TextInput
                style={[tw`p-3 text-sm text-gray-800 font-medium`, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Ketik detail kerusakan di sini... (Opsional)"
                placeholderTextColor="#9CA3AF"
                value={item.catatan}
                onChangeText={(text) => updateItemCatatan(originalIdx, text)}
                multiline
                maxLength={500}
              />
            </View>


            {/* Wajib Foto Kerusakan */}
            {item.category === 'A' && (
              <View style={tw`mt-4 items-start`}>
                <Text style={tw`text-xs font-bold text-red-800 uppercase tracking-wider mb-2`}>* Foto Kerusakan (Wajib)</Text>
                <View style={tw`relative`}>
                  <TouchableOpacity
                    style={tw`w-32 h-32 bg-slate-50 rounded-2xl border-2 ${photos[`item_${originalIdx}`] ? 'border-green-500 shadow-md' : 'border-dashed border-red-300'} justify-center items-center overflow-hidden`}
                    onPress={() => openCameraFor(`item_${originalIdx}`)}
                  >
                    {photos[`item_${originalIdx}`] ? (
                      <>
                        <Image source={{ uri: photos[`item_${originalIdx}`].uri }} style={tw`w-full h-full`} resizeMode="cover" />
                        <View style={tw`absolute inset-0 bg-black/20 justify-center items-center`}>
                          <Ionicons name="checkmark-circle" size={32} color="white" />
                        </View>
                      </>
                    ) : (
                      <>
                        <Ionicons name="camera" size={32} color="#DC2626" />
                        <Text style={tw`text-xs text-red-600 mt-2 font-bold`}>Ambil Foto</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {photos[`item_${originalIdx}`] && (
                    <TouchableOpacity
                      style={tw`absolute -top-2 -right-2 bg-red-600 rounded-full p-1.5 shadow-md z-10 border-2 border-white`}
                      onPress={() => {
                        setPhotos(prev => {
                          const nextPhotos = { ...prev };
                          delete nextPhotos[`item_${originalIdx}`];
                          return nextPhotos;
                        });
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50 ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
      {isLargeScreen && user && (
        <WebSidebar
          user={user}
          activeMenu={'Home'}
          navigation={navigation}
          handleLogout={handleLogout}
        />
      )}

      <View style={[tw`flex-1 relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
        <WebNavbar
          user={user}
          title="Form Handover"
          subtitle="Pemeriksaan & Serah Terima Truk Tangki"
          showBack={true}
          onBack={handleBackPress}
          navigation={navigation}
        />

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`w-full px-4 pt-8 pb-10`}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Perjalanan */}
          <View style={tw`bg-white p-6 rounded-3xl mb-8 shadow-md border border-gray-100`}>
            <View style={tw`flex-row items-center justify-between mb-5`}>
              <View style={tw`flex-row items-center flex-shrink-0 mr-2`}>
                <View style={tw`bg-blue-50 p-2.5 rounded-2xl mr-2.5`}>
                  <Ionicons name="car-sport" size={20} color="#0055A5" />
                </View>
                <Text style={tw`text-gray-800 font-extrabold text-base tracking-tight`}>Info Perjalanan</Text>
              </View>

              {/* GPS Detail di Samping Info Perjalanan */}
              <TouchableOpacity
                onPress={() => setShowGpsModal(true)}
                activeOpacity={0.7}
                style={tw`flex-row items-center bg-white border ${location ? 'border-emerald-200' : 'border-amber-200'} px-3 py-2 rounded-2xl shadow-sm`}
              >
                <View style={tw`w-7 h-7 rounded-xl ${location ? 'bg-emerald-500' : 'bg-amber-500'} items-center justify-center mr-2.5 flex-shrink-0 shadow-sm`}>
                  <Ionicons name={location ? "location" : "navigate"} size={13} color="#FFFFFF" />
                </View>
                <View style={tw`justify-center`}>
                  <View style={tw`flex-row items-center`}>
                    <Text style={tw`text-xs font-black ${location ? 'text-emerald-800' : 'text-amber-800'} tracking-tight`}>
                      {location ? 'GPS Terdeteksi' : 'GPS Belum Siap'}
                    </Text>
                  </View>
                  <Text style={tw`text-[10px] font-bold text-gray-500 font-mono mt-0.5`}>
                    Ketuk untuk detail
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={tw`text-gray-500 font-bold text-xs uppercase tracking-wider mb-2`}>No Polisi Kendaraan</Text>
            <TextInput
              style={tw`p-4 rounded-2xl border mb-5 font-bold text-base shadow-sm ${initialNoPolisi ? 'bg-gray-200 border-gray-300 text-gray-600' : 'bg-slate-50 border-slate-200 text-black'}`}
              value={noPolisi}
              onChangeText={setNoPolisi}
              placeholder="Ketik Plat Nomor (Sesuai Kendaraan)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              editable={!initialNoPolisi}
            />

            <Text style={tw`text-gray-500 font-bold text-xs uppercase tracking-wider mb-2`}>Waktu Jam / Shift</Text>
            <TouchableOpacity
              style={tw`bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5 flex-row justify-between items-center shadow-sm`}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={tw`text-black font-extrabold text-lg`}>{shift}</Text>
              <View style={tw`bg-blue-100 p-2 rounded-xl`}>
                <Ionicons name="time" size={20} color="#0055A5" />
              </View>
            </TouchableOpacity>

            <Text style={tw`text-gray-500 font-bold text-xs uppercase tracking-wider mb-2`}>AMT 1</Text>
            <View style={tw`mb-5`}>
              <TextInput
                style={tw`bg-slate-50 p-4 rounded-2xl border border-slate-200 text-black font-bold text-base shadow-sm ${isAmt1Locked ? "text-gray-500 bg-gray-100" : ""}`}
                placeholder="Nama AMT 1"
                value={amt1}
                editable={!isAmt1Locked}
                onChangeText={handleSearchAmt1}
                onFocus={() => {
                  if (!isAmt1Locked) {
                    setShowWorkers2(false);
                    const filtered = workers
                      .filter(w => isAmt1Jabatan(w.jabatan) && (amt1.length === 0 || w.name.toLowerCase().includes(amt1.toLowerCase())))
                      .sort((a, b) => a.name.localeCompare(b.name));
                    setFilteredWorkers1(filtered);
                    setShowWorkers1(true);
                  }
                }}
              />
              {showWorkers1 && filteredWorkers1.length > 0 && !isAmt1Locked && (
                <View style={tw`mt-2 bg-white border border-blue-200 rounded-2xl shadow-sm overflow-hidden`}>
                  <View style={tw`px-4 py-2.5 bg-blue-50/80 border-b border-blue-100 flex-row justify-between items-center`}>
                    <Text style={tw`text-xs font-bold text-[#0055A5]`}>Pilih Awak Mobil Tangki (AMT 1)</Text>
                    <TouchableOpacity onPress={() => setShowWorkers1(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {filteredWorkers1.map(w => (
                      <TouchableOpacity
                        key={w.id}
                        style={tw`p-3.5 border-b border-gray-100 flex-row justify-between items-center active:bg-blue-50`}
                        onPress={() => selectAmt1(w.name)}
                      >
                        <Text style={tw`font-bold text-gray-800 text-sm`}>{w.name}</Text>
                        <View style={tw`bg-blue-100 px-2 py-0.5 rounded-md`}>
                          <Text style={tw`text-xs font-bold text-[#0055A5]`}>{w.jabatan || 'AMT I'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={tw`text-gray-500 font-bold text-xs uppercase tracking-wider mb-2`}>AMT 2</Text>
            <View style={tw`mb-5`}>
              <TextInput
                style={tw`bg-slate-50 p-4 rounded-2xl border border-slate-200 text-black font-bold text-base shadow-sm ${isAmt2Locked ? "text-gray-500 bg-gray-100" : ""}`}
                placeholder="Nama AMT 2"
                value={amt2}
                editable={!isAmt2Locked}
                onChangeText={handleSearchAmt2}
                onFocus={() => {
                  if (!isAmt2Locked) {
                    setShowWorkers1(false);
                    const filtered = workers
                      .filter(w => isAmt2Jabatan(w.jabatan) && (amt2.length === 0 || w.name.toLowerCase().includes(amt2.toLowerCase())))
                      .sort((a, b) => a.name.localeCompare(b.name));
                    setFilteredWorkers2(filtered);
                    setShowWorkers2(true);
                  }
                }}
              />
              {showWorkers2 && filteredWorkers2.length > 0 && !isAmt2Locked && (
                <View style={tw`mt-2 bg-white border border-blue-200 rounded-2xl shadow-sm overflow-hidden`}>
                  <View style={tw`px-4 py-2.5 bg-blue-50/80 border-b border-blue-100 flex-row justify-between items-center`}>
                    <Text style={tw`text-xs font-bold text-[#0055A5]`}>Pilih Awak Mobil Tangki (AMT 2)</Text>
                    <TouchableOpacity onPress={() => setShowWorkers2(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {filteredWorkers2.map(w => (
                      <TouchableOpacity
                        key={w.id}
                        style={tw`p-3.5 border-b border-gray-100 flex-row justify-between items-center active:bg-blue-50`}
                        onPress={() => selectAmt2(w.name)}
                      >
                        <Text style={tw`font-bold text-gray-800 text-sm`}>{w.name}</Text>
                        <View style={tw`bg-indigo-100 px-2 py-0.5 rounded-md`}>
                          <Text style={tw`text-xs font-bold text-indigo-700`}>{w.jabatan || 'AMT II'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={tw`flex-row justify-between items-center mb-2`}>
              <Text style={tw`text-gray-500 font-bold text-xs uppercase tracking-wider`}>{type === 'akhiri' ? 'Odometer Akhir' : 'Odometer Awal'}</Text>
              {previousOdometer ? (
                <Text style={tw`text-[11px] font-bold text-blue-600`}>Sebelumnya: {previousOdometer.toLocaleString('id-ID')} km</Text>
              ) : null}
            </View>
            <TextInput
              style={tw`bg-slate-50 p-4 rounded-2xl border border-slate-200 text-black font-bold text-base shadow-sm`}
              placeholder="Misal: 150000"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={odoMeter}
              onChangeText={setOdoMeter}
            />
          </View>

          {/* Dynamic Checklist Categories (A & B) */}
          {Object.keys(categoryGroups).sort().filter(cat => cat === 'A' || cat === 'B').map(cat => {
            const meta = getCategoryMeta(cat);
            return (
              <View key={cat} style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-8`}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                  <View style={tw`${meta.bg} p-2 rounded-xl mr-3 shadow-sm`}>
                    <Ionicons name={meta.icon} size={24} color={meta.color} />
                  </View>
                  <Text style={tw`font-extrabold text-lg text-gray-800`}>{meta.title}</Text>
                </LinearGradient>
                {categoryGroups[cat].map(renderChecklistItem)}
              </View>
            );
          })}

          {/* Area Foto 4 Sisi */}
          <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-8 p-5`}>
            <View style={tw`flex-row items-center mb-5`}>
              <View style={tw`bg-red-50 p-2 rounded-xl mr-3 shadow-sm`}>
                <Ionicons name="camera" size={24} color="#ED1C24" />
              </View>
              <Text style={tw`font-extrabold text-lg text-gray-800`}>C. Foto Kendaraan Wajib</Text>
            </View>

            <View style={tw`flex-row flex-wrap justify-between gap-y-4`}>
              {REQUIRED_PHOTOS.map(side => (
                <TouchableOpacity
                  key={side}
                  style={tw`w-[48%] aspect-square bg-slate-50 rounded-2xl border-2 ${photos[side] ? 'border-green-500 shadow-md' : 'border-dashed border-slate-300'} justify-center items-center overflow-hidden`}
                  onPress={() => openCameraFor(side)}
                >
                  {photos[side] ? (
                    <View style={tw`w-full h-full relative`}>
                      <Image source={{ uri: photos[side].uri }} style={tw`w-full h-full`} resizeMode="cover" />

                      {/* Thumbnail Watermark */}
                      <View style={tw`absolute top-1 left-1 right-1`}>
                        <Text style={tw`text-white text-[7px] font-bold bg-black/60 px-1 py-0.5 rounded shadow-lg`} numberOfLines={1}>{photos[side].locStr}</Text>
                        <Text style={tw`text-white text-[7px] font-bold bg-black/60 px-1 py-0.5 rounded shadow-lg mt-0.5`} numberOfLines={1}>{photos[side].timestampStr}</Text>
                      </View>

                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={tw`absolute inset-0 justify-end items-center pb-3`} pointerEvents="none">
                        <Ionicons name="checkmark-circle" size={24} color="#2ECC71" style={tw`mb-1 shadow-lg`} />
                        <Text style={tw`text-white font-extrabold text-[10px] tracking-wider shadow-lg`}>{side.toUpperCase()}</Text>
                      </LinearGradient>
                    </View>
                  ) : (
                    <>
                      <View style={tw`bg-white p-3 rounded-full shadow-sm mb-3`}>
                        <Ionicons name="camera-outline" size={28} color="#9CA3AF" />
                      </View>
                      <Text style={tw`text-gray-600 text-sm font-extrabold tracking-wider`}>{side}</Text>
                      <Text style={tw`text-gray-400 text-xs font-medium mt-1`}>Ketuk untuk foto</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Catatan Umum Handover */}
          <View style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-8 p-5`}>
            <View style={tw`flex-row items-center justify-between mb-4`}>
              <View style={tw`flex-row items-center`}>
                <View style={tw`bg-gray-100 p-2 rounded-xl mr-3 shadow-sm`}>
                  <Ionicons name="document-text" size={24} color="#4B5563" />
                </View>
                <Text style={tw`font-extrabold text-lg text-gray-800`}>Catatan Umum</Text>
              </View>
              <View style={tw`bg-gray-100 px-2 py-0.5 rounded-full`}>
                <Text style={tw`text-[10px] font-bold text-gray-400`}>OPSIONAL</Text>
              </View>
            </View>
            <TextInput
              style={[tw`bg-gray-50 rounded-2xl p-4 text-sm text-gray-800 border border-gray-200`, { minHeight: 120, textAlignVertical: 'top', fontFamily: 'System' }]}
              placeholder="Tambahkan catatan umum terkait serah terima atau kondisi fisik kendaraan (misal: baret panel kanan, ban aus, dll)..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              value={notes}
              onChangeText={setNotes}
            />
            {notes.length > 0 && (
              <Text style={tw`text-[11px] text-gray-400 text-right mt-1 font-medium`}>{notes.length}/1000</Text>
            )}
          </View>

          {/* Dynamic Checklist Categories (Catatan Tambahan - C, D, dst) */}
          {Object.keys(categoryGroups).sort().filter(cat => cat !== 'A' && cat !== 'B').map(cat => {
            const meta = getCategoryMeta(cat);
            return (
              <View key={cat} style={tw`bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-8`}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`p-5 flex-row items-center border-b border-gray-200`}>
                  <View style={tw`${meta.bg} p-2 rounded-xl mr-3 shadow-sm`}>
                    <Ionicons name={meta.icon} size={24} color={meta.color} />
                  </View>
                  <Text style={tw`font-extrabold text-lg text-gray-800`}>{meta.title}</Text>
                </LinearGradient>
                {categoryGroups[cat].map(renderChecklistItem)}
              </View>
            );
          })}

          <View style={tw`h-6`} />
        </ScrollView>

        {/* Tombol Submit Utama */}
        <View style={[tw`p-5 bg-white border-t border-gray-200 pb-10`, { elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10 }]}>
          <View style={tw`w-full`}>
            <TouchableOpacity
              style={tw`rounded-2xl overflow-hidden shadow-xl ${loading ? 'opacity-70' : ''}`}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient colors={PERTAMINA_BLUE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tw`p-5 items-center flex-row justify-center`}>
                {loading ? (
                  <ActivityIndicator color="white" style={tw`mr-3`} />
                ) : (
                  <Ionicons name="paper-plane" size={24} color="white" style={tw`mr-3`} />
                )}
                <Text style={tw`text-white font-extrabold text-xl tracking-wide`}>
                  {loading ? "MEMPROSES..." : (type === 'akhiri' ? 'AKHIRI PERJALANAN' : 'MULAI PERJALANAN')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* MODAL LOADING */}
      <Modal visible={loading} transparent={true} animationType="fade">
        <View style={tw`flex-1 justify-center items-center bg-slate-900/80 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[40px] p-8 items-center shadow-2xl border border-white/20`}>
            <TextLogo style={[tw`mb-4`, { transform: [{ scale: 1.2 }] }]} />
            <ActivityIndicator size="large" color="#4A90E2" style={tw`mb-5`} />
            <Text style={tw`text-2xl font-black text-gray-800 mb-2 text-center tracking-tight`}>Mohon Ditunggu</Text>
            <Text style={tw`text-gray-500 text-center font-medium text-sm leading-5`}>
              Sedang memproses dan mengirim data...
            </Text>
          </View>
        </View>
      </Modal>

      {/* MODAL TIME PICKER */}
      <Modal visible={showTimePicker} transparent={true} animationType="slide">
        <View style={tw`flex-1 justify-end bg-black/60`}>
          <View style={tw`bg-white rounded-t-[40px] p-8 shadow-2xl`}>
            <View style={tw`flex-row justify-between items-center mb-8`}>
              <View>
                <Text style={tw`text-2xl font-extrabold text-gray-800 tracking-tight`}>Pilih Waktu</Text>
                <Text style={tw`text-gray-500 font-medium mt-1`}>Tentukan jam operasional shift</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTimePicker(false)} style={tw`p-3 bg-slate-100 rounded-2xl`}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`flex-row justify-center items-center mb-10`}>
              {/* Hour Scroll/Selector */}
              <View style={tw`w-28 h-56 bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden`}>
                <ScrollView showsVerticalScrollIndicator={false} snapToInterval={56} decelerationRate="fast" contentContainerStyle={tw`py-20`}>
                  {Array.from({ length: 24 }).map((_, i) => {
                    const hr = i.toString().padStart(2, '0');
                    const isSelected = hr === selectedHour;
                    return (
                      <TouchableOpacity
                        key={hr}
                        style={tw`h-[56px] justify-center items-center ${isSelected ? 'bg-blue-500 rounded-2xl mx-2 shadow-md' : ''}`}
                        onPress={() => setSelectedHour(hr)}
                      >
                        <Text style={tw`text-3xl font-extrabold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{hr}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              <Text style={tw`text-4xl font-black text-slate-300 mx-5`}>:</Text>

              {/* Minute Scroll/Selector */}
              <View style={tw`w-28 h-56 bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden`}>
                <ScrollView showsVerticalScrollIndicator={false} snapToInterval={56} decelerationRate="fast" contentContainerStyle={tw`py-20`}>
                  {Array.from({ length: 60 }).map((_, i) => {
                    const min = i.toString().padStart(2, '0');
                    const isSelected = min === selectedMinute;
                    return (
                      <TouchableOpacity
                        key={min}
                        style={tw`h-[56px] justify-center items-center ${isSelected ? 'bg-blue-500 rounded-2xl mx-2 shadow-md' : ''}`}
                        onPress={() => setSelectedMinute(min)}
                      >
                        <Text style={tw`text-3xl font-extrabold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{min}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={tw`rounded-2xl overflow-hidden shadow-xl`}
              onPress={() => {
                setShift(`${selectedHour}:${selectedMinute}`);
                setShowTimePicker(false);
              }}
            >
              <LinearGradient colors={PERTAMINA_BLUE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tw`p-5 items-center justify-center`}>
                <Text style={tw`text-white font-extrabold text-lg tracking-wide`}>SIMPAN WAKTU</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL KAMERA FULL SCREEN */}
      <Modal
        visible={isCameraOpen}
        animationType="slide"
        transparent={false}
        onShow={() => setIsCameraReady(true)}
      >
        {previewPhoto ? (
          <View style={tw`flex-1 bg-black relative`}>
            <Image source={{ uri: previewPhoto.uri }} style={tw`w-full h-full absolute inset-0`} resizeMode="contain" />

            {/* WATERMARK OVERLAY PADA PREVIEW */}
            <View style={tw`absolute bottom-40 left-6 bg-black/60 p-4 rounded-2xl border border-white/20 shadow-2xl`}>
              <Text style={tw`text-white font-bold text-xs mb-2`}><Ionicons name="location" size={14} color="#2ECC71" /> {previewPhoto.locStr}</Text>
              <Text style={tw`text-white font-bold text-xs`}><Ionicons name="time" size={14} color="#2ECC71" /> {previewPhoto.timestampStr}</Text>
            </View>

            {/* TOMBOL BATAL / TUTUP PREVIEW */}
            <TouchableOpacity
              style={tw`absolute top-14 left-6 bg-black/50 p-3 rounded-full border border-white/20 z-10`}
              onPress={() => {
                setPreviewPhoto(null);
                setIsCameraOpen(false);
                setActivePhotoType(null);
              }}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>

            <View style={tw`absolute top-14 left-0 right-0 items-center px-4`}>
              <LinearGradient colors={PERTAMINA_GREEN} style={tw`px-6 py-3 rounded-full shadow-2xl border border-white/20`}>
                <Text style={tw`text-white font-extrabold tracking-wider text-sm`}>
                  HASIL FOTO: {activePhotoType?.toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
            <View style={tw`absolute bottom-12 w-full px-8 flex-row justify-between gap-4`}>
              <TouchableOpacity
                style={tw`flex-1 bg-white/10 py-5 rounded-2xl items-center border border-white/20 flex-row justify-center`}
                onPress={() => setPreviewPhoto(null)}
              >
                <Ionicons name="refresh" size={24} color="white" style={tw`mr-2`} />
                <Text style={tw`text-white font-extrabold text-lg tracking-wide`}>ULANGI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 rounded-2xl overflow-hidden shadow-2xl`}
                onPress={savePhoto}
              >
                <LinearGradient colors={PERTAMINA_GREEN} style={tw`py-5 items-center flex-row justify-center h-full`}>
                  <Ionicons name="checkmark-done" size={24} color="white" style={tw`mr-2`} />
                  <Text style={tw`text-white font-extrabold text-lg tracking-wide`}>SIMPAN</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={tw`flex-1 bg-black`}>
            {isCameraReady ? (
              <CameraView style={tw`absolute inset-0`} facing="back" ref={cameraRef} />
            ) : (
              <View style={tw`flex-1 items-center justify-center`}>
                <ActivityIndicator color="white" size="large" />
                <Text style={tw`text-white font-bold mt-4 text-xs tracking-widest uppercase`}>Menyiapkan Kamera...</Text>
              </View>
            )}

            <View style={tw`absolute inset-0 justify-between`} pointerEvents="box-none">
              <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent']} style={tw`absolute top-0 w-full h-40`} pointerEvents="none" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={tw`absolute bottom-0 w-full h-40`} pointerEvents="none" />

              <View style={tw`pt-14 px-4 items-center`} pointerEvents="none">
                <View style={tw`bg-black/50 px-8 py-4 rounded-full border border-white/30 items-center shadow-2xl`}>
                  <Text style={tw`text-white font-bold text-lg tracking-widest`}>
                    ARAHKAN KE <Text style={tw`text-[#2ECC71] font-black`}>{activePhotoType?.toUpperCase()}</Text>
                  </Text>
                </View>
              </View>

              <View style={tw`flex-1 justify-center items-center`} pointerEvents="none">
                <View style={tw`w-72 h-96 border-2 border-dashed border-white/40 rounded-3xl relative shadow-2xl bg-white/5 items-center justify-center`}>
                  <View style={tw`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#2ECC71] rounded-tl-3xl`} />
                  <View style={tw`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-[#2ECC71] rounded-tr-3xl`} />
                  <View style={tw`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-[#2ECC71] rounded-bl-3xl`} />
                  <View style={tw`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#2ECC71] rounded-br-3xl`} />

                  <Ionicons name="scan-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={tw`text-white/90 font-bold text-xs mt-3 bg-black/50 px-3.5 py-1.5 rounded-full border border-white/20`}>
                    Ambil foto secara tegak (Portrait)
                  </Text>
                </View>
              </View>

              <View style={tw`pb-12 w-full flex-row justify-center items-center px-8`} pointerEvents="box-none">
                <TouchableOpacity
                  style={tw`absolute left-8 bg-white/10 p-4 rounded-full border border-white/20`}
                  onPress={() => setIsCameraOpen(false)}
                >
                  <Ionicons name="close" size={32} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`w-24 h-24 bg-white/20 rounded-full border-4 border-white shadow-xl justify-center items-center ${loading ? 'opacity-50' : ''}`}
                  onPress={takePicture}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="white" size="large" /> : <View style={tw`w-20 h-20 bg-white rounded-full`} />}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* MODAL KONFIRMASI KELUAR (UNSAVED CHANGES) */}
      <Modal visible={showExitConfirmModal} transparent={true} animationType="fade" onRequestClose={() => setShowExitConfirmModal(false)}>
        <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[30px] p-8 items-center shadow-2xl relative overflow-hidden`}>
            <View style={tw`w-20 h-20 bg-amber-50 rounded-full items-center justify-center mb-5 border-4 border-amber-100`}>
              <Ionicons name="warning-outline" size={48} color="#D97706" />
            </View>
            <Text style={tw`text-2xl font-black text-gray-800 mb-2 text-center tracking-tight`}>Keluar dari Form?</Text>
            <Text style={tw`text-gray-500 text-center mb-8 font-medium leading-6 px-2`}>
              Checklist dan foto yang telah Anda ambil akan hilang jika Anda meninggalkan halaman ini.
            </Text>
            <View style={tw`flex-row w-full`}>
              <TouchableOpacity
                style={tw`flex-1 bg-gray-100 py-4 rounded-2xl mr-2 items-center`}
                onPress={() => setShowExitConfirmModal(false)}
              >
                <Text style={tw`text-gray-700 font-bold`}>Lanjut Isi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 bg-[#ED1C24] py-4 rounded-2xl ml-2 items-center shadow-md`}
                onPress={() => {
                  setShowExitConfirmModal(false);
                  goToDashboard();
                }}
              >
                <Text style={tw`text-white font-bold`}>Ya, Keluar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL KONFIRMASI SUBMIT */}
      <Modal visible={showConfirmSubmitModal} transparent={true} animationType="fade" onRequestClose={() => setShowConfirmSubmitModal(false)}>
        <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[30px] p-8 items-center shadow-2xl relative overflow-hidden`}>
            <View style={tw`w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-5 border-4 border-blue-100`}>
              <Ionicons name="help-circle" size={48} color="#0055A5" />
            </View>
            <Text style={tw`text-2xl font-black text-gray-800 mb-2 text-center tracking-tight`}>Konfirmasi Kirim</Text>
            <Text style={tw`text-gray-500 text-center mb-8 font-medium leading-6 px-2`}>
              Apakah Anda yakin seluruh data sudah benar dan ingin mengirim laporan {type === 'akhiri' ? 'akhir' : 'mulai'} perjalanan ini?
            </Text>
            <View style={tw`flex-row w-full`}>
              <TouchableOpacity
                style={tw`flex-1 bg-gray-100 py-4 rounded-2xl mr-2 items-center`}
                onPress={() => setShowConfirmSubmitModal(false)}
              >
                <Text style={tw`text-gray-600 font-bold`}>Periksa Lagi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 bg-[#0055A5] py-4 rounded-2xl ml-2 items-center shadow-md`}
                onPress={confirmAndSubmit}
              >
                <Text style={tw`text-white font-bold`}>Ya, Kirim</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL SUKSES (BERHASIL KIRIM) */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View style={tw`flex-1 justify-center items-center bg-slate-900/80 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[40px] p-8 items-center shadow-2xl border border-white/20`}>
            {submittedWithMajorIssue ? (
              <>
                <View style={tw`w-28 h-28 bg-red-50 rounded-full items-center justify-center mb-6 border-8 border-red-100`}>
                  <Ionicons name="warning" size={60} color="#E74C3C" />
                </View>
                <Text style={tw`text-3xl font-black text-red-600 mb-3 text-center tracking-tight`}>Perhatian!</Text>
                <Text style={tw`text-gray-500 text-center mb-8 font-medium leading-6`}>
                  Laporan Anda tersimpan. Karena terdapat temuan kerusakan MAJOR, kendaraan ini otomatis <Text style={tw`font-bold text-red-600`}>DIBLOKIR</Text> dan tidak dapat digunakan.
                </Text>
              </>
            ) : (
              <>
                <View style={tw`w-28 h-28 bg-green-50 rounded-full items-center justify-center mb-6 border-8 border-green-100`}>
                  <Ionicons name="checkmark-done" size={60} color="#2ECC71" />
                </View>
                <Text style={tw`text-3xl font-black text-gray-800 mb-3 text-center tracking-tight`}>Berhasil!</Text>
                <Text style={tw`text-gray-500 text-center mb-8 font-medium leading-6`}>
                  Laporan Handover kendaraan Anda telah tersimpan dengan aman ke server Pertamina.
                </Text>
              </>
            )}
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={tw`text-gray-400 text-xs mt-4 font-bold tracking-widest uppercase`}>Kembali otomatis...</Text>
          </View>
        </View>
      </Modal>

      {/* MODAL VALIDASI ERROR (CUSTOM) */}
      <Modal visible={validationModalVisible} transparent={true} animationType="fade" onRequestClose={() => setValidationModalVisible(false)}>
        <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
          <View style={tw`bg-white w-full max-w-sm rounded-[30px] p-8 items-center shadow-2xl relative overflow-hidden`}>
            {/* Watermark Logo Samar */}
            <TextLogo style={[tw`absolute opacity-10`, { top: -20, right: -40, transform: [{ scale: 1.2 }] }]} />

            <View style={tw`w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-6 border-4 border-red-100`}>
              <Ionicons name="alert-circle" size={48} color="#ED1C24" />
            </View>

            <Text style={tw`text-2xl font-black text-gray-800 mb-2 text-center tracking-tight`}>{validationTitle}</Text>
            <Text style={tw`text-gray-500 text-center mb-8 font-medium leading-6 px-2`}>
              {validationMessage}
            </Text>

            <TouchableOpacity
              style={tw`w-full bg-[#ED1C24] py-4 rounded-xl items-center shadow-lg shadow-red-500/30`}
              onPress={() => setValidationModalVisible(false)}
            >
              <Text style={tw`text-sm text-white font-black tracking-widest uppercase`}>Mengerti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showGpsModal} transparent animationType="fade" onRequestClose={() => setShowGpsModal(false)}>
        <View style={tw`flex-1 bg-black/60 justify-center items-center p-4`}>
          <View style={tw`bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl`}>
            <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={tw`px-5 py-4 border-b border-gray-100 flex-row justify-between items-center`}>
              <Text style={tw`font-extrabold text-lg text-gray-800`}>Informasi Lokasi</Text>
              <TouchableOpacity onPress={() => setShowGpsModal(false)} style={tw`p-1 bg-gray-200 rounded-full`}>
                <Ionicons name="close" size={20} color="#4B5563" />
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={tw`p-5`}>
              <Text style={tw`text-sm text-gray-600 mb-4`}>Lokasi Anda digunakan untuk watermark foto dan bukti serah terima.</Text>
              
              <View style={tw`bg-slate-50 p-4 rounded-2xl border ${location ? 'border-emerald-200' : 'border-amber-200'} mb-5`}>
                <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Status GPS:</Text>
                <Text style={tw`text-base font-extrabold ${location ? 'text-emerald-700' : 'text-amber-700'} mb-3`}>
                  {location ? 'Terdeteksi' : (gpsError || 'Belum Terdeteksi')}
                </Text>
                
                <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Koordinat:</Text>
                <Text style={tw`text-sm font-mono font-bold text-gray-800 mb-3`}>
                  {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : '-'}
                </Text>

                <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Akurasi:</Text>
                <Text style={tw`text-sm font-mono font-bold text-gray-800 mb-3`}>
                  {location ? `± ${location.accuracy.toFixed(1)} meter` : '-'}
                </Text>

                <Text style={tw`text-xs font-bold text-gray-500 mb-1`}>Terakhir Diperbarui:</Text>
                <Text style={tw`text-sm font-mono font-bold text-gray-800`}>
                  {gpsUpdatedAt ? `${gpsUpdatedAt.getHours().toString().padStart(2, '0')}:${gpsUpdatedAt.getMinutes().toString().padStart(2, '0')}:${gpsUpdatedAt.getSeconds().toString().padStart(2, '0')}` : '-'}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => refreshLocation(false)} 
                disabled={gpsLoading}
                style={tw`${gpsLoading ? 'bg-gray-400' : 'bg-blue-600'} flex-row items-center justify-center p-4 rounded-2xl shadow-sm`}
              >
                {gpsLoading ? (
                  <ActivityIndicator color="white" style={tw`mr-2`} />
                ) : (
                  <Ionicons name="refresh" size={20} color="white" style={tw`mr-2`} />
                )}
                <Text style={tw`text-white font-extrabold text-base`}>
                  {gpsLoading ? 'Memperbarui...' : 'Perbarui Lokasi Sekarang'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
