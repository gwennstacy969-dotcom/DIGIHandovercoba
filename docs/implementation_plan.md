# PERANCANGAN PERKEMBANGAN SISTEM HANDOVER APP

**DOKUMEN**: Rencana Pengembangan & Improvement System  
**TANGGAL**: 24 September 2026  
**STATUS**: Ready for Implementation  
**TARGET**: Production Ready dalam 14 minggu  

---

## 📑 RINGKASAN EKSEKUTIF

Sistem HandoverApp saat ini memiliki *core logic* yang solid namun memerlukan perkuatan (hardening) di 5 area kritis:
1. **SECURITY** - JWT tokens, input validation, rate limiting
2. **MEDIA** - Image compression & optimization
3. **NOTIFICATIONS** - Real-time push notifications
4. **REPORTING** - Export PDF/Excel capabilities
5. **OPERATIONS** - Logging, monitoring, testing

*   **Investasi**: 14 minggu, 3-4 developer
*   **Cost estimate**: $60-105K
*   **ROI**: Break-even dalam 4 bulan
*   **Target**: Support 1,000+ concurrent users

---

## 🛡️ AREA 1: SECURITY HARDENING

**Masalah Saat Ini:**
*   JWT tokens tidak punya expiry time & tidak ada refresh token mechanism.
*   Logout tidak membatalkan (invalidate) token.
*   Input validation minimal & tidak ada rate limiting.
*   CORS config mungkin terlalu permissive.

### 1.1 JWT Token Management
*   **Access Token**: Durasi 15 menit (SHORT LIVED).
*   **Refresh Token**: Durasi 7 hari (STORED IN DB).
*   **Token Blacklist**: Menggunakan Redis untuk fitur logout.
*   **Auto-refresh**: Client akan request token baru jika akses kadaluarsa.

### 1.2 Input Validation
*   **Library**: `joi` atau `express-validator` (`src/validators/schemas.js`).
*   **Validasi**: Handover (noPolisi, shift, lokasi), Upload Foto (max 10MB, format khusus), Submit Perbaikan.

### 1.3 Rate Limiting & Security Headers
*   **Library**: `express-rate-limit` & `helmet`.
*   **Membatasi request**: per IP (misal 100 req / 15 menit), limit percobaan login, dan standardisasi keamanan HTTP Header.

### 1.4 Standardisasi Error Handling
*   Membuat `src/middleware/errorHandler.js` dengan standardisasi response (`400`, `401`, `403`, `404`, `500`) dan No stack trace di Production.

---

## 🖼️ AREA 2: IMAGE OPTIMIZATION

**Masalah Saat Ini:**
*   Upload foto raw berukuran 5MB tanpa kompresi, menyebabkan storage cepat penuh (estimasi 37.5 GB/bulan).

### 2.1 Frontend Optimization (React Native)
*   Menggunakan konfigurasi `quality: 0.7` pada `expo-image-picker` dan kompresi tambahan melalui `expo-file-system`.
*   **Target**: Mengurangi upload time 80% dan menghemat bandwidth.

### 2.2 Backend Optimization (Node.js)
*   Menggunakan library Sharp (`npm install sharp`).
*   Membuat 3 varian otomatis saat foto di-upload:
    *   **Thumbnail** (200x200, WebP, ~30-50KB)
    *   **Preview** (600x600, WebP, ~100-150KB)
    *   **Full** (1200x1200, WebP, ~250-350KB)

### 2.3 Konfigurasi Storage & Database
*   **Opsi Production**: AWS S3 atau Google Cloud Storage (GCS), didukung CDN (CloudFront/Cloud CDN).
*   Penambahan skema database (`thumbnail_url`, `original_size`, dll) pada tabel `Photo`.
*   **Estimasi Penghematan**: Hingga $5,600 / tahun.

---

## 🔔 AREA 3: PUSH NOTIFICATIONS

**Masalah Saat Ini:**
*   Tidak ada notifikasi real-time. User tidak tahu jika ada perbaikan ditolak atau isu mendesak.

### 3.1 Setup Firebase Cloud Messaging (FCM)
*   Integrasi Backend dengan `firebase-admin` menggunakan Service Account Key.
*   **Manajemen Token FCM**: Endpoint `POST /api/user/fcm-token` untuk menyimpan token masing-masing device ke Database.

### 3.2 Skenario Trigger Notifikasi
*   **AMT Upload Foto Perbaikan** -> Pengawas menerima notifikasi "Bukti perbaikan siap direview".
*   **Pengawas Approve/Reject** -> AMT menerima notifikasi "Perbaikan Disetujui/Ditolak" beserta alasannya.
*   **Isu Baru & Perubahan Status** -> Notifikasi langsung ke Pengawas terkait.

