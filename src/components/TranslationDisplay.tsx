import React, { useEffect, useRef } from "react";
import { TranslationRecord } from "@/lib/translationHistory";

interface TranslationDisplayProps {
  translations: TranslationRecord[];
}

export default function TranslationDisplay({
  translations,
}: TranslationDisplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Translations are already sorted by RoomContext
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [translations]);

  return (
    <div className="w-full space-y-8 min-h-[400px] max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
      {translations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-center">
            Press record to start transcribing
          </p>
        </div>
      ) : (
        translations.map((translation, index) => (
          <div
            key={translation.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Arabic Text with Verse Number */}
            <div className="flex items-start gap-6 mb-6">
              <div className="flex-1 text-right">
                <p
                  className="text-3xl md:text-4xl font-arabic leading-loose text-gray-100"
                  dir="rtl"
                >
                  {translation.sourceText}
                </p>
              </div>

              {/* Verse Number Circle */}
              <div className="flex-shrink-0 mt-2">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  {/* Decorative circle */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 48 48"
                  >
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-gray-700"
                    />
                    {/* Decorative points */}
                    <circle
                      cx="24"
                      cy="2"
                      r="1.5"
                      fill="currentColor"
                      className="text-gray-700"
                    />
                    <circle
                      cx="24"
                      cy="46"
                      r="1.5"
                      fill="currentColor"
                      className="text-gray-700"
                    />
                    <circle
                      cx="2"
                      cy="24"
                      r="1.5"
                      fill="currentColor"
                      className="text-gray-700"
                    />
                    <circle
                      cx="46"
                      cy="24"
                      r="1.5"
                      fill="currentColor"
                      className="text-gray-700"
                    />
                  </svg>
                  <span className="relative text-sm font-arabic text-gray-400">
                    {index + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* English Translation */}
            <div className="text-left pl-2">
              <p className="text-lg text-gray-400 leading-relaxed">
                {translation.targetText}
              </p>
            </div>

            {/* Divider between verses */}
            {index < translations.length - 1 && (
              <div className="mt-8 border-t border-gray-800/50"></div>
            )}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
