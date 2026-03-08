/**
 * Verify: does removing maxItems fix the 400/INVALID_ARGUMENT?
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
import { readFileSync } from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// Schema WITHOUT maxItems
const VIDEO_RESPONSE_SCHEMA_FIXED = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        factualClaims: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] }, evidence: { type: 'string' }, logicalAnalysis: { type: 'string' }, factualVerification: { type: 'string' }, comparison: { type: 'string' }, context: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, speaker: { type: 'string' }, timestamp: { type: 'string' } }, required: ['claim', 'verdict'] } },
        claims: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] }, evidence: { type: 'string' } }, required: ['claim', 'verdict'] } },
        quotes: { type: 'array', items: { type: 'object' } },
        manipulationTechniques: { type: 'array', items: { type: 'object', properties: { technique: { type: 'string' }, description: { type: 'string' }, example: { type: 'string' }, impact: { type: 'string' }, counterArgument: { type: 'string' }, timestamp: { type: 'string' }, severity: { type: 'number' } }, required: ['technique', 'description'] } },
        finalInvestigativeReport: { type: 'string' },
        geopoliticalContext: { type: 'array', items: { type: 'object' } },
        historicalParallel: { type: 'array', items: { type: 'object' } },
        psychoLinguisticAnalysis: { type: 'array', items: { type: 'object' } },
        strategicIntent: { type: 'array', items: { type: 'object' } },
        narrativeArchitecture: { type: 'array', items: { type: 'object' } },
        technicalForensics: { type: 'array', items: { type: 'object' } },
        socialImpactPrediction: { type: 'array', items: { type: 'object' } },
        visualAnalysis: { type: 'array', items: { type: 'object' } },
        bodyLanguageAnalysis: { type: 'array', items: { type: 'object' } },
        vocalAnalysis: { type: 'array', items: { type: 'object' } },
        deceptionAnalysis: { type: 'array', items: { type: 'object' } },
        humorAnalysis: { type: 'array', items: { type: 'object' } },
        psychologicalProfile: { type: 'array', items: { type: 'object' } },
        culturalSymbolicAnalysis: { type: 'array', items: { type: 'object' } },
        recommendations: { type: 'array', items: { type: 'object' } },
        biasIndicators: { type: 'object' }
    }
};

const productionSysInstr = `You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.

Output language: you must write the entire analysis and all text only in Bulgarian.

CRITICAL — Your entire response MUST be exactly one valid JSON object. Start with { and end with }. No markdown (no \`\`\`), no text before or after. Inside string values: escape double quotes as \\", and escape newlines as \\n. Never truncate: always output the full JSON and close every bracket. Keep ALL schema fields populated (summary, overallAssessment, detailedMetrics, factualClaims, manipulationTechniques, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.`;

// Read real prompt
const tsContent = readFileSync('./services/prompts/standardAnalysisPrompt.ts', 'utf-8');
const match = tsContent.match(/return `([\s\S]*?)`;/);
const promptTemplate = match ? match[1] : 'FAILED';
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const realPrompt = promptTemplate
    .replace('${currentDate}', currentDate)
    .replace("${type === 'video' ? 'видео' : 'статия'}", 'видео')
    .replace("${type === 'video' ? ' (видео)': ''}", ' (видео)')
    + '\n\nVideo URL: ' + testVideoUrl;

console.log(`Real prompt length: ${realPrompt.length} chars`);

const contents = [{
    role: 'user', parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: realPrompt }
    ]
}];

// Test WITH fixed schema (no maxItems)
console.log('\n=== TEST: FIXED Schema (no maxItems) + Real Prompt ===');
const fixedConfig = {
    systemInstruction: productionSysInstr,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA_FIXED,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 300000 }
};

try {
    const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config: fixedConfig });
    let text = '';
    for await (const chunk of stream) {
        text += chunk.text || '';
        if (chunk.usageMetadata) console.log('Usage:', JSON.stringify(chunk.usageMetadata));
    }
    console.log(`✅ FIXED Schema SUCCESS: Got ${text.length} chars`);
    if (text) {
        try {
            const parsed = JSON.parse(text);
            console.log('✅ Valid JSON! Keys:', Object.keys(parsed).join(', '));
            console.log('factualClaims:', parsed.factualClaims?.length);
        } catch (e) {
            console.error('❌ Invalid JSON:', e.message);
        }
    }
} catch (e) {
    console.error(`❌ FIXED Schema FAILED HTTP ${e.status}`);
    let errMsg = e.message;
    try { const p = JSON.parse(e.message); errMsg = `status=${p.error?.status}: ${p.error?.message}`; } catch (_) { }
    console.error('Error:', errMsg.substring(0, 500));
}
