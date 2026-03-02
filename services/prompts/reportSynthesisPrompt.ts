/**
 * Report Synthesis Prompt
 * Takes raw analysis data and generates an original journalistic narrative
 * This is a TEXT-ONLY call (no video) so it's fast and cheap
 */
export const getReportSynthesisPrompt = (analysisData: {
    videoTitle: string;
    videoAuthor: string;
    summary: string;
    credibilityIndex: number;
    manipulationIndex: number;
    classification: string;
    claims: Array<{ claim: string; verdict: string; evidence?: string; speaker?: string }>;
    manipulations: Array<{ technique: string; description?: string; impact?: string; example?: string }>;
    geopoliticalContext?: string;
    narrativeArchitecture?: string;
    psychoLinguisticAnalysis?: string;
    strategicIntent?: string;
    technicalForensics?: string;
    historicalParallel?: string;
    socialImpactPrediction?: string;
    mode: string;
}): string => {
    const str = (x: unknown) => (typeof x === 'string' ? x : (x != null ? String(x) : ''));
    const claimsSummary = (analysisData.claims || []).slice(0, 15).map((c, i) =>
        `${i + 1}. "${str(c.claim)}" → ${str(c.verdict)}${c.speaker ? ` (${str(c.speaker)})` : ''}${c.evidence ? ` | ${str(c.evidence).substring(0, 150)}` : ''}`
    ).join('\n');

    const manipulationsSummary = (analysisData.manipulations || []).slice(0, 10).map((m, i) =>
        `${i + 1}. ${str(m.technique)}${m.description ? `: ${str(m.description).substring(0, 150)}` : ''}${m.impact ? ` | Въздействие: ${str(m.impact).substring(0, 100)}` : ''}`
    ).join('\n');

    const reportDate = new Date().toLocaleString('bg-BG', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `Ти си независим експерт по факт-чек и медиа анализ. Направи DCGE Report (${reportDate}). Получаваш суровите данни от анализа на видео материала и трябва да напишеш професионален доклад.

КРИТИЧНО ВАЖНО:
- НЕ преписвай данните буквално – АНАЛИЗИРАЙ, СИНТЕЗИРАЙ, РАЗСЪЖДАВАЙ като опитен журналист
- Пиши като ЕКСПЕРТ ЖУРНАЛИСТ от името на целия екип работил по анализа, вашата логика и вашите заключения
- Свържи нещата в ЦЯЛОСТНА КАРТИНА – покажи какво означават фактите ЗАЕДНО
- Бъди КРИТИЧЕН но ОБЕКТИВЕН – посочи и силните и слабите страни
- Пиши на БЪЛГАРСКИ език, професионално, четивно, завладяващо

═══ СУРОВИ ДАННИ ОТ РАЗСЛЕДВАНЕТО ═══

ВИДЕО: "${analysisData.videoTitle}" от ${analysisData.videoAuthor}
КЛАСИФИКАЦИЯ: ${analysisData.classification}
ИНДЕКС НА ДОСТОВЕРНОСТ: ${Math.round(analysisData.credibilityIndex * 100)}%
ИНДЕКС НА МАНИПУЛАЦИЯ: ${Math.round(analysisData.manipulationIndex * 100)}%

РЕЗЮМЕ: ${analysisData.summary}

ПРОВЕРЕНИ ТВЪРДЕНИЯ:
${claimsSummary || 'Няма данни'}

РАЗКРИТИ МАНИПУЛАЦИИ:
${manipulationsSummary || 'Няма данни'}

${(x => x && x !== 'Неприложимо' ? `ГЕОПОЛИТИЧЕСКИ КОНТЕКСТ: ${x.substring(0, 500)}` : '')(str(analysisData.geopoliticalContext))}
${(x => x && x !== 'Няма данни' ? `СТРАТЕГИЧЕСКО НАМЕРЕНИЕ: ${x.substring(0, 500)}` : '')(str(analysisData.strategicIntent))}
${(x => x && x !== 'Няма данни' ? `НАРАТИВНА АРХИТЕКТУРА: ${x.substring(0, 500)}` : '')(str(analysisData.narrativeArchitecture))}
${(x => x && x !== 'Няма данни' ? `ПСИХОЛИНГВИСТИЧЕН АНАЛИЗ: ${x.substring(0, 300)}` : '')(str(analysisData.psychoLinguisticAnalysis))}
${(x => x && x !== 'Няма данни' ? `СОЦИАЛНО ВЪЗДЕЙСТВИЕ: ${x.substring(0, 300)}` : '')(str(analysisData.socialImpactPrediction))}

═══ КРАЙ НА СУРОВИТЕ ДАННИ ═══

Сега напиши DCGE Report със следната структура. Използвай MARKDOWN форматиране (# за заглавия). Всяка секция е ОБЕЗАТЕЛНО поне 2–4 параграфа, не по едно-две изречения.

# ИЗПЪЛНИТЕЛНО РЕЗЮМЕ
Минимум 3–4 параграфа. Какво разкрихме? Каква е голямата картина? Защо е важно? Кого засяга?

# КЛЮЧОВИ РАЗКРИТИЯ
Минимум 2–3 параграфа. Какво ни изненада? Кои факти са критични? Какво не е очевидно на пръв поглед? Конкретики, не общи приказки.

# ВЕРИФИКАЦИЯ НА ТВЪРДЕНИЯТА
Минимум 3–4 параграфа. Журналистически разказ за проверката – не списък, а РАЗСЪЖДЕНИЕ. Кои твърдения издържат? Кои не? Защо? Свържи ги с доказателствата от данните.

# АНАТОМИЯ НА МАНИПУЛАЦИЯТА
Минимум 2–3 параграфа. Как работят разкритите манипулации? Защо са ефективни? Какъв е механизмът? Свържи ги в обща стратегия и въздействие върху аудиторията.

# КОНТЕКСТ И ИМПЛИКАЦИИ
Минимум 2–3 параграфа. Геополитически, исторически, социален контекст. Какво означава това в по-голямата картина? Какви са последиците?

# ЕКСПЕРТНА ОЦЕНКА
Минимум 2–3 параграфа. Професионално експертно мнение. Обективна оценка. Силни и слаби страни на материала. Ясно посочени критерии.

# ЗАКЛЮЧЕНИЕ
Минимум 2 параграфа. Заключителни мисли. Какви въпроси остават?

# КРАЙ
Само един ред: DCGE Report (${reportDate})

ИЗИСКВАНЕ: Всяка секция трябва да е разгъната и конкретна. Кратките, повърхностни отговори са НЕПРИЕМЛИМИ. Докладът трябва да е толкова добър, че потребителят да каже "WOW – това е истински журналистически анализ!"`;
};
