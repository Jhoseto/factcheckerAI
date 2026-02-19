# ДЕТАЙЛЕН АНАЛИЗ НА FACTCHECKER AI ПРИЛОЖЕНИЕТО

## ОБЩ ПРЕГЛЕД

**Factchecker AI** е комплексна платформа за фактчекинг и анализ на медийно съдържание, използваща Google Gemini AI за автоматизиран анализ на:
- YouTube видеа
- Уеб статии и новини
- Публикации в социални мрежи (Facebook, Twitter/X, TikTok)

Приложението е изградено като **full-stack** система с:
- **Frontend**: React 19.2.3 + TypeScript + Vite
- **Backend**: Express.js (Node.js) сървър
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Payment**: Lemon Squeezy интеграция
- **AI Engine**: Google Gemini 2.5 Flash API

---

## АРХИТЕКТУРА И СТРУКТУРА

### Frontend Структура

```
src/
├── App.tsx                    # Главен компонент (YouTube анализ UI)
├── AppRouter.tsx              # React Router конфигурация
├── types.ts                   # TypeScript типове и интерфейси
├── contexts/
│   └── AuthContext.tsx       # Firebase Auth контекст
├── components/
│   ├── auth/                  # Login/Register компоненти
│   ├── common/                # Общи компоненти (Navbar, MetricBlock, ScannerAnimation)
│   │   └── result-views/     # Компоненти за показване на резултати
│   ├── linkAudit/            # Link Audit страница
│   ├── social/                # Social Media Audit секция
│   ├── pricing/               # Pricing страница
│   ├── user/                  # User профил компоненти
│   ├── archive/               # Archive страница
│   └── report/                # Report страница
└── services/
    ├── geminiService.ts       # Gemini API клиент
    ├── socialService.ts       # Social media анализ
    ├── linkAudit/linkService.ts  # Link анализ
    ├── youtubeTranscriptService.ts
    ├── youtubeMetadataService.ts
    ├── archiveService.ts      # Запазване на анализи
    ├── transactionService.ts # История на транзакции
    ├── pricing.ts             # Ценообразуване
    ├── costEstimationService.ts
    ├── firebase.ts            # Firebase конфигурация
    ├── errorHandler.ts        # Error handling
    ├── validation.ts          # URL валидация
    └── prompts/               # AI промптове
        ├── standardAnalysisPrompt.ts
        ├── deepAnalysisPrompt.ts
        ├── linkAnalysisPrompt.ts
        ├── socialAnalysisPrompt.ts
        └── reportSynthesisPrompt.ts
```

### Backend Структура

```
server/
├── index.js                   # Express сървър entry point
├── routes/
│   ├── gemini.js             # Gemini API endpoints
│   ├── youtube.js             # YouTube metadata API
│   ├── linkScraper.js        # Link scraping
│   ├── social.js              # Social media scraping
│   ├── checkout.js            # Lemon Squeezy checkout
│   ├── webhook.js             # Payment webhooks
│   └── transactions.js        # Transaction history
├── middleware/
│   ├── auth.js                # Firebase token verification
│   └── rateLimiter.js         # Rate limiting
├── services/
│   └── firebaseAdmin.js       # Firebase Admin SDK операции
├── config/
│   └── pricing.js             # Server-side pricing config
└── utils/
    └── safeJson.js            # JSON parsing utilities
```

---

## ОСНОВНИ ФУНКЦИИ

### 1. YOUTUBE ВИДЕО АНАЛИЗ

#### Функционалност:
- **Вход**: YouTube URL (поддържа различни формати: youtube.com/watch, youtu.be, shorts, mobile)
- **Метаданни**: Автоматично извличане на заглавие, автор, продължителност чрез YouTube Data API v3
- **Два режима на анализ**:
  - **Standard Mode**: Базов анализ с фактчекинг, манипулации, логически заблуди
  - **Deep Mode**: Задълбочен анализ с:
    - Google Search интеграция за верификация
    - Мултимодален анализ (визуален, body language, вокален)
    - Психологически профил на участниците
    - Културен и символен анализ
    - Анализ на честност/измама (deception detection)
    - Хумор и сатира анализ
