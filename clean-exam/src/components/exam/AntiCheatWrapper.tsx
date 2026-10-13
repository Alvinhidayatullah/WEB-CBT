"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AntiCheatWrapperProps {
  children: React.ReactNode;
  onAutoSubmit?: () => void;
  isDisabled?: boolean;
}

// Nama channel untuk komunikasi antar tab
const EXAM_BROADCAST_CHANNEL = 'exam_session_channel';

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
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);

  // MAX_VIOLATIONS lebih longgar untuk HP:
  // - Desktop: 3 (ketat, karena jarang false positive)
  // - Mobile: 5 (longgar, karena notif/gesture bisa trigger visibilitychange)
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const MAX_VIOLATIONS = isMobile ? 5 : 3;

  const lastViolationTime = React.useRef(0);
  // Cooldown lebih panjang di HP agar tidak dobel-count dari gesture
  const VIOLATION_COOLDOWN_MS = isMobile ? 4000 : 2000;

  // ────────────────────────────────────────────────────────────────
  // SINGLE-TAB ENFORCEMENT via BroadcastChannel
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('BroadcastChannel' in window)) return; // Fallback: skip jika browser lama

    const channel = new BroadcastChannel(EXAM_BROADCAST_CHANNEL);
    const tabId = Math.random().toString(36).slice(2);

    // Kirim ping bahwa tab ini aktif
    channel.postMessage({ type: 'TAB_PING', tabId });

    const handleMessage = (event: MessageEvent) => {
      const { type, tabId: senderTabId } = event.data;

      if (type === 'TAB_PING' && senderTabId !== tabId) {
        // Ada tab lain yang baru dibuka → tampilkan peringatan tab duplikat
        setIsDuplicateTab(true);
        // Beritahu tab baru agar juga menampilkan peringatan
        channel.postMessage({ type: 'TAB_CONFLICT', tabId });
      }

      if (type === 'TAB_CONFLICT' && senderTabId !== tabId) {
        setIsDuplicateTab(true);
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);

  // ────────────────────────────────────────────────────────────────
  // ANTI-CHEAT MAIN EFFECT
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isUnloading = false;
    // Mencegah false-positive saat halaman baru saja dimuat
    let pageJustLoaded = true;
    const loadedTimeout = setTimeout(() => { pageJustLoaded = false; }, 2500);

    const handleViolation = () => {
      if (disabledRef.current) return;
      if (pageJustLoaded) return; // Jangan hitung jika baru buka

      const now = Date.now();
      if (now - lastViolationTime.current < VIOLATION_COOLDOWN_MS) {
        return; // Throttle pelanggaran
      }
      lastViolationTime.current = now;

      setViolations((prev) => {
        const nextViolations = prev + 1;
        localStorage.setItem('exam_violations', nextViolations.toString());

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

    // 1. Detect Visibility Change — lebih ketat filter untuk mobile
    const handleVisibilityChange = () => {
      if (document.hidden && !isUnloading) {
        // Di mobile, kita hanya hitung sebagai pelanggaran jika dokumen benar2 tersembunyi
        // bukan sekadar notifikasi cepat
        handleViolation();
      }
    };

    // 2. Block Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 3. Block Copy Paste
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // 4. Block DevTools shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
      }
    };

    // 5. Tombol Back / Swipe Back
    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = () => {
      if (disabledRef.current) return;
      const leave = window.confirm("Peringatan: Apakah Anda yakin ingin meninggalkan halaman ujian? Pekerjaan Anda bisa hilang atau langsung diselesaikan!");
      if (leave) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
      } else {
        window.history.pushState(null, document.title, window.location.href);
      }
    };

    // 6. Refresh / Tutup Tab
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (disabledRef.current) return;
      isUnloading = true;
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
      clearTimeout(loadedTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, onAutoSubmit, MAX_VIOLATIONS, VIOLATION_COOLDOWN_MS]);

  // ────────────────────────────────────────────────────────────────
  // RENDER — Tab Duplikat Modal
  // ────────────────────────────────────────────────────────────────
  if (isDuplicateTab) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-600 mb-3">Sesi Ganda Terdeteksi!</h2>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
            Ujian ini sedang dibuka di <strong>tab atau jendela lain</strong>. Tutup tab lain dan gunakan hanya <strong>satu tab</strong> untuk mengerjakan ujian. Meneruskan dengan dua sesi dapat menyebabkan jawaban Anda <strong>hilang</strong>.
          </p>
          <button
            onClick={() => {
              // Tutup tab ini dan biarkan tab lain yang aktif
              window.close();
              // Jika window.close() tidak bekerja (tidak dibuka dari JS), reload halaman
              setTimeout(() => {
                setIsDuplicateTab(false);
              }, 300);
            }}
            className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-all text-sm mb-2"
          >
            Tutup Tab Ini
          </button>
          <button
            onClick={() => setIsDuplicateTab(false)}
            className="w-full bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-200 transition-all text-sm"
          >
            Lanjutkan di Tab Ini (Paksa)
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showWarning && (
        <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-[340px] md:max-w-md p-6 md:p-8 text-center shadow-2xl mx-auto overflow-hidden">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-red-600 mb-4 tracking-tight">Peringatan Kecurangan!</h2>
            <p className="text-slate-700 mb-2 text-base md:text-lg leading-relaxed break-words px-2 font-medium">
              Sistem mendeteksi Anda keluar dari area ujian.
            </p>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              Pelanggaran ke-<strong className="text-red-600">{violations}</strong> dari maksimal <strong className="text-slate-900">{MAX_VIOLATIONS}</strong>.
              {violations >= MAX_VIOLATIONS - 1 && <span className="block mt-1 text-red-500 font-semibold">⚠️ Pelanggaran berikutnya = ujian otomatis dikumpul!</span>}
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
