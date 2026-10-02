# 🚛 Pertamina HandoverApp

<p align="center">
  <img src="frontend/assets/logo.png" alt="Pertamina HandoverApp Logo" width="160" />
</p>

<p align="center">
  <strong>Sistem Digitalisasi Handover & Inspeksi Armada Truk Tangki BBM</strong><br />
  <em>Integrated Safety & Operational Fleet Management System — PT Pertamina Patra Niaga</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-0055A5?style=flat-square&logo=react" alt="Platform" />
  <img src="https://img.shields.io/badge/Frontend-React%20Native%20(Expo)-00A651?style=flat-square&logo=expo" alt="Frontend" />
  <img src="https://img.shields.io/badge/Backend-Node.js%20%26%20Express-339933?style=flat-square&logo=node.js" alt="Backend" />
  <img src="https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Database-MySQL-00758F?style=flat-square&logo=mysql" alt="Database" />
  <img src="https://img.shields.io/badge/Styling-Tailwind%20CSS%20(twrnc)-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Status-Active%20Production-ED1C24?style=flat-square" alt="Status" />
</p>

---

## 📌 Tentang Aplikasi

**HandoverApp** adalah platform enterprise terintegrasi yang dirancang khusus untuk mendigitalisasi proses serah terima (*handover*) dan pemeriksaan fisik armada Mobil Tangki (MT) di lingkungan Fuel Terminal **PT Pertamina Patra Niaga**.

Aplikasi ini menggantikan formulir kertas (*paper-based inspection*) konvensional dengan sistem digital *real-time* berbasis QR Code scanner, checklist interaktif kepatuhan HSSE (*Health, Safety, Security, and Environment*), verifikasi foto bukti kerusakan/perbaikan, serta pelaporan otomatis format Excel dan PDF.

---

## 👥 Hak Akses & Peran Pengguna (Role Matrix)

Sistem membedakan tampilan antarmuka dan hak otoritas akses secara otomatis sesuai peran yang login:

| Role | Jabatan Operasional Pertamina | Tanggung Jawab Utama | Fitur Utama |
| :--- | :--- | :--- | :--- |
| **AMT** | **Awak Mobil Tangki** *(AMT I & AMT II)* | Pengemudi & kru armada truk tangki di lapangan | Scan QR nopol truk, checklist inspeksi pergantian shift, foto bukti kerusakan, unggah foto bukti perbaikan |
| **Pengawas** | **Pengawas Lapangan / Fleet Dispatcher** | Pemantauan kelayakan armada & operasional harian | Dashboard monitoring status armada, verifikasi bukti perbaikan (Approve/Reject), Message Center, ekspor laporan resmi |
| **Admin** | **Supervisor Distribusi / Fleet & System Administrator** | Pengelolaan master data, armada, pengguna, & kontrol penuh sistem | Akses 100% penuh: kelola 334 AMT, 83 unit mobil tangki, akun Pengawas, sesama akun Admin, kustomisasi checklist HSSE, audit log, dan ekspor laporan |

---

## ✨ Fitur-Fitur Utama

### 1. 🔍 Pemindaian QR Barcode Presisi
* Setiap mobil tangki dilengkapi kode QR unik berbasis plat nomor.
* AMT memindai QR code sebelum pemeriksaan untuk mencegah salah lapor unit dan memastikan keberadaan fisik di dekat kendaraan.

### 2. 📋 Checklist Inspeksi Keselamatan Terperinci
* Pengecekan terstruktur sesuai kategori:
  * **Kategori A (Kritis / Safety Utama)**: Sistem Rem, Kemudi, Ban & Baut Roda, Sistem Kelistrikan & Lampu, Mesin, APAR, Kebocoran BBM.
  * **Kategori B (Kelengkapan Pendukung)**: Spion, Wiper, Klakson, Perlengkapan Darurat, Kotak P3K, Kebersihan Kabin.
