"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

export async function joinExam(token: string) {
  try {
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

    let correctCount = 0;
    const totalQuestions = exam.questions.length;

    exam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (q.type === "ESSAY") {
        // Option A: Automatically score essay as correct if answered
        if (studentAnswer && studentAnswer.trim().length > 0) {
          correctCount++;
        }
      } else {
        if (studentAnswer === q.correctOption) {
          correctCount++;
        }
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
        timeSpent: timeSpent,
        answersJson: JSON.stringify(answers)
      }
    });

    return { success: true, score: finalScore };
  } catch (error) {
    // Check if unique constraint error
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
       return { success: false, error: "Anda sudah mensubmit ujian ini sebelumnya." };
    }
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}
