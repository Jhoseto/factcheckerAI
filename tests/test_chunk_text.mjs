/**
 * Test how chunk.text behaves in @google/genai SDK 1.38.0
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
        factualClaims: { type: 'array', maxItems: 3, items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string' } }, required: ['claim', 'verdict'] } },
        finalInvestigativeReport: { type: 'string' }
    }
};

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

console.log('\n=== TESTING chunk.text TYPE in streaming ===');

const stdConfig = {
    systemInstruction: 'You are a fact-checker. Return valid JSON only.',
    temperature: 0.7,
    maxOutputTokens: 2000,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 120000 }
};

const contents = [{
    role: 'user',
    parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: 'Analyze this video briefly. summary: what is this video about. overallAssessment: MIXED. factualClaims: at least 1 claim.' }
    ]
}];

try {
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: stdConfig
    });

    let fullText = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
        chunkCount++;

        // Show what chunk.text is
        const textType = typeof chunk.text;
        if (chunkCount <= 3) {
            console.log(`Chunk ${chunkCount} - chunk.text type: ${textType}, value:`,
                textType === 'function' ? '[FUNCTION]' : textType === 'string' ? chunk.text.substring(0, 30) : chunk.text);
        }

        // How the server does it (ред 760):
        const chunkText = chunk.text || '';
        fullText += chunkText;

        if (chunk.usageMetadata && chunkCount > 1) {
            console.log('Usage metadata chunk', chunkCount, ':', JSON.stringify(chunk.usageMetadata));
        }
    }

    console.log(`\nTotal chunks: ${chunkCount}`);
    console.log(`fullText length: ${fullText.length}`);
    if (fullText.length > 0) {
        console.log('✅ Got text! First 300 chars:', fullText.substring(0, 300));
        try {
            JSON.parse(fullText);
            console.log('✅ Valid JSON!');
        } catch (e) {
            console.log('❌ Invalid JSON:', e.message);
        }
    } else {
        console.log('❌ fullText is EMPTY!');

        // Check candidates directly
        console.log('\n--- checking stream aggregated result ---');
        // Aggregate using the stream itself
    }

} catch (e) {
    console.error('❌ STREAM ERROR:', e.message);
    if (e.status) console.error('HTTP Status:', e.status);
    const errStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
    console.error('Error details:', errStr.substring(0, 2000));
}
