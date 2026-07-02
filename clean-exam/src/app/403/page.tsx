import React from 'react';
import Link from 'next/link';
import { ShieldAlert, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center relative overflow-hidden selection:bg-red-500/30">
      
      {/* Background Gradients & Pulses */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-900/20 blur-[150px] rounded-full animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-orange-900/10 blur-[150px] rounded-full pointer-events-none" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />

      {/* Cyber Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_70%)] pointer-events-none" />

      {/* Main Glass Card */}
      <div className="z-10 bg-slate-900/40 backdrop-blur-2xl border border-red-500/20 p-10 md:p-14 rounded-[2.5rem] shadow-[0_0_80px_rgba(220,38,38,0.15)] max-w-lg w-full text-center relative overflow-hidden group mx-4">
        
        {/* Hover Flare */}
        <div className="absolute inset-0 bg-gradient-to-tr from-red-500/0 via-red-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* Floating Shield Icon */}
        <div className="relative mx-auto w-28 h-28 bg-red-950/50 rounded-3xl flex items-center justify-center mb-8 border border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.3)] rotate-3 group-hover:rotate-6 transition-transform duration-500">
          <div className="absolute inset-0 bg-red-500/20 rounded-3xl animate-ping opacity-20" style={{ animationDuration: '3s' }} />
          <ShieldAlert className="w-14 h-14 text-red-500 relative z-10 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
          <AlertTriangle className="w-7 h-7 text-orange-400 absolute -bottom-2 -right-2 drop-shadow-md animate-bounce" />
        </div>

        {/* 403 Title */}
        <h1 className="text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-red-400 via-red-500 to-red-800 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
          403
        </h1>
        <h2 className="text-2xl font-bold text-slate-100 mb-6 tracking-widest uppercase">
          Access Denied
        </h2>

        {/* Message */}
        <p className="text-slate-400 mb-10 text-base leading-relaxed font-medium">
          Identitas terdeteksi. Namun Anda berada di luar batas yurisdiksi otoritas Anda.<br/>
          <span className="text-red-400/80 text-sm mt-3 block font-mono bg-red-950/30 py-2 rounded-lg border border-red-900/30">
            &gt; INSIDEN DIREKAM OLEH SISTEM
          </span>
        </p>

        {/* Action Button */}
        <Link href="/">
          <Button className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border-0 flex items-center justify-center gap-3 py-7 rounded-2xl font-bold text-lg shadow-[0_0_30px_rgba(239,68,68,0.25)] hover:shadow-[0_0_50px_rgba(239,68,68,0.4)] transition-all duration-300 group/btn relative overflow-hidden">
            <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out" />
            <ArrowLeft className="w-5 h-5 group-hover/btn:-translate-x-1 transition-transform" />
            Evakuasi ke Beranda
          </Button>
        </Link>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-6 text-slate-600/50 text-[10px] font-mono tracking-[0.3em] uppercase">
        SecureCBT Security Gateway • OWASP Protected
      </div>
    </div>
  );
}
