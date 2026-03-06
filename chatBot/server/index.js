/**
 * ChatBot module — export router and socket setup for FactChecker AI integration
 */
import chatBotRouter from './routes.js';
import { setupChatBotSocket } from './socket.js';

export { chatBotRouter, setupChatBotSocket };
