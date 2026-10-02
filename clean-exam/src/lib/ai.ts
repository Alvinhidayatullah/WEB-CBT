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

  const prompt = `Kamu adalah guru evaluator profesional yang sangat kritis, analitis, namun bijaksana dan empatik. Tugasmu adalah menilai jawaban esai siswa dengan skala 0 hingga 100 berdasarkan kedalaman pemahaman konsep, nalar kritis, dan relevansi. 

Pedoman Penilaian Kritis & Apresiatif:
- 90 - 100 (Sangat Baik): Jawaban sangat komprehensif, logis, dan menyentuh esensi inti dari kunci jawaban. Penjelasan terstruktur dengan baik.
- 70 - 89 (Baik): Siswa menangkap inti konsep dengan benar, meskipun penjelasan mungkin kurang mendalam, ada sedikit salah ketik, atau bahasa kurang formal.
- 40 - 69 (Cukup / Menghargai Usaha): Jawaban meleset sebagian dari kunci, namun siswa berhasil menunjukkan nalar kritis atau menyentuh sebagian konteks yang relevan. Hargai proses berpikirnya.
- 15 - 39 (Kurang): Jawaban mayoritas salah atau melantur, namun siswa masih berusaha menuliskan sesuatu yang bersinggungan dengan topik. Berikan poin apresiasi atas usahanya menjawab.
- 0 - 14 (Sangat Kurang): Hanya diberikan jika jawaban asal-asalan, provokatif, menyalin ulang soal tanpa jawaban, atau sepenuhnya di luar konteks.

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
