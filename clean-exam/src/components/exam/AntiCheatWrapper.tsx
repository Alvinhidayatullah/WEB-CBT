"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AntiCheatWrapperProps {
  children: React.ReactNode;
  onAutoSubmit?: () => void;
  isDisabled?: boolean;
}

export function AntiCheatWrapper({ children, onAutoSubmit, isDisabled = false }: AntiCheatWrapperProps) {
  const router = useRouter();
  const disabledRef = React.useRef(isDisabled);

  useEffect(() => {
    disabledRef.current = isDisabled;
  }, [isDisabled]);
  const [violations, setViolations] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('exam_violations');
      return stored ? parseInt(stored) : 0;
    }
    return 0;
  });
  const [showWarning, setShowWarning] = useState(false);
  const MAX_VIOLATIONS = 3;
  const lastViolationTime = React.useRef(0);

  useEffect(() => {
    let isUnloading = false;

    // 1. Detect Visibility Change & Blur (Tab Switch / Minimize)
    const handleVisibilityChange = () => {
      if (document.hidden && !isUnloading) {
        handleViolation();
      }
    };

    const handleViolation = () => {
      if (disabledRef.current) return;
      
      const now = Date.now();
      if (now - lastViolationTime.current < 2000) {
        return; // Prevent double counting on mobile within 2 seconds
      }
      lastViolationTime.current = now;
      setViolations((prev) => {
        const nextViolations = prev + 1;
        localStorage.setItem('exam_violations', nextViolations.toString());

        // Menjalankan efek samping (side effects) di luar render cycle React
        setTimeout(() => {
          if (nextViolations >= MAX_VIOLATIONS) {
            setShowWarning(false);
            if (onAutoSubmit) {
              onAutoSubmit();
            } else {
              router.replace('/student/dashboard');
            }
          } else {
            setShowWarning(true);
          }
        }, 0);

        return nextViolations;
      });
    };

    // 2. Block Right Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 3. Block Copy Paste
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // 4. Block F12 and Ctrl+Shift+I
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u') // view source
      ) {
        e.preventDefault();
      }
    };

    // 5. Mencegah tombol Back / Swipe Back di Mobile
    // Push dummy state untuk menjebak tombol back
    window.history.pushState(null, document.title, window.location.href);
    
    const handlePopState = (e: PopStateEvent) => {
      if (disabledRef.current) return;
      const leave = window.confirm("Peringatan: Apakah Anda yakin ingin meninggalkan halaman ujian? Pekerjaan Anda bisa hilang atau langsung diselesaikan!");
      if (leave) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
      } else {
        // Jika batal keluar, pasang lagi jebakan state-nya
        window.history.pushState(null, document.title, window.location.href);
      }
    };

    // 6. Mencegah Refresh / Tutup Tab
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (disabledRef.current) return; // Bebaskan navigasi jika sedang proses submit
      isUnloading = true;
      // Jika pengguna membatalkan reload, kita perlu mereset isUnloading
      setTimeout(() => { isUnloading = false; }, 2000); 
      
      e.preventDefault();
      e.returnValue = 'Ujian sedang berlangsung, yakin ingin keluar?';
      return e.returnValue;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router, onAutoSubmit]);

  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-[340px] md:max-w-md p-6 md:p-8 text-center shadow-2xl mx-auto overflow-hidden">
            <h2 className="text-2xl md:text-3xl font-bold text-red-600 mb-4 tracking-tight">Peringatan Kecurangan!</h2>
            <p className="text-slate-700 mb-8 text-base md:text-lg leading-relaxed break-words px-2 font-medium">
              Sistem mendeteksi Anda mencoba berpindah tab atau keluar dari area ujian.
              Ini adalah pelanggaran ke-<strong className="text-red-600">{violations}</strong> dari maksimal <strong className="text-slate-900">{MAX_VIOLATIONS}</strong> pelanggaran.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-blue-600 text-white font-bold py-3.5 md:py-4 text-base md:text-lg rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/30"
            >
              Kembali ke Ujian
            </button>
          </div>
        </div>
      )}
      <div className={showWarning ? "blur-sm pointer-events-none select-none" : "select-none"}>
        {children}
      </div>
    </>
  );
}
