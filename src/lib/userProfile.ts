import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebaseClient";

export async function ensureUserProfile(user: User) {
  const ref = doc(db, "users", user.uid);
  await setDoc(
    ref,
    {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true }
  );
}


