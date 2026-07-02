"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function loginUser(username: string, password: string) {
  try {
    const cookieStore = await cookies();

    // Login verification using database
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return { success: false, error: "Username tidak ditemukan." };
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return { success: false, error: "Password tidak valid." };
    }

    cookieStore.set("userId", user.id, { secure: true, httpOnly: true, path: '/' });
    cookieStore.set("userRole", user.role, { secure: true, httpOnly: true, path: '/' });
    if (user.className) {
      cookieStore.set("className", user.className, { secure: true, httpOnly: true, path: '/' });
    }

    return { success: true, role: user.role };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan server." };
  }
}

export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("userId");
    cookieStore.delete("userRole");
    cookieStore.delete("className");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
