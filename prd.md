# Product Requirement Document (PRD)
## Sistem Aplikasi Ujian Sekolah Digital Modern & Aman (CleanExam)

---

## 1. Ringkasan Eksekutif & Tujuan Produk
CleanExam adalah platform CBT (*Computer Based Test*) berbasis web yang dirancang untuk kebutuhan sekolah modern. Platform ini mengutamakan **keamanan mutlak (mengacu pada standar OWASP Top 10)**, **antarmuka minimalis yang bebas distraksi**, dan **kecepatan rendering maksimal** menggunakan Next.js (App Router), TypeScript, dan Tailwind CSS.

### Utama Arsitektur Performa
* **10x Lebih Cepat:** Memanfaatkan Next.js *Server Components* untuk mereduksi beban JavaScript di browser siswa, serta strategi pemisahan komponen statis (teks soal) dan komponen dinamis kecil (timer) untuk mencegah *mass re-rendering*.
* **Visual Style:** Menggunakan tema *Simple & Clean Academic* (dominasi warna latar belakang `bg-slate-50`, teks `text-slate-900`, dan aksen formal `bg-blue-600`) untuk mengurangi kelelahan mata siswa selama ujian.

---

## 2. Manajemen Pengguna & Hak Akses (Multi-Role)

Sistem mengadopsi prinsip *Least Privilege* di mana pengguna hanya memiliki akses ke data yang benar-benar mereka butuhkan.

### Kredensial Bawaan (Default Seed)
* **Super Admin Role:**
  * **Username:** `vinz_admin`
  * **Password:** `vinz_cbt` *(Catatan: Wajib disimpan dalam bentuk hash bcrypt/argon2id di database).*

### Matriks Otorisasi Pengguna
1. **Super Admin (`vinz_admin`)**
   * Akses penuh ke seluruh sistem, statistik, dan log keamanan.
   * **Hak Eksklusif:** Membuat, mengedit, dan menghapus akun **Guru**.
   * Dapat membuat dan mengelola akun **Murid**.
   * Dapat melihat rekap nilai seluruh kelas secara real-time.
2. **Guru**
   * Membuat bank soal, memaketkan ujian, dan menentukan durasi waktu.
   * Membuat dan mengelola akun **Murid** untuk kelas binarannya.
   * Menghasilkan (*generate*) **Token Ujian** spesifik per kelas.
   * Memantau ruang ujian (*live proctoring*) dan melihat nilai murid di kelasnya.
3. **Murid**
   * Mengakses ruang ujian setelah login resmi.
   * Memasukkan token ujian kelas spesifik untuk membuka soal.
   * Mengerjakan ujian dengan sistem yang terkunci (*secure sandbox browser environment*).

---

## 3. Fitur Keamanan Mutlak (OWASP Top 10 Alignment)

Aplikasi ini mengimplementasikan mitigasi keamanan ketat di sisi Frontend dan Backend untuk mencegah kecurangan dan kebocoran data:

* **A01:2021-Broken Access Control (Proteksi API & Halaman)**
  * Menggunakan *Middleware* Next.js untuk memvalidasi sesi. Murid tidak dapat mengakses endpoint API milik Guru atau Admin (`/api/admin/*` atau `/api/teacher/*`) meskipun mencoba menembak URL secara langsung (mengembalikan status `403 Forbidden`).
* **A03:2021-Injection (Anti-SQLi & XSS)**
  * Seluruh query database wajib menggunakan *parameterized queries* via ORM (Prisma/Drizzle).
  * Input teks soal dari guru akan di-*escape* secara otomatis oleh Next.js untuk mencegah *Stored XSS*.
* **A07:2021-Identification and Authentication Failures (Anti-Brute Force)**
  * Sesi login menggunakan token JWT yang disimpan di dalam **HttpOnly, Secure, SameSite=Strict Cookie** untuk menghindari pencurian token lewat skrip jahat (XSS).
  * Mekanisme *Rate Limiting* diterapkan pada halaman login dan input token (maksimal 5 kali percobaan gagal per 1 menit sebelum diblokir sementara).
* **Anti-Cheat Engine (Client-Side Protection)**
  * **Window Focus & Visibility Tracker:** Sistem mendeteksi pergantian tab atau penutupan window browser menggunakan `document.visibilityState` dan event `blur`. 
  * **Toleransi Pelanggaran:** Batas keluar halaman maksimal 3 kali. Pada pelanggaran ke-4, ujian otomatis terkunci dan melakukan *Auto-Submit* dengan status "Terindikasi Curang".
  * **Input Blocker:** Mematikan fungsi klik kanan (*Context Menu*), fitur salin-tempel (`Ctrl+C / V`), dan memblokir shortcut *Inspect Element* (`F12`, `Ctrl+Shift+I`).