- **Транскрипция**: Автоматично извличане на транскрипция (само в Deep mode)
- **Ценообразуване**: Динамично базирано на продължителността на видеото

#### Технически детайли:
- Използва **Gemini 2.5 Flash** модел
- **Streaming API** за дълги видеа (избягва timeout грешки)
- **Server-Sent Events (SSE)** за progress updates
- **JSON sanitization** за обработка на невалидни отговори от AI
- **Retry логика** за непълни отговори (max 1 retry)

#### Код локации:
- `services/geminiService.ts` - `analyzeYouTubeStandard()`
- `services/prompts/standardAnalysisPrompt.ts` - Standard промпт
- `services/prompts/deepAnalysisPrompt.ts` - Deep промпт (309 реда!)
- `server/routes/gemini.js` - `/api/gemini/generate-stream` endpoint

---

### 2. ЛИНК/СТАТИЯ АНАЛИЗ

#### Функционалност:
- **Вход**: URL на уеб статия/новина
- **Scraping**: Server-side извличане на съдържанието чрез axios
- **Анализ**: Deep анализ с Google Search за верификация
- **Сравнителен медиен анализ**: Сравнение с 3+ други източника
- **Фактчекинг**: Детайлна проверка на всяко твърдение с източници
- **Цена**: Фиксирана - 12 точки

#### Технически детайли:
- HTML parsing за извличане на основното съдържание
- Поддръжка на `<article>`, `<main>`, `<p>` тагове
- Очистване на scripts, styles, navigation
- Лимит на съдържанието: 30,000 символа
- **НЕ таксува** scraping отделно (включено в цената на анализа)

#### Код локации:
- `services/linkAudit/linkService.ts` - `analyzeLinkDeep()`, `scrapeLink()`
- `services/prompts/linkAnalysisPrompt.ts` - Link анализ промпт
- `server/routes/linkScraper.js` - `/api/link/scrape` endpoint
- `components/linkAudit/LinkAuditPage.tsx` - UI компонент

---

### 3. СОЦИАЛНИ МРЕЖИ АНАЛИЗ

#### Функционалност:
- **Поддържани платформи**: Facebook, Twitter/X, TikTok
- **Типове анализ**:
  - **Post Analysis**: Анализ на публикация (12 точки)
  - **Comment Analysis**: Анализ на коментари (15 точки)
  - **Full Audit**: Пост + коментари (20 точки)
- **Scraping**: Базов HTML scraping (ограничен - няма JS rendering)
- **Анализ**: Fact-checking, sentiment analysis, bot detection, toxicity detection

#### Технически детайли:
- **Ограничение**: Реалният scraping е много ограничен без официални API-та
- Използва Open Graph и Twitter Card метаданни
- Коментарите **НЕ се извличат** (изисква JS rendering или официални API-та)
- Платформите блокират автоматичен достъп

#### Код локации:
- `services/socialService.ts` - `analyzeSocialPost()`, `scrapeSocialPost()`
- `services/prompts/socialAnalysisPrompt.ts` - Social промптове
- `server/routes/social.js` - `/api/social/scrape` endpoint
- `components/social/SocialAuditSection.tsx` - UI компонент

---

### 4. АВТЕНТИФИКАЦИЯ И ПОТРЕБИТЕЛСКИ ПРОФИЛ

#### Функционалност:
- **Firebase Auth**: Email/Password + Google Sign-In
- **User Profile**: Firestore колекция `users`
- **Welcome Bonus**: 100 точки при регистрация
- **Points Balance**: Управление на точки в реално време
- **Transaction History**: Пълна история на транзакции

