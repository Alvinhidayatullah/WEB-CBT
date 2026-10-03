# SecureCBT 🚀

SecureCBT adalah sebuah sistem Computer-Based Test (CBT) modern, super responsif, dan sangat aman, dibangun menggunakan **Next.js 14**, **Prisma**, dan **TailwindCSS**. Aplikasi ini dirancang khusus untuk memfasilitasi ujian online skala kecil hingga menengah dengan beragam perlindungan anti-kecurangan mutakhir. 

Dilengkapi dengan koreksi esai otomatis oleh Artificial Intelligence (Gemini AI), SecureCBT tidak hanya memudahkan guru dalam membuat soal, tetapi juga menghemat waktu berharga dalam mengoreksi ratusan esai secara real-time!

---

## ✨ Fitur Unggulan

### 🛡️ Smart Anti-Cheat System (WAF & Client Protection)
- **Zero-Tolerance Bypass:** Deteksi jika siswa berpindah tab, *minimize* browser, atau mencoba menekan *Back/Refresh*. 
- **Auto-Submit Hukuman:** Jika pelanggaran mencapai batas maksimum (3 kali), sistem akan langsung mensubmit ujian tersebut secara instan tanpa dialog browser, dan token akan hangus!
- **Keyboard & Mouse Lock:** Mematikan fungsi klik kanan (Context Menu), Copy-Paste, F12, dan fungsi *View Source*.
- **Token Sekali Pakai:** Setiap token ujian hanya berlaku 1 kali untuk 1 siswa. Setelah dipakai dan siswa masuk, token otomatis terkunci.

### 🤖 AI-Powered Essay Grading
Bosan mengoreksi ratusan esai secara manual?
SecureCBT telah terintegrasi dengan Google Gemini AI untuk mengoreksi jawaban esai siswa secara otomatis di balik layar.
- **Background Processing:** Proses berjalan di *background worker*, mencegah *server timeout* saat mensubmit ratusan jawaban secara bersamaan.
- **Smart Rubrics:** Anda bisa menyematkan kunci referensi esai. AI akan membaca referensi Anda dan memberikan nilai serta komentar mendalam (Feedback) langsung kepada siswa!

### 📊 Real-Time Zero-Load Dashboard
- **Live Timer Monitor:** Memantau waktu ujian siswa yang sedang mengerjakan ujian secara langsung (*real-time counting*) di Dasbor Admin tanpa membebani *database* maupun *server* (0 Server Load).
- **Export to Excel:** Hasil akhir, lengkap dengan rincian PG, Esai, serta Status (Selesai/Curang), dapat diunduh menjadi file XLSX secara rapi.

### 🎨 Premium & Responsive UI
- **Glassmorphism Design:** Antarmuka ujian yang bersih, modern, dan tidak kaku.
- **Mobile First:** Tata letak disesuaikan dengan cerdas di HP. Logo, waktu ujian, peta tombol soal, hingga peringatan anti-curang merespons mulus di segala ukuran layar tanpa patah (*no bleed*).

### 📈 Alur Kerja Sistem (Workflow)
```mermaid
graph TD
    A[Admin / Guru] -->|Membuat Ujian| B(Sistem Ujian)
    B -->|Menghasilkan Token Unik| C[Token Ujian]
    D[Siswa] -->|Memasukkan Token| C
    C -->|Validasi Sukses| E{Mengerjakan Ujian}
    
    E -->|Mencoba Curang| F[Pelanggaran Bertambah]
    F -->|Pelanggaran Ke-3| G[Auto Submit & Kick]
    
    E -->|Selesai & Kumpul| H(Pemrosesan Nilai)
    G --> H
    
    H -->|Pilihan Ganda| I[Koreksi Sistem Otomatis]
    H -->|Soal Esai| J[Dikirim ke Gemini AI]
    
    I --> K[Daftar Nilai Akhir]
    J -->|Rubrik & Analisis AI| K
    
    K -->|Unduh Excel| L[Laporan Guru/Admin]
```

---

## 🛠️ Stack Teknologi

- **Frontend / Framework:** Next.js 14 (App Router), React 18
- **Styling:** TailwindCSS (dengan utilitas kustom animasi)
- **Backend / ORM:** Prisma Client
- **Database:** PostgreSQL (Atau database SQL lainnya yang didukung Prisma)
- **Icons:** Lucide-React
- **AI Integration:** `@google/genai` (Gemini API)

---

## 🚀 Panduan Instalasi & Menjalankan

1. **Clone Repositori:**
   ```bash
   git clone https://github.com/Alvinhidayatullah/WEB-CBT.git
   cd clean-exam
   ```

2. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment:**
   Buat file `.env` di dalam folder *root* proyek Anda, lalu isi dengan kunci rahasia berikut:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/cbt_db"
   JWT_SECRET="rahasia_super_aman_anda"
   GEMINI_API_KEY="api_key_gemini_anda"
   CRON_SECRET="kunci_rahasia_cron_job"
   ```

4. **Siapkan Database (Prisma):**
   Mendorong skema ke database dan melakukan seeding data dasar (Admin):
   ```bash
   npx prisma db push
   npx prisma generate
   npm run seed
   ```
   *(Akun admin utama akan otomatis terbuat ketika proses seeding selesai)*

5. **Jalankan Server Lokal (Development):**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` di peramban (browser) Anda.

---

## 👨‍💻 Kontribusi

Proyek ini dibangun dari dasar dengan filosofi keamanan dan kecepatan. Pembaharuan, *pull request*, maupun laporan (*bug*) sangat kami hargai!

*Didesain dan dikembangkan oleh Alvin Hidayatullah*
