"use client";

import { useRoom } from "@/contexts/RoomContext";
import { TranslationRecord } from "@/lib/translationHistory";

export default function TranslationHistory() {
  const { currentRoom, translations } = useRoom();

  // When in a room, show room translations. Otherwise, show nothing (or could show user history)
  const items = currentRoom ? translations : [];
  const loading = false;

  if (!currentRoom) return null;

  return (
    <section className="mt-10 border-t border-white/10 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
          Recent translations
        </h2>
        <span className="text-xs text-gray-500">
          Showing last {items.length} items
        </span>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400">Loading history...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-500">
          No translations yet. Your history will appear here.
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2"
            >
              <p className="text-xs font-medium text-teal-300">
                Arabic source
              </p>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">
                {item.sourceText}
              </p>
              <p className="text-xs font-medium text-amber-200 pt-1">
                English translation
              </p>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">
                {item.targetText}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


