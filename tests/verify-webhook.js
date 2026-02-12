import fetch from 'node-fetch';
import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:8080/api/lemonsqueezy/webhook';
// Use the ID of a real user or a test user you want to credit
const USER_ID = '8tCJ1jBt8QVqExKIk1HRLc19R4U2';
const POINTS = 500;
const SECRET = 'Podpisvambatko'; // Must match server .env

console.log('--- Testing Webhook Implementation with Signature ---');
console.log(`Target User: ${USER_ID}`);
console.log(`Adding Points: ${POINTS}`);
console.log(`Using Secret: ${SECRET}`);

// Construct Lemon Squeezy payload
const payload = {
    meta: {
        event_name: 'order_created'
    },
    data: {
        attributes: {
            status: 'paid',
            first_order_item: {
                custom_data: {
                    user_id: USER_ID,
                    points: POINTS.toString()
                }
            }
        }
    }
};

const payloadString = JSON.stringify(payload);

// Compute Signature
const hmac = crypto.createHmac('sha256', SECRET);
const digest = hmac.update(payloadString).digest('hex');

console.log(`Computed Signature: ${digest}`);
console.log('Sending webhook payload...');

try {
    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-signature': digest
        },
        body: payloadString
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