#### Технически детайли:
- **Server-side points deduction**: Точките се таксуват на сървъра след успешен анализ
- **Optimistic UI updates**: Клиентът обновява баланса веднага след отговор от сървъра
- **Idempotent operations**: Предотвратява двойно таксуване
- **Firebase Admin SDK**: Използва се на сървъра за сигурни операции

#### Код локации:
- `contexts/AuthContext.tsx` - Auth контекст
- `server/services/firebaseAdmin.js` - `deductPointsFromUser()`, `getUserPoints()`
- `server/middleware/auth.js` - Token verification middleware

---

### 5. ПЛАТЕЖНА СИСТЕМА (LEMON SQUEEZY)

#### Функционалност:
- **4 Pricing Tiers**:
  - Starter: 5 EUR → 500 точки
  - Standard: 15 EUR → 1700 точки (200 бонус)
  - Professional: 44 EUR → 5500 точки (1000 бонус)
  - Enterprise: 99 EUR → 13000 точки (3000 бонус)
- **Checkout Flow**: Lemon Squeezy hosted checkout
- **Webhook Integration**: Автоматично кредитиране на точки след плащане
- **Idempotent Processing**: Предотвратява двойно кредитиране

#### Технически детайли:
- **HMAC Signature Verification**: Проверка на webhook authenticity
- **Custom Data**: Предаване на userId и points в checkout
- **Processed Orders Tracking**: Firestore колекция за предотвратяване на дублиране
- **Error Handling**: Retry логика от страна на Lemon Squeezy

#### Код локации:
- `server/routes/checkout.js` - Checkout session creation
- `server/routes/webhook.js` - Webhook обработка
- `components/pricing/PricingPage.tsx` - Pricing UI
- `config/pricingConfig.ts` - Pricing конфигурация

---

### 6. АРХИВ И ЗАПАЗВАНЕ НА АНАЛИЗИ

#### Функционалност:
- **Запазване**: Потребителите могат да запазват анализи в архива
- **Лимити по тип**:
  - Видео: 10 анализи
  - Линк: 15 анализи
  - Социални: 15 анализи
- **Archive Page**: Преглед на всички запазени анализи
- **Report Sharing**: Публични линкове за споделяне (чрез ID)

#### Технически детайли:
- Firestore колекция `analyses`
- Автоматично изтриване на най-старите анализи при достигане на лимит
- **НЕ се използва** в момента - потребителят трябва ръчно да изтрива

#### Код локации:
- `services/archiveService.ts` - `saveAnalysis()`, `getUserAnalyses()`
- `components/archive/ArchivePage.tsx` - Archive UI
- `components/report/ReportPage.tsx` - Report viewing

---

### 7. ЦЕНООБРАЗУВАНЕ И БИЛИНГ

#### Динамично ценообразуване (Видео):
- **Формула**:
  1. Изчисляване на USD разходи (input + output tokens)
  2. Конвертиране в EUR (курс 0.95)
  3. Конвертиране в точки (1 EUR = 100 точки)
  4. Прилагане на profit multiplier:
     - Standard: x2
     - Deep: x3
  5. Минимални цени: Standard 5 точки, Deep 10 точки

#### Фиксирани цени:
- Link Article: 12 точки
- Social Post: 12 точки
- Comment Analysis: 15 точки
- Social Full Audit: 20 точки

#### Token Estimation:
- **Input**: ~100 tokens/sec (видео) + prompt overhead
- **Output**: 
  - Standard: ~8K base + 150/min
  - Deep: ~18K base + 250/min
- **Thinking Tokens**: Gemini 2.5 Flash използва "thinking" tokens (броят се като output)

#### Код локации:
- `services/pricing.ts` - Клиентска pricing логика
- `server/config/pricing.js` - Сървърна pricing логика
- `services/costEstimationService.ts` - Token estimation
- `config/pricingConfig.ts` - Централна конфигурация

---

### 8. ERROR HANDLING И VALIDATION

