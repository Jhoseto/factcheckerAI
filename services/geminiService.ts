import { VideoAnalysis, APIUsage, AnalysisResponse, CostEstimate, YouTubeVideoMetadata, TranscriptionLine, AnalysisMode } from '../types';
import { handleApiError } from './errorHandler';
import { auth } from './firebase';
import { getApiLang } from '../i18n';
import { calculateCost as calculateCostFromPricing, calculateCostInPoints } from './pricing';
import { getStandardAnalysisPrompt } from './prompts/standardAnalysisPrompt';
import { getDeepAnalysisPrompt } from './prompts/deepAnalysisPrompt';
import { getReportSynthesisPrompt } from './prompts/reportSynthesisPrompt';
import { getStandardAnalysisPromptEn } from './prompts/standardAnalysisPrompt.en';
import { getDeepAnalysisPromptEn } from './prompts/deepAnalysisPrompt.en';
import { getReportSynthesisPromptEn } from './prompts/reportSynthesisPrompt.en';
import { normalizeYouTubeUrl } from './validation';

/**
 * Helper function to call our server-side Gemini API
 * Uses streaming endpoint for video analysis to avoid undici timeout
 */
const callGeminiAPI = async (payload: {
  model: string;
  prompt: string;
  systemInstruction?: string;
  videoUrl?: string;
  isBatch?: boolean;
  enableGoogleSearch?: boolean;
  mode?: string;
  lang?: string;
}, onProgress?: (status: string) => void): Promise<{ text: string; usageMetadata: any; points?: { deducted: number; costInPoints: number; remaining?: number; newBalance?: number } }> => {

  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be logged in to perform analysis');
  }

  const token = await user.getIdToken();

  // Use streaming endpoint for video analysis (avoids undici timeout)
  if (payload.videoUrl) {
    return callGeminiStreamAPI(payload, token, onProgress);
  }

  // Regular endpoint for non-video requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 900000);

  try {
    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const error = new Error(errorData.error || 'Failed to generate content');
      (error as any).status = response.status;
      (error as any).statusCode = response.status;
      (error as any).code = errorData.code;

      if (errorData.currentBalance !== undefined) {
        (error as any).currentBalance = errorData.currentBalance;
      }

      throw error;
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Анализът отне твърде дълго време (над 15 минути).');
      (timeoutError as any).code = 'TIMEOUT_ERROR';
      throw timeoutError;
    }
    throw error;
  }
};

/**
 * Streaming SSE client for video analysis
 * Avoids Node.js undici headers timeout by using Server-Sent Events
 */
const callGeminiStreamAPI = async (payload: any, token: string, onProgress?: (status: string) => void): Promise<{ text: string; usageMetadata: any; points?: any }> => {
  const response = await fetch('/api/gemini/generate-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    // Try to read error from body
    let errorMsg = `Stream request failed: ${response.status}`;
    try {
      const errBody = await response.text();
      errorMsg = errBody || errorMsg;
    } catch { /* ignore */ }
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response stream available');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: { text: string; usageMetadata: any; points?: any } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    // Split on \n\n or \r\n\r\n
    const eventBlocks = buffer.split(/\r?\n\r?\n/);
    // Last item may be incomplete - keep it in buffer
    buffer = eventBlocks.pop() || '';

    for (const block of eventBlocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) continue;
      if (trimmedBlock.startsWith(':')) continue; // Ignore SSE comments/heartbeats

      let eventType = '';
      let eventData = '';

      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event: ')) {
          eventType = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
          eventData = line.substring(6);
        }
      }

      if (!eventType || !eventData) continue;

      try {
        const data = JSON.parse(eventData);

        if (eventType === 'progress' && onProgress) {
          onProgress(data.status || 'Анализирам...');
        } else if (eventType === 'complete') {
          result = data;
        } else if (eventType === 'points_deducted' && result?.points) {
          result.points.newBalance = data.newBalance;
        } else if (eventType === 'error') {
          const error = new Error(data.error || 'Stream error');
          (error as any).code = data.code;
          if (data.currentBalance !== undefined) {
            (error as any).currentBalance = data.currentBalance;
          }
          throw error;
        }
      } catch (e: any) {
        // Re-throw actual errors (not JSON parse errors)
        if (e.code || e.message !== 'Stream error' && e instanceof Error && !(e instanceof SyntaxError)) {
          throw e;
        }
      }
    }
  }

  if (!result) {
    throw new Error('Stream ended without complete event');
  }

  return result;
};

