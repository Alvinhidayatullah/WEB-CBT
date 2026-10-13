"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { gradeEssay } from "@/lib/ai";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

async function checkAuth(allowedRoles: string[]) {
  const session = await getSession();
  if (!session) {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    redirect("/");
  }

  let userRole = session.userRole as string;
  const userId = session.userId as string;

  if (!userRole && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) userRole = user.role;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    redirect("/");
  }
}

export async function getDashboardStats() {
  try {
    const session = await getSession();
    const userId = session?.userId as string;
    
    let userRole = session?.userRole;
    let userClassName = null;
    let userTeacherSubject = null;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userRole = user.role;
        userClassName = user.className;
        userTeacherSubject = user.teacherSubject;
      }
    }

    let totalUsers = await prisma.user.count({
      where: { role: { in: ["GURU", "MURID"] } },
    });
    
    if (userRole === "GURU" && userClassName) {
       const allowedClasses = userClassName.split(",").map(c => c.trim().toLowerCase());
       
       const allMurid = await prisma.user.findMany({
          where: { role: "MURID" },
          select: { className: true }
       });
       
       totalUsers = allMurid.filter(u => {
          if (!u.className) return false;
          return allowedClasses.includes(u.className.trim().toLowerCase());
       }).length;
    }
    
    const examWhereClause: any = { isActive: true };

    let activeExams = await prisma.exam.count({
      where: examWhereClause,
    });
    
    // Perform JS filtering if user is GURU
    if (userRole === "GURU") {
       const allowedClasses = userClassName ? userClassName.split(",").map(c => c.trim().toLowerCase()) : [];
       const allowedSubjects = userTeacherSubject ? userTeacherSubject.split(",").map(s => s.trim().toLowerCase()) : [];
       
       const allActiveTeacherExams = await prisma.exam.findMany({
         where: examWhereClause,
         select: { targetClass: true, subject: true }
       });
       
       activeExams = allActiveTeacherExams.filter(exam => {
         const examSubject = exam.subject.trim().toLowerCase();
         if (allowedSubjects.length > 0 && !allowedSubjects.includes(examSubject)) return false;
         
         if (exam.targetClass === "Semua Kelas") return true;
         if (allowedClasses.length === 0) return true;
         
         const examClasses = exam.targetClass.split(",").map(c => c.trim().toLowerCase());
         return examClasses.some(c => allowedClasses.includes(c));
       }).length;
    }
    
    return { totalUsers, activeExams };
  } catch {
    return { totalUsers: 0, activeExams: 0 };
  }
}

export async function getExams() {
  try {
    const session = await getSession();
    const userId = session?.userId as string;
    
    let userRole = session?.userRole;
    let userClassName = null;
    let userTeacherSubject = null;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userRole = user.role;
        userClassName = user.className;
        userTeacherSubject = user.teacherSubject;
      }
    }

    const whereClause: any = {};

    let exams = await prisma.exam.findMany({
      where: whereClause,
      include: { 
        questions: { orderBy: { createdAt: 'asc' } },
        results: { 
          orderBy: { createdAt: "asc" },
          include: { 
            student: {
              select: { id: true, username: true, name: true, className: true }
            } 
          } 
        }
      },
      orderBy: [
        { subject: "asc" },
        { targetClass: "asc" },
        { createdAt: "desc" }
      ],
    });
    
    // Perform JS filtering if user is GURU
    if (userRole === "GURU") {
       const allowedClasses = userClassName ? userClassName.split(",").map(c => c.trim().toLowerCase()) : [];
       const allowedSubjects = userTeacherSubject ? userTeacherSubject.split(",").map(s => s.trim().toLowerCase()) : [];
       
       exams = exams.filter(exam => {
         const examSubject = exam.subject.trim().toLowerCase();
         if (allowedSubjects.length > 0 && !allowedSubjects.includes(examSubject)) return false;
         
         if (exam.targetClass === "Semua Kelas") return true;
         if (allowedClasses.length === 0) return true;
         
         const examClasses = exam.targetClass.split(",").map(c => c.trim().toLowerCase());
         return examClasses.some(c => allowedClasses.includes(c));
       });
    }

    // Urutkan soal di setiap ujian: PG terlebih dahulu, lalu ESSAY (stabil)
    exams.forEach(exam => {
      if (exam.questions && Array.isArray(exam.questions)) {
        const pg = exam.questions.filter((q: any) => q.type !== 'ESSAY');
        const essay = exam.questions.filter((q: any) => q.type === 'ESSAY');
        exam.questions = [...pg, ...essay];
      }
    });

    return exams;
  } catch {
    return [];
  }
}

