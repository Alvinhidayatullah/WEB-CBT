"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { loginUser } from "@/actions/authActions";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const u = username.trim();
    const p = password.trim();
    
    const res = await loginUser(u, p);

    if (res.success) {
      if (res.role === "SUPER_ADMIN") router.push("/admin/dashboard");
      else if (res.role === "GURU") router.push("/teacher/dashboard");
      else if (res.role === "MURID") router.push("/student/dashboard");
    } else {
      setError(res.error || "Username atau Password tidak valid.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 p-4">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/30 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-violet-600/20 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>
      
      <Card className="relative z-10 w-full max-w-md shadow-2xl border-white/10 bg-white/5 backdrop-blur-2xl rounded-3xl overflow-hidden ring-1 ring-white/20">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        <CardHeader className="text-center py-10 pb-6 relative z-10">
          <div className="mx-auto bg-gradient-to-tr from-blue-500 to-indigo-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(59,130,246,0.5)]">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">SecureCBT</h1>
          <p className="text-slate-300 mt-2 text-sm font-medium tracking-wide">Sistem CBT Modern & Aman</p>
        </CardHeader>
        <CardContent className="px-8 pb-10 relative z-10">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 block">Username</label>
              <Input
                type="text"
                placeholder="Masukkan username Anda"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white/10 border-white/10 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                required
              />
            </div>
            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 block">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/10 border-white/10 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="p-4 bg-red-500/10 backdrop-blur-sm text-red-200 text-sm rounded-xl border border-red-500/20 font-medium">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-8 h-12 text-base font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 transition-all hover:scale-[1.02] active:scale-[0.98]">
              {loading ? "Memeriksa..." : "Masuk ke Sistem"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
