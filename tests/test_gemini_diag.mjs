import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBkuN-gtjCZYQQ-vwsnmxCDddfu2sFtkio';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Test 1: simple text generation with JSON
console.log('=== TEST 1: Simple text generation with JSON schema ===');
try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'Return a simple JSON: {"message": "hello", "status": "ok"}' }] }],
        config: {
            temperature: 0.5,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
        }
    });
    const text = typeof response.text === 'function' ? response.text() : response.text;
    console.log('SUCCESS:', text?.substring(0, 200));
} catch (e) {
    console.error('FAILED:', e.message);
    if (e.status) console.error('HTTP Status:', e.status);
}

// Test 2: with googleSearch tool (similar to deep mode)
console.log('\n=== TEST 2: With googleSearch tool ===');
try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'What is the capital of France? Answer briefly.' }] }],
        config: {
            temperature: 0.5,
            maxOutputTokens: 200,
            tools: [{ googleSearch: {} }],
        }
    });
    const text = typeof response.text === 'function' ? response.text() : response.text;
    console.log('SUCCESS:', text?.substring(0, 200));
} catch (e) {
    console.error('FAILED:', e.message);
    if (e.status) console.error('HTTP Status:', e.status);
    console.error('Details:', JSON.stringify(e, Object.getOwnPropertyNames(e)).substring(0, 800));
}

// Test 3: Video analysis (YouTube URL)
console.log('\n=== TEST 3: Video with YouTube URL as fileData ===');
try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
            role: 'user',
            parts: [
                { fileData: { mimeType: 'video/mp4', fileUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
                { text: 'Describe what you see in 1 sentence.' }
            ]
        }],
        config: {
            temperature: 0.5,
            maxOutputTokens: 200,
            mediaResolution: 'MEDIA_RESOLUTION_LOW',
        }
    });
    const text = typeof response.text === 'function' ? response.text() : response.text;
    console.log('SUCCESS:', text?.substring(0, 300));
} catch (e) {
    console.error('FAILED:', e.message);
    if (e.status) console.error('HTTP Status:', e.status);
    console.error('Error details:', JSON.stringify(e, Object.getOwnPropertyNames(e)).substring(0, 1500));
}
