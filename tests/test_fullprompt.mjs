/**
 * Test with FULL production prompt to see if it + video URL = 400
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

const testVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// The SAME full production prompt as in standardAnalysisPrompt.ts
const currentDate = new Date().toLocaleString('bg-BG', { dateStyle: 'full' });
const fullPrompt = `Ти си елитен фактчекър, разследващ журналист и медиен аналитик с над 20 години опит. Твоята задача е да направиш ПРОФЕСИОНАЛЕН, КРИТИЧЕН и ОБЕКТИВЕН анализ на видео, който да разкрие всички скрити гледни точки, манипулации и факти. Днешната дата е ${currentDate}.

ТВОЯТА МИСИЯ: Разкрий истината. Намери всички манипулации. Провери всяко твърдение. Дай на потребителя ИЗКЛЮЧИТЕЛНА информация която да му помогне да разбере реалността.

КРИТИЧНО ВАЖНО ЗА ИЗВЛЕЧВАНЕ НА ДАННИ (СТАНДАРТЕН РЕЖИМ):
1. **ВРЕМЕВ КОНТЕКСТ** (видео): Определи от КОЕ ВРЕМЕ е съдържанието. Верифицирай твърденията с информация от ТОГАВА. Направи паралели спрямо днес.
2. Извлечи ВСИЧКИ важни твърдения от видеото - стреми се към поне 5-10 конкретни твърдения
3. Извлечи значими цитати - поне 5-10 директни цитата от участниците
4. Идентифицирай манипулативни техники - поне 3-5 конкретни техники с примери от видеото
5. Използвай САМО реални данни от видеото - НЕ измисляй факти
6. За дълги видеа (над 30 минути): стреми се към 15+ твърдения и 8+ манипулации
7. За видеа с гости: идентифицирай твърденията на всеки участник поотделно с реалните им имена
8. Всяко твърдение трябва да се проверява срещу надеждни източници
9. Използвай логически анализ, фактически проверки и контекстуално разбиране

ВАЖНО: Всички текстове трябва да са на БЪЛГАРСКИ език. Само JSON enum стойностите остават на английски.

Извърши следните анализи:

1. ФАКТИЧЕСКА ТОЧНОСТ:
- Определи времевия период на твърденията — верифицирай с информация от ТОГАВА
- Провери всяко твърдение срещу надеждни източници
- Оцени достоверността на всеки факт (0.0-1.0)
- Идентифицирай неверни или подвеждащи твърдения

2. ЛОГИЧЕСКА СТРОЙНОСТ:
- Провери за логически заблуди
- Оцени качеството на аргументацията (0.0-1.0)

3. ЕМОЦИОНАЛНА ПРИСТРАСТНОСТ:
- Анализирай емоционалния тон (0.0 = неутрален, 1.0 = силно емоционален)

4. ПРОПАГАНДЕН ИНДЕКС:
- Оцени дали съдържанието е пропагандно (0.0-1.0)

5. НАДЕЖДНОСТ НА ИЗТОЧНИКА:
- Оцени надеждността на автора/канала (0.0-1.0)

6. СУБЕКТИВНОСТ/ОБЕКТИВНОСТ:
- Оцени нивото на субективност (0.0 = обективен, 1.0 = субективен)

7. ГЕОПОЛИТИЧЕСКИ КОНТЕКСТ - детайлен анализ
8. ИСТОРИЧЕСКА ПРЕЦЕДЕНТНОСТ - исторически паралели
9. ПСИХО-ЛИНГВИСТИЧЕН АНАЛИЗ
10. СТРАТЕГИЧЕСКО НАМЕРЕНИЕ
11. НАРАТИВНА АРХИТЕКТУРА
12. ТЕХНИЧЕСКА ЕКСПЕРТИЗА (FORENSICS)
13. СОЦИАЛНО ВЪЗДЕЙСТВИЕ

Върни резултата като JSON. Video URL: ${testVideoUrl}`;

const systemInstruction = `You are an ELITE fact-checker with 20+ years of experience. Output all text in BULGARIAN. Return valid JSON only.

Output language: you must write the entire analysis and all text only in Bulgarian.

CRITICAL — Your entire response MUST be exactly one valid JSON object. Start with { and end with }. No markdown, no text before or after.`;

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
        { text: fullPrompt }
    ]
}];

console.log(`Full prompt length: ${fullPrompt.length} chars`);
console.log(`System instruction length: ${systemInstruction.length} chars`);
console.log('Starting test...');

try {
    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: stdConfig
    });
    let text = '';
    for await (const chunk of stream) {
        text += chunk.text || '';
        if (chunk.usageMetadata) {
            console.log('Usage:', JSON.stringify(chunk.usageMetadata));
        }
    }
    console.log(`✅ SUCCESS: got ${text.length} chars`);
    console.log('First 200 chars:', text.substring(0, 200));
} catch (e) {
    console.error(`❌ FAILED HTTP ${e.status}: ${e.message}`);
    // Parse the error message to get Gemini's explanation
    try {
        const parsed = JSON.parse(e.message);
        console.error('Gemini error message:', JSON.stringify(parsed, null, 2));
    } catch (_) {
        console.error('Raw error message:', e.message);
    }
    const errJson = JSON.stringify(e, Object.getOwnPropertyNames(e));
    console.error('Full error object:', errJson.substring(0, 5000));
}
