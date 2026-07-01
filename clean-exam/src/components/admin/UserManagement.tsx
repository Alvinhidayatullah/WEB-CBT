"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2, UserPlus } from "lucide-react";
import { createUser, deleteUser } from "@/actions/userActions";

export interface UIUser {
  id: string;
  username: string;
  role: string;
  token?: string | null;
  className?: string | null;
  createdAt: string | Date;
}

export function UserManagement({ initialUsers = [], allowedRoles = ["MURID", "GURU", "SUPER_ADMIN"] }: { initialUsers: UIUser[], allowedRoles?: string[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);
  
  // Form State
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("MURID");
  const [className, setClassName] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  
  const generateRandomToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  const [token, setToken] = useState(generateRandomToken());

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      username,
      role,
      className,
      token: role === "SUPER_ADMIN" ? undefined : token,
      password: role === "SUPER_ADMIN" ? customPassword : undefined
    };

    const res = await createUser(payload);
    if (res.success) {
      setUsername("");
      setClassName("");
      setCustomPassword("");
      setToken(generateRandomToken()); // refresh token untuk form berikutnya
    } else {
      setError(res.error || "Gagal menambahkan user");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus pengguna ini?")) return;
    const res = await deleteUser(id);
    if (res.success) {
      setUsers(users.filter((u) => u.id !== id));
    } else {
      alert(res.error || "Gagal menghapus user");
    }
  };

  return (
    <Card className="mt-8 shadow-sm border-slate-200/60 rounded-2xl">
      <CardHeader className="flex flex-row justify-between items-center border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Pengguna</h2>
      </CardHeader>
      <CardContent className="pt-6">
        {/* FORM TAMBAH PENGGUNA */}
        <div className="bg-slate-50 p-5 md:p-6 rounded-xl border border-slate-200/60 mb-8">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" /> Tambah Pengguna Baru
          </h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                 <Input 
                   value={token} 
                   onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                   maxLength={5}
                   required
                 />
              </div>
            )}
            
            {role === "MURID" && (
              <div>
                 <label className="text-sm font-medium text-slate-700 block mb-1">Kelas</label>
                 <Input 
                   placeholder="MIPA 1" 
                   value={className} 
                   onChange={(e) => setClassName(e.target.value)}
                 />
              </div>
            )}
            <div className={role !== "MURID" ? "md:col-span-2" : ""}>
               <Button type="submit" className="w-full h-11 shadow-sm font-medium" disabled={loading}>
                 {loading ? "Menyimpan..." : "Simpan Pengguna"}
               </Button>
            </div>
          </form>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <p className="text-xs text-slate-500 mt-3">* Password/Token untuk Murid/Guru otomatis dibuat 5 digit acak. Untuk Super Admin, Anda bebas membuat password sendiri tanpa token.</p>
        </div>

        {/* TABEL DAFTAR PENGGUNA */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 shadow-sm">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/60">
              <tr>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Username</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Role</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Pass/Token</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Kelas</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider">Tgl Dibuat</th>
                <th className="py-4 px-5 font-semibold text-xs uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{user.username}</td>
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
                  <td className="py-3 px-4 text-slate-500">{new Date(user.createdAt).toLocaleDateString("id-ID")}</td>
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
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Belum ada data pengguna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
