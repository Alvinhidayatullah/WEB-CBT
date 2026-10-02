# Product Requirements Document (PRD)
**Project Name:** SecureCBT | SMK Yasda  
**Version:** 2.0.0  
**Last Updated:** Oktober 2026

---

## 1. Pendahuluan
### 1.1 Latar Belakang
Ujian berbasis komputer (CBT) di lingkungan sekolah menengah vokasi, khususnya SMK Yasda, membutuhkan sistem yang tidak hanya aman dari kecurangan, tetapi juga efisien dalam proses penilaian[cite: 1]. Terutama ketika menghadapi jumlah pengguna massal (misal: 500 peserta serentak) dan jenis soal subjektif seperti Esai[cite: 1].

### 1.2 Tujuan
Membangun platform ujian CBT (*Computer Based Test*) yang cepat, aman, tangguh untuk jumlah pengguna masif, dan terintegrasi dengan kecerdasan buatan (AI) lokal (9Router)[cite: 1]. Platform ini dirancang fleksibel, memungkinkan guru untuk memilih antara penilaian esai otomatis oleh AI yang empatik, atau penilaian manual (Human-in-the-Loop). Seluruh ekosistem ini diintegrasikan ke dalam web utama menggunakan **Antigravity**.

---

## 2. Arsitektur & Teknologi (*Tech Stack*)
- **Integrasi Ekosistem:** **Antigravity** (sebagai jembatan integrasi utama sistem ke web).
- **Frontend & Backend:** Next.js (App Router, React) dengan TypeScript[cite: 1].
- **Styling:** Tailwind CSS (dengan efek animasi *glassmorphism* neon modern)[cite: 1].
- **Database ORM:** Prisma Client[cite: 1].
- **Database:** PostgreSQL[cite: 1].
- **Otentikasi:** JSON Web Token (JWT) dengan *Stateful Verification* menggunakan *library* `jose`[cite: 1].
- **Integrasi AI:** 9Router (Local Gateway ke LLM) untuk Penilaian Esai[cite: 1].
- **Observability:** Vercel Analytics & Vercel Speed Insights[cite: 1].

---

## 3. Aktor & Peran (*User Roles*)
Sistem ini menggunakan *Role-Based Access Control* (RBAC) dengan 3 aktor utama[cite: 1]:

1. **SUPER_ADMIN**: Memiliki kontrol penuh atas seluruh data sistem, pengguna (CRUD semua *role*), dan melihat seluruh hasil ujian[cite: 1].
2. **GURU**: Dapat membuat ujian, merancang soal (PG & Esai), mengatur *toggle* AI[cite: 1], mengoreksi esai secara manual, mengelola kelas yang diajarnya, memantau *progress* ujian, dan meninjau hasil akhir[cite: 1].
3. **MURID**: Mengakses antarmuka ujian, mengerjakan soal dengan batas waktu, dan melihat skor (jika diizinkan)[cite: 1].

---

## 4. Fitur Utama

### 4.1. Otentikasi dan Keamanan
- **Login Dinamis:** Menggunakan kombinasi `Username` dan `Password/Token` (token akses 5-digit unik untuk siswa)[cite: 1].
- **Anti-Replay Attack:** Menggunakan field `sessionVersion` di *database* yang dicek paralel dengan Token JWT[cite: 1].
- **Enkripsi:** Menggunakan algoritma *hashing* HS256 yang divalidasi dari *environment variables*[cite: 1].

### 4.2. Manajemen Pengguna
- **Data Murid & Guru:** Menyimpan data Nama, Role, Kelas, Mata Pelajaran (untuk guru), dan Token Akses[cite: 1].
- Fitur *Bulk Delete* dan pengelolaan data masif[cite: 1].

### 4.3. Manajemen Ujian & Soal (Sisi Guru/Admin)
- **Pembuatan Sesi:** Menentukan Tipe Ujian (UTS, UAS, dll), Mata Pelajaran, Kelas Tujuan, dan Durasi (menit)[cite: 1].
- **Fitur Toggle AI (On/Off):** Pada halaman "Daftar Ujian Aktif", guru dapat mengaktifkan atau menonaktifkan sakelar "Gunakan Asisten AI" untuk setiap ujian.
- **Spesifikasi Instrumen Evaluasi (Standar Proporsional Dinamis):**
  - **Pembobotan Nilai:** Pilihan Ganda (PG) memiliki bobot maksimal 60%, dan Esai memiliki bobot maksimal 40% dari total nilai 100.
  - **Kalkulasi Logika:** 
    - Skor PG = `(Jumlah PG Benar / Total Soal PG) * 60`
    - Skor Esai = `(Total Nilai Esai dari AI atau Guru / Total Nilai Esai Maksimal) * 40` (Skala penilaian per soal esai adalah 0 - 100).
    - `Nilai Akhir = Skor PG + Skor Esai`
- **Format Soal:**
  - **Pilihan Ganda (PG):** Mendukung hingga 4 Opsi (A, B, C, D)[cite: 1].
  - **Esai:** Mendukung kolom "Referensi Kunci Jawaban (Rubrik)"[cite: 1].

