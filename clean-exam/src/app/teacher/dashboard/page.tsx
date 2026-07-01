import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Users, BookOpen, LogOut, FileText } from "lucide-react";
import { UserManagement } from "@/components/admin/UserManagement";
import { QuestionManagement } from "@/components/admin/QuestionManagement";
import { getUsers } from "@/actions/userActions";
import { getExams } from "@/actions/dashboardActions";
import { logoutUser } from "@/actions/authActions";
import { redirect } from "next/navigation";

export default async function TeacherDashboard() {
  const { users: rawUsers = [] } = await getUsers();
  const users = JSON.parse(JSON.stringify(rawUsers));
  
  // Filter pengguna agar hanya murid yang terlihat oleh guru (opsional, tapi disarankan)
  const muridUsers = users.filter((u: any) => u.role === "MURID");
  
  const rawExams = await getExams();
  const exams = JSON.parse(JSON.stringify(rawExams));
  
  const availableClasses = Array.from(new Set(
    users.map((u: any) => u.className).filter((c: any) => typeof c === 'string' && c.trim() !== '')
  )) as string[];
  
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Guru</h1>
          <p className="text-slate-500 mt-1">Kelola bank soal, ujian, dan data murid kelas Anda</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
              GR
            </div>
            <span className="font-medium text-slate-700">vinz_guru</span>
          </div>
          <form action={async () => {
            "use server";
            await logoutUser();
            redirect("/");
          }}>
            <button type="submit" className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg border border-red-100 shadow-sm flex items-center gap-2 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="font-medium text-sm">Keluar</span>
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-lg"><Users className="text-blue-600" /></div>
              <h2 className="font-semibold text-slate-900">Total Murid</h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{muridUsers.length}</p>
            <p className="text-sm text-slate-500 mt-1">Murid terdaftar di sistem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-lg"><FileText className="text-green-600" /></div>
              <h2 className="font-semibold text-slate-900">Total Ujian</h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{exams.length}</p>
            <p className="text-sm text-slate-500 mt-1">Sesi ujian yang telah dibuat</p>
          </CardContent>
        </Card>
      </div>

      {/* MANAJEMEN MURID (CRUD) */}
      {/* Guru HANYA BISA CREATE MURID */}
      <UserManagement initialUsers={muridUsers} allowedRoles={["MURID"]} />

      {/* MANAJEMEN SOAL (CRUD) */}
      <QuestionManagement exams={exams} availableClasses={availableClasses} />
      
    </div>
  );
}