export async function getPendingResultIds() {
  try {
    const session = await getSession();
    if (!session) return [];
    const userId = session?.userId as string;
    
    let userRole = session?.userRole;
    let userClassName = null;
    let userTeacherSubject = null;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userRole = user.role;
        userClassName = user.className;
        userTeacherSubject = user.teacherSubject;
      }
    }

    let exams = await prisma.exam.findMany({
      select: { 
        id: true, 
        targetClass: true, 
        subject: true, 
        results: { where: { gradingStatus: "PENDING" }, select: { id: true } } 
      },
    });
    
    if (userRole === "GURU") {
       const allowedClasses = userClassName ? userClassName.split(",").map(c => c.trim().toLowerCase()) : [];
       const allowedSubjects = userTeacherSubject ? userTeacherSubject.split(",").map(s => s.trim().toLowerCase()) : [];
       
       exams = exams.filter(exam => {
         const examSubject = exam.subject.trim().toLowerCase();
         if (allowedSubjects.length > 0 && !allowedSubjects.includes(examSubject)) return false;
         
         if (exam.targetClass === "Semua Kelas") return true;
         if (allowedClasses.length === 0) return true;
         
         const examClasses = exam.targetClass.split(",").map(c => c.trim().toLowerCase());
         return examClasses.some(c => allowedClasses.includes(c));
       });
    }

    const pendingIds: string[] = [];
    exams.forEach(exam => {
      exam.results.forEach(res => pendingIds.push(res.id));
    });

    return pendingIds;
  } catch {
    return [];
  }
}

