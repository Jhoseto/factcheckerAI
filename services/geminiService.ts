
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
 * Standard YouTube analysis - uses video directly
 */
export const analyzeYouTubeStandard = async (url: string): Promise<AnalysisResponse> => {
  try {
    const data = await callGeminiAPI({
      model: 'gemini-2.0-flash-exp',
      prompt: getAnalysisPrompt(url, 'video'),
      videoUrl: url
    });

    const parsed = JSON.parse(data.text.trim()) as VideoAnalysis;
    parsed.id = Math.random().toString(36).substr(2, 9).toUpperCase();
    parsed.timestamp = Date.now();

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
      prompt: getAnalysisPrompt(url, 'news') + `\n\nNews URL: ${url}`
    });

    const parsed = JSON.parse(data.text.trim()) as VideoAnalysis;
    parsed.id = Math.random().toString(36).substr(2, 9).toUpperCase();
    parsed.timestamp = Date.now();

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
  // Rough estimates based on video duration
  const baseTokens = Math.floor(durationSeconds * 2); // ~2 tokens per second of video

  return {
    quick: {
      estimatedTokens: baseTokens * 0.5,
      estimatedCost: baseTokens * 0.5 * 0.0000005,
      description: 'Бърз анализ на текстово съдържание'
    },
    standard: {
      estimatedTokens: baseTokens,
      estimatedCost: baseTokens * 0.0000005,
      description: 'Пълен анализ на видео и аудио'
    },
    batch: {
      estimatedTokens: baseTokens,
      estimatedCost: baseTokens * 0.000000125,
      description: 'Пакетна обработка (по-евтино, по-бавно)'
    }
  };
};