### 3.3 Frontend Integration
*   Menggunakan library `expo-notifications` untuk penanganan pop-up dan navigasi spesifik saat notifikasi di-klik (Deep Linking ke `RepairDetail` atau `IssueList`).

---

## 📊 AREA 4: REPORT EXPORT & ANALYTICS

**Masalah Saat Ini:**
*   Tidak ada fitur ekspor data untuk laporan bulanan/harian manajemen.

### 4.1 Excel & PDF Export
*   **Excel**: Menggunakan `exceljs` untuk menghasilkan Workbook Multi-sheet (Summary, Detail Handover, Issues Tracking).
*   **PDF**: Menggunakan `pdfkit` untuk merender tabel dan statistik grafis laporan kendaraan.

### 4.2 Dashboard Analytics API
*   Endpoint analitik terpusat (`/api/dashboard/analytics`) yang menghitung metrik seperti:
    *   Repair success rate (%)
    *   Average repair time
    *   Driver compliance rate

### 4.3 Database Audit Log
*   Penambahan tabel `audit_log` untuk mencatat setiap aksi ekspor laporan atau perubahan status kritis oleh user.

---

## 🔍 AREA 5: LOGGING & MONITORING

**Masalah Saat Ini:**
*   Tidak ada centralized logging, sulit mendebug jika ada kerusakan di production.

### 5.1 Logging Framework (Winston)
*   Menggunakan `winston` & `winston-daily-rotate-file` untuk memisahkan `application.log` dan `error.log`.

### 5.2 Prometheus Metrics & Health Check
*   Library `prom-client` untuk mengekspos matriks trafik HTTP dan latensi database.
*   Pembuatan endpoint `GET /health` untuk memverifikasi ketersambungan DB dan Redis (sangat krusial untuk Load Balancer).

---

## 🧪 AREA 6: TESTING STRATEGY

**Target**: 80%+ test coverage untuk core features.

*   **Unit Tests (Jest)**: Menguji fungsi diskrit seperti `TokenManager`, `ImageOptimizer`, dan validasi skema.
*   **Integration Tests (Supertest)**: Pengujian End-to-End pada endpoint API (misalnya `POST /auth/login`, kelancaran handover creation).
*   **Load Testing (K6)**: Mensimulasikan trafik 1,000 pengguna bersamaan dengan threshold respons <500ms dan error rate <0.1%.

---

## ⚡ AREA 7: PERFORMANCE OPTIMIZATION

*   **Database Query**: Menggunakan Prisma `select` dan `include` dengan tepat guna menghindari N+1 Query Problem.
*   **Caching Strategy**: Menggunakan Redis (`CacheService`) untuk me-cache data statis kendaraan (misal `/api/vehicles/:id`) selama 1 jam.
*   **Database Indexing**: Menambahkan Composite Indexes pada PostgreSQL/MySQL (`created_at`, `status`, `no_polisi`).
*   **Pagination**: Implementasi batas (Limit) dan Offset untuk seluruh list API endpoint.

---

## 🚢 AREA 8: DEPLOYMENT & CI/CD

### 8.1 Docker Containerization
*   Penggunaan `Dockerfile.prod` (Node 20 Alpine) yang digabungkan dalam `docker-compose.yml` untuk menjalankan Backend dan Redis dalam satu paket yang terisolasi.

### 8.2 CI/CD Pipeline (GitHub Actions)
*   Workflow otomatis (`.github/workflows/deploy.yml`) untuk menjalankan Testing -> Build Docker Image -> Publish Image -> Restart Server secara otomatis saat kode di-push ke branch `main`.

---

## 📅 RINGKASAN TIMELINE PENGEMBANGAN (10-14 MINGGU)

*   **PHASE 1: Security & Foundation (Mgg 1-4)**
    *   JWT, Validation, Rate Limiting, Error Handling, Image Optimization.
*   **PHASE 2: User Experience (Mgg 5-7)**
    *   Firebase Notifications, PDF/Excel Export, Analytics Dashboard.
*   **PHASE 3: Operations & Scalability (Mgg 8-10)**
    *   Unit Testing, Performance Optimization, Database Caching.
*   **PHASE 4: Deployment & Release (Mgg 11-14)**
    *   Docker, CI/CD Pipeline, Security Audits, Production Launch.

**NEXT STEP**: Mulai Phase 1 (Security & Foundation) pada Sprint berikutnya.
