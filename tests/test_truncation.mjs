/**
 * Test: Are 32768 output tokens enough? Does disabling thinking help?
 */
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
import { readFileSync } from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const VIDEO_RESPONSE_SCHEMA_FIXED = {
    type: 'object',
    required: ['summary', 'overallAssessment'],
    properties: {
        summary: { type: 'string' },
        overallAssessment: { type: 'string' },
        detailedMetrics: { type: 'object' },
        factualClaims: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string', enum: ['TRUE', 'MOSTLY_TRUE', 'MIXED', 'MOSTLY_FALSE', 'FALSE', 'UNVERIFIABLE'] }, evidence: { type: 'string' } }, required: ['claim', 'verdict'] } },
        quotes: { type: 'array', items: { type: 'object' } },
        manipulationTechniques: { type: 'array', items: { type: 'object', properties: { technique: { type: 'string' }, description: { type: 'string' }, severity: { type: 'number' } }, required: ['technique', 'description'] } },
        finalInvestigativeReport: { type: 'string' },
        geopoliticalContext: { type: 'array', items: { type: 'object' } },
        historicalParallel: { type: 'array', items: { type: 'object' } },
        psychoLinguisticAnalysis: { type: 'array', items: { type: 'object' } },
        strategicIntent: { type: 'array', items: { type: 'object' } },
        narrativeArchitecture: { type: 'array', items: { type: 'object' } },
        technicalForensics: { type: 'array', items: { type: 'object' } },
        socialImpactPrediction: { type: 'array', items: { type: 'object' } },
        recommendations: { type: 'array', items: { type: 'object' } },
        biasIndicators: { type: 'object' }
    }
};

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const productionSysInstr = `You are an ELITE fact-checker. Analyze the video and return a comprehensive JSON analysis. Output all text in BULGARIAN. Keep JSON Enum values in English. CRITICAL: Generate a COMPLETE, valid JSON response. Do NOT truncate your output.`;

// Read real prompt
const tsContent = readFileSync('./services/prompts/standardAnalysisPrompt.ts', 'utf-8');
const match = tsContent.match(/return `([\s\S]*?)`;/);
const promptTemplate = match[1];
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const realPrompt = promptTemplate
    .replace('${currentDate}', currentDate)
    .replace("${type === 'video' ? 'видео' : 'статия'}", 'видео')
    .replace("${type === 'video' ? ' (видео)': ''}", ' (видео)')
    + `\n\nVideo URL: ${testVideoUrl}`;

const contents = [{
    role: 'user', parts: [
        { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
        { text: realPrompt }
    ]
}];

async function test(name, maxTokens, thinkingBudget) {
    const config = {
        systemInstruction: productionSysInstr,
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        responseSchema: VIDEO_RESPONSE_SCHEMA_FIXED,
        mediaResolution: 'MEDIA_RESOLUTION_LOW',
        httpOptions: { timeout: 300000 }
    };
    if (thinkingBudget !== undefined) {
        config.thinkingConfig = { thinkingBudget };
    }

    try {
        const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config });
        let text = '';
        let thoughtTokens = 0;
        for await (const chunk of stream) {
            text += chunk.text || '';
            if (chunk.usageMetadata?.thoughtsTokenCount) thoughtTokens = chunk.usageMetadata.thoughtsTokenCount;
        }

        let jsonValid = false;
        try { JSON.parse(text); jsonValid = true; } catch (_) { }
        const status = jsonValid ? '✅ VALID JSON' : '⚠️  INVALID JSON (truncated)';
        console.log(`${status} | ${name} | ${text.length} chars | thoughtTokens: ${thoughtTokens}`);
        return jsonValid;
    } catch (e) {
        let errMsg = e.message;
        try { const p = JSON.parse(e.message); errMsg = `${p.error?.status}: ${p.error?.message?.substring(0, 100)}`; } catch (_) { }
        console.error(`❌ FAILED | ${name} | ${errMsg}`);
        return false;
    }
}

// Test various configurations
console.log('Testing to find configuration that returns complete valid JSON...\n');
await test('maxTokens=16000, thinkingBudget=0', 16000, 0);
await test('maxTokens=32768, thinkingBudget=0', 32768, 0);
await test('maxTokens=63536, thinkingBudget=0', 63536, 0);
await test('maxTokens=32768, no thinking config', 32768, undefined);

console.log('\nDone!');