export async function createExam(examType: string, subject: string, targetClass: string, duration: number = 60, isAIGradingEnabled: boolean = true, customToken?: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };
    
    let examToken = generateToken();
    if (customToken && customToken.trim()) {
      const formatted = customToken.trim().toUpperCase();
      const existing = await prisma.exam.findFirst({
        where: { token: formatted }
      });
      if (existing) {
        return { success: false, error: `Token "${formatted}" sudah digunakan oleh ujian lain. Silakan gunakan token yang berbeda.` };
      }
      examToken = formatted;
    }

    const session = await getSession();
    const userId = session?.userId as string;
    let finalTargetClass = targetClass || "Semua Kelas";
    let finalSubject = subject.toUpperCase();

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.role === "GURU") {
        if (user.teacherSubject) {
           const allowedSubjects = user.teacherSubject.split(",").map(c => c.trim().toLowerCase());
           const inputSubjects = subject.split(",").map(c => c.trim().toLowerCase());
           
           const isValid = inputSubjects.every(c => allowedSubjects.includes(c));
           if (!isValid) {
              return { success: false, error: "yahaha mau ngapain loo? 403 gk boleh bikin selain izin gue yaaa" };
           }
           finalSubject = subject.toUpperCase();
        } else {
           return { success: false, error: "403 Forbidden: Anda belum memiliki mata pelajaran yang diampu." };
        }
        
        if (user.className) {
           const allowedClasses = user.className.split(",").map(c => c.trim().toLowerCase());
           const inputClasses = targetClass.split(",").map(c => c.trim().toLowerCase());
           
           const isValid = inputClasses.every(c => allowedClasses.includes(c));
           if (!isValid) {
              return { success: false, error: `403 Forbidden: Anda hanya diizinkan membuat ujian untuk kelas: ${user.className}` };
           }
           // Use user's input because it is valid
           finalTargetClass = targetClass;
        } else {
           return { success: false, error: "403 Forbidden: Anda belum memiliki kelas yang diampu." };
        }
      }
    }

    const newExam = await prisma.exam.create({ 
      data: { 
        examType, 
        subject: finalSubject, 
        targetClass: finalTargetClass,
        token: examToken,
        duration,
        isAIGradingEnabled
      } 
    });
    return { success: true, exam: newExam };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return { success: false, error: "Token ini sudah digunakan oleh sesi ujian lain. Silakan gunakan token lain." };
    }
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function updateExam(id: string, data: { examType?: string, subject?: string, targetClass?: string, duration?: number, isAIGradingEnabled?: boolean, token?: string }) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    const session = await getSession();
    const userId = session?.userId as string;
    
    let finalTargetClass = data.targetClass;
    let finalSubject = data.subject;
    let finalToken: string | undefined = undefined;

    if (data.token !== undefined) {
      const trimmed = data.token.trim().toUpperCase();
      if (!trimmed) {
        return { success: false, error: "Token tidak boleh kosong." };
      }
      if (trimmed.length > 25) {
        return { success: false, error: "Panjang token maksimal 25 karakter." };
      }
      const existing = await prisma.exam.findFirst({
        where: {
          token: trimmed,
          NOT: { id }
        }
      });
      if (existing) {
        return { success: false, error: `Token "${trimmed}" sudah digunakan oleh sesi ujian lain. Silakan pilih token lain.` };
      }
      finalToken = trimmed;
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.role === "GURU") {
        if (user.teacherSubject && data.subject) {
           const allowedSubjects = user.teacherSubject.split(",").map(c => c.trim().toLowerCase());
           const inputSubjects = data.subject.split(",").map(c => c.trim().toLowerCase());
           
           const isValid = inputSubjects.every(c => allowedSubjects.includes(c));
           if (!isValid) {
              return { success: false, error: "yahaha mau ngapain loo? 403 gk boleh bikin selain izin gue yaaa" };
           }
           finalSubject = data.subject.toUpperCase();
        }
        
        if (user.className && data.targetClass) {
           const allowedClasses = user.className.split(",").map(c => c.trim().toLowerCase());
           const inputClasses = data.targetClass.split(",").map(c => c.trim().toLowerCase());
           
           const isValid = inputClasses.every(c => allowedClasses.includes(c));
           if (!isValid) {
              return { success: false, error: `403 Forbidden: Anda hanya diizinkan mengelola ujian untuk kelas: ${user.className}` };
           }
           finalTargetClass = data.targetClass;
        }
      }
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: {
        ...(data.examType && { examType: data.examType }),
        ...(finalSubject && { subject: finalSubject }),
        ...(finalTargetClass && { targetClass: finalTargetClass }),
        ...(data.duration && { duration: data.duration }),
        ...(data.isAIGradingEnabled !== undefined && { isAIGradingEnabled: data.isAIGradingEnabled }),
        ...(finalToken && { token: finalToken })
      }
    });
    return { success: true, exam: updated };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return { success: false, error: "Token ini sudah digunakan oleh sesi ujian lain. Silakan pilih token yang berbeda." };
    }
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

const isValidImageUrl = (url: string | null | undefined) => {
  if (!url) return true;
  if (url.trim() === "") return true;
  // Allow safe HTTP/HTTPS URLs or specific data URIs (jpeg/png/webp) to prevent XSS (SVG) or RCE
  const isDataURI = /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(url);
  const isHttpURI = /^https?:\/\//.test(url);
  return isDataURI || isHttpURI;
};

