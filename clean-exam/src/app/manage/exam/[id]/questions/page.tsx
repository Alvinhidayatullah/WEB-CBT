"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getExams, createQuestion, deleteQuestion } from "@/actions/dashboardActions";
import { use } from "react";

export default function ManageQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const examId = resolvedParams.id;
  
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [qType, setQType] = useState("MULTIPLE_CHOICE");
  const [qText, setQText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOpt, setCorrectOpt] = useState("A");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchExam(examId);
  }, [examId]);

  const fetchExam = async (id: string) => {
    setLoading(true);
    const exams = await getExams();
    const found = exams.find((e: any) => e.id === id);
    if (found) setExam(found);
    setLoading(false);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText) {
      alert("Pertanyaan harus diisi!");
      return;
    }
    if (qType === "MULTIPLE_CHOICE" && (!optA || !optB || !optC || !optD || !correctOpt)) {
      alert("Semua kolom opsi Pilihan Ganda harus diisi!");
      return;
    }
    setIsSubmitting(true);
    const res = await createQuestion({
      examId,
      type: qType,
      text: qText,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      correctOption: correctOpt
    });
    if (res.success) {
      setQText(""); setOptA(""); setOptB(""); setOptC(""); setOptD(""); setCorrectOpt("A");
      await fetchExam(examId);
    } else {
      alert(res.error || "Gagal menambah soal");
    }
    setIsSubmitting(false);
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!window.confirm("Hapus soal ini?")) return;
    setIsSubmitting(true);
    const res = await deleteQuestion(qId);
    if (res.success) {
      await fetchExam(examId);
    } else {
      alert(res.error || "Gagal menghapus soal");
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Ujian Tidak Ditemukan</h2>
          <Button onClick={() => router.back()}>Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="secondary" onClick={() => router.back()} className="px-3 py-2 rounded-xl">
            <ArrowLeft className="w-5 h-5 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kelola Soal</h1>
            <p className="text-slate-500 text-sm">{exam.examType} - {exam.subject}</p>
          </div>
        </header>

        <form onSubmit={handleAddQuestion} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-600" /> Tambah Soal Baru
          </h2>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Tipe Soal</label>
              <select className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white" value={qType} onChange={(e) => setQType(e.target.value)}>
                <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                <option value="ESSAY">Esai / Uraian</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Pertanyaan</label>
              <Input value={qText} onChange={(e) => setQText(e.target.value)} required placeholder="Ketik pertanyaan di sini..." />
            </div>
            
            {qType === "MULTIPLE_CHOICE" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Opsi A</label><Input value={optA} onChange={(e) => setOptA(e.target.value)} required /></div>
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Opsi B</label><Input value={optB} onChange={(e) => setOptB(e.target.value)} required /></div>
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Opsi C</label><Input value={optC} onChange={(e) => setOptC(e.target.value)} required /></div>
                  <div><label className="text-sm font-medium text-slate-700 block mb-1">Opsi D</label><Input value={optD} onChange={(e) => setOptD(e.target.value)} required /></div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">Kunci Jawaban</label>
                  <select className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white" value={correctOpt} onChange={(e) => setCorrectOpt(e.target.value)}>
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} variant="primary" className="shadow-md shadow-blue-600/20 px-8">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Soal"}
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 text-lg mt-8">Daftar Soal ({exam.questions?.length || 0})</h3>
          {exam.questions && exam.questions.length > 0 ? (
            exam.questions.map((q: any, idx: number) => (
              <div key={q.id} className="p-6 border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between items-start gap-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 mb-4 text-lg leading-relaxed">
                    <span className="text-blue-600 font-bold mr-2">{idx + 1}.</span> 
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold mr-2">{q.type === "ESSAY" ? "ESAI" : "PG"}</span>
                    {q.text}
                  </p>
                  
                  {q.type !== "ESSAY" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-600">
                      <p className={q.correctOption === "A" ? "text-green-700 font-bold bg-green-50 px-3 py-2 rounded-lg border border-green-100" : "px-3 py-2"}>A. {q.optionA}</p>
                      <p className={q.correctOption === "B" ? "text-green-700 font-bold bg-green-50 px-3 py-2 rounded-lg border border-green-100" : "px-3 py-2"}>B. {q.optionB}</p>
                      <p className={q.correctOption === "C" ? "text-green-700 font-bold bg-green-50 px-3 py-2 rounded-lg border border-green-100" : "px-3 py-2"}>C. {q.optionC}</p>
                      <p className={q.correctOption === "D" ? "text-green-700 font-bold bg-green-50 px-3 py-2 rounded-lg border border-green-100" : "px-3 py-2"}>D. {q.optionD}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => handleDeleteQuestion(q.id)} disabled={isSubmitting} className="text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-colors border border-transparent hover:border-red-100 self-end md:self-start shrink-0">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500 font-medium">Belum ada soal untuk ujian ini.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
