"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2, Save, Upload, Download, Edit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Image as ImageIcon, X } from "lucide-react";
import { getExams, createQuestion, deleteQuestion, updateQuestion, bulkCreateQuestions } from "@/actions/dashboardActions";
import * as XLSX from "xlsx";
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
  const [essayReference, setEssayReference] = useState("");
  const [weightA, setWeightA] = useState(100);
  const [weightB, setWeightB] = useState(0);
  const [weightC, setWeightC] = useState(0);
  const [weightD, setWeightD] = useState(0);
  const [qImageUrl, setQImageUrl] = useState("");
  const [optAImg, setOptAImg] = useState("");
  const [optBImg, setOptBImg] = useState("");
  const [optCImg, setOptCImg] = useState("");
  const [optDImg, setOptDImg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExam(examId);
  }, [examId]);

  const fetchExam = async (id: string) => {
    const exams = await getExams();
    const found = exams.find((e: any) => e.id === id);
    if (found) setExam(found);
    setLoading(false);
  };

  const compressImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, setter);
  };


  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText) {
      alert("Pertanyaan harus diisi!");
      return;
    }
    if (qType === "MULTIPLE_CHOICE" && (!optA || !optB || !optC || !optD)) {
      alert("Semua kolom opsi Pilihan Ganda harus diisi!");
      return;
    }
    setIsSubmitting(true);
    
    let res;
    if (editingId) {
      res = await updateQuestion(editingId, {
        type: qType,
        text: qText,
        imageUrl: qImageUrl || null,
        optionA: optA,
        optionAImg: optAImg || null,
        optionB: optB,
        optionBImg: optBImg || null,
        optionC: optC,
        optionCImg: optCImg || null,
        optionD: optD,
        optionDImg: optDImg || null,
        weightA: weightA,
        weightB: weightB,
        weightC: weightC,
        weightD: weightD,
        essayReference: qType === "ESSAY" ? essayReference : null
      });
    } else {
      res = await createQuestion({
        examId,
        type: qType,
        text: qText,
        imageUrl: qImageUrl || null,
        optionA: optA,
        optionAImg: optAImg || null,
        optionB: optB,
        optionBImg: optBImg || null,
        optionC: optC,
        optionCImg: optCImg || null,
        optionD: optD,
        optionDImg: optDImg || null,
        weightA: weightA,
        weightB: weightB,
        weightC: weightC,
        weightD: weightD,
        essayReference: qType === "ESSAY" ? essayReference : null
      });
    }

    if (res.success) {
      setQText(""); setOptA(""); setOptB(""); setOptC(""); setOptD(""); setEssayReference("");
      setQImageUrl(""); setOptAImg(""); setOptBImg(""); setOptCImg(""); setOptDImg("");
      setWeightA(100); setWeightB(0); setWeightC(0); setWeightD(0);
      setEditingId(null);
      await fetchExam(examId);
    } else {
      alert(res.error || "Gagal menyimpan soal");
    }
    setIsSubmitting(false);
  };

  const handleEditClick = (q: any) => {
    setEditingId(q.id);
    setQType(q.type || "MULTIPLE_CHOICE");
    setQText(q.text);
    setOptA(q.optionA || "");
    setOptB(q.optionB || "");
    setOptC(q.optionC || "");
    setOptD(q.optionD || "");
    setQImageUrl(q.imageUrl || "");
    setOptAImg(q.optionAImg || "");
    setOptBImg(q.optionBImg || "");
    setOptCImg(q.optionCImg || "");
    setOptDImg(q.optionDImg || "");
    setWeightA(q.weightA || 0);
    setWeightB(q.weightB || 0);
    setWeightC(q.weightC || 0);
    setWeightD(q.weightD || 0);
    setEssayReference(q.essayReference || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const formattedQuestions = data.map((row: any) => ({
          type: (row["Tipe Soal"]?.toString().toUpperCase() === "ESAI" || row["Tipe Soal"]?.toString().toUpperCase() === "ESSAY") ? "ESSAY" : "MULTIPLE_CHOICE",
          text: row["Pertanyaan"]?.toString() || "",
          imageUrl: row["Gambar Soal (URL)"]?.toString() || null,
          optionA: row["Opsi A"]?.toString() || "",
          optionAImg: row["Gambar Opsi A (URL)"]?.toString() || null,
          optionB: row["Opsi B"]?.toString() || "",
          optionBImg: row["Gambar Opsi B (URL)"]?.toString() || null,
          optionC: row["Opsi C"]?.toString() || "",
          optionCImg: row["Gambar Opsi C (URL)"]?.toString() || null,
          optionD: row["Opsi D"]?.toString() || "",
          optionDImg: row["Gambar Opsi D (URL)"]?.toString() || null,
          weightA: parseInt(row["Bobot A"]) || 0,
          weightB: parseInt(row["Bobot B"]) || 0,
          weightC: parseInt(row["Bobot C"]) || 0,
          weightD: parseInt(row["Bobot D"]) || 0,
          essayReference: row["Kunci Referensi Esai"]?.toString() || "",
        })).filter(q => q.text !== "");

        if (formattedQuestions.length === 0) {
          alert("Format file tidak valid atau data kosong.");
          return;
        }

        setIsSubmitting(true);
        const res = await bulkCreateQuestions(examId, formattedQuestions);
        if (res.success) {
          alert(`Berhasil mengimpor ${res.count} soal!`);
          await fetchExam(examId);
        } else {
          alert(res.error || "Gagal mengimpor soal");
        }
      } catch (err) {
        alert("Gagal membaca file Excel. Pastikan format sudah benar.");
      } finally {
        setIsSubmitting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Tipe Soal": "PG", "Pertanyaan": "Siapa penemu lampu bohlam?", "Gambar Soal (URL)": "", "Opsi A": "Thomas Edison", "Gambar Opsi A (URL)": "", "Opsi B": "Albert Einstein", "Gambar Opsi B (URL)": "", "Opsi C": "Isaac Newton", "Gambar Opsi C (URL)": "", "Opsi D": "Nikola Tesla", "Gambar Opsi D (URL)": "", "Bobot A": 100, "Bobot B": 0, "Bobot C": 0, "Bobot D": 0, "Kunci Referensi Esai": "" },
      { "Tipe Soal": "ESAI", "Pertanyaan": "Jelaskan proses terjadinya fotosintesis!", "Gambar Soal (URL)": "", "Opsi A": "", "Gambar Opsi A (URL)": "", "Opsi B": "", "Gambar Opsi B (URL)": "", "Opsi C": "", "Gambar Opsi C (URL)": "", "Opsi D": "", "Gambar Opsi D (URL)": "", "Bobot A": 100, "Bobot B": 0, "Bobot C": 0, "Bobot D": 0, "Kunci Referensi Esai": "Tumbuhan menggunakan sinar matahari, air, dan karbon dioksida untuk menghasilkan oksigen dan energi." }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
    XLSX.writeFile(wb, "Template_Soal_SecureCBT.xlsx");
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
          <Button onClick={() => router.push("/")}>Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="secondary" onClick={() => router.push("/")} className="px-3 py-2 rounded-xl">
            <ArrowLeft className="w-5 h-5 mr-1" /> Kembali
          </Button>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Kelola Soal</h1>
              <p className="text-slate-500 text-sm">{exam.examType} - {exam.subject}</p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
              <Button variant="secondary" onClick={handleDownloadTemplate} disabled={isSubmitting} className="shadow-sm bg-white">
                <Download className="w-4 h-4 mr-2" /> Template
              </Button>
              <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting} className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
                <Upload className="w-4 h-4 mr-2" /> Import Excel
              </Button>
            </div>
          </div>
        </header>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 shadow-sm">
          <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-1">
            ⚠️ Informasi Penting
          </h3>
          <p className="text-amber-700 text-sm leading-relaxed">
            Bobot nilai untuk soal <strong>Pilihan Ganda (PG)</strong> akan dikalkulasi secara pasti sesuai angka. Untuk soal <strong>Esai</strong>, jawaban murid akan <strong>diperiksa otomatis oleh AI Gemini</strong>. AI akan menilai kedekatan jawaban murid dengan <strong>Kunci Referensi Esai</strong> yang Anda buat, dan memberikan skor (0-100) serta alasannya. Anda tetap bisa mengubah (override) nilai akhir esai jika dirasa kurang pas.
          </p>
        </div>

        <form onSubmit={handleAddQuestion} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Save className="w-5 h-5 text-blue-600" /> {editingId ? "Edit Soal" : "Tambah Soal Baru"}
            </h2>
            {editingId && (
              <Button variant="secondary" type="button" className="px-3 py-1.5 text-sm" onClick={() => {
                setEditingId(null); setQText(""); setOptA(""); setOptB(""); setOptC(""); setOptD(""); setEssayReference("");
                setWeightA(100); setWeightB(0); setWeightC(0); setWeightD(0);
              }}>Batal Edit</Button>
            )}
          </div>
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
              <div className="flex flex-col gap-2">
                <Input value={qText} onChange={(e) => setQText(e.target.value)} required placeholder="Ketik pertanyaan di sini..." />
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 border border-slate-300 transition-colors">
                    <ImageIcon className="w-4 h-4" /> {qImageUrl ? "Ganti Gambar Soal" : "Tambah Gambar Soal"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setQImageUrl)} />
                  </label>
                  {qImageUrl && (
                    <div className="relative group">
                      <img src={qImageUrl} alt="Preview Soal" className="h-10 w-auto rounded border border-slate-300 object-cover" />
                      <button type="button" onClick={() => setQImageUrl("")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {qType === "MULTIPLE_CHOICE" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Opsi A</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input value={optA} onChange={(e) => setOptA(e.target.value)} required={!optAImg} placeholder="Teks opsi A" />
                        <Input type="number" min="0" max="100" value={weightA} onChange={(e) => setWeightA(parseInt(e.target.value)||0)} required className="w-24 text-center font-bold" placeholder="100" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-slate-600 hover:text-blue-600 text-xs flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          <ImageIcon className="w-3 h-3" /> {optAImg ? "Ganti Gambar" : "Gambar Opsi A"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setOptAImg)} />
                        </label>
                        {optAImg && (
                          <div className="relative group">
                            <img src={optAImg} alt="Preview A" className="h-8 w-auto rounded border border-slate-300 object-cover" />
                            <button type="button" onClick={() => setOptAImg("")} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-2 h-2"/></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Opsi B</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input value={optB} onChange={(e) => setOptB(e.target.value)} required={!optBImg} placeholder="Teks opsi B" />
                        <Input type="number" min="0" max="100" value={weightB} onChange={(e) => setWeightB(parseInt(e.target.value)||0)} required className="w-24 text-center font-bold" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-slate-600 hover:text-blue-600 text-xs flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          <ImageIcon className="w-3 h-3" /> {optBImg ? "Ganti Gambar" : "Gambar Opsi B"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setOptBImg)} />
                        </label>
                        {optBImg && (
                          <div className="relative group">
                            <img src={optBImg} alt="Preview B" className="h-8 w-auto rounded border border-slate-300 object-cover" />
                            <button type="button" onClick={() => setOptBImg("")} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-2 h-2"/></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Opsi C</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input value={optC} onChange={(e) => setOptC(e.target.value)} required={!optCImg} placeholder="Teks opsi C" />
                        <Input type="number" min="0" max="100" value={weightC} onChange={(e) => setWeightC(parseInt(e.target.value)||0)} required className="w-24 text-center font-bold" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-slate-600 hover:text-blue-600 text-xs flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          <ImageIcon className="w-3 h-3" /> {optCImg ? "Ganti Gambar" : "Gambar Opsi C"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setOptCImg)} />
                        </label>
                        {optCImg && (
                          <div className="relative group">
                            <img src={optCImg} alt="Preview C" className="h-8 w-auto rounded border border-slate-300 object-cover" />
                            <button type="button" onClick={() => setOptCImg("")} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-2 h-2"/></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">Opsi D</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input value={optD} onChange={(e) => setOptD(e.target.value)} required={!optDImg} placeholder="Teks opsi D" />
                        <Input type="number" min="0" max="100" value={weightD} onChange={(e) => setWeightD(parseInt(e.target.value)||0)} required className="w-24 text-center font-bold" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-slate-600 hover:text-blue-600 text-xs flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          <ImageIcon className="w-3 h-3" /> {optDImg ? "Ganti Gambar" : "Gambar Opsi D"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setOptDImg)} />
                        </label>
                        {optDImg && (
                          <div className="relative group">
                            <img src={optDImg} alt="Preview D" className="h-8 w-auto rounded border border-slate-300 object-cover" />
                            <button type="button" onClick={() => setOptDImg("")} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="w-2 h-2"/></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {qType === "ESSAY" && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Kunci Referensi Esai (Rubrik Penilaian AI)</label>
                <textarea
                  value={essayReference}
                  onChange={(e) => setEssayReference(e.target.value)}
                  required
                  placeholder="Contoh: Jawaban harus menyebutkan proses fotosintesis mengubah air dan karbon dioksida menjadi glukosa dan oksigen dengan bantuan cahaya matahari."
                  className="w-full min-h-[100px] px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Kunci ini akan digunakan oleh **AI Gemini** untuk mencocokkan jawaban siswa. Semakin detail, semakin presisi AI menilainya.
                </p>
                
                <div className="mt-4">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Bobot Maksimal Esai (Maks: 100)</label>
                  <Input type="number" min="0" max="100" value={weightA} onChange={(e) => setWeightA(parseInt(e.target.value)||0)} required className="w-24 text-center font-bold" />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} variant="primary" className="shadow-md shadow-blue-600/20 px-8">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Perbarui Soal" : "Simpan Soal")}
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
                  {q.imageUrl && (
                    <div className="mb-4">
                      <img src={q.imageUrl} alt={`Soal ${idx + 1}`} className="max-h-64 rounded-lg border border-slate-200 shadow-sm object-contain" />
                    </div>
                  )}
                  
                  {q.type !== "ESSAY" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-600">
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="flex justify-between"><span>A. {q.optionA}</span> <span className="font-bold text-blue-600">Bobot: {q.weightA}%</span></div>
                        {q.optionAImg && <img src={q.optionAImg} alt="Opsi A" className="max-h-32 rounded border border-slate-200 object-contain" />}
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="flex justify-between"><span>B. {q.optionB}</span> <span className="font-bold text-blue-600">Bobot: {q.weightB}%</span></div>
                        {q.optionBImg && <img src={q.optionBImg} alt="Opsi B" className="max-h-32 rounded border border-slate-200 object-contain" />}
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="flex justify-between"><span>C. {q.optionC}</span> <span className="font-bold text-blue-600">Bobot: {q.weightC}%</span></div>
                        {q.optionCImg && <img src={q.optionCImg} alt="Opsi C" className="max-h-32 rounded border border-slate-200 object-contain" />}
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="flex justify-between"><span>D. {q.optionD}</span> <span className="font-bold text-blue-600">Bobot: {q.weightD}%</span></div>
                        {q.optionDImg && <img src={q.optionDImg} alt="Opsi D" className="max-h-32 rounded border border-slate-200 object-contain" />}
                      </div>
                    </div>
                  )}
                  {q.type === "ESSAY" && q.essayReference && (
                     <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                        <p className="font-bold text-slate-700 mb-1">Kunci Referensi (AI Rubric):</p>
                        <p className="text-slate-600">{q.essayReference}</p>
                     </div>
                  )}
                </div>
                <div className="flex gap-2 self-end md:self-start shrink-0">
                  <button onClick={() => handleEditClick(q)} disabled={isSubmitting} className="text-blue-600 hover:bg-blue-50 p-2.5 rounded-xl transition-colors border border-transparent hover:border-blue-100">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDeleteQuestion(q.id)} disabled={isSubmitting} className="text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-colors border border-transparent hover:border-red-100">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
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
