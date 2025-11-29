"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { ensureUserProfile } from "@/lib/userProfile";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await ensureUserProfile(cred.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message ?? "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1a1d1f] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111315] rounded-xl p-8 shadow-lg border border-white/5">
        <h1 className="text-2xl font-semibold text-white mb-6 text-center">
          Create your Aqala account
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md bg-[#050608] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            />
          </div>
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
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md bg-[#050608] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 rounded px-2 py-1">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-teal-500 hover:bg-teal-400 disabled:opacity-60 disabled:hover:bg-teal-500 transition-colors text-sm font-medium text-black py-2"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-teal-400 hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </main>
  );
}


