"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebaseClient";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    (async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.displayName && !displayName) {
          setDisplayName(data.displayName);
        }
      }
    })();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(user, { displayName });
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          displayName,
        },
        { merge: true }
      );
      setSaved(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#1a1d1f] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111315] rounded-xl p-8 shadow-lg border border-white/5">
        <h1 className="text-2xl font-semibold text-white mb-6 text-center">
          Profile
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md bg-[#050608] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              Email: <span className="text-gray-200">{user.email}</span>
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 rounded px-2 py-1">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-sm text-teal-300 bg-teal-950/40 rounded px-2 py-1">
              Profile updated.
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-teal-500 hover:bg-teal-400 disabled:opacity-60 disabled:hover:bg-teal-500 transition-colors text-sm font-medium text-black py-2"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}