* **Wajib Foto Bukti**: Jika ada item yang dilaporkan *Rusak / Tidak Baik*, aplikasi otomatis mewajibkan pengambilan foto bukti kerusakan dari kamera.

### 3. 🔄 Siklus Perbaikan & Verifikasi Bertingkat (*Issue Resolution*)
* Kendaraan dengan kendala langsung masuk ke tab **Daftar Isu**.
* AMT yang menindaklanjuti perbaikan mengambil foto bukti setelah penanganan.
* **Evaluasi Pengawas**: Pengawas memeriksa foto dan deskripsi perbaikan per item:
  * ✅ **Disetujui (Approve)**: Status isu selesai, unit dinyatakan aman dan siap operasi.
  * ❌ **Ditolak (Reject)**: Pengawas menyertakan catatan alasan penolakan, dan AMT wajib memperbaiki ulang hingga memenuhi standar.

### 4. 📊 Dashboard Monitoring Real-Time & Analitik
* Ringkasan armada:
  * 🟢 **Siap Operasi (Normal)**
  * 🟡 **Dalam Perbaikan / Menunggu Verifikasi**
  * 🔴 **Kritis / Bermasalah**
* Indikator status terintegrasi dan live notifikasi.

### 5. 📑 Ekspor Laporan Resmi (Excel & PDF)
* Format laporan ekspor disesuaikan dengan template resmi operasional Pertamina Patra Niaga:
  * **Ekspor Excel (.xlsx)**: Rekapitulasi shift, nopol, kru AMT, status kondisi, dan rincian kerusakan.
  * **Ekspor PDF (.pdf)**: Dokumen berita acara serah terima siap cetak dengan layout formal.
* Filter laporan dinamis berdasarkan rentang tanggal, shift, bulan, tahun, dan status kondisi armada.

### 6. 💬 Pusat Pesan Operasional (Message Center)
* Pengawas dapat mengirimkan instruksi cepat, pengumuman keselamatan (*Safety Talk*), atau peringatan armada langsung ke dashboard AMT.

### 7. 👥 Manajemen Pengguna Terpadu (Pekerja, Pengawas, & Admin)
* **Daftar Pekerja (`/api/workers`)**: Kelola akun 334 Awak Mobil Tangki (AMT I & II), edit data, dan reset password.
* **Daftar Pengawas (`/api/pengawas`)**: Kelola supervisor lapangan penanggung jawab verifikasi kendala armada.
* **Daftar Admin (`/api/admins`)**: Kelola administrator sistem dengan proteksi *Anti-Self-Delete* dan *Last Active Admin Guard*.
* **Sinkronisasi Desain Responsif**:
  * **Web**: Tombol tambah diletakkan seragam di Header Card atas.
  * **Mobile**: Menggunakan *Floating Action Button* bulat biru (`+`) di pojok kanan bawah.

### 8. 💻 Desain Responsif & Premium (Web & Mobile)
* **Mobile (Android/iOS)**: Desain ergonomis dengan tombol navigasi melayang (*floating bottom bar*), scanner kamera cepat, dan performa ringan.
* **Desktop / Web Browser**: Antarmuka modern bergaya *Glassmorphism* dengan sidebar terstruktur, tata letak grid kartu responsif, dan scrolling penuh (*infinite scroll*) yang dioptimalkan untuk ratusan data pekerja & armada.

---

## 🚀 Pembaruan Sistem Terkini (System Hardening & Enhancements)

