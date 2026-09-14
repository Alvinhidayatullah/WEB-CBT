const gatewayUrl = process.env.AI_GATEWAY_URL;
const gatewayKey = process.env.AI_GATEWAY_KEY;

if (!gatewayUrl || !gatewayKey) {
  console.warn("AI_GATEWAY_URL or AI_GATEWAY_KEY is not set. AI Features will not work.");
}

export async function gradeEssay(questionText: string, referenceAnswer: string, studentAnswer: string): Promise<{score: number, reason: string}> {
  if (!gatewayUrl || !gatewayKey) {
    return { score: 0, reason: "AI Gateway config missing." };
  }

  const prompt = `Anda adalah sistem penilai ujian CBT yang tegas dan akurat.
Tugas Anda menilai jawaban siswa berdasarkan Kunci Jawaban Referensi.
Berikan nilai dari 0 hingga 100.
Pastikan HANYA menghasilkan output JSON murni tanpa ada embel-embel teks markdown (\`\`\`json).

Format Output:
{
  "score": 85,
  "reason": "Penjelasan sangat singkat (1 kalimat) tentang penilaian"
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
        model: "gemini/gemini-1.5-flash", // Default 9Router Gemini Model
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
      throw new Error(`AI Gateway Error: ${response.statusText}`);
    }

    const data = await response.json();
    let text = data.choices[0].message.content.trim();
    
    if (text.startsWith("\`\`\`json")) text = text.substring(7);
    if (text.startsWith("\`\`\`")) text = text.substring(3);
    if (text.endsWith("\`\`\`")) text = text.substring(0, text.length - 3);
    
    const parsed = JSON.parse(text);
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      reason: parsed.reason || "Dinilai oleh AI"
    };
  } catch (error) {
    console.error("AI Gateway Scoring Error:", error);
    return { score: 0, reason: "Gagal memproses penilaian via 9Router Gateway." };
  }
}
