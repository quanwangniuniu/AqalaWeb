import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuth } from "firebase-admin/auth";
import {
  addTranslationForUserAdmin,
  addTranslationToRoomAdmin,
} from "@/lib/translationHistoryAdmin";
import { isFirebaseAdminInitialized } from "@/lib/firebaseAdmin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Check Firebase Admin initialization status
    if (!isFirebaseAdminInitialized()) {
      console.warn(
        "[Translate API] Firebase Admin SDK not initialized. History saving will fail."
      );
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      console.error("[Translate API] Missing authorization token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (tokenError) {
      console.error("[Translate API] Token verification failed:", tokenError);
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const uid = decoded.uid;
    console.log(`[Translate API] Authenticated user: ${uid}`);

    const { text, roomId } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Translate this Arabic text to English concisely. Do not add explanations.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const translation = completion.choices[0].message.content ?? "";

    // Save translation history (non-blocking - don't fail translation if history save fails)
    if (isFirebaseAdminInitialized()) {
      const translationRecord = {
        sourceText: text,
        sourceLang: "ar",
        targetText: translation,
        targetLang: "en",
        metadata: {},
      };

      if (roomId) {
        // Save to room
        addTranslationToRoomAdmin(roomId, uid, translationRecord)
          .then(() => {
            console.log(
              `[Translate API] Translation saved to room ${roomId} by user ${uid}`
            );
          })
          .catch((error) => {
            console.error(
              `[Translate API] Failed to save translation to room ${roomId}:`,
              error
            );
          });
      } else {
        // Save to user (backward compatibility)
        addTranslationForUserAdmin(uid, translationRecord)
          .then(() => {
            console.log(
              `[Translate API] Translation history saved for user ${uid}`
            );
          })
          .catch((error) => {
            console.error(
              `[Translate API] Failed to save translation history for user ${uid}:`,
              error
            );
          });
      }
    } else {
      console.warn(
        "[Translate API] Skipping history save - Firebase Admin not initialized"
      );
    }

    return NextResponse.json({ text: translation });
  } catch (error) {
    console.error("[Translate API] Translation error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Error processing translation: ${errorMessage}` },
      { status: 500 }
    );
  }
}


