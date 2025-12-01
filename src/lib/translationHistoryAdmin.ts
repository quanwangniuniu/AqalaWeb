import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { isFirebaseAdminInitialized } from "@/lib/firebaseAdmin";

interface AdminTranslationRecord {
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetLang: string;
  metadata?: Record<string, unknown>;
}

export async function addTranslationForUserAdmin(
  uid: string,
  record: AdminTranslationRecord
) {
  // Check if Firebase Admin is properly initialized
  if (!isFirebaseAdminInitialized()) {
    throw new Error(
      "Firebase Admin SDK not initialized. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  try {
    const db = getFirestore();
    const colRef = db.collection("users").doc(uid).collection("translations");

    await colRef.add({
      ...record,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    // Re-throw with more context
    throw new Error(
      `Failed to save translation history: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function addTranslationToRoomAdmin(
  roomId: string,
  userId: string,
  record: AdminTranslationRecord
) {
  // Check if Firebase Admin is properly initialized
  if (!isFirebaseAdminInitialized()) {
    throw new Error(
      "Firebase Admin SDK not initialized. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  try {
    const db = getFirestore();
    const colRef = db
      .collection("rooms")
      .doc(roomId)
      .collection("translations");

    await colRef.add({
      ...record,
      createdBy: userId,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    // Re-throw with more context
    throw new Error(
      `Failed to save room translation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}


