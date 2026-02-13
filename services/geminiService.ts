import { VideoAnalysis, APIUsage, AnalysisResponse, CostEstimate, YouTubeVideoMetadata, TranscriptionLine } from '../types';
import { extractYouTubeTranscript } from './youtubeTranscriptService';
import { handleApiError } from './errorHandler';
import { auth } from './firebase';
import { calculateCost as calculateCostFromPricing, calculateCostInPoints } from './pricing';

/**
 * Helper function to call our server-side Gemini API
 */
const callGeminiAPI = async (payload: {
  model: string;
  prompt: string;
  systemInstruction?: string;
  videoUrl?: string;
  isBatch?: boolean;
}): Promise<{ text: string; usageMetadata: any; points?: { deducted: number; remaining: number } }> => {

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

const getDetailedAnalysisPrompt = (url: string, type: 'video' | 'news', transcript?: string) => {
  return `Ти си елитен фактчекър, разследващ журналист и медиен аналитик с над 20 години опит. Твоята задача е да направиш ПРОФЕСИОНАЛЕН, КРИТИЧЕН и ОБЕКТИВЕН анализ на ${type === 'video' ? 'видео' : 'статия'}, който да разкрие всички скрити гледни точки, манипулации и факти.

ТВОЯТА МИСИЯ: Разкрий истината. Намери всички манипулации. Провери всяко твърдение. Дай на потребителя ИЗКЛЮЧИТЕЛНА информация която да му помогне да разбере реалността.

КРИТИЧНО ВАЖНО ЗА ИЗВЛЕЧВАНЕ НА ДАННИ:
1. ТРЯБВА да извлечеш ВСИЧКИ важни твърдения - не само 2-3, а ВСИЧКИ значими твърдения от видеото
2. ТРЯБВА да извлечеш ВСИЧКИ важни цитати - не само няколко, а ВСИЧКИ значими цитати от всички участници
3. ТРЯБВА да идентифицираш ВСИЧКИ манипулативни техники - не само 2, а ВСИЧКИ използвани техники с конкретни примери
4. ТРЯБВА да използваш РЕАЛНИ данни от видеото - НЕ измисляй факти
5. За дълги видеа (над 30 минути): МИНИМУМ 20-30 твърдения и 15-20 манипулации
6. За видеа с гости: идентифицирай твърденията на ВСЕКИ участник отделно с реалните им имена
7. ВСЯКО твърдение трябва да се проверява срещу надеждни източници и да се съпоставя в контекст
8. Използвай логически анализ, фактически проверки и контекстуално разбиране

ВАЖНО: Всички текстове (summaries, explanations, recommendations) трябва да са на БЪЛГАРСКИ език. Само JSON enum стойностите остават на английски.

Извърши следните анализи:

1. ФАКТИЧЕСКА ТОЧНОСТ:
- Провери всяко твърдение срещу надеждни източници
- Оцени достоверността на всеки факт (0.0-1.0)
- Идентифицирай неверни или подвеждащи твърдения

2. ЛОГИЧЕСКА СТРОЙНОСТ:
- Провери за логически заблуди
- Оцени качеството на аргументацията (0.0-1.0)
- Идентифицирай слаби аргументи

3. ЕМОЦИОНАЛНА ПРИСТРАСТНОСТ:
- Анализирай емоционалния тон (0.0 = неутрален, 1.0 = силно емоционален)
- Идентифицирай емоционално заредени думи
- Оцени дали емоциите се използват за манипулация

4. ПРОПАГАНДЕН ИНДЕКС:
- Оцени дали съдържанието е пропагандно (0.0-1.0)
- Идентифицирай пропагандистки техники
- Провери за едностранчиво представяне на факти

5. НАДЕЖДНОСТ НА ИЗТОЧНИКА:
- Оцени надеждността на автора/канала (0.0-1.0)
- Провери за минали случаи на дезинформация
- Оцени експертността в темата

6. СУБЕКТИВНОСТ/ОБЕКТИВНОСТ:
- Оцени нивото на субективност (0.0 = обективен, 1.0 = субективен)
- Оцени нивото на обективност (0.0-1.0)
- Идентифицирай лични мнения vs факти

7. BIAS ИНТЕНЗИТЕТ:
- Оцени интензитета на bias (0.0-1.0)
- Идентифицирай вида на bias (политически, културен, икономически и т.н.)

8. НАРАТИВНА КОНСИСТЕНТНОСТ:
- Провери дали разказът е последователен (0.0-1.0)
- Идентифицирай противоречия
- Оцени логическата последователност

9. СЕМАНТИЧНА ПЛЪТНОСТ:
- Оцени информационната плътност (0.0-1.0)
- Провери за празни приказки vs конкретна информация

10. КОНТЕКСТУАЛНА СТАБИЛНОСТ:
- Оцени дали контекстът е стабилен (0.0-1.0)
- Провери за изваждане на неща извън контекст

11. ГЕОПОЛИТИЧЕСКИ КОНТЕКСТ:
- Опиши геополитическия контекст на темата
- Идентифицирай засегнати страни/региони
- Оцени политическите импликации

12. ИСТОРИЧЕСКА ПРЕЦЕДЕНТНОСТ:
- Намери исторически паралели
- Опиши подобни случаи от миналото
- Оцени дали има исторически контекст

13. ПСИХО-ЛИНГВИСТИЧЕН АНАЛИЗ:
- Анализирай използваните езикови модели
- Идентифицирай манипулативни езикови техники
- Оцени въздействието върху аудиторията

14. СТРАТЕГИЧЕСКО НАМЕРЕНИЕ:
- Оцени какво е стратегическото намерение на автора
- Идентифицирай скрити цели
- Оцени дали има скрита агенда

15. НАРАТИВНА АРХИТЕКТУРА:
- Опиши структурата на разказа
- Идентифицирай използваните наративни техники
- Оцени как информацията е организирана

16. ТЕХНИЧЕСКА ЕКСПЕРТИЗА (FORENSICS):
- Анализирай техническите аспекти (ако има)
- Провери за манипулации в данните/графиките
- Оцени техническата точност

17. СОЦИАЛНО ВЪЗДЕЙСТВИЕ:
- Оцени потенциалното социално въздействие
- Идентифицирай засегнатите групи
- Предложи прогноза за разпространение

${transcript ? `\n\n=== ТРАНСКРИПЦИЯ (ИЗПОЛЗВАЙ Я КАТО ОСНОВЕН ИЗТОЧНИК) ===\n${transcript}\n\nВАЖНО: Всички твърдения, цитати и манипулации ТРЯБВА да са базирани на тази транскрипция. НЕ измисляй факти които не са в транскрипцията!` : ''}

Върни резултата като JSON в следния формат:
{
  "summary": "Изключително детайлно резюме на български (минимум 5-7 изречения) което обхваща всички ключови моменти, твърдения, манипулации и заключения",
  "overallAssessment": "ACCURATE" | "MOSTLY_ACCURATE" | "MIXED" | "MISLEADING" | "FALSE",
  "factualClaims": [
    {
      "claim": "ПЪЛНОТО твърдение като е изказано (не скъсвай, включи целия контекст)",
      "verdict": "TRUE" | "MOSTLY_TRUE" | "MIXED" | "MOSTLY_FALSE" | "FALSE" | "UNVERIFIABLE",
      "evidence": "Детайлно доказателство или опровержение с фактически данни, статистики, исторически факти, сравнения с други източници. Използвай конкретни примери и реални данни.",
      "sources": ["URL на надежден източник за проверка"],
      "confidence": 0.0,
      "speaker": "РЕАЛНОТО име на говорителя (ако е споменато в видеото, иначе 'Speaker 1', 'Speaker 2' и т.н.)",
      "timestamp": "Точен timestamp от видеото",
      "context": "Пълен контекст около твърдението - какво е казано преди и след него, как се вписва в общия разговор",
      "logicalAnalysis": "Детайлен логически анализ - има ли логически заблуди, каква е структурата на аргументацията, дали е последователно",
      "factualVerification": "Как се проверява това твърдение срещу реални източници, статистики, исторически факти, общо мнение на експерти",
      "comparison": "Сравнение с други източници или мнения - какво казват други експерти/източници по същата тема"
    }
  ],
  "quotes": [
    {
      "quote": "ПЪЛЕН цитат от транскрипцията (не скъсвай, включи целия контекст на изречението)",
      "speaker": "РЕАЛНОТО име на говорителя (ако е споменато, иначе 'Speaker 1', 'Speaker 2' и т.н.)",
      "timestamp": "Точен timestamp от видеото",
      "context": "Пълен контекст - какво е казано преди и след цитата, как се вписва в разговора",
      "importance": "high" | "medium" | "low",
      "analysis": "Анализ на цитата - какво означава, какви са импликациите, дали е манипулативен"
    }
  ],
  "biasIndicators": {
    "politicalBias": "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "UNCLEAR",
    "emotionalLanguage": "Примери на емоционално зареден език на български",
    "selectiveReporting": "Доказателства за cherry-picking на факти на български"
  },
  "manipulationTechniques": [
    {
      "technique": "Име на техниката на български (напр. 'Емоционална манипулация', 'Cherry-picking', 'Ad hominem', 'Ложна дилема', 'Изваждане извън контекст', 'Статистическа манипулация', 'Емоционално зареждане', 'Страх и паника', 'Създаване на враг', 'Обезличаване', 'Евфемизми/дисфемизми', 'Повторение', 'Ложна авторитетност', 'Логически заблуди', 'Газиране', 'Мисловни трикове', 'Емоционално шантажиране')",
      "description": "Детайлно описание как точно се използва на български с конкретни примери от видеото. Обясни механизма на манипулацията.",
      "timestamp": "Точен timestamp от видеото",
      "severity": 0.0,
      "example": "ПЪЛЕН цитат/пример от видеото който демонстрира техниката",
      "speaker": "РЕАЛНОТО име на този който го използва",
      "impact": "Какво е въздействието върху аудиторията - как манипулира мисленето",
      "counterArgument": "Как може да се противодейства на тази манипулация - какво трябва да знае публиката"
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
  "geopoliticalContext": "Изключително детайлен анализ на геополитическия контекст на български. Сравни събитията/твърденията с реални геополитически ситуации, исторически прецеденти, икономически данни. Дай уникални фактически сравнения.",
  "historicalParallel": "Исторически паралели и контекст на български. Намери конкретни исторически събития които са подобни, сравни с миналото, покажи какво можем да научим от историята.",
  "psychoLinguisticAnalysis": "Психолингвистичен анализ на български. Анализирай езика, думите, тоналността, как се влияе върху аудиторията, какви са скритите послания.",
  "strategicIntent": "Анализ на стратегическото намерение на български. Какво наистина се опитва да се постигне? Какви са скритите цели? Кой печели от това съдържание?",
  "narrativeArchitecture": "Анализ на наративната архитектура на български. Как е структуриран разказът? Каква е последователността? Как се изгражда наративът? Какви техники се използват?",
  "technicalForensics": "Техническа експертиза на български. Провери данните, статистиките, графиките за манипулации. Анализирай техническата точност на твърденията.",
  "socialImpactPrediction": "Прогноза за социално въздействие на български. Как това съдържание може да повлияе на обществото? Кои групи са засегнати? Какви са рисковете?",
  "recommendations": "Препоръки за потребителите на български. Как да се защитят от манипулациите? Какво трябва да знаят? Как да проверят информацията?",
  "finalInvestigativeReport": "ИЗКЛЮЧИТЕЛНО ДЕТАЙЛЕН ФИНАЛЕН РАЗСЛЕДВАЩ ДОКЛАД на български. Това трябва да е произведение на висша журналистика - критичен, обективен, базиран на факти. Включи: уникални фактически сравнения, разкриване на всички скрити гледни точки, анализ на всички манипулации, проверка на всички твърдения, контекстуални съпоставки, логически анализ, фактически проверки. Докладът трябва да бъде толкова добър че потребителят да каже 'WOW - това е нещо велико'. Минимум 15-20 параграфа с детайлен анализ."
}`;
};

// Keep old function for backward compatibility, but use new detailed one
const getAnalysisPrompt = (url: string, type: 'video' | 'news', transcript?: string) => {
  return getDetailedAnalysisPrompt(url, type, transcript);
};

// Import unified pricing - already imported at top
// import { calculateCost as calculateCostFromPricing } from './pricing';

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

  const claims = rawResponse.factualClaims || [];
  const quotes = rawResponse.quotes || [];
  const trueClaims = claims.filter((c: any) => ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict?.toUpperCase())).length;
  const credibilityIndex = claims.length > 0 ? (trueClaims / claims.length) : 0.5;

  const manipulations = rawResponse.manipulationTechniques || [];
  const manipulationIndex = Math.min(manipulations.length * 0.15, 1);

  // Добавяме цитатите към claims ако не са вече там
  const allClaims = [...claims];
  quotes.forEach((q: any) => {
    if (!allClaims.find(c => c.claim === q.quote)) {
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
      reliability: ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict) ? 0.9 : 0.3,
      event: c.claim?.substring(0, 50) || 'Твърдение'
    }))
    : [{ time: '00:00', reliability: 0.5, event: 'Начало' }];

  // Construct a rich investigative report
  const metadataSection = fullMetadata
    ? `\n\n**Метаданни на видеоклипа:**\n- **Заглавие:** ${fullMetadata.title}\n- **Автор:** ${fullMetadata.author}\n- **Продължителност:** ${fullMetadata.durationFormatted}\n- **ID:** ${fullMetadata.videoId}`
    : (videoTitle ? `\n\n**Метаданни:**\n- **Заглавие:** ${videoTitle}\n- **Автор:** ${videoAuthor || 'Неизвестен'}` : '');

  // Construct EXCEPTIONAL investigative report - "произведение на висша журналистика"
  const constructedReport = rawResponse.finalInvestigativeReport || `
# ФИНАЛЕН РАЗСЛЕДВАЩ ДОКЛАД

## Изпълнително резюме
${rawResponse.summary || 'Няма налично резюме.'}

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
${rawResponse.geopoliticalContext || 'Неприложимо'}

${rawResponse.historicalParallel ? `\n### Исторически прецеденти\n${rawResponse.historicalParallel}\n` : ''}

