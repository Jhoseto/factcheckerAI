/**
 * Final bisect: Test with EXACT same systemInstruction as production server
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
        factualClaims: { type: 'array', maxItems: 5, items: { type: 'object', properties: { claim: { type: 'string' }, verdict: { type: 'string' } }, required: ['claim', 'verdict'] } }
    }
};

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const simplePrompt = 'Analyze this video. Return summary and overallAssessment.';

// EXACT production system instruction from generate-stream endpoint
// (as constructed for standard mode in gemini.js lines 595-608)
const productionSystemInstruction = `You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.

Output language: you must write the entire analysis and all text only in Bulgarian.

CRITICAL — Your entire response MUST be exactly one valid JSON object. Start with { and end with }. No markdown (no \`\`\`), no text before or after. Inside string values: escape double quotes as \\", and escape newlines as \\n. Never truncate: always output the full JSON and close every bracket. Keep ALL schema fields populated (summary, overallAssessment, detailedMetrics, factualClaims, manipulationTechniques, etc.); only shorten long text strings if needed to avoid truncation. Always close all brackets and quotes.`;

const stdConfig = {
    systemInstruction: productionSystemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 300000 }
};

console.log('System instruction length:', productionSystemInstruction.length);

async function testPrompt(name, promptText, config) {
    const contents = [{
        role: 'user', parts: [
            { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
            { text: promptText }
        ]
    }];
    try {
        const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config });
        let text = '';
        for await (const chunk of stream) text += chunk.text || '';
        console.log(`✅ ${name}: OK (${text.length} chars)`);
        return true;
    } catch (e) {
        let errMsg = e.message;
        try { const p = JSON.parse(e.message); errMsg = `status=${p.error?.code}: ${p.error?.message}`; } catch (_) { }
        console.error(`❌ ${name}: HTTP ${e.status} - ${errMsg.substring(0, 400)}`);
        return false;
    }
}

// Test 1: production systemInstruction + simple prompt
await testPrompt('1. Production sysInstr + simple prompt', simplePrompt, stdConfig);

// Test 2: production systemInstruction + full bg prompt (from test_production_like.mjs)
const fullBgPrompt = `Ти си елитен фактчекър, разследващ журналист и медиен аналитик с над 20 години опит. Твоята задача е да направиш ПРОФЕСИОНАЛЕН, КРИТИЧЕН и ОБЕКТИВЕН анализ на видео, който да разкрие всички скрити гледни точки, манипулации и факти. Днешната дата е ${new Date().toLocaleString('bg-BG', { dateStyle: 'full' })}.

ТВОЯТА МИСИЯ: Разкрий истината. Намери всички манипулации. Провери всяко твърдение.

КРИТИЧНО ВАЖНО ЗА ИЗВЛЕЧВАНЕ НА ДАННИ (СТАНДАРТЕН РЕЖИМ):
1. Извлечи ВСИЧКИ важни твърдения от видеото - стреми се към поне 5-10 конкретни твърдения
2. Извлечи значими цитати - поне 5-10 директни цитата от участниците
3. Идентифицирай манипулативни техники - поне 3-5 конкретни техники с примери от видеото
4. Използвай САМО реални данни от видеото - НЕ измисляй факти

ВАЖНО: Всички текстове трябва да са на БЪЛГАРСКИ език. Само JSON enum стойностите остават на английски.

Върни резултата като JSON в следния формат:
{
  "summary": "Детайлно резюме на български (минимум 4-5 изречения)",
  "overallAssessment": "ACCURATE" | "MOSTLY_ACCURATE" | "MIXED" | "MISLEADING" | "FALSE",
  "factualClaims": [
    {
      "claim": "ПЪЛНОТО твърдение като е изказано",
      "verdict": "TRUE" | "MOSTLY_TRUE" | "MIXED" | "MOSTLY_FALSE" | "FALSE" | "UNVERIFIABLE",
      "evidence": "Детайлно доказателство или опровержение",
      "sources": ["URL на надежден източник"],
      "confidence": 0.0,
      "speaker": "РЕАЛНОТО име на говорителя",
      "timestamp": "Точен timestamp от видеото",
      "context": "Пълен контекст около твърдението",
      "logicalAnalysis": "Детайлен логически анализ",
      "factualVerification": "Как се проверява срещу реални източници",
      "comparison": "Сравнение с други източници"
    }
  ],
  "biasIndicators": {
    "politicalBias": "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "UNCLEAR",
    "emotionalLanguage": "Примери на емоционално зареден език",
    "selectiveReporting": "Доказателства за cherry-picking"
  },
  "manipulationTechniques": [
    {
      "technique": "Име на техниката",
      "description": "Детайлно описание",
      "timestamp": "Точен timestamp",
      "severity": 0.0,
      "example": "ПЪЛЕН цитат/пример",
      "speaker": "Реалното им",
      "impact": "Въздействието",
      "counterArgument": "Как може да се противодейства"
    }
  ],
  "detailedMetrics": {
    "factualAccuracy": 0.0,
    "logicalSoundness": 0.0,
    "emotionalBias": 0.0,
    "propagandaScore": 0.0,
    "sourceReliability": 0.0,
    "subjectivityScore": 0.0,
    "objectivityScore": 0.0,
    "biasIntensity": 0.0,
    "narrativeConsistencyScore": 0.0,
    "semanticDensity": 0.0,
    "contextualStability": 0.0
  },
  "geopoliticalContext": "Детайлен анализ",
  "historicalParallel": "Исторически паралели",
  "psychoLinguisticAnalysis": "Психолингвистичен анализ",
  "strategicIntent": "Анализ",
  "narrativeArchitecture": "Анализ",
  "technicalForensics": "Техническа експертиза",
  "socialImpactPrediction": "Прогноза",
  "recommendations": "Препоръки",
  "finalInvestigativeReport": "ФИНАЛЕН РАЗСЛЕДВАЩ ДОКЛАД"
}`;

await testPrompt('2. Production sysInstr + full BG prompt with inline schema', fullBgPrompt, stdConfig);

// Test 3: Now test without responseSchema but with same prompts
const configNoSchema = {
    ...stdConfig,
    responseMimeType: undefined,
    responseSchema: undefined,
};

await testPrompt('3. No responseSchema + full BG prompt', fullBgPrompt, configNoSchema);

console.log('\nDone!');