Proyek ini telah melalui audit dan penguatan arsitektur menyeluruh:
1. **Keamanan Sandi Penuh (`bcrypt`)**: Seluruh akun pekerja, pengawas, dan admin dienkripsi menggunakan hashing `bcrypt` standar industri (10 salt rounds).
2. **Koneksi Database Andal (Singleton Prisma)**: Menggunakan instance tunggal `prisma.js` untuk mencegah kebocoran pool koneksi MySQL (*connection pool exhaustion*).
3. **Penyelarasan Peran Tunggal (`ADMIN`)**: Seluruh modul dibuka 100% penuh bagi Administrator tanpa hambatan izin kasta.
4. **Performa Cache Non-Blocking**: Migrasi Redis key lookup ke `scanStream` menjaga stabilitas throughput saat traffic puncak.
5. **Ketahanan Ekspor Mobile**: Migrasi resmi ke `expo-file-system/legacy` dengan fallback otomatis ke browser perangkat jika sistem file ponsel mengalami kendala.
6. **JWT Token Rotation**: Masa berlaku Access Token diperpendek ke 1 jam (`1h`) dengan Refresh Token aman 7 hari (`7d`).

---

## 🛠️ Tech Stack

### Frontend (Mobile & Web)
* **Framework**: [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/) (SDK 57)
* **Web Engine**: React Native Web (dukungan penuh browser desktop Chrome, Edge, Safari, Firefox)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) via [`twrnc`](https://github.com/drake-smith/twrnc)
* **Icons**: `@expo/vector-icons` (Ionicons, Feather)
* **Camera & Media**: `expo-camera`, `expo-image-picker`

### Backend (API Services)
* **Runtime**: [Node.js](https://nodejs.org/) (v18+)
* **Framework**: [Express.js](https://expressjs.com/)
* **ORM**: [Prisma ORM](https://www.prisma.io/)
* **Database**: [MySQL](https://www.mysql.com/) / MariaDB
* **Logging**: Winston logger dengan audit rotasi harian
* **Authentication**: JWT (JSON Web Token) & bcrypt password hashing
* **Export Engines**: `exceljs` (Excel generator) & `pdfkit` (PDF report builder)

---

## 📂 Struktur Repositori

```plaintext
HandoverApp/
├── backend/                  # Server Node.js & Express API
│   ├── barcodes/             # Asset QR barcode armada mobil tangki (83 unit)
│   ├── prisma/
│   │   └── schema.prisma     # Skema database relasional Prisma
│   ├── src/
│   │   ├── config/           # Konfigurasi logger, storage, database
│   │   ├── controllers/      # Logika analitik, laporan, autentikasi
│   │   ├── middleware/       # Auth JWT, image optimizer, validator
│   │   ├── routes/           # Routing API endpoint
│   │   └── services/         # Layanan ekspor Excel/PDF, email service
│   ├── index.js              # Entrypoint server Express
│   └── package.json
│
├── frontend/                 # Client React Native (Expo)
│   ├── assets/               # Logo, ikon, background, suara notifikasi
│   ├── components/           # Komponen UI (WebSidebar, TextLogo, Modals)
│   ├── screens/
│   │   ├── admin/            # Layar Supervisor / Super Admin (Dashboard, WorkerList, VehicleList, Checklist)
│   │   ├── pengawas/         # Layar Pengawas Lapangan (Dashboard, IssueList, IssueDetail, MessageCenter)
│   │   ├── shared/           # Layar Bersama (Login, History, HandoverDetail)
│   │   └── user/             # Layar AMT (Dashboard, Scanner, HandoverForm, FixVerification)
│   ├── App.js                # Navigasi & state aplikasi
│   ├── config.js             # Auto-detection IP & server endpoint
│   └── package.json
│
├── HandoverApp_Improvements/ # Dokumentasi arsitektur & panduan sistem
├── docker-compose.yml        # Konfigurasi containerization
├── .gitignore                # Aturan ignore git bersih
└── README.md                 # Dokumentasi utama repositori
```

---

## 🚀 Panduan Memulai (Quick Start)

### 1. Prasyarat Sistem
* [Node.js](https://nodejs.org/) (versi 18.x atau lebih baru)
* [MySQL](https://www.mysql.com/) (XAMPP / MySQL Workbench / Docker MySQL)
* [Git](https://git-scm.com/)

---

### 2. Setup Backend

1. Buka terminal dan masuk ke folder `backend`:
   ```bash
   cd backend
   ```

2. Pasang dependensi:
   ```bash
   npm install
   ```

3. Buat file `.env` berdasarkan template:
   ```bash
   cp .env.example .env
   ```
   Sesuaikan konfigurasi database Anda di file `.env`:
   ```env
   DATABASE_URL="mysql://root:password@localhost:3306/handover_pertamina"
   PORT=3000
   ```

4. Sinkronisasikan skema Prisma ke database MySQL:
   ```bash
   npx prisma db push
   ```

5. Jalankan server backend:
   ```bash
   npm run dev
   ```
   Server backend akan aktif di `http://localhost:3000`.

---

### 3. Setup Frontend

1. Buka terminal baru dan masuk ke folder `frontend`:
   ```bash
   cd frontend
   ```

2. Pasang dependensi:
   ```bash
   npm install
   ```

3. Jalankan aplikasi frontend:
   * **Untuk Tampilan Web (Browser)**:
     ```bash
     npx expo start --web
     ```
     Buka browser di `http://localhost:8081`.
   * **Untuk Tampilan Mobile (Android / Expo Go)**:
     ```bash
     npx expo start
     ```
     Pindai QR code menggunakan aplikasi **Expo Go** di ponsel Anda (pastikan ponsel dan komputer berada di jaringan Wi-Fi yang sama).

---

---

### 4. Menjalankan via Docker Compose (Full Stack)

Jika ingin menjalankan seluruh infrastruktur (MySQL, Redis, dan Backend) dalam container:
```bash
docker compose up -d
```
Container akan otomatis menginisialisasi database MySQL di port `3306`, Redis di port `6379`, dan Backend di port `3000`.

---

## 🧪 Menjalankan Pengujian (Testing)

Proyek ini telah dilengkapi dengan pengujian otomatis:

```bash
# Menjalankan pengujian unit backend (Jest)
cd backend
npm test

# Menjalankan pengujian frontend
cd frontend
npm test
```

Pipeline otomatis pengujian dijalankan pada setiap push ke branch `main` melalui **GitHub Actions** (`.github/workflows/ci.yml`).

---

## 📚 Dokumentasi Teknis Lengkap

Dokumentasi arsitektur dan spesifikasi API mendalam tersedia di folder `docs/`:

* 🏛️ **[Arsitektur & Diagram Sistem](docs/ARCHITECTURE.md)**: Diagram komponen arsitektur, sequence diagram serah terima & perbaikan, serta matriks RBAC.
* 📖 **[Spesifikasi API (OpenAPI / Swagger)](docs/openapi.yaml)**: Definisi lengkap seluruh REST endpoint, skema payload, dan respon.
* 🛠️ **[Panduan Pengembang (Developer Guide)](docs/DEVELOPER_GUIDE.md)**: Tata cara penyiapan, alur migrasi database Prisma, dan konvensi commit.
* 🔒 **[Keamanan & Kinerja (Security & Performance)](docs/SECURITY_AND_PERFORMANCE.md)**: Implementasi proteksi HTTP, enkripsi data, Sharp image compression, dan Redis caching.

---

## 🔑 Akun Uji Coba Default

| Role | Username | Password Default | Keterangan |
| :--- | :--- | :--- | :--- |
| **Admin** | `yoan` | `672023` | Administrator Akses penuh seluruh sistem, armada, & master data |
| **Admin** | `haulafatiha` | `240206` | Administrator Akses penuh seluruh sistem, armada, & master data |
| **Pengawas** | `pengawas` | `pengawas123` | Akses evaluasi perbaikan, laporan, pesan |
| **Pengawas** | `sekar` | `12345` | Pengawas operasional lapangan |
| **AMT** | Sesuai NIP Pekerja *(contoh: `617.05.0001`)* | `617.05.0001` | Terdaftar 334 AMT aktif di database |

---

## 📄 Lisensi

Proyek ini dikembangkan untuk kebutuhan operasional inspeksi armada Fuel Terminal Pertamina Patra Niaga. Hak Cipta dilindungi.