const getAnalysisPrompt = (url: string, mode: AnalysisMode): string => {
  const lang = getApiLang();
  if (mode === 'deep') {
    return lang === 'en' ? getDeepAnalysisPromptEn(url, 'video') : getDeepAnalysisPrompt(url, 'video');
  }
  return lang === 'en' ? getStandardAnalysisPromptEn(url, 'video') : getStandardAnalysisPrompt(url, 'video');
};

/** Convert deep-analysis array format [{ point, details }, ...] to string for MultimodalSection (numbered list). */
function formatMultimodalField(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value.map((item: any, i: number) => {
    const point = item?.point ?? item?.title ?? '';
    const details = item?.details ?? item?.description ?? item?.text ?? '';
    return `${i + 1}. ${point}${details ? ': ' + details : ''}`;
  }).join('\n\n').trim() || undefined;
}

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
  const responseLang = getApiLang();

  const mapVerdict = (verdict: string): 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо' => {
    if (responseLang === 'en') {
      // EN verdicts are stored as English strings but type still expects BG keys — keep BG for internal type
      // We store the EN label in the explanation, so here we map to a neutral BG enum key
      const mapEn: Record<string, 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо'> = {
        'TRUE': 'вярно', 'MOSTLY_TRUE': 'предимно вярно', 'MIXED': 'частично вярно',
        'MOSTLY_FALSE': 'подвеждащо', 'FALSE': 'невярно', 'UNVERIFIABLE': 'непроверимо'
      };
      return mapEn[verdict?.toUpperCase()] || 'непроверимо';
    }
    const map: Record<string, 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо'> = {
      'TRUE': 'вярно', 'MOSTLY_TRUE': 'предимно вярно', 'MIXED': 'частично вярно',
      'MOSTLY_FALSE': 'подвеждащо', 'FALSE': 'невярно', 'UNVERIFIABLE': 'непроверимо'
    };
    return map[verdict?.toUpperCase()] || 'непроверимо';
  };

  const mapAssessment = (assessment: string): string => {
    if (responseLang === 'en') {
      const mapEn: Record<string, string> = {
        'ACCURATE': 'ACCURATE', 'MOSTLY_ACCURATE': 'MOSTLY ACCURATE',
        'MIXED': 'MIXED', 'MISLEADING': 'MISLEADING', 'FALSE': 'FALSE'
      };
      return mapEn[assessment?.toUpperCase()] || 'UNDETERMINED';
    }
    const map: Record<string, string> = {
      'ACCURATE': 'ДОСТОВЕРНО', 'MOSTLY_ACCURATE': 'ПРЕДИМНО ДОСТОВЕРНО',
      'MIXED': 'СМЕСЕНО', 'MISLEADING': 'ПОДВЕЖДАЩО', 'FALSE': 'НЕВЯРНО'
    };
    return map[assessment?.toUpperCase()] || 'НЕОПРЕДЕЛЕНО';
  };

  // Safe variable initialization — Deep mode may return "claims" or "factualClaims", same for manipulations
  const claims = Array.isArray(rawResponse?.factualClaims) ? rawResponse.factualClaims
    : Array.isArray(rawResponse?.claims) ? rawResponse.claims : [];
  const quotes = Array.isArray(rawResponse?.quotes) ? rawResponse.quotes : [];
  const manipulations = Array.isArray(rawResponse?.manipulationTechniques) ? rawResponse.manipulationTechniques
    : Array.isArray(rawResponse?.manipulations) ? rawResponse.manipulations : [];

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
    quote: c.claim || c.quote || '',
    formulation: c.claim || c.quote || '',
    category: 'Факт',
    weight: 'средна' as 'ниска' | 'средна' | 'висока',
    confidence: c.confidence || (c.verdict === 'TRUE' ? 0.9 : c.verdict === 'FALSE' ? 0.1 : 0.5),
    veracity: mapVerdict(c.verdict) as 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо',
    explanation: (c.logicalAnalysis || '') + (c.factualVerification ? '\n\nФактическа проверка: ' + c.factualVerification : '') + (c.comparison ? '\n\nСравнение: ' + c.comparison : '') || c.evidence || 'Няма налична информация',
    missingContext: (c.context || '') + (Array.isArray(c.sources) && c.sources.length > 0 ? '\n\nИзточници: ' + c.sources.join(', ') : '') || ''
  }));

  const transformedManipulations = manipulations.map((m: any, idx: number) => ({
    technique: m.technique || (responseLang === 'en' ? 'Unknown technique' : 'Неизвестна'),
    timestamp: m.timestamp || '00:00',
    logic: (m.description || '') + (m.example ? (responseLang === 'en' ? '\n\nExample: ' : '\n\nПример: ') + m.example : ''),
    effect: m.impact || (responseLang === 'en' ? 'Impact on the audience' : 'Въздействие върху аудиторията'),
    severity: m.severity || (0.5 + (idx * 0.1)),
    counterArgument: m.counterArgument || (responseLang === 'en' ? 'Verify primary sources.' : 'Проверка на първоизточници.')
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

  const constructedReport = (rawResponse?.finalInvestigativeReport) || (responseLang === 'en' ? `
# FINAL INVESTIGATIVE REPORT

## Executive Summary
${rawResponse?.summary || 'No summary available.'}

## Key Findings and Fact Checks
${(allClaims || []).slice(0, 10).map((c: any) => `
### "${c.claim || c.quote}"${c.speaker ? ` - ${c.speaker}` : ''}${c.timestamp ? ` [${c.timestamp}]` : ''}

**Verdict:** ${c.verdict || 'UNVERIFIABLE'}

**Evidence and verification:**
${c.evidence || c.factualVerification || 'No information available'}

${c.comparison ? `**Comparison with other sources:**\n${c.comparison}\n` : ''}
${c.logicalAnalysis ? `**Logical analysis:**\n${c.logicalAnalysis}\n` : ''}
${Array.isArray(c.sources) && c.sources.length > 0 ? `**Sources:** ${c.sources.join(', ')}\n` : ''}
`).join('\n---\n')}

${manipulations.length > 0 ? `
## Discovered Manipulation Techniques

${manipulations.map((m: any) => `
### ${m.technique}${m.speaker ? ` (used by ${m.speaker})` : ''} [${m.timestamp || '00:00'}]

${m.description || ''}

${m.example ? `**Concrete example:**\n"${m.example}"\n` : ''}
${m.impact ? `**Impact on the audience:**\n${m.impact}\n` : ''}
${m.counterArgument ? `**How to protect yourself:**\n${m.counterArgument}\n` : ''}
`).join('\n---\n')}
` : ''}

## Geopolitical Context and Historical Parallels
${rawResponse?.geopoliticalContext || 'Not applicable'}

${rawResponse?.historicalParallel ? `\n### Historical Precedents\n${rawResponse.historicalParallel}\n` : ''}

## Psycholinguistic Analysis
${rawResponse?.psychoLinguisticAnalysis || 'No data'}

## Strategic Intent
${rawResponse?.strategicIntent || 'No data'}

## Narrative Architecture
${rawResponse?.narrativeArchitecture || 'No data'}

## Technical Forensics
${rawResponse?.technicalForensics || 'No data'}

## Social Impact
${rawResponse?.socialImpactPrediction || 'No data'}

## Conclusion and Recommendations
${rawResponse?.recommendations || 'Critical evaluation of the presented information is recommended.'}

${metadataSection}
`.trim() : `
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
`.trim());

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

    // Multimodal analysis fields (deep analysis only) — Gemini returns arrays of { point, details }; convert to string for UI
    visualAnalysis: formatMultimodalField(rawResponse?.visualAnalysis),
    bodyLanguageAnalysis: formatMultimodalField(rawResponse?.bodyLanguageAnalysis),
    vocalAnalysis: formatMultimodalField(rawResponse?.vocalAnalysis),
    deceptionAnalysis: formatMultimodalField(rawResponse?.deceptionAnalysis),
    humorAnalysis: formatMultimodalField(rawResponse?.humorAnalysis),
    psychologicalProfile: formatMultimodalField(rawResponse?.psychologicalProfile),
    culturalSymbolicAnalysis: formatMultimodalField(rawResponse?.culturalSymbolicAnalysis)
  };
};

export const analyzeYouTubeStandard = async (url: string, videoMetadata?: YouTubeVideoMetadata, model: string = 'gemini-2.5-flash', mode: AnalysisMode = 'standard', onProgress?: (status: string) => void): Promise<AnalysisResponse> => {
  try {
    const normalizedUrl = normalizeYouTubeUrl(url);
    const prompt = getAnalysisPrompt(normalizedUrl, mode) + (videoMetadata ? `\n\nVideo Context: Title: "${videoMetadata.title}", Author: "${videoMetadata.author}", Duration: ${videoMetadata.durationFormatted}.` : '');

    const lang = getApiLang();
    const systemInstruction = lang === 'en'
      ? "You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output ALL text in ENGLISH. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism."
      : "You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Do NOT generate transcription - return empty array for 'transcription'. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.";

    const payload = {
      model: model,
      prompt: prompt,
      systemInstruction,
      videoUrl: normalizedUrl, // ← Use normalized URL
      mode: mode, // ← Send mode to activate Deep analysis features
      enableGoogleSearch: mode === 'deep', // ← Explicit Google Search activation for deep mode
      metadata: videoMetadata ? { // ← Send video metadata for transaction records
        title: videoMetadata.title,
        author: videoMetadata.author,
        videoId: videoMetadata.videoId,
        duration: videoMetadata.duration,
        durationFormatted: videoMetadata.durationFormatted,
        thumbnailUrl: videoMetadata.thumbnailUrl // YouTube API returns this
      } : undefined,
      lang: getApiLang()
    };

    // 3. Call Gemini API (streaming for video, regular for text)
    const data = await callGeminiAPI(payload, onProgress);

    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Gemini API не върна валиден отговор');
    }

    let rawResponse: any;
    try {
      rawResponse = JSON.parse(data.text);
    } catch (parseError: any) {
      console.error('[GeminiService] JSON parse error:', parseError?.message || parseError);
      throw new Error('AI върна невалиден формат. Моля, опитайте отново.');
    }

    const transcription: TranscriptionLine[] = [];

    const parsed = transformGeminiResponse(rawResponse, model, videoMetadata?.title, videoMetadata?.author, videoMetadata, transcription);
    parsed.analysisMode = mode;

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCostFromPricing(
        'gemini-2.5-flash',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      ),
      pointsCost: data.points?.costInPoints || calculateCostInPoints(
        'gemini-2.5-flash',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false,
        mode === 'deep'
      ),
      newBalance: data.points?.newBalance
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
    const prompt = getAnalysisPrompt(url, 'deep');

    const payload = {
      model: 'gemini-2.5-flash',
      prompt: prompt,
      systemInstruction: "You are an ELITE fact-checker. Do NOT generate transcription - return empty array for 'transcription'. Output valid JSON only in Bulgarian.",
      videoUrl: url,
      isBatch: true,
      lang: getApiLang()
    };

    // 3. Call Gemini API
    const data = await callGeminiAPI(payload);

    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Gemini API не върна валиден отговор');
    }

    let rawResponse: any;
    try {
      rawResponse = JSON.parse(data.text);
    } catch (parseError: any) {
      console.error('[GeminiService] JSON parse error:', parseError?.message || parseError);
      throw new Error('AI върна невалиден формат. Моля, опитайте отново.');
    }

    const transcription: TranscriptionLine[] = [];
    const parsed = transformGeminiResponse(rawResponse, 'gemini-2.5-flash', undefined, undefined, undefined, transcription);

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCostFromPricing(
        'gemini-2.5-flash',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        true
      ),
      pointsCost: data.points?.costInPoints || calculateCostInPoints(
        'gemini-2.5-flash',
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
 * Synthesize a professional report from analysis data
 * This is a background text-only call (no video) - fast and cheap
 */
export const synthesizeReport = async (analysis: VideoAnalysis): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const reportLang = getApiLang();
  const reportArgs = {
    videoTitle: analysis.videoTitle,
    videoAuthor: analysis.videoAuthor,
    summary: analysis.summary.overallSummary,
    credibilityIndex: analysis.summary.credibilityIndex,
    manipulationIndex: analysis.summary.manipulationIndex,
    classification: analysis.summary.finalClassification,
    claims: analysis.claims.map(c => ({
      claim: c.quote || c.formulation || '',
      verdict: c.veracity || '',
      evidence: c.explanation || '',
      speaker: ''
    })),
    manipulations: analysis.manipulations.map(m => ({
      technique: m.technique,
      description: m.logic || '',
      impact: m.effect || '',
      example: ''
    })),
    geopoliticalContext: analysis.summary.geopoliticalContext,
    narrativeArchitecture: analysis.summary.narrativeArchitecture,
    psychoLinguisticAnalysis: analysis.summary.psychoLinguisticAnalysis,
    strategicIntent: analysis.summary.strategicIntent,
    technicalForensics: analysis.summary.technicalForensics,
    historicalParallel: analysis.summary.historicalParallel,
    socialImpactPrediction: analysis.summary.socialImpactPrediction,
    mode: analysis.analysisMode || 'standard'
  };
  const prompt = reportLang === 'en' ? getReportSynthesisPromptEn(reportArgs) : getReportSynthesisPrompt(reportArgs);

  const response = await fetch('/api/gemini/synthesize-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, lang: getApiLang() })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'Report synthesis failed');
  }

  const data = await response.json();
  return data.report || '';
};