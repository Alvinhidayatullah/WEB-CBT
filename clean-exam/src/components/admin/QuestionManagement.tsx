"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BookOpen, Trash2, Edit2, ChevronDown, ChevronUp, Save, X, ExternalLink, FolderEdit, Download, Bot, Users, Flame, Sparkles } from "lucide-react";
import { createExam, deleteExam, updateExam, getExams, getPendingResultIds, getPendingEssayPayloads, gradeSingleEssayAction, finalizeAIGrading, deleteExamResult, forceFinalizeExamResult } from "@/actions/dashboardActions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export interface UIQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
}

export interface UIExamResult {
  id: string;
  score: number;
  isCheated: boolean;
  violations?: number;
  timeSpent?: number;
  essayScore?: number;
  aiFeedback?: string;
  gradingStatus?: string;
  answersJson?: string;
  student: { username: string; className: string | null };
}

export interface UIExam {
  id: string;
  examType: string;
  subject: string;
  targetClass: string;
  token: string;
  duration: number;
  isActive: boolean;
  isAIGradingEnabled: boolean;
  questions?: UIQuestion[];
  results?: UIExamResult[];
}

const LiveTime = ({ createdAt, timeSpent, status }: { createdAt: string | Date, timeSpent: number, status: string }) => {
  const [now, setNow] = useState<number | null>(null);
  
  useEffect(() => {
    setNow(Date.now());
    if (status !== "STARTED") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status !== "STARTED") {
     return <span>{timeSpent ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` : "-"}</span>;
  }

  if (now === null) return <span>Menghitung...</span>;

  const createdTime = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - createdTime) / 1000));
  return <span className="text-blue-600 font-semibold">{Math.floor(elapsed / 60)}m {elapsed % 60}s</span>;
};

// Helper untuk merender pecahan (1/2) dan pangkat (^2) secara matematis di sisi Admin
const formatMathText = (text: string) => {
  if (!text || typeof text !== 'string') return text || "";
  const charClass = "[0-9\u00B2\u00B3\u00B9\u2070-\u2079\u207B]+";
  const splitRegex = new RegExp(`(${charClass}\\s*\\/\\s*${charClass}|\\^[-]?\\w+)`, "g");
  const matchRegex = new RegExp(`^(${charClass})\\s*\\/\\s*(${charClass})$`);
  
  const parts = text.split(splitRegex);
  
  return parts.map((part, i) => {
    const fracMatch = part.match(matchRegex);
    if (fracMatch) {
      return (
        <span key={i} className="inline-flex flex-col items-center justify-center mx-1 font-semibold text-[0.85em]" style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>
          <span className="border-b border-slate-700 pb-[1px] px-[2px]">{fracMatch[1]}</span>
          <span className="pt-[1px] px-[2px]">{fracMatch[2]}</span>
        </span>
      );
    }
    
    const supMatch = part.match(/^\^([-\w]+)$/);
    if (supMatch) {
      return <sup key={i} className="text-[0.75em]">{supMatch[1]}</sup>;
    }
    
    return part;
  });
};

export function QuestionManagement({ exams = [], availableClasses = [], availableSubjects = [] }: { exams: UIExam[], availableClasses?: string[], availableSubjects?: string[] }) {
  const [localExams, setLocalExams] = useState<UIExam[]>(exams);

  React.useEffect(() => {
    setLocalExams(exams);
  }, [exams]);

  const [examType, setExamType] = useState("Ujian Tengah Semester");
  const [isCustomExamType, setIsCustomExamType] = useState(false);
  const [subject, setSubject] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [isAIGradingEnabled, setIsAIGradingEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [isExamListOpen, setIsExamListOpen] = useState(true);
  const [filterClassification, setFilterClassification] = useState<"ALL" | "ACTIVE" | "IDLE">("ALL");
  const router = useRouter();

  // Pisahkan ujian yang ada siswa (sedang berlangsung / selesai) vs belum ada siswa
  const activeExams = useMemo(() => {
    return localExams
      .filter((e) => (e.results?.length || 0) > 0)
      .sort((a, b) => {
        const aStarted = a.results?.some((r: any) => r.gradingStatus === "STARTED") ? 1 : 0;
        const bStarted = b.results?.some((r: any) => r.gradingStatus === "STARTED") ? 1 : 0;
        if (bStarted !== aStarted) return bStarted - aStarted; // Yang sedang aktif dikerjakan paling atas
        return (b.results?.length || 0) - (a.results?.length || 0);
      });
  }, [localExams]);

  const idleExams = useMemo(() => {
    return localExams.filter((e) => !e.results || e.results.length === 0);
  }, [localExams]);

  // Auto-refresh untuk melihat siswa yang baru bergabung / berpindah mapel secara live
  useEffect(() => {
    if (!isExamListOpen && !expandedExam) return;
    const interval = setInterval(() => {
      router.refresh(); // Fetch data terbaru dari server tanpa reset state client
    }, expandedExam ? 5000 : 8000);
    return () => clearInterval(interval);
  }, [isExamListOpen, expandedExam, router]);

  // Edit State
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState(60);
  const [editingTokenExamId, setEditingTokenExamId] = useState<string | null>(null);
  const [editToken, setEditToken] = useState("");
  const [examTokenInput, setExamTokenInput] = useState("");

  // View Details State
  const [viewingResult, setViewingResult] = useState<any | null>(null);
  const [viewingExam, setViewingExam] = useState<UIExam | null>(null);
  const [activeBatch, setActiveBatch] = useState<Set<string>>(new Set());
  const [processingProgress, setProcessingProgress] = useState<Record<string, string>>({});
  const [autoProcessQueue, setAutoProcessQueue] = useState<string[]>([]);
  
  // Polling super ringan setiap 10 detik HANYA untuk mengambil ID yang PENDING
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const pendingIds = await getPendingResultIds();
        
        // Hanya update antrean untuk ID yang belum ada di autoProcessQueue dan activeBatch
        setAutoProcessQueue(prev => {
          const newIds = pendingIds.filter(id => !prev.includes(id) && !activeBatch.has(id));
          if (newIds.length > 0) return [...prev, ...newIds];
          return prev;
        });
      } catch (e) {
        console.error(e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeBatch]);

  // Background Worker Effect dengan Controlled Concurrency (Batch processing)
  React.useEffect(() => {
    const processBatch = async () => {
      // Kita batasi maksimum 3 proses bersamaan
      if (activeBatch.size >= 3 || autoProcessQueue.length === 0) return;
      
      // Ambil tugas yang bisa dijalankan (sampai kuota 3 penuh)
      const availableSlots = 3 - activeBatch.size;
      const nextIds = autoProcessQueue.slice(0, availableSlots);
      if (nextIds.length === 0) return;

      // Masukkan ke batch aktif dan keluarkan dari antrean
      setActiveBatch(prev => {
        const newBatch = new Set(prev);
        nextIds.forEach(id => newBatch.add(id));
        return newBatch;
      });
      setAutoProcessQueue(prev => prev.slice(nextIds.length));

      // Jalankan secara paralel tanpa menunggu satu sama lain
      nextIds.forEach(id => {
        handleProcessAI(id).finally(() => {
          // Setelah selesai atau gagal, keluarkan dari batch aktif
          setActiveBatch(prev => {
            const newBatch = new Set(prev);
            newBatch.delete(id);
            return newBatch;
          });
          // Refresh data layar (karena polling otomatis di atas tidak refresh data lengkap)
          getExams().then(freshExams => setLocalExams(freshExams as unknown as UIExam[]));
        });
      });
    };

    processBatch();
  }, [autoProcessQueue, activeBatch]);

  const handleProcessAI = async (resId: string) => {
    // Prevent double processing (activeBatch checked in processBatch, but just in case for manual clicks)
    setProcessingProgress(prev => ({ ...prev, [resId]: "Mengambil data..." }));
    setActiveBatch(prev => new Set(prev).add(resId));

    try {
      const payloadRes = await getPendingEssayPayloads(resId);
      if (!payloadRes.success || !payloadRes.payloads) {
        setProcessingProgress(prev => { const n = {...prev}; delete n[resId]; return n; });
        return;
      }

      const { payloads, totalMaxPG, totalEarnedPG, totalMaxEssay } = payloadRes;
      
      if (payloads.length === 0) {
        await finalizeAIGrading(resId, totalEarnedPG || 0, totalMaxPG || 0, 0, totalMaxEssay || 0, []);
        setProcessingProgress(prev => { const n = {...prev}; delete n[resId]; return n; });
        return;
      }

      let totalEssayScore = 0;
      const aiFeedbacks: string[] = [];

      for (let i = 0; i < payloads.length; i++) {
        const essay = payloads[i];
        setProcessingProgress(prev => ({ ...prev, [resId]: `Menilai ${i + 1}/${payloads.length}...` }));
        
        try {
          const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout (AI tidak merespons dalam 60s)")), 60000)
          );
          const aiRes = await Promise.race([
            gradeSingleEssayAction(essay.questionText, essay.referenceAnswer, essay.studentAnswer),
            timeoutPromise
          ]) as any;
          
          if (aiRes.success) {
            const score = aiRes.score || 0;
            const weightedScore = (score / 100) * essay.weight;
            totalEssayScore += weightedScore;
            aiFeedbacks.push(`Soal: ${essay.questionText} - AI Score: ${score}/100. Alasan: ${aiRes.reason}`);
          } else {
            aiFeedbacks.push(`Soal: ${essay.questionText} - AI Score: 0/100. Alasan: Gagal memproses - ${aiRes.error}`);
          }
        } catch (callErr: any) {
          aiFeedbacks.push(`Soal: ${essay.questionText} - AI Score: 0/100. Alasan: Gagal memproses - ${callErr.message || "Timeout"}`);
        }
      }

      setProcessingProgress(prev => ({ ...prev, [resId]: "Menyimpan hasil..." }));
      await finalizeAIGrading(resId, totalEarnedPG || 0, totalMaxPG || 0, totalEssayScore, totalMaxEssay || 0, aiFeedbacks);

    } catch (err) {
      console.error(err);
    } finally {
      setProcessingProgress(prev => { const n = {...prev}; delete n[resId]; return n; });
      setActiveBatch(prev => { const n = new Set(prev); n.delete(resId); return n; });
      try {
        const freshExams = await getExams();
        setLocalExams(freshExams as unknown as UIExam[]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const removeClass = (cls: string) => {
    setTargetClasses(targetClasses.filter(c => c !== cls));
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setLoading(true);
    try {
      const finalTargetClass = targetClasses.length > 0 ? targetClasses.join(", ") : "Semua Kelas";
      const res = await createExam(examType, subject, finalTargetClass, duration, isAIGradingEnabled, examTokenInput.trim() || undefined);
      if (res.success && res.exam) {
        setLocalExams(prev => [{ ...res.exam, questions: [], results: [] } as UIExam, ...prev]);
        setSubject("");
        setTargetClasses([]);
        setDuration(60);
        setExamTokenInput("");
        setIsAIGradingEnabled(true);
        setIsCustomExamType(false);
        setExamType("Ujian Tengah Semester");
        router.refresh();
      } else {
        alert(res.error || "Gagal membuat sesi ujian");
      }
    } catch (err: any) {
      alert("Terjadi kendala koneksi saat menyimpan. Silakan muat ulang halaman jika sesi sudah terbentuk di daftar bawah.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDuration = async (id: string) => {
    setLoading(true);
    const res = await updateExam(id, { duration: editDuration });
    if (res.success) {
      setLocalExams(localExams.map(e => e.id === id ? { ...e, duration: editDuration } : e));
    }
    setEditingExamId(null);
    setLoading(false);
  };

  const handleUpdateToken = async (id: string) => {
    const trimmed = editToken.trim().toUpperCase();
    if (!trimmed) {
      alert("Token ujian tidak boleh kosong.");
      return;
    }
    setLoading(true);
    const res = await updateExam(id, { token: trimmed });
    if (res.success && res.exam) {
      setLocalExams(localExams.map(e => e.id === id ? { ...e, token: res.exam.token } : e));
      setEditingTokenExamId(null);
    } else {
      alert(res.error || "Gagal mengubah token ujian.");
    }
    setLoading(false);
  };

  const [finalizingIds, setFinalizingIds] = useState<Set<string>>(new Set());

  const handleDeleteExam = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Hapus sesi ujian ini beserta semua soalnya?")) return;
    const prevExams = localExams;
    setLocalExams(prev => prev.filter(exam => exam.id !== id));
    const res = await deleteExam(id);
    if (!res.success) {
      setLocalExams(prevExams);
      alert(res.error || "Gagal menghapus ujian");
    }
  };

  const handleDeleteStudentResult = async (examId: string, resultId: string, studentName: string) => {
    if (!window.confirm(`Hapus nilai atas nama ${studentName}? Mereka harus mengerjakan ulang ujian ini jika dihapus.`)) return;

    // Snapshot untuk rollback jika gagal
    const prevExams = localExams;

    // OPTIMISTIC UPDATE: Langsung hilangkan dari layar seketika (0 detik)!
    setLocalExams(prev => prev.map(e => {
      if (e.id !== examId) return e;
      return {
        ...e,
        results: (e.results || []).filter((r: any) => r.id !== resultId)
      };
    }));

    try {
      const res = await deleteExamResult(resultId);
      if (!res.success) {
        setLocalExams(prevExams);
        alert(res.error || "Gagal menghapus nilai siswa.");
      }
    } catch {
      setLocalExams(prevExams);
      alert("Terjadi kesalahan jaringan saat menghapus siswa.");
    }
  };

  const handleForceFinalizeStudent = async (examId: string, result: any) => {
    const studentName = result.student?.name || result.student?.username || "Siswa";
    if (!window.confirm(`Paksa selesaikan ujian untuk ${studentName}? Jawaban yang sudah tersimpan saat ini akan langsung dinilai.`)) return;

    setFinalizingIds(prev => new Set(prev).add(result.id));

    // OPTIMISTIC UPDATE: Langsung ubah status agar tombol 'Paksa Selesai' hilang seketika (0 detik)!
    setLocalExams(prev => prev.map(e => {
      if (e.id !== examId) return e;
      return {
        ...e,
        results: (e.results || []).map((r: any) => {
          if (r.id !== result.id) return r;
          return {
            ...r,
            gradingStatus: "PENDING",
          };
        })
      };
    }));

    try {
      const finRes = await forceFinalizeExamResult(result.id);
      if (finRes.success && finRes.result) {
        setLocalExams(prev => prev.map(e => {
          if (e.id !== examId) return e;
          return {
            ...e,
            results: (e.results || []).map((r: any) => {
              if (r.id !== result.id) return r;
              return {
                ...r,
                score: finRes.result.score,
                essayScore: finRes.result.essayScore,
                gradingStatus: finRes.result.gradingStatus,
                timeSpent: finRes.result.timeSpent
              };
            })
          };
        }));

        // JIKA STATUSNYA PENDING (ada esai yang perlu dinilai AI):
        // LANGSUNG JALANKAN AI OTOMATIS SAAT ITU JUGA TANPA HARUS KLIK TOMBOL LAGI!
        if (finRes.result.gradingStatus === "PENDING") {
          handleProcessAI(result.id).then(() => {
            getExams().then(freshExams => setLocalExams(freshExams as unknown as UIExam[]));
          });
        }
      } else if (!finRes.success) {
        alert(finRes.error || "Gagal memproses penilaian paksa.");
        router.refresh();
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat memproses ujian.");
      router.refresh();
    } finally {
      setFinalizingIds(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedExam(expandedExam === id ? null : id);
  };

  const handleDownloadExcel = (exam: UIExam) => {
    if (!exam.results || exam.results.length === 0) {
      alert("Belum ada data nilai untuk diunduh.");
      return;
    }

    const dataToExport = exam.results.map((res: any, index: number) => ({
      "No": index + 1,
      "Nama Ujian": `${exam.examType} - ${exam.subject}`,
      "Nama Siswa": res.student?.name || res.student?.username || "Siswa",
      "Kelas": res.student?.className || "-",
      "Total Nilai": res.score,
      "Status Ujian": res.gradingStatus === "STARTED" ? "Mengerjakan" : res.gradingStatus === "PENDING" ? "Menunggu AI" : res.gradingStatus === "MANUAL_REVIEW" ? "Menunggu Koreksi Guru" : "Selesai"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nilai Siswa");

    const safeFileName = `Nilai_${exam.subject.replace(/[^a-z0-9]/gi, '_')}_${exam.targetClass.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
    XLSX.writeFile(workbook, safeFileName);
  };

  const renderExamCard = (exam: any) => {
    const isExpanded = expandedExam === exam.id;
    const startedStudents = exam.results?.filter((r: any) => r.gradingStatus === "STARTED") || [];
    const hasStudents = (exam.results?.length || 0) > 0;

    return (
      <div 
        key={exam.id} 
        className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-all hover:border-slate-300 ${
          startedStudents.length > 0 
            ? "border-emerald-300 ring-1 ring-emerald-200" 
            : hasStudents 
              ? "border-blue-200" 
              : "border-slate-200/80"
        }`}
      >
        <div 
          className={`p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer gap-4 md:gap-0 ${
            startedStudents.length > 0 
              ? "bg-emerald-50/40" 
              : hasStudents 
                ? "bg-slate-50/80" 
                : "bg-slate-50"
          }`}
          onClick={() => toggleExpand(exam.id)}
        >
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-lg shrink-0 mt-1 md:mt-0 ${
              startedStudents.length > 0 
                ? "bg-emerald-100 text-emerald-700" 
                : hasStudents 
                  ? "bg-blue-100 text-blue-700" 
                  : "bg-indigo-100 text-indigo-700"
            }`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-slate-900 text-lg leading-tight">{exam.examType} - {exam.subject}</h4>
                {startedStudents.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    {startedStudents.length} Siswa Sedang Mengerjakan ({exam.results.length} Total Siswa)
                  </span>
                ) : hasStudents ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Users className="w-3.5 h-3.5" />
                    {exam.results.length} Siswa Telah Mengerjakan
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    Belum Ada Siswa
                  </span>
                )}
              </div>
              <div className="text-slate-500 text-sm mt-1 flex flex-wrap gap-2 items-center">
                <div className="flex flex-wrap gap-1">
                  {(exam.targetClass === "Semua Kelas" ? ["Semua Kelas"] : String(exam.targetClass).split(",")).map((cls: string, idx: number) => (
                    <span key={idx} className="bg-white border border-slate-200 px-2.5 py-0.5 rounded-md font-medium text-slate-700 shadow-sm">Kelas: {cls.trim()}</span>
                  ))}
                </div>
                <span className="hidden md:inline text-slate-300">•</span>
                {editingExamId === exam.id ? (
                   <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                     <Input 
                       type="number" 
                       className="w-20 h-7 text-xs" 
                       value={editDuration} 
                       onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)} 
                     />
                     <span className="text-xs">Menit</span>
                     <button onClick={() => handleUpdateDuration(exam.id)} disabled={loading} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save className="w-3 h-3" /></button>
                     <button onClick={() => setEditingExamId(null)} className="p-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"><X className="w-3 h-3" /></button>
                   </div>
                ) : (
                   <span className="bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-md font-medium text-orange-700 shadow-sm flex items-center gap-1">
                      Waktu: {exam.duration} Menit 
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingExamId(exam.id); 
                          setEditDuration(exam.duration); 
                        }}
                        className="ml-1 hover:text-orange-900"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                   </span>
                )}
                {editingTokenExamId === exam.id ? (
                   <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                     <span className="text-xs font-semibold text-slate-500">Token:</span>
                     <Input 
                       type="text" 
                       className="w-28 h-7 text-xs font-mono uppercase font-bold" 
                       value={editToken} 
                       onChange={(e) => setEditToken(e.target.value.toUpperCase())}
                       placeholder="TOKEN" 
                       autoFocus
                     />
                     <button onClick={() => handleUpdateToken(exam.id)} disabled={loading} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Simpan Token"><Save className="w-3.5 h-3.5" /></button>
                     <button onClick={() => setEditingTokenExamId(null)} className="p-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200" title="Batal"><X className="w-3.5 h-3.5" /></button>
                   </div>
                ) : (
                   <span className="font-mono bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-100 font-semibold tracking-wider flex items-center gap-1.5 shadow-sm">
                     Token: {exam.token}
                     <button 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         setEditingTokenExamId(exam.id); 
                         setEditToken(exam.token); 
                       }}
                       className="ml-1 hover:text-blue-900 transition-colors"
                       title="Ubah Token Ujian"
                     >
                       <Edit2 className="w-3 h-3" />
                     </button>
                   </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button 
              onClick={(e) => handleDeleteExam(e, exam.id)}
              className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
              title="Hapus Ujian"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 md:p-6 bg-white border-t border-slate-200">
            
            {/* View / Manage Questions Link */}
            <div className="mb-8 flex items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div>
                <h4 className="font-semibold text-slate-800">Manajemen Soal ({exam.questions?.length || 0} Soal)</h4>
                <p className="text-xs text-slate-500 mt-1">Tambah, edit, atau hapus soal untuk ujian ini di halaman khusus.</p>
              </div>
              <Link href={`/manage/exam/${exam.id}/questions`}>
                <Button variant="primary" className="flex items-center gap-2 shadow-sm">
                  <ExternalLink className="w-4 h-4" /> Lihat / Kelola Soal
                </Button>
              </Link>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-slate-800 tracking-tight">Daftar Nilai Siswa</h4>
                <button 
                  onClick={() => handleDownloadExcel(exam)}
                  className="flex items-center gap-2 text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 shadow-sm text-xs py-2 px-4 rounded-lg font-bold transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <Download className="w-4 h-4" /> Unduh ke Excel
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/60">
                    <tr>
                      <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Siswa</th>
                      <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Kelas</th>
                      <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Waktu</th>
                      <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Nilai</th>
                      <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Status</th>
                      <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {exam.results && exam.results.map((res: any) => {
                      return (
                        <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-5 font-semibold text-slate-900">{res.student?.name || res.student?.username || "Siswa"}</td>
                          <td className="py-3 px-5 text-slate-600">{res.student?.className || "-"}</td>
                          <td className="py-3 px-5 text-slate-600 font-mono text-sm">
                            <LiveTime createdAt={res.createdAt} timeSpent={res.timeSpent} status={res.gradingStatus} />
                          </td>
                          <td className="py-3 px-5 font-bold text-slate-900 text-base">
                            <div className="flex flex-col">
                              <span>{res.score ?? 0}</span>
                              {res.essayScore !== null && typeof res.essayScore !== 'undefined' && (
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight mt-0.5">
                                  PG: {parseFloat(((res.score || 0) - (res.essayScore || 0)).toFixed(2))} <span className="text-slate-300">|</span> Esai: {res.essayScore}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 align-middle">
                            <div className="flex flex-col gap-1 items-start">
                              {res.gradingStatus === "STARTED" ? (
                                (() => {
                                  const isOverdue = exam.duration && res.createdAt && ((Date.now() - new Date(res.createdAt).getTime()) > (exam.duration * 60 * 1000));
                                  return isOverdue ? (
                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold text-center w-24" title="Waktu pengerjaan telah melebihi batas durasi ujian">Waktu Habis</span>
                                  ) : (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold text-center w-24">Mengerjakan</span>
                                  );
                                })()
                              ) : res.gradingStatus === "PENDING" ? (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-semibold text-center w-24">Menunggu AI</span>
                              ) : res.gradingStatus === "MANUAL_REVIEW" ? (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-semibold text-center w-24">Perlu Koreksi</span>
                              ) : (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold text-center w-24">Selesai</span>
                              )}
                              {Boolean(res.violations && res.violations > 0) && (
                                <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-semibold text-center mt-1 w-24" title={`${res.violations} kali terdeteksi meninggalkan tab / layar ujian`}>
                                  ⚠️ {res.violations}x Keluar
                                </span>
                              )}
                              {res.isCheated && (
                                <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded font-bold text-center mt-1 w-24">
                                  Curang
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 align-middle text-right">
                            <div className="flex gap-2 items-center justify-end flex-wrap">
                              {res.gradingStatus === "STARTED" && (
                                <button 
                                  onClick={() => handleForceFinalizeStudent(exam.id, res)}
                                  disabled={finalizingIds.has(res.id)}
                                  className="text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors whitespace-nowrap disabled:opacity-50"
                                  title="Kunci ujian murid ini dan langsung hitung nilainya"
                                >
                                  {finalizingIds.has(res.id) ? "Memproses..." : "Paksa Selesai"}
                                </button>
                              )}
                              <button 
                                onClick={() => { setViewingResult(res); setViewingExam(exam); }}
                                className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors whitespace-nowrap"
                              >
                                Detail Jawaban
                              </button>
                              <button 
                                onClick={() => handleDeleteStudentResult(exam.id, res.id, res.student?.name || res.student?.username || "Siswa")}
                                className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors whitespace-nowrap"
                                title="Hapus Nilai Murid Ini"
                              >
                                Hapus
                              </button>
                              {(res.gradingStatus === "PENDING" || res.gradingStatus === "GRADED" || res.gradingStatus === "MANUAL_REVIEW") && (
                                <button 
                                  onClick={() => handleProcessAI(res.id)}
                                  disabled={activeBatch.has(res.id)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                                  title="Gunakan ini untuk menilai esai menggunakan AI"
                                >
                                  {activeBatch.has(res.id) ? (
                                    processingProgress[res.id] || "Memproses..."
                                  ) : (
                                    <>
                                      <Bot className="w-3.5 h-3.5" />
                                      {res.gradingStatus === "PENDING" ? "Proses AI" : res.gradingStatus === "MANUAL_REVIEW" ? "Koreksi AI" : "Nilai Ulang AI"}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!exam.results || exam.results.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">Belum ada siswa yang mengerjakan ujian ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="mt-8 shadow-sm border-slate-200/60 rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row justify-between items-center border-b border-slate-100 bg-slate-50/50 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Soal & Ujian</h2>
      </CardHeader>
      <CardContent className="pt-6">
        
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200/60 shadow-sm mb-8">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" /> Buat Sesi Ujian Baru
          </h3>
          <form onSubmit={handleAddExam} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
             <label className="text-sm font-medium text-slate-700 block mb-1">Tipe Ujian</label>
             {isCustomExamType ? (
               <div className="flex gap-2">
                 <Input 
                   placeholder="Ketik tipe ujian..." 
                   value={examType} 
                   onChange={(e) => setExamType(e.target.value)}
                   required
                   autoFocus
                 />
                 <button 
                   type="button" 
                   onClick={() => {
                     setIsCustomExamType(false);
                     setExamType("Ujian Tengah Semester");
                   }}
                   className="px-3 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-300 transition-colors"
                   title="Batal custom tipe"
                 >
                   <X className="w-4 h-4"/>
                 </button>
               </div>
             ) : (
               <select 
                 className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value={examType}
                 onChange={(e) => {
                   if (e.target.value === "custom") {
                     setIsCustomExamType(true);
                     setExamType("");
                   } else {
                     setExamType(e.target.value);
                   }
                 }}
               >
                 <option value="Ujian Tengah Semester">Ujian Tengah Semester</option>
                 <option value="Ujian Akhir Semester">Ujian Akhir Semester</option>
                 <option value="Ulangan Harian">Ulangan Harian</option>
                 <option value="Kuis">Kuis</option>
                 <option value="custom" className="font-semibold text-blue-600">+ Tambah Tipe Lainnya...</option>
               </select>
             )}
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700 block mb-1">Mata Pelajaran</label>
              {availableSubjects && availableSubjects.length > 0 ? (
                 <select
                   className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={subject}
                   onChange={(e) => setSubject(e.target.value)}
                   required
                 >
                   <option value="" disabled>-- Pilih Mata Pelajaran --</option>
                   {availableSubjects.map(sub => (
                     <option key={sub} value={sub}>{sub}</option>
                   ))}
                 </select>
              ) : (
                 <Input 
                   placeholder="Contoh: Biologi" 
                   value={subject} 
                   onChange={(e) => setSubject(e.target.value)}
                   required
                 />
              )}
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700 block mb-1">Kelas Target <span className="text-xs text-slate-500 font-normal">(Pilih dari opsi)</span></label>
              <div className="flex flex-col gap-2">
                <select
                  className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value=""
                  onChange={(e) => {
                    const newClass = e.target.value;
                    if (newClass && !targetClasses.includes(newClass)) {
                      setTargetClasses([...targetClasses, newClass]);
                    }
                  }}
                >
                  <option value="" disabled>-- Klik untuk memilih kelas --</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1">
                  {targetClasses.length === 0 && <span className="text-xs text-slate-400 italic">"Semua Kelas" akan dipilih jika kosong.</span>}
                  {targetClasses.map(cls => (
                    <span key={cls} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md border border-blue-100 flex items-center gap-1">
                      {cls}
                      <button type="button" onClick={() => removeClass(cls)} className="hover:text-red-500"><X className="w-3 h-3"/></button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700 block mb-1">Durasi (Menit)</label>
              <Input 
                type="number"
                min={1}
                value={duration} 
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Token Ujian <span className="text-xs text-slate-400 font-normal">(Opsional / Custom)</span>
              </label>
              <Input 
                type="text"
                placeholder="Otomatis jika kosong" 
                value={examTokenInput} 
                onChange={(e) => setExamTokenInput(e.target.value.toUpperCase())}
                className="uppercase font-mono"
                maxLength={20}
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  checked={isAIGradingEnabled}
                  onChange={(e) => setIsAIGradingEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Gunakan Asisten AI (Auto-Grading)</span>
              </label>
            </div>
            <div className="md:col-span-3 flex justify-end border-t border-slate-100 pt-5 mt-2">
              <Button type="submit" disabled={loading || !subject.trim()} className="w-full md:w-auto font-medium shadow-sm">
                {loading ? "Menyimpan..." : "Simpan Sesi Ujian"}
              </Button>
            </div>
          </form>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-slate-50/70 p-3 md:p-4 rounded-xl border border-slate-200/80">
          <button 
            type="button"
            onClick={() => setIsExamListOpen(!isExamListOpen)}
            className="flex items-center gap-3 font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left"
          >
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              <FolderEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg">Daftar Sesi Ujian</span>
                {isExamListOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Total {localExams.length} Mapel • <span className="text-emerald-700 font-medium">{activeExams.length} Ada Siswa</span> • <span className="text-slate-600">{idleExams.length} Belum Ada Siswa</span>
              </p>
            </div>
          </button>

          {/* Quick Filter Classification Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterClassification("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterClassification === "ALL"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({localExams.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterClassification("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                filterClassification === "ACTIVE"
                  ? "bg-emerald-600 text-white shadow-sm font-bold"
                  : "text-emerald-700 hover:bg-emerald-100/60"
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Ada Siswa ({activeExams.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterClassification("IDLE")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                filterClassification === "IDLE"
                  ? "bg-slate-700 text-white shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Belum Ada Siswa ({idleExams.length})
            </button>
          </div>
        </div>

        {isExamListOpen && (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">
            {localExams.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-medium">Belum ada sesi ujian yang dibuat.</p>
                <p className="text-slate-400 text-xs mt-1">Buat sesi ujian baru menggunakan formulir di atas.</p>
              </div>
            ) : (
              <>
                {/* KATEGORI 1: UJIAN SEDANG BERLANGSUNG / MEMILIKI SISWA */}
                {(filterClassification === "ALL" || filterClassification === "ACTIVE") && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b-2 border-emerald-500/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                          <Flame className="w-5 h-5 text-emerald-600" />
                          Ujian Sedang Berlangsung / Memiliki Siswa
                        </h4>
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                          {activeExams.length} Mapel
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Mapel otomatis berpindah ke sini ketika siswa menginput token atau mulai ujian
                      </p>
                    </div>

                    {activeExams.length > 0 ? (
                      <div className="space-y-4">
                        {activeExams.map(renderExamCard)}
                      </div>
                    ) : (
                      <div className="p-6 bg-emerald-50/40 rounded-xl border border-emerald-100 text-center">
                        <p className="text-sm font-medium text-emerald-900">Belum ada siswa yang mengerjakan ujian apapun saat ini.</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Begitu siswa memasukkan token di HP/perangkat mereka, mapel ujian akan otomatis muncul di bagian ini.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* KATEGORI 2: UJIAN BELUM ADA SISWA */}
                {(filterClassification === "ALL" || filterClassification === "IDLE") && (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-slate-500" />
                          Daftar Ujian Tersedia (Belum Ada Siswa)
                        </h4>
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                          {idleExams.length} Mapel
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Ujian yang sudah siap dan menunggu siswa memasukkan token
                      </p>
                    </div>

                    {idleExams.length > 0 ? (
                      <div className="space-y-4">
                        {idleExams.map(renderExamCard)}
                      </div>
                    ) : (
                      <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <p className="text-sm font-medium text-slate-600">Semua ujian saat ini telah memiliki siswa.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </CardContent>

      {/* Detail Modal */}
      {viewingResult && viewingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-xl text-slate-900">Detail Jawaban: {viewingResult.student?.name || viewingResult.student?.username || "Siswa"}</h3>
                <p className="text-sm text-slate-500 mt-1 flex items-center flex-wrap gap-2">
                  <span>Nilai Total: <strong className="text-slate-900 text-lg">{viewingResult.score ?? 0}</strong></span>
                  {viewingResult.essayScore !== null && typeof viewingResult.essayScore !== 'undefined' && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-bold border border-blue-100">
                      PG: {parseFloat(((viewingResult.score || 0) - (viewingResult.essayScore || 0)).toFixed(2))} + Esai: {viewingResult.essayScore}
                    </span>
                  )}
                  <span className="text-slate-300">|</span> 
                  <span>Status: <span className="font-semibold text-slate-700">{viewingResult.gradingStatus}</span></span>
                  {Boolean(viewingResult.violations && viewingResult.violations > 0) && (
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-xs font-bold">
                      ⚠️ {viewingResult.violations}x Keluar Layar/Tab
                    </span>
                  )}
                  {viewingResult.isCheated && (
                    <span className="px-2.5 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded-md text-xs font-bold">
                      ⛔ Terindikasi Curang
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => { setViewingResult(null); setViewingExam(null); }} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {viewingResult.aiFeedback && (
                 <div className="mb-6 space-y-3">
                    <h4 className="font-bold text-blue-900 flex items-center gap-2">🤖 Evaluasi Cerdas AI</h4>
                    <div className="grid gap-3">
                      {viewingResult.aiFeedback.split(/(?:\\n\\n|\n\n)/).map((feedback: string, i: number) => {
                         if (!feedback.trim()) return null;
                         
                         const match = feedback.match(/^Soal:\s*([\s\S]*?)\s*-\s*AI Score:\s*([\w\d]+\/100)\.\s*Alasan:\s*([\s\S]*)$/);
                         
                         if (match) {
                           return (
                             <div key={i} className="p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl flex flex-col gap-2 transition-colors">
                               <p className="text-sm font-medium text-slate-700 leading-relaxed"><span className="font-bold text-slate-400 mr-1">Q:</span> {match[1]}</p>
                               <div className="flex items-start gap-3 mt-1 pt-2 border-t border-blue-100/50">
                                 <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-blue-600 text-white whitespace-nowrap shadow-sm">
                                   Skor: {match[2]}
                                 </span>
                                 <p className="text-sm text-slate-600 leading-relaxed">
                                   <span className="font-semibold text-blue-800 mr-1">Alasan:</span> 
                                   {match[3]}
                                 </p>
                               </div>
                             </div>
                           )
                         }
                         
                         return (
                           <div key={i} className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-sm text-slate-700 whitespace-pre-wrap">
                             {feedback}
                           </div>
                         )
                      })}
                    </div>
                 </div>
              )}
              
              <h4 className="font-bold text-slate-800 border-b pb-2">Rincian Jawaban:</h4>
              <div className="space-y-4">
                {viewingExam.questions?.map((q: any, idx: number) => {
                  let answersObj: Record<string, string> = {};
                  try { if(viewingResult.answersJson) answersObj = JSON.parse(viewingResult.answersJson); } catch {}
                  
                  const studentAns = answersObj[q.id] || "Tidak dijawab";
                  const isEssay = q.type === "ESSAY";
                  
                  let displayAnswer = studentAns;
                  let isCorrect = false;
                  let calculatedCorrectAnswer = "A";
                  
                  if (!isEssay) {
                    const maxW = Math.max(q.weightA || 0, q.weightB || 0, q.weightC || 0, q.weightD || 0);
                    if (maxW > 0) {
                      if (q.weightA === maxW) calculatedCorrectAnswer = "A";
                      else if (q.weightB === maxW) calculatedCorrectAnswer = "B";
                      else if (q.weightC === maxW) calculatedCorrectAnswer = "C";
                      else if (q.weightD === maxW) calculatedCorrectAnswer = "D";
                    } else if ((q as any).correctOption) {
                      calculatedCorrectAnswer = (q as any).correctOption;
                    }
                  }
                  
                  if (!isEssay && studentAns !== "Tidak dijawab") {
                    isCorrect = studentAns === calculatedCorrectAnswer;
                    if (studentAns === "A") displayAnswer = `A. ${q.optionA}`;
                    else if (studentAns === "B") displayAnswer = `B. ${q.optionB}`;
                    else if (studentAns === "C") displayAnswer = `C. ${q.optionC}`;
                    else if (studentAns === "D") displayAnswer = `D. ${q.optionD}`;
                  }
                  
                  return (
                    <div key={q.id} className={`p-4 border rounded-xl ${!isEssay && studentAns !== "Tidak dijawab" ? (isCorrect ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30') : 'border-slate-200 bg-slate-50/50'}`}>
                      <p className="font-medium text-slate-900 mb-2 leading-snug whitespace-pre-wrap">
                        <span className="font-bold text-blue-600 mr-2">{idx + 1}.</span>
                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded mr-2 font-bold">{isEssay ? 'ESAI' : 'PG'}</span>
                        {formatMathText(q.text)}
                      </p>
                      
                      <div className="mt-3 bg-white p-3 border border-slate-200 rounded-lg flex flex-col gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Jawaban Siswa:</span>
                          <div className="flex items-start justify-between gap-4">
                            <p className={`text-slate-800 whitespace-pre-wrap ${isEssay ? 'italic' : 'font-bold'}`}>{formatMathText(displayAnswer)}</p>
                            {!isEssay && studentAns !== "Tidak dijawab" && (
                              <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isCorrect ? 'BENAR' : 'SALAH'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {!isEssay && !isCorrect && studentAns !== "Tidak dijawab" && (
                          <div className="pt-2 mt-1 border-t border-slate-100">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Kunci Jawaban:</span>
                             <p className="text-green-700 font-bold text-sm">
                               {formatMathText(calculatedCorrectAnswer === "A" ? `A. ${q.optionA}` : calculatedCorrectAnswer === "B" ? `B. ${q.optionB}` : calculatedCorrectAnswer === "C" ? `C. ${q.optionC}` : `D. ${q.optionD}`)}
                             </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