#### Error Types:
- **RATE_LIMIT**: Превишена квота (429)
- **NETWORK_ERROR**: Мрежови проблеми
- **API_KEY_ERROR**: Невалиден API ключ (401)
- **INSUFFICIENT_POINTS**: Недостатъчно точки (403)
- **PARSE_ERROR**: JSON parsing грешки
- **UNKNOWN_ERROR**: Неочаквани грешки

#### Validation:
- **YouTube URL**: Поддръжка на различни формати
- **URL Normalization**: Стандартизиране на URL-ите
- **Balance Checks**: Pre-flight проверки преди анализ
- **JSON Sanitization**: Автоматично поправяне на невалиден JSON от AI

#### Код локации:
- `services/errorHandler.ts` - Централизиран error handling
- `services/validation.ts` - URL валидация
- `server/utils/safeJson.js` - JSON parsing utilities

---

### 9. UI/UX КОМПОНЕНТИ

#### Главни компоненти:
- **ScannerAnimation**: Анимация по време на анализ
- **MetricBlock**: Показване на метрики (процентни стойности)
- **ReliabilityChart**: Графично представяне на надеждност
- **VideoResultView**: Комплексен UI за видео резултати (13 таба!)
- **LinkResultView**: UI за линк резултати
- **SocialResultView**: UI за социални резултати
- **ShareModal**: Споделяне на анализи

#### Табове в VideoResultView:
1. Summary - Общ преглед
2. Claims - Твърдения и фактчекинг
3. Manipulation - Манипулативни техники
4. Transcript - Транскрипция
5. Report - Пълен доклад
6. Visual - Визуален анализ (Deep only)
7. Body Language - Език на тялото (Deep only)
8. Vocal - Вокален анализ (Deep only)
9. Deception - Анализ на честност (Deep only)
10. Humor - Хумор анализ (Deep only)
11. Psychological - Психологически профил (Deep only)
12. Cultural - Културен анализ (Deep only)

---

## ПРОБЛЕМИ И ОГРАНИЧЕНИЯ

### 1. СОЦИАЛНИ МРЕЖИ SCRAPING

**Проблем**: Реалният scraping на социални мрежи е **много ограничен**.

**Причини**:
- Facebook/Twitter/TikTok блокират автоматичен достъп
- Изискват JavaScript rendering за пълно извличане
- Коментарите не се извличат без официални API-та
- Rate limiting от страна на платформите

**Решение**: Използване на официални API-та:
- **Twitter API v2** (платено)
- **Facebook Graph API** (ограничен достъп)
- **TikTok API** (много ограничен)
- Алтернатива: Използване на специализирани scraping услуги (Bright Data, ScraperAPI)

---

### 2. JSON PARSING ПРОБЛЕМИ

**Проблем**: Gemini API понякога връща невалиден JSON или непълен отговор.

**Текущо решение**:
- `cleanJsonResponse()` функция с множество стратегии за извличане на JSON
- JSON repair логика за поправяне на непълни отговори
- Retry механизъм (max 1 retry)

**Ограничения**:
- Не винаги успешно поправя сложни JSON грешки
- Може да загуби данни при repair
- Retry увеличава времето за анализ

**Подобрения**:
- Използване на `responseMimeType: 'application/json'` (вече се използва за non-deep mode)
- По-добра error handling при JSON parse failures
- Fallback към streaming за по-големи отговори

---

### 3. RATE LIMITING

**Проблем**: In-memory rate limiter не работи в multi-instance среда (Cloud Run).

**Текущо решение**:
- In-memory Map за single-instance deployments
- Cleanup на стари записи всеки 5 минути

**Проблем**:
- При multiple instances, всеки instance има собствен rate limit counter
- Потребителят може да направи повече заявки от лимита

**Решение**: Използване на Redis за shared rate limiting:
```javascript
// Примерна Redis интеграция
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
```

---

### 4. FIREBASE ADMIN ИНИЦИАЛИЗАЦИЯ

