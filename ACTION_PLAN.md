# ДЕТАЙЛЕН ПЛАН ЗА ОПРАВЯНЕ НА КРИТИЧНИ И ВИСОКОПРИОРИТЕТНИ ПРОБЛЕМИ

## 🎯 ЦЕЛ
Създаване на перфектно работещо приложение, което **РЕАЛНО** анализира съдържание без фалшиви данни или заблуждаващи показатели.

---

## 📋 ОБЩ ПРЕГЛЕД НА ПЛАНА

**Общо време**: 4-5 седмици интензивна работа  
**Приоритет**: Критични → Високи → Допълнителни функции

---

## 🔴 ФАЗА 1: КРИТИЧНИ ПОПРАВКИ (Седмица 1-2)

### ЗАДАЧА 1.1: Премахване на хардкоднати API ключове
**Приоритет**: 🔴 КРИТИЧНО  
**Време**: 2 часа  
**Файлове**: `services/youtubeMetadataService.ts`, `.gitignore`

#### Стъпки:

1. **Премахни fallback стойностите от кода**
   ```typescript
   // ПРЕДИ (services/youtubeMetadataService.ts:52)
   const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyDMGwG0MQsyHiFXYoKiHXYhVWBkaHDKSRQ';
   
   // СЛЕД
   const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
   if (!apiKey) {
     throw new Error('VITE_YOUTUBE_API_KEY не е конфигуриран. Моля, добавете го в .env файла.');
   }
   ```

2. **Добави `.env` в `.gitignore`**
   ```gitignore
   # Добави в .gitignore
   .env
   .env.local
   .env.*.local
   ```

