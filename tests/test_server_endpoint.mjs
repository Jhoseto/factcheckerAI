/**
 * Test the real server /api/gemini/generate-stream endpoint
 * First we need a Firebase auth token - this simulates what the frontend does
 */
import { initializeApp } from '@firebase/app';
import { getAuth, signInWithEmailAndPassword } from '@firebase/auth';

// Firebase config from .env
const firebaseConfig = {
    apiKey: process.env.GEMINI_API_KEY,
    authDomain: 'factcheckerai-d376d.firebaseapp.com',
    projectId: 'factcheckerai-d376d',
};

// NOTE: This requires real Firebase credentials
// Instead, let's test without auth by calling the test endpoint or 
// by checking what happens with a direct YouTube video test

// Alternative: Write to a test file what request would look like
console.log('Server test helper');
console.log('To test the real endpoint, we need Firebase auth token');
console.log('Instead, checking server logs by making a curl-like request...');

// Make a request to the server
const testPayload = {
    model: 'gemini-2.5-flash',
    prompt: 'Analyze this video briefly and return JSON with summary and overallAssessment fields.',
    systemInstruction: 'You are a fact-checker. Return valid JSON only.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mode: 'standard',
    serviceType: 'video',
    enableGoogleSearch: true,
    lang: 'bg'
};

// Try to call the server without auth (should get 401 but we'll see the server response)
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 10000);

try {
    const resp = await fetch('http://localhost:8080/api/gemini/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-invalid' },
        body: JSON.stringify(testPayload),
        signal: ctrl.signal
    });
    console.log('Response status:', resp.status);
    const body = await resp.text();
    console.log('Response body:', body.substring(0, 500));
} catch (e) {
    if (e.name === 'AbortError') console.log('Request timeout (expected)');
    else console.error('Request failed:', e.message);
}
