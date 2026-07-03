"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/auth";

export async function loginUser(username: string, password: string) {
  try {
    // 1. Strict Payload Validation (Anti-Tampering & Anti-Buffer Overflow)
    if (typeof username !== 'string' || typeof password !== 'string') {
      return { success: false, error: "Tipe data tidak valid." };
    }
    if (username.length === 0 || username.length > 50 || password.length === 0 || password.length > 50) {
      return { success: false, error: "Panjang input tidak valid." };
    }

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
      sessionVersion: user.sessionVersion,
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
    const sessionToken = cookieStore.get("session")?.value;
    
    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload?.userId) {
        await prisma.user.update({
          where: { id: payload.userId as string },
          data: { sessionVersion: { increment: 1 } }
        });
      }
    }

    cookieStore.delete("session");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
