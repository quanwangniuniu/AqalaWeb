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
import UserMenu from "@/components/UserMenu";

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
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <header className="mb-8 md:mb-10">
          {/* Top Row: Title and User Menu */}
          <div className="flex items-start justify-between gap-4 mb-4 md:mb-6">
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Aqala
              </h1>
              <p className="text-gray-500 text-sm">
                Real-time Quranic transcription & translation
              </p>
            </div>
            <div className="flex-shrink-0">
              <UserMenu />
            </div>
          </div>

          {/* Bottom Row: Room Controls */}
          {currentRoom && (
            <div className="flex items-center gap-3 pt-4 md:pt-5 border-t border-white/5">
              <RoomManager />
            </div>
          )}
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
