import {
  addDoc,
  collection,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebaseClient";
import { TranslationRecord } from "./translationHistory";

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
  memberCount?: number;
}

export async function createRoom(name: string, userId: string): Promise<string> {
  const roomsCol = collection(db, "rooms");
  const docRef = await addDoc(roomsCol, {
    name: name.trim(),
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteRoom(roomId: string, userId: string): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("Room not found");
  }

  const roomData = roomSnap.data();
  if (roomData.createdBy !== userId) {
    throw new Error("Only the room creator can delete the room");
  }

  // Delete all translations in the room
  const translationsCol = collection(db, "rooms", roomId, "translations");
  const translationsSnap = await getDocs(translationsCol);
  const deletePromises = translationsSnap.docs.map((translationDoc) =>
    deleteDoc(translationDoc.ref)
  );
  await Promise.all(deletePromises);

  // Delete the room itself
  await deleteDoc(roomRef);
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    return null;
  }

  return {
    id: roomSnap.id,
    ...(roomSnap.data() as Omit<Room, "id">),
  };
}

export function subscribeToRooms(
  cb: (rooms: Room[]) => void
): () => void {
  const roomsCol = collection(db, "rooms");
  const q = query(roomsCol, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snap) => {
    const data: Room[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Room, "id">),
    }));
    cb(data);
  });
}

export function subscribeToRoomTranslations(
  roomId: string,
  cb: (translations: TranslationRecord[]) => void,
  max = 100
): () => void {
  const translationsCol = collection(db, "rooms", roomId, "translations");
  const q = query(
    translationsCol,
    orderBy("createdAt", "desc"),
    limit(max)
  );

  return onSnapshot(q, (snap) => {
    const data: TranslationRecord[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    cb(data);
  });
}

export async function addTranslationToRoom(
  roomId: string,
  userId: string,
  record: Omit<TranslationRecord, "id" | "createdAt">
): Promise<void> {
  const translationsCol = collection(db, "rooms", roomId, "translations");
  await addDoc(translationsCol, {
    ...record,
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
}

// Recording State Management
export interface RecordingState {
  userId: string;
  userName: string;
  isRecording: boolean;
  startedAt?: any;
  lastUpdated: any;
}

export async function setRecordingState(
  roomId: string,
  userId: string,
  userName: string,
  isRecording: boolean
): Promise<void> {
  const recordingStateRef = doc(db, "rooms", roomId, "recordingState", "current");
  
  if (isRecording) {
    await setDoc(recordingStateRef, {
      userId,
      userName,
      isRecording: true,
      startedAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
  } else {
    await setDoc(recordingStateRef, {
      userId,
      userName,
      isRecording: false,
      lastUpdated: serverTimestamp(),
    });
  }
}

export function subscribeToRecordingState(
  roomId: string,
  cb: (state: RecordingState | null) => void
): () => void {
  const recordingStateRef = doc(db, "rooms", roomId, "recordingState", "current");
  
  return onSnapshot(recordingStateRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as RecordingState;
      // Only return state if someone is actually recording
      if (data.isRecording) {
        cb(data);
      } else {
        cb(null);
      }
    } else {
      cb(null);
    }
  });
}

// Active Users Management
export interface ActiveUser {
  userId: string;
  userName: string;
  displayName: string;
  lastSeen: any;
}

export async function setUserPresence(
  roomId: string,
  userId: string,
  userName: string,
  displayName: string
): Promise<() => void> {
  const userPresenceRef = doc(db, "rooms", roomId, "activeUsers", userId);
  
  await setDoc(userPresenceRef, {
    userId,
    userName,
    displayName,
    lastSeen: serverTimestamp(),
  });

  // Return cleanup function
  return async () => {
    try {
      await deleteDoc(userPresenceRef);
    } catch (error) {
      console.error("Failed to remove user presence:", error);
    }
  };
}

export async function removeUserPresence(
  roomId: string,
  userId: string
): Promise<void> {
  const userPresenceRef = doc(db, "rooms", roomId, "activeUsers", userId);
  await deleteDoc(userPresenceRef);
}

export function subscribeToActiveUsers(
  roomId: string,
  cb: (users: ActiveUser[]) => void
): () => void {
  const activeUsersCol = collection(db, "rooms", roomId, "activeUsers");
  
  return onSnapshot(activeUsersCol, (snap) => {
    const users: ActiveUser[] = snap.docs.map((d) => ({
      ...(d.data() as ActiveUser),
    }));
    cb(users);
  });
}

