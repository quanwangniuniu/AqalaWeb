import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isFirebaseAdminInitialized } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  if (!isFirebaseAdminInitialized()) {
    return NextResponse.json(
      { error: "Firebase Admin not initialized" },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (tokenError) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const db = getFirestore();
    const roomsSnapshot = await db
      .collection("rooms")
      .orderBy("createdAt", "desc")
      .get();

    const rooms = roomsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("[Rooms API] Error fetching rooms:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Error fetching rooms: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isFirebaseAdminInitialized()) {
    return NextResponse.json(
      { error: "Firebase Admin not initialized" },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (tokenError) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Room name must be 100 characters or less" },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const roomRef = await db.collection("rooms").add({
      name: name.trim(),
      createdBy: decoded.uid,
      createdAt: new Date(),
    });

    return NextResponse.json({ id: roomRef.id, name: name.trim() });
  } catch (error) {
    console.error("[Rooms API] Error creating room:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Error creating room: ${errorMessage}` },
      { status: 500 }
    );
  }
}

