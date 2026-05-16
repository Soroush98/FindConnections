"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      const slug = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      const res = await fetch(`/api/${slug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push(`/${slug}-upload`);
        return;
      }

      setMessage("Invalid email or password");
    } catch {
      setMessage("Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Console</h1>
            <p className="text-sm text-white/60 mt-1">Sign in to manage connections</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-white/80 mb-1.5">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-white/80 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-12 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-white/60 hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition shadow-lg flex items-center justify-center gap-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {submitting ? "Signing in…" : "Sign in"}
              </button>

              {message && (
                <div className="rounded-lg bg-red-500/15 border border-red-400/30 text-red-100 text-sm px-3 py-2 text-center">
                  {message}
                </div>
              )}
            </form>
          </div>

          <p className="text-center text-xs text-white/40 mt-6">Authorized personnel only</p>
        </div>
      </div>
    </>
  );
}
