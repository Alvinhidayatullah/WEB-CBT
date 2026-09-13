# Product Requirements Document (PRD)

**Product Name:** Secure-CBT  
**Vendor/Developer:** Elite Sentinel Cybercorp  
**Version:** 1.3 (Beta - Multimedia & Enhanced Security)  
**Document Status:** Final  

---

## 1. Pendahuluan

### 1.1 Tujuan Produk
Secure-CBT adalah platform *Computer-Based Test* (Ujian Berbasis Komputer) modern yang dirancang untuk menjadi sangat aman, cepat, dan mudah digunakan. Sistem ini dibangun khusus untuk institusi pendidikan agar dapat menyelenggarakan ujian dengan fitur anti-kecurangan yang ketat, dukungan unggah media (gambar) yang ringan, manajemen data masif via Excel, dan sistem penilaian esai yang otomatis dan fleksibel dengan bantuan AI.

### 1.2 Target Pengguna (Personas)
1. **SUPER_ADMIN**: Pemilik sistem atau administrator IT. Memiliki hak penuh atas seluruh manajemen data pengguna dan sistem.
2. **GURU (Teacher)**: Tenaga pendidik yang bertugas membuat soal, mengunggah gambar pendukung, mendistribusikan token ujian, mengatur parameter rubrik AI, dan memonitor hasil ujian sesuai dengan ruang lingkup kelas dan mata pelajaran yang diampu.
3. **MURID (Student)**: Peserta ujian yang mengakses portal ujian menggunakan token unik.

---

## 2. Arsitektur & Teknologi (Tech Stack)
Aplikasi ini dikembangkan menggunakan tumpukan teknologi *Serverless-Ready* yang dirancang untuk menangani konkurensi masif (1000+ pengguna bersamaan):

* **Frontend & Backend Framework:** Next.js 15 (App Router)
* **Styling:** Tailwind CSS (elemen UI/UX *Glassmorphism*, *Micro-animations*, & *Lucide Icons*)
* **Database:** PostgreSQL (Hosting via Neon Serverless)
* **ORM:** Prisma ORM
* **Authentication:** Custom JWT via `jose`, disandikan dengan `bcryptjs`. Sesi disimpan dalam *HTTP-Only Secure Cookies*.
* **Data Processing:** Library `xlsx` (Ekspor/Impor data).
* **AI Engine:** Google Gemini API (SDK `@google/generative-ai`).
* **Image Processing:** HTML5 Canvas API (Client-side Compression & Base64 encoding).

---

## 3. Fitur Utama (Core Features)

### 3.1 Otentikasi & Keamanan Tingkat Lanjut (WAF)
* **Stateful JWT Session & Auto-Kick:** Mencegah *Replay Attack*. Jika Super Admin menghapus atau menonaktifkan pengguna, *sessionVersion* akan diperbarui, sehingga pengguna otomatis ditendang (*auto-kick*) secara *real-time* tanpa harus menekan tombol *refresh*.
* **Anti-Cookie Injection:** *Cookie session* dibatasi dengan umur maksimal yang ketat (1 Hari / 24 Jam) dan parameter `SameSite=Strict` untuk menghindari pencurian *cookie* (*Hijacking*) dan CSRF.
* **Payload Tamper Protection:** Sistem validasi berbasis *RegEx* pada tingkat *Server Action* menolak injeksi *malware* (seperti RCE atau XSS via file SVG) pada formulir unggah gambar.

### 3.2 Manajemen Pengguna (User Management)
* **CRUD Pengguna:** Manajemen data Murid dan Guru.
* **Scoped Teacher Roles:** Guru tidak dapat membypass sistem (terdapat perlindungan 403 Forbidden). Guru hanya dapat mengelola siswa, membuat kelas, atau membuat mata pelajaran yang telah diizinkan oleh Super Admin.
* **Bulk Import/Export:** Penambahan data masif melalui templat XLSX.

