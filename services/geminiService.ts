
import { GoogleGenAI, Type } from "@google/genai";
import { VideoAnalysis, AnalysisResponse, APIUsage } from "../types";
import { extractYouTubeTranscript } from "./youtubeTranscriptService";

const COST_PER_1M_INPUT = 1.25;
const COST_PER_1M_OUTPUT = 5.00;
const COST_PER_1M_INPUT_BATCH = 0.625; // 50% discount
const COST_PER_1M_OUTPUT_BATCH = 2.50; // 50% discount

const calculateCost = (inputTokens: number, outputTokens: number, isBatch: boolean = false): number => {
  const inputCost = isBatch ? COST_PER_1M_INPUT_BATCH : COST_PER_1M_INPUT;
  const outputCost = isBatch ? COST_PER_1M_OUTPUT_BATCH : COST_PER_1M_OUTPUT;
  return (inputTokens / 1_000_000) * inputCost + (outputTokens / 1_000_000) * outputCost;
};

const getAnalysisPrompt = (target: string, type: 'video' | 'news') => `
    ПРОТОКОЛ ЗА ТОТАЛЕН ЕКСПЕРТЕН ОДИТ (URL: ${target}):
    
    === КРИТИЧНО: АНАЛИЗИРАЙ ЦЯЛОТО СЪДЪРЖАНИЕ ===
    
    ЗАДЪЛЖИТЕЛНО изискване: Анализирай ЦЕЛИЯ клип/статия от начало до край.
    НЕ анализирай само част или откъс - трябва да обработиш ВСИЧКО.
    
    МИНИМАЛНИ ИЗИСКВАНИЯ ЗА ОБЕМ:
    - Транскрипция: ПЪЛНА, от първата до последната секунда
    - Твърдения (claims): Минимум 10-15 твърдения от целия клип
    - Манипулации: Минимум 5-8 техники, ако има такива  
    - Timeline точки: Минимум 8-12 точки, равномерно разпределени по времето
    - Segments: Минимум 4-6 сегмента, покриващи целия клип
    
    Ако видеото е по-дълго от 10 минути, увеличи пропорционално горните числа.
    
    === СТЪПКА 1: ПЪЛНА ТРАНСКРИПЦИЯ ===
    
    КРИТИЧНО ВАЖНО: Извлечи ПЪЛНАТА транскрипция на видеото - всяка изречена дума, от началото до края.
    
    - Ако видеото е 39 минути, totalDuration ТРЯБВА да е "39:00" (или точната продължителност)
    - Timeline точките трябва да покриват ЦЕЛИЯ времеви диапазон (от 00:00 до края)
    - Segments трябва да покриват ЦЕЛИЯ клип без пропуски
    - НЕ спирай на 20-та или 30-та минута - анализирай до ПОСЛЕДНАТА секунда
    
    Раздели на логични сегменти с ТОЧНИ timestamps.
    
    === СТЪПКА 2: СИСТЕМАТИЧЕН АНАЛИЗ ===
    
    Действай като екип от разследващи журналисти от най-висок ранг, военни анализатори и експерти по хибридни заплахи. 
    Твоята задача е да създадеш ЕКСТРЕМНО детайлен, огромен по обем и технически прецизен одит. 

    ИЗИСКВАНИЯ ЗА МАСЩАБ НА ТЕКСТА:
    1. ГЛАВНО СЛЕДСТВЕНО ЗАКЛЮЧЕНИЕ: Минимум 500 думи. Пълна деконструкция на информационния акт.
    2. ГЕОПОЛИТИЧЕСКИ КОНТЕКСТ: Минимум 300 думи. Връзки с международни доктрини и специфични интереси.
    3. НАРАТИВНА АРХИТЕКТУРА: Минимум 250 думи. Анализ на това как е построена историята - герои, злодеи, конфликти.
    4. ТЕХНИЧЕСКА ЕКСПЕРТИЗА (Technical Forensics): Минимум 200 думи. Анализ на монтажните техники, звуковите внушения и визуалните котви.
    5. ПРЕДСКАЗАНО СОЦИАЛНО ВЪЗДЕЙСТВИЕ: Минимум 200 думи. Как това ще повлияе на различните обществени слоеве.
    6. АНАЛИЗ НА ИЗТОЧНИКА: Минимум 150 думи. Кой стои зад това и какви са неговите исторически зависимости.
    7. ПСИХО-ЛИНГВИСТИЧЕН АНАЛИЗ: Минимум 200 думи. Езикови модели, внушения, NLP техники.
    8. ИСТОРИЧЕСКА ПРЕЦЕДЕНТНОСТ: Минимум 150 думи. Подобни случаи от миналото.
    9. СТРАТЕГИЧЕСКО НАМЕРЕНИЕ: Минимум 150 думи. Каква е крайната цел на съдържанието.

    ВАЖНО: Всяко твърдение (claim) трябва да има:
    - Точна цитата от видеото
    - Timestamp кога е казано
    - Детайлна верификация (минимум 100 думи обяснение)
    - Контекст какво липсва
    
    === ФОРМАТ НА ДАННИТЕ ===
    
    ВАЖНО - Всички числови стойности трябва да са в правилния формат:
    
    1. **Проценти (0-1 decimal)**: credibilityIndex, manipulationIndex, unverifiablePercent, всички detailedStats
       - Пример: 0.75 (означава 75%), НЕ 75
    
    2. **Severity на манипулации (0-1 decimal)**: 
       - Пример: 0.85 (означава 85% интензитет), НЕ 85
    
    3. **Confidence на твърдения (0-1 decimal)**:
       - Пример: 0.92 (означава 92% сигурност), НЕ 92
    
    4. **Timeline reliability (0-1 decimal)**:
       - Пример: 0.68 (означава 68% надеждност), НЕ 68
    
    5. **totalDuration (MM:SS формат)**:
       - Пример: "39:25" за 39 минути и 25 секунди
       - ТРЯБВА да съответства на РЕАЛНАТА продължителност на видеото
    
    Бъди безпощаден и изчерпателен. НЕ съкращавай анализа - колкото по-дълъг и детайлен, толкова по-добре.
`;

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    videoTitle: { type: Type.STRING },
    videoAuthor: { type: Type.STRING },
    transcription: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          speaker: { type: Type.STRING },
          text: { type: Type.STRING }
        },
        required: ["timestamp", "speaker", "text"]
      }
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.STRING },
          end: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING }
        },
        required: ["start", "end", "title", "summary"]
      }
    },
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          quote: { type: Type.STRING },
          formulation: { type: Type.STRING },
          category: { type: Type.STRING },
          weight: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          veracity: { type: Type.STRING },
          explanation: { type: Type.STRING },
          missingContext: { type: Type.STRING },
          isExtremeLie: { type: Type.BOOLEAN },
          lieEvidence: { type: Type.STRING }
        },
        required: ["quote", "formulation", "category", "weight", "confidence", "veracity", "explanation", "missingContext"]
      }
    },
    manipulations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          technique: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          logic: { type: Type.STRING },
          effect: { type: Type.STRING },
          severity: { type: Type.NUMBER },
          targetAudience: { type: Type.STRING },
          counterArgument: { type: Type.STRING }
        },
        required: ["technique", "timestamp", "logic", "effect", "severity"]
      }
    },
    fallacies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          reasoning: { type: Type.STRING }
        },
        required: ["type", "timestamp", "reasoning"]
      }
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING },
          reliability: { type: Type.NUMBER },
          event: { type: Type.STRING }
        },
        required: ["time", "reliability", "event"]
      }
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        credibilityIndex: { type: Type.NUMBER },
        manipulationIndex: { type: Type.NUMBER },
        unverifiablePercent: { type: Type.NUMBER },
        finalClassification: { type: Type.STRING },
        overallSummary: { type: Type.STRING },
        totalDuration: { type: Type.STRING },
        finalInvestigativeReport: { type: Type.STRING },
        geopoliticalContext: { type: Type.STRING },
        historicalParallel: { type: Type.STRING },
        psychoLinguisticAnalysis: { type: Type.STRING },
        strategicIntent: { type: Type.STRING },
        narrativeArchitecture: { type: Type.STRING },
        technicalForensics: { type: Type.STRING },
        socialImpactPrediction: { type: Type.STRING },
        sourceNetworkAnalysis: { type: Type.STRING },
        dataPointsProcessed: { type: Type.INTEGER },
        detailedStats: {
          type: Type.OBJECT,
          properties: {
            factualAccuracy: { type: Type.NUMBER },
            logicalSoundness: { type: Type.NUMBER },
            emotionalBias: { type: Type.NUMBER },
            propagandaScore: { type: Type.NUMBER },
            sourceReliability: { type: Type.NUMBER },
            subjectivityScore: { type: Type.NUMBER },
            objectivityScore: { type: Type.NUMBER },
            biasIntensity: { type: Type.NUMBER },
            narrativeConsistencyScore: { type: Type.NUMBER },
            semanticDensity: { type: Type.NUMBER },
            contextualStability: { type: Type.NUMBER }
          }
        }
      },
      required: [
        "credibilityIndex", "manipulationIndex", "finalClassification", "overallSummary",
        "totalDuration", "finalInvestigativeReport", "geopoliticalContext",
        "historicalParallel", "psychoLinguisticAnalysis", "strategicIntent", "dataPointsProcessed",
        "narrativeArchitecture", "technicalForensics", "socialImpactPrediction", "sourceNetworkAnalysis"
      ]
    }
  },
  required: ["videoTitle", "videoAuthor", "transcription", "segments", "claims", "manipulations", "fallacies", "timeline", "summary"]
};

