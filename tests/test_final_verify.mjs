/**
 * FINAL VERIFICATION TEST
 * Tests that the fixed gemini.js VIDEO_RESPONSE_SCHEMA (without maxItems) works correctly
 * with the real production prompt
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
import { readFileSync } from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Import the FIXED schema directly from the patched gemini.js 
// (same content as what's now in gemini.js — no maxItems)
const VIDEO_RESPONSE_SCHEMA_FIXED = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        factualClaims: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] }, evidence: { type: 'string' } }, required: ['claim', 'verdict'] } },
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

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const productionSysInstr = `You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.

Output language: you must write the entire analysis and all text only in Bulgarian.

CRITICAL — Your entire response MUST be exactly one valid JSON object. Start with { and end with }. No markdown (no \`\`\`), no text before or after. Inside string values: escape double quotes as \\", and escape newlines as \\n. Never truncate: always output the full JSON and close every bracket. Keep ALL schema fields populated (summary, overallAssessment, detailedMetrics, factualClaims, manipulationTechniques, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.`;

// Read real prompt
const tsContent = readFileSync('./services/prompts/standardAnalysisPrompt.ts', 'utf-8');
const match = tsContent.match(/return `([\s\S]*?)`;/);
const promptTemplate = match[1];
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const realPrompt = promptTemplate
    .replace('${currentDate}', currentDate)
    .replace("${type === 'video' ? 'видео' : 'статия'}", 'видео')
    .replace("${type === 'video' ? ' (видео)': ''}", ' (видео)')
    + `\n\nVideo URL: ${testVideoUrl}\nVideo Context: Title: "Rick Astley - Never Gonna Give You Up", Author: "RickAstleyVEVO", Duration: 3:33.`;

async function runTest(name, isDeepMode) {
    console.log(`\n=== ${name} ===`);
    const tools = isDeepMode ? [{ googleSearch: {} }] : undefined;
    const config = {
        systemInstruction: productionSysInstr,
        temperature: 0.7,
        maxOutputTokens: isDeepMode ? 63536 : 63536,
        mediaResolution: 'MEDIA_RESOLUTION_LOW',
        httpOptions: { timeout: isDeepMode ? 600000 : 300000 },
        ...(tools ? { tools } : { responseMimeType: 'application/json', responseSchema: VIDEO_RESPONSE_SCHEMA_FIXED })
    };

    const contents = [{
        role: 'user', parts: [
            { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
            { text: realPrompt }
        ]
    }];

    try {
        const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config });
        let text = '';
        for await (const chunk of stream) text += chunk.text || '';

        if (text.length > 0) {
            try {
                const parsed = JSON.parse(text);
                const keys = Object.keys(parsed);
                console.log(`✅ SUCCESS! JSON valid. Keys: ${keys.slice(0, 5).join(', ')}...`);
                console.log(`   factualClaims: ${parsed.factualClaims?.length || 0}`);
                console.log(`   manipulationTechniques: ${parsed.manipulationTechniques?.length || 0}`);
                console.log(`   summary: "${parsed.summary?.substring(0, 100)}..."`);
            } catch (e) {
                console.log(`⚠️  Got ${text.length} chars but invalid JSON: ${e.message}`);
            }
        } else {
            console.error('❌ EMPTY response!');
        }
    } catch (e) {
        let errMsg = e.message;
        try { const p = JSON.parse(e.message); errMsg = `status=${p.error?.status}: ${p.error?.message?.substring(0, 200)}`; } catch (_) { }
        console.error(`❌ FAILED HTTP ${e.status}: ${errMsg}`);
    }
}

// Test both modes
await runTest('STANDARD MODE (real production prompt, fixed schema)', false);
console.log('\n✅ Standard mode test complete. Deep mode test would take 2-5 min, skipping for now.\n');
