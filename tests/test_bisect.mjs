/**
 * Bisect config to find exactly which parameter causes 400
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const VIDEO_RESPONSE_SCHEMA = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        factualClaims: { type: 'array', maxItems: 5, items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string' } }, required: ['claim', 'verdict'] } },
        finalInvestigativeReport: { type: 'string' }
    }
};

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const prompt = 'Analyze this video briefly. Return valid JSON with summary and overallAssessment.';
const systemInstruction = 'You are a fact-checker. Return valid JSON only. Output language: Bulgarian.';

const contents = [{
    role: 'user',
    parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: prompt }
    ]
}];

async function test(name, config) {
    try {
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config
        });
        let text = '';
        for await (const chunk of stream) {
            text += chunk.text || '';
        }
        console.log(`✅ ${name}: OK (${text.length} chars)`);
        return true;
    } catch (e) {
        const errJson = JSON.stringify(e, Object.getOwnPropertyNames(e));
        const errDetails = errJson.substring(0, 500);
        console.error(`❌ ${name}: Failed - ${e.message} [HTTP ${e.status}]`);
        console.error(`   Details: ${errDetails}`);
        return false;
    }
}

// Test 1: Minimal config 
await test('1. Minimal (maxTokens 8000)', {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 8000,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
});

// Test 2: With maxOutputTokens: 32000 
await test('2. maxTokens=32000', {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 32000,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
});

// Test 3: With maxOutputTokens: 63536
await test('3. maxTokens=63536', {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
});

// Test 4: Without mediaResolution 
await test('4. No mediaResolution, maxTokens=63536', {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
});

// Test 5: Without schema, maxTokens=63536
await test('5. No schema, maxTokens=63536', {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
});

// Test 6: httpOptions timeout
await test('6. With httpOptions timeout', {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 300000 }
});

console.log('\nDone!');