export async function createQuestion(data: {
  examId: string;
  type?: string;
  text: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  weightA?: number;
  weightB?: number;
  weightC?: number;
  weightD?: number;
  essayReference?: string | null;
  imageUrl?: string | null;
  optionAImg?: string | null;
  optionBImg?: string | null;
  optionCImg?: string | null;
  optionDImg?: string | null;
}) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    if (!isValidImageUrl(data.imageUrl) || !isValidImageUrl(data.optionAImg) || !isValidImageUrl(data.optionBImg) || !isValidImageUrl(data.optionCImg) || !isValidImageUrl(data.optionDImg)) {
       return { success: false, error: "Format gambar tidak valid atau terdeteksi malware. Hanya menerima JPEG, PNG, WEBP, atau URL aman." };
    }

    let wA = data.weightA || 0;
    let wB = data.weightB || 0;
    let wC = data.weightC || 0;
    let wD = data.weightD || 0;
    if ((data.type || "MULTIPLE_CHOICE") !== "ESSAY" && wA === 0 && wB === 0 && wC === 0 && wD === 0) {
      wA = 100;
    }

    await prisma.question.create({
      data: {
        examId: data.examId,
        type: data.type || "MULTIPLE_CHOICE",
        text: data.text,
        optionA: data.optionA || null,
        optionB: data.optionB || null,
        optionC: data.optionC || null,
        optionD: data.optionD || null,
        weightA: wA,
        weightB: wB,
        weightC: wC,
        weightD: wD,
        essayReference: data.essayReference || null,
        imageUrl: data.imageUrl || null,
        optionAImg: data.optionAImg || null,
        optionBImg: data.optionBImg || null,
        optionCImg: data.optionCImg || null,
        optionDImg: data.optionDImg || null,
      },
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function deleteQuestion(id: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.question.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function deleteAllQuestions(examId: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.question.deleteMany({ where: { examId } });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function deleteExam(id: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.exam.delete({ where: { id } });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function updateExamSettings(id: string, randomizeQuestions: boolean, randomizeOptions: boolean) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.exam.update({
      where: { id },
      data: { randomizeQuestions, randomizeOptions }
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function updateQuestionSettings(id: string, isShuffled: boolean, isOptionsShuffled: boolean) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.question.update({
      where: { id },
      data: { isShuffled, isOptionsShuffled }
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function updateQuestion(id: string, data: {
  type?: string;
  text: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  weightA?: number;
  weightB?: number;
  weightC?: number;
  weightD?: number;
  essayReference?: string | null;
  imageUrl?: string | null;
  optionAImg?: string | null;
  optionBImg?: string | null;
  optionCImg?: string | null;
  optionDImg?: string | null;
}) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    if (!isValidImageUrl(data.imageUrl) || !isValidImageUrl(data.optionAImg) || !isValidImageUrl(data.optionBImg) || !isValidImageUrl(data.optionCImg) || !isValidImageUrl(data.optionDImg)) {
       return { success: false, error: "Format gambar tidak valid atau terdeteksi malware. Hanya menerima JPEG, PNG, WEBP, atau URL aman." };
    }

    await prisma.question.update({
      where: { id },
      data: {
        type: data.type || "MULTIPLE_CHOICE",
        text: data.text,
        optionA: data.optionA || null,
        optionB: data.optionB || null,
        optionC: data.optionC || null,
        optionD: data.optionD || null,
        weightA: data.weightA || 0,
        weightB: data.weightB || 0,
        weightC: data.weightC !== undefined ? data.weightC : undefined,
        weightD: data.weightD !== undefined ? data.weightD : undefined,
        essayReference: data.essayReference !== undefined ? data.essayReference : undefined,
        imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
        optionAImg: data.optionAImg !== undefined ? data.optionAImg : undefined,
        optionBImg: data.optionBImg !== undefined ? data.optionBImg : undefined,
        optionCImg: data.optionCImg !== undefined ? data.optionCImg : undefined,
        optionDImg: data.optionDImg !== undefined ? data.optionDImg : undefined,
      },
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function bulkCreateQuestions(examId: string, questions: any[]) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    // Validate images in all questions
    for (const q of questions) {
       if (!isValidImageUrl(q.imageUrl) || !isValidImageUrl(q.optionAImg) || !isValidImageUrl(q.optionBImg) || !isValidImageUrl(q.optionCImg) || !isValidImageUrl(q.optionDImg)) {
          return { success: false, error: "Format gambar tidak valid pada salah satu soal. Impor dibatalkan demi keamanan." };
       }
    }

    const now = new Date();
    const formattedQuestions = questions.map((q, index) => {
      let wA = Number(q.weightA) || 0;
      let wB = Number(q.weightB) || 0;
      let wC = Number(q.weightC) || 0;
      let wD = Number(q.weightD) || 0;
      const isEssay = (q.type || "").toUpperCase() === "ESSAY";
      if (!isEssay && wA === 0 && wB === 0 && wC === 0 && wD === 0) {
        const correct = String(q.correctOption || q.kunci || "").toUpperCase();
        if (correct === "B") wB = 100;
        else if (correct === "C") wC = 100;
        else if (correct === "D") wD = 100;
        else wA = 100;
      }

      return {
        examId,
        type: q.type || "MULTIPLE_CHOICE",
        text: q.text,
        imageUrl: q.imageUrl || null,
        optionA: q.optionA || null,
        optionAImg: q.optionAImg || null,
        optionB: q.optionB || null,
        optionBImg: q.optionBImg || null,
        optionC: q.optionC || null,
        optionCImg: q.optionCImg || null,
        optionD: q.optionD || null,
        optionDImg: q.optionDImg || null,
        weightA: wA,
        weightB: wB,
        weightC: wC,
        weightD: wD,
        essayReference: q.essayReference || null,
        createdAt: new Date(now.getTime() + index * 1000), // Stagger by 1 second to ensure stable sorting
      };
    });

    await prisma.question.createMany({
      data: formattedQuestions
    });
    
    revalidatePath("/", "layout");
    return { success: true, count: formattedQuestions.length };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function getPendingEssayPayloads(resultId: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    const result = await prisma.examResult.findUnique({
      where: { id: resultId },
      include: { exam: { include: { questions: { orderBy: { createdAt: 'asc' } } } } }
    });

    if (!result) return { success: false, error: "Data tidak ditemukan." };

    const answers = JSON.parse(result.answersJson as string);
    const essayPayloads: any[] = [];
    
    let totalMaxPG = 0;
    let totalEarnedPG = 0;
    let totalMaxEssay = 0;

    result.exam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (q.type === "ESSAY") {
        const essayMaxW = q.weightA && q.weightA > 0 ? q.weightA : 100;
        totalMaxEssay += essayMaxW;
        essayPayloads.push({
          questionId: q.id,
          questionText: q.text,
          referenceAnswer: q.essayReference || "",
          studentAnswer: studentAnswer || "",
          weight: essayMaxW
        });
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

    return { 
      success: true, 
      payloads: essayPayloads,
      totalMaxPG,
      totalEarnedPG,
      totalMaxEssay
    };
  } catch (error) {
    return { success: false, error: "Gagal memproses data ujian." };
  }
}

export async function gradeSingleEssayAction(questionText: string, referenceAnswer: string, studentAnswer: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    if (!studentAnswer || studentAnswer.trim() === "") {
      return { success: true, score: 0, reason: "Kosong (Skor: 0)" };
    }
    const aiResult = await gradeEssay(questionText, referenceAnswer, studentAnswer);
    return { success: true, score: aiResult.score, reason: aiResult.reason };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghubungi AI Gateway" };
  }
}

export async function finalizeAIGrading(
  resultId: string, 
  totalEarnedPG: number, 
  totalMaxPG: number, 
  totalEssayRaw: number,
  totalMaxEssay: number,
  aiFeedbacks: string[]
) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    const hasEssay = totalMaxEssay > 0;
    const pgWeight = hasEssay ? 60 : 100;
    const pgScore = totalMaxPG > 0 ? (totalEarnedPG / totalMaxPG) * pgWeight : 0;
    
    const essayWeight = 40;
    const finalEssayScore = hasEssay ? (totalEssayRaw / totalMaxEssay) * essayWeight : 0;

    const newFinalScore = parseFloat((pgScore + finalEssayScore).toFixed(2));

    await prisma.examResult.update({
      where: { id: resultId },
      data: {
        score: newFinalScore,
        essayScore: parseFloat(finalEssayScore.toFixed(2)),
        aiFeedback: aiFeedbacks.join("\n\n"),
        gradingStatus: "GRADED"
      }
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal menyimpan hasil akhir AI." };
  }
}

export async function deleteExamResult(resultId: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    await prisma.examResult.delete({
      where: { id: resultId }
    });
    revalidatePath("/admin/dashboard");
    revalidatePath("/teacher/dashboard");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal menghapus hasil ujian siswa." };
  }
}

export async function forceFinalizeExamResult(resultId: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    const result = await prisma.examResult.findUnique({
      where: { id: resultId },
      include: { exam: { include: { questions: true } } }
    });

    if (!result) return { success: false, error: "Data ujian tidak ditemukan." };

    let answers: Record<string, string> = {};
    try {
      answers = JSON.parse((result.answersJson as string) || "{}");
    } catch {
      answers = {};
    }

    let totalEarnedPG = 0;
    let totalMaxPG = 0;
    let totalMaxEssay = 0;
    let hasEssay = false;

    result.exam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (q.type === "ESSAY") {
        hasEssay = true;
        const essayMaxW = q.weightA && q.weightA > 0 ? q.weightA : 100;
        totalMaxEssay += essayMaxW;
      } else {
        const maxW = Math.max(q.weightA || 0, q.weightB || 0, q.weightC || 0, q.weightD || 0);
        const questionMax = maxW > 0 ? maxW : 100;
        totalMaxPG += questionMax;

        let earned = 0;
        if (studentAnswer === "A") earned = q.weightA || 0;
        else if (studentAnswer === "B") earned = q.weightB || 0;
        else if (studentAnswer === "C") earned = q.weightC || 0;
        else if (studentAnswer === "D") earned = q.weightD || 0;
        totalEarnedPG += earned;
      }
    });

    const pgWeight = hasEssay ? 60 : 100;
    const pgScore = totalMaxPG > 0 ? (totalEarnedPG / totalMaxPG) * pgWeight : 0;
    const finalScore = parseFloat(pgScore.toFixed(2));

    const finalGradingStatus = hasEssay 
      ? (result.exam.isAIGradingEnabled ? "PENDING" : "MANUAL_REVIEW") 
      : "GRADED";
    const timeSpent = result.timeSpent > 0 ? result.timeSpent : result.exam.duration * 60;

    const updated = await prisma.examResult.update({
      where: { id: resultId },
      data: {
        score: finalScore,
        essayScore: 0,
        timeSpent: timeSpent,
        gradingStatus: finalGradingStatus
      }
    });

    if (hasEssay && result.exam.isAIGradingEnabled) {
      const essayPayloads: any[] = [];
      result.exam.questions.forEach(q => {
        if (q.type === "ESSAY") {
          const essayMaxW = q.weightA && q.weightA > 0 ? q.weightA : 100;
          essayPayloads.push({
            questionText: q.text,
            referenceAnswer: q.essayReference || "",
            studentAnswer: answers[q.id] || "",
            weight: essayMaxW
          });
        }
      });

      if (essayPayloads.length > 0) {
        await prisma.jobQueue.create({
          data: {
            type: "AI_GRADING",
            payload: JSON.stringify({
              resultId: result.id,
              examResultId: result.id,
              essays: essayPayloads
            })
          }
        });
      }
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/teacher/dashboard");
    return { 
      success: true,
      result: {
        id: updated.id,
        score: updated.score,
        essayScore: updated.essayScore,
        gradingStatus: updated.gradingStatus,
        timeSpent: updated.timeSpent
      }
    };
  } catch (error) {
    return { success: false, error: "Gagal memproses penilaian paksa." };
  }
}

