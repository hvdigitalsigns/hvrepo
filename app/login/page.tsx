"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/admin`,
      },
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center px-4 [font-family:var(--font-inter),system-ui,sans-serif]">
      <div className="w-full max-w-md rounded-[28px] border border-[#ebe8e2] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="font-[family-name:var(--font-playfair),Georgia,serif] text-2xl font-semibold text-[#C5A059] text-center mb-2">
          MONARCH OS
        </h1>
        <p className="text-center text-sm text-[#666] mb-6">Sign in to open Control Center</p>
        {sent ? (
          <p className="text-center text-[#333]">Check your email for the magic link, then return to /admin.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#ded8cd] bg-[#faf9f7] px-4 py-3 text-sm outline-none focus:border-[#C5A059]"
            />
            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#C5A059] py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
