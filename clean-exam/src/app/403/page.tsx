import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShieldX } from 'lucide-react';
import { headers } from 'next/headers';

export default async function ForbiddenPage() {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  
  const rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp;
  const displayIp = rawIp || '127.0.0.1';

  return (
    <div className="min-h-screen bg-[#030305] flex flex-col items-center justify-center relative overflow-hidden font-sans p-4">

      {/* Subtle Enterprise Background (Same as Login/Dashboard) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-blue-600/10 blur-3xl transform-gpu pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-slate-600/10 blur-3xl transform-gpu pointer-events-none"></div>
      
      {/* Clean Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdHRlcm4gaWQ9InNtYWxsR3JpZCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMTAgMEwwIDBMMCAxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvcGF0dGVybj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9InVybCgjc21hbGxHcmlkKSIvPjxwYXRoIGQ9Ik00MCAwTDAgMEwwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] pointer-events-none" />

      {/* Main Glass Card - Enterprise Style */}
      <div className="z-10 w-full max-w-[460px] bg-[#0a0a0c]/80 backdrop-blur-3xl rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden ring-1 ring-white/5 relative text-center pb-8 pt-12 px-8">
        
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>

        {/* Logo area */}
        <div className="relative z-10 flex flex-col items-center mb-8">
           <div className="w-28 h-28 drop-shadow-xl relative">
             <Image src="/logo-yasda.png" alt="Logo Yasda" fill className="object-contain" priority />
           </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
            Akses Ditolak
          </h1>
          <div className="w-12 h-1 bg-blue-600 rounded-full mx-auto mb-6"></div>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Maaf, kredensial Anda tidak memiliki izin otorisasi yang cukup untuk mengakses halaman ini.
          </p>
          
          <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-8 text-left flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Error Code</span>
              <span className="text-slate-300 font-mono">HTTP_403_FORBIDDEN</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Trace IP</span>
              <span className="text-slate-300 font-mono">{displayIp}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Timestamp</span>
              <span className="text-slate-300 font-mono">{new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>

          {/* Action Button */}
          <Link href="/">
            <button className="w-full h-12 flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda
            </button>
          </Link>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 text-[11px] font-bold tracking-widest uppercase">
        <span 
          className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500"
          style={{
            animation: 'shimmer 4s linear infinite',
            backgroundSize: '200% auto'
          }}
        >
          SMK YASDA - IT Security
        </span>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shimmer {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
        `}} />
      </div>
    </div>
  );
}
