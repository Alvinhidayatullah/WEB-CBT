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

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          select: {
            id: true,
            type: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
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

    // Fisher-Yates Shuffle
    const shuffledQuestions = [...exam.questions];
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
    }

    return {
      id: exam.id,
      title: `${exam.examType} - ${exam.subject}`,
      targetClass: exam.targetClass,
      duration: exam.duration,
      questions: shuffledQuestions,
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

    let totalEarnedWeights = 0;
    let totalMaxWeights = 0;
    
    // Untuk job AI
    let hasEssay = false;
    let essayPayloads: any[] = [];

    exam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (q.type === "ESSAY") {
        hasEssay = true;
        const essayMaxW = q.weightA && q.weightA > 0 ? q.weightA : 100;
        totalMaxWeights += essayMaxW;
        
        essayPayloads.push({
          questionText: q.text,
          referenceAnswer: q.essayReference || "",
          studentAnswer: studentAnswer || "",
          weight: essayMaxW
        });
      } else {
        const maxW = Math.max(q.weightA || 0, q.weightB || 0, q.weightC || 0, q.weightD || 0);
        const questionMax = maxW > 0 ? maxW : 100; // Default 100 jika lupa set bobot
        totalMaxWeights += questionMax;

        let earned = 0;
        if (studentAnswer === "A") earned = q.weightA || 0;
        else if (studentAnswer === "B") earned = q.weightB || 0;
        else if (studentAnswer === "C") earned = q.weightC || 0;
        else if (studentAnswer === "D") earned = q.weightD || 0;

        totalEarnedWeights += earned;
      }
    });

    const score = totalMaxWeights > 0 ? (totalEarnedWeights / totalMaxWeights) * 100 : 0;
    const finalScore = parseFloat(score.toFixed(2));

    const resultRecord = await prisma.examResult.create({
      data: {
        studentId: userId,
        examId: examId,
        score: finalScore,
        isCheated: isCheated,
        timeSpent: timeSpent,
        answersJson: JSON.stringify(answers),
        gradingStatus: hasEssay ? "PENDING" : "GRADED"
      }
    });
    
    if (hasEssay && essayPayloads.length > 0) {
      // AI Grading ditunda dan akan dikerjakan secara background (antrean)
      // oleh Dasbor Admin untuk menghindari Vercel 10s Timeout.
      return { success: true, score: finalScore, isPending: true };
    }

    return { success: true, score: finalScore, isPending: false };
  } catch (error) {
    // Check if unique constraint error
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
       return { success: false, error: "Anda sudah mensubmit ujian ini sebelumnya." };
    }
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}
