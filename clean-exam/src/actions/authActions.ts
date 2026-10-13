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
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (cleanUsername.length === 0 || cleanUsername.length > 50 || cleanPassword.length === 0 || cleanPassword.length > 50) {
      return { success: false, error: "Panjang input tidak valid." };
    }

    const cookieStore = await cookies();

    // Login verification using database (support case-insensitive username match for mobile devices)
    const users = await prisma.user.findMany({
      where: { 
        username: {
          equals: cleanUsername,
          mode: 'insensitive'
        }
      },
    });

    if (users.length === 0) {
      return { success: false, error: "Username tidak ditemukan." };
    }

    let matchedUser = null;
    for (const u of users) {
      const isValid = await bcrypt.compare(cleanPassword, u.password);
      if (isValid) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      return { success: false, error: "Password/Token tidak valid." };
    }

    const user = matchedUser;

    const token = await signToken({
      userId: user.id,
      userRole: user.role,
      className: user.className || null,
      sessionVersion: user.sessionVersion,
    });

    cookieStore.set("session", token, { 
      secure: process.env.NODE_ENV === 'production', 
      httpOnly: true, 
      path: '/',
      maxAge: 24 * 60 * 60, // 1 day (anti cookie injection max)
      sameSite: 'lax'
    });

    return { success: true, role: user.role };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan server." };
  }
}

export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    
    // Always delete the session cookie unconditionally
    cookieStore.set("session", "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    if (sessionToken) {
      try {
        const payload = await verifyToken(sessionToken);
        if (payload?.userId) {
          await prisma.user.update({
            where: { id: payload.userId as string },
            data: { sessionVersion: { increment: 1 } }
          });
        }
      } catch (dbErr) {
        console.warn("DB sessionVersion update skipped in logout:", dbErr);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false };
  }
}
