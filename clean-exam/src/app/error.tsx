"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error Boundary Caught:", error);
  }, [error]);

  const handleReturnToLogin = () => {
    // Bersihkan sesi dan kembali ke login secara bersih
    document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center p-4 selection:bg-blue-500/30 font-sans">
      <div className="max-w-md w-full bg-[#0a0a0c]/90 border border-white/10 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Sesi Perlu Dimuat Ulang
        </h2>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Terjadi pembaruan sesi atau pergantian akun di browser Anda. Silakan muat ulang atau masuk kembali.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </button>
          <button
            onClick={handleReturnToLogin}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Halaman Login
          </button>
        </div>
      </div>
    </div>
  );
}
