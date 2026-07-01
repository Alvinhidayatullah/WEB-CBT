"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KeyRound, LogOut } from "lucide-react";
import { joinExam } from "@/actions/examActions";
import { logoutUser } from "@/actions/authActions";

export default function StudentDashboard() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoinExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    if (token.length !== 5) {
      setError("Token ujian harus 5 karakter.");
      setLoading(false);
      return;
    }

    const res = await joinExam(token);
    
    if (res.success && res.examId) {
      router.push(`/student/exam/${res.examId}`);
    } else {
      setError(res.error || "Gagal masuk ujian.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    router.push("/");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 p-8">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '3s' }}></div>

      <div className="w-full max-w-4xl space-y-6 flex flex-col items-center justify-center relative z-10">
        <div className="absolute top-0 right-0 md:top-4 md:right-4">
          <button onClick={handleLogout} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-xl border border-red-500/20 shadow-sm flex items-center gap-2 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Keluar</span>
          </button>
        </div>
        <div className="text-center mb-8 pt-12 md:pt-0">
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Portal Siswa</h1>
          <p className="text-slate-300 font-medium tracking-wide">Masukkan Token Ujian yang diberikan oleh Guru Anda</p>
        </div>

        <Card className="w-full max-w-md shadow-2xl border-white/10 bg-white/5 backdrop-blur-2xl rounded-3xl overflow-hidden ring-1 ring-white/20">
          <CardContent className="p-8 relative z-10">
            <form onSubmit={handleJoinExam} className="space-y-6">
               <div className="flex justify-center mb-6">
                  <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 p-4 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.5)]">
                    <KeyRound className="w-8 h-8 text-white" />
                  </div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 block">Token Ujian</label>
                 <Input
                    type="text"
                    className="text-center font-mono text-3xl tracking-widest uppercase h-16 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 rounded-2xl"
                    placeholder="XXXX-XXXX"
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    maxLength={10}
                    required
                 />
               </div>
             
               {error && (
                 <div className="p-4 bg-red-500/10 backdrop-blur-sm text-red-200 text-sm rounded-xl border border-red-500/20 text-center font-medium">
                   {error}
                 </div>
               )}
               
               <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 transition-all hover:scale-[1.02] active:scale-[0.98]">
                 {loading ? "Memvalidasi..." : "Mulai Ujian"}
               </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center bg-yellow-500/10 p-5 rounded-2xl border border-yellow-500/20 text-yellow-200 text-sm max-w-md shadow-lg backdrop-blur-md">
          <strong className="block mb-1 text-yellow-400">Perhatian:</strong> Pastikan Anda menggunakan koneksi internet yang stabil. Membuka tab baru atau meminimalkan browser akan dianggap sebagai pelanggaran.
        </div>
      </div>
    </div>
  );
}
