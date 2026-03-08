/**
 * Test with THE REAL standardAnalysisPrompt.ts content (compiled)
 * This is the actual prompt that breaks production
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

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

// Production system instruction from generate-stream (gemini.js line 507-508)
const productionSysInstr = `You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.

Output language: you must write the entire analysis and all text only in Bulgarian.

CRITICAL — Your entire response MUST be exactly one valid JSON object. Start with { and end with }. No markdown (no \`\`\`), no text before or after. Inside string values: escape double quotes as \\", and escape newlines as \\n. Never truncate: always output the full JSON and close every bracket. Keep ALL schema fields populated (summary, overallAssessment, detailedMetrics, factualClaims, manipulationTechniques, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.`;

// Read the actual standardAnalysisPrompt content directly from the .ts file
// We can't import TS directly, so we read and process it
import { readFileSync } from 'fs';
const tsContent = readFileSync('./services/prompts/standardAnalysisPrompt.ts', 'utf-8');
// Extract the template literal content
const match = tsContent.match(/return `([\s\S]*?)`;/);
const promptTemplate = match ? match[1] : 'COULD NOT EXTRACT';
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const realPrompt = promptTemplate
    .replace('${currentDate}', currentDate)
    .replace("${type === 'video' ? 'видео' : 'статия'}", 'видео')
    .replace("${type === 'video' ? ' (видео)': ''}", ' (видео)')
    + '\n\nVideo URL: ' + testVideoUrl;

console.log(`Real prompt length: ${realPrompt.length} chars (${(realPrompt.length / 1024).toFixed(1)} KB)`);
console.log(`System instruction length: ${productionSysInstr.length} chars`);

const stdConfig = {
    systemInstruction: productionSysInstr,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 300000 }
};

const contents = [{
    role: 'user', parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: realPrompt }
    ]
}];

console.log('\nStarting stream with REAL production prompt...\n');
try {
    const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config: stdConfig });
    let text = '';
    for await (const chunk of stream) {
        text += chunk.text || '';
        if (chunk.usageMetadata) console.log('Usage:', JSON.stringify(chunk.usageMetadata));
    }
    console.log(`✅ SUCCESS: Got ${text.length} chars`);
} catch (e) {
    console.error(`❌ FAILED HTTP ${e.status}`);
    let errMsg = e.message;
    try { const p = JSON.parse(e.message); errMsg = `code=${p.error?.code} status=${p.error?.status}: ${p.error?.message}`; } catch (_) { }
    console.error('Error:', errMsg.substring(0, 500));
}
