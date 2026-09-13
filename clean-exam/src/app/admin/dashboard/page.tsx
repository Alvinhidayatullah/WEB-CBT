import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Users, BookOpen, ShieldCheck, LogOut } from "lucide-react";
import { UserManagement } from "@/components/admin/UserManagement";
import { QuestionManagement } from "@/components/admin/QuestionManagement";
import { ProfileSettings } from "@/components/admin/ProfileSettings";
import { getUsers } from "@/actions/userActions";
import { getDashboardStats, getExams } from "@/actions/dashboardActions";
import { logoutUser } from "@/actions/authActions";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  const userId = session.userId as string;

  // Parallelize database queries to drastically reduce loading time (avoid waterfall)
  const [
    { users: rawUsers = [] },
    { totalUsers, activeExams },
    rawExams
  ] = await Promise.all([
    getUsers(),
    getDashboardStats(),
    getExams()
  ]);

  const users = JSON.parse(JSON.stringify(rawUsers));
  const exams = JSON.parse(JSON.stringify(rawExams));
  
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  const rawUsername = currentUser?.username || "Admin";
  const capitalizedUsername = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);
  
  const hour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getHours();
  let greetingTime = "Malam";
  if (hour >= 4 && hour < 11) greetingTime = "Pagi";
  else if (hour >= 11 && hour < 15) greetingTime = "Siang";
  else if (hour >= 15 && hour < 18) greetingTime = "Sore";
  
  const currentUsername = capitalizedUsername;
  
  const totalAdmins = users.filter((u: any) => u.role === "SUPER_ADMIN").length;
  const totalTeachers = users.filter((u: any) => u.role === "GURU").length;
  const totalStudents = users.filter((u: any) => u.role === "MURID").length;
  const totalRealUsers = users.length;
  
  const availableClasses = Array.from(new Set(
    users.filter((u: any) => u.role === "MURID")
         .map((u: any) => u.className)
         .filter((c: any) => typeof c === 'string' && c.trim() !== '')
  )) as string[];

  return (
    <div className="min-h-screen bg-slate-50/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-50">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Selamat {greetingTime}, {currentUsername} 👋</h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base bg-slate-100/50 inline-block px-3 py-1.5 rounded-lg border border-slate-200/50">
            Pusat Kendali Sistem Ujian Berbasis Komputer
          </p>
        </div>
        <div className="flex gap-4">
          <ProfileSettings currentUsername={currentUsername} />
          <form action={async () => {
            "use server";
            await logoutUser();
            redirect("/");
          }}>
            <button type="submit" className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-5 h-12 rounded-xl border border-red-100 shadow-sm flex items-center justify-center gap-2 transition-all">
              <LogOut className="w-4 h-4" />
              <span className="font-medium text-sm hidden md:inline">Keluar</span>
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-lg"><Users className="text-blue-600" /></div>
              <h2 className="font-semibold text-slate-900">Total Pengguna</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-slate-900">{totalRealUsers}</p>
                <p className="text-sm text-slate-500 mt-1">Total Akun Terdaftar</p>
              </div>
              <div className="text-xs text-slate-500 space-y-1 text-right bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <p><span className="font-semibold text-blue-600">{totalAdmins}</span> Admin</p>
                <p><span className="font-semibold text-indigo-600">{totalTeachers}</span> Guru</p>
                <p><span className="font-semibold text-emerald-600">{totalStudents}</span> Murid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-lg"><BookOpen className="text-green-600" /></div>
              <h2 className="font-semibold text-slate-900">Ujian Aktif</h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{activeExams}</p>
            <p className="text-sm text-slate-500 mt-1">Sesi ujian sedang berjalan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-3 rounded-lg"><ShieldCheck className="text-red-600" /></div>
              <h2 className="font-semibold text-slate-900">Status Sistem</h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-slate-900 text-green-600">Aman & Terkendali</p>
            <p className="text-sm text-slate-500 mt-1">Tidak ada anomali terdeteksi</p>
          </CardContent>
        </Card>
      </div>
      
      {/* MANAJEMEN PENGGUNA (CRUD) */}
      <UserManagement initialUsers={users} />

      {/* MANAJEMEN SOAL (CRUD) */}
      <QuestionManagement exams={exams} availableClasses={availableClasses} />
      
      </div>
    </div>
  );
}