**Проблем**: Firebase Admin може да не се инициализира правилно в Cloud Run.

**Текущо решение**:
- Проверка за `firebase-service-account.json` файл
- Fallback към default credentials (GOOGLE_APPLICATION_CREDENTIALS)

**Потенциални проблеми**:
- Ако файлът липсва и няма default credentials, points operations не работят
- Няма ясно съобщение за грешка към потребителя

**Подобрения**:
- По-добра error handling и logging
- Health check endpoint за проверка на Firebase Admin статус

---

### 5. COST ESTIMATION ТОЧНОСТ

**Проблем**: Token estimation може да не е точно за дълги видеа.

**Текущо решение**:
- Базирано на реални наблюдения: ~111 tokens/sec за видео
- Output estimation базирано на режим (Standard/Deep)

**Ограничения**:
- Не отчита сложността на съдържанието
- Не отчита thinking tokens точно
- Може да подценява разходите за сложни анализи

**Подобрения**:
- По-прецизни формули базирани на исторически данни
- Machine learning модел за по-точна оценка
- Real-time cost tracking и adjustment

---

### 6. ARCHIVE ЛИМИТИ

**Проблем**: Лимитите са твърдо зададени и потребителят трябва ръчно да изтрива стари анализи.

**Текущо решение**:
- Проверка на лимит преди запазване
- Съобщение за грешка ако лимитът е достигнат

**Подобрения**:
- Автоматично изтриване на най-старите анализи
- Опция за upgrade за повече слотове
- Cloud storage за стари анализи (архивиране)

---

### 7. STREAMING TIMEOUTS

**Проблем**: Дълги видеа могат да предизвикат timeout грешки.

**Текущо решение**:
- SSE streaming endpoint с 15-минутен timeout
- Heartbeat механизъм всеки 30 секунди

**Ограничения**:
- 15 минути може да не е достатъчно за много дълги видеа
- Proxy timeout може да прекъсне връзката

**Подобрения**:
- Асинхронна обработка с job queue (Bull/BullMQ)
- WebSocket вместо SSE за по-добра комуникация
- Background jobs за дълги анализи

---

### 8. SECURITY CONCERNS

**Потенциални проблеми**:
- API ключовете са в `.env` файл (добре, но трябва да се внимава)
- Няма rate limiting по IP на frontend
- Webhook secret може да липсва (пропуска се проверката)

**Подобрения**:
- Environment variable validation при стартиране
- По-строг rate limiting
- Обязателна webhook signature verification

---

## ВЪЗМОЖНОСТИ ЗА РАЗШИРЕНИЕ

### 1. ДОПЪЛНИТЕЛНИ ПЛАТФОРМИ

**Възможни добавки**:
- **Instagram**: Reels и Stories анализ
- **LinkedIn**: Професионални публикации
- **Reddit**: Threads и коментари
- **Telegram**: Канали и групи
- **Podcasts**: Аудио съдържание (Spotify, Apple Podcasts)

**Технически изисквания**:
- Scraping или API достъп
- Адаптиране на промптовете за специфичните платформи
- UI компоненти за показване на резултати

---

### 2. COMPARATIVE ANALYSIS

**Функционалност**: Сравнение на едно и също събитие/тема от различни източници.

**Имплементация**:
- Множествен избор на URL-и
- Паралелен анализ
- Side-by-side сравнение на твърдения
- Bias detection между източниците

**UI**: Split-screen view с синхронизиран scroll

---

### 3. API ДОСТЪП

**Функционалност**: REST API за външни интеграции.

**Endpoints**:
- `POST /api/v1/analyze/video`
- `POST /api/v1/analyze/link`
- `POST /api/v1/analyze/social`
- `GET /api/v1/analyses/:id`

**Автентификация**: API ключове в Firestore
**Rate Limiting**: Отделни лимити за API потребители
**Billing**: API-specific pricing tiers

---

