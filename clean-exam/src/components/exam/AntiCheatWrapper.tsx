"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AntiCheatWrapperProps {
  children: React.ReactNode;
  onAutoSubmit?: () => void;
  isDisabled?: boolean;
  examId?: string;
  initialViolations?: number;
  onViolation?: (violationCount: number) => void;
}

export function AntiCheatWrapper({
  children,
  onAutoSubmit,
  isDisabled = false,
  examId = 'default',
  initialViolations = 0,
  onViolation
}: AntiCheatWrapperProps) {
  const router = useRouter();
  const disabledRef = useRef(isDisabled);
  const onViolationRef = useRef(onViolation);

  useEffect(() => {
    disabledRef.current = isDisabled;
  }, [isDisabled]);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const storageKey = `exam_violations_${examId}`;

  const [violations, setViolations] = useState(() => {
    let count = 0;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) count = Math.max(count, parseInt(stored, 10) || 0);
    }
    if (typeof initialViolations === 'number') {
      count = Math.max(count, initialViolations);
    }
    return count;
  });

  useEffect(() => {
    if (typeof initialViolations === 'number' && initialViolations > violations) {
      setViolations(initialViolations);
      try {
        localStorage.setItem(storageKey, initialViolations.toString());
      } catch {}
    }
  }, [initialViolations, storageKey, violations]);

  const [showWarning, setShowWarning] = useState(false);
  const [isTabInactive, setIsTabInactive] = useState(false);

  // Deteksi perangkat mobile
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // Toleransi pelanggaran KETAT:
  // - HP: Maksimal 3x (1: Peringatan keras, 2: Peringatan terakhir, 3: AUTO-SUBMIT)
  // - Laptop/PC: Maksimal 2x (1: Peringatan keras, 2: AUTO-SUBMIT)
  const MAX_VIOLATIONS = isMobile ? 3 : 2;

  // Jeda antar pelanggaran (agar tidak double trigger dalam 1 kejadian)
  const VIOLATION_COOLDOWN_MS = 2000;

  // Minimal durasi tab tersembunyi / kehilangan fokus agar dihitung:
  // - HP: 1000ms (1 detik) - menangkap buka tab lain, split screen, atau floating window
  // - Desktop: 500ms (0.5 detik)
  const MIN_AWAY_DURATION_MS = isMobile ? 1000 : 500;

  const lastViolationTime = useRef(0);
  const myTabId = useRef(typeof window !== 'undefined' ? Math.random().toString(36).slice(2) : '');

  // ────────────────────────────────────────────────────────────────
  // 1. SCREEN WAKE LOCK API (Cegah Layar HP Mati / Sleep Otomatis)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let wakeLock: any = null;
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && isMounted && document.visibilityState === 'visible') {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Abaikan jika browser tidak mendukung
      }
    };

    requestWakeLock();

    const handleVisibilityChangeWakeLock = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChangeWakeLock);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChangeWakeLock);
      if (wakeLock) {
        try {
          wakeLock.release();
        } catch {
          // Ignore release errors
        }
      }
    };
  }, []);

  // ────────────────────────────────────────────────────────────────
  // 2. SINGLE-TAB ENFORCEMENT via BroadcastChannel
  // (Jika buka tab baru, tab lama dinonaktifkan tanpa stuck/crash)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('BroadcastChannel' in window)) return;

    const channelName = `exam_tab_channel_${examId}`;
    const channel = new BroadcastChannel(channelName);

    // Tab ini mengumumkan bahwa dialah yang aktif sekarang
    channel.postMessage({ type: 'TAB_CLAIM', tabId: myTabId.current });

    const handleMessage = (event: MessageEvent) => {
      const { type, tabId: senderTabId } = event.data || {};
      if (!type) return;

      // Jika ada tab lain yang baru dibuka mengklaim sesi, buat tab ini inaktif
      if (type === 'TAB_CLAIM' && senderTabId !== myTabId.current) {
        setIsTabInactive(true);
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [examId]);

  const handleTakeOverTab = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channelName = `exam_tab_channel_${examId}`;
      const channel = new BroadcastChannel(channelName);
      channel.postMessage({ type: 'TAB_CLAIM', tabId: myTabId.current });
      channel.close();
    }
    setIsTabInactive(false);
  };

  // ────────────────────────────────────────────────────────────────
  // 3. ANTI-CHEAT MAIN EFFECT (Sangat Ketat: Visibility + Blur / Split-Screen)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isUnloading = false;
    let pageJustLoaded = true;
    let hiddenTimestamp = 0;
    let blurTimestamp = 0;
    let blurCheckTimer: NodeJS.Timeout | null = null;

    // Grace period 2.5 detik saat pertama kali halaman dibuka
    const loadedTimeout = setTimeout(() => {
      pageJustLoaded = false;
    }, 2500);

    const handleViolation = () => {
      if (disabledRef.current) return;
      if (pageJustLoaded) return;

      const now = Date.now();
      if (now - lastViolationTime.current < VIOLATION_COOLDOWN_MS) {
        return;
      }
      lastViolationTime.current = now;

      setViolations((prev) => {
        const nextViolations = prev + 1;
        try {
          localStorage.setItem(storageKey, nextViolations.toString());
        } catch {
          // Ignore storage quota error
        }

        // Laporkan pelanggaran ke server secara real-time
        if (onViolationRef.current) {
          try {
            onViolationRef.current(nextViolations);
          } catch {}
        }

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

    // Deteksi Pindah Tab / Layar Mati / Minimize Browser
    const handleVisibilityChange = () => {
      if (disabledRef.current || isUnloading) return;

      if (document.hidden) {
        hiddenTimestamp = Date.now();
      } else {
        if (hiddenTimestamp > 0) {
          const awayDuration = Date.now() - hiddenTimestamp;
          hiddenTimestamp = 0;
          if (awayDuration >= MIN_AWAY_DURATION_MS) {
            handleViolation();
          }
        }
      }
    };

    // Deteksi Hilang Fokus (Split Screen Android, Pop-up Window, Jendela Bersebelahan di Laptop)
    const handleWindowBlur = () => {
      if (disabledRef.current || isUnloading || pageJustLoaded) return;
      blurTimestamp = Date.now();

      // Periksa apakah pengguna tetap berada di luar fokus setelah durasi minimal
      if (blurCheckTimer) clearTimeout(blurCheckTimer);
      blurCheckTimer = setTimeout(() => {
        if (!document.hasFocus() && blurTimestamp > 0) {
          handleViolation();
        }
      }, MIN_AWAY_DURATION_MS + 200);
    };

    const handleWindowFocus = () => {
      if (blurCheckTimer) {
        clearTimeout(blurCheckTimer);
        blurCheckTimer = null;
      }
      if (blurTimestamp > 0) {
        const awayDuration = Date.now() - blurTimestamp;
        blurTimestamp = 0;
        if (awayDuration >= MIN_AWAY_DURATION_MS) {
          handleViolation();
        }
      }
    };

    // Blokir Klik Kanan
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Blokir Copy & Paste
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Blokir Drag & Drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // Blokir Shortcut DevTools, Screenshot & Print
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.ctrlKey && (e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
      }
    };

    // Cegah Tombol Back / Swipe Back Gesture di HP
    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = () => {
      if (disabledRef.current) return;
      window.history.pushState(null, document.title, window.location.href);
    };

    // Peringatan jika mencoba Refresh / Menutup Tab Browser
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (disabledRef.current) return;
      isUnloading = true;
      setTimeout(() => {
        isUnloading = false;
      }, 2000);
      e.preventDefault();
      e.returnValue = 'Ujian sedang berlangsung, yakin ingin keluar?';
      return e.returnValue;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(loadedTimeout);
      if (blurCheckTimer) clearTimeout(blurCheckTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router, onAutoSubmit, MAX_VIOLATIONS, VIOLATION_COOLDOWN_MS, MIN_AWAY_DURATION_MS, storageKey]);

  // ────────────────────────────────────────────────────────────────
  // RENDER: Overlay Tab Duplikat / Sesi di Tab Lain
  // ────────────────────────────────────────────────────────────────
  if (isTabInactive) {
    return (
      <div className="fixed inset-0 bg-slate-950/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-white rounded-2xl w-full max-w-sm p-6 md:p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Sesi Dibuka di Tab Lain</h2>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
            Ujian ini sedang dibuka di tab lain. Untuk menjaga keamanan dan mencegah hilangnya jawaban, hanya <strong>1 tab aktif</strong> yang dapat digunakan.
          </p>
          <button
            onClick={handleTakeOverTab}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-sm shadow-md"
          >
            Lanjutkan di Tab Ini
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // RENDER: Main Content & Warning Modal
  // ────────────────────────────────────────────────────────────────
  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-[340px] md:max-w-md p-6 md:p-8 text-center shadow-2xl mx-auto overflow-hidden">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-2 tracking-tight">⚠️ Peringatan Pelanggaran!</h2>
            <p className="text-slate-800 mb-2 text-sm md:text-base leading-relaxed font-semibold">
              Sistem mendeteksi Anda meninggalkan lembar ujian (pindah tab, split-screen, atau membuka aplikasi lain).
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-xs md:text-sm text-red-700 font-medium">
              Pelanggaran ke-<strong className="text-red-900 font-extrabold text-base mx-1">{violations}</strong> dari batas toleransi <strong className="text-slate-900 font-bold mx-1">{MAX_VIOLATIONS}</strong>.
              <p className="mt-1 text-slate-600 text-xs">
                Aktivitas ini direkam dan dilaporkan secara real-time ke pengawas ujian.
              </p>
            </div>
            {violations >= MAX_VIOLATIONS - 1 && (
              <div className="mb-4 text-red-800 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-300 text-xs text-left flex items-start gap-2">
                <span className="text-base">🚨</span>
                <span><strong>PERINGATAN TERAKHIR:</strong> Jika Anda meninggalkan ujian 1 kali lagi, ujian akan <u>otomatis terkirim (AUTO-SUBMIT)</u> dan ditandai <u>CURANG</u>!</span>
              </div>
            )}
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-blue-600 text-white font-bold py-3 text-sm md:text-base rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-600/30"
            >
              Saya Mengerti & Lanjut Mengerjakan
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
