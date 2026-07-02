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
    if(window.confirm("Apakah Anda yakin ingin menyelesaikan ujian ini? Jawaban yang sudah dikirim tidak dapat diubah kembali.")) {
       setIsSubmitting(true);
       const startKey = `exam_start_${examId}`;
       const startTime = parseInt(localStorage.getItem(startKey) || Date.now().toString());
       const timeSpent = Math.floor((Date.now() - startTime) / 1000);

       const res = await submitExam(examId, answers, false, timeSpent);
       if (res.success) {
         localStorage.removeItem('exam_violations');
         localStorage.removeItem(startKey);
         alert(`Ujian selesai! Pekerjaan Anda telah direkam.`);
         router.replace('/student/dashboard');
       } else {
         alert(res.error || "Gagal mengirim ujian.");
         setIsSubmitting(false);
       }
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
             <Button variant="danger" onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto font-semibold shadow-sm">
                {isSubmitting ? "Mengirim..." : "Selesai Ujian"}
             </Button>
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
                        : answers[q.id] !== undefined
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
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
                 <span className="text-xs font-bold tracking-wide text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full uppercase">Bobot: 10</span>
              </div>
              
              <div className="text-lg text-slate-800 leading-relaxed mb-10">
                {question.text}
              </div>

              <div className="space-y-3 flex-1">
                {options.map((opt, idx) => {
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
                })}
              </div>

              {/* Action Buttons */}
              <div className="mt-10 pt-6 border-t border-slate-100 flex gap-4 justify-between">
                 <Button 
                    variant="secondary" 
                    onClick={() => setCurrentQuestion(p => Math.max(0, p - 1))}
                    disabled={currentQuestion === 0}
                    className="flex-1 md:flex-none py-3"
                 >
                    Sebelumnya
                 </Button>
                 <Button 
                    variant="primary" 
                    onClick={() => setCurrentQuestion(p => Math.min(examData.questions.length - 1, p + 1))}
                    disabled={currentQuestion === examData.questions.length - 1}
                    className="flex-1 md:flex-none py-3 shadow-md shadow-blue-600/20"
                 >
                    Selanjutnya
                 </Button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AntiCheatWrapper>
  );
}
