import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebaseClient";

export interface TranslationRecord {
  id?: string;
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetLang: string;
  createdAt?: any;
  metadata?: Record<string, unknown>;
}

export async function addTranslationForUser(
  uid: string,
  record: Omit<TranslationRecord, "id" | "createdAt">
) {
  const col = collection(db, "users", uid, "translations");
  await addDoc(col, {
    ...record,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToUserTranslations(
  uid: string,
  cb: (records: TranslationRecord[]) => void,
  max = 50
) {
  const col = collection(db, "users", uid, "translations");
  const q = query(col, orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (snap) => {
    const data: TranslationRecord[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    cb(data);
  });
}


