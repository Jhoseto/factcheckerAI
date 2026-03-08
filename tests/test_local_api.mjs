import http from 'http';

const postData = JSON.stringify({
    model: 'gemini-2.5-flash',
    prompt: 'Анализирай това видео: https://www.youtube.com/watch?v=dQw4w9WgXcQ. Изведи всички манипулации, език на тялото, и напреви пълен факт-чекинг.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mode: 'deep',
    enableGoogleSearch: true,
    lang: 'bg'
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/api/gemini/generate-stream',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3RfdXNlcl9mcm9tX3NjcmlwdCJ9.OmwoYGNEmIImc55ZIHMoaulLr9KHIPdtCp1WZkXwk2eE'
    }
};

console.log('Sending request to localhost:8080...');

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        // Only print events that look like complete/error to avoid spam
        if (chunk.includes('event: complete') || chunk.includes('event: error') || chunk.includes('usageMetadata')) {
            console.log(`BODY: ${chunk.substring(0, 500)}...`);
        } else if (chunk.includes('event: progress')) {
            process.stdout.write('.');
        }
    });
    res.on('end', () => {
        console.log('\nNo more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
