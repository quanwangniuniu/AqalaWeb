"use client";

import { useState, useRef, useEffect } from "react";
import { useRoom } from "@/contexts/RoomContext";
import { useAuth } from "@/contexts/AuthContext";

export default function RoomManager() {
  const { currentRoom, deleteRoom, leaveRoom, isRoomCreator, activeUsers } = useRoom();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUsersList, setShowUsersList] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  if (!currentRoom || !user) return null;

  const userCount = activeUsers.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showActionsMenu]);

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
    <div className="flex items-center gap-3 flex-wrap">
      {/* Consolidated Room Badge with User Count */}
      <div className="relative">
        <button
          onClick={() => setShowUsersList(!showUsersList)}
          className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 bg-emerald-600/20 border border-emerald-600/30 rounded-lg hover:bg-emerald-600/30 transition-colors flex-wrap"
        >
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></div>
          <span className="text-sm font-medium text-emerald-300">
            {currentRoom.name}
          </span>
          {isRoomCreator && (
            <span className="text-xs text-emerald-400/70 px-1.5 py-0.5 bg-emerald-600/30 rounded flex-shrink-0">
              Creator
            </span>
          )}
          <div className="h-4 w-px bg-emerald-600/40 hidden sm:block"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-blue-300">
              {userCount} {userCount === 1 ? "user" : "users"}
            </span>
          </div>
        </button>

        {/* Users List Dropdown */}
        {showUsersList && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUsersList(false)}
            ></div>
            <div className="absolute left-0 top-full mt-2 w-64 bg-[#1a1d1f] border border-white/10 rounded-lg shadow-lg z-50 p-3">
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

      {/* Actions Menu */}
      <div className="relative" ref={actionsMenuRef}>
        <button
          onClick={() => setShowActionsMenu(!showActionsMenu)}
          className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>

        {showActionsMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowActionsMenu(false)}
            ></div>
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1d1f] border border-white/10 rounded-lg shadow-lg z-50 overflow-hidden">
              <button
                onClick={leaveRoom}
                className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Leave Room
              </button>
              {isRoomCreator && (
                <button
                  onClick={() => {
                    setShowActionsMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-t border-white/10"
                  disabled={deleting}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Room
                </button>
              )}
            </div>
          </>
        )}
      </div>

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

