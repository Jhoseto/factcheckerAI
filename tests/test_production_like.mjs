/**
 * Test with production-like bigprompt + full VIDEO_RESPONSE_SCHEMA
 * This simulates exactly what happens in generate-stream standard mode
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Full VIDEO_RESPONSE_SCHEMA from gemini.js
const VIDEO_RESPONSE_SCHEMA = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        factualClaims: { type: 'array', maxItems: 30, items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] }, evidence: { type: 'string' }, logicalAnalysis: { type: 'string' }, factualVerification: { type: 'string' }, comparison: { type: 'string' }, context: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, speaker: { type: 'string' }, timestamp: { type: 'string' } }, required: ['claim', 'verdict'] } },
        claims: { type: 'array', maxItems: 30, items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] }, evidence: { type: 'string' } }, required: ['claim', 'verdict'] } },
        quotes: { type: 'array', items: { type: 'object' }, maxItems: 10 },
        manipulationTechniques: { type: 'array', maxItems: 20, items: { type: 'object', properties: { technique: { type: 'string' }, description: { type: 'string' }, example: { type: 'string' }, impact: { type: 'string' }, counterArgument: { type: 'string' }, timestamp: { type: 'string' }, severity: { type: 'number' } }, required: ['technique', 'description'] } },
        finalInvestigativeReport: { type: 'string' },
        geopoliticalContext: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        historicalParallel: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        psychoLinguisticAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        strategicIntent: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        narrativeArchitecture: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        technicalForensics: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        socialImpactPrediction: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        visualAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        bodyLanguageAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        vocalAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        deceptionAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        humorAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        psychologicalProfile: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        culturalSymbolicAnalysis: { type: 'array', items: { type: 'object' }, maxItems: 5 },
        recommendations: { type: 'array', items: { type: 'object' }, maxItems: 10 },
        biasIndicators: { type: 'object' }
    }
};

// Simulate the production prompt (condensed for test)
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const prompt = `Ти си елитен фактчекър с над 20 години опит. Анализирай това видео за https://www.youtube.com/watch?v=dQw4w9WgXcQ.

Днешната дата е ${currentDate}.

Извлечи: summary, overallAssessment, factualClaims (поне 5), manipulationTechniques (поне 3), finalInvestigativeReport (10+ параграфа), geopoliticalContext, historicalParallel, psychoLinguisticAnalysis, strategicIntent, narrativeArchitecture, technicalForensics, socialImpactPrediction, recommendations, biasIndicators.

Върни пълен JSON с всички полета.`;

// System instruction like production
const systemInstruction = `You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.

Output language: you must write the entire analysis and all text only in Bulgarian.

CRITICAL — Your entire response MUST be exactly one valid JSON object. Start with { and end with }. No markdown (no \`\`\`), no text before or after. Inside string values: escape double quotes as \", and escape newlines as \\n. Never truncate: always output the full JSON and close every bracket. Keep ALL schema fields populated (summary, overallAssessment, detailedMetrics, factualClaims, manipulationTechniques, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.`;

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const stdConfig = {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 300000 }
};

const contents = [{
    role: 'user',
    parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: prompt }
    ]
}];

console.log('Starting production-like streaming test...');
console.log('System instruction length:', systemInstruction.length);
console.log('Prompt length:', prompt.length);

const startTime = Date.now();
let fullText = '';
let chunkCount = 0;

try {
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: stdConfig
    });

    for await (const chunk of stream) {
        const chunkText = chunk.text || '';
        if (chunkText) {
            fullText += chunkText;
            chunkCount++;
            if (chunkCount % 10 === 0) process.stdout.write('.');
        }
        if (chunk.usageMetadata) {
            const u = chunk.usageMetadata;
            console.log(`\n[Usage] prompt: ${u.promptTokenCount}, candidates: ${u.candidatesTokenCount}, total: ${u.totalTokenCount}`);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nDone in ${elapsed}s. Chunks: ${chunkCount}, Text length: ${fullText.length}`);

    if (fullText.length > 0) {
        console.log('First 500 chars:', fullText.substring(0, 500));
        try {
            const parsed = JSON.parse(fullText);
            console.log('✅ Valid JSON! Keys:', Object.keys(parsed).join(', '));
            console.log('factualClaims count:', parsed.factualClaims?.length);
            console.log('manipulationTechniques count:', parsed.manipulationTechniques?.length);
        } catch (e) {
            console.error('❌ Invalid JSON:', e.message);
        }
    } else {
        console.error('❌ EMPTY response!');
    }

} catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ FAILED after ${elapsed}s:`, e.message);
    if (e.status) console.error('HTTP Status:', e.status);

    // Check if it's a thinking budget error
    const errStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
    console.error('Error details:', errStr.substring(0, 3000));
}
