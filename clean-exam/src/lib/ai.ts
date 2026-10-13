import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = process.env.GEMINI_API_KEY;
const gatewayUrl = process.env.AI_GATEWAY_URL;
const gatewayKey = process.env.AI_GATEWAY_KEY;

if (!geminiApiKey && (!gatewayUrl || !gatewayKey)) {
  console.warn("Neither GEMINI_API_KEY nor AI_GATEWAY_URL/KEY is set. AI Features will not work.");
}

async function gradeWithGemini(prompt: string): Promise<{ score: number; reason: string }> {
  const genAI = new GoogleGenerativeAI(geminiApiKey!);
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().trim();
  
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Respons Gemini bukan JSON valid: ${text.substring(0, 40)}...`);
  }
  const parsed = JSON.parse(match[0]);
  const rawScore = typeof parsed.score === "number" ? parsed.score : parseFloat(String(parsed.score || 0));
  const finalScore = isNaN(rawScore) ? 0 : Math.min(100, Math.max(0, Math.round(rawScore * 100) / 100));
  return {
    score: finalScore,
    reason: parsed.reason || "Dinilai oleh Google Gemini AI"
  };
}

export async function gradeEssay(questionText: string, referenceAnswer: string, studentAnswer: string): Promise<{score: number, reason: string}> {
  if (!studentAnswer || studentAnswer.trim() === "") {
    return { score: 0, reason: "Tidak ada jawaban (kosong)." };
  }

  const currentGatewayUrl = process.env.AI_GATEWAY_URL;
  const currentGatewayKey = process.env.AI_GATEWAY_KEY;
  const currentGeminiKey = process.env.GEMINI_API_KEY;
  const currentModel = process.env.AI_GATEWAY_MODEL || "test-cbt";

  if (!currentGeminiKey && (!currentGatewayUrl || !currentGatewayKey)) {
    return { score: 0, reason: "GAGAL: API Key Gateway AI (AI_GATEWAY_KEY) atau URL belum dipasang di Vercel/Lingkungan Anda." };
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


  // 1. Coba gunakan Google Gemini SDK jika GEMINI_API_KEY tersedia dan AI_PROVIDER === 'gemini'
  if (currentGeminiKey && process.env.AI_PROVIDER === "gemini") {
    let lastGeminiError: any = null;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await gradeWithGemini(prompt);
      } catch (error: any) {
        console.error(`Gemini AI Scoring Error (Attempt ${attempt}/${maxRetries}):`, error);
        lastGeminiError = error;
        if (attempt < maxRetries) {
          await new Promise(res => setTimeout(res, 2000));
        }
      }
    }
    if (!currentGatewayUrl || !currentGatewayKey) {
      return { score: 0, reason: `Gagal memproses penilaian Gemini AI: ${lastGeminiError?.message || "Kesalahan Google Gemini"}` };
    }
    console.warn("Gemini gagal setelah 3 percobaan, mencoba fallback ke 9Router / AI Gateway...");
  }

  // 2. Gunakan OpenAI-Compatible Gateway (9Router, Groq, dll.)
  let lastGatewayError = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(currentGatewayUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentGatewayKey}`,
        },
        body: JSON.stringify({
          model: currentModel, 
          stream: false,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || errData?.message || response.statusText || "AI Gateway HTTP Error");
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]) {
        throw new Error(data.error?.message || "Format respons tidak valid dari AI Gateway");
      }

      const rawText = data.choices[0].message?.content || "";
      const cleanText = rawText
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim();
      
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (!match) {
        if (cleanText.includes("<none>")) {
          return { score: 0, reason: "Sistem AI tidak dapat menilai (Respons kosong). Silakan nilai manual." };
        }
        throw new Error(`Respons AI bukan JSON: ${cleanText.substring(0, 40)}...`);
      }
      
      const parsed = JSON.parse(match[0]);
      const rawScore = typeof parsed.score === 'number' ? parsed.score : parseFloat(String(parsed.score || 0));
      const finalScore = isNaN(rawScore) ? 0 : Math.min(100, Math.max(0, Math.round(rawScore * 100) / 100));
      return {
        score: finalScore,
        reason: parsed.reason || "Dinilai oleh AI"
      };
    } catch (error: any) {
      console.error(`AI Gateway Scoring Error (Attempt ${attempt}/${maxRetries}):`, error);
      lastGatewayError = error;
      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 2000));
      }
    }
  }

  // 3. Fallback ke Gemini jika gateway gagal dan GEMINI_API_KEY ada
  if (currentGeminiKey && process.env.AI_PROVIDER !== "gemini") {
    try {
      console.log("Mencoba fallback ke Gemini SDK...");
      return await gradeWithGemini(prompt);
    } catch (gErr: any) {
      console.error("Gemini Fallback juga gagal:", gErr);
    }
  }

  return { score: 0, reason: `Gagal memproses penilaian: ${lastGatewayError?.message || "Kesalahan Gateway AI"}` };
}
