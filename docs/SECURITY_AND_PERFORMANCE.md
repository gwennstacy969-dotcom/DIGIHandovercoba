# 🔒 Keamanan & Optimasi Kinerja (Performance & Security)

Dokumen ini menguraikan standar keamanan teknis dan teknik optimasi performa yang diterapkan dalam ekosistem **HandoverApp**.

---

## 1. Arsitektur Keamanan (Security Measures)

### A. Proteksi Lapisan HTTP & Header
* **Helmet.js**: Mengamankan HTTP response headers untuk memblokir serangan umum seperti Clickjacking, MIME type sniffing, dan Cross-Site Scripting (XSS).
* **CORS Whitelisting**: Membatasi domain asal yang diizinkan mengakses API, mencegah permintaan ilegal antar-situs.
* **Rate Limiting**: `express-rate-limit` membatasi frekuensi request ke endpoint login guna mencegah serangan *Credential Stuffing* dan *Brute Force*.

### B. Autentikasi & Otorisasi
* **JWT (JSON Web Token)**: Autentikasi nir-keadaan (*stateless*) dengan masa kedaluwarsa ketat.
* **Password Hashing**: Semua kata sandi pengguna dienkripsi menggunakan fungsi *one-way cryptographic hash* `bcrypt` dengan faktor *work cost* salt 10 rounds.
* **Role-Based Access Control (RBAC)**: Validasi middleware pada setiap rute API untuk membatasi aksi sensitif hanya kepada peran yang berhak (`SUPER_ADMIN`, `PENGAWAS`, atau `AMT`).

### C. Proteksi Data & Query
* **Prisma Parameterized Queries**: Tidak ada raw string concatenation dalam query SQL. Seluruh query dilewatkan melalui Prisma query engine yang secara native terlindung dari *SQL Injection*.
* **Skema Validasi Input**: Menggunakan validator ketat berbasis `Joi` dan `express-validator` untuk memastikan payload request bersih dari data berbahaya.

### D. Audit Kerentanan Dependensi
* GitHub Actions secara berkala menjalankan `npm audit` untuk mendeteksi kerentanan CVE pada library pihak ketiga.

---

## 2. Optimasi Kinerja (Performance Optimizations)

### A. Kompresi & Optimasi Media (Foto Kerusakan & Perbaikan)
* **Sharp Engine**: Sebelum disimpan atau disajikan, gambar foto bukti kerusakan diproses menggunakan `sharp` untuk:
  * Mengompres ukuran file hingga **70-85%** lebih kecil tanpa mengorbankan keterbacaan bukti fisik.
  * Menghindari pembengkakan kapasitas penyimpanan server (*disk storage*).

### B. In-Memory Caching (Redis)
* **Status Armada & Token**: Digunakan untuk menyimpan sementara data status armada dan token blacklist agar query berulang tidak membebani database relational MySQL.
* **Graceful Degradation**: Jika Redis offline, sistem otomatis beralih langsung ke MySQL tanpa menghentikan layanan aplikasi.

### C. Logging Berkelanjutan (Winston Daily Rotate)
* Log rotasi harian dengan pembatasan ukuran berkas maksimum (14 hari retensi) mencegah file log menghabiskan ruang disk server.

### D. Optimasi Rendering FlatList pada Web Desktop
* **Viewport Height Lock**: Mengunci ketinggian container flexbox dengan `height: 100vh` dan `min-height: 0` agar scroll wheel browser terisolasi pada area daftar.
* **Batching Tuning**: Parameter `initialNumToRender`, `maxToRenderPerBatch`, dan `windowSize` disesuaikan khusus untuk platform web sehingga 334 data pekerja dapat di-scroll secara instan dan mulus tanpa jeda rendering.
