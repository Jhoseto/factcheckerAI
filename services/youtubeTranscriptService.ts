import { TranscriptionLine } from '../types';

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
 * Clean JSON response from markdown code blocks
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

    // If text doesn't start with [ or {, aggressively search for JSON array/object
    if (!cleaned.startsWith('[') && !cleaned.startsWith('{')) {
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
    
    // Remove any trailing text after the JSON
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const lastJsonChar = Math.max(lastBrace, lastBracket);
    if (lastJsonChar !== -1 && lastJsonChar < cleaned.length - 1) {
        cleaned = cleaned.substring(0, lastJsonChar + 1);
    }

    return cleaned.trim();
};

/**
 * Extract YouTube transcript via server-side Gemini API
 * Returns structured transcript with timestamps and speaker information
 */
export const extractYouTubeTranscript = async (url: string): Promise<TranscriptionLine[]> => {
    try {
        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-3-flash-preview',
                // НЕ изпращай videoUrl - използвай само URL в текста
                prompt: `Извлечи пълната транскрипция от това YouTube видео: ${url}

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
        
        if (!data.text) {
            throw new Error('Gemini API не върна транскрипция');
        }

        // Clean and parse JSON
        const cleaned = cleanJsonResponse(data.text);
        let transcript: any[];

        try {
            transcript = JSON.parse(cleaned);
        } catch (parseError: any) {
            console.error('JSON parse error:', parseError);
            console.error('Cleaned text:', cleaned.substring(0, 500));
            throw new Error('Грешка при парсиране на транскрипцията. Gemini върна невалиден JSON.');
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
