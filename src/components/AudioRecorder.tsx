"use client";

import { useState, useRef, useEffect } from "react";

interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob) => void;
  isSomeoneElseRecording?: boolean;
  recordingUserName?: string;
  updateRecordingState?: (isRecording: boolean) => Promise<void>;
}

const CHUNK_DURATION = 5000;
const RECORDING_HEARTBEAT_INTERVAL = 10000; // Update every 10 seconds
const SILENCE_THRESHOLD = 10; // Volume level below which we consider it silence
const SILENCE_TIMEOUT = 30000; // 30 seconds in milliseconds

export default function AudioRecorder({ 
  onAudioReady, 
  isSomeoneElseRecording = false,
  recordingUserName,
  updateRecordingState,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);

  const startRecording = async () => {
    if (isSomeoneElseRecording) {
      return; // Don't start if someone else is recording
    }

    try {
      // Update recording state
      if (updateRecordingState) {
        await updateRecordingState(true);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      // Ensure all tracks are enabled
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log("[AudioRecorder] Track:", track.kind, "enabled:", track.enabled, "readyState:", track.readyState);
      });
      
      streamRef.current = stream;
      setIsRecording(true);
      isRecordingRef.current = true;
      silenceStartTimeRef.current = null; // Reset silence timer when starting recording

      // Set up heartbeat to keep recording state alive
      if (updateRecordingState) {
        heartbeatIntervalRef.current = setInterval(async () => {
          if (isRecordingRef.current) {
            await updateRecordingState(true);
          }
        }, RECORDING_HEARTBEAT_INTERVAL);
      }

      // Clean up any existing AudioContext before creating a new one
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          await audioContextRef.current.close();
        } catch (error) {
          console.error("Error closing existing AudioContext:", error);
        }
      }
      
      // Create new AudioContext
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Resume AudioContext if suspended (required by browsers)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);
      
      console.log("[AudioRecorder] AudioContext state:", audioContext.state);
      console.log("[AudioRecorder] Stream active:", stream.active);
      console.log("[AudioRecorder] Stream tracks:", stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext("2d");
        if (canvasCtx) {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const draw = () => {
            if (!isRecordingRef.current || !analyserRef.current || !canvasCtx) {
              // Stop the animation loop if recording stopped
              return;
            }
            
            // Continue the animation loop
            requestAnimationFrame(draw);
            
            // Use the ref to ensure we're using the current analyser
            const currentAnalyser = analyserRef.current;
            
            // Get frequency data for visualization
            currentAnalyser.getByteFrequencyData(dataArray);
            
            // Also get time domain data for better volume detection
            const timeDataArray = new Uint8Array(bufferLength);
            currentAnalyser.getByteTimeDomainData(timeDataArray);
            
            // Calculate volume from frequency data
            const frequencyAverage = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            // Calculate volume from time domain data (more accurate for overall volume)
            let sum = 0;
            for (let i = 0; i < timeDataArray.length; i++) {
              const normalized = (timeDataArray[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / timeDataArray.length);
            const timeDomainVolume = Math.round(rms * 255);
            
            // Use the higher of the two for better responsiveness
            const volume = Math.max(Math.round(frequencyAverage), timeDomainVolume);
            setVolumeLevel(volume);

            // Silence detection for auto-stop
            const now = Date.now();
            if (volume < SILENCE_THRESHOLD) {
              // Volume is below threshold - track silence
              if (silenceStartTimeRef.current === null) {
                // Start tracking silence
                silenceStartTimeRef.current = now;
                console.log(`[AudioRecorder] Silence detected, starting timer`);
              } else {
                // Check if silence has exceeded timeout
                const silenceDuration = now - silenceStartTimeRef.current;
                if (silenceDuration >= SILENCE_TIMEOUT) {
                  console.log(`[AudioRecorder] Silence exceeded ${SILENCE_TIMEOUT}ms, auto-stopping recording`);
                  // Auto-stop recording (fire and forget - stopRecording handles cleanup)
                  stopRecording().catch((error) => {
                    console.error("[AudioRecorder] Error during auto-stop:", error);
                  });
                  return; // Exit draw loop
                }
              }
            } else {
              // Volume is above threshold - reset silence timer
              if (silenceStartTimeRef.current !== null) {
                console.log(`[AudioRecorder] Sound detected, resetting silence timer`);
                silenceStartTimeRef.current = null;
              }
            }

            // Clear with gradient background
            const gradient = canvasCtx.createLinearGradient(
              0,
              0,
              0,
              canvas.height
            );
            gradient.addColorStop(0, "rgba(16, 185, 129, 0.1)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0.1)");
            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

              // Create gradient for bars
              const barGradient = canvasCtx.createLinearGradient(
                0,
                canvas.height - barHeight,
                0,
                canvas.height
              );
              barGradient.addColorStop(0, "#10b981");
              barGradient.addColorStop(1, "#3b82f6");
              canvasCtx.fillStyle = barGradient;

              canvasCtx.fillRect(
                x,
                canvas.height - barHeight,
                barWidth - 1,
                barHeight
              );

              x += barWidth;
            }
          };
          // Start the animation loop
          draw();
        }
      }

      const startSegment = () => {
        if (!isRecordingRef.current || !streamRef.current) return;

        const options = { mimeType: "audio/webm;codecs=opus" };
        const mediaRecorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, {
              type: "audio/webm;codecs=opus",
            });

            console.log(`[AudioRecorder] Chunk created: ${blob.size} bytes`);
            onAudioReady(blob);
            chunksRef.current = [];
          }

          if (isRecordingRef.current) {
            startSegment();
          }
        };

        mediaRecorder.start();

        setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        }, CHUNK_DURATION);
      };

      startSegment();
      
      // Verify AudioContext is running after a short delay
      setTimeout(() => {
        if (audioContextRef.current && isRecordingRef.current) {
          console.log("[AudioRecorder] AudioContext state after setup:", audioContextRef.current.state);
          if (audioContextRef.current.state === "suspended") {
            console.warn("[AudioRecorder] AudioContext is suspended, attempting to resume...");
            audioContextRef.current.resume().then(() => {
              console.log("[AudioRecorder] AudioContext resumed successfully");
            }).catch((error) => {
              console.error("[AudioRecorder] Failed to resume AudioContext:", error);
            });
          } else if (audioContextRef.current.state === "closed") {
            console.error("[AudioRecorder] ERROR: AudioContext was closed prematurely!");
            // Don't try to recreate here - let the user restart recording
          }
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      
      // Clean up on error
      isRecordingRef.current = false;
      setIsRecording(false);
      
      // Clear recording state
      if (updateRecordingState) {
        updateRecordingState(false).catch(console.error);
      }
      
      // Clean up resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      
      alert("Error accessing microphone. Please check permissions.");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setVolumeLevel(0);
    silenceStartTimeRef.current = null; // Clear silence timer when stopping

    // Clear heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Update recording state
    if (updateRecordingState) {
      await updateRecordingState(false);
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close AudioContext only if it's not already closed
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        await audioContextRef.current.close();
      } catch (error) {
        console.error("Error closing AudioContext:", error);
      }
    }

    mediaRecorderRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
  };

  // Cleanup on unmount only - don't run on every state change
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      
      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Clear recording state on unmount
      if (updateRecordingState) {
        updateRecordingState(false).catch(console.error);
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Close AudioContext only if it exists and is not already closed
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch((error) => {
          console.error("Error closing AudioContext in cleanup:", error);
        });
      }
    };
  }, []); // Empty dependency array - only run on unmount

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Visualizer */}
      <div className="w-full max-w-2xl">
        <canvas
          ref={canvasRef}
          width={600}
          height={120}
          className="w-full rounded-2xl border border-gray-800 shadow-lg"
        />
      </div>

      {/* Recording status message */}
      {isSomeoneElseRecording && !isRecording && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 px-4 py-2 rounded-lg border border-amber-400/20">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
          <span>
            {recordingUserName || "Someone"} is recording...
          </span>
        </div>
      )}

      {/* Volume indicator */}
      {isRecording && (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-glow"></div>
            <span className="text-gray-400">Live</span>
          </div>
          <div className="h-4 w-px bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Volume:</span>
            <span className="font-mono font-bold text-emerald-400">
              {volumeLevel}
            </span>
            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-100"
                style={{ width: `${(volumeLevel / 255) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Record button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isSomeoneElseRecording && !isRecording}
        className={`group relative px-8 py-4 rounded-full font-semibold text-white transition-all duration-300 transform ${
          isSomeoneElseRecording && !isRecording
            ? "bg-gray-600 cursor-not-allowed opacity-50"
            : isRecording
            ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-500/50 hover:scale-105"
            : "bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 shadow-lg shadow-emerald-500/50 hover:scale-105"
        }`}
      >
        <span className="relative z-10 flex items-center gap-2">
          {isSomeoneElseRecording && !isRecording ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Recording in progress...
            </>
          ) : isRecording ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <rect x="6" y="6" width="8" height="8" rx="1" />
              </svg>
              Stop Recording
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="6" />
              </svg>
              Start Recording
            </>
          )}
        </span>
      </button>
    </div>
  );
}
