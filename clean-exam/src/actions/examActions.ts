"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { gradeEssay } from "@/lib/ai";

export async function joinExam(token: string) {
  try {
    // 1. Strict Payload Validation
    if (typeof token !== 'string' || token.length > 20) {
      return { success: false, error: "Format token tidak valid." };
    }

    const session = await getSession();
    const userId = session?.userId as string;
    const userClass = session?.className as string;

    if (!userId) {
      return { success: false, error: "Sesi tidak ditemukan. Silakan login kembali." };
    }

    const exam = await prisma.exam.findUnique({
      where: { token: token },
    });

    if (!exam || !exam.isActive) {
      return { success: false, error: "Token ujian tidak valid atau ujian tidak aktif." };
    }

    const allowedClasses = exam.targetClass.split(",").map(c => c.trim());
    if (exam.targetClass !== "Semua Kelas" && !allowedClasses.includes(userClass || "")) {
      return { success: false, error: `Ujian ini khusus untuk kelas: ${exam.targetClass}.` };
    }

    const existingResult = await prisma.examResult.findUnique({
      where: {
        studentId_examId: {
          studentId: userId,
          examId: exam.id,
        },
      },
    });

    if (existingResult) {
      return { success: false, error: "Token sudah digunakan. Harap hubungi administrator ujian." };
    }

    return { success: true, examId: exam.id };
  } catch (error) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function getExamData(examId: string) {
  try {
    const session = await getSession();
    const userId = session?.userId as string;
    const userClass = session?.className as string;

    if (!userId) return null;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true }
    });

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            imageUrl: true,
            optionAImg: true,
            optionBImg: true,
            optionCImg: true,
            optionDImg: true,
            isShuffled: true,
            isOptionsShuffled: true,
            // DO NOT select correctOption to prevent cheating on client
          }
        }
      }
    });
    
    if (!exam || !exam.isActive) return null;

    const allowedClasses = exam.targetClass.split(",").map(c => c.trim());
    if (exam.targetClass !== "Semua Kelas" && !allowedClasses.includes(userClass || "")) {
      return null;
    }

    const existingResult = await prisma.examResult.findUnique({
      where: {
        studentId_examId: {
          studentId: userId,
          examId: examId,
        },
      },
    });

    if (existingResult) {
      return { error: "Anda sudah menyelesaikan ujian ini." };
    }

    // Pisahkan PG dan Essay
    let pgQuestions = exam.questions.filter((q: any) => q.type !== 'ESSAY');
    let essayQuestions = exam.questions.filter((q: any) => q.type === 'ESSAY');

    // Pengacakan Nomor Soal jika diaktifkan (dengan fitur Pin/Freeze untuk soal cerita)
    if (exam.randomizeQuestions) {
      const smartShuffle = (arr: any[]) => {
        const shufflableIndices: number[] = [];
        const shufflableItems: any[] = [];
        
        arr.forEach((item, index) => {
          if (item.isShuffled !== false) {
            shufflableIndices.push(index);
            shufflableItems.push(item);
          }
        });

        for (let i = shufflableItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shufflableItems[i], shufflableItems[j]] = [shufflableItems[j], shufflableItems[i]];
        }

        const result = [...arr];
        shufflableIndices.forEach((originalIndex, i) => {
          result[originalIndex] = shufflableItems[i];
        });
        return result;
      };

      pgQuestions = smartShuffle(pgQuestions);
      essayQuestions = smartShuffle(essayQuestions);
    }

    // Gabungkan kembali: PG terlebih dahulu, lalu Essay, dan persiapkan opsi
    const processedQuestions = [...pgQuestions, ...essayQuestions].map(q => {
      if (q.type === 'ESSAY') return q;
      
      const opts = [
        { originalValue: "A", text: q.optionA, img: q.optionAImg },
        { originalValue: "B", text: q.optionB, img: q.optionBImg },
        { originalValue: "C", text: q.optionC, img: q.optionCImg },
        { originalValue: "D", text: q.optionD, img: q.optionDImg },
      ];
      
      if (exam.randomizeOptions && q.isOptionsShuffled !== false) {
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
      }
      
      const visualOpts = opts.map((opt, idx) => ({
        ...opt,
        label: String.fromCharCode(65 + idx)
      }));

      return {
        ...q,
        shuffledOptions: visualOpts
      };
    });

    return {
      id: exam.id,
      title: `${exam.examType} - ${exam.subject}`,
      targetClass: exam.targetClass,
      duration: exam.duration,
      studentName: user?.name || user?.username || "Siswa",
      studentClass: userClass || "-",
      questions: processedQuestions,
    };
  } catch (error) {
    return null;
  }
}

