"use client";

import { useState } from "react";
import { useRoom } from "@/contexts/RoomContext";
import { useAuth } from "@/contexts/AuthContext";
import { Room } from "@/lib/roomService";

export default function RoomSelector() {
  const { rooms, loading, joinRoom, createRoom } = useRoom();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createRoom(roomName.trim());
      setRoomName("");
      setShowCreateModal(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create room"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = (room: Room) => {
    joinRoom(room);
  };

  if (!user) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Prayer Rooms
          </h2>
          <p className="text-gray-400 text-sm">
            Join an existing room or create a new one to start sharing
            translations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
        >
          Create Room
        </button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d1f] border border-white/10 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              Create New Room
            </h3>
            <form onSubmit={handleCreateRoom}>
              <div className="mb-4">
                <label
                  htmlFor="roomName"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Room Name
                </label>
                <input
                  id="roomName"
                  type="text"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g., Friday Prayer, Evening Session"
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  maxLength={100}
                  autoFocus
                />
                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setRoomName("");
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading rooms...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 border border-white/10 rounded-lg bg-black/20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <p className="text-gray-400 mb-2">No rooms yet</p>
          <p className="text-gray-500 text-sm mb-4">
            Create your first prayer room to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            Create Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="border border-white/10 rounded-lg p-4 bg-black/20 hover:bg-black/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">
                  {room.name}
                </h3>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Created by{" "}
                  {room.createdBy === user.uid ? "you" : "another user"}
                </p>
                <button
                  onClick={() => handleJoinRoom(room)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-md transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

