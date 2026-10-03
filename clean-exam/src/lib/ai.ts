const gatewayUrl = process.env.AI_GATEWAY_URL;
const gatewayKey = process.env.AI_GATEWAY_KEY;

if (!gatewayUrl || !gatewayKey) {
  console.warn("AI_GATEWAY_URL or AI_GATEWAY_KEY is not set. AI Features will not work.");
}

export async function gradeEssay(questionText: string, referenceAnswer: string, studentAnswer: string): Promise<{score: number, reason: string}> {
  if (!gatewayUrl || !gatewayKey) {
    return { score: 0, reason: "GAGAL: API Key 9Router (AI_GATEWAY_KEY) atau URL belum dipasang di Vercel/Lingkungan Anda." };
  }

  if (!studentAnswer || studentAnswer.trim() === "") {
    return { score: 0, reason: "Tidak ada jawaban (kosong)." };
  }

  const prompt = `Kamu adalah guru evaluator profesional yang sangat suportif, empatik, dan rendah hati. Tugasmu adalah menilai jawaban esai siswa dengan skala 0 hingga 100.
Tujuan utamamu adalah MENGHARGAI USAHA siswa yang sudah mau menjawab. Jangan terlalu strict (kaku).

Pedoman Penilaian Kritis & Apresiatif:
- Toleransi Bahasa (SANGAT PENTING): Jika pertanyaan dalam bahasa Inggris, Sunda, Arab, atau bahasa daerah lainnya, namun siswa menjawab menggunakan Bahasa Indonesia (atau campuran), JAWABAN TERSEBUT MASIH BISA DIHARGAI dengan bobot nilai yang cukup tinggi asalkan inti maknanya mengarah ke jawaban yang benar. Jangan memberi nilai 0 hanya karena beda bahasa.
- 80 - 100 (Sangat Baik / Baik): Siswa menangkap inti konsep dari kunci jawaban. Kesalahan tata bahasa, salah eja, atau perbedaan bahasa sama sekali tidak masalah asalkan maknanya relevan.
- 50 - 79 (Cukup / Menghargai Usaha): Jawaban meleset sebagian dari kunci, namun siswa berhasil menunjukkan nalar atau menyentuh sebagian konteks. Hargai proses berpikirnya. Berikan nilai yang seimbang.
- 20 - 49 (Kurang): Jawaban mayoritas melantur, namun siswa masih berusaha menuliskan sesuatu yang bersinggungan sedikit saja dengan topik. Berikan poin apresiasi atas usahanya menjawab.
- 0 - 19 (Sangat Kurang): Hanya diberikan jika jawaban 100% kosong, berisi kata-kata kasar, atau sama sekali tidak ada hubungannya dengan soal (misal: "tidak tahu").

Kembalikan output HANYA dalam format JSON murni tanpa tag atau markdown tambahan lainnya. JANGAN pernah menghasilkan teks seperti <none>.

Format Output:
{
  "score": X,
  "reason": "Penjelasan apresiatif dan membangun..."
}

Pertanyaan:
\`\`\`
${questionText}
\`\`\`

Kunci Jawaban Referensi:
\`\`\`
${referenceAnswer || "Jawaban yang logis dan relevan dengan pertanyaan"}
\`\`\`

Jawaban Siswa:
\`\`\`
${studentAnswer}
\`\`\`
`;

  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || "test-cbt", // Default 9Router model as tested via curl
        stream: false,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        // response_format: { type: "json_object" } // Optional depending on gateway support
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error?.message || errData?.message || response.statusText || "AI Gateway HTTP Error");
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error(data.error?.message || "Invalid response format from 9Router Gateway");
    }

    const text = data.choices[0].message.content.trim();
    
    // Gunakan Regex untuk mengekstrak hanya bagian JSON (mengabaikan tag <thinking> dsb)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      if (text.includes("<none>")) {
        return { score: 0, reason: "Sistem AI tidak dapat menilai (Respons kosong). Silakan nilai manual." };
      }
      throw new Error(`Respons AI bukan JSON: ${text.substring(0, 40)}...`);
    }
    
    const parsed = JSON.parse(match[0]);
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      reason: parsed.reason || "Dinilai oleh AI"
    };
  } catch (error: any) {
    console.error("AI Gateway Scoring Error:", error);
    return { score: 0, reason: `Gagal memproses penilaian: ${error.message || "Kesalahan Gateway 9Router"}` };
  }
}
