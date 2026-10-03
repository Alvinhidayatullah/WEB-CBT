"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AntiCheatWrapper } from '@/components/exam/AntiCheatWrapper';
import { Button } from '@/components/ui/Button';
import { getExamData, submitExam } from '@/actions/examActions';
import { Loader2 } from 'lucide-react';
import { use } from 'react';
import Image from 'next/image';

// Komponen Timer terpisah agar tidak merender ulang seluruh halaman ujian setiap detik (Optimasi Performa)
function TimerDisplay({ initialTimeLeft, totalDuration, onTimeUp }: { initialTimeLeft: number, totalDuration: number, onTimeUp: () => void }) {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isCritical = timeLeft <= totalDuration * 0.2; // 20% waktu sisa

  return (
    <div className={`w-full lg:w-auto font-mono text-sm md:text-base font-bold px-3 py-2 md:px-4 rounded-lg border flex items-center justify-center gap-2 transition-colors duration-500 ${
      isCritical 
        ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm' 
        : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
    }`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${isCritical ? 'text-rose-500/80' : 'text-emerald-600/80'}`}>Sisa Waktu:</span>
      <span className="tracking-tight">{formatTime(timeLeft)}</span>
    </div>
  );
}

export default function ExamRoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const examId = resolvedParams.id;
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examData, setExamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialTimeLeft, setInitialTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Record<string, boolean>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    async function loadExam() {
      const data = await getExamData(examId);
      if (data) {
        if (data.error) {
          setError(data.error);
        } else {
          setExamData(data);
          
          // Timer Logic
          const startKey = `exam_start_${examId}`;
          const startTimeStr = localStorage.getItem(startKey);
          const startTime = startTimeStr ? parseInt(startTimeStr) : Date.now();
          if (!startTimeStr) {
            localStorage.setItem(startKey, startTime.toString());
          }
          
          const durationMs = (data.duration || 60) * 60 * 1000;
          const endTime = startTime + durationMs;
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setInitialTimeLeft(remaining);
        }
      } else {
        setError("Ujian tidak ditemukan atau akses ditolak.");
      }
      setLoading(false);
    }
    loadExam();
  }, [examId]);



  const handleSelect = (optionValue: string) => {
    if (!examData) return;
    const qId = examData.questions[currentQuestion].id;
    setAnswers((prev) => ({ ...prev, [qId]: optionValue }));
  };

  const handleAutoSubmit = async () => {
    if (!examData || isSubmitting) return;
    setIsSubmitting(true);
    const startKey = `exam_start_${examId}`;
    const startTime = parseInt(localStorage.getItem(startKey) || Date.now().toString());
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      const res = await submitExam(examId, answers, true, timeSpent);
      if (res.success) {
        localStorage.removeItem('exam_violations');
        localStorage.removeItem(startKey);
        window.location.href = '/student/dashboard';
      } else {
        if (res.error?.includes("sudah mensubmit") || res.error?.includes("tidak ditemukan") || res.error?.includes("tidak memiliki akses")) {
            localStorage.removeItem('exam_violations');
            localStorage.removeItem(startKey);
            alert(res.error);
            window.location.href = '/student/dashboard';
            return;
        }
        // Retry logic for server overload or general errors
        alert(`Gagal: ${res.error || "Server penuh"}. Sistem akan mencoba mengirim ulang secara otomatis...`);
        setTimeout(() => {
          setIsSubmitting(false);
          handleAutoSubmit(); // Retry
        }, 3000);
      }
    } catch {
      alert("Koneksi terputus. Mencoba mengirim ulang dalam 5 detik...");
      setTimeout(() => {
        setIsSubmitting(false);
        handleAutoSubmit(); // Retry
      }, 5000);
    }
  };

  const handleSubmit = async () => {
       setIsSubmitting(true);
       const startKey = `exam_start_${examId}`;
       const startTime = parseInt(localStorage.getItem(startKey) || Date.now().toString());
       const timeSpent = Math.floor((Date.now() - startTime) / 1000);

       try {
         const res = await submitExam(examId, answers, false, timeSpent);
         if (res.success) {
           localStorage.removeItem('exam_violations');
           localStorage.removeItem(startKey);
           setShowSubmitModal(false);
           alert(`Ujian selesai! Pekerjaan Anda telah direkam.`);
           window.location.href = '/student/dashboard';
         } else {
           if (res.error?.includes("sudah mensubmit") || res.error?.includes("tidak ditemukan")) {
               localStorage.removeItem('exam_violations');
               localStorage.removeItem(startKey);
               alert(res.error);
               window.location.href = '/student/dashboard';
               return;
           }
           alert(res.error || "Gagal mengirim ujian. Silakan coba lagi.");
           setIsSubmitting(false);
         }
       } catch {
         alert("Koneksi terputus atau server penuh. Pekerjaan Anda aman, silakan klik kirim lagi dalam beberapa detik.");
         setIsSubmitting(false);
       }
  };

  const getRemainingTime = () => {
    if (!examData) return 0;
    const startKey = `exam_start_${examId}`;
    const startTimeStr = localStorage.getItem(startKey);
    if (!startTimeStr) return initialTimeLeft || 0;
    const startTime = parseInt(startTimeStr);
    const durationMs = (examData.duration || 60) * 60 * 1000;
    const endTime = startTime + durationMs;
    return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !examData || !examData.questions || examData.questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Terjadi Kesalahan</h2>
          <p className="text-slate-600 mb-6">{error || "Belum ada soal untuk ujian ini."}</p>
          <Button onClick={() => router.replace('/student/dashboard')}>Kembali ke Dashboard</Button>
        </div>
      </div>
    );
  }

  const question = examData.questions[currentQuestion];
  const qId = question.id;

  return (
    <AntiCheatWrapper onAutoSubmit={handleAutoSubmit} isDisabled={showSubmitModal || isSubmitting}>
      <div className="min-h-[100dvh] bg-[#030305] flex flex-col relative overflow-x-hidden selection:bg-blue-500/30">
        
        {/* Fixed Background from Login */}
        <div className="fixed inset-0 bg-[#030305] -z-20"></div>
        <div className="fixed top-[-20%] left-[-20%] w-[70vw] h-[70vw] max-w-[600px] max-h-[600px] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.08)_0%,transparent_60%)] animate-pulse pointer-events-none -z-10"></div>
        <div className="fixed bottom-[-20%] right-[-20%] w-[70vw] h-[70vw] max-w-[600px] max-h-[600px] bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08)_0%,transparent_60%)] animate-pulse pointer-events-none -z-10" style={{ animationDelay: '2s' }}></div>
        <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdHRlcm4gaWQ9InNtYWxsR3JpZCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMTAgMEwwIDBMMCAxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvcGF0dGVybj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9InVybCgjc21hbGxHcmlkKSIvPjxwYXRoIGQ9Ik00MCAwTDAgMEwwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] pointer-events-none -z-10" />

        {/* Header Minimalis (Tetap Putih) */}
        <header className="bg-white/95 border-b border-slate-200/60 px-4 lg:px-6 py-2.5 flex flex-wrap lg:flex-nowrap gap-2 justify-between items-center sticky top-0 z-20 shadow-sm w-full">
          
          {/* Bagian Kiri: Logo */}
          <div className="flex items-center gap-2 shrink-0 order-1">
             <Image src="/logo-yasda.png" alt="Logo Yasda" width={36} height={36} className="object-contain" />
             <div className="font-extrabold text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800 tracking-tight hidden lg:block">SecureCBT</div>
          </div>
          
          {/* Bagian Tengah: Timer (selalu terlihat) */}
          <div className="shrink-0 flex items-center justify-center order-2 lg:order-2 flex-1 lg:flex-none">
             {initialTimeLeft !== null && !isSubmitting && (
               <TimerDisplay initialTimeLeft={initialTimeLeft} totalDuration={(examData.duration || 60) * 60} onTimeUp={handleAutoSubmit} />
             )}
          </div>

          {/* Bagian Kanan: Pelajaran & Identitas */}
          <div className="flex flex-col items-end text-right shrink-0 order-3 w-full lg:w-auto mt-2 lg:mt-0 px-1">
             <div className="text-slate-800 font-bold text-sm lg:text-base leading-tight">
                {examData.subject || examData.title}
             </div>
             <div className="text-slate-500 font-medium text-[11px] lg:text-xs mt-0.5 flex items-center gap-1.5 flex-wrap justify-end">
                <span className="text-blue-700 font-bold uppercase">{examData.studentName}</span> 
                <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
                <span>Kelas {examData.studentClass}</span>
             </div>
          </div>
        </header>

        {/* Konten Utama */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-10">
          
          {/* Navigasi Soal */}
          <aside className="lg:col-span-1 order-2 lg:order-1 relative z-10">
            <div className="bg-white rounded-3xl border border-slate-100 p-5 lg:p-6 lg:sticky lg:top-28 shadow-xl shadow-black/10">
              <h3 className="font-bold text-slate-800 mb-4 md:mb-6 hidden lg:block text-lg border-b border-slate-100 pb-4">Navigasi Soal</h3>
              <div className="flex overflow-x-auto lg:grid lg:grid-cols-5 gap-2 lg:gap-2 xl:gap-3 pb-2 md:pb-0 scrollbar-hide">
                {examData.questions.map((q: any, idx: number) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestion(idx)}
                    className={`shrink-0 w-11 h-11 lg:w-full lg:aspect-square lg:h-auto rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                      currentQuestion === idx 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-600 ring-offset-2' 
                        : markedQuestions[q.id]
                          ? 'bg-amber-100 text-amber-700 border border-amber-300 ring-1 ring-amber-300'
                          : answers[q.id] && answers[q.id].trim() !== ""
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Area Soal */}
          <section className="lg:col-span-3 order-1 lg:order-2 relative z-10 min-w-0">
            <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-10 lg:p-12 shadow-xl shadow-black/10 min-h-[500px] flex flex-col">
              <div className="flex flex-wrap gap-4 justify-between items-center mb-6 pb-6 border-b border-slate-100">
                 <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Soal Nomor {currentQuestion + 1}</h2>
                 <span className="text-xs font-bold tracking-wide text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full uppercase">
                   Bobot: {
                     (() => {
                       const totalEssay = examData.questions.filter((q: any) => q.type === 'ESSAY').length;
                       const totalPG = examData.questions.length - totalEssay;
                       const isEssay = question.type === 'ESSAY';
                       
                       if (totalEssay === 0) return (100 / totalPG).toFixed(1).replace(/\.0$/, '');
                       
                       return isEssay 
                         ? (40 / totalEssay).toFixed(1).replace(/\.0$/, '') 
                         : (60 / totalPG).toFixed(1).replace(/\.0$/, '');
                     })()
                   }
                 </span>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 mb-8 shadow-sm">
                <div className="text-[17px] text-slate-800 leading-snug whitespace-pre-wrap">
                  {question.text}
                </div>
                {question.imageUrl && (
                  <div className="mt-8 text-center">
                    <img src={question.imageUrl} alt="Gambar Soal" className="max-w-full max-h-80 w-auto inline-block rounded-xl border border-slate-200 shadow-md object-contain bg-white p-2" />
                  </div>
                )}
              </div>

              <div className="space-y-3 flex-1 flex flex-col">
                {question.type === "ESSAY" ? (
                  <textarea 
                    key={`essay-${qId}`}
                    className="w-full flex-1 min-h-[200px] p-4 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 text-lg leading-relaxed transition-all resize-y"
                    placeholder="Ketik jawaban esai Anda di sini..."
                    value={answers[qId] || ""}
                    onChange={(e) => handleSelect(e.target.value)}
                  />
                ) : (
                  question.shuffledOptions?.map((opt: any, idx: number) => {
                     const isSelected = answers[qId] === opt.originalValue;
                     return (
                      <label 
                        key={`${qId}-${idx}`} 
                        className={`group flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10' 
                            : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 group-hover:border-slate-400'
                        }`}>
                           {isSelected && <div className="w-2 h-2 bg-white rounded-full shadow-sm"></div>}
                        </div>
                        <input 
                          type="radio" 
                          name={`q-${qId}`} 
                          className="hidden" 
                          checked={isSelected}
                          onChange={() => handleSelect(opt.originalValue)}
                        />
                        <span className={`text-base leading-relaxed flex flex-col gap-2 ${isSelected ? 'text-blue-900 font-semibold' : 'text-slate-700'}`}>
                           <div className="whitespace-pre-wrap">
                             <span className={`font-bold mr-2 ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>{opt.label}.</span> 
                             {opt.text}
                           </div>
                           {opt.img && <img src={opt.img} alt={`Opsi ${opt.label}`} className="max-w-full max-h-40 w-auto rounded border border-slate-200 object-contain mt-2" />}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-6 justify-between items-center">
                 <label className="flex items-center gap-3 cursor-pointer group">
                   <div className="relative flex items-center justify-center">
                     <input 
                       type="checkbox" 
                       className="peer appearance-none w-5 h-5 rounded border-2 border-slate-300 checked:bg-amber-500 checked:border-amber-500 focus:ring-2 focus:ring-amber-500/30 focus:outline-none transition-all cursor-pointer"
                       checked={!!markedQuestions[qId]}
                       onChange={(e) => setMarkedQuestions(prev => ({...prev, [qId]: e.target.checked}))}
                     />
                     <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                     </svg>
                   </div>
                   <span className="text-slate-600 font-medium group-hover:text-amber-600 transition-colors select-none">Tandai Ragu-ragu</span>
                 </label>
                 
                 <div className="flex w-full md:w-auto gap-4">
                   <Button 
                      variant="secondary" 
                      onClick={() => setCurrentQuestion(p => Math.max(0, p - 1))}
                      disabled={currentQuestion === 0}
                      className="flex-1 md:flex-none py-3 px-6"
                   >
                      Sebelumnya
                   </Button>
                   {currentQuestion === examData.questions.length - 1 ? (
                     <Button 
                        onClick={() => setShowSubmitModal(true)}
                        className="flex-1 md:flex-none py-3 px-6 shadow-md shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                     >
                        Selesaikan Ujian
                     </Button>
                   ) : (
                     <Button 
                        variant="primary" 
                        onClick={() => setCurrentQuestion(p => Math.min(examData.questions.length - 1, p + 1))}
                        className="flex-1 md:flex-none py-3 px-6 shadow-md shadow-blue-600/20"
                     >
                        Selanjutnya
                     </Button>
                   )}
                 </div>
              </div>
            </div>
          </section>
        </main>

        {/* Modal Konfirmasi Selesai */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 transform transition-all animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 text-center mb-2">Selesai Ujian?</h3>
              <p className="text-slate-600 text-center mb-6 leading-relaxed">
                Periksa kembali semua jawaban kamu. Pastikan tidak ada soal yang terlewat atau masih ditandai ragu-ragu.
              </p>
              
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col items-center justify-center mb-8">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sisa Waktu</span>
                <span className="text-4xl font-mono font-black text-slate-800 tracking-tight">{formatTime(getRemainingTime())}</span>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-600/20 rounded-xl"
                >
                  {isSubmitting ? "Mengirim..." : "Ya, Kirim Jawaban"}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowSubmitModal(false)}
                  disabled={isSubmitting}
                  className="w-full py-4 text-base font-bold rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                >
                  Batal, Periksa Lagi
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AntiCheatWrapper>
  );
}