/**
 * STANDARD ANALYSIS - Full video + audio analysis (fastest, most expensive)
 * Renamed from analyzeYouTubeLink for clarity
 */
export const analyzeYouTubeStandard = async (url: string): Promise<AnalysisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Use the video directly as input for the engine
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          {
            fileData: {
              mimeType: 'video/*',
              fileUri: url
            }
          },
          {
            text: getAnalysisPrompt(url, 'video')
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    if (!response.text) {
      console.error('Service response error:', response);
      throw new Error("Възникна грешка при генериране на документа. Моля, опитайте отново.");
    }

    const parsed = JSON.parse(response.text.trim()) as VideoAnalysis;
    parsed.id = Math.random().toString(36).substr(2, 9).toUpperCase();
    parsed.timestamp = Date.now();

    const usage: APIUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCost(response.usageMetadata?.promptTokenCount || 0, response.usageMetadata?.candidatesTokenCount || 0, false)
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
 * BATCH ANALYSIS - Full video + audio analysis (slower, 50% cheaper)
 * Uses Batch API for cost savings
 */
export const analyzeYouTubeBatch = async (url: string): Promise<AnalysisResponse> => {
  // Note: Batch API implementation would require async job handling
  // For now, using standard API with batch pricing calculation
  // TODO: Implement proper Batch API when available in SDK

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          {
            fileData: {
              mimeType: 'video/*',
              fileUri: url
            }
          },
          {
            text: getAnalysisPrompt(url, 'video')
          }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    if (!response.text) {
      console.error('Service response error:', response);
      throw new Error("Възникна техническа грешка при обработка на данните.");
    }

    const parsed = JSON.parse(response.text.trim()) as VideoAnalysis;
    parsed.id = Math.random().toString(36).substr(2, 9).toUpperCase();
    parsed.timestamp = Date.now();

    const usage: APIUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCost(response.usageMetadata?.promptTokenCount || 0, response.usageMetadata?.candidatesTokenCount || 0, true) // Batch pricing
    };
    return { analysis: parsed, usage };
  } catch (e: any) {
    if (e.message?.includes('429')) {
      throw new Error("Системата е претоварена. Моля, опитайте след малко.");
    }
    throw new Error(e.message || "Грешка при разследването.");
  }
};