### 3.3 Manajemen Ujian & Soal (Exam Management)
* **Pembuatan Ujian:** Parameter mencakup Tipe Ujian, Mata Pelajaran, Target Kelas, dan Durasi.
* **Token Ujian Dinamis:** Otomatis menghasilkan 5 karakter token unik (contoh: `A4XZ9`).
* **Dukungan Multimedia (Image Upload):** 
  * Guru dapat mengunggah gambar untuk bagian pertanyaan maupun untuk opsi jawaban (A, B, C, D). 
  * **Client-side Compression:** Gambar raksasa (5MB+) otomatis dikecilkan (*resize* 800px & *quality* 70%) di dalam *browser* menggunakan Canvas menjadi ukuran ~50KB sebelum dikirim ke server.
  * Terdapat kolom URL gambar untuk impor menggunakan *Template* Excel.
* **Weighted Scoring:** Bobot persentase per opsi jawaban (Misal: A=100%, B=80%, C=60%, D=0).

### 3.4 Penilaian Esai Otomatis Bertenaga AI (Gemini AI Scoring)
* **Dynamic Model Selection (Smart AI Routing):** Sistem mendistribusikan beban penilaian ke versi Gemini yang paling efisien: 3.5 Flash-Lite, 3.8 Flash, atau 3.1 Pro berdasarkan panjang jawaban dan kompleksitas rubrik.
* **Penilaian Berbasis Rubrik:** AI membandingkan jawaban dengan kunci referensi guru, menghasilkan skor beserta alasan (berformat JSON).

### 3.5 Portal Ujian Siswa (Student Exam Interface)
* **Token Gate:** Validasi token, status ujian, dan izin kelas.
* **Mobile-Responsive UI:** Antarmuka disesuaikan sempurna untuk PC maupun layar HP yang sempit. Gambar dan opsi tampil rapi dan proporsional.
* **Fisher-Yates Shuffle:** Urutan soal diacak secara *real-time* (Server-side).

### 3.6 Sistem Anti-Kecurangan (Anti-Cheat Wrapper)
* **Disable Context Menu & Copy-Paste:** Mencegah klik kanan dan manipulasi teks.
* **3-Strike Tab-Out Policy:** Mendeteksi navigasi ke luar tab/aplikasi (*blur*). Ujian otomatis dikumpulkan (*auto-submit*) jika melanggar batas maksimal 3 kali.
* **Mobile Debounce Fix:** Sistem dirancang tahan terhadap *bug event double-firing* pada peramban seluler (seperti Safari iPhone dan Chrome Android) saat siswa tidak sengaja menyentuh bilah notifikasi.

### 3.7 Pelaporan Nilai (Analytics & Reporting)
* **Unified Score Calculation:** Penggabungan otomatis nilai Pilihan Ganda dan *AI Scoring* Esai.
* **Live Grading Status:** *Progress Bar* antrean penilaian AI.

---

## 4. Konfigurasi Sistem & API Environment

* **Layanan Utama:** Google AI Studio (Gemini API)
* **Production API Key:** `[REDACTED_API_KEY_SECURED_IN_VERCEL]`
*(Catatan Keamanan Elite Sentinel Cybercorp: Pastikan variabel ini disimpan secara aman di *secrets manager* saat *deployment* ke *cloud*).*

---

## 5. Keunggulan Arsitektur (Non-Functional Requirements)
* **Zero Waterfall:** Penggunaan `Promise.all()` mencegah efek *waterfall*, menjadikan navigasi 3x lebih cepat (SPA-like experience).
* **Database Resilience:** Sistem arsitektur kebal terhadap *Cold Start* pada ekosistem *serverless* dan efisien secara ukuran (kompresi gambar).
* **UI/UX Premium:** Palet *Dark Mode* modern bergaya *cyberpunk*, memanfaatkan efek *blur backdrops* untuk tampilan aplikasi portal yang kokoh dan berkelas.