/**
 * Social Media Analysis Prompts
 * Used for analyzing Facebook, Twitter/X, and TikTok posts + comments
 */

/**
 * Generates a prompt for analyzing social media posts
 */
export const getSocialAnalysisPrompt = (
    platform: 'facebook' | 'twitter' | 'tiktok',
    postContent: string,
    comments?: string[]
): string => {
    const platformName = {
        facebook: 'Facebook',
        twitter: 'Twitter/X',
        tiktok: 'TikTok'
    }[platform];

    const commentSection = comments && comments.length > 0
        ? `\n\n=== КОМЕНТАРИ ЗА АНАЛИЗ ===\n${comments.slice(0, 50).map((c, i) => `Коментар ${i + 1}: "${c}"`).join('\n')}`
        : '';

    return `Ти си експертен фактчекър и журналист с 20+ години опит. Твоята мисия е да направиш изключителен критичен анализ на ${platformName} публикация.

=== ПУБЛИКАЦИЯ ЗА АНАЛИЗ ===
${postContent}
${commentSection}

ЗАДАЧА:
1. Идентифицирай всички твърдения в публикацията
2. Провери фактическата точност на всяко твърдение
3. Анализирай тона и емоционалната манипулация
4. Идентифицирай логически заблуди и когнитивни отклонения
5. Ако има коментари, анализирай общата атмосфера и sentiment
6. Дай крайна оценка за достоверността

ИЗХОДЕН ФОРМАТ (само JSON):
{
  "title": "Заглави анализ",
  "postContent": "${postContent.substring(0, 200)}...",
  "platform": "${platformName}",
  "overallAssessment": "MIXED/ACCURATE/MISLEADING/FALSE",
  "summary": "Кратко резюме на анализа (2-3 изречения)",
  "factualClaims": [
    {
      "claim": "Твърдението",
      "verdict": "TRUE/MOSTLY_TRUE/MIXED/MOSTLY_FALSE/FALSE/UNVERIFIABLE",
      "evidence": "Доказателства или обяснение",
      "confidence": 0.85
    }
  ],
  "manipulationTechniques": [
    {
      "technique": "Име на техниката",
      "description": "Описание",
      "severity": 0.7
    }
  ],
  "sentimentAnalysis": {
    "overall": "positive/negative/neutral/mixed",
    "emotions": ["гняв", "страх", "радост"],
    "toxicity": 0.3
  },
  "commentSummary": "Обобщение на коментарите (ако има такива)",
  "recommendations": "Препоръки за потребителя"
}`;
};

/**
 * Generates a prompt specifically for comment analysis
 */
export const getCommentAnalysisPrompt = (
    platform: 'facebook' | 'twitter' | 'tiktok',
    comments: string[]
): string => {
    const platformName = {
        facebook: 'Facebook',
        twitter: 'Twitter/X',
        tiktok: 'TikTok'
    }[platform];

    const commentSection = comments
        .slice(0, 50)
        .map((c, i) => `Коментар ${i + 1}: "${c}"`)
        .join('\n');

    return `Ти си експертен анализатор на социални медии. Твоята мисия е да анализираш коментари от ${platformName}.

=== КОМЕНТАРИ ЗА АНАЛИЗ ===
${commentSection}

ЗАДАЧА:
1. Идентифицирай основните теми и настроения
2. Намери дезинформация или подвеждащи твърдения
3. Идентифицирай ботове или неавтентични акаунти ( по шаблони)
4. Анализирай toxic behavior и harassment
5. Дай обща оценка на дискусията

ИЗХОДЕН ФОРМАТ (само JSON):
{
  "totalComments": ${comments.length},
  "overallSentiment": "positive/negative/neutral/mixed",
  "mainThemes": ["тема1", "тема2"],
  "problematicComments": [
    {
      "comment": "Проблемния коментар",
      "issue": "дезинформация/bot/toxic/harassment",
      "severity": 0.8
    }
  ],
  "botDetection": {
    "suspectedBots": 5,
    "confidence": 0.6,
    "patterns": ["шаблонен текст", "автоматични отговори"]
  },
  "summary": "Обобщение на дискусията"
}`;
};
