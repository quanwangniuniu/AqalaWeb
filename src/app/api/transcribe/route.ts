import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load Quran data once at startup
let quranText: string = '';
let quranData: any = null;

try {
  const quranPath = path.join(process.cwd(), 'public', 'data', 'quran.json');
  const quranJson = fs.readFileSync(quranPath, 'utf-8');
  quranData = JSON.parse(quranJson);
  
  // Extract all Arabic text from all surahs
  if (quranData && quranData.data && quranData.data.surahs) {
    const allVerses = quranData.data.surahs.flatMap((surah: any) => 
      surah.ayahs.map((ayah: any) => ayah.text)
    );
    // Use first 500 verses as context (Whisper prompt has limits)
    quranText = allVerses.slice(0, 500).join(' ');
    console.log('[Transcribe] Loaded Quran context:', quranText.substring(0, 100) + '...');
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

    if (file.size < 1000) { // Skip files smaller than 1KB (likely silence/empty)
         console.log("[Transcribe] Skipping small file (likely silence)");
         return NextResponse.json({ text: "" });
    }

    // Use Quran text as context/prompt for better accuracy
    const prompt = quranText 
      ? `Quranic recitation in Arabic. Context: ${quranText.substring(0, 200)}`
      : "Quran recitation, Islamic sermon, Arabic speech, clear audio, no repetition.";

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'ar',
      prompt: prompt,
      temperature: 0.0, // Lower temperature for more accurate, less creative output
    });

    console.log(`[Transcribe] Result: "${transcription.text}"`);

    // Filter out known Whisper hallucinations (common in silent/noise segments)
    const hallucinations = [
      "Nancy Quankar",
      "Subscribe to the channel",
      "The translator for the channel",
      "Amara.org",
      "Thanks for watching",
      "Amoudo",
      "Southerner",
      "converted to Islam",
      "اشتركوا في القناة",
      "لا تنسوا الاشتراك",
      "ترجمة نانسي قنقر"
    ];

    let cleanText = transcription.text;
    for (const phrase of hallucinations) {
      if (cleanText.includes(phrase)) {
        console.log(`[Transcribe] Filtered hallucination: "${phrase}"`);
        cleanText = cleanText.replace(new RegExp(phrase, 'gi'), "").trim();
      }
    }
    
    // Filter out repetition loops (e.g. "word word word word")
    const words = cleanText.split(' ');
    if (words.length > 10) {
      const uniqueWords = new Set(words);
      // If unique words are less than 20% of total words, it's likely a loop
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

