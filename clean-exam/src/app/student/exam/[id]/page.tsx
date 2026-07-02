"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AntiCheatWrapper } from '@/components/exam/AntiCheatWrapper';
import { Button } from '@/components/ui/Button';
import { getExamData, submitExam } from '@/actions/examActions';
import { Loader2 } from 'lucide-react';
import { use } from 'react';

export default function ExamRoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const examId = resolvedParams.id;
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examData, setExamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Record<string, boolean>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    async function loadExam() {
      const data = await getExamData(examId);
      if (data) {
        setExamData(data);
        
        // Timer Logic
        const startKey = `exam_start_${examId}`;
        let startTimeStr = localStorage.getItem(startKey);
        let startTime = startTimeStr ? parseInt(startTimeStr) : Date.now();
        if (!startTimeStr) {
          localStorage.setItem(startKey, startTime.toString());
        }
        
        const durationMs = (data.duration || 60) * 60 * 1000;
        const endTime = startTime + durationMs;
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setTimeLeft(remaining);

      } else {
        setError("Ujian tidak ditemukan atau akses ditolak.");
      }
      setLoading(false);
    }
    loadExam();
  }, [examId]);

  useEffect(() => {
    if (timeLeft === null || isSubmitting) return;

    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitting]);

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

    localStorage.removeItem('exam_violations');
    localStorage.removeItem(startKey);
    await submitExam(examId, answers, true, timeSpent);
    router.replace('/student/dashboard');
  };

  const handleSubmit = async () => {
       setIsSubmitting(true);
       const startKey = `exam_start_${examId}`;
       const startTime = parseInt(localStorage.getItem(startKey) || Date.now().toString());
       const timeSpent = Math.floor((Date.now() - startTime) / 1000);

       const res = await submitExam(examId, answers, false, timeSpent);
       if (res.success) {
         localStorage.removeItem('exam_violations');
         localStorage.removeItem(startKey);
         setShowSubmitModal(false);
         alert(`Ujian selesai! Pekerjaan Anda telah direkam.`);
         router.replace('/student/dashboard');
       } else {
         alert(res.error || "Gagal mengirim ujian.");
         setIsSubmitting(false);
       }
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
  const options = [
    { label: "A", text: question.optionA, value: "A" },
    { label: "B", text: question.optionB, value: "B" },
    { label: "C", text: question.optionC, value: "C" },
    { label: "D", text: question.optionD, value: "D" },
  ];

  return (
    <AntiCheatWrapper onAutoSubmit={handleAutoSubmit}>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header Minimalis */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 py-4 flex flex-wrap gap-4 justify-between items-center sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800 tracking-tight">CleanExam</div>
             <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
             <div className="text-slate-600 font-medium text-sm hidden md:block">{examData.title} - Kelas {examData.targetClass}</div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
             {timeLeft !== null && (
               <div className={`font-mono text-lg font-bold px-4 py-1.5 rounded-lg border flex items-center gap-2 ${
                 timeLeft < 300 
                   ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                   : 'bg-slate-100 text-slate-700 border-slate-200'
               }`}>
                 <span>Sisa Waktu:</span>
                 <span>{formatTime(timeLeft)}</span>
               </div>
             )}
          </div>
        </header>

        {/* Konten Utama */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Navigasi Soal */}
          <aside className="md:col-span-1 order-2 md:order-1 relative">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 md:sticky md:top-24 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 hidden md:block">Navigasi Soal</h3>
              <div className="flex overflow-x-auto md:grid md:grid-cols-4 gap-2 pb-2 md:pb-0 scrollbar-hide">
                {examData.questions.map((q: any, idx: number) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestion(idx)}
                    className={`shrink-0 w-12 h-12 md:w-10 md:h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
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
          <section className="md:col-span-3 order-1 md:order-2">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-10 shadow-sm min-h-[500px] flex flex-col">
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
                 <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Soal Nomor {currentQuestion + 1}</h2>
                 <span className="text-xs font-bold tracking-wide text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full uppercase">Bobot: {(100 / examData.questions.length).toFixed(1).replace(/\.0$/, '')}</span>
              </div>
              
              <div className="text-lg text-slate-800 leading-relaxed mb-10">
                {question.text}
              </div>

              <div className="space-y-3 flex-1 flex flex-col">
                {question.type === "ESSAY" ? (
                  <textarea 
                    className="w-full flex-1 min-h-[200px] p-4 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 text-lg leading-relaxed transition-all resize-y"
                    placeholder="Ketik jawaban esai Anda di sini..."
                    value={answers[qId] || ""}
                    onChange={(e) => handleSelect(e.target.value)}
                  />
                ) : (
                  options.map((opt, idx) => {
                     const isSelected = answers[qId] === opt.value;
                     return (
                      <label 
                        key={idx} 
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
                          onChange={() => handleSelect(opt.value)}
                        />
                        <span className={`text-base leading-relaxed ${isSelected ? 'text-blue-900 font-semibold' : 'text-slate-700'}`}>
                           <span className={`font-bold mr-2 ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>{opt.label}.</span> 
                           {opt.text}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
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
                <span className="text-4xl font-mono font-black text-slate-800 tracking-tight">{timeLeft !== null ? formatTime(timeLeft) : '00:00'}</span>
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
