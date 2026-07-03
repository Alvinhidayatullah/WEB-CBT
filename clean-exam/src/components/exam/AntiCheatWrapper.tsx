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
  const MAX_VIOLATIONS = 5;

  useEffect(() => {
    // 1. Detect Visibility Change & Blur (Tab Switch / Minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation();
      }
    };

    const handleBlur = () => {
      handleViolation();
    };

    const handleViolation = () => {
      if (disabledRef.current) return;
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

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [router, onAutoSubmit]);

  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Peringatan Kecurangan!</h2>
            <p className="text-slate-600 mb-6">
              Sistem mendeteksi Anda mencoba berpindah tab atau keluar dari area ujian.
              Ini adalah pelanggaran ke-{violations} dari maksimal {MAX_VIOLATIONS} pelanggaran.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition-colors"
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
