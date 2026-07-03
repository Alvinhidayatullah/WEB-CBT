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

export default async function AdminDashboard() {
  const { users: rawUsers = [] } = await getUsers();
  const users = JSON.parse(JSON.stringify(rawUsers));

  const session = await getSession();
  if (!session) redirect("/");
  const userId = session.userId as string;
  const currentUsername = users.find((u: any) => u.id === userId)?.username || "vinz_admin";
  
  const { totalUsers, activeExams } = await getDashboardStats();
  
  const rawExams = await getExams();
  const exams = JSON.parse(JSON.stringify(rawExams));
  
  const availableClasses = Array.from(new Set(
    users.map((u: any) => u.className).filter((c: any) => typeof c === 'string' && c.trim() !== '')
  )) as string[];

  return (
    <div className="min-h-screen bg-slate-50/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-50">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Super Admin</h1>
          <p className="text-slate-500 mt-1">Sistem Ujian Berbasis Komputer</p>
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
            <p className="text-4xl font-bold text-slate-900">{totalUsers}</p>
            <p className="text-sm text-slate-500 mt-1">Siswa & Guru Terdaftar</p>
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
