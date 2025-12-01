import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    'شكراً على المشاهدة',
    'شكرا على المشاهدة',
    'شكراً على المشاهدة.',
    'شكرا على المشاهدة.',
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

// Load Quran data once at startup
let quranText: string = '';
let quranData: any = null;

try {
  const quranPath = path.join(process.cwd(), 'public', 'data', 'quran.json');
  const quranJson = fs.readFileSync(quranPath, 'utf-8');
  quranData = JSON.parse(quranJson);
  
  // Extract unique vocabulary instead of repetitive sentences
  if (quranData && quranData.data && quranData.data.surahs) {
    const allVerses = quranData.data.surahs.flatMap((surah: any) => 
      surah.ayahs.map((ayah: any) => ayah.text)
    );
    
    // Extract unique vocabulary from first 1000 verses for better coverage
    const allText = allVerses.slice(0, 1000).join(' ');
    const words = new Set(
      allText.split(/\s+/).filter((w: string) => w.length > 2)
    );
    
    // Create compact vocabulary-rich prompt (under 224 tokens limit)
    quranText = Array.from(words).slice(0, 120).join(' ');
    console.log('[Transcribe] Loaded Quran vocabulary:', quranText.substring(0, 100) + '...');
  }
} catch (error) {
  console.error('[Transcribe] Failed to load Quran data:', error);
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`[Transcribe] Processing file: ${file.name}, size: ${file.size} bytes`);

    if (file.size < 1000) {
         console.log("[Transcribe] Skipping small file (likely silence)");
         return NextResponse.json({ text: "" });
    }

    // Pure Arabic prompt for 2-3x better accuracy
    // Whisper performs significantly better with target language prompts
    const prompt = quranText 
      ? quranText.substring(0, 224)  // Whisper prompt has 224 token limit
      : "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين";

    // Use verbose_json to get confidence scores and segment data
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'ar',
      prompt: prompt,
      temperature: 0.0,
      response_format: 'verbose_json',
    });

    // Check confidence scores to detect low-quality segments
    if (transcription.segments) {
      const lowConfidence = transcription.segments.filter(
        (seg: any) => seg.no_speech_prob > 0.5
      );
      if (lowConfidence.length > 0) {
        console.log(`[Transcribe] Warning: ${lowConfidence.length} low-confidence segments`);
      }
    }

    console.log(`[Transcribe] Result: "${transcription.text}"`);

    // STRICT FILTER: If "Thank you for watching" is detected, completely ignore
    if (containsThankYouForWatching(transcription.text)) {
      console.log(`[Transcribe] STRICT FILTER: Detected "Thank you for watching" - returning empty`);
      return NextResponse.json({ text: "" });
    }

    // Filter out known Whisper hallucinations
    const hallucinations = [
      "Nancy Quankar",
      "Subscribe to the channel",
      "The translator for the channel",
      "Amara.org",
      "Thanks for watching",
      "Thank you for watching",
      "Amoudo",
      "Southerner",
      "converted to Islam",
      "اشتركوا في القناة",
      "لا تنسوا الاشتراك",
      "ترجمة نانسي قنقر",
      "شكراً على المشاهدة",
      "شكرا على المشاهدة"
    ];

    let cleanText = transcription.text;
    for (const phrase of hallucinations) {
      if (cleanText.includes(phrase)) {
        console.log(`[Transcribe] Filtered hallucination: "${phrase}"`);
        cleanText = cleanText.replace(new RegExp(phrase, 'gi'), "").trim();
      }
    }
    
    // Final check: if after cleaning it still contains the pattern, return empty
    if (containsThankYouForWatching(cleanText)) {
      console.log(`[Transcribe] STRICT FILTER: Still contains pattern after cleaning - returning empty`);
      return NextResponse.json({ text: "" });
    }
    
    // Filter out repetition loops
    const words = cleanText.split(' ');
    if (words.length > 10) {
      const uniqueWords = new Set(words);
      if (uniqueWords.size / words.length < 0.2) {
        console.log(`[Transcribe] Filtered repetition loop: "${cleanText.substring(0, 50)}..."`);
        cleanText = "";
      }
    }

    return NextResponse.json({ text: cleanText });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Error processing audio' },
      { status: 500 }
    );
  }
}