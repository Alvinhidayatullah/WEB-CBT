"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function joinExam(token: string) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    const userClass = cookieStore.get("className")?.value;

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
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem saat memvalidasi token." };
  }
}

export async function getExamData(examId: string) {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          select: {
            id: true,
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
    
    if (!exam) return null;

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
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true }
    });

    if (!exam) return { success: false, error: "Ujian tidak ditemukan." };

    let correctCount = 0;
    const totalQuestions = exam.questions.length;

    exam.questions.forEach(q => {
      if (answers[q.id] === q.correctOption) {
        correctCount++;
      }
    });

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const finalScore = parseFloat(score.toFixed(2));

    await prisma.examResult.create({
      data: {
        studentId: userId,
        examId: examId,
        score: finalScore,
        isCheated: isCheated,
        timeSpent: timeSpent
      }
    });

    return { success: true, score: finalScore };
  } catch (error) {
    // Check if unique constraint error
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
       return { success: false, error: "Anda sudah mensubmit ujian ini sebelumnya." };
    }
    return { success: false, error: "Terjadi kesalahan saat menyimpan nilai." };
  }
}
