# Agent Rules & Instructions

## 1. Git Workflow
- **JANGAN PERNAH** melakukan `git push` ke GitHub (remote repository manapun) secara otomatis tanpa perintah/instruksi eksplisit langsung dari user.
- Semua pekerjaan, pengujian, dan perubahan kode dilakukan di lingkungan lokal saja. Hanya lakukan push saat user menulis perintah seperti "push", "upload ke github", dsb.
- **Remote Spesifik**: Saat user meminta push, HANYA push ke satu remote yang secara eksplisit ditentukan oleh user. **JANGAN PERNAH** melakukan push ke beberapa remote sekaligus (misalnya `origin` dan `handover-app` bersamaan). Jika nama remote tidak spesifik/ambigu, wajib tanyakan/konfirmasi terlebih dahulu kepada user remote mana yang dituju.

## 2. Token & Subagent Constraints
- **DILARANG** menggunakan `browser_subagent` atau web browsing agent otomatis yang menghabiskan token.
