"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AntiCheatWrapperProps {
  children: React.ReactNode;
  onAutoSubmit?: () => void;
  isDisabled?: boolean;
  examId?: string;
}

export function AntiCheatWrapper({ children, onAutoSubmit, isDisabled = false, examId = 'default' }: AntiCheatWrapperProps) {
  const router = useRouter();
  const disabledRef = useRef(isDisabled);

  useEffect(() => {
    disabledRef.current = isDisabled;
  }, [isDisabled]);

  const storageKey = `exam_violations_${examId}`;

  const [violations, setViolations] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });

  const [showWarning, setShowWarning] = useState(false);
  const [isTabInactive, setIsTabInactive] = useState(false);

  // Deteksi perangkat mobile
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // Toleransi pelanggaran:
  // - HP: 10x (karena banyak interupsi sistem seperti WA, notif baterai, alarm, dsb)
  // - Laptop/PC: 5x
  const MAX_VIOLATIONS = isMobile ? 10 : 5;

  // Jeda antar pelanggaran (agar tidak terhitung berkali-kali dalam 1 kejadian)
  const VIOLATION_COOLDOWN_MS = isMobile ? 5000 : 3000;

  // Minimal durasi tab tersembunyi agar dianggap pelanggaran:
  // - HP: minimal 3.5 detik (notif cepat, intip jam/baterai, gesture senggolan < 3.5 detik TIDAK DIHITUNG)
  // - Desktop: minimal 1.5 detik
  const MIN_AWAY_DURATION_MS = isMobile ? 3500 : 1500;

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
  // 3. ANTI-CHEAT MAIN EFFECT (Akurat, Tidak Mudah False-Positive)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isUnloading = false;
    let pageJustLoaded = true;
    let hiddenTimestamp = 0;

    // Grace period 3 detik setelah halaman pertama kali dimuat
    const loadedTimeout = setTimeout(() => {
      pageJustLoaded = false;
    }, 3000);

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

    // Deteksi Pindah Tab / Minimalkan Aplikasi Berdasarkan Durasi
    const handleVisibilityChange = () => {
      if (disabledRef.current || isUnloading) return;

      if (document.hidden) {
        // Pengguna meninggalkan tab / layar mati / meminimalkan browser
        hiddenTimestamp = Date.now();
      } else {
        // Pengguna kembali ke tab ujian
        if (hiddenTimestamp > 0) {
          const awayDuration = Date.now() - hiddenTimestamp;
          hiddenTimestamp = 0;

          // HANYA hitung pelanggaran jika siswa meninggalkan halaman cukup lama
          // Notifikasi cepat, intip status bar, sentuhan ringan < MIN_AWAY_DURATION_MS diabaikan
          if (awayDuration >= MIN_AWAY_DURATION_MS) {
            handleViolation();
          }
        }
      }
    };

    // Blokir Klik Kanan
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Blokir Copy Paste
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Blokir Shortcut DevTools (F12, Ctrl+Shift+I, dll)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
      }
    };

    // Cegah Tombol Back / Swipe Back Gesture di HP agar tidak keluar ruang ujian
    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = () => {
      if (disabledRef.current) return;
      // Selalu kembalikan state agar siswa tetap berada di ruang ujian tanpa dialog konfirmasi yang mengganggu
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
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(loadedTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
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
            <h2 className="text-2xl md:text-3xl font-bold text-red-600 mb-3 tracking-tight">Peringatan Ujian!</h2>
            <p className="text-slate-700 mb-2 text-base md:text-lg leading-relaxed font-medium">
              Sistem mendeteksi Anda meninggalkan halaman ujian.
            </p>
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              Pelanggaran ke-<strong className="text-red-600 font-bold">{violations}</strong> dari batas toleransi <strong className="text-slate-900 font-bold">{MAX_VIOLATIONS}</strong>.
              {violations >= MAX_VIOLATIONS - 2 && (
                <span className="block mt-2 text-red-600 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 text-xs">
                  ⚠️ Peringatan Terakhir: Ujian akan otomatis terkirim jika Anda keluar lagi!
                </span>
              )}
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
