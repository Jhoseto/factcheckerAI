/**
 * ChatBot Gemini AI — uses GEMINI_API_KEY from process.env (root .env)
 */
import { GoogleGenAI } from '@google/genai';

let aiInstance = null;

function getAIInstance() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
}

export async function getAIResponse(message, history) {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: 'You are a helpful assistant for FactChecker AI, a fact-checking platform for videos and articles. Help users with questions about how the service works, pricing, analysis types, and technical support. Be professional, concise, and friendly. If you don\'t know something, offer to connect the user to a human agent.'
      }
    });
    return response.text || 'I am currently unable to process your request. Please try again later or contact support.';
  } catch (error) {
    return 'I am currently unable to process your request. Please try again later or contact support.';
  }
}
