import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { gradeEssay } from "../src/lib/ai";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const LOG_FILE = path.join(__dirname, "grade-all.log");

function log(msg: string) {
  const timestamp = new Date().toLocaleTimeString("id-ID");
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

async function gradeSingleStudent(result: any, index: number, total: number) {
  const studentName = result.student?.name || result.student?.username || "Siswa";
  const subject = result.exam.subject;
  const targetClass = result.exam.targetClass;
  log(`[${index + 1}/${total}] Memproses: ${studentName} | ${subject} (Kelas: ${targetClass})...`);

  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(result.answersJson || "{}");
  } catch {
    answers = {};
  }

  let totalMaxPG = 0;
  let totalEarnedPG = 0;
  let totalMaxEssay = 0;
  let totalEssayScore = 0;
  const aiFeedbacks: string[] = [];
  const essayQuestions: any[] = [];

  for (const q of result.exam.questions) {
    const studentAnswer = answers[q.id];
    if (q.type === "ESSAY") {
      const essayMaxW = q.weightA && q.weightA > 0 ? q.weightA : 100;
      totalMaxEssay += essayMaxW;
      essayQuestions.push({
        id: q.id,
        text: q.text,
        reference: q.essayReference || "",
        studentAnswer: studentAnswer || "",
        weight: essayMaxW,
      });
    } else {
      const maxW = Math.max(q.weightA || 0, q.weightB || 0, q.weightC || 0, q.weightD || 0);
      let wA = q.weightA || 0;
      let wB = q.weightB || 0;
      let wC = q.weightC || 0;
      let wD = q.weightD || 0;

      if (maxW === 0) {
        const legacyCorrect = (q as any).correctOption || "A";
        if (legacyCorrect === "B") wB = 100;
        else if (legacyCorrect === "C") wC = 100;
        else if (legacyCorrect === "D") wD = 100;
        else wA = 100;
      }

      const questionMax = Math.max(wA, wB, wC, wD, 100);
      totalMaxPG += questionMax;

      let earned = 0;
      if (studentAnswer === "A") earned = wA;
      else if (studentAnswer === "B") earned = wB;
      else if (studentAnswer === "C") earned = wC;
      else if (studentAnswer === "D") earned = wD;
      totalEarnedPG += earned;
    }
  }

  for (let i = 0; i < essayQuestions.length; i++) {
    const eq = essayQuestions[i];
    if (!eq.studentAnswer || eq.studentAnswer.trim() === "") {
      aiFeedbacks.push(`Soal: ${eq.text} - Kosong (Skor: 0)`);
      continue;
    }

    let graded = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const aiRes = await gradeEssay(eq.text, eq.reference, eq.studentAnswer);
        const score = typeof aiRes.score === "number" ? aiRes.score : 0;
        const weightedScore = (score / 100) * eq.weight;
        totalEssayScore += weightedScore;
        aiFeedbacks.push(`Soal: ${eq.text} - AI Score: ${score}/100. Alasan: ${aiRes.reason}`);
        graded = true;
        break;
      } catch (err: any) {
        log(`   ⚠️ [${studentName}] Percobaan ${attempt} gagal untuk soal esai ${i + 1}: ${err.message}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          aiFeedbacks.push(`Soal: ${eq.text} - AI Score: 0/100. Alasan: Gagal memproses - ${err.message}`);
        }
      }
    }
  }

  const hasEssay = totalMaxEssay > 0;
  const pgWeight = hasEssay ? 60 : 100;
  const pgScore = totalMaxPG > 0 ? (totalEarnedPG / totalMaxPG) * pgWeight : 0;
  const essayWeight = 40;
  const finalEssayScore = hasEssay ? (totalEssayScore / totalMaxEssay) * essayWeight : 0;
  const newFinalScore = parseFloat((pgScore + finalEssayScore).toFixed(2));

  await prisma.examResult.update({
    where: { id: result.id },
    data: {
      score: newFinalScore,
      essayScore: parseFloat(finalEssayScore.toFixed(2)),
      aiFeedback: aiFeedbacks.join("\n\n"),
      gradingStatus: "GRADED",
    },
  });

  log(`   ✅ Selesai: ${studentName} (${subject}) -> PG: ${pgScore.toFixed(1)} | Esai: ${finalEssayScore.toFixed(1)} | Total: ${newFinalScore}`);
}

async function main() {
  const isForceAll = process.argv.includes("--all");
  fs.writeFileSync(LOG_FILE, `=== PENILAIAN AI SEMUA MAPEL CBT (${new Date().toISOString()}) ===\n`);
  
  log("Mengambil data siswa yang perlu dinilai dari database...");

  const whereClause: any = isForceAll
    ? {
        exam: {
          questions: {
            some: { type: "ESSAY" },
          },
        },
      }
    : {
        exam: {
          questions: {
            some: { type: "ESSAY" },
          },
        },
        OR: [
          { gradingStatus: "PENDING" },
          { gradingStatus: "MANUAL_REVIEW" },
          { aiFeedback: { contains: "Timeout" } },
          { aiFeedback: { contains: "Gagal memproses" } },
        ],
      };

  const results = await prisma.examResult.findMany({
    where: whereClause,
    include: {
      student: true,
      exam: {
        include: {
          questions: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
    orderBy: [
      { exam: { subject: "asc" } },
      { createdAt: "asc" },
    ],
  });

  log(`Ditemukan ${results.length} siswa yang perlu dinilai AI.`);

  if (results.length === 0) {
    log("Semua siswa di semua mapel sudah dinilai dengan benar!");
    return;
  }

  // Tampilkan ringkasan per mapel
  const subjectSummary: Record<string, number> = {};
  for (const r of results) {
    const s = `${r.exam.subject} (${r.exam.targetClass})`;
    subjectSummary[s] = (subjectSummary[s] || 0) + 1;
  }
  log("Rincian per mata pelajaran:");
  for (const [sub, cnt] of Object.entries(subjectSummary)) {
    log(`  - ${sub}: ${cnt} siswa`);
  }

  const CONCURRENCY = 5;
  log(`\nMemulai proses penilaian paralel (${CONCURRENCY} antrian bersamaan)...\n`);

  const startTime = Date.now();

  for (let i = 0; i < results.length; i += CONCURRENCY) {
    const chunk = results.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(results.length / CONCURRENCY);
    log(`--- Batch ${batchNum}/${totalBatches} (${chunk.length} siswa) ---`);

    await Promise.all(
      chunk.map((item, idx) => gradeSingleStudent(item, i + idx, results.length))
    );
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  log(`\n🎉 SEMUA SISWA BERHASIL DINILAI DENGAN AI!`);
  log(`Total siswa dinilai: ${results.length}`);
  log(`Total waktu pengerjaan: ${durationSec} detik (~${(durationSec / 60).toFixed(1)} menit)`);
}

main()
  .catch((e) => {
    log(`FATAL ERROR: ${e.message}`);
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
