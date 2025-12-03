import { NextResponse } from "next/server";
import OpenAI from "openai";
import crypto from "crypto";
import { getAuth } from "firebase-admin/auth";
import {
  addTranslationForUserAdmin,
  addTranslationToRoomAdmin,
} from "@/lib/translationHistoryAdmin";
import { isFirebaseAdminInitialized } from "@/lib/firebaseAdmin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory cache for repeated translations (consider Redis for production)
const translationCache = new Map<string, { translation: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

function getCacheKey(text: string): string {
  return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
}

function getCachedTranslation(text: string): string | null {
  const key = getCacheKey(text);
  const cached = translationCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Translate API] Cache hit');
    return cached.translation;
  }
  
  if (cached) {
    translationCache.delete(key);
  }
  
  return null;
}

function setCachedTranslation(text: string, translation: string): void {
  const key = getCacheKey(text);
  translationCache.set(key, { translation, timestamp: Date.now() });
  
  // Keep cache size manageable (last 1000 entries)
  if (translationCache.size > 1000) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) {
      translationCache.delete(firstKey);
    }
  }
}

// Strict filter for "Thank you for watching" content - if detected, completely ignore
function containsThankYouForWatching(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  
  // English patterns
  const englishPatterns = [
    'thank you for watching',
    'thanks for watching',
    'thank you for view',
    'thanks for view',
    'thank you for watching.',
    'thanks for watching.',
  ];
  
  // Check exact matches or contains
  for (const pattern of englishPatterns) {
    if (normalized.includes(pattern.toLowerCase()) || 
        normalized === pattern.toLowerCase() ||
        text.includes(pattern)) {
      return true;
    }
  }
  
  // Check Arabic patterns (case-insensitive)
  const arabicPatterns = [
    'شكراً على المشاهدة',
    'شكرا على المشاهدة',
    'شكراً على المشاهدة.',
    'شكرا على المشاهدة.',
  ];
  
  for (const pattern of arabicPatterns) {
    if (text.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

// Strict filter for common Whisper hallucinations (especially "you're welcome")
function containsHallucination(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  
  // English patterns for "you're welcome" and similar
  const englishPatterns = [
    "you're welcome",
    "youre welcome",
    "you are welcome",
    "your welcome",
    "ur welcome",
    "welcome",
    "no problem",
    "no worries",
    "anytime",
  ];
  
  // Check exact matches or contains
  for (const pattern of englishPatterns) {
    if (normalized.includes(pattern.toLowerCase()) || 
        normalized === pattern.toLowerCase() ||
        text.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  // Check Arabic patterns (common hallucinations)
  const arabicPatterns = [
    "عفواً",
    "عفوا",
    "أهلاً بك",
    "أهلا بك",
    "أهلاً",
    "أهلا",
    "مرحباً",
    "مرحبا",
  ];
  
  for (const pattern of arabicPatterns) {
    if (text.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

// Strict filter for repeated character patterns (e.g., "JJJJJJ...", "AAAAAA...")
function containsRepeatedCharacters(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false; // Too short to be a problem
  
  // Remove spaces to check for character repetition
  const withoutSpaces = trimmed.replace(/\s+/g, '');
  if (withoutSpaces.length < 10) return false;
  
  // Check if a single character repeats too many times
  // If more than 70% of characters are the same, it's likely an artifact
  const charCounts = new Map<string, number>();
  for (const char of withoutSpaces) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }
  
  const maxCount = Math.max(...Array.from(charCounts.values()));
  const repetitionRatio = maxCount / withoutSpaces.length;
  
  // If single character makes up more than 70% of text, it's a repetition artifact
  if (repetitionRatio > 0.7) {
    return true;
  }
  
  // Also check for short pattern repetition (e.g., "ABABABAB..." or "ABCABCABC...")
  // Check 1-3 character patterns
  for (let patternLen = 1; patternLen <= 3; patternLen++) {
    if (withoutSpaces.length < patternLen * 5) continue;
    
    const pattern = withoutSpaces.substring(0, patternLen);
    let matches = 0;
    for (let i = 0; i < withoutSpaces.length - patternLen + 1; i += patternLen) {
      if (withoutSpaces.substring(i, i + patternLen) === pattern) {
        matches++;
      } else {
        break;
      }
    }
    
    // If pattern repeats more than 5 times consecutively, it's likely an artifact
    if (matches >= 5) {
      return true;
    }
  }
  
  return false;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Check Firebase Admin initialization
    if (!isFirebaseAdminInitialized()) {
      console.warn(
        "[Translate API] Firebase Admin SDK not initialized. History saving will fail."
      );
    }

    // Verify authentication
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

    // Parse and validate request body
    const { text, roomId } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();
    
    if (trimmedText.length === 0) {
      return NextResponse.json(
        { error: "Text is empty" },
        { status: 400 }
      );
    }

    // STRICT FILTER: If repeated characters detected in input, completely ignore
    if (containsRepeatedCharacters(trimmedText)) {
      console.log(`[Translate API] STRICT FILTER: Detected repeated character pattern in input - returning empty`);
      return NextResponse.json({ 
        text: "",
        cached: false,
        processingTime: Date.now() - startTime,
        filtered: true
      });
    }

    // STRICT FILTER: If "Thank you for watching" is detected in input, completely ignore
    if (containsThankYouForWatching(trimmedText)) {
      console.log(`[Translate API] STRICT FILTER: Detected "Thank you for watching" in input - returning empty`);
      return NextResponse.json({ 
        text: "",
        cached: false,
        processingTime: Date.now() - startTime,
        filtered: true
      });
    }

    // STRICT FILTER: If hallucinations like "you're welcome" are detected in input, completely ignore
    if (containsHallucination(trimmedText)) {
      console.log(`[Translate API] STRICT FILTER: Detected hallucination in input - returning empty`);
      return NextResponse.json({ 
        text: "",
        cached: false,
        processingTime: Date.now() - startTime,
        filtered: true
      });
    }

    if (trimmedText.length > 5000) {
      return NextResponse.json(
        { error: "Text too long. Maximum 5000 characters." },
        { status: 400 }
      );
    }

    if (roomId && typeof roomId !== 'string') {
      return NextResponse.json(
        { error: "Invalid roomId format" },
        { status: 400 }
      );
    }

    console.log(`[Translate API] User ${uid}, text length: ${trimmedText.length}`);

    // Check cache first
    const cachedTranslation = getCachedTranslation(trimmedText);
    if (cachedTranslation) {
      // STRICT FILTER: Even cached translations must pass filters
      if (containsRepeatedCharacters(cachedTranslation) ||
          containsThankYouForWatching(cachedTranslation) ||
          containsHallucination(cachedTranslation)) {
        console.log(`[Translate API] Cached translation failed filters - ignoring cache`);
        // Continue to generate new translation instead
      } else {
        const responseTime = Date.now() - startTime;
        console.log(`[Translate API] Cached response in ${responseTime}ms`);
        
        return NextResponse.json({ 
          text: cachedTranslation,
          cached: true,
          processingTime: responseTime
        });
      }
    }

    // Perform translation with optimized prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert translator for Islamic religious content from Arabic to English.

RULES:
1. Preserve Islamic terms in standard English forms:
   - Allah (never "God")
   - Subhanahu wa ta'ala (SWT) when referring to Allah
   - Sallallahu alayhi wa sallam (PBUH) for Prophet Muhammad
   - Radiyallahu anhu/anha (RA) for companions
   - Keep terms: Salah, Zakah, Sawm, Hajj, Jannah, Jahannam, Quran, Hadith, Sunnah, Iman
2. Translate naturally for English-speaking Muslims familiar with basic Islamic terminology
3. Maintain the respectful, formal tone of religious discourse
4. Only output the translation, no explanations or preambles`,
        },
        {
          role: "user",
          content: trimmedText,
        },
      ],
      temperature: 0.3, // Consistent translations
      max_tokens: 500,
    });

    let translation = completion.choices[0].message.content ?? "";
    
    // STRICT FILTER: If repeated characters detected in translation output, return empty
    if (containsRepeatedCharacters(translation)) {
      console.log(`[Translate API] STRICT FILTER: Detected repeated character pattern in translation - returning empty`);
      return NextResponse.json({ 
        text: "",
        cached: false,
        processingTime: Date.now() - startTime,
        filtered: true
      });
    }
    
    // STRICT FILTER: If "Thank you for watching" is detected in translation output, return empty
    if (containsThankYouForWatching(translation)) {
      console.log(`[Translate API] STRICT FILTER: Detected "Thank you for watching" in translation - returning empty`);
      return NextResponse.json({ 
        text: "",
        cached: false,
        processingTime: Date.now() - startTime,
        filtered: true
      });
    }
    
    // STRICT FILTER: If hallucinations like "you're welcome" are detected in translation output, return empty
    if (containsHallucination(translation)) {
      console.log(`[Translate API] STRICT FILTER: Detected hallucination in translation - returning empty`);
      return NextResponse.json({ 
        text: "",
        cached: false,
        processingTime: Date.now() - startTime,
        filtered: true
      });
    }
    
    // Cache the translation
    setCachedTranslation(trimmedText, translation);

    const responseTime = Date.now() - startTime;
    console.log(`[Translate API] Completed in ${responseTime}ms`);

    // Save translation history (non-blocking, parallel execution)
    if (isFirebaseAdminInitialized()) {
      const translationRecord = {
        sourceText: trimmedText,
        sourceLang: "ar",
        targetText: translation,
        targetLang: "en",
        metadata: { 
          timestamp: new Date().toISOString(),
          processingTime: responseTime
        },
      };

      const savePromises = [];
      
      if (roomId) {
        savePromises.push(
          addTranslationToRoomAdmin(roomId, uid, translationRecord)
            .then(() => console.log(`[Translate API] Saved to room ${roomId}`))
            .catch((error) => console.error(`[Translate API] Room save failed:`, error))
        );
      }
      
      // Always save to user history as backup
      savePromises.push(
        addTranslationForUserAdmin(uid, translationRecord)
          .then(() => console.log(`[Translate API] Saved to user ${uid}`))
          .catch((error) => console.error(`[Translate API] User save failed:`, error))
      );
      
      // Execute saves in parallel without blocking response
      Promise.allSettled(savePromises);
    } else {
      console.warn(
        "[Translate API] Skipping history save - Firebase Admin not initialized"
      );
    }

    return NextResponse.json({ 
      text: translation,
      cached: false,
      processingTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[Translate API] Failed after ${responseTime}ms:`, error);
    
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Error processing translation: ${errorMessage}` },
      { status: 500 }
    );
  }
}