### 4. BATCH PROCESSING

**Функционалност**: Масов анализ на множество URL-и.

**Имплементация**:
- Job queue система (Bull/BullMQ)
- Background workers
- Progress tracking
- Email уведомления при завършване

**Pricing**: Batch discount (50% вече е имплементирано)

---

### 5. EXPORT ФУНКЦИОНАЛНОСТ

**Текущо**: PNG export на пълен доклад

**Разширения**:
- **PDF Export**: Професионален PDF формат
- **JSON Export**: Raw данни за програмен достъп
- **CSV Export**: Таблични данни за Excel
- **Markdown Export**: За документация

---

### 6. REAL-TIME COLLABORATION

**Функционалност**: Споделяне и коментиране на анализи в реално време.

**Имплементация**:
- WebSocket за real-time updates
- Коментари и annotations
- Team workspaces
- Version control за анализи

---

### 7. ADVANCED ANALYTICS

**Функционалност**: Статистики и анализи на потребителската активност.

**Метрики**:
- Най-анализирани канали/източници
- Трендове в дезинформацията
- Bias patterns по време
- Географски разпределение

**Dashboard**: Admin panel с визуализации

---

### 8. MOBILE APP

**Функционалност**: Нативни мобилни приложения.

**Технологии**:
- React Native
- Flutter
- Или PWA (Progressive Web App)

**Features**:
- Push notifications
- Offline mode
- Camera integration за QR code scanning

---

### 9. MULTI-LANGUAGE SUPPORT

**Текущо**: Само български език

**Разширение**:
- Английски, руски, немски и др.
- Автоматично разпознаване на езика
- Локализация на UI
- Мултиезични анализи

---

### 10. AI MODEL SELECTION

**Текущо**: Само Gemini 2.5 Flash

**Разширение**:
- Gemini 3 Pro за по-сложни анализи
- Claude (Anthropic) като алтернатива
- GPT-4 за сравнение
- Custom fine-tuned модели

**UI**: Избор на модел от потребителя

---

## ТЕХНИЧЕСКИ ПРЕПОРЪКИ

### 1. DATABASE OPTIMIZATION

**Текущо**: Firestore без индекси

**Подобрения**:
- Composite indexes за сложни заявки
- Caching на често достъпвани данни
- Архивиране на стари анализи

---

### 2. CACHING STRATEGY

**Имплементация**:
- Redis за rate limiting и caching
- CDN за статични активи
- Service Worker за offline support

---

### 3. MONITORING И LOGGING

**Добавяне на**:
- Error tracking (Sentry)
- Performance monitoring (New Relic, Datadog)
- Analytics (Google Analytics, Mixpanel)
- Log aggregation (ELK stack, Cloud Logging)

---

### 4. TESTING

**Текущо**: Няма тестове

**Добавяне на**:
- Unit тестове (Jest)
- Integration тестове
- E2E тестове (Playwright, Cypress)
- Load тестове (k6)

---

### 5. CI/CD

**Имплементация**:
- GitHub Actions за автоматично deployment
- Automated testing преди deployment
- Staging environment
- Blue-green deployment стратегия

---

## ЗАКЛЮЧЕНИЕ

**Factchecker AI** е добре структурирано приложение с ясна архитектура и добри практики. Основните сили са:

✅ Добро разделение на frontend/backend
✅ Централизирано error handling
✅ Server-side billing за сигурност
✅ Детайлни AI промптове
✅ Модулна структура

Основните области за подобрение са:

⚠️ Социални мрежи scraping (изисква официални API-та)
⚠️ Rate limiting в multi-instance среда (изисква Redis)
⚠️ JSON parsing надеждност (вече се работи по това)
⚠️ Archive management (автоматично изтриване)
⚠️ Testing coverage (няма тестове)

Приложението е готово за production с някои допълнителни подобрения в областите на reliability и scalability.

---

*Анализът е направен на 19 февруари 2026 г.*
