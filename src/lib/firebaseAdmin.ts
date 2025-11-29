import { cert, getApps, initializeApp, getApp } from "firebase-admin/app";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!getApps().length) {
  try {
    if (projectId && clientEmail && privateKey) {
      // Use explicit service account credentials
      console.log(
        "[Firebase Admin] Initializing with service account credentials"
      );
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      console.log(
        `[Firebase Admin] Successfully initialized for project: ${projectId}`
      );
    } else {
      // Try to use Application Default Credentials (for GCP environments or GOOGLE_APPLICATION_CREDENTIALS)
      console.log(
        "[Firebase Admin] Attempting to initialize with Application Default Credentials"
      );
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log(
          `[Firebase Admin] Using credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
        );
      }
      initializeApp();
      console.log("[Firebase Admin] Successfully initialized with ADC");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Firebase Admin] Failed to initialize:", error);
    // eslint-disable-next-line no-console
    console.warn(
      "[Firebase Admin] SDK not properly initialized. Translation history saving will fail."
    );
    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "[Firebase Admin] Missing environment variables. Please set: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
      );
    }
  }
} else {
  console.log("[Firebase Admin] Already initialized");
}

// Export a helper to check if admin is initialized
export function isFirebaseAdminInitialized(): boolean {
  try {
    getApp();
    return true;
  } catch {
    return false;
  }
}


