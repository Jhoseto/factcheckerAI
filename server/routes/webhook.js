/**
 * Lemon Squeezy Webhook Route
 * /api/lemonsqueezy/webhook — Handles payment events
 *
 * IDEMPOTENT: Uses processedOrders collection to prevent double-crediting
 */

import express from 'express';
import crypto from 'crypto';
import { addPointsToUser, getFirestore } from '../services/firebaseAdmin.js';

// Fallback: variant_id → points when custom_data.points is missing (sync with config/pricingConfig.ts)
const VARIANT_TO_POINTS = {
    '1362624': 500,   // starter
    '1362623': 1700,  // standard
    '1362620': 5500,  // professional
    '1362618': 12500, // enterprise
};

const router = express.Router();

// GET — for verifying endpoint is reachable (Lemon Squeezy sends POST)
router.get('/webhook', (req, res) => {
    res.json({ ok: true, message: 'Lemon Squeezy webhook endpoint. Use POST for events.' });
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        // ── Signature verification ────────────────────────────────────────────
        const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
        const signature = req.headers['x-signature'];

        if (webhookSecret) {
            const hmac = crypto.createHmac('sha256', webhookSecret);
            const digest = hmac.update(req.body).digest('hex');

            if (!signature || !crypto.timingSafeEqual(
                Buffer.from(digest, 'hex'),
                Buffer.from(signature, 'hex')
            )) {
                console.error('[Webhook] ❌ Invalid signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        } else {
            // No webhook secret — skipping signature check
        }

        // ── Parse event ───────────────────────────────────────────────────────
        let event;
        try {
            if (Buffer.isBuffer(req.body)) event = JSON.parse(req.body.toString());
            else if (typeof req.body === 'string') event = JSON.parse(req.body);
            else event = req.body;
        } catch (parseError) {
            console.error('[Webhook] JSON Parse Error:', parseError.message);
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        const eventName = event?.meta?.event_name;
        const status = event?.data?.attributes?.status;


        // ── Process paid orders ───────────────────────────────────────────────
        if (
            (eventName === 'order_created' || eventName === 'order_paid') &&
            status === 'paid'
        ) {
            const attributes = event.data?.attributes || {};
            const orderId = String(event.data.id);
            const isTestMode = !!attributes.test_mode;

            // Lemon Squeezy: custom_data in meta (primary) or nested in attributes
            const customData = event.meta?.custom_data
                || event.meta?.custom_data
                || attributes.checkout_data?.custom
                || attributes.checkout_data
                || (attributes.first_order_item && typeof attributes.first_order_item === 'object' ? attributes.first_order_item.custom_data : null)
                || {};

            let rawUserId = customData.userId ?? customData.user_id ?? customData.uid ?? customData.firebase_uid ?? '';
            let userId = String(rawUserId).trim();
            let points = parseInt(customData.points, 10) || Number(customData.points) || 0;

            // Fallback: points from variant_id when custom_data.points missing
            if (points <= 0) {
                const variantId = String(attributes.first_order_item?.variant_id ?? event.data?.attributes?.first_order_item?.variant_id ?? '').trim();
                if (variantId && VARIANT_TO_POINTS[variantId]) {
                    points = VARIANT_TO_POINTS[variantId];
                    console.log(`[Webhook] Points from variant_id fallback: ${variantId} → ${points}`);
                }
            }

            // Fallback: userId from email lookup when custom_data missing (last resort)
            if (!userId && points > 0) {
                const orderEmail = (attributes.user_email || '').trim().toLowerCase();
                if (orderEmail) {
                    const usersSnap = await getFirestore().collection('users').where('email', '==', orderEmail).limit(1).get();
                    if (!usersSnap.empty) {
                        userId = usersSnap.docs[0].id;
                        console.log(`[Webhook] userId from email lookup: ${orderEmail} → ${userId}`);
                    }
                }
            }

            if (!userId || points <= 0) {
                console.error(`[Webhook] ❌ Missing userId or points. orderId=%s customData=%s meta=%s`,
                    orderId, JSON.stringify(customData), JSON.stringify(event.meta));
                return res.status(500).json({ error: 'Missing userId or points', received: true });
            }

            const txOptions = isTestMode
                ? { type: 'bonus', source: 'lemonsqueezy_test', description: `Бонус (Lemon Squeezy тест): ${points} точки` }
                : { type: 'purchase', source: 'lemonsqueezy', description: `Зареждане на ${points} точки` };

            console.log(`[Webhook] Processing order ${orderId} → userId=${userId} points=${points} ${isTestMode ? '(TEST MODE → bonus)' : '(purchase)'}`);
            try {
                await addPointsToUser(userId, points, orderId, txOptions);
                console.log(`[Webhook] ✅ Credited ${points} points to user ${userId} (order ${orderId})`);
            } catch (error) {
                console.error(`[Webhook] ❌ Failed to add points for user ${userId}:`, error.message);
                // Return 500 so Lemon Squeezy retries — but addPointsToUser is idempotent
                return res.status(500).json({ error: 'Failed to credit points' });
            }
        } else {
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Webhook] Unexpected error:', error.message);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

export default router;
