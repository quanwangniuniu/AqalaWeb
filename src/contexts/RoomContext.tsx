"use client";

import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import {
  Room,
  createRoom,
  deleteRoom,
  subscribeToRooms,
  subscribeToRoomTranslations,
  addTranslationToRoom,
  setRecordingState,
  subscribeToRecordingState,
  RecordingState,
  setUserPresence,
  removeUserPresence,
  subscribeToActiveUsers,
  ActiveUser,
} from "@/lib/roomService";
import { TranslationRecord } from "@/lib/translationHistory";

interface LocalTranslation extends TranslationRecord {
  localId: string;
  saved: boolean;
  saving: boolean;
}

interface RoomContextValue {
  currentRoom: Room | null;
  rooms: Room[];
  translations: TranslationRecord[];
  loading: boolean;
  recordingState: RecordingState | null;
  activeUsers: ActiveUser[];
  setCurrentRoom: (room: Room | null) => void;
  createRoom: (name: string) => Promise<string>;
  deleteRoom: (roomId: string) => Promise<void>;
  joinRoom: (room: Room) => void;
  leaveRoom: () => void;
  isRoomCreator: boolean;
  addLocalTranslation: (translation: Omit<TranslationRecord, "id" | "createdAt">) => void;
  updateRecordingState: (isRecording: boolean) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoomState] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [firestoreTranslations, setFirestoreTranslations] = useState<TranslationRecord[]>([]);
  const [localTranslations, setLocalTranslations] = useState<LocalTranslation[]>([]);
  const [recordingState, setRecordingStateState] = useState<RecordingState | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const presenceCleanupRef = React.useRef<(() => void) | null>(null);

  // Subscribe to rooms list
  useEffect(() => {
    if (!user) {
      setRooms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToRooms((roomsList) => {
      setRooms(roomsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Clear local translations when leaving room
  useEffect(() => {
    if (!currentRoom) {
      setLocalTranslations([]);
      setRecordingStateState(null);
      setActiveUsers([]);
    }
  }, [currentRoom]);

  // Subscribe to recording state when in a room
  useEffect(() => {
    if (!currentRoom || !user) {
      setRecordingStateState(null);
      return;
    }

    const unsubscribe = subscribeToRecordingState(currentRoom.id, (state) => {
      setRecordingStateState(state);
    });

    return () => unsubscribe();
  }, [currentRoom, user]);

  // Subscribe to active users when in a room
  useEffect(() => {
    if (!currentRoom || !user) {
      setActiveUsers([]);
      return;
    }

    const unsubscribe = subscribeToActiveUsers(currentRoom.id, (users) => {
      setActiveUsers(users);
    });

    return () => unsubscribe();
  }, [currentRoom, user]);

  // Set user presence when joining a room
  useEffect(() => {
    if (!currentRoom || !user) {
      // Clean up presence when leaving
      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }
      return;
    }

    // Set presence
    const userName = user.email || user.uid;
    const displayName = user.displayName || user.email || "Anonymous";
    
    setUserPresence(currentRoom.id, user.uid, userName, displayName)
      .then((cleanup) => {
        presenceCleanupRef.current = cleanup;
      })
      .catch((error) => {
        console.error("Failed to set user presence:", error);
      });

    // Cleanup on unmount or room change
    return () => {
      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }
      // Also remove from Firestore directly
      removeUserPresence(currentRoom.id, user.uid).catch((error) => {
        console.error("Failed to remove user presence:", error);
      });
    };
  }, [currentRoom, user]);

  // Subscribe to room translations when in a room
  useEffect(() => {
    if (!currentRoom || !user) {
      setFirestoreTranslations([]);
      return;
    }

    const unsubscribe = subscribeToRoomTranslations(
      currentRoom.id,
      (roomTranslations) => {
        setFirestoreTranslations(roomTranslations);
        // Remove local translations that have been saved to Firestore
        setLocalTranslations((prev) => {
          return prev.filter((local) => {
            // Check if this local translation has been saved (matched by content and timestamp)
            const saved = roomTranslations.some(
              (firestore) =>
                firestore.sourceText === local.sourceText &&
                firestore.targetText === local.targetText
            );
            return !saved;
          });
        });
      }
    );

    return () => unsubscribe();
  }, [currentRoom, user]);

  // Merge Firestore and local translations
  const translations = React.useMemo(() => {
    const allTranslations: TranslationRecord[] = [
      ...firestoreTranslations,
      ...localTranslations.map(({ localId, saved, saving, ...rest }) => rest),
    ];

    // Sort by createdAt (oldest first)
    return allTranslations.sort((a, b) => {
      const getTime = (createdAt: any): number => {
        if (!createdAt) return 0;
        // Firestore Timestamp
        if (createdAt.toMillis) return createdAt.toMillis();
        // Firestore Timestamp (legacy format)
        if (createdAt._seconds) return createdAt._seconds * 1000 + (createdAt._nanoseconds || 0) / 1000000;
        // Date object
        if (createdAt instanceof Date) return createdAt.getTime();
        // Number (timestamp)
        if (typeof createdAt === 'number') return createdAt;
        return 0;
      };

      return getTime(a.createdAt) - getTime(b.createdAt);
    });
  }, [firestoreTranslations, localTranslations]);

  // Load current room from localStorage on mount
  useEffect(() => {
    if (!user) {
      setCurrentRoomState(null);
      return;
    }

    const savedRoomId = localStorage.getItem("currentRoomId");
    if (savedRoomId) {
      // Find the room in the rooms list
      const foundRoom = rooms.find((r) => r.id === savedRoomId);
      if (foundRoom) {
        setCurrentRoomState(foundRoom);
      } else {
        // Room might not be loaded yet, wait a bit
        const timer = setTimeout(() => {
          const foundRoom = rooms.find((r) => r.id === savedRoomId);
          if (foundRoom) {
            setCurrentRoomState(foundRoom);
          } else {
            localStorage.removeItem("currentRoomId");
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, rooms]);

  const handleCreateRoom = useCallback(
    async (name: string): Promise<string> => {
      if (!user) {
        throw new Error("User must be authenticated to create a room");
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create room");
        }

        const data = await response.json();
        // Room will be added to rooms list via subscription
        return data.id;
      } catch (error) {
        // Fallback to client SDK if API fails
        console.warn("API room creation failed, falling back to client SDK:", error);
        const roomId = await createRoom(name, user.uid);
        return roomId;
      }
    },
    [user]
  );

  const handleDeleteRoom = useCallback(
    async (roomId: string): Promise<void> => {
      if (!user) {
        throw new Error("User must be authenticated to delete a room");
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/rooms/${roomId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete room");
        }

        // If we're in the deleted room, leave it
        if (currentRoom?.id === roomId) {
          setCurrentRoomState(null);
          localStorage.removeItem("currentRoomId");
        }
      } catch (error) {
        // Fallback to client SDK if API fails
        console.warn("API room deletion failed, falling back to client SDK:", error);
        await deleteRoom(roomId, user.uid);
        
        // If we're in the deleted room, leave it
        if (currentRoom?.id === roomId) {
          setCurrentRoomState(null);
          localStorage.removeItem("currentRoomId");
        }
      }
    },
    [user, currentRoom]
  );

  const handleJoinRoom = useCallback((room: Room) => {
    setCurrentRoomState(room);
    localStorage.setItem("currentRoomId", room.id);
  }, []);

  const handleLeaveRoom = useCallback(async () => {
    // Clear recording state if user was recording
    if (currentRoom && user && recordingState?.userId === user.uid) {
      try {
        await setRecordingState(currentRoom.id, user.uid, user.displayName || user.email || "User", false);
      } catch (error) {
        console.error("Failed to clear recording state:", error);
      }
    }

    // Remove presence
    if (currentRoom && user) {
      try {
        await removeUserPresence(currentRoom.id, user.uid);
      } catch (error) {
        console.error("Failed to remove presence:", error);
      }
    }

    if (presenceCleanupRef.current) {
      presenceCleanupRef.current();
      presenceCleanupRef.current = null;
    }

    setCurrentRoomState(null);
    setLocalTranslations([]);
    setRecordingStateState(null);
    setActiveUsers([]);
    localStorage.removeItem("currentRoomId");
  }, [currentRoom, user, recordingState]);

  const handleSetCurrentRoom = useCallback((room: Room | null) => {
    setCurrentRoomState(room);
    if (room) {
      localStorage.setItem("currentRoomId", room.id);
    } else {
      localStorage.removeItem("currentRoomId");
    }
  }, []);

  const isRoomCreator = currentRoom
    ? currentRoom.createdBy === user?.uid
    : false;

  // Update recording state
  const handleUpdateRecordingState = useCallback(
    async (isRecording: boolean) => {
      if (!currentRoom || !user) {
        console.error("No room or user, cannot update recording state");
        return;
      }

      const userName = user.displayName || user.email || "User";
      try {
        await setRecordingState(currentRoom.id, user.uid, userName, isRecording);
      } catch (error) {
        console.error("Failed to update recording state:", error);
      }
    },
    [currentRoom, user]
  );

  // Add local translation and attempt to save to DB
  const handleAddLocalTranslation = useCallback(
    async (translation: Omit<TranslationRecord, "id" | "createdAt">) => {
      if (!currentRoom || !user) {
        console.error("No room or user, cannot add translation");
        return;
      }

      const localId = `local-${Date.now()}-${Math.random()}`;
      const now = new Date();
      
      const localTranslation: LocalTranslation = {
        ...translation,
        id: localId,
        createdAt: now,
        localId,
        saved: false,
        saving: true,
      };

      // Add to local state immediately
      setLocalTranslations((prev) => [...prev, localTranslation]);

      // Try to save to Firestore using client SDK
      try {
        await addTranslationToRoom(currentRoom.id, user.uid, translation);
        // Mark as saved
        setLocalTranslations((prev) =>
          prev.map((t) =>
            t.localId === localId ? { ...t, saved: true, saving: false } : t
          )
        );
        console.log("[RoomContext] Translation saved to Firestore");
      } catch (error) {
        console.error("[RoomContext] Failed to save translation:", error);
        // Keep in local state but mark as not saved
        setLocalTranslations((prev) =>
          prev.map((t) =>
            t.localId === localId ? { ...t, saved: false, saving: false } : t
          )
        );

        // Retry after 2 seconds
        setTimeout(async () => {
          try {
            await addTranslationToRoom(currentRoom.id, user.uid, translation);
            setLocalTranslations((prev) =>
              prev.map((t) =>
                t.localId === localId ? { ...t, saved: true, saving: false } : t
              )
            );
            console.log("[RoomContext] Translation saved on retry");
          } catch (retryError) {
            console.error("[RoomContext] Retry failed:", retryError);
          }
        }, 2000);
      }
    },
    [currentRoom, user]
  );

  return (
    <RoomContext.Provider
      value={{
        currentRoom,
        rooms,
        translations,
        loading,
        recordingState,
        activeUsers,
        setCurrentRoom: handleSetCurrentRoom,
        createRoom: handleCreateRoom,
        deleteRoom: handleDeleteRoom,
        joinRoom: handleJoinRoom,
        leaveRoom: handleLeaveRoom,
        isRoomCreator,
        addLocalTranslation: handleAddLocalTranslation,
        updateRecordingState: handleUpdateRecordingState,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return ctx;
}

