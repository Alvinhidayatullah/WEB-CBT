"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BookOpen, Trash2, Edit2, ChevronDown, ChevronUp, Save, X, ExternalLink, FolderEdit, Download } from "lucide-react";
import { createExam, deleteExam, updateExam, getExams, getPendingEssayPayloads, gradeSingleEssayAction, finalizeAIGrading, deleteExamResult } from "@/actions/dashboardActions";
import Link from "next/link";
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
  questions?: UIQuestion[];
  results?: UIExamResult[];
}

export function QuestionManagement({ exams = [], availableClasses = [], availableSubjects = [] }: { exams: UIExam[], availableClasses?: string[], availableSubjects?: string[] }) {
  const [localExams, setLocalExams] = useState<UIExam[]>(exams);

  React.useEffect(() => {
    setLocalExams(exams);
  }, [exams]);

  const [examType, setExamType] = useState("Ujian Tengah Semester");
  const [subject, setSubject] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [classInput, setClassInput] = useState("");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  // Edit State
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState(60);

  // View Details State
  const [viewingResult, setViewingResult] = useState<any | null>(null);
  const [viewingExam, setViewingExam] = useState<UIExam | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>("");
  const [autoProcessQueue, setAutoProcessQueue] = useState<string[]>([]);
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const freshExams = (await getExams()) as unknown as UIExam[];
        setLocalExams(prev => {
          return freshExams;
        });

        // Auto-queue check for PENDING exams
        const pendingResultIds: string[] = [];
        freshExams.forEach(exam => {
          if (exam.results) {
            exam.results.forEach(res => {
              if (res.gradingStatus === "PENDING") {
                pendingResultIds.push(res.id);
              }
            });
          }
        });

        setAutoProcessQueue(pendingResultIds);

      } catch (e) {
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Background Worker Effect
  React.useEffect(() => {
    if (processingId !== null || autoProcessQueue.length === 0) return;
    
    // Start processing the first item in the queue
    const nextId = autoProcessQueue[0];
    handleProcessAI(nextId);
  }, [autoProcessQueue, processingId]);

  const handleProcessAI = async (resId: string) => {
    if (processingId !== null) return;
    setProcessingId(resId);
    setProcessingProgress("Mengambil data...");

    try {
      const payloadRes = await getPendingEssayPayloads(resId);
      if (!payloadRes.success || !payloadRes.payloads) {
        setProcessingProgress("");
        setProcessingId(null);
        return;
      }

      const { payloads, totalMaxWeights, totalEarnedWeights } = payloadRes;
      
      if (payloads.length === 0) {
        await finalizeAIGrading(resId, totalEarnedWeights || 0, totalMaxWeights || 0, 0, []);
        setProcessingProgress("");
        setProcessingId(null);
        return;
      }

      let totalEssayScore = 0;
      let aiFeedbacks: string[] = [];

      for (let i = 0; i < payloads.length; i++) {
        const essay = payloads[i];
        setProcessingProgress(`Menilai soal ${i + 1} dari ${payloads.length}...`);
        
        const aiRes = await gradeSingleEssayAction(essay.questionText, essay.referenceAnswer, essay.studentAnswer);
        
        if (aiRes.success) {
          const score = aiRes.score || 0;
          const weightedScore = (score / 100) * essay.weight;
          totalEssayScore += weightedScore;
          aiFeedbacks.push(`Soal: ${essay.questionText} - AI Score: ${score}/100. Alasan: ${aiRes.reason}`);
        } else {
          aiFeedbacks.push(`Soal: ${essay.questionText} - AI Score: 0/100. Alasan: Gagal memproses - ${aiRes.error}`);
        }
      }

      setProcessingProgress("Menyimpan hasil...");
      await finalizeAIGrading(resId, totalEarnedWeights || 0, totalMaxWeights || 0, totalEssayScore, aiFeedbacks);

      setProcessingId(null);
      setProcessingProgress("");
      
      // Remove from auto queue locally so it moves to next
      setAutoProcessQueue(prev => prev.filter(id => id !== resId));

    } catch (err) {
      setProcessingId(null);
      setProcessingProgress("");
    }
  };

  const removeClass = (cls: string) => {
    setTargetClasses(targetClasses.filter(c => c !== cls));
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setLoading(true);
    const finalTargetClass = targetClasses.length > 0 ? targetClasses.join(", ") : "Semua Kelas";
    const res = await createExam(examType, subject, finalTargetClass, duration);
    if (res.success && res.exam) {
      setLocalExams([res.exam, ...localExams]);
      setSubject("");
      setTargetClasses([]);
      setClassInput("");
      setDuration(60);
    } else {
      alert(res.error || "Gagal membuat sesi ujian");
    }
    setLoading(false);
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

  const handleDeleteExam = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Hapus sesi ujian ini beserta semua soalnya?")) return;
    const res = await deleteExam(id);
    if (res.success) {
      setLocalExams(localExams.filter(exam => exam.id !== id));
    } else {
      alert(res.error || "Gagal menghapus ujian");
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

    const dataToExport = exam.results.map((res: any) => ({
      "Nama Ujian": `${exam.examType} - ${exam.subject}`,
      "Siswa": res.student.username,
      "Kelas": res.student.className || "-",
      "Waktu Pengerjaan": res.timeSpent ? `${Math.floor(res.timeSpent / 60)}m ${res.timeSpent % 60}s` : "-",
      "Nilai PG & Total": res.score,
      "Nilai Esai (AI)": res.essayScore !== null ? res.essayScore : "-",
      "Ulasan AI": res.aiFeedback || "-",
      "Status Ujian": res.gradingStatus === "PENDING" ? "Menunggu AI" : "Selesai",
      "Indikasi Curang": res.isCheated ? "Ya" : "Tidak"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nilai Siswa");

    const safeFileName = `Nilai_${exam.subject.replace(/[^a-z0-9]/gi, '_')}_${exam.targetClass.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
    XLSX.writeFile(workbook, safeFileName);
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
             <select 
               className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white"
               value={examType}
               onChange={(e) => setExamType(e.target.value)}
             >
               <option value="Ujian Tengah Semester">Ujian Tengah Semester</option>
               <option value="Ujian Akhir Semester">Ujian Akhir Semester</option>
               <option value="Ulangan Harian">Ulangan Harian</option>
               <option value="Kuis">Kuis</option>
             </select>
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
            <div className="md:col-span-3 flex justify-end border-t border-slate-100 pt-5 mt-2">
              <Button type="submit" disabled={loading || !subject.trim()} className="w-full md:w-auto font-medium shadow-sm">
                {loading ? "Menyimpan..." : "Simpan Sesi Ujian"}
              </Button>
            </div>
          </form>
        </div>

        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
          <FolderEdit className="w-5 h-5 text-indigo-600" /> Daftar Ujian Aktif
        </h3>
        <div className="space-y-4">
          {localExams.map((exam) => {
            const isExpanded = expandedExam === exam.id;
            return (
              <div key={exam.id} className="border border-slate-200/80 rounded-xl bg-white shadow-sm overflow-hidden transition-all hover:border-slate-300">
                <div 
                  className="bg-slate-50 p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer gap-4 md:gap-0"
                  onClick={() => toggleExpand(exam.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-lg shrink-0 mt-1 md:mt-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg leading-tight">{exam.examType} - {exam.subject}</h4>
                      <div className="text-slate-500 text-sm mt-1 flex flex-wrap gap-2 items-center">
                        <div className="flex flex-wrap gap-1">
                          {(exam.targetClass === "Semua Kelas" ? ["Semua Kelas"] : exam.targetClass.split(",")).map((cls, idx) => (
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
                        <span className="hidden md:inline text-slate-300">•</span>
                        <span className="font-mono bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-100 font-semibold tracking-wider">Token: {exam.token}</span>
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
                              <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {exam.results && exam.results.map((res: any) => {
                              const timeStr = res.timeSpent ? `${Math.floor(res.timeSpent / 60)}m ${res.timeSpent % 60}s` : "-";
                              return (
                                <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-5 font-semibold text-slate-900">{res.student.username}</td>
                                  <td className="py-3 px-5 text-slate-600">{res.student.className || "-"}</td>
                                  <td className="py-3 px-5 text-slate-600 font-mono text-sm">{timeStr}</td>
                                  <td className="py-3 px-5 font-bold text-slate-900 text-base">
                                    {res.score} 
                                    {res.essayScore !== null && typeof res.essayScore !== 'undefined' && (
                                      <span className="text-xs text-blue-600 ml-1">(+ Esai: {res.essayScore})</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-5 align-middle">
                                    <div className="flex flex-col gap-1 items-start">
                                      {res.gradingStatus === "PENDING" ? (
                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-semibold text-center w-24">Menunggu AI</span>
                                      ) : (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold text-center w-24">Selesai</span>
                                      )}
                                      {res.isCheated && (
                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-semibold text-center mt-1 w-24">Curang</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-5 text-right align-middle">
                                    <div className="flex flex-col gap-2 items-end justify-center">
                                      <div className="flex gap-2 w-full max-w-[170px] justify-end">
                                        <button 
                                          onClick={() => { setViewingResult(res); setViewingExam(exam); }}
                                          className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex-1"
                                        >
                                          Detail Jawaban
                                        </button>
                                        <button 
                                          onClick={async () => {
                                            if (!window.confirm(`Hapus nilai atas nama ${res.student.username}? Mereka harus mengerjakan ulang ujian ini jika dihapus.`)) return;
                                            const deleteRes = await deleteExamResult(res.id);
                                            if (deleteRes.success) {
                                              setLocalExams(prev => prev.map(e => e.id === exam.id ? { ...e, results: e.results?.filter((r: any) => r.id !== res.id) } : e));
                                            } else {
                                              alert(deleteRes.error);
                                            }
                                          }}
                                          className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors flex-shrink-0"
                                          title="Hapus Nilai Murid Ini"
                                        >
                                          Hapus
                                        </button>
                                      </div>
                                      <button 
                                        onClick={() => handleProcessAI(res.id)}
                                        disabled={processingId !== null}
                                        className="text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors w-full max-w-[170px] disabled:opacity-50"
                                        title="Gunakan ini untuk menilai ulang esai jika sistem AI sebelumnya gagal"
                                      >
                                        {processingId === res.id ? processingProgress || "Memproses..." : (res.gradingStatus === "PENDING" ? "🚀 Proses AI" : "🚀 Nilai Ulang AI")}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {(!exam.results || exam.results.length === 0) && (
                              <tr>
                                <td colSpan={5} className="py-4 text-center text-slate-500">Belum ada siswa yang mengerjakan ujian ini.</td>
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
          })}
          {localExams.length === 0 && (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              <p className="text-slate-500 text-sm">Belum ada sesi ujian yang dibuat.</p>
            </div>
          )}
        </div>

      </CardContent>

      {/* Detail Modal */}
      {viewingResult && viewingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-xl text-slate-900">Detail Jawaban: {viewingResult.student.username}</h3>
                <p className="text-sm text-slate-500 mt-1">Nilai Total: <strong className="text-slate-800">{viewingResult.score}</strong> | Status: {viewingResult.gradingStatus}</p>
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
                  try { if(viewingResult.answersJson) answersObj = JSON.parse(viewingResult.answersJson); } catch (e) {}
                  
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
                      <p className="font-medium text-slate-900 mb-2">
                        <span className="font-bold text-blue-600 mr-2">{idx + 1}.</span>
                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded mr-2 font-bold">{isEssay ? 'ESAI' : 'PG'}</span>
                        {q.text}
                      </p>
                      
                      <div className="mt-3 bg-white p-3 border border-slate-200 rounded-lg flex flex-col gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Jawaban Siswa:</span>
                          <div className="flex items-start justify-between gap-4">
                            <p className={`text-slate-800 ${isEssay ? 'italic' : 'font-bold'}`}>{displayAnswer}</p>
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
                               {calculatedCorrectAnswer === "A" ? `A. ${q.optionA}` : calculatedCorrectAnswer === "B" ? `B. ${q.optionB}` : calculatedCorrectAnswer === "C" ? `C. ${q.optionC}` : `D. ${q.optionD}`}
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
