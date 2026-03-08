/**
 * Test DEEP MODE flow - exactly what the server does in generate-stream (deep mode)
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
        manipulationTechniques: { type: 'array', maxItems: 3, items: { type: 'object' } },
        finalInvestigativeReport: { type: 'string' }
    }
};

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const tools = [{ googleSearch: {} }]; // Deep mode has tools

const contents = [{
    role: 'user',
    parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: 'Fact-check this video briefly. Identify any claims made.' }
    ]
}];

const abortController = new AbortController();
// Set 60 second timeout for test
setTimeout(() => abortController.abort(), 60000);

console.log('\n=== DEEP MODE STAGE 1: generateContent with tools ===');
const toolConfig = {
    systemInstruction: 'You are a professional fact-checker. Respond with analysis.',
    temperature: 0.7,
    maxOutputTokens: 5000,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    tools,
    abortSignal: abortController.signal,
    httpOptions: { timeout: 60000 }
};

try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: toolConfig
    });

    const parts = response.candidates?.[0]?.content?.parts;
    const hasFn = Array.isArray(parts) && parts.some(p => p?.functionCall || p?.function_call);
    console.log('Has function calls:', hasFn);

    let rawText = '';
    if (typeof response.text === 'string') rawText = response.text;
    else if (typeof response.text === 'function') rawText = response.text();
    if (!rawText && parts?.length) {
        rawText = parts.map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '').join('');
    }

    console.log('Stage 1 rawText length:', rawText?.length || 0);
    console.log('Stage 1 first 300:', rawText?.substring(0, 300));

    let hasGrounding = rawText && rawText.trim().length > 50 && parts?.length;
    console.log('hasGrounding:', hasGrounding);

    let currentContents = [...contents];
    if (hasGrounding) {
        currentContents = [...currentContents, { role: 'model', parts }];
    }

    console.log('\n=== DEEP MODE STAGE 2: Final JSON step (no tools, with schema) ===');
    const finalConfig = {
        ...toolConfig,
        tools: undefined,
        responseMimeType: 'application/json',
        responseSchema: VIDEO_RESPONSE_SCHEMA,
        httpOptions: { timeout: 60000 }
    };

    const jsonPrompt = { role: 'user', parts: [{ text: 'Return the complete analysis as valid JSON. summary: what is this video. overallAssessment: ACCURATE or MISLEADING. factualClaims: list claims. finalInvestigativeReport: 2-3 paragraph report.' }] };

    const finalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...currentContents, jsonPrompt],
        config: finalConfig
    });

    let fullText = '';
    if (typeof finalResponse.text === 'string') fullText = finalResponse.text;
    else if (typeof finalResponse.text === 'function') fullText = finalResponse.text();
    if (!fullText && finalResponse.candidates?.[0]?.content?.parts) {
        fullText = finalResponse.candidates[0].content.parts
            .map(p => (p && typeof p === 'object' && p.text != null) ? String(p.text) : '')
            .join('');
    }

    console.log('Stage 2 fullText length:', fullText?.length || 0);

    if (fullText && fullText.length > 0) {
        console.log('✅ Got text! First 400 chars:', fullText.substring(0, 400));
        try {
            const parsed = JSON.parse(fullText);
            console.log('✅ Valid JSON! Keys:', Object.keys(parsed).join(', '));
        } catch (e) {
            console.error('❌ Invalid JSON:', e.message);
        }
    } else {
        console.log('❌ Stage 2 returned EMPTY text!');
        console.log('Response finish reason:', finalResponse.candidates?.[0]?.finishReason);
        console.log('Response candidates:', JSON.stringify(finalResponse.candidates, null, 2).substring(0, 500));
    }

} catch (e) {
    console.error('❌ FAILED:', e.message);
    if (e.name === 'AbortError') console.error('AbortError - request was aborted!');
    if (e.status) console.error('HTTP Status:', e.status);
    const errStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
    console.error('Error details:', errStr.substring(0, 2000));
}

console.log('\nDone!');
