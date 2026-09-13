import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI Features will not work.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function gradeEssay(questionText: string, referenceAnswer: string, studentAnswer: string): Promise<{score: number, reason: string}> {
  if (!genAI) {
    return { score: 0, reason: "AI API Key not configured." };
  }

  // Smart Routing: Flash for standard grading (fast and effective)
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Anda adalah asisten guru yang ahli. 
Tugas Anda adalah menilai jawaban siswa berdasarkan pertanyaan dan kunci referensi.
Berikan nilai dari 0 hingga 100.
Jawab dengan format JSON murni TANPA markdown block, dengan struktur:
{
  "score": 85,
  "reason": "Alasan singkat mengapa nilai tersebut diberikan"
}

Pertanyaan: ${questionText}
Kunci Jawaban Referensi: ${referenceAnswer || "Jawaban yang logis dan relevan dengan pertanyaan"}
Jawaban Siswa: ${studentAnswer}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // Bersihkan dari block markdown jika ada
    if (text.startsWith("\`\`\`json")) {
      text = text.substring(7);
    }
    if (text.endsWith("\`\`\`")) {
      text = text.substring(0, text.length - 3);
    }
    
    const parsed = JSON.parse(text);
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      reason: parsed.reason || "Dinilai oleh AI"
    };
  } catch (error) {
    console.error("AI Grading Error:", error);
    return { score: 0, reason: "Gagal memproses penilaian AI karena error server." };
  }
}
