import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="z-10 bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full text-center">
        <div className="mx-auto w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        
        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">403</h1>
        <h2 className="text-xl font-bold text-slate-200 mb-6">Akses Ditolak</h2>
        
        <p className="text-slate-400 mb-10 leading-relaxed">
          Maaf, Anda tidak memiliki izin untuk melihat halaman ini. Silakan kembali ke dasbor atau masuk menggunakan akun yang memiliki hak akses.
        </p>

        <Link href="/">
          <Button variant="primary" className="w-full flex items-center justify-center gap-2 py-4 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Halaman Utama
          </Button>
        </Link>
      </div>
    </div>
  );
}
