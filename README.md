# Temu

Aplikasi web responsif untuk memilih topik dan memandu diskusi bersama teman. Proyek memakai Vite, Vercel Functions, Firebase Realtime Database, Firebase Admin SDK, dan Firebase Anonymous Authentication.

## Persiapan lokal

1. Pasang Node.js 20.19 atau lebih baru.
2. Jalankan `npm install`.
3. Jalankan `npm run dev` untuk UI dan pratinjau lokal. Endpoint serverless berjalan di deployment Vercel; untuk menjalankan API lokal, gunakan Vercel CLI dengan `vercel dev`.

Tanpa konfigurasi Firebase, situs tetap bisa dibuka dan alur sesi dapat dicoba sebagai pratinjau lokal. Pratinjau ini hanya tersimpan di browser dan tidak bisa dipakai untuk mengundang teman dari perangkat lain.

## Firebase dan backend sesi online

1. Buat proyek Firebase di [Firebase Console](https://console.firebase.google.com/) dan daftarkan aplikasi Web.
2. Aktifkan **Authentication → Sign-in method → Anonymous**.
3. Buat **Realtime Database** dan salin URL database serta konfigurasi aplikasi Web.
4. Isi variabel publik berikut pada `.env.local` untuk build UI:

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

5. Buat service account dari **Project Settings → Service accounts → Generate new private key**. Simpan seluruh JSON credential itu sebagai variabel rahasia `FIREBASE_SERVICE_ACCOUNT` di Vercel. Jangan commit atau menaruhnya di variabel `VITE_*`.
6. Tambahkan `FIREBASE_DATABASE_URL` sebagai variabel server di Vercel. Variabel ini memakai URL Realtime Database yang sama.
7. Publikasikan aturan dari `database.rules.json` pada tab Rules Realtime Database. Browser hanya diberi izin membaca ruang setelah login anonim; seluruh perubahan data melalui backend.
8. Jalankan `npm run build` untuk membuat hasil produksi pada folder `dist`.

Firebase Spark menawarkan kuota gratis Realtime Database sebesar 1 GB penyimpanan, 10 GB unduhan per bulan, dan maksimal 100 koneksi bersamaan. [Periksa kuota dan ketentuan Firebase](https://firebase.google.com/docs/database/usage/billing).

## Deploy ke Vercel

1. Impor repository proyek ke Vercel. Pengaturan build dan folder hasil sudah tercantum pada `vercel.json`; Vercel otomatis mengenali handler di folder `api/`.
2. Tambahkan lima variabel `VITE_FIREBASE_*`, `FIREBASE_DATABASE_URL`, dan `FIREBASE_SERVICE_ACCOUNT` pada **Project Settings → Environment Variables** di Vercel. `FIREBASE_SERVICE_ACCOUNT` harus berupa JSON service account lengkap.
3. Deploy atau redeploy agar variabel baru masuk ke build dan Functions.
4. Bagikan alamat Vercel dan kode enam karakter ruang kepada teman.

Vercel membangun situs dan menjalankan API; Firebase menyediakan identitas anonim dan sinkronisasi real-time. Sesi lintas perangkat baru berfungsi setelah proyek Firebase dibuat, variabel diisi, Authentication anonim diaktifkan, service account ditambahkan sebagai rahasia, dan aturan database dipublikasikan.

## Fitur dan batas saat ini

- Koleksi topik bawaan, pengacak, dan topik pribadi yang disimpan pada browser pengunjung.
- Mode **Satu HP** untuk 2–10 orang: masukkan nama, setiap peserta mendapat topik berbeda, lalu gunakan timer riset/bicara dan penilaian pada perangkat yang sama. Mode ini tidak perlu akun atau Firebase; datanya tersimpan lokal di browser. Situs Vercel tetap harus dibuka saat ada koneksi internet.
- Ruang dengan kode undangan, peserta, timer riset dan bicara, tahap diskusi, serta penilaian kontribusi.
- API memverifikasi Firebase ID token, memeriksa input, membatasi perubahan tahap untuk tuan rumah, dan hanya mengizinkan peserta menilai orang lain setelah sesi selesai.
- Endpoint backend: `POST /api/rooms`, `POST /api/rooms/:code/join`, `POST /api/rooms/:code/phase`, `POST /api/rooms/:code/score`.
- Diskusi dilakukan langsung atau melalui Discord. Aplikasi tidak meminta akses mikrofon.
- Login email/Google/Apple, SSO, email verifikasi, magic link, dan passkey tidak diaktifkan dalam proyek ini.
- Rules membatasi perubahan ruang untuk tuan rumah serta data peserta untuk pemilik identitas anonimnya. Kode ruang berfungsi sebagai undangan; jangan menyimpan informasi sensitif.

## Struktur berkas

- `index.html` — struktur halaman dan dialog
- `styles.css` — tampilan responsif
- `session.css` — gaya pemilih mode dan daftar peserta satu perangkat
- `app.js` — interaksi antarmuka dan sesi Firebase
- `api/rooms/` — Vercel Functions untuk operasi sesi
- `lib/server/` — verifikasi identitas dan inisialisasi Firebase Admin
- `package.json` — dependensi dan perintah pengembangan/build
- `vercel.json` — konfigurasi build Vercel
- `.env.example` — daftar konfigurasi yang dibutuhkan
- `database.rules.json` — aturan akses Realtime Database
