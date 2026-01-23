
import { VideoAnalysis, APIUsage, AnalysisResponse, CostEstimate } from '../types';

/**
 * Helper function to call our server-side Gemini API
 */
const callGeminiAPI = async (payload: {
  model: string;
  prompt: string;
  systemInstruction?: string;
  videoUrl?: string;
}): Promise<{ text: string; usageMetadata: any }> => {
  const response = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate content');
  }

  return response.json();
};

const getAnalysisPrompt = (url: string, type: 'video' | 'news') => {
  return `Analyze this ${type} for factual accuracy, bias, and manipulative techniques. 
        
Provide a comprehensive fact-check in the following JSON format:

{
  "summary": "Brief overview of the content and key findings (2-3 sentences)",
  "overallAssessment": "ACCURATE" | "MOSTLY_ACCURATE" | "MIXED" | "MISLEADING" | "FALSE",
  "factualClaims": [
    {
      "claim": "The specific claim made",
      "verdict": "TRUE" | "MOSTLY_TRUE" | "MIXED" | "MOSTLY_FALSE" | "FALSE" | "UNVERIFIABLE",
      "evidence": "Supporting evidence or debunking information",
      "sources": ["Credible source URLs"]
    }
  ],
  "biasIndicators": {
    "politicalBias": "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "UNCLEAR",
    "emotionalLanguage": "Instances of emotionally charged language",
    "selectiveReporting": "Evidence of cherry-picking facts"
  },
  "manipulationTechniques": [
    {
      "technique": "Name of the technique (e.g., 'Loaded Language', 'False Dilemma')",
      "description": "How it's used in the content",
      "timestamp": "Approximate timestamp if detectable"
    }
  ],
  "recommendations": "What viewers/readers should know or verify independently"
}`;
};

const calculateCost = (promptTokens: number, candidatesTokens: number, isBatch: boolean): number => {
  const promptCost = isBatch ? 0.000000125 : 0.0000005;
  const candidatesCost = isBatch ? 0.000000250 : 0.0000010;
  return (promptTokens * promptCost) + (candidatesTokens * candidatesCost);
};

/**
 * Clean JSON response from markdown code blocks and fix common issues
 */