3. **Създай `.env.example` файл**
   ```env
   # YouTube Data API v3 Key
   VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
   
   # Gemini API Key (server-side only)
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Обнови README с инструкции**
   - Как да се получи YouTube API ключ
   - Как да се получи Gemini API ключ
   - Как да се конфигурира `.env`

**Тест**: Провери дали приложението хвърля ясна грешка ако ключовете липсват

---

### ЗАДАЧА 1.2: Оправяне на Gemini API интеграцията за YouTube видеа
**Приоритет**: 🔴 КРИТИЧНО  
**Време**: 4-6 часа  
**Файлове**: `server.js`, `services/geminiService.ts`

#### Проблем:
Gemini 2.0 Flash НЕ поддържа директно YouTube URL като `fileUri`. Трябва да използваме YouTube URL директно в prompt-а.

#### Стъпки:

1. **Провери документацията на Gemini за YouTube поддръжка**
   - Gemini 2.0 Flash поддържа YouTube URL директно в текста на prompt-а
   - НЕ използвай `fileUri` за YouTube URL

2. **Оправи `server.js`**
   ```javascript
   // ПРЕДИ (server.js:52-59)
   if (videoUrl) {
       requestPayload.contents.push({
           role: 'user',
           parts: [
               { fileData: { fileUri: videoUrl } },  // ❌ ГРЕШКА!
               { text: prompt }
           ]
       });
   }
   
   // СЛЕД
   if (videoUrl) {
       // Проверка дали е YouTube URL
       const isYouTubeUrl = /(?:youtube\.com|youtu\.be)/.test(videoUrl);
       
       if (isYouTubeUrl) {
           // Gemini поддържа YouTube URL директно в текста
           requestPayload.contents.push({
               role: 'user',
               parts: [
                   { text: `YouTube Video URL: ${videoUrl}\n\n${prompt}` }
               ]
           });
       } else {
           // За други URL-и (ако има файлове в GCS/GDrive)
           requestPayload.contents.push({
               role: 'user',
               parts: [
                   { fileData: { fileUri: videoUrl } },
                   { text: prompt }
               ]
           });
       }
   }
   ```

3. **Тествай с реално YouTube видео**
   - Изпрати заявка с валиден YouTube URL
   - Провери дали Gemini получава и анализира видеото
   - Провери дали отговорът съдържа реални данни за видеото

**Тест**: Тествай с 3 различни YouTube видеа и провери дали анализът е релевантен

---

### ЗАДАЧА 1.3: Имплементиране на реална транскрипция
**Приоритет**: 🔴 КРИТИЧНО  
**Време**: 6-8 часа  
**Файлове**: `services/youtubeTranscriptService.ts`, `services/geminiService.ts`

#### Стъпки:

1. **Използвай `youtube-transcript` библиотека или Gemini за транскрипция**

   **Вариант A: Използвай Gemini за транскрипция** (по-надеждно)
   ```typescript
   // services/youtubeTranscriptService.ts
   export const extractYouTubeTranscript = async (url: string): Promise<TranscriptionLine[]> => {
     try {
       const response = await fetch('/api/gemini/generate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           model: 'gemini-2.0-flash-exp',
           prompt: `Извлечи пълната транскрипция от това YouTube видео: ${url}
           
           Върни резултата като JSON масив в следния формат:
           [
             {
               "timestamp": "00:00",
               "speaker": "Speaker 1",
               "text": "Текст на реченицата..."
             },
             ...
           ]
           
           Важно: Включи всички реченици с техните timestamp-и.`,
           systemInstruction: 'Ти си експерт в извличане на транскрипции. Връщай само валиден JSON, без допълнителен текст.'
         })
       });
   
       if (!response.ok) {
         throw new Error('Грешка при извличане на транскрипция');
       }
   
       const data = await response.json();
       const cleaned = cleanJsonResponse(data.text);
       const transcript = JSON.parse(cleaned);
       
       return Array.isArray(transcript) ? transcript : [];
     } catch (error: any) {
       console.error('Transcript extraction error:', error);
       throw new Error(error.message || 'Грешка при извличане на транскрипция');
     }
   };
   ```

   **Вариант B: Използвай `youtube-transcript` npm пакет** (по-бързо, но по-малко надеждно)
   ```bash
   npm install youtube-transcript
   ```
   ```typescript
   import { YoutubeTranscript } from 'youtube-transcript';
   
   export const extractYouTubeTranscript = async (url: string): Promise<TranscriptionLine[]> => {
     try {
       const videoId = extractVideoId(url);
       if (!videoId) throw new Error('Невалиден YouTube URL');
       
       const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
         lang: 'bg,en' // Първо български, после английски
       });
       
       return transcriptData.map((item, idx) => ({
         timestamp: formatTimestamp(item.offset),
         speaker: 'Speaker', // YouTube не предоставя информация за говорители
         text: item.text
       }));
     } catch (error: any) {
       // Fallback към Gemini ако youtube-transcript не работи
       return extractTranscriptViaGemini(url);
     }
   };
   ```

2. **Интегрирай транскрипцията в `geminiService.ts`**
   ```typescript
   // В analyzeYouTubeStandard и analyzeYouTubeQuick
   import { extractYouTubeTranscript } from './youtubeTranscriptService';
   
   export const analyzeYouTubeStandard = async (url: string, videoMetadata?: YouTubeVideoMetadata): Promise<AnalysisResponse> => {
     try {
       // Първо извлечи транскрипцията
       const transcription = await extractYouTubeTranscript(url);
       
       // След това анализирай видеото с транскрипцията
       const data = await callGeminiAPI({
         model: 'gemini-2.0-flash-exp',
         prompt: getAnalysisPrompt(url, 'video') + `\n\nТранскрипция:\n${transcription.map(t => `[${t.timestamp}] ${t.text}`).join('\n')}`,
         systemInstruction: "...",
         videoUrl: url // Gemini ще анализира и видеото
       });
       
       // ... останалата логика
       
       // Използвай реалната транскрипция
       const parsed = transformGeminiResponse(rawResponse, videoMetadata?.title, videoMetadata?.author, videoMetadata, transcription);
       
       return { analysis: parsed, usage };
     } catch (e: any) {
       // ...
     }
   };
   ```

3. **Обнови `transformGeminiResponse` да приема транскрипция**
   ```typescript
   const transformGeminiResponse = (
     rawResponse: any,
     videoTitle?: string,
     videoAuthor?: string,
     fullMetadata?: YouTubeVideoMetadata,
     transcription?: TranscriptionLine[] // ДОБАВИ
   ): VideoAnalysis => {
     return {
       // ...
       transcription: transcription || [{
         timestamp: '00:00',
         speaker: 'Система',
         text: 'Транскрипцията не беше налична.'
       }],
       // ...
     };
   };
   ```

**Тест**: Тествай с видео, което има транскрипция, и провери дали се показва правилно

---

### ЗАДАЧА 1.4: Оправяне на изчисляването на разходите
**Приоритет**: 🔴 КРИТИЧНО  
**Време**: 3-4 часа  
**Файлове**: `services/geminiService.ts`, `services/costEstimationService.ts`

#### Стъпки:

1. **Провери официалните цени на Gemini 2.0 Flash Experimental**
   - Провери в Google AI Studio или документацията
   - Актуализирай цените според реалните тарифи

2. **Унифицирай цените в един файл**
   ```typescript
   // services/pricing.ts (НОВ ФАЙЛ)
   export const GEMINI_PRICING = {
     'gemini-2.0-flash-exp': {
       input: 0.075,   // $0.075 per 1M input tokens
       output: 0.30,   // $0.30 per 1M output tokens
     },
     'gemini-2.0-flash-exp-batch': {
       input: 0.0375, // 50% отстъпка за batch
       output: 0.15,   // 50% отстъпка за batch
     }
   };
   
   export const calculateCost = (
     model: string,
     promptTokens: number,
     candidatesTokens: number,
     isBatch: boolean = false
   ): number => {
     const modelKey = isBatch ? `${model}-batch` : model;
     const pricing = GEMINI_PRICING[modelKey as keyof typeof GEMINI_PRICING] || GEMINI_PRICING['gemini-2.0-flash-exp'];
     
     const inputCost = (promptTokens / 1_000_000) * pricing.input;
     const outputCost = (candidatesTokens / 1_000_000) * pricing.output;
     
     return inputCost + outputCost;
   };
   ```

3. **Обнови `geminiService.ts`**
   ```typescript
   import { calculateCost } from './pricing';
   
   // Премахни старата calculateCost функция
   // Използвай новата
   const usage: APIUsage = {
     promptTokens: data.usageMetadata?.promptTokenCount || 0,
     candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
     totalTokens: data.usageMetadata?.totalTokenCount || 0,
     estimatedCostUSD: calculateCost('gemini-2.0-flash-exp', 
       data.usageMetadata?.promptTokenCount || 0,
       data.usageMetadata?.candidatesTokenCount || 0,
       false
     )
   };
   ```

4. **Обнови `costEstimationService.ts`**
   ```typescript
   import { GEMINI_PRICING } from './pricing';
   
   export const calculateCostEstimate = (
     mode: AnalysisMode,
     durationSeconds: number
   ): CostEstimate => {
     // Използвай правилните цени от pricing.ts
     const pricing = GEMINI_PRICING['gemini-2.0-flash-exp'];
     // ... останалата логика
   };
   ```

**Тест**: Провери дали изчислените разходи съответстват на реалните разходи от Gemini API

---

## 🟠 ФАЗА 2: ВИСОКОПРИОРИТЕТНИ ПОПРАВКИ (Седмица 2-3)

### ЗАДАЧА 2.1: Имплементиране на Quick режим
**Приоритет**: 🟠 ВИСОКО  
**Време**: 6-8 часа  
**Файлове**: `services/geminiService.ts`

#### Стъпки:

1. **Quick режим трябва да:**
   - Извлича само транскрипцията (без видео анализ)
   - Анализира само текста
   - Бъде по-бърз и по-евтин

2. **Имплементирай `analyzeYouTubeQuick`**
   ```typescript
   export const analyzeYouTubeQuick = async (url: string): Promise<AnalysisResponse> => {
     try {
       // 1. Извлечи транскрипцията
       const transcription = await extractYouTubeTranscript(url);
       const transcriptText = transcription.map(t => `[${t.timestamp}] ${t.text}`).join('\n');
       
       // 2. Анализирай само текста (без видео)
       const data = await callGeminiAPI({
         model: 'gemini-2.0-flash-exp',
         prompt: `Анализирай следния текст от YouTube видео за фактическа точност, bias и манипулативни техники.
         
         Текст:
         ${transcriptText}
         
         ${getAnalysisPrompt(url, 'video')}`,
         systemInstruction: "Ти си експерт фактчекър. Анализирай само предоставения текст. Връщай детайлен анализ в JSON формат.",
         // НЕ изпращай videoUrl - само текст анализ
       });
       
       const cleanedText = cleanJsonResponse(data.text);
       const rawResponse = JSON.parse(cleanedText);
       
       // 3. Трансформирай отговора
       const parsed = transformGeminiResponse(rawResponse, undefined, undefined, undefined, transcription);
       
       const usage: APIUsage = {
         promptTokens: data.usageMetadata?.promptTokenCount || 0,
         candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
         totalTokens: data.usageMetadata?.totalTokenCount || 0,
         estimatedCostUSD: calculateCost('gemini-2.0-flash-exp',
           data.usageMetadata?.promptTokenCount || 0,
           data.usageMetadata?.candidatesTokenCount || 0,
           false
         )
       };
       
       return { analysis: parsed, usage };
     } catch (e: any) {
       throw new Error(e.message || "Грешка при бързия анализ.");
     }
   };
   ```

**Тест**: Тествай Quick режим и провери дали е по-бърз и по-евтин от Standard

---

### ЗАДАЧА 2.2: Имплементиране на Batch режим
**Приоритет**: 🟠 ВИСОКО  
**Време**: 8-10 часа  
**Файлове**: `services/geminiService.ts`, `server.js`

#### Стъпки:

1. **Batch режим трябва да:**
   - Използва Gemini Batch API (ако е наличен)
   - Или използва по-евтиния batch модел
   - Да е по-бавен, но по-евтин

2. **Провери дали Gemini поддържа Batch API**
   - Ако да, използвай него
   - Ако не, използвай `gemini-2.0-flash-exp-batch` модел (ако съществува)

3. **Имплементирай `analyzeYouTubeBatch`**
   ```typescript
   export const analyzeYouTubeBatch = async (url: string): Promise<AnalysisResponse> => {
     try {
       // Използвай batch модел или стандартен с batch pricing
       const model = 'gemini-2.0-flash-exp'; // Или batch модел ако съществува
       const isBatch = true;
       
       const transcription = await extractYouTubeTranscript(url);
       const transcriptText = transcription.map(t => `[${t.timestamp}] ${t.text}`).join('\n');
       
       const data = await callGeminiAPI({
         model: model,
         prompt: getAnalysisPrompt(url, 'video') + `\n\nТранскрипция:\n${transcriptText}`,
         systemInstruction: "...",
         videoUrl: url
       });
       
       // ... останалата логика
       
       const usage: APIUsage = {
         // ...
         estimatedCostUSD: calculateCost(model, 
           data.usageMetadata?.promptTokenCount || 0,
           data.usageMetadata?.candidatesTokenCount || 0,
           isBatch // Използвай batch цени
         )
       };
       
       return { analysis: parsed, usage };
     } catch (e: any) {
       throw new Error(e.message || "Грешка при batch анализ.");
     }
   };
   ```

**Тест**: Тествай Batch режим и провери дали разходите са по-ниски

---

### ЗАДАЧА 2.3: Подобряване на Gemini prompt-а
**Приоритет**: 🟠 ВИСОКО  
**Време**: 4-6 часа  
**Файлове**: `services/geminiService.ts`

#### Стъпки:

1. **Създай детайлен, структуриран prompt**
   ```typescript
   const getDetailedAnalysisPrompt = (url: string, type: 'video' | 'news', transcript?: string) => {
     return `Ти си професионален фактчекър и медиен анализатор. Твоята задача е да анализираш ${type === 'video' ? 'видео' : 'статия'} и да предоставиш изчерпателен анализ.

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

   ${transcript ? `\nТРАНСКРИПЦИЯ:\n${transcript}` : ''}

   Върни резултата като JSON в следния формат:
   {
     "summary": "Кратко резюме на 2-3 изречения на български",
     "overallAssessment": "ACCURATE" | "MOSTLY_ACCURATE" | "MIXED" | "MISLEADING" | "FALSE",
     "factualClaims": [
       {
         "claim": "Конкретното твърдение",
         "verdict": "TRUE" | "MOSTLY_TRUE" | "MIXED" | "MOSTLY_FALSE" | "FALSE" | "UNVERIFIABLE",
         "evidence": "Доказателство или опровержение на български",
         "sources": ["URL на надежден източник"],
         "confidence": 0.0-1.0
       }
     ],
     "biasIndicators": {
       "politicalBias": "LEFT" | "CENTER_LEFT" | "CENTER" | "CENTER_RIGHT" | "RIGHT" | "UNCLEAR",
       "emotionalLanguage": "Примери на емоционално зареден език на български",
       "selectiveReporting": "Доказателства за cherry-picking на факти на български"
     },
     "manipulationTechniques": [
       {
         "technique": "Име на техниката на български",
         "description": "Как се използва на български",
         "timestamp": "Приблизителен timestamp",
         "severity": 0.0-1.0
       }
     ],
     "detailedMetrics": {
       "factualAccuracy": 0.0-1.0,
       "logicalSoundness": 0.0-1.0,
       "emotionalBias": 0.0-1.0,
       "propagandaScore": 0.0-1.0,
       "sourceReliability": 0.0-1.0,
       "subjectivityScore": 0.0-1.0,
       "objectivityScore": 0.0-1.0,
       "biasIntensity": 0.0-1.0,
       "narrativeConsistencyScore": 0.0-1.0,
       "semanticDensity": 0.0-1.0,
       "contextualStability": 0.0-1.0
     },
     "geopoliticalContext": "Детайлен анализ на геополитическия контекст на български",
     "historicalParallel": "Исторически паралели и контекст на български",
     "psychoLinguisticAnalysis": "Психолингвистичен анализ на български",
     "strategicIntent": "Анализ на стратегическото намерение на български",
     "narrativeArchitecture": "Анализ на наративната архитектура на български",
     "technicalForensics": "Техническа експертиза на български",
     "socialImpactPrediction": "Прогноза за социално въздействие на български",
     "recommendations": "Препоръки за потребителите на български"
   }`;
   };
   ```

2. **Обнови `transformGeminiResponse` да използва реалните метрики**
   ```typescript
   const transformGeminiResponse = (
     rawResponse: any,
     videoTitle?: string,
     videoAuthor?: string,
     fullMetadata?: YouTubeVideoMetadata,
     transcription?: TranscriptionLine[]
   ): VideoAnalysis => {
     // Използвай РЕАЛНИТЕ метрики от Gemini, не хардкоднати!
     const detailedStats = rawResponse.detailedMetrics || {
       factualAccuracy: rawResponse.factualClaims?.length > 0 
         ? rawResponse.factualClaims.filter((c: any) => ['TRUE', 'MOSTLY_TRUE'].includes(c.verdict)).length / rawResponse.factualClaims.length
         : 0.5,
       logicalSoundness: 0.5,
       emotionalBias: 0.5,
       propagandaScore: 0.5,
       sourceReliability: 0.5,
       subjectivityScore: 0.5,
       objectivityScore: 0.5,
       biasIntensity: 0.5,
       narrativeConsistencyScore: 0.7,
       semanticDensity: 0.6,
       contextualStability: 0.6
     };
     
     return {
       // ...
       summary: {
         // ...
         detailedStats: detailedStats, // Използвай реалните метрики!
         finalInvestigativeReport: rawResponse.summary || 'N/A',
         geopoliticalContext: rawResponse.geopoliticalContext || 'N/A',
         historicalParallel: rawResponse.historicalParallel || 'N/A',
         psychoLinguisticAnalysis: rawResponse.psychoLinguisticAnalysis || 'N/A',
         strategicIntent: rawResponse.strategicIntent || 'N/A',
         narrativeArchitecture: rawResponse.narrativeArchitecture || 'N/A',
         technicalForensics: rawResponse.technicalForensics || 'N/A',
         socialImpactPrediction: rawResponse.socialImpactPrediction || 'N/A',
         // ...
       }
     };
   };
   ```

**Тест**: Тествай с различни видеа и провери дали всички метрики са реални и релевантни

---

### ЗАДАЧА 2.4: Добавяне на валидация на URL
**Приоритет**: 🟠 ВИСОКО  
**Време**: 2-3 часа  
**Файлове**: `App.tsx`, `services/validation.ts` (нов)

#### Стъпки:

1. **Създай `services/validation.ts`**
   ```typescript
   export const validateYouTubeUrl = (url: string): { valid: boolean; error?: string } => {
     if (!url.trim()) {
       return { valid: false, error: 'Моля, въведете URL' };
     }
     
     const youtubePatterns = [
       /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
       /^https?:\/\/youtube\.com\/watch\?v=[\w-]+/,
       /^https?:\/\/youtu\.be\/[\w-]+/,
       /^https?:\/\/youtube\.com\/embed\/[\w-]+/
     ];
     
     const isValid = youtubePatterns.some(pattern => pattern.test(url));
     
     if (!isValid) {
       return { valid: false, error: 'Невалиден YouTube URL. Моля, използвайте формат: https://www.youtube.com/watch?v=...' };
     }
     
     return { valid: true };
   };
   
   export const validateNewsUrl = (url: string): { valid: boolean; error?: string } => {
     if (!url.trim()) {
       return { valid: false, error: 'Моля, въведете URL' };
     }
     
     try {
       new URL(url);
       return { valid: true };
     } catch {
       return { valid: false, error: 'Невалиден URL формат' };
     }
   };
   ```

2. **Обнови `App.tsx`**
   ```typescript
   import { validateYouTubeUrl, validateNewsUrl } from './services/validation';
   
   const handleStartAnalysis = async (type: 'video' | 'news') => {
     const url = type === 'video' ? youtubeUrl : newsUrl;
     
     // Валидация
     const validation = type === 'video' 
       ? validateYouTubeUrl(url)
       : validateNewsUrl(url);
     
     if (!validation.valid) {
       setError(validation.error || 'Невалиден URL');
       return;
     }
     
     // ... останалата логика
   };
   ```

**Тест**: Тествай с невалидни URL-и и провери дали се показват ясни съобщения за грешка

---

## 🟢 ФАЗА 3: ДОПЪЛНИТЕЛНИ ПОЛЕЗНИ ФУНКЦИИ (Седмица 3-4)

### ЗАДАЧА 3.1: Добавяне на Error Boundaries
**Приоритет**: 🟢 СРЕДНО  
**Време**: 2-3 часа  
**Файлове**: `components/ErrorBoundary.tsx` (нов), `App.tsx`

#### Стъпки:

1. **Създай `components/ErrorBoundary.tsx`**
   ```typescript
   import React, { Component, ErrorInfo, ReactNode } from 'react';
   
   interface Props {
     children: ReactNode;
   }
   
   interface State {
     hasError: boolean;
     error?: Error;
   }
   
   export class ErrorBoundary extends Component<Props, State> {
     constructor(props: Props) {
       super(props);
       this.state = { hasError: false };
     }
   
     static getDerivedStateFromError(error: Error): State {
       return { hasError: true, error };
     }
   
     componentDidCatch(error: Error, errorInfo: ErrorInfo) {
       console.error('ErrorBoundary caught an error:', error, errorInfo);
       // Тук можеш да изпратиш грешката към error tracking service
     }
   
     render() {
       if (this.state.hasError) {
         return (
           <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
             <div className="max-w-md w-full bg-white p-8 rounded-lg border border-red-200">
               <h2 className="text-2xl font-black text-red-700 mb-4">Грешка в приложението</h2>
               <p className="text-slate-700 mb-4">
                 Възникна неочаквана грешка. Моля, опитайте отново или се свържете с поддръжката.
               </p>
               <button
                 onClick={() => {
                   this.setState({ hasError: false, error: undefined });
                   window.location.reload();
                 }}
                 className="bg-slate-900 text-white px-6 py-2 rounded font-bold hover:bg-black transition"
               >
                 Презареди страницата
               </button>
             </div>
           </div>
         );
       }
   
       return this.props.children;
     }
   }
   ```

2. **Обвий App в ErrorBoundary**
   ```typescript
   // index.tsx
   import { ErrorBoundary } from './components/ErrorBoundary';
   
   root.render(
     <React.StrictMode>
       <ErrorBoundary>
         <App />
       </ErrorBoundary>
     </React.StrictMode>
   );
   ```

---

### ЗАДАЧА 3.2: Подобряване на обработката на грешки
**Приоритет**: 🟢 СРЕДНО  
**Време**: 3-4 часа  
**Файлове**: `services/errorHandler.ts` (нов), всички service файлове

#### Стъпки:

1. **Създай централизиран error handler**
   ```typescript
   // services/errorHandler.ts
   export class AppError extends Error {
     constructor(
       message: string,
       public code: string,
       public statusCode?: number,
       public retryable: boolean = false
     ) {
       super(message);
       this.name = 'AppError';
     }
   }
   
   export const handleApiError = (error: any): AppError => {
     // Rate limit
     if (error.message?.includes('429') || error.status === 429) {
       return new AppError(
         'Превишена е квотата за заявки. Моля, изчакайте 1 минута преди следващата заявка.',
         'RATE_LIMIT',
         429,
         true
       );
     }
     
     // Network error
     if (error.message?.includes('fetch') || error.message?.includes('network')) {
       return new AppError(
         'Проблем с мрежовата връзка. Моля, проверете интернет връзката си.',
         'NETWORK_ERROR',
         undefined,
         true
       );
     }
     
     // API key error
     if (error.message?.includes('API key') || error.message?.includes('401') || error.status === 401) {
       return new AppError(
         'Грешка с API ключа. Моля, проверете конфигурацията.',
         'API_KEY_ERROR',
         401,
         false
       );
     }
     
     // Default
     return new AppError(
       error.message || 'Възникна неочаквана грешка.',
       'UNKNOWN_ERROR',
       undefined,
       false
     );
   };
   ```

2. **Използвай error handler във всички services**
   ```typescript
   import { handleApiError } from './errorHandler';
   
   try {
     // ... API call
   } catch (e: any) {
     throw handleApiError(e);
   }
   ```

---

### ЗАДАЧА 3.3: Добавяне на retry логика с exponential backoff
**Приоритет**: 🟢 СРЕДНО  
**Време**: 3-4 часа  
**Файлове**: `services/retryHandler.ts` (нов)

#### Стъпки:

1. **Създай retry handler**
   ```typescript
   // services/retryHandler.ts
   export const retryWithBackoff = async <T>(
     fn: () => Promise<T>,
     maxRetries: number = 3,
     initialDelay: number = 1000
   ): Promise<T> => {
     let lastError: Error;
     
     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         return await fn();
       } catch (error: any) {
         lastError = error;
         
         // Не retry-вай ако не е retryable грешка
         if (!error.retryable && attempt < maxRetries) {
           continue;
         }
         
         // Ако не е последният опит, изчакай преди retry
         if (attempt < maxRetries) {
           const delay = initialDelay * Math.pow(2, attempt);
           await new Promise(resolve => setTimeout(resolve, delay));
         }
       }
     }
     
     throw lastError!;
   };
   ```

2. **Използвай в API calls**
   ```typescript
   import { retryWithBackoff } from './retryHandler';
   
   const data = await retryWithBackoff(
     () => callGeminiAPI({ ... }),
     3, // max retries
     1000 // initial delay 1s
   );
   ```

---

### ЗАДАЧА 3.4: Добавяне на валидация на Gemini API отговор
**Приоритет**: 🟢 СРЕДНО  
**Време**: 2-3 часа  
**Файлове**: `services/geminiService.ts`

#### Стъпки:

1. **Добави валидация преди parse**
   ```typescript
   const validateAndParseJson = (text: string): any => {
     if (!text || typeof text !== 'string') {
       throw new Error('Gemini API не върна валиден отговор');
     }
     
     const cleaned = cleanJsonResponse(text);
     
     if (!cleaned) {
       throw new Error('Не може да се извлече JSON от отговора');
     }
     
     try {
       return JSON.parse(cleaned);
     } catch (e: any) {
       console.error('JSON parse error:', e);
       console.error('Cleaned text:', cleaned.substring(0, 500));
       throw new Error('Gemini API върна невалиден JSON формат');
     }
   };
   
   // Използвай във всички места където parse-ваш JSON
   const rawResponse = validateAndParseJson(data.text);
   ```

---

### ЗАДАЧА 3.5: Добавяне на кеширане на резултати
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: `services/cacheService.ts` (нов), `App.tsx`

#### Стъпки:

1. **Създай cache service**
   ```typescript
   // services/cacheService.ts
   interface CacheEntry {
     data: any;
     timestamp: number;
     expiresIn: number; // milliseconds
   }
   
   class CacheService {
     private cache: Map<string, CacheEntry> = new Map();
     private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 часа
     
     set(key: string, data: any, ttl: number = this.DEFAULT_TTL) {
       this.cache.set(key, {
         data,
         timestamp: Date.now(),
         expiresIn: ttl
       });
     }
     
     get(key: string): any | null {
       const entry = this.cache.get(key);
       
       if (!entry) return null;
       
       if (Date.now() - entry.timestamp > entry.expiresIn) {
         this.cache.delete(key);
         return null;
       }
       
       return entry.data;
     }
     
     clear() {
       this.cache.clear();
     }
   }
   
   export const cacheService = new CacheService();
   ```

2. **Използвай в анализ функциите**
   ```typescript
   export const analyzeYouTubeStandard = async (url: string, videoMetadata?: YouTubeVideoMetadata): Promise<AnalysisResponse> => {
     // Провери кеша
     const cacheKey = `analysis:${url}`;
     const cached = cacheService.get(cacheKey);
     if (cached) {
       return cached;
     }
     
     // ... извърши анализ
     
     const result = { analysis: parsed, usage };
     
     // Запази в кеш
     cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000); // 24 часа
     
     return result;
   };
   ```

---

### ЗАДАЧА 3.6: Добавяне на история на анализи
**Приоритет**: 🟢 СРЕДНО  
**Време**: 5-6 часа  
**Файлове**: `services/historyService.ts` (нов), `components/AnalysisHistory.tsx` (нов), `App.tsx`

#### Стъпки:

1. **Създай history service (използвай localStorage)**
   ```typescript
   // services/historyService.ts
   interface AnalysisHistoryEntry {
     id: string;
     url: string;
     title: string;
     author: string;
     timestamp: number;
     analysis: VideoAnalysis;
   }
   
   export const historyService = {
     save(entry: AnalysisHistoryEntry) {
       const history = this.getAll();
       history.unshift(entry);
       // Запази само последните 50
       const limited = history.slice(0, 50);
       localStorage.setItem('analysisHistory', JSON.stringify(limited));
     },
     
     getAll(): AnalysisHistoryEntry[] {
       const stored = localStorage.getItem('analysisHistory');
       return stored ? JSON.parse(stored) : [];
     },
     
     get(id: string): AnalysisHistoryEntry | null {
       return this.getAll().find(e => e.id === id) || null;
     },
     
     clear() {
       localStorage.removeItem('analysisHistory');
     }
   };
   ```

2. **Създай компонент за история**
   ```typescript
   // components/AnalysisHistory.tsx
   // Компонент който показва списък с предишни анализи
   ```

3. **Интегрирай в App.tsx**
   - Добави таб "История"
   - Запазвай всеки анализ в историята
   - Позволи на потребителя да види предишни анализи

---

### ЗАДАЧА 3.7: Добавяне на сравнение между анализи
**Приоритет**: 🟢 СРЕДНО  
**Време**: 6-8 часа  
**Файлове**: `components/ComparisonView.tsx` (нов), `App.tsx`

#### Стъпки:

1. **Създай компонент за сравнение**
   - Позволи на потребителя да избере 2-3 анализа за сравнение
   - Покажи метриките side-by-side
   - Визуализирай разликите

---

### ЗАДАЧА 3.8: Добавяне на експорт в различни формати
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: `services/exportService.ts` (нов), `App.tsx`

#### Стъпки:

1. **Добави експорт в PDF**
   ```typescript
   // Използвай библиотека като jsPDF или html2pdf
   ```

2. **Добави експорт в JSON**
   ```typescript
   export const exportToJson = (analysis: VideoAnalysis) => {
     const dataStr = JSON.stringify(analysis, null, 2);
     const dataBlob = new Blob([dataStr], { type: 'application/json' });
     const url = URL.createObjectURL(dataBlob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `analysis-${analysis.id}.json`;
     link.click();
   };
   ```

3. **Добави експорт в CSV** (за метриките)
   ```typescript
   export const exportMetricsToCsv = (analysis: VideoAnalysis) => {
     const metrics = Object.entries(analysis.summary.detailedStats)
       .map(([key, value]) => `${key},${value}`)
       .join('\n');
     
     const csv = `Metric,Value\n${metrics}`;
     const blob = new Blob([csv], { type: 'text/csv' });
     // ... download logic
   };
   ```

---

### ЗАДАЧА 3.9: Добавяне на прогресивно зареждане
**Приоритет**: 🟢 СРЕДНО  
**Време**: 3-4 часа  
**Файлове**: `App.tsx`, `services/geminiService.ts`

#### Стъпки:

1. **Покажи частични резултати докато анализът се извършва**
   - Покажи транскрипцията веднага след като се извлече
   - Покажи основните метрики веднага след като се изчислят
   - Обновявай UI-то прогресивно

---

### ЗАДАЧА 3.10: Добавяне на източници и линкове към фактчекинг
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: `components/SourcesList.tsx` (нов), `services/geminiService.ts`

#### Стъпки:

1. **Подобри prompt-а да изисква източници**
   - Изисквай Gemini да предоставя линкове към надеждни източници
   - Валидирай линковете преди показване

2. **Създай компонент за показване на източници**
   - Покажи източниците за всяко твърдение
   - Добави линкове към фактчекинг сайтове (Snopes, FactCheck.org и т.н.)

---

### ЗАДАЧА 3.11: Добавяне на статистика и аналитика
**Приоритет**: 🟢 СРЕДНО  
**Време**: 3-4 часа  
**Файлове**: `components/Statistics.tsx` (нов), `App.tsx`

#### Стъпки:

1. **Покажи статистика за анализите**
   - Общ брой анализи
   - Средна достоверност
   - Най-често срещани манипулативни техники
   - Графики с трендове

---

### ЗАДАЧА 3.12: Добавяне на търсене и филтриране
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: `components/SearchAndFilter.tsx` (нов), `App.tsx`

#### Стъпки:

1. **Добави търсене в историята**
   - Търсене по заглавие, автор, URL
   - Филтриране по дата, достоверност, тип анализ

---

### ЗАДАЧА 3.13: Добавяне на споделяне на анализи
**Приоритет**: 🟢 СРЕДНО  
**Време**: 3-4 часа  
**Файлове**: `services/shareService.ts` (нов), `App.tsx`

#### Стъпки:

1. **Добави възможност за споделяне**
   - Генерирай уникален линк за всеки анализ
   - Запази анализа на сървъра (или в cloud storage)
   - Позволи на други да видят анализа чрез линк

---

### ЗАДАЧА 3.14: Добавяне на уведомления
**Приоритет**: 🟢 СРЕДНО  
**Време**: 2-3 часа  
**Файлове**: `services/notificationService.ts` (нов), `App.tsx`

#### Стъпки:

1. **Добави toast уведомления**
   - Използвай библиотека като `react-hot-toast`
   - Покажи уведомления за успешни анализи, грешки, и т.н.

---

### ЗАДАЧА 3.15: Добавяне на dark mode
**Приоритет**: 🟢 НИСКО  
**Време**: 3-4 часа  
**Файлове**: `App.tsx`, `index.css`

#### Стъпки:

1. **Имплементирай dark mode toggle**
   - Запази предпочитанието в localStorage
   - Приложи dark mode стилове

---

### ЗАДАЧА 3.16: Добавяне на accessibility подобрения
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: Всички компоненти

#### Стъпки:

1. **Добави ARIA labels**
2. **Подобри keyboard navigation**
3. **Добави screen reader поддръжка**
4. **Тествай с accessibility tools**

---

### ЗАДАЧА 3.17: Добавяне на unit тестове
**Приоритет**: 🟢 СРЕДНО  
**Време**: 8-10 часа  
**Файлове**: `__tests__/` (нова папка)

#### Стъпки:

1. **Настрой тестова среда**
   ```bash
   npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
   ```

2. **Напиши тестове за:**
   - Валидация функции
   - Трансформация на данни
   - Компоненти
   - Service функции

**Цел**: Покритие > 70%

---

### ЗАДАЧА 3.18: Добавяне на performance оптимизации
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: `App.tsx`, всички компоненти

#### Стъпки:

1. **Добави React.memo където е нужно**
2. **Използвай useMemo за тежки изчисления**
3. **Използвай useCallback за функции**
4. **Code splitting за по-големи компоненти**
5. **Lazy loading на компоненти**

---

### ЗАДАЧА 3.19: Добавяне на мониторинг и логиране
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: `services/logger.ts` (нов), `services/monitoring.ts` (нов)

#### Стъпки:

1. **Създай структуриран logger**
   ```typescript
   // services/logger.ts
   export const logger = {
     info: (message: string, data?: any) => {
       console.log(`[INFO] ${message}`, data);
       // Тук можеш да изпратиш към logging service
     },
     error: (message: string, error?: any) => {
       console.error(`[ERROR] ${message}`, error);
       // Изпрати към error tracking (Sentry и т.н.)
     },
     warn: (message: string, data?: any) => {
       console.warn(`[WARN] ${message}`, data);
     }
   };
   ```

2. **Интегрирай error tracking** (Sentry, LogRocket и т.н.)

---

### ЗАДАЧА 3.20: Добавяне на документация
**Приоритет**: 🟢 СРЕДНО  
**Време**: 4-5 часа  
**Файлове**: Всички service файлове, README.md

#### Стъпки:

1. **Добави JSDoc коментари към всички функции**
2. **Обнови README с:**
   - Детайлни инструкции за инсталация
   - API документация
   - Примери за използване
   - Troubleshooting guide

3. **Създай архитектурна документация**
   - Диаграми на потока на данни
   - Описание на компонентите
   - Описание на services

---

## 📊 ОБОБЩЕНА ВРЕМЕВА ТАБЕЛА

### ФАЗА 1: КРИТИЧНИ (Седмица 1-2)
| Задача | Време | Приоритет |
|--------|-------|-----------|
| Премахване на API ключове | 2ч | 🔴 Критично |
| Оправяне на Gemini API | 4-6ч | 🔴 Критично |
| Реална транскрипция | 6-8ч | 🔴 Критично |
| Оправяне на разходи | 3-4ч | 🔴 Критично |
| **ПОДОБЩО ФАЗА 1** | **15-20ч** | |

### ФАЗА 2: ВИСОКОПРИОРИТЕТНИ (Седмица 2-3)
| Задача | Време | Приоритет |
|--------|-------|-----------|
| Quick режим | 6-8ч | 🟠 Високо |
| Batch режим | 8-10ч | 🟠 Високо |
| Подобряване на prompt | 4-6ч | 🟠 Високо |
| Валидация на URL | 2-3ч | 🟠 Високо |
| **ПОДОБЩО ФАЗА 2** | **20-27ч** | |

### ФАЗА 3: ДОПЪЛНИТЕЛНИ ФУНКЦИИ (Седмица 3-5)
| Задача | Време | Приоритет |
|--------|-------|-----------|
| Error Boundaries | 2-3ч | 🟢 Средно |
| Error handling | 3-4ч | 🟢 Средно |
| Retry логика | 3-4ч | 🟢 Средно |
| Валидация на отговор | 2-3ч | 🟢 Средно |
| Кеширане | 4-5ч | 🟢 Средно |
| История | 5-6ч | 🟢 Средно |
| Сравнение | 6-8ч | 🟢 Средно |
| Експорт (PDF/JSON/CSV) | 4-5ч | 🟢 Средно |
| Прогресивно зареждане | 3-4ч | 🟢 Средно |
| Източници и линкове | 4-5ч | 🟢 Средно |
| Статистика | 3-4ч | 🟢 Средно |
| Търсене и филтриране | 4-5ч | 🟢 Средно |
| Споделяне | 3-4ч | 🟢 Средно |
| Уведомления | 2-3ч | 🟢 Средно |
| Dark mode | 3-4ч | 🟢 Ниско |
| Accessibility | 4-5ч | 🟢 Средно |
| Unit тестове | 8-10ч | 🟢 Средно |
| Performance оптимизации | 4-5ч | 🟢 Средно |
| Мониторинг и логиране | 4-5ч | 🟢 Средно |
| Документация | 4-5ч | 🟢 Средно |
| **ПОДОБЩО ФАЗА 3** | **75-95ч** | |

**ОБЩО ВРЕМЕ**: ~110-142 часа  
**При 20 часа/седмица**: 5.5-7 седмици  
**При 30 часа/седмица**: 3.5-5 седмици

### ПРЕПОРЪЧАНА ПОСЛЕДОВАТЕЛНОСТ:
1. **Седмица 1-2**: Фаза 1 (критични) - **ОБЯЗАТЕЛНО**
2. **Седмица 2-3**: Фаза 2 (високоприоритетни) - **ОБЯЗАТЕЛНО**
3. **Седмица 3-5**: Фаза 3 (допълнителни) - **ПО ИЗБОР, но препоръчително**

---

## ✅ КРИТЕРИИ ЗА УСПЕХ

### Функционални:
- ✅ Всички режими (Quick, Batch, Standard) работят правилно и се различават
- ✅ Транскрипцията се извлича реално от видеата
- ✅ Всички метрики са реални, не хардкоднати
- ✅ Разходите се изчисляват правилно
- ✅ Няма хардкоднати API ключове

### Качество:
- ✅ Няма фалшиви данни или "N/A" стойности (освен ако наистина няма данни)
- ✅ Всички грешки се обработват gracefully
- ✅ URL валидация работи правилно
- ✅ Retry логика работи при временни грешки

### UX:
- ✅ Ясни съобщения за грешки
- ✅ История на анализи
- ✅ Кеширане за по-бърз достъп
- ✅ Loading states са информативни

---

## 🚀 СТАРТОВА ТОЧКА

**Препоръчителна последователност**:
1. Започни с Фаза 1 (критични поправки) - те са най-важни
2. След това Фаза 2 (високоприоритетни)
3. Накрая Фаза 3 (допълнителни функции)

**Важно**: Тествай след всяка задача! Не преминавай към следващата преди да си сигурен, че текущата работи правилно.

---

---

## 🎯 ФИНАЛНО РЕЗЮМЕ И СТАРТОВИ СТЪПКИ

### НАЙ-ВАЖНОТО ПРЕДИ ДА ЗАПОЧНЕШ:

1. **Прочети целия план** - разбери какво трябва да се направи
2. **Направи backup** - запази текущата версия на кода
3. **Създай нова git branch** - `git checkout -b feature/fix-critical-issues`
4. **Работи стъпка по стъпка** - не прескачай задачи

### ПЪРВИ СТЪПКИ (Днес):

1. **Премахни хардкоднатите API ключове** (2 часа)
   - Това е най-критичното и най-бързото
   - След това тествай дали приложението работи

2. **Оправи Gemini API интеграцията** (4-6 часа)
   - Това е основната функционалност
   - Без това приложението не работи правилно

3. **Тествай след всяка промяна**
   - Не прави много промени наведнъж
   - Тествай след всяка задача

### КЛЮЧОВИ ПРИНЦИПИ:

✅ **РЕАЛНОСТ ПРЕД ВСИЧКО**
- Няма хардкоднати данни
- Няма "N/A" освен ако наистина няма данни
- Всички метрики са реални

✅ **ТЕСТВАНЕ НА ВСЯКА СТЪПКА**
- Тествай след всяка задача
- Не преминавай към следващата преди да си сигурен

✅ **ДОКУМЕНТИРАНЕ**
- Коментирай сложната логика
- Обновявай README при нужда

✅ **БЕЗПЕЧНОСТ**
- Никога не комитирай API ключове
- Използвай само environment variables

### ОЧАКВАН РЕЗУЛТАТ:

След изпълнение на плана, приложението трябва да:

✅ Работи перфектно с реални данни  
✅ Няма фалшиви показатели  
✅ Всички режими работят правилно  
✅ Транскрипцията е реална  
✅ Разходите са точни  
✅ Няма security issues  
✅ Има добра error handling  
✅ Има добра UX  

### ПОДДРЪЖКА:

Ако срещнеш проблеми:
1. Провери документацията на Gemini API
2. Провери дали всички зависимости са инсталирани
3. Провери дали environment variables са правилно конфигурирани
4. Провери конзолата за грешки

---

**Дата на създаване**: 23 януари 2026  
**Статус**: Готов за изпълнение  
**Очакван резултат**: Перфектно работещо приложение с реални данни  
**Версия на плана**: 1.0
