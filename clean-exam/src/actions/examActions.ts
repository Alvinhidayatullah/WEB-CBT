"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { gradeEssay } from "@/lib/ai";

export async function joinExam(token: string) {
  try {
    // 1. Strict Payload Validation
    if (typeof token !== 'string') {
      return { success: false, error: "Format token tidak valid." };
    }
    const cleanToken = token.trim().toUpperCase();
    if (cleanToken.length < 3 || cleanToken.length > 30) {
      return { success: false, error: "Panjang token ujian tidak valid (3-30 karakter)." };
    }

    const session = await getSession();
    const userId = session?.userId as string;
    const userClass = session?.className as string;

    if (!userId) {
      return { success: false, error: "Sesi tidak ditemukan. Silakan login kembali." };
    }

    const exam = await prisma.exam.findUnique({
      where: { token: cleanToken },
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
      if (existingResult.gradingStatus === "STARTED") {
        // Siswa mental atau keluar browser saat sedang mengerjakan
        // Periksa apakah waktu durasi ujian sudah habis total
        const startTime = new Date(existingResult.createdAt).getTime();
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const totalDurationSeconds = (exam.duration || 60) * 60;

        if (elapsedSeconds > totalDurationSeconds + 300) {
          return { 
            success: false, 
            error: "Waktu pelaksanaan ujian Anda telah habis dan sesi telah berakhir." 
          };
        }

        return { 
          success: true, 
          examId: exam.id, 
          isResumed: true,
          message: "Melanjutkan sesi ujian Anda..." 
        };
      }
      return { success: false, error: "Token sudah digunakan. Anda sudah menyelesaikan ujian ini." };
    }

    // Create a placeholder result so the token is immediately consumed
    await prisma.examResult.create({
      data: {
        studentId: userId,
        examId: exam.id,
        score: 0,
        gradingStatus: "STARTED",
        answersJson: "{}"
      }
    });

    return { success: true, examId: exam.id, isResumed: false };
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

    if (!existingResult) {
      return { error: "Sesi ujian belum dimulai. Silakan masukkan token terlebih dahulu di portal siswa." };
    }

    if (existingResult.gradingStatus !== "STARTED") {
      return { error: "Anda sudah menyelesaikan ujian ini." };
    }

    // Ambil jawaban tersimpan di database untuk memulihkan sesi jika siswa mental / reload
    let savedAnswers: Record<string, string> = {};
    if (existingResult.answersJson) {
      try {
        savedAnswers = JSON.parse(existingResult.answersJson);
      } catch {
        savedAnswers = {};
      }
    }

    const startTime = new Date(existingResult.createdAt).getTime();
    const durationMs = (exam.duration || 60) * 60 * 1000;
    const elapsedMs = Date.now() - startTime;
    const remainingSeconds = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));

    // Pisahkan PG dan Essay
    let pgQuestions = exam.questions.filter((q: any) => q.type !== 'ESSAY');
    let essayQuestions = exam.questions.filter((q: any) => q.type === 'ESSAY');

    // Seeded Random Generator agar urutan soal tidak berubah saat siswa refresh (berdasarkan ID siswa dan ID Ujian)
    const generateSeed = (str: string) => {
      let h = 0;
      for(let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
      return h;
    };
    let seed = generateSeed(userId + examId);
    const seededRandom = () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

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
          const j = Math.floor(seededRandom() * (i + 1));
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
          const j = Math.floor(seededRandom() * (i + 1));
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
      title: exam.subject,
      targetClass: exam.targetClass,
      duration: exam.duration,
      studentName: user?.name || user?.username || "Siswa",
      studentClass: userClass || "-",
      questions: processedQuestions,
      savedAnswers,
      startTime,
      remainingSeconds,
      isResumed: Object.keys(savedAnswers).length > 0 || elapsedMs > 15000,
    };
  } catch (error) {
    return null;
  }
}

export async function getActiveStudentExam() {
  try {
    const session = await getSession();
    const userId = session?.userId as string;
    const userClass = session?.className as string;

    if (!userId) return null;

    const activeResult = await prisma.examResult.findFirst({
      where: {
        studentId: userId,
        gradingStatus: "STARTED",
        exam: {
          isActive: true
        }
      },
      include: {
        exam: {
          select: {
            id: true,
            subject: true,
            examType: true,
            targetClass: true,
            duration: true,
            token: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!activeResult) return null;

    const exam = activeResult.exam;
    const allowedClasses = exam.targetClass.split(",").map(c => c.trim());
    if (exam.targetClass !== "Semua Kelas" && !allowedClasses.includes(userClass || "")) {
      return null;
    }

    const startTime = new Date(activeResult.createdAt).getTime();
    const durationMs = (exam.duration || 60) * 60 * 1000;
    const elapsedMs = Date.now() - startTime;
    const remainingSeconds = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));

    // Jika waktu sudah lewat durasi + 5 menit, jangan anggap sesi aktif lagi
    if (elapsedMs > (exam.duration * 60 + 300) * 1000) {
      return null;
    }

    let answeredCount = 0;
    if (activeResult.answersJson) {
      try {
        const parsed = JSON.parse(activeResult.answersJson);
        answeredCount = Object.keys(parsed).length;
      } catch {}
    }

    return {
      examId: exam.id,
      subject: exam.subject,
      examType: exam.examType,
      duration: exam.duration,
      remainingSeconds,
      answeredCount,
      startTime
    };
  } catch {
    return null;
  }
}

export async function saveStudentAnswersProgress(examId: string, answers: Record<string, string>, timeSpent?: number) {
  try {
    const session = await getSession();
    const userId = session?.userId as string;
    if (!userId || typeof answers !== 'object' || answers === null) return { success: false };

    await prisma.examResult.updateMany({
      where: {
        studentId: userId,
        examId: examId,
        gradingStatus: "STARTED"
      },
      data: {
        answersJson: JSON.stringify(answers),
        ...(typeof timeSpent === 'number' && timeSpent > 0 ? { timeSpent } : {})
      }
    });
    return { success: true };
  } catch {
    return { success: false };
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

    // Pastikan belum disubmit
    const existingResult = await prisma.examResult.findUnique({
      where: { studentId_examId: { studentId: userId, examId: examId } }
    });
    
    if (!existingResult || existingResult.gradingStatus !== "STARTED") {
      return { success: false, error: "Ujian ini sudah diselesaikan atau sesi tidak valid." };
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
    });

    // Kalkulasi skor PG (Maksimal 60 jika ada essay, 100 jika full PG)
    const pgWeight = hasEssay ? 60 : 100;
    const pgScore = totalMaxPG > 0 ? (totalEarnedPG / totalMaxPG) * pgWeight : 0;
    const finalScore = parseFloat(pgScore.toFixed(2));

    let finalGradingStatus = "GRADED";
    if (hasEssay) {
      finalGradingStatus = exam.isAIGradingEnabled ? "PENDING" : "MANUAL_REVIEW";
    }

    const resultRecord = await prisma.examResult.update({
      where: {
        studentId_examId: {
          studentId: userId,
          examId: examId
        }
      },
      data: {
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
