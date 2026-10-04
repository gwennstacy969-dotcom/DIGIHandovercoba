import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Platform, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebSidebar from '../../components/WebSidebar';
import AppModal, { AppModalDetail } from '../../components/AppModal';
import { handleLogoutAndReset } from '../../utils/authHelper';
import { useSubpageBackHandler } from '../../hooks/useSubpageBackHandler';

const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
};

const isNameMatch = (targetName, currentUserName) => {
  if (!targetName || !currentUserName) return false;
  const n1 = normalizeName(targetName);
  const n2 = normalizeName(currentUserName);
  if (n1 === n2) return true;
  const parts1 = n1.split(' ').filter(p => p.length > 2);
  const parts2 = n2.split(' ').filter(p => p.length > 2);
  return parts1.some(p => parts2.includes(p));
};

export default function ScannerScreen({ route, navigation }) {
  const { type } = route?.params || { type: 'mulai' };
  const [permission, requestPermission] = useCameraPermissions();
  const [scanResult, setScanResult] = useState(null); // 'recap' | 'success' | 'error' | 'not_started' | null
  const [errorTitle, setErrorTitle] = useState('Scan Gagal');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastHandover, setLastHandover] = useState(null);
  const [scannedNoPolisi, setScannedNoPolisi] = useState('');
  const [nextScanResult, setNextScanResult] = useState(null);
  const [hangingElapsedHours, setHangingElapsedHours] = useState(0);
  const isFocused = useIsFocused();

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isLargeScreen = screenWidth >= 768;
  const [user, setUser] = useState(null);

  useEffect(() => {
    const onChange = ({ window }) => setScreenWidth(window.width);
    const s = Dimensions.addEventListener('change', onChange);
    return () => s?.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('user').then(str => {
      if (str) setUser(JSON.parse(str));
    });
  }, []);

  const handleLogout = async () => {
    await handleLogoutAndReset(navigation);
  };

  const navigateToDashboard = () => {
    if (!user) return handleLogoutAndReset(navigation);
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      navigation.navigate('AdminDashboard');
    } else if (user.role === 'PENGAWAS') {
      navigation.navigate('PengawasDashboard');
    } else {
      navigation.navigate('UserDashboard');
    }
  };

  useSubpageBackHandler({
    navigation,
    user,
    modals: [
      { isOpen: !!scanResult && scanResult !== 'not_started', close: () => setScanResult(null) },
      { isOpen: scanResult === 'not_started', close: () => { setScanResult(null); navigateToDashboard(); } },
    ],
    onBack: () => {
      if (navigation && navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigateToDashboard();
      }
      return true;
    }
  });

  const handleForceReleaseAndStart = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/handovers/force-release`,
        {
          noPolisi: scannedNoPolisi,
          reason: `Takeover shift gantung setelah ${Math.floor(hangingElapsedHours)} jam`
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setLoading(false);
      setScanResult(null);
      navigation.navigate('HandoverForm', {
        noPolisi: scannedNoPolisi,
        type: 'mulai'
      });
    } catch (e) {
      setLoading(false);
      console.warn('Force release error:', e.message);
      setErrorTitle('Scan Gagal');
      setErrorMessage(e?.response?.data?.error || 'Gagal menutup shift gantung. Silakan coba lagi.');
      setScanResult('error');
    }
  };

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-white px-6`}>
        <Text style={tw`text-center mb-6 text-lg text-gray-700`}>Kami butuh izin kamera untuk scan barcode kendaraan</Text>
        <TouchableOpacity style={tw`bg-blue-600 p-4 rounded-xl`} onPress={requestPermission}>
          <Text style={tw`text-white font-bold`}>Berikan Izin Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }) => {
    if (loading) return;

    const cleanedData = data.trim().toUpperCase();
    setLoading(true);
    const scannedText = cleanedData;

    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user ? user.id : '';
      const userRole = user ? user.role : 'USER';
      const isAdminOrPengawas = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'PENGAWAS';

      // Fetch vehicle data dan ongoing issues secara paralel
      const [vehicleRes, issueRes] = await Promise.all([
        Promise.race([
          axios.get(`${API_URL}/api/vehicles/scan/${scannedText}?userId=${userId}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Network Timeout')), 5000))
        ]),
        axios.get(`${API_URL}/api/issues/ongoing`).catch(() => ({ data: [] }))
      ]);

      const res = vehicleRes;
      const ongoingIssues = issueRes.data || [];

      if (!(res && res.data && res.data.success && res.data.vehicle)) {
        throw new Error('Barcode tidak valid atau data kendaraan tidak ditemukan');
      }

      const vehicleNoPolisi = res.data.vehicle.noPolisi;
      setScannedNoPolisi(vehicleNoPolisi);

      // === STEP 1: Cek apakah kendaraan sedang dalam perbaikan (ada issue ONGOING / PENDING_APPROVAL) ===
      const activeIssue = ongoingIssues.find(issue => issue.handover && issue.handover.noPolisi === vehicleNoPolisi);
      const isUnderRepair = !!activeIssue;
      const isPendingApproval = activeIssue?.status === 'PENDING_APPROVAL';
      const hasAnyMajorItem = activeIssue?.handover?.items?.some(item => item.name.includes('[MAJOR]'));
      const hasUnrepairedMajor = activeIssue?.handover?.items?.some(item => item.name.includes('[MAJOR]') && !item.isGood && !item.isRepaired);
      const hasUnrepairedMinor = activeIssue?.handover?.items?.some(item => !item.name.includes('[MAJOR]') && !item.isGood && !item.isRepaired);

      // Cek apakah user ini berhak melakukan verifikasi perbaikan (fuzzy match toleran typo/spasi & pengawas/admin)
      const isReporter = String(activeIssue?.handover?.userId) === String(userId);
      const isAmt1 = isNameMatch(activeIssue?.handover?.amt1, user?.name);
      const isAmt2 = isNameMatch(activeIssue?.handover?.amt2, user?.name);
      const canRepair = isUnderRepair ? (isAmt1 || isAmt2 || isReporter || isAdminOrPengawas || userRole === 'SUPER_ADMIN') : false;

      // === STEP 1.5: Handle kendaraan yang sedang menunggu respon/persetujuan dari Admin ===
      if (isUnderRepair && isPendingApproval) {
        if (hasAnyMajorItem) {
          // Kerusakan major telah dilaporkan selesai diperbaiki, sekarang MENUNGGU RESPON ADMIN
          setScanResult('pending_approval');
          setLoading(false);
          return;
        }
      }

      // === STEP 2: Handle kendaraan dengan issue Major yang belum diperbaiki (DIBLOKIR) ===
      if (isUnderRepair && hasUnrepairedMajor) {
        if (!canRepair) {
          setErrorMessage('Kendaraan ini sedang dalam perbaikan (Kerusakan Major). Hanya AMT 1 dan AMT 2 yang bertugas yang dapat mengirim laporan perbaikan.');
          setScanResult('error');
          setLoading(false);
          return;
        }
        // AMT bertugas → tampilkan opsi verifikasi perbaikan
        setScanResult('repair');
        setLoading(false);
        return;
      }

      // === STEP 3: Handle status Maintenance (tanpa issue ONGOING — dead end) ===
      if (res.data.vehicle.status === 'Maintenance' && !isUnderRepair) {
        setScanResult('maintenance');
        setLoading(false);
        return;
      }

      // === STEP 4: Untuk Akhiri Pekerjaan — blokir jika ada issue Minor yang masih ONGOING ===
      // (Mobil Minor masih bisa jalan, jadi Akhiri tetap boleh — TIDAK diblokir)

      // === STEP 5: Cek apakah user sedang aktif di mobil LAIN ===
      if (!isAdminOrPengawas && res.data.activeUserHandover) {
        const activePolisi = res.data.activeUserHandover.noPolisi;
        if (activePolisi !== vehicleNoPolisi) {
          setErrorMessage(`Anda sedang aktif di pekerjaan kendaraan ${activePolisi}. Selesaikan (Akhiri) pekerjaan tersebut terlebih dahulu.`);
          setLoading(false);
          setScanResult('error');
          return;
        }
      }

      // === STEP 6: Validasi urutan Mulai → Akhiri & Penanganan Shift Gantung ===
      let finalResult = 'success';

      if (res.data.lastHandover) {
        const lastType = res.data.lastHandover.type;
        const lastHasIssue = !!res.data.lastHandover.issue;
        const isIssueResolved = res.data.lastHandover.issue?.status === 'RESOLVED';
        const isVehicleReady = res.data.vehicle?.status === 'READY_TO_START';

        // Deteksi shift gantung (> 12 jam sejak mulai tanpa diakhiri)
        const lastTimestamp = new Date(res.data.lastHandover.timestamp || res.data.lastHandover.createdAt).getTime();
        const elapsedHours = (Date.now() - lastTimestamp) / (1000 * 60 * 60);
        const shiftGantungDetected = res.data.isHangingShift || (lastType === 'mulai' && !lastHasIssue && elapsedHours > 12);

        if (!isAdminOrPengawas) {
          if (type === 'mulai' && lastType === 'mulai') {
            // Cek apakah user yang scan adalah AMT dari perjalanan aktif ini
            const isAmt1 = isNameMatch(res.data.lastHandover.amt1, user?.name);
            const isAmt2 = isNameMatch(res.data.lastHandover.amt2, user?.name);
            const isCreator = String(res.data.lastHandover.userId) === String(userId);

            if ((isAmt1 || isAmt2 || isCreator) && !isVehicleReady && !isIssueResolved) {
              setErrorTitle('Pekerjaan Sedang Berjalan');
              setErrorMessage(`Anda (${user?.name || 'AMT'}) tercatat sedang bertugas aktif pada kendaraan ${vehicleNoPolisi}.\n\nJika perjalanan telah selesai, silakan gunakan scan "Akhiri Pekerjaan", bukan Mulai Pekerjaan.`);
              setLoading(false);
              setScanResult('error');
              return;
            }

            // Boleh mulai lagi jika kendaraan READY_TO_START atau issue sebelumnya sudah RESOLVED
            if (!lastHasIssue && !isVehicleReady && !isIssueResolved) {
              if (shiftGantungDetected) {
                setHangingElapsedHours(elapsedHours);
                setLastHandover(res.data.lastHandover);
                setScanResult('shift_gantung');
                setLoading(false);
                return;
              }
              setErrorMessage('Kendaraan ini belum menyelesaikan pekerjaannya (Belum Akhiri Pekerjaan).');
              setLoading(false);
              setScanResult('error');
              return;
            }
          } else if (type === 'akhiri') {
            if (lastType !== 'mulai') {
              setErrorMessage('Kendaraan ini belum memulai pekerjaan (Belum Mulai Pekerjaan).');
              setLoading(false);
              setScanResult('error');
              return;
            }

            // Validasi logic: Ketika scan akhiri, sistem harus mencocokkan AMT yang sama dengan scan mulai
            const isAmt1 = isNameMatch(res.data.lastHandover.amt1, user?.name);
            const isAmt2 = isNameMatch(res.data.lastHandover.amt2, user?.name);
            const isCreator = String(res.data.lastHandover.userId) === String(userId);

            if (!isAmt1 && !isAmt2 && !isCreator) {
              setErrorTitle('AMT Tidak Sesuai');
              setErrorMessage(`Pekerjaan kendaraan ini dimulai oleh kru:\n• AMT 1: ${res.data.lastHandover.amt1 || '-'}\n• AMT 2: ${res.data.lastHandover.amt2 || '-'}\n\nHanya petugas AMT yang memulai perjalanan ini yang dapat mengakhiri pekerjaan.`);
              setLoading(false);
              setScanResult('error');
              return;
            }
          }
        } else {
          // ==============================
          // SCAN MULAI (Admin/Pengawas)
          // ==============================
          if (type === 'mulai') {
            if (lastType === 'mulai' && res.data.vehicle?.status === 'Active') {
              setErrorTitle('Pekerjaan Masih Berjalan');
              setErrorMessage(`Kendaraan ${vehicleNoPolisi} sudah melakukan Mulai Pekerjaan dan form Mulai telah tersimpan.\n\nKendaraan belum melakukan Akhiri Pekerjaan.\n\nSilakan gunakan Scan "Akhiri Pekerjaan".`);
              setLoading(false);
              setScanResult('error');
              return;
            }
            if (res.data.vehicle?.status === 'Maintenance') {
              setErrorTitle('Kendaraan Dalam Perbaikan');
              setErrorMessage(`Kendaraan ${vehicleNoPolisi} sedang dalam proses perbaikan dan belum dapat memulai pekerjaan baru.`);
              setLoading(false);
              setScanResult('error');
              return;
            }
            if (!isVehicleReady) {
              setErrorTitle('Kendaraan Belum Siap');
              setErrorMessage(`Kendaraan ${vehicleNoPolisi} belum berada pada status siap untuk memulai pekerjaan baru.`);
              setLoading(false);
              setScanResult('error');
              return;
            }
          }

          // ==============================
          // SCAN AKHIRI (Admin/Pengawas)
          // ==============================
          if (type === 'akhiri') {
            if (lastType !== 'mulai') {
              setErrorTitle('Belum Ada Pekerjaan Aktif');
              setErrorMessage(`Kendaraan ${vehicleNoPolisi} tidak memiliki pekerjaan yang sedang berjalan.`);
              setLoading(false);
              setScanResult('error');
              return;
            }
            if (res.data.vehicle?.status === 'Maintenance') {
              setErrorTitle('Kendaraan Dalam Perbaikan');
              setErrorMessage(`Kendaraan ${vehicleNoPolisi} masih dalam proses perbaikan dan tidak dapat mengakhiri pekerjaan.`);
              setLoading(false);
              setScanResult('error');
              return;
            }
          }
        }

        // Simpan lastHandover untuk diteruskan ke HandoverFormScreen
        setLastHandover(res.data.lastHandover);

        // Tampilkan recap jika ada data items dari handover terakhir
        if (res.data.lastHandover.items && res.data.lastHandover.items.length > 0) {
          finalResult = 'recap';
        } else {
          finalResult = 'success';
        }
      } else {
        // Belum ada handover sama sekali
        if (type === 'akhiri') {
          setErrorTitle('Belum Mulai Pekerjaan');
          setErrorMessage(`Kendaraan ${vehicleNoPolisi} belum melakukan Mulai Pekerjaan.\n\nScan Akhiri Pekerjaan tidak dapat dilakukan.`);
          setLoading(false);
          setScanResult('error');
          return;
        }
        setLastHandover(null);
        finalResult = 'success';
      }

      // === STEP 7: Handle issue Minor yang belum diperbaiki (masih bisa lanjut kerja) ===
      if (isUnderRepair && hasUnrepairedMinor && canRepair) {
        setNextScanResult(finalResult);
        setScanResult('repair_minor');
      } else {
        setScanResult(finalResult);
      }
      setLoading(false);

    } catch (error) {
      setLoading(false);
      if (error.response?.status === 404) {
        setErrorTitle("Barcode Tidak Ditemukan");
        setErrorMessage(
          error.response?.data?.error ||
          `Barcode "${scannedText}" belum terdaftar di database. Silakan periksa kembali barcode kendaraan atau hubungi Admin.`
        );
        setScanResult('error');
      } else if (error.message === 'Network Timeout' || error.code === 'ECONNABORTED' || !error.response) {
        setErrorTitle("Gangguan Jaringan");
        setErrorMessage("Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.");
        setScanResult('error');
      } else {
        console.warn('Scan error:', error.message);
        setErrorTitle("Scan Gagal");
        setErrorMessage(error.response?.data?.error || "Terjadi kesalahan saat memproses scan barcode.");
        setScanResult('error');
      }
    }
  };

  const proceedToForm = () => {
    setScanResult(null);
    navigation.navigate('HandoverForm', { noPolisi: scannedNoPolisi, type, lastHandover });
  };

  const renderRecapModal = () => {
    if (!lastHandover) return null;

    // Hitung status checklist
    const itemsA = lastHandover.items ? lastHandover.items.filter(i => i.category === 'A') : [];
    const itemsB = lastHandover.items ? lastHandover.items.filter(i => i.category === 'B') : [];
    const odoItem = lastHandover.items ? lastHandover.items.find(i => i.category === 'C') : null;

    const countAGood = itemsA.filter(i => i.isGood || i.isRepaired).length;
    const countBGood = itemsB.filter(i => i.isGood || i.isRepaired).length;
    const odoMeter = odoItem ? odoItem.name.replace('Odo Meter: ', '') : '-';

    // Cek issue/kerusakan pada checklist kendaraan (Kategori A)
    const badItemsA = itemsA.filter(i => !i.isGood && !i.isRepaired);
    const hasMajor = badItemsA.some(i => 
      (i.severity && i.severity.toLowerCase() === 'major') || 
      (i.name && i.name.toUpperCase().includes('[MAJOR]'))
    );
    const hasMinor = badItemsA.length > 0 && !hasMajor;
    const hasAmtIssue = countBGood < itemsB.length;

    // Status logic:
    // 1. Jika ada Major -> status 'Isu' (merah), checklist kendaraan merah
    // 2. Jika ada Minor -> status 'Perlu Perhatian' (orange), checklist kendaraan orange
    // 3. Jika normal semua -> status 'Normal' (hijau), checklist kendaraan hijau
    let statusText = 'Normal';
    let statusBg = 'bg-[#E5F5EB]';
    let statusDot = 'bg-[#10B981]';
    let statusColor = 'text-[#10B981]';
    let vehicleChecklistColor = '#10B981';

    if (hasMajor) {
      statusText = 'Isu';
      statusBg = 'bg-[#FEE2E2]';
      statusDot = 'bg-[#EF4444]';
      statusColor = 'text-[#EF4444]';
      vehicleChecklistColor = '#EF4444';
    } else if (hasMinor) {
      statusText = 'Perlu Perhatian';
      statusBg = 'bg-[#FFEDD5]';
      statusDot = 'bg-[#F97316]';
      statusColor = 'text-[#F97316]';
      vehicleChecklistColor = '#F97316';
    } else if (hasAmtIssue) {
      // Kendaraan normal tapi perlengkapan AMT kurang lengkap
      statusText = 'Perlu Perhatian';
      statusBg = 'bg-[#FFEDD5]';
      statusDot = 'bg-[#F97316]';
      statusColor = 'text-[#F97316]';
      vehicleChecklistColor = '#10B981';
    } else {
      statusText = 'Normal';
      statusBg = 'bg-[#E5F5EB]';
      statusDot = 'bg-[#10B981]';
      statusColor = 'text-[#10B981]';
      vehicleChecklistColor = '#10B981';
    }

    const amtColor = hasAmtIssue ? '#F97316' : '#10B981';

    return (
      <View style={tw`absolute inset-0 bg-black/60 justify-center items-center px-5 z-50`}>
        {/* Slightly smaller modal container w-[90%] max-w-[340px] */}
        <View style={tw`bg-white w-[90%] max-w-[330px] rounded-[32px] pt-5 pb-5 px-5 relative overflow-visible shadow-2xl`}>

          {/* Close Button inside modal */}
          <TouchableOpacity
            style={tw`absolute top-4 right-4 z-50 p-2 bg-gray-100/80 rounded-full`}
            onPress={() => { setScanResult(null); navigateToDashboard(); }}
          >
            <Ionicons name="close" size={20} color="#4B5563" />
          </TouchableOpacity>

          {/* Header Recap */}
          <View style={tw`items-center mb-5`}>
            {/* Checkmark with perfectly sized glow */}
            <View style={tw`relative items-center justify-center mb-4 mt-2`}>
              <View style={[tw`absolute rounded-full bg-green-400`, { width: 70, height: 70, opacity: 0.15, transform: [{ scale: 1.2 }], shadowColor: '#4ade80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15, elevation: 10 }]} />
              <View style={tw`w-16 h-16 rounded-full border-[4px] border-[#22c55e] items-center justify-center bg-white z-10`}>
                <Ionicons name="checkmark-sharp" size={40} color="#22c55e" />
              </View>
            </View>

            {/* Pill */}
            <View style={tw`bg-[#575F6A] px-3.5 py-1 rounded-full mb-5 shadow-sm`}>
              <Text style={tw`text-white font-bold text-[10px] tracking-[2px]`}>RINGKASAN INSPEKSI</Text>
            </View>

            {/* Title & Subtitle */}
            <Text style={tw`text-[20px] font-black text-[#1F2937] text-center mb-2.5 leading-[26px] tracking-tight`}>Data Inspeksi Terakhir{"\n"}Berhasil Ditemukan!</Text>
            <Text style={tw`text-[#4B5563] text-center text-[12px] px-1 leading-4`}>Seluruh alur pemeriksaan telah tervalidasi dalam{"\n"}sistem digital iAMT Pertamina.</Text>
          </View>

          {/* Table Data */}
          <View style={[tw`w-full bg-[#FAF9F6] rounded-[24px] p-4 mb-5 overflow-hidden relative`, { borderTopWidth: 4, borderTopColor: '#ED1C24' }]}>
            {/* Aksen Coretan Pertamina (Top Left) */}
            <View style={tw`absolute top-[-2px] left-[-2px] opacity-10`}>
              <View style={[tw`absolute border-b-[3px] border-r-[3px] border-[#ED1C24] rounded-br-[40px]`, { top: 0, left: 0, width: 75, height: 75 }]} />
              <View style={[tw`absolute border-b-[3px] border-r-[3px] border-[#00A651] rounded-br-[30px]`, { top: 0, left: 0, width: 60, height: 60 }]} />
              <View style={[tw`absolute border-b-[3px] border-r-[3px] border-[#0055A5] rounded-br-[20px]`, { top: 0, left: 0, width: 45, height: 45 }]} />
            </View>

            {/* Aksen Coretan Pertamina (Bottom Right) */}
            <View style={tw`absolute bottom-[-2px] right-[-2px] opacity-10`}>
              <View style={[tw`absolute border-t-[3px] border-l-[3px] border-[#ED1C24] rounded-tl-[40px]`, { bottom: 0, right: 0, width: 75, height: 75 }]} />
              <View style={[tw`absolute border-t-[3px] border-l-[3px] border-[#00A651] rounded-tl-[30px]`, { bottom: 0, right: 0, width: 60, height: 60 }]} />
              <View style={[tw`absolute border-t-[3px] border-l-[3px] border-[#0055A5] rounded-tl-[20px]`, { bottom: 0, right: 0, width: 45, height: 45 }]} />
            </View>

            {/* Row: No Polisi */}
            <View style={tw`flex-row justify-between py-2.5 border-b border-gray-200/70 z-10 items-center`}>
              <Text style={tw`text-[#4B5563] text-[14px]`}>No Polisi</Text>
              <Text style={tw`font-black text-[#111827] text-[16px]`}>{lastHandover.noPolisi}</Text>
            </View>

            {/* Row: Shift */}
            <View style={tw`flex-row justify-between py-2.5 border-b border-gray-200/70 z-10 items-center`}>
              <Text style={tw`text-[#4B5563] text-[14px]`}>Shift</Text>
              <Text style={tw`font-black text-[#111827] text-[16px]`}>{lastHandover.shift}</Text>
            </View>

            {/* Row: Status */}
            <View style={tw`flex-row justify-between py-2.5 border-b border-gray-200/70 z-10 items-center`}>
              <Text style={tw`text-[#4B5563] text-[14px]`}>Status</Text>
              <View style={tw`${statusBg} px-2.5 py-1 rounded-md flex-row items-center`}>
                <View style={tw`w-2 h-2 ${statusDot} rounded-full mr-2`} />
                <Text style={tw`${statusColor} font-bold text-[12px]`}>{statusText}</Text>
              </View>
            </View>

            {/* Row: Checklist */}
            <View style={tw`flex-row justify-between py-2.5 border-b border-gray-200/70 z-10 items-center`}>
              <Text style={tw`text-[#4B5563] text-[14px]`}>Checklist Kendaraan</Text>
              <View style={[tw`border-b-[3px] pb-0.5`, { borderColor: vehicleChecklistColor }]}>
                <Text style={[tw`font-bold text-[15px]`, { color: vehicleChecklistColor }]}>{countAGood}/{itemsA.length} Baik</Text>
              </View>
            </View>

            {/* Row: Perlengkapan */}
            <View style={tw`flex-row justify-between py-2.5 border-b border-gray-200/70 z-10 items-center`}>
              <Text style={tw`text-[#4B5563] text-[14px]`}>Perlengkapan AMT</Text>
              <View style={[tw`border-b-[3px] pb-0.5`, { borderColor: amtColor }]}>
                <Text style={[tw`font-bold text-[15px]`, { color: amtColor }]}>{countBGood}/{itemsB.length} Lengkap</Text>
              </View>
            </View>

            {/* Row: ODO Meter */}
            <View style={tw`flex-row justify-between pt-2.5 z-10 items-center`}>
              <Text style={tw`text-[#4B5563] text-[14px]`}>ODO Meter</Text>
              <Text style={tw`font-black text-[#111827] text-[16px]`}>{odoMeter} km</Text>
            </View>
          </View>

          {/* Button Lanjut */}
          <TouchableOpacity onPress={proceedToForm} style={tw`w-full`}>
            <View style={[tw`w-full bg-[#003366] p-4 rounded-xl flex-row items-center justify-between`, { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 12 }]}>
              <View style={tw`flex-1 flex-row justify-center items-center pl-3`}>
                <Text style={tw`text-white font-bold text-[13px] mr-2`}>Lanjut ke Pengisian Perjalanan</Text>
                <Text style={tw`text-white font-bold text-[14px]`}>➔</Text>
              </View>
              <Image source={require('../../assets/clean_emblem.png')} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuccessModal = () => (
    <AppModal
      visible
      type="success"
      title={'Kendaraan\nTeridentifikasi'}
      message={`${type === 'mulai' ? 'Tidak ada data inspeksi sebelumnya.' : 'Akses diterima untuk Akhiri Pekerjaan.'} Lanjutkan untuk mengisi form.`}
      primaryText="Lanjut ke Pengisian Perjalanan"
      onPrimary={proceedToForm}
      onClose={() => setScanResult(null)}
    />
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-black ${isLargeScreen ? 'flex-row' : 'flex-col'}`}>
      {isLargeScreen && user && (
        <WebSidebar
          user={user}
          activeMenu={'Home'}
          navigation={navigation}
          handleLogout={handleLogout}
        />
      )}
      <View style={[tw`flex-1 bg-black relative`, Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}]}>
        {isFocused && !scanResult && (
          <CameraView
            style={tw`absolute inset-0`}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={loading ? undefined : handleBarcodeScanned}
          />
        )}

        {/* Overlay UI diletakkan di luar CameraView */}
        <View style={tw`absolute inset-0 justify-center items-center`} pointerEvents="none">
          <View style={tw`w-72 h-72 border-4 ${scanResult ? 'border-green-500' : 'border-[#0055A5]'} rounded-3xl bg-transparent flex items-center justify-center relative overflow-hidden`}>
            {scanResult === null && !loading && (
              <View style={tw`w-full h-1 bg-[#0055A5]/50 absolute top-1/2`} />
            )}
            {loading && <ActivityIndicator size="large" color="#0055A5" />}
          </View>
          <Text style={tw`text-white bg-black/60 px-4 py-2 mt-6 rounded-full font-bold`}>
            Arahkan kamera ke QR Kendaraan ({type?.toUpperCase() || 'MULAI'})
          </Text>
        </View>

        <TouchableOpacity
          style={tw`absolute top-12 left-6 bg-black/50 p-3 rounded-full flex-row items-center`}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {scanResult === 'recap' && renderRecapModal()}
        {scanResult === 'success' && renderSuccessModal()}

        {/* Popup hasil scan: semua memakai AppModal (design system DIGI Handover) */}
        <AppModal
          visible={scanResult === 'not_started'}
          type="info"
          tone="warning"
          icon="car-outline"
          badge="Pekerjaan Belum Dimulai"
          title={'Mobil Belum\nMulai Beroperasi'}
          message="Kendaraan ini belum tercatat memulai pekerjaan (scan Mulai Pekerjaan belum dilakukan oleh AMT). Tidak dapat mengakhiri pekerjaan yang belum dimulai."
          showClose
          onClose={() => setScanResult(null)}
          primaryText="Kembali ke Beranda"
          onPrimary={() => { setScanResult(null); navigateToDashboard(); }}
        >
          <AppModalDetail
            tone="warning"
            rows={[
              { label: 'No. Polisi', value: scannedNoPolisi || '-' },
              { label: 'Status Operasional', value: 'Belum Mulai', accent: true },
              ...(lastHandover
                ? [
                    { label: 'Handover Terakhir', value: lastHandover.type === 'akhiri' ? 'Sudah Diakhiri' : (lastHandover.type || '-') },
                    ...(lastHandover.shift ? [{ label: 'Shift Terakhir', value: lastHandover.shift }] : []),
                    ...((lastHandover.amt1 || lastHandover.amt2) ? [{ label: 'Kru Terakhir', value: lastHandover.amt1 || '-' }] : []),
                    ...(lastHandover.createdAt
                      ? [{ label: 'Waktu Terakhir', value: new Date(lastHandover.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }]
                      : []),
                  ]
                : [{ label: 'Riwayat', value: 'Belum ada handover' }]),
            ]}
          />
        </AppModal>

        <AppModal
          visible={scanResult === 'pending_approval'}
          type="warning"
          icon="hourglass"
          badge="Menunggu Persetujuan"
          title={'Menunggu Respon\nAdmin'}
          message="Laporan perbaikan untuk truk ini telah dikirimkan dan saat ini sedang menunggu respon serta persetujuan dari Admin / Pengawas."
          showClose
          onClose={() => setScanResult(null)}
          primaryText="Kembali ke Beranda"
          onPrimary={() => { setScanResult(null); navigateToDashboard(); }}
        >
          <AppModalDetail
            tone="warning"
            rows={[
              { label: 'Truk', value: scannedNoPolisi || '-' },
              { label: 'Status', value: 'Menunggu Evaluasi Admin', accent: true },
            ]}
          />
        </AppModal>

        <AppModal
          visible={scanResult === 'repair'}
          type="maintenance"
          tone="error"
          title={'Truk Dalam\nPerbaikan'}
          message="Truk ini sedang dalam perbaikan (Kerusakan Major). Tidak dapat melanjutkan perjalanan."
          showClose
          onClose={() => setScanResult(null)}
          buttonsDirection="column"
          primaryText="Verifikasi Sudah Diperbaiki"
          onPrimary={() => { setScanResult(null); navigation.navigate('FixVerification', { noPolisi: scannedNoPolisi }); }}
          secondaryText="Kembali ke Beranda"
          onSecondary={() => { setScanResult(null); navigateToDashboard(); }}
        />

        <AppModal
          visible={scanResult === 'repair_minor'}
          type="warning"
          badge="Kerusakan Minor"
          title="Kerusakan Minor"
          message="Truk ini memiliki catatan kerusakan minor, namun masih bisa digunakan."
          showClose
          onClose={() => setScanResult(null)}
          primaryText="Verifikasi Sudah Diperbaiki"
          onPrimary={() => { setScanResult(null); navigation.navigate('FixVerification', { noPolisi: scannedNoPolisi }); }}
          secondaryText="Lanjut Pekerjaan"
          onSecondary={() => { setScanResult(nextScanResult); }}
          tertiaryText="Kembali ke Beranda"
          onTertiary={() => { setScanResult(null); navigateToDashboard(); }}
        />

        <AppModal
          visible={scanResult === 'maintenance'}
          type="error"
          icon="lock-closed"
          title={'Kendaraan\nDiblokir'}
          message="Truk ini sedang dalam status MAINTENANCE total. Tidak dapat digunakan untuk operasional."
          showClose
          onClose={() => setScanResult(null)}
          primaryText="Kembali ke Beranda"
          onPrimary={() => { setScanResult(null); navigateToDashboard(); }}
        />

        <AppModal
          visible={scanResult === 'shift_gantung'}
          type="warning"
          icon="time"
          badge="Shift Gantung Terdeteksi"
          title="Shift Belum Diakhiri"
          message={`Sesi pekerjaan sebelumnya dimulai lebih dari ${Math.floor(hangingElapsedHours)} jam yang lalu dan belum diakhiri oleh supir sebelumnya.`}
          showClose
          onClose={() => setScanResult(null)}
          buttonsDirection="column"
          primaryText="Tutup Shift Paksa & Mulai Baru"
          onPrimary={handleForceReleaseAndStart}
          primaryLoading={loading}
          secondaryText="Batal / Kembali ke Beranda"
          onSecondary={() => { setScanResult(null); navigateToDashboard(); }}
        >
          <AppModalDetail
            tone="warning"
            rows={[
              { label: 'Truk', value: scannedNoPolisi || '-' },
              { label: 'AMT Terakhir', value: lastHandover?.amt1 || '-' },
              { label: 'Durasi Gantung', value: `± ${Math.floor(hangingElapsedHours)} Jam Lalu`, color: '#ED1C24' },
            ]}
          />
        </AppModal>

        <AppModal
          visible={scanResult === 'error'}
          type={/barcode|jaringan|gagal/i.test(errorTitle || '') ? 'error' : 'warning'}
          tone={/barcode|jaringan|gagal/i.test(errorTitle || '') ? 'error' : 'warning'}
          badge="Peringatan Sistem"
          title={errorTitle || 'Scan Gagal'}
          message={errorMessage || 'Kode Barcode tidak valid atau data kendaraan tidak ditemukan.'}
          showClose
          onClose={() => setScanResult(null)}
          buttonsDirection="column"
          primaryText="Scan Ulang Barcode"
          onPrimary={() => setScanResult(null)}
          secondaryText="Kembali ke Beranda"
          onSecondary={() => { setScanResult(null); navigateToDashboard(); }}
        />
      </View>
    </SafeAreaView>
  );
}