### 4.4. Pelaksanaan Ujian (Sisi Murid)
- **Antarmuka Ujian:** Menampilkan *countdown timer* secara *real-time* berbasis durasi server (sinkron dengan `localStorage`)[cite: 1].
- **Fitur Keselamatan:** Peringatan "Sistem Padat / Koneksi Terputus" dengan logika *Auto-Retry* saat penyerahan (*submit*)[cite: 1].
- **Auto-Submit:** Jawaban akan terkumpul otomatis secara paksa apabila durasi waktu ujian telah habis[cite: 1].
- **Pendeteksi Kecurangan (Basic):** Fitur peringatan kecurangan *built-in* (*flag isCheated*)[cite: 1].

### 4.5. Sistem Penilaian Esai (AI Auto-Grading & Manual Review)
- **Alur Submit:**
  - Pilihan ganda dihitung secara instan.
  - Sistem mengecek field `isAIGradingEnabled`. Jika `TRUE`, esai masuk ke antrean `PENDING` (Job Queue)[cite: 1] untuk 9Router. Jika `FALSE`, esai masuk ke status `MANUAL_REVIEW`.
- **Koreksi Manual (Jika AI Off):** Terdapat antarmuka khusus bagi guru untuk membaca esai siswa, memberikan nilai (0-100), dan menuliskan *feedback*.
- **Persona dan Logika AI (Human-like Grading):** 
  - Jika AI On, sistem akan memberikan *prompt* apresiatif kepada AI[cite: 1]:
    > "Kamu adalah guru profesional yang empatik dan bijak. Tugasmu menilai jawaban esai siswa dengan skala 0 hingga 100 berdasarkan pemahaman konsep, bukan kecocokan kata per kata. Terapkan prinsip 'menghargai usaha' dengan pedoman berikut:
    > - **90 - 100:** Jawaban sangat tepat, logis, dan komprehensif.
    > - **70 - 89:** Konsep dasar benar, bahasa mungkin berantakan atau ada sedikit kekurangan detail.
    > - **40 - 69:** Siswa menunjukkan usaha menjawab dan menangkap sebagian kecil konsep dasar, meskipun penyampaiannya meleset. Hargai usahanya, jangan beri nilai nol.
    > - **15 - 39:** Jawaban salah atau kurang tepat, namun siswa sudah berusaha menuliskan sesuatu yang masih menyenggol konteks topik utama. Berikan poin apresiasi.
    > - **0 - 14:** Hanya jika jawaban benar-benar kosong, provokatif, atau sepenuhnya tidak relevan dengan pertanyaan.
    > Kembalikan output HANYA dalam format JSON: `{ "score": X, "reason": "Penjelasan apresiatif dan membangun..." }`"
- **Ekstraksi JSON Tahan Banting:** Menghapus tag `<thinking>` atau respon kotor dari AI dan hanya mengekstrak nilai akhir berformat JSON[cite: 1].

### 4.6. Pelaporan dan Observasi
- **Riwayat Ujian:** Dasbor Guru dan Admin menampilkan riwayat ujian per kelas dan hasil rata-rata per mata pelajaran[cite: 1].
- **Vercel Analytics:** Melacak pengunjung aktif, halaman (*Page Views*), dan asal trafik perangkat[cite: 1].
- **Vercel Speed Insights:** Menganalisa *Core Web Vitals* (LCP, INP, CLS) secara *real-time*[cite: 1].

---

## 5. Arsitektur Database (Model Skema Utama)

- **`User`**: Data kredensial, role, token unik sesi[cite: 1].
- **`Exam`**: Sesi utama ujian, durasi, kelas sasaran[cite: 1]. Ditambahkan field `isAIGradingEnabled` (Boolean).
- **`Question`**: Detail teks soal, *image*, bobot opsi PG, dan referensi rubrik Esai[cite: 1].
- **`ExamResult`**: Nilai total (*score*), nilai esai (*essayScore*), JSON rekam jejak jawaban, *feedback* evaluasi dari AI/Guru, dan status *grading* (`GRADED`, `PENDING`, `MANUAL_REVIEW`)[cite: 1].
- **`JobQueue`**: Tabel eksekusi asinkron untuk tugas AI memproses ujian massal agar server tidak macet (*hang*)[cite: 1].

---

## 6. Skenario Skalabilitas (SLA 500 Pengguna Serentak)
1. **Frontend & Antigravity:** React di-*render* secara *Server-Side* melalui Edge Network Vercel[cite: 1] dan di-routing melalui Antigravity.
2. **Database:** Terhubung via *Connection Pooling* di Prisma[cite: 1]. *Error Timeout* dikelola via blok *try-catch* tanpa mengeluarkan *user* secara paksa (Fallback JWT Valid)[cite: 1].
3. **AI Gateway:** Dibantu kontainer Docker `9router` (dengan konfigurasi `--restart unless-stopped`) secara asinkron (tidak memblokir UI murid saat *submit*)[cite: 1].