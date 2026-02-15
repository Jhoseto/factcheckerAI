import { VideoAnalysis, APIUsage, AnalysisResponse, CostEstimate, YouTubeVideoMetadata, TranscriptionLine } from '../types';
import { handleApiError } from './errorHandler';
import { auth } from './firebase';
import { calculateCost as calculateCostFromPricing, calculateCostInPoints } from './pricing';
import { getStandardAnalysisPrompt } from './prompts/standardAnalysisPrompt';
import { getDeepAnalysisPrompt } from './prompts/deepAnalysisPrompt';

/**
 * Helper function to call our server-side Gemini API
 */
const callGeminiAPI = async (payload: {
  model: string;
  prompt: string;
  systemInstruction?: string;
  videoUrl?: string;
  isBatch?: boolean;
}): Promise<{ text: string; usageMetadata: any; points?: { deducted: number; costInPoints: number; remaining?: number } }> => {

  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be logged in to perform analysis');
  }

  const token = await user.getIdToken();

  const response = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    // Create error object with status code for proper error handling
    const error = new Error(errorData.error || 'Failed to generate content');
    (error as any).status = response.status;
    (error as any).statusCode = response.status;
    (error as any).code = errorData.code;

    // Pass strictly typed error data if available
    if (errorData.currentBalance !== undefined) {
      (error as any).currentBalance = errorData.currentBalance;
    }

    throw error;
  }

  return response.json();
};

/**
 * Get the appropriate prompt based on model
 * gemini-2.5-flash = standard analysis
 * gemini-3-flash-preview = deep analysis
 */
const getAnalysisPrompt = (url: string, type: 'video' | 'news', model: string, transcript?: string): string => {
  // Deep mode uses gemini-3-flash-preview with more detailed requirements
  if (model === 'gemini-3-flash-preview') {
    return getDeepAnalysisPrompt(url, type, transcript);
  }
  // Standard mode uses gemini-2.5-flash with moderate detail
  return getStandardAnalysisPrompt(url, type, transcript);
};

/**
 * Clean JSON response from markdown code blocks and fix common issues
 * Handles cases where Gemini adds text before/after JSON like "Here is a JSON response: {...}"
 */
