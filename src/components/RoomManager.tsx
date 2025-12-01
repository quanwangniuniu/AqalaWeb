"use client";

import { useState } from "react";
import { useRoom } from "@/contexts/RoomContext";
import { useAuth } from "@/contexts/AuthContext";

export default function RoomManager() {
  const { currentRoom, deleteRoom, leaveRoom, isRoomCreator, activeUsers } = useRoom();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false);

  if (!currentRoom || !user) return null;

  const userCount = activeUsers.length;
  const otherUsers = activeUsers.filter((u) => u.userId !== user.uid);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRoom(currentRoom.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete room:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete room. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 rounded-lg">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium text-emerald-300">
          {currentRoom.name}
        </span>
        {isRoomCreator && (
          <span className="text-xs text-emerald-400/70 px-1.5 py-0.5 bg-emerald-600/30 rounded">
            Creator
          </span>
        )}
      </div>

      {/* Active Users Indicator */}
      <div className="relative">
        <button
          onClick={() => setShowUsersList(!showUsersList)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-600/30 rounded-lg hover:bg-blue-600/30 transition-colors"
        >
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-blue-300">
            {userCount} {userCount === 1 ? "user" : "users"} live
          </span>
        </button>

        {/* Users List Dropdown */}
        {showUsersList && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUsersList(false)}
            ></div>
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1d1f] border border-white/10 rounded-lg shadow-lg z-50 p-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Active Users
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeUsers.map((activeUser) => (
                  <div
                    key={activeUser.userId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/20"
                  >
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm text-gray-200 flex-1">
                      {activeUser.displayName || activeUser.userName}
                      {activeUser.userId === user.uid && (
                        <span className="text-xs text-gray-500 ml-1">(You)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {isRoomCreator && (
        <>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            disabled={deleting}
          >
            Delete Room
          </button>
        </>
      )}

      <button
        onClick={leaveRoom}
        className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
      >
        Leave
      </button>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d1f] border border-white/10 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-2">
              Delete Room?
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              This will permanently delete the room and all its translation
              history. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

