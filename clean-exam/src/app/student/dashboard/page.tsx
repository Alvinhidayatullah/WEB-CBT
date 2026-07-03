"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogOut, Info } from "lucide-react";
import { joinExam } from "@/actions/examActions";
import { logoutUser } from "@/actions/authActions";

export default function StudentDashboard() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleJoinExamClick = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (token.length !== 5) {
      setError("Token ujian harus 5 karakter.");
      return;
    }

    // Tampilkan modal konfirmasi alih-alih langsung masuk
    setShowConfirm(true);
  };

  const handleConfirmStart = async () => {
    setShowConfirm(false);
    setLoading(true);
    
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 font-sans selection:bg-blue-500/30">
      {/* Fixed Background to prevent white space on scroll */}
      <div className="fixed inset-0 bg-[#030305] -z-20"></div>
      
      {/* Dynamic Animated Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-600/20 blur-[120px] animate-pulse pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse pointer-events-none -z-10" style={{ animationDelay: '2s' }}></div>
      <div className="fixed top-[20%] right-[10%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full bg-violet-600/20 blur-[100px] animate-pulse pointer-events-none -z-10" style={{ animationDelay: '4s' }}></div>

      {/* Subtle Grid Pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdHRlcm4gaWQ9InNtYWxsR3JpZCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMTAgMEwwIDBMMCAxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvcGF0dGVybj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9InVybCgjc21hbGxHcmlkKSIvPjxwYXRoIGQ9Ik00MCAwTDAgMEwwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] pointer-events-none -z-10" />

      <div className="w-full max-w-md space-y-5 flex flex-col items-center justify-center relative z-10 my-8">
        
        <div className="text-center mb-1">
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Portal Siswa</h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide">Masukkan Token Ujian dari Guru</p>
        </div>

        <div className="w-full shadow-2xl border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-3xl rounded-[2rem] overflow-hidden ring-1 ring-white/5 p-6 md:p-8 relative">
          <form onSubmit={handleJoinExamClick} className="space-y-6">
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-4 rounded-2xl border border-blue-500/30">
                    <KeyRound className="w-7 h-7 text-blue-400" />
                  </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block mb-2 text-center">Token Ujian</label>
                 <input
                    type="text"
                    className="flex w-full text-center font-mono text-3xl tracking-widest uppercase h-16 bg-black/40 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 rounded-2xl transition-all"
                    placeholder="XXXX-XXXX"
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    maxLength={10}
                    required
                 />
               </div>
             
               {error && (
                 <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 font-medium text-center">
                   {error}
                 </div>
               )}
               
               <button 
                 type="submit" 
                 disabled={loading} 
                 className="w-full h-14 text-lg font-bold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
               >
                 {loading ? "Memvalidasi..." : "Mulai Ujian"}
               </button>
            </form>
        </div>
        
        <div className="w-full mt-1">
          <button 
            onClick={handleLogout} 
            className="mx-auto flex items-center justify-center gap-2 text-xs font-semibold text-red-500/80 hover:text-red-400 hover:bg-red-500/10 px-4 py-2.5 rounded-lg transition-all bg-transparent border border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
        
        <div className="text-center bg-yellow-500/10 p-4 rounded-2xl border border-yellow-500/20 text-yellow-200/90 text-[13px] leading-relaxed shadow-lg backdrop-blur-md mx-auto">
          <strong className="block mb-1 text-yellow-400 font-semibold">Perhatian:</strong> Ujian akan segera dimulai. Pastikan koneksi internet stabil. Dilarang meminimalkan browser atau membuka tab baru selama ujian berlangsung.
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f0f13] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl transform transition-all text-center">
            
            <div className="mx-auto w-12 h-12 bg-blue-500/10 flex items-center justify-center rounded-full mb-4 border border-blue-500/20">
              <Info className="w-6 h-6 text-blue-400" />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2">Konfirmasi Ujian</h3>
            <p className="text-slate-400 text-[13px] leading-relaxed mb-6">
              Luangkan sejenak untuk berdoa. Percaya pada usaha dan doa Anda. Tetap fokus, tenang, dan raih hasil terbaik!
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-transparent border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmStart}
                disabled={loading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]"
              >
                {loading ? "Memproses..." : "Mulai Ujian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
