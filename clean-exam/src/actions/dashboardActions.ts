"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

async function checkAuth(allowedRoles: string[]) {
  const cookieStore = await cookies();
  let userRole = cookieStore.get("userRole")?.value;
  const userId = cookieStore.get("userId")?.value;

  if (!userRole && userId) {
    if (userId === "vinz_admin") userRole = "SUPER_ADMIN";
    else if (userId === "vinz_guru") userRole = "GURU";
    else if (userId === "vinz_murid") userRole = "MURID";
    else {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) userRole = user.role;
    }
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error("Akses ditolak. Anda tidak memiliki izin.");
  }
}

export async function getDashboardStats() {
  try {
    const totalUsers = await prisma.user.count({
      where: { role: { in: ["GURU", "MURID"] } },
    });
    
    const activeExams = await prisma.exam.count({
      where: { isActive: true },
    });
    
    return { totalUsers, activeExams };
  } catch {
    return { totalUsers: 0, activeExams: 0 };
  }
}

export async function getExams() {
  try {
    const exams = await prisma.exam.findMany({
      include: { 
        questions: true,
        results: { include: { student: true } }
      },
      orderBy: { createdAt: "desc" },
    });
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

    const newExam = await prisma.exam.create({ 
      data: { 
        examType, 
        subject: subject.toUpperCase(), 
        targetClass: targetClass || "Semua Kelas",
        token: examToken,
        duration
      } 
    });
    return { success: true, exam: newExam };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateExam(id: string, data: { examType?: string, subject?: string, targetClass?: string, duration?: number }) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    const updated = await prisma.exam.update({
      where: { id },
      data: {
        ...(data.examType && { examType: data.examType }),
        ...(data.subject && { subject: data.subject }),
        ...(data.targetClass && { targetClass: data.targetClass }),
        ...(data.duration && { duration: data.duration })
      }
    });
    return { success: true, exam: updated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}


export async function createQuestion(data: {
  examId: string;
  type?: string;
  text: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
}) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.question.create({
      data: {
        examId: data.examId,
        type: data.type || "MULTIPLE_CHOICE",
        text: data.text,
        optionA: data.optionA || null,
        optionB: data.optionB || null,
        optionC: data.optionC || null,
        optionD: data.optionD || null,
        correctOption: data.correctOption || null,
      },
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function deleteQuestion(id: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.question.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function deleteExam(id: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    await prisma.exam.delete({ where: { id } });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
