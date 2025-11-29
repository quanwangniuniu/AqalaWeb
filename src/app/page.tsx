"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import TranslationDisplay from "@/components/TranslationDisplay";
import { useAuth } from "@/contexts/AuthContext";
import TranslationHistory from "@/components/TranslationHistory";

interface TranslationSegment {
  id: string;
  arabic: string;
  english: string;
}

export default function Home() {
  const [segments, setSegments] = useState<TranslationSegment[]>([]);
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleAudioReady = useCallback(
    async (audioBlob: Blob) => {
    const tempId = Date.now().toString();

    try {
      // 1. Transcribe
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!transcribeRes.ok) throw new Error("Transcription failed");

      const { text: arabicText } = await transcribeRes.json();

      console.log("Transcription received:", arabicText);

      if (!arabicText || arabicText.trim() === "") return;

      // Add new segment with Arabic
      setSegments((prev) => [
        ...prev,
        {
          id: tempId,
          arabic: arabicText,
          english: "...",
        },
      ]);

      // 2. Translate
      (async () => {
        try {
          if (!user) {
            console.error("No user authenticated, cannot translate");
            throw new Error("User not authenticated");
          }

          const idToken = await user.getIdToken();

          const translateRes = await fetch("/api/translate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ text: arabicText }),
          });

          if (!translateRes.ok) throw new Error("Translation failed");

          const { text: englishText } = await translateRes.json();

          // Update segment with English
          setSegments((prev) =>
            prev.map((seg) =>
              seg.id === tempId ? { ...seg, english: englishText } : seg
            )
          );
        } catch (translateError) {
          console.error("Translation error:", translateError);
        }
      })();
    } catch (error) {
      console.error("Processing error:", error);
    }
    },
    [user]
  );

  return (
    <main className="min-h-screen bg-[#1a1d1f]">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Aqala
            </h1>
            <p className="text-gray-500 text-sm">
              Real-time Quranic transcription & translation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-sm text-white font-medium">
                  {user.displayName || user.email}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => signOut().then(() => router.push("/login"))}
              className="text-xs md:text-sm px-3 py-1.5 rounded-md border border-white/10 text-gray-200 hover:bg-white/5 transition-colors"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="space-y-8">
          <AudioRecorder onAudioReady={handleAudioReady} />

          <div className="pt-8">
            <TranslationDisplay segments={segments} />
          </div>

          <TranslationHistory />
        </div>
      </div>
    </main>
  );
}
