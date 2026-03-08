import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash';

// Извличане на промпта като стринг от файла
let deepPromptStr = fs.readFileSync('services/prompts/deepAnalysisPrompt.ts', 'utf8');
const promptMatch = deepPromptStr.match(/return `([\s\S]+?)`;/);
const deepPrompt = promptMatch ? promptMatch[1].replace('${type === \'video\' ? \' (видео)\': \'\'}', ' (видео)').replace('${currentDate}', new Date().toLocaleString()) : '';

const POINT_DETAILS_ITEM = {
    type: Type.OBJECT,
    properties: {
        point: { type: Type.STRING },
        details: { type: Type.STRING }
    },
    required: ['point', 'details']
};

const MOCK_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING },
        overallAssessment: { type: Type.STRING },
        bodyLanguageAnalysis: { type: Type.ARRAY, items: POINT_DETAILS_ITEM },
        deceptionAnalysis: { type: Type.ARRAY, items: POINT_DETAILS_ITEM },
        humorAnalysis: { type: Type.ARRAY, items: POINT_DETAILS_ITEM },
        factualClaims: { type: Type.ARRAY, items: { type: Type.OBJECT } },
        manipulationTechniques: { type: Type.ARRAY, items: { type: Type.OBJECT } },
        finalInvestigativeReport: { type: Type.STRING }
    }
};

async function testDeepMode() {
    console.log('Testing Deep Mode Arrays Generation...');

    const systemInstruction = "You are an ELITE fact-checker. Do NOT generate transcription - return empty array for 'transcription'. Output ALL text in BULGARIAN.";

    console.log('--- Phase 1: Search & Grounding ---');
    const toolConfig = {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 63536,
        tools: [{ googleSearch: {} }]
    };

    const p1Response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: deepPrompt + '\n\nVideo title: Testing Deep Analysis' }] }],
        config: toolConfig
    });

    let rawText = '';
    if (typeof p1Response.text === 'string') rawText = p1Response.text;
    else if (p1Response.candidates?.[0]?.content?.parts) {
        rawText = p1Response.candidates[0].content.parts.map(p => p.text).join('');
    }
    console.log('Phase 1 Text Length:', rawText.length);

    console.log('\n--- Phase 2: JSON Generation ---');
    const jsonPromptContent = 'Return the complete analysis as valid JSON using the exact schema provided. CRITICAL: Do NOT just extract information from the conversation above. You must analyze the VIDEO completely fresh and use the search results above ONLY as supplementary factual context. Analyze the video for EVERY SINGLE array requested: visualAnalysis, bodyLanguageAnalysis, vocalAnalysis, deceptionAnalysis, humorAnalysis, psychologicalProfile, culturalSymbolicAnalysis, factualClaims and manipulationTechniques. Create at least 3 detailed items for every single multimodal array, explaining the speaker\'s tone, gestures, and psychological intent. Populate finalInvestigativeReport with a full investigative article (at least 10 paragraphs). Ensure complete valid JSON. Never leave arrays empty.';

    const finalConfig = {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 65536,
        responseMimeType: 'application/json',
        responseSchema: MOCK_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 }
    };

    const p2Response = await ai.models.generateContent({
        model,
        contents: [
            { role: 'user', parts: [{ text: deepPrompt + '\n\nVideo URL: https://www.youtube.com/watch?v=M7FIvfx5J10\nVideo title: Testing Deep Analysis' }] },
            { role: 'model', parts: p1Response.candidates[0].content.parts },
            { role: 'user', parts: [{ text: jsonPromptContent }] }
        ],
        config: finalConfig
    });

    let jsonText = p2Response.text || p2Response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    fs.writeFileSync('phase2_raw.json', jsonText);
    console.log('Saved raw JSON to phase2_raw.json, length:', jsonText.length);

    try {
        const parsed = JSON.parse(jsonText);
        console.log('\n========= RESULTS =========');
        console.log('- Factual Claims:', parsed.factualClaims?.length);
        console.log('- Manipulation Techniques:', parsed.manipulationTechniques?.length);
        console.log('- Body Language:', parsed.bodyLanguageAnalysis?.length);
        console.log('- Deception:', parsed.deceptionAnalysis?.length);
        console.log('- Humor:', parsed.humorAnalysis?.length);
        if (!parsed.bodyLanguageAnalysis?.length) {
            console.log('\nModel returned empty arrays. Let\'s check the full output:');
            console.log(jsonText.substring(0, 1500));
        }
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
    }
}

testDeepMode().catch(console.error);
