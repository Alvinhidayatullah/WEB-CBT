"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2, UserPlus, Download, ChevronDown, ChevronUp, RefreshCw, Upload, FileSpreadsheet } from "lucide-react";
import { createUser, deleteUser, bulkDeleteUsers, getUsers, bulkCreateUsers } from "@/actions/userActions";
import * as XLSX from "xlsx";

export interface UIUser {
  id: string;
  username: string;
  name?: string | null;
  role: string;
  token?: string | null;
  className?: string | null;
  teacherSubject?: string | null;
  createdAt: string | Date;
}

export function UserManagement({ initialUsers = [], allowedRoles = ["MURID", "GURU", "SUPER_ADMIN"] }: { initialUsers: UIUser[], allowedRoles?: string[] }) {
  const sortUsers = (userList: UIUser[]) => {
    if (!Array.isArray(userList)) return [];
    const roleOrder: Record<string, number> = { SUPER_ADMIN: 1, GURU: 2, MURID: 3 };
    return [...userList].filter(Boolean).sort((a, b) => {
      if (!a || !b) return 0;
      const roleA = a.role || "";
      const roleB = b.role || "";
      if (roleOrder[roleA] !== roleOrder[roleB]) {
        return (roleOrder[roleA] || 99) - (roleOrder[roleB] || 99);
      }
      
      // 2. Jika murid, urutkan berdasarkan Kelas
      if (roleA === "MURID") {
        const classA = a.className || "";
        const classB = b.className || "";
        const classCompare = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
        if (classCompare !== 0) {
          return classCompare;
        }
      }
      
      // 3. Terakhir, urutkan berdasarkan Username
      const userA = a.username || "";
      const userB = b.username || "";
      return userA.localeCompare(userB, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const [users, setUsers] = useState(() => sortUsers(initialUsers));
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isListOpen, setIsListOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setUsers(sortUsers(initialUsers));
    setSelectedUsers(new Set());
  }, [initialUsers]);

  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getUsers();
        if (res.users) {
          // Filter dynamically based on allowedRoles just like the server page does, 
          // or assume getUsers already filters based on session role.
          const filtered = res.users.filter((u: any) => allowedRoles.includes(u.role));
          // Update local users safely (optimistic updates take precedence if they just clicked, but for a 15s poll this is usually fine)
          setUsers(sortUsers(filtered));
        }
      } catch {
        // ignore errors on polling
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [allowedRoles]);
  
  // Form State
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("MURID");
  const [className, setClassName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  
  const generateRandomToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  const [token, setToken] = useState("");
  React.useEffect(() => {
    setToken(generateRandomToken());
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (role === "MURID" && !className) {
      setError("Kelas wajib diisi untuk murid.");
      setLoading(false);
      return;
    }

    if (role === "GURU") {
      if (!className) {
        setError("Kelas yang Diampu wajib diisi untuk guru.");
        setLoading(false);
        return;
      }
      if (!teacherSubject) {
        setError("Mata Pelajaran wajib diisi untuk guru.");
        setLoading(false);
        return;
      }
    }

    const payload = {
      username,
      name,
      role,
      token: role === "SUPER_ADMIN" ? undefined : token,
      password: role === "SUPER_ADMIN" ? customPassword : "",
      className: role === "SUPER_ADMIN" ? undefined : className,
      teacherSubject: role === "GURU" ? teacherSubject : undefined
    };

    const res = await createUser(payload);
    if (res.success && res.user) {
      setUsers(prev => sortUsers([{
        id: res.user!.id,
        username: res.user!.username,
        name: res.user!.name || name || null,
        role: res.user!.role,
        token: res.user!.token,
        className: res.user!.className,
        teacherSubject: res.user!.teacherSubject,
        createdAt: res.user!.createdAt
      }, ...prev]));
      setUsername("");
      setName("");
      setClassName("");
      setTeacherSubject("");
      setCustomPassword("");
      setToken(generateRandomToken()); // refresh token untuk form berikutnya
    } else if (res.success) {
      // Fallback if user wasn't returned for some reason
      setUsername("");
      setName("");
      setClassName("");
      setTeacherSubject("");
      setCustomPassword("");
      setToken(generateRandomToken());
    } else {
      alert(res.error || "Gagal menambahkan user");
      setError(res.error || "Gagal menambahkan user");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus pengguna ini?")) return;
    const prevUsers = users;
    // OPTIMISTIC UPDATE: Langsung hilangkan user dari UI
    setUsers(prev => prev.filter((u) => u.id !== id));
    setSelectedUsers(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    const res = await deleteUser(id);
    if (!res.success) {
      setUsers(prevUsers);
      alert(res.error || "Gagal menghapus user");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedUsers.size} pengguna terpilih?`)) return;
    
    const ids = Array.from(selectedUsers);
    const prevUsers = users;
    // OPTIMISTIC UPDATE: Langsung hilangkan user terpilih dari UI
    setUsers(prev => prev.filter((u) => !selectedUsers.has(u.id)));
    setSelectedUsers(new Set());

    const res = await bulkDeleteUsers(ids);
    if (!res.success) {
      setUsers(prevUsers);
      alert(res.error || "Gagal menghapus beberapa user");
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleExportExcel = () => {
    const dataToExport = users.map(user => ({
      "Nama Lengkap": user.name || "-",
      "Username": user.username,
      "Password": user.token || (user.role === "SUPER_ADMIN" ? "(Password disembunyikan)" : "-"),
      "Kelas": user.className || "-",
      "Role": user.role
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pengguna");
    XLSX.writeFile(wb, "Data_Pengguna_Kartu_Ujian.xlsx");
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Nama Lengkap": "Ahmad Pratama",
        "Username": "ahmad_pratama",
        "Password": "", // Kosongkan jika ingin token otomatis 5 digit acak
        "Kelas": "MIPA 1",
        "Role": "MURID"
      },
      {
        "Nama Lengkap": "Siti Nurhaliza",
        "Username": "siti_nurhaliza",
        "Password": "SITI1", // Atau masukkan token/password custom
        "Kelas": "MIPA 1",
        "Role": "MURID"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Pengguna");
    XLSX.writeFile(wb, "Template_Import_Pengguna.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setImporting(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

        if (rawData.length === 0) {
          alert("File Excel kosong atau tidak memiliki data baris.");
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const parsedUsers = rawData.map((row: any) => {
          const getVal = (keys: string[]) => {
            for (const k of Object.keys(row)) {
              const cleanKey = k.trim().toLowerCase();
              if (keys.some(expected => cleanKey === expected.toLowerCase())) {
                return String(row[k]).trim();
              }
            }
            return "";
          };

          const username = getVal(["Username", "User", "NIS", "NISN"]);
          const name = getVal(["Nama Lengkap", "Nama", "Name", "Full Name"]);
          const password = getVal(["Password", "Pass", "Token", "Pass/Token"]);
          const className = getVal(["Kelas", "Class", "Rombel"]);
          const role = getVal(["Role", "Peran"]) || "MURID";

          return { username, name, password, className, role };
        }).filter(u => u.username && u.username !== "-");

        if (parsedUsers.length === 0) {
          alert("Tidak ditemukan data dengan kolom 'Username' yang valid.");
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const res = await bulkCreateUsers(parsedUsers);
        if (res.success && res.users) {
          setUsers(prev => sortUsers([...res.users, ...prev]));
          let msg = `Berhasil mengimpor ${res.count} pengguna!`;
          if (res.skipped && res.skipped.length > 0) {
            msg += `\n\nCatatan: ${res.skipped.length} pengguna dilewati (karena username sudah terdaftar atau tidak valid).`;
          }
          alert(msg);
        } else {
          alert(res.error || "Gagal mengimpor pengguna dari file Excel.");
        }
      } catch (err: any) {
        console.error(err);
        alert("Gagal membaca file Excel. Pastikan format file sesuai.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Card className="mt-8 shadow-sm border-slate-200/60 rounded-2xl">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Pengguna</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".xlsx, .xls, .csv" 
            onChange={handleImportExcel} 
            className="hidden" 
          />
          <Button 
            type="button"
            variant="secondary" 
            onClick={handleDownloadTemplate}
            className="text-slate-700 hover:bg-slate-100 border-slate-200 text-xs sm:text-sm"
            title="Unduh format template kosong Excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-blue-600" /> Template
          </Button>
          <Button 
            type="button"
            variant="secondary" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importing}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 text-xs sm:text-sm"
            title="Import data pengguna dari file Excel"
          >
            <Upload className="w-4 h-4 mr-1.5" /> {importing ? "Mengimpor..." : "Import Excel"}
          </Button>
          <Button 
            type="button"
            variant="secondary" 
            onClick={handleExportExcel} 
            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-xs sm:text-sm"
            title="Export semua data pengguna ke file Excel"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* FORM TAMBAH PENGGUNA */}
        <div className="bg-slate-50 p-5 md:p-6 rounded-xl border border-slate-200/60 mb-8">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" /> Tambah Pengguna Baru
          </h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
               <label className="text-sm font-medium text-slate-700 block mb-1">Username</label>
               <Input 
                 placeholder="username_baru" 
                 value={username} 
                 onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                 required
               />
            </div>
            <div>
               <label className="text-sm font-medium text-slate-700 block mb-1">Nama Lengkap</label>
               <Input 
                 placeholder="Nama lengkap siswa/guru" 
                 value={name} 
                 onChange={(e) => setName(e.target.value.toUpperCase())}
               />
            </div>
            <div>
               <label className="text-sm font-medium text-slate-700 block mb-1">Role</label>
               <select 
                 className="w-full h-11 px-4 border border-slate-300 rounded-lg text-sm bg-white"
                 value={role}
                 onChange={(e) => setRole(e.target.value)}
               >
                 {allowedRoles.includes("MURID") && <option value="MURID">Murid</option>}
                 {allowedRoles.includes("GURU") && <option value="GURU">Guru</option>}
                 {allowedRoles.includes("SUPER_ADMIN") && <option value="SUPER_ADMIN">Super Admin</option>}
               </select>
            </div>
            {role === "SUPER_ADMIN" ? (
              <div>
                 <label className="text-sm font-medium text-slate-700 block mb-1">Password Bebas</label>
                 <Input 
                   type="password"
                   placeholder="Masukkan kata sandi..."
                   value={customPassword} 
                   onChange={(e) => setCustomPassword(e.target.value)}
                   required
                 />
              </div>
            ) : (
              <div>
                 <label className="text-sm font-medium text-slate-700 block mb-1">Pass/Token</label>
                 <div className="flex gap-2">
                   <Input 
                     value={token} 
                     onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                     maxLength={5}
                     required
                     className="uppercase font-mono"
                   />
                   <Button 
                     type="button" 
                     variant="secondary" 
                     onClick={() => setToken(Math.random().toString(36).substring(2, 7).toUpperCase())}
                     className="px-3 border-slate-300 text-slate-600 hover:bg-slate-100"
                     title="Generate Token Acak"
                   >
                     <RefreshCw className="w-4 h-4" />
                   </Button>
                 </div>
              </div>
            )}
            
            {(role === "MURID" || role === "GURU") && (
              <div>
                 <label className="text-sm font-medium text-slate-700 block mb-1">
                   {role === "GURU" ? "Kelas yang Diampu" : "Kelas"}
                 </label>
                 <Input 
                   placeholder={role === "GURU" ? "Contoh: 10" : "MIPA 1"} 
                   value={className} 
                   onChange={(e) => setClassName(e.target.value)}
                   required
                 />
              </div>
            )}
            {role === "GURU" && (
              <div>
                 <label className="text-sm font-medium text-slate-700 block mb-1">Mata Pelajaran</label>
                 <Input 
                   placeholder="Contoh: Matematika, Fisika" 
                   value={teacherSubject} 
                   onChange={(e) => setTeacherSubject(e.target.value)}
                   required
                 />
              </div>
            )}
            <div className={role !== "SUPER_ADMIN" ? "md:col-span-3" : "md:col-span-2"}>
               <Button type="submit" className="w-full h-11 shadow-sm font-medium" disabled={loading}>
                 {loading ? "Menyimpan..." : "Simpan Pengguna"}
               </Button>
            </div>
          </form>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <p className="text-xs text-slate-500 mt-3">* Password/Token untuk Murid/Guru otomatis dibuat 5 digit acak. Untuk Super Admin, Anda bebas membuat password sendiri tanpa token.</p>
        </div>

        <div className="flex flex-col gap-4 mb-4 md:flex-row justify-between items-center bg-slate-50/50 p-2 rounded-lg">
          <button 
            type="button"
            onClick={() => setIsListOpen(!isListOpen)}
            className="flex items-center gap-2 text-sm text-slate-700 font-bold hover:text-blue-600 transition-colors py-2 px-3 hover:bg-slate-100 rounded-md"
          >
            {isListOpen ? <ChevronUp className="w-5 h-5 text-blue-500" /> : <ChevronDown className="w-5 h-5 text-blue-500" />}
            Total {users.length} pengguna
          </button>
          
          {selectedUsers.size > 0 && isListOpen && (
            <Button 
              variant="danger" 
              onClick={handleBulkDelete}
              className="bg-red-500 hover:bg-red-600 shadow-sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus {selectedUsers.size} Terpilih
            </Button>
          )}
        </div>
        
        {isListOpen && (
          <div className="overflow-x-auto rounded-xl border border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/60">
              <tr>
                <th className="py-4 px-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={users.length > 0 && selectedUsers.size === users.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Username</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Nama Lengkap</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Role</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Pass/Token</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Kelas</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Mapel</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Tgl Dibuat</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <input 
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                    />
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{user.username}</td>
                  <td className="py-3 px-4 text-slate-700">{user.name || "-"}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-700' :
                      user.role === 'GURU' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{user.token || "-"}</td>
                  <td className="py-3 px-4 text-slate-600">{user.className || "-"}</td>
                  <td className="py-3 px-4 text-slate-600">{user.role === "GURU" ? (user.teacherSubject || "-") : "-"}</td>
                  <td className="py-3 px-4 text-slate-500" suppressHydrationWarning>{new Date(user.createdAt).toLocaleDateString("id-ID")}</td>
                  <td className="py-3 px-5 text-right">
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition-colors disabled:opacity-50"
                      disabled={user.username === "vinz_admin"}
                      title="Hapus Pengguna"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Belum ada data pengguna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