---

## 4. Logika Bisnis & Sistem Penilaian

### A. Manajemen Token Berbasis Kelas
* Token bersifat unik dan terikat secara relasional dengan ID Kelas (Contoh: Token untuk kelas 7A tidak akan bisa digunakan oleh murid dari kelas 7B).
* Token memiliki parameter waktu kedaluwarsa (*session expired time*) yang diatur oleh guru/admin saat menjadwalkan ujian.

### B. Algoritma Pengacakan (Secure Shuffling)
* Proses pengacakan urutan soal DAN urutan opsi pilihan ganda (A, B, C, D, E) dilakukan **100% di sisi Server** menggunakan algoritma *Fisher-Yates Shuffle* sebelum payload JSON dikirim ke frontend.
* Setiap siswa akan menerima urutan tampilan yang unik berdasarkan kombinasi `Siswa_ID` dan `Sesi_Ujian_ID`.

### C. Logika Akumulasi Nilai (Skala Maksimal 100)
Kalkulasi nilai dilakukan murni di sisi Server setelah siswa menekan tombol submit (atau terkena penalti *anti-cheat*). Frontend tidak boleh mengirimkan variabel nilai/skor ke server untuk mencegah *Parameter Tampering*.

**Rumus Utama:**
$$\text{Nilai Akhir} = \left( \frac{\text{Jumlah Jawaban Benar}}{\text{Total Soal Ujian}} \right) \times 100$$

* Sistem secara otomatis menghitung nilai secara presisi menjadi skala 100, berapapun jumlah soalnya (baik 20, 50, atau $N$ soal). Jika benar semua, nilai mutlak 100.
* Output nilai disimpan menggunakan tipe data pecahan dengan dua angka di belakang koma (`.toFixed(2)`).

---

## 5. Alur Kerja Sistem (Flowchart Logic)
[ Halaman Utama / Login Unified ]
│
▼
[ Input Kredensial Akun ] ──► (Server: Cek Hash Bcrypt & Rate Limit)
│
┌────────┴────────────────────────────────────────┐
▼ Benar                                           ▼ Salah
[ Baca Role & Redirect ]                         [ Tampilkan Error Umum ]
├──► SUPER_ADMIN ──► Halaman /admin/dashboard
├──► GURU        ──► Halaman /teacher/dashboard
└──► MURID       ──► Halaman /student/dashboard
│
▼ (Alur Murid)
[ Input Token Ujian ]
│
(Server Validasi Token & Kelas Murid)
├──► [ Tidak Valid / Salah Kelas ] ──► Tampilkan Error Akses
│
▼ Valid
[ Ambil Soal: Server Acak Soal & Pilihan ]
│
▼
[ Layar Ujian Aktif (Full Clean UI) ]
│
┌─────────┴────────────────────────────────────────┐
▼                                                  ▼
[ Siswa Memilih Jawaban ]                     [ Deteksi Keluar Tab / Blur ]
│                                                  │
▼                                                  ▼
[ Auto-Save ke Cache Server ]                 [ Hitung Pelanggaran +1 ]
│                                                  │
│                                       (Apakah Pelanggaran > 3?)
│                                                  ├──► YA  ──► [ Auto-Submit & Blokir ]
│                                                  └──► TDK ──► [ Pop-up Peringatan ]
▼                                                                         │
[ Klik Selesai / Waktu Habis ] ◄───────────────────────────────────────────────┘
│
▼
[ Server Hitung Nilai Skala 100 ] ──► [ Simpan DB: Super Admin & Guru bisa Cek Nilai ]

---

## 6. Spesifikasi Teknis & Lingkungan Pengembangan
* **Framework Utama:** Next.js 15 (App Router Architecture)
* **Bahasa Pemrograman:** TypeScript (`.tsx`) dengan mode *Strict Type Checking* untuk menjamin keamanan tipe data soal dan jawaban.
* **Styling Engine:** Tailwind CSS (Menggunakan palet warna bawaan: `slate`, `zinc`, dan `blue`).
* **Sesi & Autentikasi:** JWT (*Json Web Token*) dienkripsi dengan *secret key* lingkungan internal lingkungan server.