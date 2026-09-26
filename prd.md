# Product Requirements Document (PRD)

**Product Name:** Secure-CBT  
**Vendor/Developer:** Elite Sentinel Cybercorp  
**Version:** 1.4 (Beta - AI Gateway & Proxy Integration)  
**Document Status:** Final  

---

## 1. Pendahuluan

### 1.1 Tujuan Produk
Secure-CBT adalah platform *Computer-Based Test* (Ujian Berbasis Komputer) modern yang dirancang untuk menjadi sangat aman, cepat, dan mudah digunakan. Sistem ini dibangun khusus untuk institusi pendidikan agar dapat menyelenggarakan ujian dengan fitur anti-kecurangan yang ketat, dukungan unggah media (gambar) yang ringan, manajemen data masif via Excel, dan sistem penilaian esai yang otomatis dan fleksibel dengan bantuan AI.

### 1.2 Target Pengguna (Personas)
1. **SUPER_ADMIN**: Pemilik sistem atau administrator IT. Memiliki hak penuh atas seluruh manajemen data pengguna dan sistem.
2. **GURU (Teacher)**: Tenaga pendidik yang bertugas membuat soal, mengunggah gambar pendukung, mendistribusikan token ujian, mengatur parameter rubrik AI, dan memonitor hasil ujian.
3. **MURID (Student)**: Peserta ujian yang mengakses portal ujian menggunakan token unik.

---

## 2. Arsitektur & Teknologi (Tech Stack)

* **Frontend & Backend Framework:** Next.js 15 (App Router)
* **Styling:** Tailwind CSS (elemen UI/UX *Glassmorphism*, *Micro-animations*, & *Lucide Icons*)
* **Database & ORM:** PostgreSQL (Hosting via Neon Serverless) & Prisma ORM
* **Authentication:** Custom JWT via `jose`, tersandi `bcryptjs`, *HTTP-Only Secure Cookies*.
* **AI Engine & Gateway:** Google Gemini API yang dirutekan secara terpusat melalui proksi **9Router**. Mengisolasi kredensial utama dan mendistribusikan beban *request* agar antrean tidak macet.
* **Image Processing:** HTML5 Canvas API (Client-side Compression & Base64 encoding).

---

## 3. Fitur Utama (Core Features)

### 3.1 Otentikasi & Keamanan Tingkat Lanjut (WAF)
* **Stateful JWT Session & Auto-Kick:** Mencegah *Replay Attack*. Pembaruan *sessionVersion* otomatis memutus akses pengguna yang dicabut haknya secara *real-time*.
* **Anti-Cookie Injection:** Umur *cookie* dibatasi maksimal 24 Jam dengan parameter `SameSite=Strict`.
* **Payload Tamper Protection:** Validasi *Server Action* berbasis *RegEx* memblokir injeksi *malware* pada *form upload*.

### 3.2 Manajemen Pengguna & Ujian
* **Scoped Teacher Roles:** Proteksi otorisasi tingkat rute (403 Forbidden). Guru hanya dapat mengelola data sesuai wewenangnya.
* **Token Ujian Dinamis:** Otomatis menghasilkan 5 karakter token unik (contoh: `A4XZ9`).
* **Dukungan Multimedia:** Unggahan gambar untuk pertanyaan dan opsi otomatis dikompresi di sisi klien menjadi ~50KB.

### 3.3 Penilaian Esai Otomatis & Resolusi "Menunggu AI"
* **Asynchronous AI Queueing:** Mengatasi isu *bottleneck* (status "Menunggu AI" yang menggantung) dengan memisahkan *request* eksternal dari *thread* utama melalui integrasi *endpoint* proksi khusus.
* **Dynamic Model Selection:** 9Router mendistribusikan *payload* ujian ke model Gemini yang beroperasi paling optimal saat itu.
* **Penilaian Berbasis Rubrik:** AI mengurai jawaban siswa dan membandingkannya dengan referensi guru, memberikan hasil evaluasi berupa JSON terstruktur.

### 3.4 Sistem Anti-Kecurangan (Anti-Cheat Wrapper)
* **Disable Context Menu & Copy-Paste:** Mematikan klik kanan dan pintasan manipulasi teks.
* **3-Strike Tab-Out Policy:** Mendeteksi navigasi ke luar aplikasi. Jika melebihi 3 pelanggaran, sistem memicu *auto-submit*.
* **Mobile Debounce Fix:** Sistem kebal terhadap *double-firing* yang sering terjadi saat menyentuh bilah notifikasi di peramban seluler.

---

## 4. Konfigurasi Sistem & Integrasi 9Router

Karena aplikasi Anda berjalan di *cloud* (Vercel) sedangkan 9Router berjalan di *localhost* Ubuntu Anda, aplikasi Vercel tidak akan bisa membaca `http://localhost:20128`. Anda harus mengaktifkan **Tunnel** (fitur bawaan 9Router di menu *Endpoint*, atau menggunakan layanan seperti *ngrok* / *Cloudflare Tunnel*) untuk mendapatkan URL publik.

### 4.1 Environment Variables (Vercel)
Masukkan konfigurasi berikut ke dalam *Environment Variables* di *dashboard* Vercel Anda:

```env
# Gunakan URL Tunnel Publik dari 9Router, BUKAN localhost
AI_GATEWAY_URL=https://<alamat-tunnel-publik-anda>/v1/chat/completions

# Kunci API Lokal 9Router
AI_GATEWAY_KEY=sk-8859786fd662bfef-xoh3vh-0a012852

### 4.2 Script Eksekusi Penilaian (Next.js Server Action)

Implementasikan perutean standar OpenAI agar backend Secure-CBT menembak endpoint 9Router, bukan server Google secara langsung.

"use server";

export async function processEssayScoring(studentAnswer, referenceAnswer) {
  try {
    const response = await fetch(process.env.AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_GATEWAY_KEY}`, 
      },
      body: JSON.stringify({
        model: "gemini/gemini-1.5-flash", // Sesuaikan dengan ID model di 9Router
        messages: [
          {
            role: "system",
            content: "Anda adalah sistem penilai ujian Secure-CBT. Bandingkan jawaban siswa dengan kunci referensi. Berikan output format JSON yang berisi 'skor' (0-100) dan 'alasan'."
          },
          {
            role: "user",
            content: `Kunci Referensi: ${referenceAnswer}\nJawaban Siswa: ${studentAnswer}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway Timeout or Error`);
    }

    const data = await response.json();
    
    // Memperbarui status "Menunggu AI" di database menjadi "Selesai"
    return JSON.parse(data.choices[0].message.content);

  } catch (error) {
    console.error("Scoring failed:", error);
    return { score: 0, reason: "Koneksi ke AI Gateway terputus." };
  }
}