## Психолингвистичен анализ
${rawResponse.psychoLinguisticAnalysis || 'Няма данни'}

## Стратегическо намерение
${rawResponse.strategicIntent || 'Няма данни'}

## Наративна архитектура
${rawResponse.narrativeArchitecture || 'Няма данни'}

## Техническа експертиза
${rawResponse.technicalForensics || 'Няма данни'}

## Социално въздействие
${rawResponse.socialImpactPrediction || 'Няма данни'}

## Заключение и препоръки
${rawResponse.recommendations || 'Препоръчва се критично осмисляне на представената информация.'}

${metadataSection}
`.trim();

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    videoTitle: videoTitle || rawResponse.videoTitle || 'Анализирано съдържание',
    videoAuthor: videoAuthor || rawResponse.videoAuthor || 'Неизвестен автор',
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
      credibilityIndex, manipulationIndex, unverifiablePercent: 0.1,
      finalClassification: mapAssessment(rawResponse.overallAssessment),
      overallSummary: (rawResponse.summary || 'Анализът е завършен.') + metadataSection,
      totalDuration: fullMetadata?.durationFormatted || 'N/A',
      detailedStats: rawResponse.detailedMetrics ? {
        // Use REAL metrics from Gemini, not hardcoded values!
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
        // Fallback only if detailedMetrics is not provided
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
      finalInvestigativeReport: rawResponse.finalInvestigativeReport || constructedReport,
      // Use REAL values from Gemini response, not hardcoded "Няма данни"
      geopoliticalContext: rawResponse.geopoliticalContext || 'Неприложимо',
      historicalParallel: rawResponse.historicalParallel || 'Няма данни',
      psychoLinguisticAnalysis: rawResponse.psychoLinguisticAnalysis || 'Няма данни',
      strategicIntent: rawResponse.strategicIntent || 'Няма данни',
      narrativeArchitecture: rawResponse.narrativeArchitecture || 'Няма данни',
      technicalForensics: rawResponse.technicalForensics || 'Няма данни',
      socialImpactPrediction: rawResponse.socialImpactPrediction || rawResponse.recommendations || 'Няма данни',
      sourceNetworkAnalysis: 'Няма данни', // This field is not in the prompt yet
      dataPointsProcessed: claims.length * 10
    }
  };
};

/**
 * Standard YouTube analysis - uses video directly
 */
export const analyzeYouTubeStandard = async (url: string, videoMetadata?: YouTubeVideoMetadata): Promise<AnalysisResponse> => {
  try {
    // Use YouTube URL directly with fileData.fileUri (official method from Gemini docs)
    // This is exactly how Google AI Studio does it - Gemini analyzes the video directly
    const data = await callGeminiAPI({
      const data = await callGeminiAPI({
        model: 'gemini-3-pro-preview', // User requested Gemini 3 Pro
        prompt: getAnalysisPrompt(url, 'video', '') + (videoMetadata ? `\n\nVideo Context: Title: "${videoMetadata.title}", Author: "${videoMetadata.author}", Duration: ${videoMetadata.durationFormatted}.` : ''),
        systemInstruction: "You are an ELITE fact-checker and investigative journalist with 20+ years of experience. Your mission is to create an EXCEPTIONAL, CRITICAL, and OBJECTIVE analysis that reveals all hidden viewpoints, manipulations, and facts. CRITICAL INSTRUCTIONS: 1) Watch and analyze ALL video frames and listen to ALL audio content. 2) Extract ALL important claims, quotes, and manipulations - for long videos (30+ minutes): MINIMUM 20-30 claims and 15-20 manipulations. 3) For videos with guests, identify REAL NAMES of participants from the video/transcript - use 'Speaker 1', 'Speaker 2' only if names are not mentioned. 4) Extract FULL quotes, not shortened ones - include complete context. 5) Verify EVERY claim against reliable sources, statistics, historical facts, expert opinions. 6) Provide unique factual comparisons with other sources. 7) Analyze visual elements (charts, images, body language). 8) Analyze audio tone, emotions, intonation. 9) Use REAL data only - DO NOT fabricate. 10) Output all text in BULGARIAN. 11) Keep JSON Enum values in English. 12) Create a FINAL INVESTIGATIVE REPORT that is a masterpiece of journalism - critical, objective, fact-based, with unique comparisons, revealing all hidden viewpoints. The report should be so good that users say 'WOW - this is something great'. Minimum 15-20 paragraphs with detailed analysis.",
        videoUrl: url // This will be sent as fileData.fileUri in server.js
      });

      // Extract transcript from the video for display (optional, for reference)
      let transcription: TranscriptionLine[] = [];
      try {
        transcription = await extractYouTubeTranscript(url);
      } catch(transcriptError: any) {
        // Transcript extraction is optional - continue without it
      }

    // Validate response before parsing
    if(!data.text || typeof data.text !== 'string') {
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
  const parsed = transformGeminiResponse(rawResponse, videoMetadata?.title, videoMetadata?.author, videoMetadata, transcription.length > 0 ? transcription : undefined);

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
    pointsCost: data.points?.deducted || calculateCostInPoints(
      'gemini-3-flash-preview',
      data.usageMetadata?.promptTokenCount || 0,
      data.usageMetadata?.candidatesTokenCount || 0,
      false
    )
  };

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
    // Extract transcript first
    let transcription: TranscriptionLine[] = [];
    try {
      transcription = await extractYouTubeTranscript(url);
    } catch (transcriptError: any) {
    }

    // Build prompt with transcript if available
    const transcriptText = transcription.length > 0
      ? transcription.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')
      : '';

    const transcriptSection = transcriptText
      ? `\n\nТранскрипция на видеото:\n${transcriptText}`
      : '';

    // Use same analysis as standard, but we'll apply batch pricing in cost calculation
    const data = await callGeminiAPI({
      model: 'gemini-3-flash-preview',
      prompt: getAnalysisPrompt(url, 'video', transcriptText),
      systemInstruction: "You are an expert FactChecker AI. Your task is to analyze content and produce a detailed report. CRITICAL INSTRUCTION: You MUST output all free-form text (summaries, explanations, recommendations, reasoning) in BULGARIAN language. However, you MUST keep specific JSON Enum values in English as strict constants: 'TRUE', 'MOSTLY_TRUE', 'PARTLY_TRUE', 'MISLEADING', 'FALSE', 'UNVERIFIABLE', 'ACCURATE', 'MOSTLY_ACCURATE', 'MIXED', 'INACCURATE', 'FABRICATED', 'LEFT', 'CENTER_LEFT', 'CENTER', 'CENTER_RIGHT', 'RIGHT'. Do not translate these Enum values. Everything else must be in Bulgarian. Ensure the analysis is thorough and detailed.",
      videoUrl: url, // Still analyze video, but use batch pricing
      isBatch: true // Activate batch pricing logic
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
    const parsed = transformGeminiResponse(rawResponse, undefined, undefined, undefined, transcription);

    // Apply batch pricing (50% discount)
    const usage: APIUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      estimatedCostUSD: calculateCostFromPricing(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        true // Use batch pricing (50% discount)
      ),
      pointsCost: data.points?.deducted || calculateCostInPoints(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        true // Use batch pricing (50% discount)
      )
    };

    return { analysis: parsed, usage };
  } catch (e: any) {
    const appError = handleApiError(e);
    throw appError;
  }
};

/**
 * Quick analysis - extracts transcript first, then analyzes only text (no video processing)
 * This is faster and cheaper than standard analysis
 */
export const analyzeYouTubeQuick = async (url: string): Promise<AnalysisResponse> => {
  try {
    // 1. Extract transcript (text-only, no video processing)
    let transcription: TranscriptionLine[] = [];
    try {
      transcription = await extractYouTubeTranscript(url);
    } catch (transcriptError: any) {
      // If transcript extraction fails, we can't do quick analysis
      throw new Error('Бързият анализ изисква транскрипция. Видеото може да няма налична транскрипция. Моля, опитайте със Standard режим.');
    }

    // Check for transcript extraction errors more precisely
    // Error messages from extractYouTubeTranscript start with "Грешка при извличане на транскрипция:"
    // We check for this specific pattern, not just the word "Грешка" which could appear in legitimate content
    const isErrorTranscript = transcription.length === 1 &&
      transcription[0].speaker === 'Система' &&
      transcription[0].text.startsWith('Грешка при извличане на транскрипция:');

    if (transcription.length === 0 || isErrorTranscript) {
      throw new Error('Транскрипцията не е налична за това видео. Моля, опитайте със Standard режим за пълен видео анализ.');
    }

    // 2. Build transcript text for analysis
    const transcriptText = transcription.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n');

    // 3. Analyze only the text (no video URL sent to Gemini - this saves cost and time)
    const data = await callGeminiAPI({
      model: 'gemini-3-flash-preview',
      prompt: getAnalysisPrompt(url, 'video', transcriptText) + `\n\nВАЖНО: Това е бърз анализ само на текста. Не изпращам видеото, защото това е Quick режим. Анализирай само предоставения текст.`,
      systemInstruction: "Ти си експерт фактчекър. Анализирай само предоставения текст от транскрипцията. CRITICAL INSTRUCTION: You MUST output all free-form text (summaries, explanations, recommendations, reasoning) in BULGARIAN language. However, you MUST keep specific JSON Enum values in English as strict constants: 'TRUE', 'MOSTLY_TRUE', 'PARTLY_TRUE', 'MISLEADING', 'FALSE', 'UNVERIFIABLE', 'ACCURATE', 'MOSTLY_ACCURATE', 'MIXED', 'INACCURATE', 'FABRICATED', 'LEFT', 'CENTER_LEFT', 'CENTER', 'CENTER_RIGHT', 'RIGHT'. Do not translate these Enum values. Everything else must be in Bulgarian. Ensure the analysis is thorough and detailed.",
      // НЕ изпращай videoUrl - това е Quick режим, само текст анализ
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

    // 4. Transform response (use transcription we extracted)
    const parsed = transformGeminiResponse(rawResponse, undefined, undefined, undefined, transcription);

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
      pointsCost: data.points?.deducted || calculateCostInPoints(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      )
    };

    return { analysis: parsed, usage };
  } catch (e: any) {
    const appError = handleApiError(e);
    throw appError;
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
      model: 'gemini-3-flash-preview',
      prompt: getAnalysisPrompt(url, 'news') + `\n\nNews URL: ${url}`,
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
    const parsed = transformGeminiResponse(rawResponse);

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
      pointsCost: data.points?.deducted || calculateCostInPoints(
        'gemini-3-flash-preview',
        data.usageMetadata?.promptTokenCount || 0,
        data.usageMetadata?.candidatesTokenCount || 0,
        false
      )
    };

    return { analysis: parsed, usage };
  } catch (e: any) {
    const appError = handleApiError(e);
    throw appError;
  }
};

/**
 * Estimate costs for different analysis modes
 */
export const estimateCosts = (durationSeconds: number): Record<string, CostEstimate> => {
  // Base tokens estimation (approx 2 tokens per second for video+audio)
  const baseTokens = Math.floor(durationSeconds * 2);
  const minutes = Math.ceil(durationSeconds / 60);

  // Estimations
  const quickTokens = Math.floor(baseTokens * 0.5); // Text only is cheaper
  const standardTokens = baseTokens;

  return {
    quick: {
      mode: 'quick',
      estimatedTokens: quickTokens,
      estimatedCostUSD: calculateCostFromPricing('gemini-3-flash-preview', quickTokens, quickTokens / 4, false),
      pointsCost: calculateCostInPoints('gemini-3-flash-preview', quickTokens, quickTokens / 4, false),
      estimatedTime: `~${Math.max(1, Math.ceil(minutes * 0.3))} мин`,
      features: ['Бърз анализ на текстово съдържание', 'Само транскрипция']
    },
    standard: {
      mode: 'standard',
      estimatedTokens: standardTokens,
      estimatedCostUSD: calculateCostFromPricing('gemini-3-flash-preview', standardTokens, standardTokens / 2, false),
      pointsCost: calculateCostInPoints('gemini-3-flash-preview', standardTokens, standardTokens / 2, false),
      estimatedTime: `~${Math.max(1, minutes)} мин`,
      features: ['Пълен анализ на видео и аудио', 'Визуален контекст']
    },
    batch: {
      mode: 'batch',
      estimatedTokens: standardTokens,
      estimatedCostUSD: calculateCostFromPricing('gemini-3-flash-preview', standardTokens, standardTokens / 2, true),
      pointsCost: calculateCostInPoints('gemini-3-flash-preview', standardTokens, standardTokens / 2, true),
      estimatedTime: `~${Math.max(2, minutes * 2)} мин`,
      features: ['Пакетна обработка', 'По-евтино', 'По-бавно']
    }
  };
};