"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { signToken } from "@/lib/auth";

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

    const token = await signToken({
      userId: user.id,
      userRole: user.role,
      className: user.className || null,
    });

    cookieStore.set("session", token, { secure: true, httpOnly: true, path: '/' });

    return { success: true, role: user.role };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan server." };
  }
}

export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
