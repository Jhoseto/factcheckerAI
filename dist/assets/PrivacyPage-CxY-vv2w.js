import{j as e}from"./motion-DMmWGCb4.js";import{u as a,m as t}from"./index-DV_ffwHv.js";import{r as o}from"./renderLegalMd-CM_Jpi49.js";import{L as i}from"./react-vendor-DfPuibdP.js";import"./firebase-DzH6GH7r.js";import"./charts-COc1iTIi.js";const s=`# ПОЛИТИКА ЗА ПОВЕРИТЕЛНОСТ НА FACTCHECKER AI\r
\r
**Последна актуализация:** Март 2026 г.\r
\r
---\r
\r
## 1. Администратор на личните данни\r
\r
Администратор на личните данни, обработвани в рамките на услугата FactChecker AI („Платформата“), е **Костадин Серезлиев**, физическо лице, с адрес за кореспонденция: **България, София**. За въпроси относно личните ви данни и за упражняване на правата си можете да пишете на: **factcheckerai42@gmail.com**.\r
\r
Назначен Data Protection Officer (ДПО) няма. За жалби относно обработката на лични данни можете да се обърнете към Комисията за защита на личните данни (КЗЛД), България: https://cpdp.bg/.\r
\r
---\r
\r
## 2. Категории лични данни и цели на обработката\r
\r
Обработваме следните категории данни:\r
\r
**При регистрация и поддържане на акаунт:**\r
- Имейл адрес, парола (съхранява се в криптиран вид чрез Firebase Authentication), име/псевдоним (display name). При вход с Google – имейл, име и снимка от профила ви в Google, ако ги предоставите.\r
\r
**Цел:** създаване и поддържане на акаунт, идентификация, доставяне на услугата. **Правно основание:** изпълнение на договора за ползване на услугата (чл. 6, ал. 1, т. „б“ от Регламент (ЕС) 2016/679 – GDPR).\r
\r
**При ползване на услугата за анализ:**\r
- URL адреси и метаданни, които въвеждате за анализ (напр. линк към YouTube видео, статия, пост в социална мрежа), както и резултатите от анализа. Когато запазвате анализ в „Архив“, тези данни се съхраняват във вашия профил. При споделяне на „публичен отчет“ част от данните стават достъпни за всеки с линка.\r
\r
**Цел:** предоставяне на анализ, запазване в архив, възможност за споделяне по ваш избор. **Правно основание:** изпълнение на договора (чл. 6, ал. 1, т. „б“ от GDPR).\r
\r
**При закупуване на точки:**\r
- Идентификатор на потребителя (userId) и имейл, както и броят точки от избрания пакет, се предават към платформата за плащания **Lemon Squeezy** за създаване на поръчка и след плащане – за начисляване на точки в акаунта ви. Данните за плащане (карта, разплащане) се обработват **директно от Lemon Squeezy**; ние не съхраняваме и не обработваме данни за карта.\r
\r
**Цел:** осъществяване на плащане и начисляване на точки. **Правно основание:** изпълнение на договора (чл. 6, ал. 1, т. „б“ от GDPR).\r
\r
**История на транзакции:** За всяко начисляване или отписване на точки се записва транзакция (тип, количество, описание, дата; при анализ – и метаданни като заглавие на видеото). **Цел:** прозрачност, поддръжка на сметката, възможна защита при претенции. **Правно основание:** изпълнение на договора и законен интерес (чл. 6, ал. 1, т. „б“ и „ф“ от GDPR).\r
\r
---\r
\r
## 3. Получатели на данни и прехвърляния\r
\r
Личните данни могат да се предават на следните категории получатели:\r
\r
- **Google (Firebase):** за удостоверяване (Firebase Authentication) и съхранение на профили, транзакции и анализи (Firestore). Сървърите на Google могат да се намират в ЕС и извън ЕС (вкл. САЩ). Прехвърлянията се осъществяват в съответствие с приложимите гаранции (напр. стандартни договорни клаузи или решение за адекватност, където е приложимо).\r
\r
- **Google (Gemini API):** съдържанието, което изпращате за анализ (URL, текст, метаданни), се обработва от Google Gemini за генериране на резултатите. Когато подавате съдържание за анализ, анонимизирани фрагменти или метаданни могат да бъдат обработени от Google Gemini API. Лична идентифицираща информация (PII) не се споделя умишлено с доставчиците на AI модели. Това може да включва прехвърляне извън ЕС; приложими са гаранциите на Google за обработка на данни.\r
\r
- **Lemon Squeezy:** при закупуване на точки предаваме userId, имейл и данни за избрания пакет (точки). Самите плащания и данните за карта се обработват от Lemon Squeezy съгласно тяхната политика за поверителност.\r
\r
- **Jina (r.jina.ai):** при анализ на уеб статии URL адресът, който въвеждате, се изпраща към услугата на Jina за извличане на текстово съдържание. Обработката се извършва от Jina съгласно техните условия.\r
\r
- **YouTube:** при анализ на YouTube видеа нашите системи комуникират с YouTube (метаданни, транскрипция) чрез официални API-та; приложими са условията и политиката на Google/YouTube.\r
\r
Ние не продаваме лични данни на трети страни за маркетинг или за други цели, различни от изброените по-горе.\r
\r
---\r
\r
## 4. Съхранение на данните\r
\r
- **Профил и акаунт:** Докато акаунтът ви е активен. След изтриване на акаунта личните данни се изтриват в разумен срок, освен ако закон изисква по-дълго съхранение.\r
\r
- **Транзакции:** Записът за транзакции може да се съхранява за по-дълъг период при наличие на законово или счетоводно задължение.\r
\r
- **Архив (запазени анализи):** До изтриване от вас или до закриване на акаунта. Публично споделени отчети могат да останат достъпни по линк до премахване от вас или от оператора.\r
\r
---\r
\r
## 5. Вашите права по GDPR\r
\r
Ако се намирате в Европейското икономическо пространство (ЕЕП), прилагат се разпоредбите на Регламент (ЕС) 2016/679 (GDPR). Имате право на:\r
\r
- **Достъп** (чл. 15) – да получите информация дали обработваме ваши данни и копие от тях.\r
- **Поправка** (чл. 16) – да поискате поправка на неточни данни.\r
- **Изтриване** (чл. 17) – да поискате изтриване на данните при наличие на законово основание.\r
- **Ограничаване на обработката** (чл. 18) – при определени условия.\r
- **Преносимост** (чл. 20) – да получите данните си в структуриран, машинночетим формат, когато приложимо.\r
- **Възражение** (чл. 21) – да възразите срещу обработка на основание законен интерес.\r
- **Жалба до надзорен орган** – да подадете жалба до КЗЛД (България) или до надзорния орган по местонахождението ви.\r
\r
За упражняване на правата си пишете на **factcheckerai42@gmail.com**. Ще отговорим в срок до 1 месец от получаване на заявлението.\r
\r
За ползватели **извън ЕЕП** обработката се описва в същите раздели; приложимите закони за защита на данните във вашата държава може да предвиждат допълнителни или различни права.\r
\r
---\r
\r
## 6. Сигурност\r
\r
Прилагаме подходящи технически и организационни мерки за защита на личните данни: криптиране на комуникацията (HTTPS), контрол на достъпа, използване на сигурни услуги (Firebase). Ние не гарантираме абсолютна сигурност в интернет; вие също трябва да пазите паролата и достъпа до акаунта си.\r
\r
---\r
\r
## 7. Бисквитки и локално съхранение\r
\r
Платформата използва **Firebase Authentication**, което може да съхранява данни за сесията ви в **localStorage** или **IndexedDB** във вашия браузър (идентификатор за влизане, токен). Това е **необходимо** за функционирането на входа и за запазване на сесията и не изисква отделно съгласие по GDPR. Ние не използваме рекламни или проследяващи бисквитки от трети страни в момента. Ако в бъдеще бъдат добавени такива (напр. аналитика), ще бъде поискано съгласие и ще бъде обновена тази политика.\r
\r
---\r
\r
## 8. Промени в политиката\r
\r
Може да актуализираме тази Политика за поверителност. Актуализациите ще бъдат публикувани на тази страница с обновена дата „Последна актуализация“. При съществени промени ще уведомим чрез Платформата или по имейл, когато е възможно.\r
\r
---\r
\r
## 9. Контакт\r
\r
**Костадин Серезлиев**  \r
Адрес: България, София  \r
Имейл: **factcheckerai42@gmail.com**\r
\r
За въпроси и заявления относно личните ви данни използвайте горния имейл.\r
`,c=`# PRIVACY POLICY – FACTCHECKER AI\r
\r
**Last updated:** March 2026\r
\r
---\r
\r
## 1. Data Controller\r
\r
The controller of personal data processed within the FactChecker AI service ("Platform") is **Kostadin Serezliev**, a natural person, with correspondence address: **Bulgaria, Sofia**. For questions about your personal data and to exercise your rights, write to: **factcheckerai42@gmail.com**.\r
\r
No Data Protection Officer (DPO) has been appointed. For complaints about the processing of personal data, you may contact the Commission for Personal Data Protection (CPDP), Bulgaria: https://cpdp.bg/.\r
\r
---\r
\r
## 2. Categories of Personal Data and Purposes of Processing\r
\r
We process the following categories of data:\r
\r
**Upon registration and account maintenance:**\r
- Email address, password (stored in encrypted form via Firebase Authentication), name/display name. For Google sign-in – email, name, and profile picture from your Google account, if provided.\r
\r
**Purpose:** creating and maintaining an account, identification, delivery of the service. **Legal basis:** performance of the contract for use of the service (Art. 6(1)(b) GDPR).\r
\r
**When using the analysis service:**\r
- URLs and metadata you submit for analysis (e.g. a link to a YouTube video or web article), as well as the analysis results. When you save an analysis to the "Archive", this data is stored in your profile. When sharing a "public report", part of the data becomes accessible to anyone with the link.\r
\r
**Purpose:** providing analysis, saving to archive, sharing at your choice. **Legal basis:** performance of the contract (Art. 6(1)(b) GDPR).\r
\r
**When purchasing points:**\r
- User identifier (userId) and email, as well as the number of points from the selected package, are passed to the payment platform **Lemon Squeezy** to create an order and, after payment, to credit points to your account. Payment data (card, payment details) is processed **directly by Lemon Squeezy**; we do not store or process card data.\r
\r
**Purpose:** processing payment and crediting points. **Legal basis:** performance of the contract (Art. 6(1)(b) GDPR).\r
\r
**Transaction history:** For every credit or debit of points, a transaction is recorded (type, amount, description, date; for analysis – also metadata such as video title). **Purpose:** transparency, account maintenance, possible protection in disputes. **Legal basis:** performance of the contract and legitimate interest (Art. 6(1)(b) and (f) GDPR).\r
\r
---\r
\r
## 3. Recipients of Data and Transfers\r
\r
Personal data may be shared with the following categories of recipients:\r
\r
- **Google (Firebase):** for authentication (Firebase Authentication) and storage of profiles, transactions, and analyses (Firestore). Google's servers may be located within and outside the EU (including the US). Transfers are made in accordance with applicable safeguards (e.g. standard contractual clauses or an adequacy decision, where applicable).\r
\r
- **Google (Gemini API):** content you submit for analysis (URL, text, metadata) is processed by Google Gemini to generate results. When you submit content for analysis, anonymised snippets or metadata may be processed by Google Gemini API. No personally identifiable information (PII) is intentionally shared with the AI model providers. This may involve transfers outside the EU; Google's data processing safeguards apply.\r
\r
- **Lemon Squeezy:** when purchasing points, we pass userId, email, and selected package data (points). Payments and card data are processed by Lemon Squeezy under their privacy policy.\r
\r
- **Jina (r.jina.ai):** when analysing web articles, the URL you enter is sent to Jina's service for text content extraction. Processing is carried out by Jina under their terms.\r
\r
- **YouTube:** when analysing YouTube videos, our systems communicate with YouTube (metadata, transcription) via official APIs; Google/YouTube terms and privacy policy apply.\r
\r
We do not sell personal data to third parties for marketing or purposes other than those listed above.\r
\r
---\r
\r
## 4. Data Retention\r
\r
- **Profile and account:** While your account is active. After account deletion, personal data is deleted within a reasonable time, unless law requires longer retention.\r
\r
- **Transactions:** Transaction records may be retained for a longer period where there is a legal or accounting obligation.\r
\r
- **Archive (saved analyses):** Until deleted by you or until account closure. Publicly shared reports may remain accessible via link until removed by you or the operator.\r
\r
---\r
\r
## 5. Your Rights under GDPR\r
\r
If you are located in the European Economic Area (EEA), the provisions of Regulation (EU) 2016/679 (GDPR) apply. You have the right to:\r
\r
- **Access** (Art. 15) – to obtain information on whether we process your data and a copy thereof.\r
- **Rectification** (Art. 16) – to request correction of inaccurate data.\r
- **Erasure** (Art. 17) – to request deletion of data where there is a legal basis.\r
- **Restriction of processing** (Art. 18) – under certain conditions.\r
- **Portability** (Art. 20) – to receive your data in a structured, machine-readable format, where applicable.\r
- **Objection** (Art. 21) – to object to processing based on legitimate interest.\r
- **Complaint to a supervisory authority** – to lodge a complaint with the CPDP (Bulgaria) or the supervisory authority in your place of residence.\r
\r
To exercise your rights, write to **factcheckerai42@gmail.com**. We will respond within 1 month of receiving the request.\r
\r
For users **outside the EEA**, processing is described in the same sections; applicable data protection laws in your country may provide additional or different rights.\r
\r
---\r
\r
## 6. Security\r
\r
We apply appropriate technical and organisational measures to protect personal data: communication encryption (HTTPS), access control, use of secure services (Firebase). We do not guarantee absolute security on the internet; you must also protect your password and account access.\r
\r
---\r
\r
## 7. Cookies and Local Storage\r
\r
The Platform uses **Firebase Authentication**, which may store session data in **localStorage** or **IndexedDB** in your browser (login identifier, token). This is **necessary** for the login functionality and session persistence and does not require separate consent under GDPR. We do not currently use advertising or tracking cookies from third parties. If such cookies are added in the future (e.g. analytics), consent will be requested and this policy will be updated.\r
\r
---\r
\r
## 8. Changes to the Policy\r
\r
We may update this Privacy Policy. Updates will be published on this page with an updated "Last updated" date. For significant changes, we will notify via the Platform or by email where possible.\r
\r
---\r
\r
## 9. Contact\r
\r
**Kostadin Serezliev**  \r
Address: Bulgaria, Sofia  \r
Email: **factcheckerai42@gmail.com**\r
\r
For questions and requests regarding your personal data, use the email above.\r
`,y=()=>{const{t:r}=a(),n=t.language==="en"?c:s;return e.jsx("div",{className:"min-h-screen pt-32 pb-24 px-6 md:px-12 max-md:pt-20 max-md:pb-28 max-md:px-4",children:e.jsxs("div",{className:"max-w-3xl mx-auto editorial-card p-8 md:p-12 max-md:p-6 bg-[#151515]/80 backdrop-blur-md",children:[e.jsx("div",{className:"prose prose-invert max-w-none text-[#ddd]",children:o(n)}),e.jsx("p",{className:"mt-12 pt-6 border-t border-[#333] text-center",children:e.jsx(i,{to:"/",className:"text-[9px] font-bold text-[#968B74] hover:text-[#C4B091] uppercase tracking-widest border-b border-[#968B74]/30",children:r("legal.backHome")})})]})})};export{y as default};
