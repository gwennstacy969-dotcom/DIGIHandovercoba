# 🛠️ Panduan Pengembang (Developer Guide)

Panduan teknis bagi pengembang untuk berkontribusi, mengonfigurasi lingkungan lokal, menjalankan pengujian, dan mematuhi standar kode proyek **HandoverApp**.

---

## 1. Menyiapkan Lingkungan Lokal

### Prasyarat
* **Node.js**: Versi `>= 20.x` (LTS disarankan)
* **MySQL**: Versi `>= 8.0` (dapat menggunakan Docker atau instalasi lokal XAMPP)
* **Redis**: Opsional untuk caching (fallback otomatis aktif jika Redis nonaktif)
* **Git**: Versi terbaru

### Langkah Instalasi
```bash
# 1. Clone repository
git clone https://github.com/kangharfebrin-dot/HandoverApp.git
cd HandoverApp

# 2. Pasang dependensi backend
cd backend
npm install
cp .env.example .env
# Sesuaikan isi .env dengan kredensial database lokal Anda

# 3. Generate Prisma client & sinkronisasi database
npm run db:generate
npm run db:push

# 4. Pasang dependensi frontend
cd ../frontend
npm install
cp .env.example .env
```

---

## 2. Manajemen Database & Migrasi (Prisma ORM)

Proyek ini **TIDAK MENGGUNAKAN** file raw `.sql` manual untuk perubahan skema. Seluruh perubahan model dikelola melalui skema deklaratif [backend/prisma/schema.prisma](file:///e:/Magang/HandoverApp/backend/prisma/schema.prisma).

### Perintah Utama Database:
```bash
# Menghasilkan ulang Prisma Client setelah mengedit schema.prisma
npm run db:generate

# Menerapkan perubahan skema langsung ke database (Development)
npm run db:push

# Membuat file migrasi baru ter-versi (Production)
npm run db:migrate

# Membuka Prisma Studio GUI untuk menginspeksi tabel dan data langsung di browser
npm run db:studio
```

---

## 3. Menjalankan Pengujian (Testing)

### Backend Tests (Jest)
```bash
cd backend

# Menjalankan seluruh unit test
npm test

# Menjalankan pengujian dalam mode pengawasan (Watch Mode)
npm run test:watch

# Menghasilkan laporan cakupan kode (Code Coverage Report)
npm run test:coverage
```

### Frontend Tests
```bash
cd frontend

# Menjalankan pengujian komponen & konfigurasi frontend
npm test
```

---

## 4. Standar Kode & Format (Code Quality)

Proyek ini menggunakan konfigurasi **ESLint** dan **Prettier** untuk menjaga konsistensi gaya penulisan kode di seluruh modul.

```bash
# Memformat seluruh berkas kode
npx prettier --write "backend/**/*.{js,json}" "frontend/**/*.{js,json}"

# Memeriksa kepatuhan linter
npx eslint backend/
npx eslint frontend/
```

### Aturan Format Utama:
* Indentasi: **2 spasi** (lihat [.editorconfig](file:///e:/Magang/HandoverApp/.editorconfig))
* Titik koma (*Semicolons*): **Selalu digunakan**
* Tanda petik (*Quotes*): **Single quotes (`'`)**
* Format akhir baris: **LF**

---

## 5. Konvensi Commit Git (Conventional Commits)

Gunakan standar *Conventional Commits* untuk setiap pesan commit:

| Tipe | Kapan Digunakan | Contoh |
| :--- | :--- | :--- |
| `feat` | Menambahkan fitur baru | `feat(scanner): tambahkan deteksi otomatis flashlight` |
| `fix` | Memperbaiki bug atau kesalahan tampilan | `fix(web): perbaiki batas viewport scrolling worker list` |
| `docs` | Perubahan dokumentasi | `docs: perbarui panduan arsitektur sistem` |
| `style` | Perubahan format/gaya kode tanpa mengubah logika | `style: rapikan indentasi pada checklist screen` |
| `refactor` | Refaktorisasi kode internal | `refactor(auth): pisahkan validasi schema ke file terpisah` |
| `test` | Menambah atau memperbaiki unit test | `test(cache): tambahkan pengujian isolasi cache service` |
| `chore` | Pemeliharaan dependensi atau konfigurasi repo | `chore: perbarui aturan .gitignore dan docker-compose` |

---

## 6. Alur Branching (Git Flow)

1. Buat branch baru dari `main`:
   ```bash
   git checkout -b feat/nama-fitur-baru
   ```
2. Lakukan commit secara bertahap dan deskriptif.
3. Jalankan pengujian sebelum push:
   ```bash
   npm test
   ```
4. Push branch ke remote dan buat Pull Request (PR) untuk direview.
