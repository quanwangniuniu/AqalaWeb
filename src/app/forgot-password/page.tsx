"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1a1d1f] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111315] rounded-xl p-8 shadow-lg border border-white/5">
        <h1 className="text-2xl font-semibold text-white mb-6 text-center">
          Reset your password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md bg-[#050608] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 rounded px-2 py-1">
              {error}
            </p>
          )}
          {sent && !error && (
            <p className="text-sm text-teal-300 bg-teal-950/40 rounded px-2 py-1">
              If an account exists for this email, a reset link has been sent.
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-teal-500 hover:bg-teal-400 disabled:opacity-60 disabled:hover:bg-teal-500 transition-colors text-sm font-medium text-black py-2"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          Remembered your password?{" "}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-teal-400 hover:underline"
          >
            Back to login
          </button>
        </p>
      </div>
    </main>
  );
}