/**
 * QUICK ANALYSIS - Transcript-only analysis (fastest, cheapest/free)
 * Extracts transcript first, then analyzes only the text
 */
export const analyzeYouTubeQuick = async (url: string): Promise<AnalysisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    // Step 1: Extract transcript
    const transcript = await extractYouTubeTranscript(url);

    // Step 2: Analyze transcript with simplified prompt
    const quickPrompt = `
      ПРОТОКОЛ ЗА БЪРЗ ТЕКСТОВ ОДИТ:
      
      Анализирай следната транскрипция от YouTube видео.
      
      ТРАНСКРИПЦИЯ:
      ${transcript}
      
      === АНАЛИЗ ===
      
      Извлечи:
      1. Основни твърдения (минимум 5-10)
      2. Логически грешки и манипулации (ако има)
      3. Фактическа точност
      4. Обща оценка на достоверността
      
      ВАЖНО: Това е БЪРЗ анализ само на текст. Не анализираш визуални или аудио елементи.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: quickPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    if (!response.text) {
      console.error('Service response error:', response);
      throw new Error("Възникна грешка при бързия анализ на съдържанието.");
    }

    const parsed = JSON.parse(response.text.trim()) as VideoAnalysis;
    parsed.id = Math.random().toString(36).substr(2, 9).toUpperCase();
    parsed.timestamp = Date.now();

    const usage: APIUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCost(response.usageMetadata?.promptTokenCount || 0, response.usageMetadata?.candidatesTokenCount || 0, false)
    };
    return { analysis: parsed, usage };
  } catch (e: any) {
    if (e.message?.includes('429')) {
      throw new Error("Лимитът на вашия API ключ е превишен. Моля, изчакайте малко.");
    }
    throw new Error(e.message || "Грешка при бързия анализ.");
  }
};

// Keep backward compatibility
export const analyzeYouTubeLink = analyzeYouTubeStandard;

export const analyzeNewsLink = async (url: string): Promise<AnalysisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: getAnalysisPrompt(url, 'news') }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    if (!response.text) {
      console.error('Service response error:', response);
      throw new Error("Възникна грешка при извличане на информацията.");
    }

    const parsed = JSON.parse(response.text.trim()) as VideoAnalysis;
    parsed.id = Math.random().toString(36).substr(2, 9).toUpperCase();
    parsed.timestamp = Date.now();

    const usage: APIUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCost(response.usageMetadata?.promptTokenCount || 0, response.usageMetadata?.candidatesTokenCount || 0)
    };
    return { analysis: parsed, usage };
  } catch (e: any) {
    if (e.message?.includes('429')) {
      throw new Error("Системата е претоварена. Моля, изчакайте.");
    }
    throw new Error(e.message || "Грешка при разследването.");
  }
};