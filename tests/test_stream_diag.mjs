/**
 * Full stream diagnostic - simulates what the server does in generate-stream endpoint
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key set:', !!apiKey);
const ai = new GoogleGenAI({ apiKey });

// Minimal VIDEO_RESPONSE_SCHEMA like in production
const VIDEO_RESPONSE_SCHEMA = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        factualClaims: { type: 'array', maxItems: 5, items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string' } }, required: ['claim', 'verdict'] } },
        manipulationTechniques: { type: 'array', maxItems: 3, items: { type: 'object' } },
        finalInvestigativeReport: { type: 'string' }
    }
};

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const isDeepMode = false; // test STANDARD first

const tools = (isDeepMode) ? [{ googleSearch: {} }] : undefined;
const contents = [{
    role: 'user',
    parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: 'Analyze this video briefly. Return JSON with summary and overallAssessment.' }
    ]
}];

// STANDARD MODE - what the server does
console.log('\n=== STANDARD MODE VIDEO STREAM TEST ===');
const stdConfig = {
    systemInstruction: 'You are a fact-checker. Return only valid JSON.',
    temperature: 0.7,
    maxOutputTokens: 5000, // reduced for test
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 120000 }
};

try {
    console.log('Starting stream...');
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: stdConfig
    });

    let fullText = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
        const chunkText = chunk.text || '';
        if (chunkText) {
            fullText += chunkText;
            chunkCount++;
            process.stdout.write('.');
        }
        if (chunk.usageMetadata) {
            console.log('\nUsage metadata received:', JSON.stringify(chunk.usageMetadata));
        }
    }
    console.log(`\nTotal chunks: ${chunkCount}, Total text length: ${fullText.length}`);
    console.log('First 500 chars:', fullText.substring(0, 500));

    // Try to parse
    try {
        const parsed = JSON.parse(fullText);
        console.log('✅ JSON VALID! Keys:', Object.keys(parsed).join(', '));
        console.log('Summary:', parsed.summary?.substring(0, 100));
    } catch (e) {
        console.error('❌ JSON INVALID:', e.message);
        console.log('Raw text:', fullText.substring(0, 200));
    }
} catch (e) {
    console.error('\n❌ STREAM FAILED:', e.message);
    if (e.status) console.error('HTTP Status:', e.status);
    console.error('Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e)).substring(0, 2000));
}

console.log('\n\nDone!');
