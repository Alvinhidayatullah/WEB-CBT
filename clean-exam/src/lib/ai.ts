const gatewayUrl = process.env.AI_GATEWAY_URL;
const gatewayKey = process.env.AI_GATEWAY_KEY;

if (!gatewayUrl || !gatewayKey) {
  console.warn("AI_GATEWAY_URL or AI_GATEWAY_KEY is not set. AI Features will not work.");
}

export async function gradeEssay(questionText: string, referenceAnswer: string, studentAnswer: string): Promise<{score: number, reason: string}> {
  if (!gatewayUrl || !gatewayKey) {
    return { score: 0, reason: "GAGAL: API Key 9Router (AI_GATEWAY_KEY) atau URL belum dipasang di Vercel/Lingkungan Anda." };
  }

  const prompt = `Anda adalah sistem penilai ujian CBT yang cerdas, tegas, dan akurat.
Tugas Anda membaca soal dan mengevaluasi jawaban siswa berdasarkan Kunci Jawaban Referensi.
Anda harus mengakumulasikan tingkat kebenaran sesuai bobot nilai (persentase). 
Gunakan pedoman persentase berikut (0%, 20%, 40%, 60%, 80%, 100%):
- 0%: Jawaban kosong atau sama sekali salah / tidak relevan.
- 20-40%: Menjawab sebagian kecil dengan benar, tapi mayoritas salah.
- 60%: Menjawab setengah benar.
- 80%: Jawaban hampir sempurna, ada sedikit yang kurang tepat.
- 100%: Jawaban sempurna, akurat, dan sesuai dengan kunci.

Berikan nilai akhir berupa angka bulat dari 0 hingga 100.
Pastikan HANYA menghasilkan output JSON murni tanpa ada embel-embel teks markdown (\`\`\`json).

Format Output:
{
  "score": 80,
  "reason": "Penjelasan singkat mengapa diberi persentase tersebut (1 kalimat)"
}

Pertanyaan: ${questionText}
Kunci Jawaban Referensi: ${referenceAnswer || "Jawaban yang logis dan relevan dengan pertanyaan"}
Jawaban Siswa: ${studentAnswer}
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

    let text = data.choices[0].message.content.trim();
    
    if (text.startsWith("\`\`\`json")) text = text.substring(7);
    if (text.startsWith("\`\`\`")) text = text.substring(3);
    if (text.endsWith("\`\`\`")) text = text.substring(0, text.length - 3);
    text = text.trim();
    
    const parsed = JSON.parse(text);
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      reason: parsed.reason || "Dinilai oleh AI"
    };
  } catch (error: any) {
    console.error("AI Gateway Scoring Error:", error);
    return { score: 0, reason: `Gagal memproses penilaian: ${error.message || "Kesalahan Gateway 9Router"}` };
  }
}
