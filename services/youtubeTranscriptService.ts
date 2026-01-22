
import { GoogleGenAI } from "@google/genai";

/**
 * Extract transcript from YouTube video using Gemini
 * This is cheaper than full video analysis as we only ask for text extraction
 */
export const extractYouTubeTranscript = async (url: string): Promise<string> => {
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
                        text: `Извлечи ПЪЛНАТА транскрипция на това видео.
            
            ВАЖНО:
            - Извлечи ВСИЧКИ изречени думи от началото до края
            - Запази хронологичния ред
            - НЕ анализирай, НЕ коментирай - само транскрипция
            - Форматирай като обикновен текст, разделен на параграфи
            
            Върни само транскрипцията, без допълнителни коментари.`
                    }
                ]
            }]
        });

        if (!response.text) {
            throw new Error("Не може да се извлече транскрипция от видеото");
        }

        return response.text.trim();
    } catch (e: any) {
        if (e.message?.includes('429')) {
            throw new Error("Лимитът на вашия API ключ е превишен. Моля, изчакайте малко.");
        }
        throw new Error(`Грешка при извличане на транскрипция: ${e.message}`);
    }
};