export async function submitExam(examId: string, answers: Record<string, string>, isCheated: boolean = false, timeSpent: number = 0) {
  try {
    // 1. Strict Payload Validation
    if (typeof examId !== 'string' || examId.length > 100) {
      return { success: false, error: "Format ID Ujian tidak valid." };
    }
    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
      return { success: false, error: "Format jawaban tidak valid." };
    }
    
    const session = await getSession();
    const userId = session?.userId as string;

    if (!userId) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true }
    });

    if (!exam || !exam.isActive) return { success: false, error: "Ujian tidak ditemukan atau sudah ditutup." };

    const userClass = session?.className as string;
    const allowedClasses = exam.targetClass.split(",").map(c => c.trim());
    if (exam.targetClass !== "Semua Kelas" && !allowedClasses.includes(userClass || "")) {
      return { success: false, error: "Anda tidak memiliki akses ke ujian ini." };
    }

    let totalEarnedPG = 0;
    let totalMaxPG = 0;
    let totalMaxEssay = 0;
    
    // Untuk job AI
    let hasEssay = false;
    let essayPayloads: any[] = [];

    exam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (q.type === "ESSAY") {
        hasEssay = true;
        const essayMaxW = q.weightA && q.weightA > 0 ? q.weightA : 100;
        totalMaxEssay += essayMaxW;
        
        essayPayloads.push({
          questionText: q.text,
          referenceAnswer: q.essayReference || "",
          studentAnswer: studentAnswer || "",
          weight: essayMaxW
        });
      } else {
        const maxW = Math.max(q.weightA || 0, q.weightB || 0, q.weightC || 0, q.weightD || 0);
        const questionMax = maxW > 0 ? maxW : 100; // Default 100 jika lupa set bobot
        totalMaxPG += questionMax;

        let earned = 0;
        if (studentAnswer === "A") earned = q.weightA || 0;
        else if (studentAnswer === "B") earned = q.weightB || 0;
        else if (studentAnswer === "C") earned = q.weightC || 0;
        else if (studentAnswer === "D") earned = q.weightD || 0;

        totalEarnedPG += earned;
      }
    });

    // Kalkulasi skor PG (Maksimal 60 jika ada essay, 100 jika full PG)
    const pgWeight = hasEssay ? 60 : 100;
    const pgScore = totalMaxPG > 0 ? (totalEarnedPG / totalMaxPG) * pgWeight : 0;
    const finalScore = parseFloat(pgScore.toFixed(2));

    let finalGradingStatus = "GRADED";
    if (hasEssay) {
      finalGradingStatus = exam.isAIGradingEnabled ? "PENDING" : "MANUAL_REVIEW";
    }

    const resultRecord = await prisma.examResult.create({
      data: {
        studentId: userId,
        examId: examId,
        score: finalScore,
        isCheated: isCheated,
        timeSpent: timeSpent,
        answersJson: JSON.stringify(answers),
        gradingStatus: finalGradingStatus
      }
    });
    
    if (hasEssay && essayPayloads.length > 0) {
      // AI Grading ditunda dan akan dikerjakan secara background (antrean)
      // oleh Dasbor Admin untuk menghindari Vercel 10s Timeout.
      return { success: true, score: finalScore, isPending: true, gradingStatus: finalGradingStatus };
    }

    return { success: true, score: finalScore, isPending: false, gradingStatus: finalGradingStatus };
  } catch (error) {
    // Check if unique constraint error
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
       return { success: false, error: "Anda sudah mensubmit ujian ini sebelumnya." };
    }
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}