const cleanJsonResponse = (text: string): string => {
  let cleaned = text.trim();

  // First, try to extract JSON from markdown code blocks
  const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  } else {
    // Try generic code block
    const codeBlockMatch = cleaned.match(/```[a-z]*\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }
  }

  // Remove any remaining ``` markers
  cleaned = cleaned.replace(/```/g, '').trim();

  // If text doesn't start with { or [, aggressively search for JSON object/array
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    // Find the first occurrence of { or [
    const jsonStart = cleaned.search(/[{\[]/);
    if (jsonStart !== -1) {
      const startChar = cleaned[jsonStart];
      const endChar = startChar === '{' ? '}' : ']';
      let depth = 0;
      let jsonEnd = -1;
      let inString = false;
      let escapeNext = false;

      // Properly track depth considering strings (which can contain { } [ ])
      for (let i = jsonStart; i < cleaned.length; i++) {
        const char = cleaned[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === startChar) depth++;
          else if (char === endChar) {
            depth--;
            if (depth === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
      }

      if (jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      } else {
        // If we couldn't find the end, try to find the last } or ]
        const lastBrace = cleaned.lastIndexOf('}');
        const lastBracket = cleaned.lastIndexOf(']');
        const lastEnd = Math.max(lastBrace, lastBracket);
        if (lastEnd > jsonStart) {
          cleaned = cleaned.substring(jsonStart, lastEnd + 1);
        }
      }
    } else {
      // No { or [ found, return empty string to trigger error
      return '';
    }
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Remove single-line comments (// ...) - be careful not to remove URLs
  cleaned = cleaned.replace(/([^:])\/\/[^\n]*/g, '$1');

  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove any trailing text after the JSON (common when Gemini adds explanations)
  // Find the last } or ] and remove everything after it
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const lastJsonChar = Math.max(lastBrace, lastBracket);
  if (lastJsonChar !== -1 && lastJsonChar < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastJsonChar + 1);
  }

  return cleaned.trim();
};

/**
 * Transform Gemini API response to VideoAnalysis format
 */
const transformGeminiResponse = (
  rawResponse: any,
  model: string,
  videoTitle?: string,
  videoAuthor?: string,
  fullMetadata?: YouTubeVideoMetadata,
  transcription?: TranscriptionLine[]
): VideoAnalysis => {
  const mapVerdict = (verdict: string): 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо' => {
    const map: Record<string, 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо'> = {
      'TRUE': 'вярно', 'MOSTLY_TRUE': 'предимно вярно', 'MIXED': 'частично вярно',
      'MOSTLY_FALSE': 'подвеждащо', 'FALSE': 'невярно', 'UNVERIFIABLE': 'непроверимо'
    };
    return map[verdict?.toUpperCase()] || 'непроверимо';
  };

  const mapAssessment = (assessment: string): string => {
    const map: Record<string, string> = {
      'ACCURATE': 'ДОСТОВЕРНО', 'MOSTLY_ACCURATE': 'ПРЕДИМНО ДОСТОВЕРНО',
      'MIXED': 'СМЕСЕНО', 'MISLEADING': 'ПОДВЕЖДАЩО', 'FALSE': 'НЕВЯРНО'
    };
    return map[assessment?.toUpperCase()] || 'НЕОПРЕДЕЛЕНО';
  };

  // Safe variable initialization
  const claims = Array.isArray(rawResponse?.factualClaims) ? rawResponse.factualClaims : [];
  const quotes = Array.isArray(rawResponse?.quotes) ? rawResponse.quotes : [];
  const manipulations = Array.isArray(rawResponse?.manipulationTechniques) ? rawResponse.manipulationTechniques : [];

  let allClaims: any[] = [...claims];
  try {
    quotes.forEach((q: any) => {
      if (q && q.quote && !allClaims.find(c => c && c.claim === q.quote)) {
        allClaims.push({
          claim: q.quote,
          verdict: 'UNVERIFIABLE',
          evidence: q.context || 'Цитат от предаването',
          sources: [],
          confidence: 0.5,
          speaker: q.speaker,
          timestamp: q.timestamp
        });
      }
    });
  } catch (e) {
    console.error('[Transform] Error merging quotes:', e);
  }

  const trueClaimsCount = claims.filter((c: any) => c && ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict?.toUpperCase())).length;
  const credibilityIndex = claims.length > 0 ? (trueClaimsCount / claims.length) : 0.5;
  const manipulationIndex = Math.min(manipulations.length * 0.15, 1);

  const transformedClaims = allClaims.map((c: any) => ({
    quote: c.claim || '',
    formulation: c.claim || '',
    category: 'Факт',
    weight: 'средна' as 'ниска' | 'средна' | 'висока',
    confidence: c.confidence || (c.verdict === 'TRUE' ? 0.9 : c.verdict === 'FALSE' ? 0.1 : 0.5),
    veracity: mapVerdict(c.verdict) as 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо',
    explanation: (c.logicalAnalysis || '') + (c.factualVerification ? '\n\nФактическа проверка: ' + c.factualVerification : '') + (c.comparison ? '\n\nСравнение: ' + c.comparison : '') || c.evidence || 'Няма налична информация',
    missingContext: (c.context || '') + (Array.isArray(c.sources) && c.sources.length > 0 ? '\n\nИзточници: ' + c.sources.join(', ') : '') || ''
  }));

  const transformedManipulations = manipulations.map((m: any, idx: number) => ({
    technique: m.technique || 'Неизвестна',
    timestamp: m.timestamp || '00:00',
    logic: (m.description || '') + (m.example ? '\n\nПример: ' + m.example : '') + (m.impact ? '\n\nВъздействие: ' + m.impact : ''),
    effect: m.impact || 'Въздействие върху аудиторията',
    severity: m.severity || (0.5 + (idx * 0.1)),
    counterArgument: m.counterArgument || 'Проверка на първоизточници.'
  }));

  const timeline = allClaims.length > 0
    ? allClaims.map((c: any, idx: number) => ({
      time: `${String(Math.floor(idx * 5)).padStart(2, '0')}:${String((idx * 30) % 60).padStart(2, '0')}`,
      reliability: c && ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict) ? 0.9 : 0.3,
      event: c?.claim?.substring(0, 50) || 'Твърдение'
    }))
    : [{ time: '00:00', reliability: 0.5, event: 'Начало' }];

  const metadataSection = fullMetadata
    ? `\n\n**Метаданни на видеоклипа:**\n- **Заглавие:** ${fullMetadata.title}\n- **Автор:** ${fullMetadata.author}\n- **Продължителност:** ${fullMetadata.durationFormatted}\n- **ID:** ${fullMetadata.videoId}`
    : (videoTitle ? `\n\n**Метаданни:**\n- **Заглавие:** ${videoTitle}\n- **Автор:** ${videoAuthor || 'Неизвестен'}` : '');

  const constructedReport = (rawResponse?.finalInvestigativeReport) || `
# ФИНАЛЕН РАЗСЛЕДВАЩ ДОКЛАД

## Изпълнително резюме
${rawResponse?.summary || 'Няма налично резюме.'}

## Ключови констатации и фактически проверки
${(allClaims || []).slice(0, 10).map((c: any) => `
### "${c.claim || c.quote}"${c.speaker ? ` - ${c.speaker}` : ''}${c.timestamp ? ` [${c.timestamp}]` : ''}

**Вердикт:** ${c.verdict || 'UNVERIFIABLE'}

**Доказателства и проверка:**
${c.evidence || c.factualVerification || 'Няма налична информация'}

${c.comparison ? `**Сравнение с други източници:**\n${c.comparison}\n` : ''}
${c.logicalAnalysis ? `**Логически анализ:**\n${c.logicalAnalysis}\n` : ''}
${Array.isArray(c.sources) && c.sources.length > 0 ? `**Източници:** ${c.sources.join(', ')}\n` : ''}
`).join('\n---\n')}

${manipulations.length > 0 ? `
## Разкрити манипулативни техники

${manipulations.map((m: any) => `
### ${m.technique}${m.speaker ? ` (използвана от ${m.speaker})` : ''} [${m.timestamp || '00:00'}]

${m.description || ''}

${m.example ? `**Конкретен пример:**\n"${m.example}"\n` : ''}
${m.impact ? `**Въздействие върху аудиторията:**\n${m.impact}\n` : ''}
${m.counterArgument ? `**Как да се защитим:**\n${m.counterArgument}\n` : ''}
`).join('\n---\n')}
` : ''}

## Геополитически контекст и исторически паралели
${rawResponse?.geopoliticalContext || 'Неприложимо'}

${rawResponse?.historicalParallel ? `\n### Исторически прецеденти\n${rawResponse.historicalParallel}\n` : ''}

## Психолингвистичен анализ
${rawResponse?.psychoLinguisticAnalysis || 'Няма данни'}

## Стратегическо намерение
${rawResponse?.strategicIntent || 'Няма данни'}

## Наративна архитектура
${rawResponse?.narrativeArchitecture || 'Няма данни'}

## Техническа експертиза
${rawResponse?.technicalForensics || 'Няма данни'}

## Социално въздействие
${rawResponse?.socialImpactPrediction || 'Няма данни'}

## Заключение и препоръки
${rawResponse?.recommendations || 'Препоръчва се критично осмисляне на представената информация.'}

${metadataSection}
`.trim();

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    videoTitle: videoTitle || rawResponse?.videoTitle || 'Анализирано съдържание',
    videoAuthor: videoAuthor || rawResponse?.videoAuthor || 'Неизвестен автор',
    transcription: transcription || [
      {
        timestamp: '00:00',
        speaker: 'Система',
        text: 'Транскрипцията не беше налична за това видео.'
      }
    ],
    segments: [], claims: transformedClaims, manipulations: transformedManipulations,
    fallacies: [], timeline: timeline,
    summary: {
      credibilityIndex: credibilityIndex,
      manipulationIndex: manipulationIndex,
      unverifiablePercent: 0.1,
      finalClassification: mapAssessment(rawResponse?.overallAssessment),
      overallSummary: (rawResponse?.summary || 'Анализът е завършен.') + metadataSection,
      totalDuration: fullMetadata?.durationFormatted || 'N/A',
      detailedStats: rawResponse?.detailedMetrics ? {
        factualAccuracy: rawResponse.detailedMetrics.factualAccuracy ?? credibilityIndex,
        logicalSoundness: rawResponse.detailedMetrics.logicalSoundness ?? (1 - manipulationIndex),
        emotionalBias: rawResponse.detailedMetrics.emotionalBias ?? 0.5,
        propagandaScore: rawResponse.detailedMetrics.propagandaScore ?? manipulationIndex,
        sourceReliability: rawResponse.detailedMetrics.sourceReliability ?? 0.5,
        subjectivityScore: rawResponse.detailedMetrics.subjectivityScore ?? 0.5,
        objectivityScore: rawResponse.detailedMetrics.objectivityScore ?? 0.5,
        biasIntensity: rawResponse.detailedMetrics.biasIntensity ?? 0.5,
        narrativeConsistencyScore: rawResponse.detailedMetrics.narrativeConsistencyScore ?? 0.7,
        semanticDensity: rawResponse.detailedMetrics.semanticDensity ?? 0.6,
        contextualStability: rawResponse.detailedMetrics.contextualStability ?? 0.6
      } : {
        factualAccuracy: credibilityIndex,
        logicalSoundness: 1 - manipulationIndex,
        emotionalBias: 0.5,
        propagandaScore: manipulationIndex,
        sourceReliability: 0.5,
        subjectivityScore: 0.5,
        objectivityScore: 0.5,
        biasIntensity: 0.5,
        narrativeConsistencyScore: 0.7,
        semanticDensity: 0.6,
        contextualStability: 0.6
      },
      finalInvestigativeReport: rawResponse?.finalInvestigativeReport || constructedReport,
      geopoliticalContext: rawResponse?.geopoliticalContext || 'Неприложимо',
      historicalParallel: rawResponse?.historicalParallel || 'Няма данни',
      psychoLinguisticAnalysis: rawResponse?.psychoLinguisticAnalysis || 'Няма данни',
      strategicIntent: rawResponse?.strategicIntent || 'Няма данни',
      narrativeArchitecture: rawResponse?.narrativeArchitecture || 'Няма данни',
      technicalForensics: rawResponse?.technicalForensics || 'Няма данни',
      socialImpactPrediction: rawResponse?.socialImpactPrediction || rawResponse?.recommendations || 'Няма данни',
      sourceNetworkAnalysis: 'Няма данни',
      dataPointsProcessed: (claims?.length || 0) * 10
    },
    pointsCost: 0, // Will be set by caller
    analysisMode: model.includes('2.5') ? 'standard' : 'deep',

    // Multimodal analysis fields (deep analysis only)
    visualAnalysis: rawResponse?.visualAnalysis,
    bodyLanguageAnalysis: rawResponse?.bodyLanguageAnalysis,
    vocalAnalysis: rawResponse?.vocalAnalysis,
    deceptionAnalysis: rawResponse?.deceptionAnalysis,
    humorAnalysis: rawResponse?.humorAnalysis,
    psychologicalProfile: rawResponse?.psychologicalProfile,
    culturalSymbolicAnalysis: rawResponse?.culturalSymbolicAnalysis
  };
};

export const analyzeYouTubeStandard = async (url: string, videoMetadata?: YouTubeVideoMetadata, model: string = 'gemini-3-flash-preview'): Promise<AnalysisResponse> => {
  try {
    // Strategy: Single API call - Gemini analyzes video AND extracts transcript in one go
    // No separate transcript extraction - everything happens in one request

    const prompt = getAnalysisPrompt(url, 'video', model) + (videoMetadata ? `\n\nVideo Context: Title: "${videoMetadata.title}", Author: "${videoMetadata.author}", Duration: ${videoMetadata.durationFormatted}.` : '');

    // ALWAYS send videoUrl - Gemini will process video and return everything including transcript
    const payload = {
      model: model,
      prompt: prompt,
      systemInstruction: "You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Extract FULL transcription from the video with timestamps. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.",
      videoUrl: url // ← KEY: Always send video for single API call
    };

    // 3. Call Gemini API (single call does everything)
    const data = await callGeminiAPI(payload);

    // Validate response before parsing
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Gemini API не върна валиден отговор');
    }

    const cleanedText = cleanJsonResponse(data.text);
    if (!cleanedText) {
      throw new Error('Не може да се извлече JSON от отговора на Gemini API');
    }

    let rawResponse: any;
    try {
      rawResponse = JSON.parse(cleanedText);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      console.error('Cleaned text (first 500 chars):', cleanedText.substring(0, 500));
      throw new Error('Gemini API върна невалиден JSON формат. Моля, опитайте отново.');
    }

    // Extract transcription from Gemini's response
    const transcription = rawResponse.transcription && Array.isArray(rawResponse.transcription) && rawResponse.transcription.length > 0
      ? rawResponse.transcription
      : [{
        timestamp: '00:00',
        speaker: 'Система',
        text: 'Транскрипцията не беше налична за това видео.'
      }];

    const parsed = transformGeminiResponse(rawResponse, model, videoMetadata?.title, videoMetadata?.author, videoMetadata, transcription);

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCostFromPricing(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      ),
      pointsCost: data.points?.costInPoints || calculateCostInPoints(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      )
    };

    parsed.pointsCost = usage.pointsCost;
    return { analysis: parsed, usage };
  } catch (e: any) {
    const appError = handleApiError(e);
    throw appError;
  }
};

/**
 * Batch analysis - uses batch pricing (50% discount) but same analysis as standard
 * This mode is slower but cheaper - suitable for non-urgent analyses
 */
export const analyzeYouTubeBatch = async (url: string): Promise<AnalysisResponse> => {
  try {
    // Single API call - same as standard, just with batch flag
    const prompt = getAnalysisPrompt(url, 'video', 'gemini-3-flash-preview');

    const payload = {
      model: 'gemini-3-flash-preview',
      prompt: prompt,
      systemInstruction: "You are an ELITE fact-checker. Extract FULL transcription from video with timestamps. Output valid JSON only in Bulgarian.",
      videoUrl: url, // Always send video
      isBatch: true
    };

    // 3. Call Gemini API
    const data = await callGeminiAPI(payload);

    // Validate response before parsing
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Gemini API не върна валиден отговор');
    }

    const cleanedText = cleanJsonResponse(data.text);
    if (!cleanedText) {
      throw new Error('Не може да се извлече JSON от отговора на Gemini API');
    }

    let rawResponse: any;
    try {
      rawResponse = JSON.parse(cleanedText);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      throw new Error('Gemini API върна невалиден JSON формат.');
    }

    // Extract transcription from response
    const transcription = rawResponse.transcription && Array.isArray(rawResponse.transcription) && rawResponse.transcription.length > 0
      ? rawResponse.transcription
      : [{
        timestamp: '00:00',
        speaker: 'Система',
        text: 'Транскрипцията не беше налична.'
      }];

    const parsed = transformGeminiResponse(rawResponse, 'gemini-3-flash-preview', undefined, undefined, undefined, transcription);

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCostFromPricing(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        true
      ),
      pointsCost: data.points?.costInPoints || calculateCostInPoints(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        true
      )
    };

    parsed.pointsCost = usage.pointsCost;
    return { analysis: parsed, usage };
  } catch (e: any) {
    const appError = handleApiError(e);
    throw appError;
  }
};

/**
 * News article analysis
 */
export const analyzeNewsLink = async (url: string): Promise<AnalysisResponse> => {
  try {
    const data = await callGeminiAPI({
      model: 'gemini-3-flash-preview',
      prompt: getAnalysisPrompt(url, 'news', 'gemini-3-flash-preview') + `\n\nNews URL: ${url}`,
      systemInstruction: 'You are a professional fact-checker. You MUST answer in Bulgarian language only. Translate any analysis to Bulgarian.'
    });

    // Validate response before parsing
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Gemini API не върна валиден отговор');
    }

    const cleanedText = cleanJsonResponse(data.text);

    if (!cleanedText) {
      throw new Error('Не може да се извлече JSON от отговора на Gemini API');
    }

    let rawResponse: any;
    try {
      rawResponse = JSON.parse(cleanedText);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      console.error('Cleaned text (first 500 chars):', cleanedText.substring(0, 500));
      throw new Error('Gemini API върна невалиден JSON формат. Моля, опитайте отново.');
    }
    const parsed = transformGeminiResponse(rawResponse, 'gemini-3-flash-preview');

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCostFromPricing(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      ),
      pointsCost: data.points?.costInPoints || calculateCostInPoints(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      )
    };

    parsed.pointsCost = usage.pointsCost;
    return { analysis: parsed, usage };
  } catch (e: any) {
    const appError = handleApiError(e);
    throw appError;
  }
};