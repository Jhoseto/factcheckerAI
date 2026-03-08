/**
 * Find exact cause of 400: test with prompt that contains JSON schema inline
 * (like the production prompt does)
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
const systemInstruction = 'You are a fact-checker. Return valid JSON only. Output language: Bulgarian.';

const stdConfig = {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 63536,
    responseMimeType: 'application/json',
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    httpOptions: { timeout: 300000 }
};

async function testPrompt(name, promptText) {
    const contents = [{
        role: 'user', parts: [
            { fileData: { mimeType: 'video/mp4', fileUri: testVideoUrl } },
            { text: promptText }
        ]
    }];
    try {
        const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config: stdConfig });
        let text = '';
        for await (const chunk of stream) text += chunk.text || '';
        console.log(`✅ ${name}: OK (${text.length} chars)`);
        return true;
    } catch (e) {
        let errMsg = e.message;
        try { errMsg = JSON.stringify(JSON.parse(e.message), null, 2); } catch (_) { }
        console.error(`❌ ${name}: HTTP ${e.status} - ${errMsg.substring(0, 300)}`);
        return false;
    }
}

// Test A: Short prompt without any JSON schema descriptions
await testPrompt('A. Short plain prompt',
    'Analyze this video. Return summary and overallAssessment.');

// Test B: Short prompt WITH inline JSON schema descriptions (like production)
await testPrompt('B. Short prompt WITH inline JSON example',
    `Analyze this video. Върни JSON:
{
  "summary": "...",
  "overallAssessment": "ACCURATE|MIXED",
  "factualClaims": [{"claim": "...", "verdict": "TRUE|FALSE", "confidence": 0.0}]
}`);

// Test C: Long prompt without inline JSON schema (just description)
const longPromptNoSchema = `Ти си елитен фактчекър с над 20 години опит. Анализирай видеото.

Направи следното:
1. Извлечи всички твърдения (поне 5-10)
2. Анализирай манипулации (поне 3-5)
3. Геополитически контекст
4. Историческа прецедентност
5. Психо-лингвистичен анализ
6. Стратегическо намерение
7. Социално въздействие
8. Финален разследващ доклад

Важно: само английски за enum стойностите. Всичко останало на БЪЛГАРСКИ.`;

await testPrompt('C. Long prompt WITHOUT inline JSON schema', longPromptNoSchema);

// Test D: Production prompt (includes inline JSON schema like in standardAnalysisPrompt.ts)
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const productionPrompt = `Ти си елитен фактчекър с над 20 години опит. Днешната дата е ${currentDate}.

КРИТИЧНО ВАЖНО:
1. Извлечи ВСИЧКИ важни твърдения - поне 5-10
2. Идентифицирай манипулативни техники - поне 3-5
3. Използвай САМО реални данни

Върни резултата като JSON в следния формат:
{
  "summary": "Детайлно резюме на български",
  "overallAssessment": "ACCURATE" | "MOSTLY_ACCURATE" | "MIXED" | "MISLEADING" | "FALSE",
  "factualClaims": [
    {
      "claim": "ПЪЛНОТО твърдение",
      "verdict": "TRUE" | "MOSTLY_TRUE" | "MIXED" | "MOSTLY_FALSE" | "FALSE" | "UNVERIFIABLE",
      "evidence": "Детайлно доказателство",
      "sources": ["URL"],
      "confidence": 0.0,
      "speaker": "Реалното име",
      "timestamp": "00:00"
    }
  ],
  "manipulationTechniques": [
    {
      "technique": "Име",
      "description": "Описание",
      "severity": 0.0,
      "example": "Пример",
      "impact": "Въздействие",
      "counterArgument": "Как да се противодейства"
    }
  ],
  "detailedMetrics": {
    "factualAccuracy": 0.0,
    "logicalSoundness": 0.0,
    "emotionalBias": 0.0
  },
  "geopoliticalContext": "Анализ",
  "finalInvestigativeReport": "ФИНАЛЕН ДОКЛАД"
}`;

await testPrompt('D. Production prompt WITH inline JSON schema', productionPrompt);

console.log('\nDone!');
