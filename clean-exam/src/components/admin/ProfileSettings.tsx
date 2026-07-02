"use client";

import React, { useState } from "react";
import { UserCircle, Key, Loader2, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateProfile } from "@/actions/userActions";

export function ProfileSettings({ currentUsername }: { currentUsername: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState(currentUsername);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    const res = await updateProfile({
      username,
      oldPassword: oldPassword || undefined,
      newPassword: newPassword || undefined
    });

    setLoading(false);
    if (res.success) {
      setMessage({ type: "success", text: "Profil berhasil diperbarui!" });
      setOldPassword("");
      setNewPassword("");
      setTimeout(() => setIsOpen(false), 2000);
    } else {
      setMessage({ type: "error", text: res.error || "Gagal memperbarui profil." });
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
          {username.substring(0, 2).toUpperCase()}
        </div>
        <span className="font-medium text-slate-700">{username}</span>
        <Settings className="w-4 h-4 text-slate-400 ml-2" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UserCircle className="w-6 h-6 text-blue-600" /> Pengaturan Profil
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:bg-slate-200 hover:text-slate-600 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {message.text && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {message.text}
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Username Baru</label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-500 mb-4 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Ubah Password (Opsional)
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Password Lama</label>
                    <Input type="password" placeholder="Wajib diisi jika ingin ubah password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Password Baru</label>
                    <Input type="password" placeholder="Minimal 6 karakter" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Profil"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