const cleanJsonResponse = (text: string): string => {
  let cleaned = text.trim();

  // Remove ```json and ``` markers (with any content before/after)
  const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1];
  } else {
    // Try generic code block
    const codeBlockMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1];
    }
  }

  // Remove any remaining ``` markers
  cleaned = cleaned.replace(/```/g, '');

  // If text doesn't start with { or [, try to extract JSON object/array
  cleaned = cleaned.trim();
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonStart = cleaned.search(/[{\[]/);
    if (jsonStart !== -1) {
      const startChar = cleaned[jsonStart];
      const endChar = startChar === '{' ? '}' : ']';
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < cleaned.length; i++) {
        if (cleaned[i] === startChar) depth++;
        else if (cleaned[i] === endChar) depth--;
        if (depth === 0) {
          jsonEnd = i;
          break;
        }
      }
      if (jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
    }
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  // Remove single-line comments (// ...) - be careful not to remove URLs
  cleaned = cleaned.replace(/([^:])\/\/[^\n]*/g, '$1');
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  return cleaned.trim();
};

/**
 * Transform Gemini API response to VideoAnalysis format
 */
const transformGeminiResponse = (rawResponse: any, videoTitle?: string, videoAuthor?: string): VideoAnalysis => {
  const mapVerdict = (verdict: string): string => {
    const map: Record<string, string> = {
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

  const claims = rawResponse.factualClaims || [];
  const trueClaims = claims.filter((c: any) => ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict?.toUpperCase())).length;
  const credibilityIndex = claims.length > 0 ? (trueClaims / claims.length) : 0.5;

  const manipulations = rawResponse.manipulationTechniques || [];
  const manipulationIndex = Math.min(manipulations.length * 0.15, 1);

  const transformedClaims = claims.map((c: any) => ({
    quote: c.claim || '', formulation: c.claim || '', category: 'Факт', weight: 'средна',
    confidence: c.verdict === 'TRUE' ? 0.9 : 0.5, veracity: mapVerdict(c.verdict),
    explanation: c.evidence || 'Няма налична информация', missingContext: Array.isArray(c.sources) ? c.sources.join(', ') : ''
  }));

  const transformedManipulations = manipulations.map((m: any, idx: number) => ({
    technique: m.technique || 'Неизвестна', timestamp: m.timestamp || '00:00',
    logic: m.description || '', effect: 'Въздействие върху аудиторията', severity: 0.5 + (idx * 0.1)
  }));

  const timeline = claims.length > 0
    ? claims.map((c: any, idx: number) => ({
      time: `${String(Math.floor(idx * 5)).padStart(2, '0')}:${String((idx * 30) % 60).padStart(2, '0')}`,
      reliability: ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict) ? 0.9 : 0.3,
      event: c.claim?.substring(0, 50) || 'Твърдение'
    }))
    : [{ time: '00:00', reliability: 0.5, event: 'Начало' }];

  return {
    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
    timestamp: Date.now(),
    videoTitle: videoTitle || 'Анализирано съдържание',
    videoAuthor: videoAuthor || 'Неизвестен автор',
    transcription: [], segments: [], claims: transformedClaims, manipulations: transformedManipulations,
    fallacies: [], timeline: timeline,
    summary: {
      credibilityIndex, manipulationIndex, unverifiablePercent: 0.1,
      finalClassification: mapAssessment(rawResponse.overallAssessment),
      overallSummary: rawResponse.summary || 'Анализът е завършен.',
      totalDuration: 'N/A', detailedStats: {
        factualAccuracy: credibilityIndex, logicalSoundness: 1 - manipulationIndex, emotionalBias: 0.5,
        propagandaScore: manipulationIndex, sourceReliability: 0.5, subjectivityScore: 0.5,
        objectivityScore: 0.5, biasIntensity: 0.5, narrativeConsistencyScore: 0.7,
        semanticDensity: 0.6, contextualStability: 0.6
      },
      finalInvestigativeReport: rawResponse.summary || 'Анализът е завършен.',
      geopoliticalContext: 'N/A', historicalParallel: 'N/A', psychoLinguisticAnalysis: 'N/A',
      strategicIntent: 'N/A', narrativeArchitecture: 'N/A', technicalForensics: 'N/A',
      socialImpactPrediction: rawResponse.recommendations || 'N/A', sourceNetworkAnalysis: 'N/A',
      dataPointsProcessed: claims.length * 10
    }
  };
};

/**
 * Standard YouTube analysis - uses video directly
 */
export const analyzeYouTubeStandard = async (url: string): Promise<AnalysisResponse> => {
  try {
    const data = await callGeminiAPI({
      model: 'gemini-2.0-flash-exp',
      prompt: getAnalysisPrompt(url, 'video'),
      systemInstruction: 'You are a professional fact-checker. You MUST answer in Bulgarian language only. Translate any analysis to Bulgarian.',
      videoUrl: url
    });

    const cleanedText = cleanJsonResponse(data.text);
    const rawResponse = JSON.parse(cleanedText);
    const parsed = transformGeminiResponse(rawResponse);

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCost(
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      )
    };

    return { analysis: parsed, usage };
  } catch (e: any) {
    if (e.message?.includes('429')) {
      throw new Error("Системата е претоварена. Моля, изчакайте малко преди следващата заявка.");
    }
    throw new Error(e.message || "Грешка при разследването.");
  }
};

/**
 * Batch analysis (currently same as standard, will be optimized later)
 */
export const analyzeYouTubeBatch = async (url: string): Promise<AnalysisResponse> => {
  return analyzeYouTubeStandard(url);
};

/**
 * Quick analysis - extracts transcript first
 */
export const analyzeYouTubeQuick = async (url: string): Promise<AnalysisResponse> => {
  try {
    // For now, using standard analysis
    // TODO: Implement transcript extraction + text-only analysis
    return analyzeYouTubeStandard(url);
  } catch (e: any) {
    throw new Error(e.message || "Грешка при бързия анализ.");
  }
};

/**
 * Default export points to standard analysis
 */
export const analyzeYouTubeLink = analyzeYouTubeStandard;

/**
 * News article analysis
 */
export const analyzeNewsLink = async (url: string): Promise<AnalysisResponse> => {
  try {
    const data = await callGeminiAPI({
      model: 'gemini-2.0-flash-exp',
      prompt: getAnalysisPrompt(url, 'news') + `\n\nNews URL: ${url}`,
      systemInstruction: 'You are a professional fact-checker. You MUST answer in Bulgarian language only. Translate any analysis to Bulgarian.'
    });

    const cleanedText = cleanJsonResponse(data.text);
    const rawResponse = JSON.parse(cleanedText);
    const parsed = transformGeminiResponse(rawResponse);

    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCost(
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      )
    };

    return { analysis: parsed, usage };
  } catch (e: any) {
    throw new Error(e.message || "Грешка при анализ на новината.");
  }
};

/**
 * Estimate costs for different analysis modes
 */
export const estimateCosts = (durationSeconds: number): Record<string, CostEstimate> => {
  const baseTokens = Math.floor(durationSeconds * 2);
  const minutes = Math.ceil(durationSeconds / 60);

  return {
    quick: {
      mode: 'quick',
      estimatedTokens: baseTokens * 0.5,
      estimatedCostUSD: baseTokens * 0.5 * 0.0000005,
      estimatedTime: `~${Math.max(1, Math.ceil(minutes * 0.3))} мин`,
      features: ['Бърз анализ на текстово съдържание', 'Само транскрипция']
    },
    standard: {
      mode: 'standard',
      estimatedTokens: baseTokens,
      estimatedCostUSD: baseTokens * 0.0000005,
      estimatedTime: `~${Math.max(1, minutes)} мин`,
      features: ['Пълен анализ на видео и аудио', 'Визуален контекст']
    },
    batch: {
      mode: 'batch',
      estimatedTokens: baseTokens,
      estimatedCostUSD: baseTokens * 0.000000125,
      estimatedTime: `~${Math.max(2, minutes * 2)} мин`,
      features: ['Пакетна обработка', 'По-евтино', 'По-бавно']
    }
  };
};