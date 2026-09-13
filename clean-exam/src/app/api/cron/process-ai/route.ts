import prisma from "@/lib/prisma";
import { gradeEssay } from "@/lib/ai";
import { NextResponse } from "next/server";

// Endpoint ini bisa dipanggil oleh cron job eksternal (Vercel Cron) atau manual
export async function GET() {
  try {
    // 1. Ambil maksimal 5 job PENDING agar tidak timeout
    const jobs = await prisma.jobQueue.findMany({
      where: { status: "PENDING", type: "AI_GRADING" },
      take: 5,
    });

    if (jobs.length === 0) {
      return NextResponse.json({ message: "No pending jobs." });
    }

    // 2. Tandai sebagai PROCESSING
    await prisma.jobQueue.updateMany({
      where: { id: { in: jobs.map(j => j.id) } },
      data: { status: "PROCESSING" }
    });

    // 3. Proses setiap job
    for (const job of jobs) {
      try {
        const payload = JSON.parse(job.payload);
        const { examResultId, essays } = payload;
        
        let totalEssayScore = 0;
        let aiFeedbacks: string[] = [];

        for (const essay of essays) {
          const { questionText, referenceAnswer, studentAnswer, weight } = essay;
          
          if (!studentAnswer || studentAnswer.trim() === "") {
            aiFeedbacks.push(`Soal: ${questionText} - Kosong (Skor: 0)`);
            continue;
          }

          const result = await gradeEssay(questionText, referenceAnswer, studentAnswer);
          
          // Konversi skor (0-100) menjadi berdasarkan bobot (weight) soal
          const weightedScore = (result.score / 100) * weight;
          totalEssayScore += weightedScore;
          
          aiFeedbacks.push(`Soal: ${questionText} - AI Score: ${result.score}/100. Alasan: ${result.reason}`);
        }

        // 4. Update ExamResult
        await prisma.examResult.update({
          where: { id: examResultId },
          data: {
            essayScore: totalEssayScore,
            aiFeedback: aiFeedbacks.join("\\n\\n"),
            gradingStatus: "GRADED"
          }
        });

        // 5. Tandai Job Selesai
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: { status: "COMPLETED" }
        });

      } catch (err: any) {
        // Gagal per job
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: { status: "FAILED", error: err.message || "Unknown error" }
        });
      }
    }

    return NextResponse.json({ message: `Processed ${jobs.length} jobs.` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
