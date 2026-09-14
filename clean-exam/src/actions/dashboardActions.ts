"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { gradeEssay } from "@/lib/ai";
import { redirect } from "next/navigation";

async function checkAuth(allowedRoles: string[]) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");

  let userRole = session.userRole as string;
  const userId = session.userId as string;

  if (!userRole && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) userRole = user.role;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect("/api/auth/logout");
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
        questions: true,
        results: { 
          include: { 
            student: {
              select: { id: true, username: true, className: true }
            } 
          } 
        }
      },
      orderBy: { createdAt: "desc" },
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

    return exams;
  } catch {
    return [];
  }
}

export async function createExam(examType: string, subject: string, targetClass: string, duration: number = 60) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };
    const examToken = generateToken();

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
        duration
      } 
    });
    return { success: true, exam: newExam };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function updateExam(id: string, data: { examType?: string, subject?: string, targetClass?: string, duration?: number }) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    const session = await getSession();
    const userId = session?.userId as string;
    
    let finalTargetClass = data.targetClass;
    let finalSubject = data.subject;

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
        ...(data.duration && { duration: data.duration })
      }
    });
    return { success: true, exam: updated };
  } catch (error: unknown) {
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

    await prisma.question.create({
      data: {
        examId: data.examId,
        type: data.type || "MULTIPLE_CHOICE",
        text: data.text,
        optionA: data.optionA || null,
        optionB: data.optionB || null,
        optionC: data.optionC || null,
        optionD: data.optionD || null,
        weightA: data.weightA || 0,
        weightB: data.weightB || 0,
        weightC: data.weightC || 0,
        weightD: data.weightD || 0,
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

export async function deleteExam(id: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.exam.delete({ where: { id } });
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

    const formattedQuestions = questions.map(q => ({
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
      weightA: q.weightA || 0,
      weightB: q.weightB || 0,
      weightC: q.weightC || 0,
      weightD: q.weightD || 0,
      essayReference: q.essayReference || null,
    }));

    await prisma.question.createMany({
      data: formattedQuestions
    });
    
    revalidatePath("/", "layout");
    return { success: true, count: formattedQuestions.length };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function retryAIGrading(resultId: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    const result = await prisma.examResult.findUnique({
      where: { id: resultId },
      include: { exam: { include: { questions: true } } }
    });

    if (!result) {
      return { success: false, error: "Data tidak ditemukan." };
    }

    const answers = JSON.parse(result.answersJson as string);
    const essayPayloads: any[] = [];
    
    let totalMaxWeights = 0;
    let totalEarnedWeights = 0;

    result.exam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (q.type === "ESSAY") {
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
        const questionMax = maxW > 0 ? maxW : 100;
        totalMaxWeights += questionMax;

        let earned = 0;
        if (studentAnswer === "A") earned = q.weightA || 0;
        else if (studentAnswer === "B") earned = q.weightB || 0;
        else if (studentAnswer === "C") earned = q.weightC || 0;
        else if (studentAnswer === "D") earned = q.weightD || 0;
        totalEarnedWeights += earned;
      }
    });

    if (essayPayloads.length === 0) {
      await prisma.examResult.update({
        where: { id: resultId },
        data: { gradingStatus: "GRADED" }
      });
      revalidatePath("/", "layout");
      return { success: true };
    }

    let totalEssayScore = 0;
    let aiFeedbacks: string[] = [];

    const gradingPromises = essayPayloads.map(async (essay) => {
      const { questionText, referenceAnswer, studentAnswer, weight } = essay;
      if (!studentAnswer || studentAnswer.trim() === "") {
        return { score: 0, reason: "Kosong (Skor: 0)", questionText, weight };
      }
      const aiResult = await gradeEssay(questionText, referenceAnswer, studentAnswer);
      return { score: aiResult.score, reason: aiResult.reason, questionText, weight };
    });

    const gradedResults = await Promise.all(gradingPromises);

    for (const res of gradedResults) {
      const weightedScore = (res.score / 100) * res.weight;
      totalEssayScore += weightedScore;
      aiFeedbacks.push(`Soal: ${res.questionText} - AI Score: ${res.score}/100. Alasan: ${res.reason}`);
    }

    const finalTotalEarned = totalEarnedWeights + totalEssayScore;
    const newScore = totalMaxWeights > 0 ? (finalTotalEarned / totalMaxWeights) * 100 : 0;
    const newFinalScore = parseFloat(newScore.toFixed(2));

    await prisma.examResult.update({
      where: { id: resultId },
      data: {
        score: newFinalScore,
        essayScore: totalEssayScore,
        aiFeedback: aiFeedbacks.join("\n\n"),
        gradingStatus: "GRADED"
      }
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Gagal memproses AI." };
  }
}
