# Product Requirements Document (PRD)
**Project Name:** SecureCBT | SMK Yasda  
**Version:** 1.0.0  
**Last Updated:** Oktober 2026

---

## 1. Pendahuluan
### 1.1 Latar Belakang
Ujian berbasis komputer (CBT) di lingkungan sekolah menengah vokasi, khususnya SMK Yasda, membutuhkan sistem yang tidak hanya aman dari kecurangan, tetapi juga efisien dalam proses penilaian. Terutama ketika menghadapi jumlah pengguna massal (misal: 500 peserta serentak) dan jenis soal subjektif seperti Esai.

### 1.2 Tujuan
Membangun platform ujian CBT (*Computer Based Test*) yang cepat, aman, tangguh untuk jumlah pengguna masif, dan terintegrasi dengan kecerdasan buatan (AI) lokal (9Router) untuk melakukan penilaian esai secara otomatis.

---

## 2. Arsitektur & Teknologi (*Tech Stack*)
- **Frontend & Backend:** Next.js (App Router, React) dengan TypeScript.
- **Styling:** Tailwind CSS (dengan efek animasi *glassmorphism* neon modern).
- **Database ORM:** Prisma Client.
- **Database:** PostgreSQL.
- **Otentikasi:** JSON Web Token (JWT) dengan *Stateful Verification* menggunakan *library* `jose`.
- **Integrasi AI:** 9Router (Local Gateway ke LLM) untuk Penilaian Esai.
- **Observability:** Vercel Analytics & Vercel Speed Insights.

---

## 3. Aktor & Peran (*User Roles*)
Sistem ini menggunakan *Role-Based Access Control* (RBAC) dengan 3 aktor utama:

1. **SUPER_ADMIN**: Memiliki kontrol penuh atas seluruh data sistem, pengguna (CRUD semua *role*), dan melihat seluruh hasil ujian.
2. **GURU**: Dapat membuat ujian, merancang soal (PG & Esai), mengelola kelas yang diajarnya, memantau *progress* ujian, dan meninjau hasil nilai AI.
3. **MURID**: Mengakses antarmuka ujian, mengerjakan soal dengan batas waktu, dan melihat skor (jika diizinkan).

---

## 4. Fitur Utama

### 4.1. Otentikasi dan Keamanan
- **Login Dinamis:** Menggunakan kombinasi `Username` dan `Password/Token` (token akses 5-digit unik untuk siswa).
- **Anti-Replay Attack:** Menggunakan field `sessionVersion` di *database* yang dicek paralel dengan Token JWT.
- **Enkripsi:** Menggunakan algoritma *hashing* HS256 yang divalidasi dari *environment variables*.

### 4.2. Manajemen Pengguna
- **Data Murid & Guru:** Menyimpan data Nama, Role, Kelas, Mata Pelajaran (untuk guru), dan Token Akses.
- Fitur *Bulk Delete* dan pengelolaan data masif.

### 4.3. Manajemen Ujian & Soal (Sisi Guru/Admin)
- **Pembuatan Sesi:** Menentukan Tipe Ujian (UTS, UAS, dll), Mata Pelajaran, Kelas Tujuan, dan Durasi (menit).
- **Format Soal:**
  - **Pilihan Ganda (PG):** Mendukung hingga 4 Opsi (A, B, C, D) dengan pembobotan nilai spesifik per opsi (bukan hanya Benar/Salah).
  - **Esai:** Mendukung kolom "Referensi Kunci Jawaban (Rubrik)" untuk panduan AI menilai.
- **Dukungan Media:** Setiap soal dan opsi dapat disisipkan URL gambar.

### 4.4. Pelaksanaan Ujian (Sisi Murid)
- **Antarmuka Ujian:** Menampilkan *countdown timer* secara *real-time* berbasis durasi server (sinkron dengan `localStorage`).
- **Fitur Keselamatan:** Peringatan "Sistem Padat / Koneksi Terputus" dengan logika *Auto-Retry* saat penyerahan (*submit*).
- **Auto-Submit:** Jawaban akan terkumpul otomatis secara paksa apabila durasi waktu ujian telah habis.
- **Pendeteksi Kecurangan (Basic):** Fitur peringatan kecurangan *built-in* (*flag isCheated*).

### 4.5. AI Auto-Grading (Penilaian Otomatis Esai)
- **Mekanisme Pipa AI:** 
  - Ujian pilihan ganda dikalkulasi secara matematis secara instan.
  - Jika terdapat esai, status menjadi `PENDING` dan dikirim ke sistem *Job Queue*.
- **Integrasi 9Router:** Mengirim permintaan penilaian ke endpoint lokal `https://rhhifl6.abc-tunnel.us/v1` menggunakan kunci `AI_GATEWAY_KEY`.
- **Ekstraksi JSON Tahan Banting:** Menghapus tag `<thinking>` atau respon kotor dari AI dan hanya mengekstrak nilai akhir berformat JSON `{ "score": X, "reason": "Y" }`.

### 4.6. Pelaporan dan Observasi
- **Riwayat Ujian:** Dasbor Guru dan Admin menampilkan riwayat ujian per kelas dan hasil rata-rata per mata pelajaran.
- **Vercel Analytics:** Melacak dan menghitung pengunjung aktif, halaman (*Page Views*), dan asal trafik perangkat.
- **Vercel Speed Insights:** Menganalisa *Core Web Vitals* (LCP, INP, CLS) secara *real-time* untuk 500 pengguna masif agar mendeteksi *bottleneck* seketika.

---

## 5. Arsitektur Database (Model Skema Utama)

- **`User`**: Data kredensial, role, token unik sesi.
- **`Exam`**: Sesi utama ujian, durasi, kelas sasaran.
- **`Question`**: Detail teks soal, *image*, bobot opsi PG, dan referensi rubrik Esai.
- **`ExamResult`**: Nilai total (*score*), nilai esai (*essayScore*), JSON rekam jejak jawaban, *feedback* dari AI, dan status *grading* (`GRADED`, `PENDING`).
- **`JobQueue`**: Tabel eksekusi asinkron untuk tugas AI memproses ujian massal agar server tidak macet (*hang*).

---

## 6. Skenario Skalabilitas (SLA 500 Pengguna Serentak)
1. **Frontend:** React di-*render* secara *Server-Side* melalui Edge Network Vercel. 
2. **Database:** Terhubung via *Connection Pooling* di Prisma. *Error Timeout* dikelola via blok *try-catch* tanpa mengeluarkan *user* secara paksa (Fallback JWT Valid).
3. **AI Gateway:** Dibantu kontainer Docker `9router` (dengan konfigurasi `--restart unless-stopped`) secara asinkron (tidak memblokir UI murid saat *submit*).
