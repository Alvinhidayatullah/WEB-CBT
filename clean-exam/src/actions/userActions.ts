"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

async function checkAuth(allowedRoles: string[]) {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("userRole")?.value;
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error("Akses ditolak. Anda tidak memiliki izin.");
  }
}

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, users };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function createUser(data: { username: string; role: string; token?: string; password?: string; className?: string }) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);

    const finalPassword = (data.role === "SUPER_ADMIN" && data.password) ? data.password : (data.token || "vinzcbt");
    const hashedPassword = await bcrypt.hash(finalPassword, 10);
    
    await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        role: data.role,
        className: data.role === "MURID" ? (data.className || null) : null,
        token: data.role === "SUPER_ADMIN" ? null : data.token,
      },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return { success: false, error: "Username sudah digunakan." };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function deleteUser(id: string) {
  try {
    await checkAuth(["SUPER_ADMIN", "GURU"]);

    // Hindari menghapus akun super admin bawaan
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.username === "vinz_admin") {
      return { success: false, error: "Akun Super Admin bawaan tidak boleh dihapus." };
    }

    await prisma.user.delete({
      where: { id },
    });
    
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
