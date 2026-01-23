/**
 * Extract YouTube transcript via server-side Gemini API
 * This is cheaper than full video analysis as we only ask for text extraction
 */
export const extractYouTubeTranscript = async (url: string): Promise<string> => {
    try {
        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-2.0-flash-exp',
                videoUrl: url,
                prompt: 'Extract and return only the transcript/spoken text from this video. Return just the text, no formatting or additional commentary.'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to extract transcript');
        }

        const data = await response.json();
        return data.text || '';
    } catch (error: any) {
        console.error('Transcript extraction error:', error);
        throw new Error(error.message || 'Грешка при извличане на текста');
    }
};
