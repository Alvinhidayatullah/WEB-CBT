"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2, Plus, BookOpen, ChevronDown, ChevronUp, FolderEdit, Edit2, Save, X } from "lucide-react";
import { createExam, createQuestion, deleteQuestion, deleteExam, updateExam } from "@/actions/dashboardActions";

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

export function QuestionManagement({ exams = [], availableClasses = [] }: { exams: UIExam[], availableClasses?: string[] }) {
  const [examType, setExamType] = useState("Ujian Tengah Semester");
  const [subject, setSubject] = useState("");
  const [targetClass, setTargetClass] = useState(availableClasses[0] || "");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  // Edit State
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState(60);

  // Question Form State
  const [qText, setQText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOpt, setCorrectOpt] = useState("A");

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setLoading(true);
    const res = await createExam(examType, subject, targetClass, duration);
    if (res.success) {
      setSubject("");
      setTargetClass("");
      setDuration(60);
    } else {
      alert(res.error || "Gagal membuat sesi ujian");
    }
    setLoading(false);
  };

  const handleUpdateDuration = async (id: string) => {
    setLoading(true);
    await updateExam(id, { duration: editDuration });
    setEditingExamId(null);
    setLoading(false);
  };

  const handleAddQuestion = async (e: React.FormEvent, examId: string) => {
    e.preventDefault();
    setLoading(true);
    const res = await createQuestion({
      examId,
      text: qText,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      correctOption: correctOpt,
    });
    if (res.success) {
      setQText("");
      setOptA("");
      setOptB("");
      setOptC("");
      setOptD("");
      setCorrectOpt("A");
    } else {
      alert(res.error || "Gagal menambahkan soal");
    }
    setLoading(false);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm("Hapus soal ini?")) return;
    const res = await deleteQuestion(id);
    if (!res.success) alert(res.error || "Gagal menghapus soal");
  };

  const handleDeleteExam = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Hapus sesi ujian ini beserta semua soalnya?")) return;
    const res = await deleteExam(id);
    if (!res.success) alert(res.error || "Gagal menghapus ujian");
  };

  const toggleExpand = (id: string) => {
    setExpandedExam(expandedExam === id ? null : id);
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
             <Input 
               placeholder="Contoh: Biologi" 
               value={subject} 
               onChange={(e) => setSubject(e.target.value)}
             />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-700 block mb-1">Kelas Target</label>
              <Input 
                placeholder="Contoh: MIPA 2" 
                value={targetClass} 
                onChange={(e) => setTargetClass(e.target.value)}
                required
              />
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
          {exams.map((exam) => {
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
                      <p className="text-slate-500 text-sm mt-1 flex flex-wrap gap-2 items-center">
                        <span className="bg-white border border-slate-200 px-2.5 py-0.5 rounded-md font-medium text-slate-700 shadow-sm">Kelas: {exam.targetClass || "Semua"}</span>
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
                      </p>
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
                    <form onSubmit={(e) => handleAddQuestion(e, exam.id)} className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                      <h4 className="font-semibold text-slate-800 mb-4 text-sm">Tambah Soal Baru</h4>
                      <div className="space-y-4">
                        <div>
                           <label className="text-xs font-medium text-slate-600 block mb-1">Pertanyaan</label>
                           <Input value={qText} onChange={(e) => setQText(e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="text-xs font-medium text-slate-600 block mb-1">Opsi A</label>
                             <Input value={optA} onChange={(e) => setOptA(e.target.value)} required />
                           </div>
                           <div>
                             <label className="text-xs font-medium text-slate-600 block mb-1">Opsi B</label>
                             <Input value={optB} onChange={(e) => setOptB(e.target.value)} required />
                           </div>
                           <div>
                             <label className="text-xs font-medium text-slate-600 block mb-1">Opsi C</label>
                             <Input value={optC} onChange={(e) => setOptC(e.target.value)} required />
                           </div>
                           <div>
                             <label className="text-xs font-medium text-slate-600 block mb-1">Opsi D</label>
                             <Input value={optD} onChange={(e) => setOptD(e.target.value)} required />
                           </div>
                        </div>
                        <div>
                           <label className="text-xs font-medium text-slate-600 block mb-1">Kunci Jawaban</label>
                           <select 
                             className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-white"
                             value={correctOpt}
                             onChange={(e) => setCorrectOpt(e.target.value)}
                           >
                             <option value="A">A</option>
                             <option value="B">B</option>
                             <option value="C">C</option>
                             <option value="D">D</option>
                           </select>
                        </div>
                        <div className="flex justify-end">
                          <Button type="submit" disabled={loading} className="w-full md:w-auto shadow-sm">Simpan Soal</Button>
                        </div>
                      </div>
                    </form>

                    <div className="space-y-3 mt-8">
                      {exam.questions && exam.questions.length > 0 ? (
                        exam.questions.map((q, idx) => (
                          <div key={q.id} className="p-5 border border-slate-200/80 rounded-xl flex flex-col md:flex-row justify-between items-start gap-4 bg-white hover:border-blue-200 transition-colors">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900 mb-3"><span className="text-slate-500 font-bold mr-1">{idx + 1}.</span> {q.text}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
                                <p className={q.correctOption === "A" ? "text-green-700 font-bold bg-green-50 px-2 py-1 rounded" : "px-2 py-1"}>A. {q.optionA}</p>
                                <p className={q.correctOption === "B" ? "text-green-700 font-bold bg-green-50 px-2 py-1 rounded" : "px-2 py-1"}>B. {q.optionB}</p>
                                <p className={q.correctOption === "C" ? "text-green-700 font-bold bg-green-50 px-2 py-1 rounded" : "px-2 py-1"}>C. {q.optionC}</p>
                                <p className={q.correctOption === "D" ? "text-green-700 font-bold bg-green-50 px-2 py-1 rounded" : "px-2 py-1"}>D. {q.optionD}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors self-end md:self-start shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-slate-500 py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada soal untuk ujian ini.</p>
                      )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-4 tracking-tight">Daftar Nilai Siswa</h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-200/60 shadow-sm">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/60">
                            <tr>
                              <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Siswa</th>
                              <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Kelas</th>
                              <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Nilai</th>
                              <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {exam.results && exam.results.map((res) => (
                              <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-5 font-semibold text-slate-900">{res.student.username}</td>
                                <td className="py-3 px-5 text-slate-600">{res.student.className || "-"}</td>
                                <td className="py-3 px-5 font-bold text-slate-900 text-base">{res.score}</td>
                                <td className="py-3 px-5">
                                  {res.isCheated ? (
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-semibold">Terindikasi Curang</span>
                                  ) : (
                                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded font-semibold">Valid</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {(!exam.results || exam.results.length === 0) && (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-slate-500">Belum ada siswa yang mengerjakan ujian ini.</td>
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
          {exams.length === 0 && (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              <p className="text-slate-500 text-sm">Belum ada sesi ujian yang dibuat.</p>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
