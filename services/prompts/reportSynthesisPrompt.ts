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
    const claimsSummary = (analysisData.claims || []).slice(0, 15).map((c, i) =>
        `${i + 1}. "${c.claim}" → ${c.verdict}${c.speaker ? ` (${c.speaker})` : ''}${c.evidence ? ` | ${c.evidence.substring(0, 150)}` : ''}`
    ).join('\n');

    const manipulationsSummary = (analysisData.manipulations || []).slice(0, 10).map((m, i) =>
        `${i + 1}. ${m.technique}${m.description ? `: ${m.description.substring(0, 150)}` : ''}${m.impact ? ` | Въздействие: ${m.impact.substring(0, 100)}` : ''}`
    ).join('\n');

    return `Ти си независим експерт по факт-чек и медиа анализ. Направи DCGE Report (${new Date().toISOString()}). Получаваш суровите данни от анализа на видео материала и трябва да напишеш професионален доклад.

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

${analysisData.geopoliticalContext && analysisData.geopoliticalContext !== 'Неприложимо' ? `ГЕОПОЛИТИЧЕСКИ КОНТЕКСТ: ${analysisData.geopoliticalContext.substring(0, 500)}` : ''}
${analysisData.strategicIntent && analysisData.strategicIntent !== 'Няма данни' ? `СТРАТЕГИЧЕСКО НАМЕРЕНИЕ: ${analysisData.strategicIntent.substring(0, 500)}` : ''}
${analysisData.narrativeArchitecture && analysisData.narrativeArchitecture !== 'Няма данни' ? `НАРАТИВНА АРХИТЕКТУРА: ${analysisData.narrativeArchitecture.substring(0, 500)}` : ''}
${analysisData.psychoLinguisticAnalysis && analysisData.psychoLinguisticAnalysis !== 'Няма данни' ? `ПСИХОЛИНГВИСТИЧЕН АНАЛИЗ: ${analysisData.psychoLinguisticAnalysis.substring(0, 300)}` : ''}
${analysisData.socialImpactPrediction && analysisData.socialImpactPrediction !== 'Няма данни' ? `СОЦИАЛНО ВЪЗДЕЙСТВИЕ: ${analysisData.socialImpactPrediction.substring(0, 300)}` : ''}

═══ КРАЙ НА СУРОВИТЕ ДАННИ ═══

Сега напиши DCGE Report със следната структура. Използвай MARKDOWN форматиране:

# ИЗПЪЛНИТЕЛНО РЕЗЮМЕ
(3-4 параграфа. Какво разкрихме? Каква е голямата картина? Защо е важно?)

# КЛЮЧОВИ РАЗКРИТИЯ
(Какво ни изненада? Кои факти са критични? Какво не е очевидно на пръв поглед?)

# ВЕРИФИКАЦИЯ НА ТВЪРДЕНИЯТА
(Журналистически разказ за проверката. Не списък – а РАЗСЪЖДЕНИЕ. Кои твърдения издържат проверка? Кои не? Защо?)

# АНАТОМИЯ НА МАНИПУЛАЦИЯТА
(Как работят разкритите манипулации? Защо са ефективни? Какъв е механизмът? Свържи ги в обща стратегия.)

# КОНТЕКСТ И ИМПЛИКАЦИИ
(Геополитически, исторически, социален контекст. Какво означава това в по-голямата картина? Какви са последиците?)

# ЕКСПЕРТНА ОЦЕНКА
(Професионално експертно мнение. Обективна оценка. Силни и слаби страни на материала.)

# ЗАКЛЮЧЕНИЕ И ПРЕПОРЪКИ
(Заключителни мисли. Какви въпроси остават?)

# КРАЙ
(накрая на всеки доклад винаги завършваш с следното и ништо друго за край : DCGE Report (${new Date().toISOString()})

ВАЖНО: Пиши МИНИМУМ 15-20 параграфа общо. Докладът трябва да бъде толкова добър, че потребителят да каже "WOW - това е ИСТИНСКИ журналистически анализ!"`;
};
