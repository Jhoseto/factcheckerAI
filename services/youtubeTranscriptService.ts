import { TranscriptionLine } from '../types';
import { auth } from './firebase';

/**
 * Format timestamp from seconds to MM:SS or HH:MM:SS
 */
const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Extract YouTube transcript via server-side Gemini API
 * Returns structured transcript with timestamps and speaker information
 */
export const extractYouTubeTranscript = async (url: string): Promise<TranscriptionLine[]> => {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User must be logged in to extract transcript');
        }
        const token = await user.getIdToken();

        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                videoUrl: url, // ВАЖНО: Изпращаме videoUrl за да анализира правилното видео
                prompt: `Извлечи пълната транскрипция от това YouTube видео.

ВАЖНО: Върни резултата като JSON масив в следния формат:
[
  {
    "timestamp": "00:00",
    "speaker": "Speaker 1",
    "text": "Първата реченица от видеото..."
  },
  {
    "timestamp": "00:05",
    "speaker": "Speaker 1",
    "text": "Втората реченица..."
  },
  ...
]

ИНСТРУКЦИИ:
- Включи ВСИЧКИ реченици от видеото
- За всеки сегмент добави точния timestamp (MM:SS или HH:MM:SS формат)
- Ако има различни говорители, посочи ги в полето "speaker"
- Ако няма информация за говорители, използвай "Speaker" или "Автор"
- Върни САМО валиден JSON масив, без допълнителен текст преди или след него`,
                systemInstruction: 'Ти си експерт в извличане на транскрипции от видеа. Връщай само валиден JSON масив с транскрипцията. Не добавяй никакъв друг текст освен JSON-а.'
            })
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
            }

            // Create error object with status code for proper error handling
            const error = new Error(errorData.error || 'Failed to extract transcript');
            (error as any).status = response.status;
            (error as any).statusCode = response.status;
            (error as any).code = errorData.code;
            throw error;
        }

        const data = await response.json();

        if (!data.text || typeof data.text !== 'string') {
            throw new Error('Gemini API не върна транскрипция');
        }

        let transcript: any[];
        try {
            transcript = JSON.parse(data.text);
        } catch (parseError: any) {
            console.error('Transcript JSON parse error:', parseError);
            throw new Error('Грешка при парсиране на транскрипцията. Моля, опитайте отново.');
        }

        // Validate and transform to TranscriptionLine[]
        if (!Array.isArray(transcript)) {
            throw new Error('Транскрипцията не е валиден масив');
        }

        // Transform to TranscriptionLine format
        const formattedTranscript: TranscriptionLine[] = transcript
            .filter((item: any) => item && item.text) // Filter out invalid entries
            .map((item: any, index: number) => ({
                timestamp: item.timestamp || formatTimestamp(index * 5), // Default 5 seconds per entry
                speaker: item.speaker || 'Speaker',
                text: item.text || ''
            }));

        // If no transcript was extracted, return a single entry indicating no transcript
        if (formattedTranscript.length === 0) {
            return [{
                timestamp: '00:00',
                speaker: 'Система',
                text: 'Транскрипцията не беше налична за това видео. Възможни причини: видеото няма субтитри, е частно, или е премахнато.'
            }];
        }

        return formattedTranscript;
    } catch (error: any) {
        console.error('Transcript extraction error:', error);

        // Return error message as transcript entry instead of throwing
        // This allows the analysis to continue even if transcript extraction fails
        return [{
            timestamp: '00:00',
            speaker: 'Система',
            text: `Грешка при извличане на транскрипция: ${error.message || 'Неизвестна грешка'}`
        }];
    }
};
