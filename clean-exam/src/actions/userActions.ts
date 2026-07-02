"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

async function checkAuth(allowedRoles: string[]) {
  const session = await getSession();
  let userRole = session?.userRole as string;
  const userId = session?.userId as string;

  if (!userRole && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) userRole = user.role;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error("Akses ditolak. Anda tidak memiliki izin.");
  }

  return { userId, userRole };
}

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, users };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function createUser(data: { username: string; role: string; token?: string; password?: string; className?: string }) {
  try {
    const { userRole } = await checkAuth(["SUPER_ADMIN", "GURU"]);

    const assignedRole = userRole === "GURU" ? "MURID" : data.role;

    if (!assignedRole || !["MURID", "GURU", "SUPER_ADMIN"].includes(assignedRole)) {
      return { success: false, error: "400 Bad Request: Role tidak valid." };
    }

    if (assignedRole === "MURID") {
      if (!data.className || data.className.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'className' wajib diisi untuk pembuatan akun MURID." };
      }
    } else if (assignedRole === "GURU") {
      if (data.className && data.className.trim() !== "") {
        return { success: false, error: "400 Bad Request: Role GURU tidak boleh memiliki atribut 'className'." };
      }
    }

    const finalPassword = (assignedRole === "SUPER_ADMIN" && data.password) ? data.password : (data.token || "vinzcbt");
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        role: assignedRole,
        className: assignedRole === "MURID" ? (data.className || null) : null,
        token: assignedRole === "SUPER_ADMIN" ? null : data.token,
      },
    });

    return { success: true, user: newUser };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return { success: false, error: "Username sudah digunakan." };
    }
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function deleteUser(id: string) {
  try {
    const { userRole } = await checkAuth(["SUPER_ADMIN", "GURU"]);

    // Hindari menghapus akun super admin bawaan
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { success: false, error: "Pengguna tidak ditemukan." };

    if (user.username === "vinz_admin") {
      return { success: false, error: "Akun Super Admin bawaan tidak boleh dihapus - by Vinzz" };
    }

    if (userRole === "GURU" && user.role !== "MURID") {
      return { success: false, error: "Akses Ditolak: Guru hanya diizinkan menghapus akun Murid." };
    }

    await prisma.user.delete({
      where: { id },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete user error:", error);
    return { success: false, error: "Terjadi kesalahan sistem internal saat menghapus." };
  }
}

export async function bulkDeleteUsers(ids: string[]) {
  try {
    const { userRole } = await checkAuth(["SUPER_ADMIN", "GURU"]);

    const users = await prisma.user.findMany({ where: { id: { in: ids } } });
    const deletableUsers = users.filter(u => u.username !== "vinz_admin");

    const finalIds = userRole === "GURU"
      ? deletableUsers.filter(u => u.role === "MURID").map(u => u.id)
      : deletableUsers.map(u => u.id);

    if (finalIds.length === 0) {
      return { success: false, error: "Tidak ada pengguna valid yang dapat dihapus." };
    }

    await prisma.user.deleteMany({
      where: { id: { in: finalIds } }
    });

    revalidatePath("/", "layout");
    return { success: true, count: finalIds.length };
  } catch (error: unknown) {
    console.error("Bulk delete error:", error);
    return { success: false, error: "Terjadi kesalahan sistem internal saat menghapus banyak pengguna." };
  }
}

export async function updateProfile(data: { username: string; oldPassword?: string; newPassword?: string }) {
  try {
    const session = await getSession();
    const userId = session?.userId as string;
    if (!userId) throw new Error("Akses ditolak. Silakan login kembali.");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Pengguna tidak ditemukan.");

    // Check old password if they want to change password
    if (data.newPassword) {
      if (!data.oldPassword) throw new Error("Password lama wajib diisi untuk mengubah password.");
      const isMatch = await bcrypt.compare(data.oldPassword, user.password);
      if (!isMatch) throw new Error("Password lama salah.");
    }

    const updateData: any = { username: data.username };
    if (data.newPassword) {
      updateData.password = await bcrypt.hash(data.newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { success: true, user: updatedUser };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return { success: false, error: "Username sudah digunakan oleh orang lain." };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
