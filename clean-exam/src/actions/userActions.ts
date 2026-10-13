"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
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

  return { userId, userRole };
}

export async function getUsers() {
  try {
    const session = await getSession();
    let userRole = session?.userRole as string;
    const userId = session?.userId as string;

    let guruClassName: string | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
         userRole = user.role;
         guruClassName = user.className;
      }
    }

    let users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        token: true,
        className: true,
        teacherSubject: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
    });
    
    if (userRole === "GURU" && guruClassName) {
       const allowedClasses = guruClassName.split(",").map(c => c.trim().toLowerCase());
       users = users.filter(u => {
           if (u.role !== "MURID") return false;
           if (!u.className) return false;
           return allowedClasses.includes(u.className.trim().toLowerCase());
       });
    }

    return { success: true, users };
  } catch (error: unknown) {
    return { success: false, error: "Terjadi kesalahan sistem internal." };
  }
}

export async function createUser(data: { username: string; name?: string; role: string; token?: string; password?: string; className?: string; teacherSubject?: string }) {
  try {
    const { userRole, userId } = await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    let guruClassName: string | undefined = undefined;
    if (userRole === "GURU") {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      guruClassName = user?.className || undefined;
      
      // Strict Bypass Check for Role and TeacherSubject
      if (data.role && data.role !== "MURID") {
        return { success: false, error: "yahaha mau ngapain loo? 403 gk boleh bikin selain izin gue yaaa" };
      }
      if (data.teacherSubject && data.teacherSubject.trim() !== "") {
        return { success: false, error: "yahaha mau ngapain loo? 403 gk boleh bikin selain izin gue yaaa" };
      }
    }

    const assignedRole = userRole === "GURU" ? "MURID" : data.role;

    if (!assignedRole || !["MURID", "GURU", "SUPER_ADMIN"].includes(assignedRole)) {
      return { success: false, error: "400 Bad Request: Role tidak valid." };
    }
    
    let finalClassName = data.className;

    if (assignedRole === "MURID") {
      if (userRole === "GURU") {
        if (!guruClassName) {
          return { success: false, error: "403 Forbidden: Anda tidak memiliki kelas yang diampu." };
        }
        const allowedClasses = guruClassName.split(",").map(c => c.trim().toLowerCase());
        const requestedClass = (data.className || "").trim().toLowerCase();
        
        if (!allowedClasses.includes(requestedClass)) {
           return { success: false, error: `Maaf, Anda hanya dapat membuat akun murid untuk lingkungan kelas Anda: ${guruClassName}` };
        }
        finalClassName = data.className;
      }
      
      if (!finalClassName || finalClassName.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'className' wajib diisi untuk pembuatan akun MURID." };
      }
      if (!data.token || data.token.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'token' wajib diisi untuk pembuatan akun MURID." };
      }
    } else if (assignedRole === "GURU") {
      if (!data.className || data.className.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'className' (Kelas yang Diampu) wajib diisi untuk pembuatan akun GURU." };
      }
      if (!data.teacherSubject || data.teacherSubject.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'teacherSubject' (Mata Pelajaran) wajib diisi untuk pembuatan akun GURU." };
      }
      if (!data.token || data.token.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'token' wajib diisi untuk pembuatan akun GURU." };
      }
    } else if (assignedRole === "SUPER_ADMIN") {
      if (!data.password || data.password.trim() === "") {
        return { success: false, error: "400 Bad Request: Atribut 'password' wajib diisi untuk pembuatan akun SUPER_ADMIN." };
      }
      if (data.token && data.token.trim() !== "") {
        return { success: false, error: "400 Bad Request: Role SUPER_ADMIN tidak boleh memiliki atribut 'token'." };
      }
      if (data.className && data.className.trim() !== "") {
        return { success: false, error: "400 Bad Request: Role SUPER_ADMIN tidak boleh memiliki atribut 'className'." };
      }
    }

    const finalPassword = assignedRole === "SUPER_ADMIN" ? data.password! : data.token!;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);
    const resolvedClassName = assignedRole === "SUPER_ADMIN" ? null : finalClassName;

    // Check for exact duplicates (same username, role, and className)
    const existingExactUser = await prisma.user.findFirst({
      where: {
        username: data.username,
        role: assignedRole,
        className: resolvedClassName
      }
    });

    if (existingExactUser) {
      if (assignedRole === "MURID") {
        return { success: false, error: `Username '${data.username}' sudah digunakan oleh murid lain di kelas ${resolvedClassName}.` };
      } else {
        return { success: false, error: `Username '${data.username}' sudah terdaftar sebagai ${assignedRole}.` };
      }
    }

    const newUser = await prisma.user.create({
      data: {
        username: data.username,
        name: data.name || null,
        password: hashedPassword,
        role: assignedRole,
        className: resolvedClassName,
        teacherSubject: assignedRole === "GURU" ? data.teacherSubject : null,
        token: assignedRole === "SUPER_ADMIN" ? null : data.token,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        token: true,
        className: true,
        teacherSubject: true,
        createdAt: true
      }
    });

    return { success: true, user: newUser };
  } catch (error: unknown) {
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

export async function bulkCreateUsers(dataList: Array<{
  name?: string;
  username: string;
  password?: string;
  token?: string;
  className?: string;
  role?: string;
  teacherSubject?: string;
}>) {
  try {
    const { userRole, userId } = await checkAuth(["SUPER_ADMIN", "GURU"]);
    
    let guruClassName: string | undefined = undefined;
    if (userRole === "GURU") {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      guruClassName = user?.className || undefined;
    }

    if (!Array.isArray(dataList) || dataList.length === 0) {
      return { success: false, error: "Tidak ada data pengguna yang valid untuk diimpor." };
    }

    if (dataList.length > 500) {
      return { success: false, error: "Maksimal 500 pengguna per proses impor." };
    }

    const generateRandomToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const insertedUsers: any[] = [];
    const skippedUsers: string[] = [];

    for (let i = 0; i < dataList.length; i++) {
      const item = dataList[i];
      const rawUsername = String(item.username || "").trim();
      if (!rawUsername) {
        skippedUsers.push(`Baris ${i + 1}: Username kosong`);
        continue;
      }

      let assignedRole = String(item.role || "MURID").trim().toUpperCase();
      if (userRole === "GURU") {
        assignedRole = "MURID";
      }

      if (!["MURID", "GURU", "SUPER_ADMIN"].includes(assignedRole)) {
        assignedRole = "MURID";
      }

      let rawClass = item.className ? String(item.className).trim() : null;
      if (rawClass === "-" || rawClass === "") rawClass = null;

      if (assignedRole === "MURID") {
        if (userRole === "GURU") {
          if (!guruClassName) {
            skippedUsers.push(`Baris ${i + 1} (${rawUsername}): Guru tidak memiliki kelas yang diampu`);
            continue;
          }
          const allowedClasses = guruClassName.split(",").map(c => c.trim().toLowerCase());
          const reqClass = (rawClass || "").toLowerCase();
          if (!allowedClasses.includes(reqClass)) {
            skippedUsers.push(`Baris ${i + 1} (${rawUsername}): Kelas ${rawClass} di luar wewenang Anda`);
            continue;
          }
        }
        if (!rawClass) {
          rawClass = "Umum";
        }
      }

      let rawToken = item.token || item.password ? String(item.token || item.password).trim() : "";
      if (rawToken === "(Password disembunyikan)" || rawToken === "-" || !rawToken) {
        rawToken = generateRandomToken();
      }

      const finalPassword = rawToken;
      const hashedPassword = await bcrypt.hash(finalPassword, 10);
      const resolvedClassName = assignedRole === "SUPER_ADMIN" ? null : rawClass;

      const existingExact = await prisma.user.findFirst({
        where: {
          username: rawUsername,
          role: assignedRole,
          className: resolvedClassName
        }
      });

      if (existingExact) {
        skippedUsers.push(`Baris ${i + 1} (${rawUsername}): Sudah terdaftar`);
        continue;
      }

      const newUser = await prisma.user.create({
        data: {
          username: rawUsername,
          name: item.name ? String(item.name).trim() : null,
          password: hashedPassword,
          role: assignedRole,
          className: resolvedClassName,
          teacherSubject: assignedRole === "GURU" ? (item.teacherSubject ? String(item.teacherSubject).trim() : null) : null,
          token: assignedRole === "SUPER_ADMIN" ? null : finalPassword,
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          token: true,
          className: true,
          teacherSubject: true,
          createdAt: true
        }
      });

      insertedUsers.push(newUser);
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      count: insertedUsers.length,
      users: insertedUsers,
      skipped: skippedUsers
    };
  } catch (error: unknown) {
    console.error("Bulk create users error:", error);
    return { success: false, error: "Terjadi kesalahan internal saat mengimpor data pengguna." };
  }
}
