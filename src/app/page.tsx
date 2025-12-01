"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import AudioRecorder from "@/components/AudioRecorder";
import TranslationDisplay from "@/components/TranslationDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { useRoom } from "@/contexts/RoomContext";
import TranslationHistory from "@/components/TranslationHistory";
import RoomSelector from "@/components/RoomSelector";
import RoomManager from "@/components/RoomManager";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const { currentRoom, translations, addLocalTranslation, recordingState, updateRecordingState } = useRoom();
  const router = useRouter();

  // Check if someone else is recording
  const isSomeoneElseRecording = recordingState !== null && user ? recordingState.userId !== user.uid : false;
  const recordingUserName = recordingState?.userName;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleAudioReady = useCallback(
    async (audioBlob: Blob) => {
      if (!currentRoom) {
        console.error("No room selected, cannot save translation");
        return;
      }

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

        // 2. Translate
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
          body: JSON.stringify({
            text: arabicText,
            roomId: currentRoom.id,
          }),
        });

        if (!translateRes.ok) throw new Error("Translation failed");

        const { text: englishText } = await translateRes.json();

        // Add translation to local state immediately (will show on screen right away)
        // RoomContext will attempt to save to Firestore using client SDK
        addLocalTranslation({
          sourceText: arabicText,
          sourceLang: "ar",
          targetText: englishText,
          targetLang: "en",
          metadata: {},
        });

        console.log("[Client] Translation added to room:", currentRoom.id);
      } catch (error) {
        console.error("Processing error:", error);
      }
    },
    [user, currentRoom]
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
            {currentRoom && <RoomManager />}
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
        {!currentRoom ? (
          <RoomSelector />
        ) : (
          <div className="space-y-8">
            <AudioRecorder 
              onAudioReady={handleAudioReady}
              isSomeoneElseRecording={isSomeoneElseRecording}
              recordingUserName={recordingUserName}
              updateRecordingState={updateRecordingState}
            />

            <div className="pt-8">
              <TranslationDisplay translations={translations} />
            </div>

            <TranslationHistory />
          </div>
        )}
      </div>
    </main>
  );
}
