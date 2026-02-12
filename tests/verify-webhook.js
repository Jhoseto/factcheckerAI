import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:8080/api/lemonsqueezy/webhook';
const USER_ID = '8tCJ1jBt8QVqExKIk1HRLc19R4U2'; // The real user ID found in previous test
const POINTS = 500;

console.log('--- Testing Webhook Implementation ---');
console.log(`Target User: ${USER_ID}`);
console.log(`Adding Points: ${POINTS}`);

// Construct Lemon Squeezy payload
const payload = {
    meta: {
        event_name: 'order_created'
    },
    data: {
        attributes: {
            status: 'paid',
            checkout_data: {
                custom: {
                    user_id: USER_ID,
                    points: POINTS.toString()
                }
            }
        }
    }
};

console.log('Sending webhook payload...');

try {
    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response Body:', text);

    if (response.ok) {
        console.log('✅ Webhook accepted successfully!');
    } else {
        console.error('❌ Webhook failed!');
    }

} catch (error) {
    console.error('❌ Network error:', error.message);
}
