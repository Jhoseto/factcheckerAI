import { VideoAnalysis, APIUsage, AnalysisResponse, CostEstimate, YouTubeVideoMetadata, TranscriptionLine, AnalysisMode } from '../types';
import { handleApiError } from './errorHandler';
import { auth } from './firebase';
import { calculateCost as calculateCostFromPricing, calculateCostInPoints } from './pricing';
import { getStandardAnalysisPrompt } from './prompts/standardAnalysisPrompt';
import { getDeepAnalysisPrompt } from './prompts/deepAnalysisPrompt';
import { getReportSynthesisPrompt } from './prompts/reportSynthesisPrompt';
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

/**
 * Get the appropriate prompt based on model
 * gemini-2.5-flash = both standard and deep analysis (unified model)
 * Note: We now use gemini-2.5-flash for all analysis modes
 */
const getAnalysisPrompt = (url: string, type: 'video' | 'news', mode: AnalysisMode, transcript?: string): string => {
  if (mode === 'deep') {
    return getDeepAnalysisPrompt(url, type, transcript);
  }
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
    const codeBlockMatch = cleaned.match(/```[a-z]*\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }
  }

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

  // === ROBUST JSON SANITIZER ===
  // When responseMimeType is not 'application/json' (deep mode with Google Search tools),
  // the model may produce: (1) literal control chars inside strings, (2) unescaped quotes
  // inside strings, (3) truncated JSON. This sanitizer handles all three.
  {
    let result = '';
    let inStr = false;
    let i = 0;

    while (i < cleaned.length) {
      const ch = cleaned[i];
      const code = cleaned.charCodeAt(i);

      // Handle escape sequences inside strings
      if (inStr && ch === '\\') {
        // Pass through the escape sequence (\ + next char)
        result += ch;
        i++;
        if (i < cleaned.length) {
          result += cleaned[i];
          i++;
        }
        continue;
      }

      // Handle quote characters
      if (ch === '"') {
        if (!inStr) {
          // Opening a string
          inStr = true;
          result += ch;
          i++;
          continue;
        }

        // We're inside a string and hit a quote — is it the closing quote or an unescaped internal quote?
        // Look ahead to see if this quote is structural (followed by : , } ] or whitespace+structural)
        let lookAhead = i + 1;
        while (lookAhead < cleaned.length && /\s/.test(cleaned[lookAhead])) {
          lookAhead++;
        }
        const nextSignificant = lookAhead < cleaned.length ? cleaned[lookAhead] : '';

        if (nextSignificant === ':' || nextSignificant === ',' || nextSignificant === '}' ||
          nextSignificant === ']' || nextSignificant === '' || nextSignificant === '"') {
          // This is a structural closing quote
          inStr = false;
          result += ch;
          i++;
          continue;
        }

        // This quote is inside the string value — escape it
        result += '\\"';
        i++;
        continue;
      }

      // Handle control characters inside strings
      if (inStr && code < 0x20) {
        switch (code) {
          case 0x0A: result += '\\n'; break;
          case 0x0D: result += '\\r'; break;
          case 0x09: result += '\\t'; break;
          case 0x08: result += '\\b'; break;
          case 0x0C: result += '\\f'; break;
          default: result += '\\u' + code.toString(16).padStart(4, '0'); break;
        }
        i++;
        continue;
      }

      // Normal character
      result += ch;
      i++;
    }
    cleaned = result;
  }

  // Remove any trailing text after the JSON (common when Gemini adds explanations)
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const lastJsonChar = Math.max(lastBrace, lastBracket);
  if (lastJsonChar !== -1 && lastJsonChar < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastJsonChar + 1);
  }

  // === TRUNCATED JSON REPAIR ===
  // If the JSON still fails to parse, try to close any open strings and brackets
  try {
    JSON.parse(cleaned);
  } catch (e) {
    if (e instanceof SyntaxError) {
      let repaired = cleaned;

      // Scan to find open structures
      let inString = false;
      let escapeNext = false;
      const stack: string[] = [];

      for (let i = 0; i < repaired.length; i++) {
        const ch = repaired[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (ch === '\\' && inString) { escapeNext = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
          if (ch === '{') stack.push('}');
          else if (ch === '[') stack.push(']');
          else if (ch === '}' || ch === ']') stack.pop();
        }
      }

      // Close unterminated string
      if (inString) repaired += '"';

      // Remove trailing incomplete values
      repaired = repaired.replace(/,\s*"[^"]*"?\s*:\s*"?[^"}\]]*$/, '');
      repaired = repaired.replace(/,\s*"[^"]*$/, '');
      repaired = repaired.replace(/,\s*$/, '');

      // Re-scan and close all open brackets/braces
      const stack2: string[] = [];
      let inStr2 = false;
      let esc2 = false;
      for (let i = 0; i < repaired.length; i++) {
        const ch = repaired[i];
        if (esc2) { esc2 = false; continue; }
        if (ch === '\\' && inStr2) { esc2 = true; continue; }
        if (ch === '"') { inStr2 = !inStr2; continue; }
        if (!inStr2) {
          if (ch === '{') stack2.push('}');
          else if (ch === '[') stack2.push(']');
          else if (ch === '}' || ch === ']') stack2.pop();
        }
      }
      while (stack2.length > 0) repaired += stack2.pop();

      try {
        JSON.parse(repaired);
        cleaned = repaired;
      } catch (e2) {
        console.error('[cleanJsonResponse] JSON repair failed:', (e2 as Error).message);
      }
    }
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

export const analyzeYouTubeStandard = async (url: string, videoMetadata?: YouTubeVideoMetadata, model: string = 'gemini-2.5-flash', mode: AnalysisMode = 'standard', onProgress?: (status: string) => void): Promise<AnalysisResponse> => {
  try {
    // Normalize YouTube URL to standard format (handles mobile, shortened URLs)
    const normalizedUrl = normalizeYouTubeUrl(url);

    // Strategy: Single API call - Gemini analyzes video AND extracts transcript in one go
    // No separate transcript extraction - everything happens in one request

    const prompt = getAnalysisPrompt(normalizedUrl, 'video', mode) + (videoMetadata ? `\n\nVideo Context: Title: "${videoMetadata.title}", Author: "${videoMetadata.author}", Duration: ${videoMetadata.durationFormatted}.` : '');

    // ALWAYS send videoUrl - Gemini will process video and return everything including transcript
    const payload = {
      model: model,
      prompt: prompt,
      systemInstruction: "You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Extract ALL important claims, quotes, and manipulations from the video. 2) Extract FULL transcription from the video with timestamps. 3) Output all text in BULGARIAN. 4) Keep JSON Enum values in English. 5) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism.",
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
      } : undefined
    };

    // 3. Call Gemini API (streaming for video, regular for text)
    const data = await callGeminiAPI(payload, onProgress);

    // Validate response before parsing
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('Gemini API не върна валиден отговор');
    }

    let rawResponse: any;

    // Both modes parse JSON from response
    const cleanedText = cleanJsonResponse(data.text);
    if (!cleanedText) {
      throw new Error('Не може да се извлече JSON от отговора на Gemini API');
    }

    try {
      rawResponse = JSON.parse(cleanedText);
    } catch (parseError: any) {
      console.error('[GeminiService] JSON parse error:', parseError?.message || parseError);
      throw new Error('Gemini API върна невалиден JSON формат. Моля, опитайте отново.');
    }

    // Extract transcription from Gemini's response (only for Deep mode)
    // Standard mode doesn't generate transcription to save time
    const transcription = mode === 'deep' && rawResponse.transcription && Array.isArray(rawResponse.transcription) && rawResponse.transcription.length > 0
      ? rawResponse.transcription
      : [{
        timestamp: '00:00',
        speaker: 'Система',
        text: mode === 'standard' ? 'Транскрипцията не е налична в Standard режим.' : 'Транскрипцията не беше налична за това видео.'
      }];

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
    const prompt = getAnalysisPrompt(url, 'video', 'deep');

    const payload = {
      model: 'gemini-2.5-flash',
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
      console.error('[GeminiService] JSON parse error:', parseError?.message || parseError);
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
 * News article analysis
 */
export const analyzeNewsLink = async (url: string): Promise<AnalysisResponse> => {
  try {
    const data = await callGeminiAPI({
      model: 'gemini-2.5-flash',
      prompt: getAnalysisPrompt(url, 'news', 'standard') + `\n\nNews URL: ${url}`,
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
      console.error('[GeminiService] JSON parse error:', parseError?.message || parseError);
      throw new Error('Gemini API върна невалиден JSON формат. Моля, опитайте отново.');
    }
    const parsed = transformGeminiResponse(rawResponse, 'gemini-2.5-flash');

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
 * Synthesize a professional report from analysis data
 * This is a background text-only call (no video) - fast and cheap
 */
export const synthesizeReport = async (analysis: VideoAnalysis): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const prompt = getReportSynthesisPrompt({
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
  });

  const response = await fetch('/api/gemini/synthesize-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'Report synthesis failed');
  }

  const data = await response.json();
  return data.report || '';
};