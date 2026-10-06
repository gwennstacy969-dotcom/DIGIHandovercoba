# 🏛️ Arsitektur Sistem HandoverApp Pertamina

Dokumen ini mendokumentasikan arsitektur teknis, diagram aliran data, dan siklus hidup operasional aplikasi **Pertamina HandoverApp**.

---

## 1. Diagram Arsitektur Tingkat Tinggi (High-Level Architecture)

```mermaid
graph TD
    subgraph Klien ["📱 Lapisan Klien (Frontend)"]
        Mobile["Aplikasi Mobile (Android / iOS)<br/>• React Native (Expo)<br/>• Camera Barcode Scanner<br/>• Offline Caching"]
        WebAdmin["Web Dashboard (Desktop Browser)<br/>• React Native Web<br/>• Glassmorphism Design<br/>• Export Tools (Excel/PDF)"]
    end

    subgraph Gerbang ["🛡️ Gateway & Keamanan"]
        CORS["CORS & Helmet Security"]
        RateLimit["Express Rate Limiter"]
        JWTMiddleware["JWT Authentication & RBAC"]
    end

    subgraph Server ["⚙️ Lapisan Layanan (Backend Node.js)"]
        API["Express.js Server"]
        AuthController["Auth Controller"]
        HandoverController["Handover Controller"]
        IssueController["Issue & Verification Controller"]
        ReportService["ExcelJS & PDFKit Engine"]
        ImageService["Sharp Media Optimizer"]
    end

    subgraph DataStore ["💾 Lapisan Data & Cache"]
        Prisma["Prisma ORM (Schema & Query Engine)"]
        MySQL[("MySQL 8.0 Database<br/>• Users & Roles<br/>• 334 AMT Workers<br/>• 83 Mobil Tangki<br/>• Handovers & Items")]
        Redis[("Redis In-Memory Cache<br/>• Token Blacklist<br/>• Fleet Status Cache")]
        Storage[("Local / Cloud Storage<br/>• Bukti Foto Kerusakan<br/>• Bukti Foto Perbaikan")]
    end

    Mobile -->|HTTPS / REST API| Gerbang
    WebAdmin -->|HTTPS / REST API| Gerbang

    Gerbang --> API
    API --> AuthController
    API --> HandoverController
    API --> IssueController
    API --> ReportService
    API --> ImageService

    AuthController --> Prisma
    HandoverController --> Prisma
    IssueController --> Prisma
    ImageService --> Storage

    Prisma --> MySQL
    API -.-> Redis
```

---

## 2. Alur Serah Terima & Siklus Hidup Isu (Lifecycle State Machine)

```mermaid
sequenceDiagram
    autonumber
    actor AMT as Awak Mobil Tangki (AMT)
    actor Supervisor as Pengawas Lapangan
    participant System as Sistem HandoverApp
    participant DB as Database (Prisma/MySQL)

    Note over AMT, System: Tahap 1: Inspeksi Awal Shift
    AMT->>System: Pindai Barcode Truk Tangki (QR Plat Nomor)
    System-->>AMT: Tampilkan Checklist Kendaraan (Kategori A & B)
    AMT->>System: Isi Checklist (Jika Rusak: Wajib Lampirkan Foto)
    AMT->>System: Kirim Laporan Handover (Mulai Shift)
    System->>DB: Simpan Data Handover & Status Armada

    alt Semua Item Normal
        System-->>AMT: Status Truk: "Siap Operasi (Normal)"
        System-->>Supervisor: Notifikasi: Armada Siap Beroperasi
    else Terdapat Item Rusak / Tidak Layak
        System-->>AMT: Status Truk: "Kritis / Butuh Tindak Lanjut"
        System->>DB: Daftarkan ke Daftar Isu Terbuka
        System-->>Supervisor: Peringatan: Kerusakan Terdeteksi

        Note over AMT, Supervisor: Tahap 2: Proses Perbaikan & Verifikasi
        AMT->>System: Lakukan Perbaikan Fisik & Unggah Foto Hasil Perbaikan
        System->>Supervisor: Kirim Notifikasi Verifikasi Perbaikan
        Supervisor->>System: Tinjau Bukti Foto Perbaikan

        alt Pengawas Setuju (Approve)
            Supervisor->>System: Klik "SUDAH DIPERBAIKI"
            System->>DB: Ubah Status Isu -> "RESOLVED"
            System->>DB: Ubah Status Armada -> "Siap Operasi"
            System-->>AMT: Notifikasi: Perbaikan Disetujui
        else Pengawas Tolak (Reject)
            Supervisor->>System: Tolak dengan Catatan Perbaikan Ulang
            System->>DB: Catat Alasan Penolakan
            System-->>AMT: Notifikasi: Perbaikan Ditolak (Harap Perbaiki Ulang)
        end
    end
```

---

## 3. Matriks Otorisasi Berbasis Peran (RBAC)

```mermaid
classDiagram
    class SUPER_ADMIN {
        +Kelola Akun Admin & Pengawas
        +Kelola Master 334 Pekerja AMT
        +Kelola Master 83 Armada Mobil Tangki
        +Kustomisasi Checklist Inspeksi
        +Ekspor Rekapitulasi Lengkap
    }

    class PENGAWAS {
        +Pantau Dashboard Monitoring Live
        +Evaluasi & Verifikasi Perbaikan (Approve/Reject)
        +Kirim Pesan (Message Center)
        +Ekspor Laporan Resmi (Excel/PDF)
        +Lihat Detail Riwayat Handover
    }

    class AMT {
        +Pindai Barcode Mobil Tangki
        +Isi Formulir Checklist Shift
        +Unggah Foto Bukti Kerusakan
        +Unggah Bukti Hasil Perbaikan
        +Lihat Riwayat Handover Sendiri
    }

    SUPER_ADMIN --|> PENGAWAS : Mewarisi Hak Akses
    PENGAWAS ..> AMT : Membimbing & Mengevaluasi
```

---

## 4. Keamanan & Kepatuhan Data

1. **Autentikasi Aman**: Menggunakan JSON Web Tokens (JWT) dengan masa berlaku dan algoritma hashing `bcrypt` (10 rounds salt).
2. **Proteksi Injeksi SQL**: Seluruh interaksi database menggunakan Prisma ORM dengan *parameterized queries* terkompilasi.
3. **Penyaringan Header HTTP**: Menerapkan modul `helmet` untuk menonaktifkan header berbahaya dan mencegah serangan XSS serta Clickjacking.
4. **Pembatasan Laju Request**: `express-rate-limit` mencegah serangan Brute-Force pada rute autentikasi sensitif.
