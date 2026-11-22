import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.trim() === 'admin' && password === 'admin13') {
      sessionStorage.setItem('tiyara_admin_auth', 'true');
      onSuccess();
      return;
    }

    setError('Username atau password salah!');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-[#2A0912] via-[#4A1220] to-[#6B1D2F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="bg-[#4A1220] px-6 py-6 text-center border-b border-[#D4AF37]/25 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#6B1D2F] border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Login Admin EDA
          </h1>
          <p className="text-xs text-[#F9E4E8]/80">
            Masuk untuk mengakses analitik penyewaan, katalog kebaya, dan verifikasi pesanan Tiyara Attire.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="admin-username"
              className="block text-xs font-semibold text-[#6B1D2F]"
            >
              Username
            </label>
            <div className="relative">
              <User
                className="w-4 h-4 text-[#6B1D2F]/55 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan username admin"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] placeholder:text-[#2A0912]/40 focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-[#6B1D2F]"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-[#6B1D2F]/55 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan password"
                className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] placeholder:text-[#2A0912]/40 focus:outline-none focus:border-[#6B1D2F]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                }
                className="w-10 h-10 flex items-center justify-center text-[#6B1D2F]/70 hover:text-[#6B1D2F] absolute right-1 top-1/2 -translate-y-1/2 rounded-lg"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 text-center"
            >
              {error}
            </div>
          )}

          <div className="pt-1 space-y-2.5">
            <button
              type="submit"
              className="w-full h-12 rounded-xl bg-[#D4AF37] text-[#2A0912] font-bold text-sm hover:bg-[#C39E2B] transition-colors shadow-xs"
            >
              Masuk ke Dashboard Admin
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full h-10 rounded-xl border border-[#6B1D2F]/15 text-[#6B1D2F] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#F9E4E8]/50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Kembali ke Mode Customer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
