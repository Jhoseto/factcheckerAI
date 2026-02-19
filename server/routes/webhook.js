/**
 * Lemon Squeezy Webhook Route
 * /api/lemonsqueezy/webhook — Handles payment events
 *
 * IDEMPOTENT: Uses processedOrders collection to prevent double-crediting
 */

import express from 'express';
import crypto from 'crypto';
import { addPointsToUser } from '../services/firebaseAdmin.js';

const router = express.Router();

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
            const attributes = event.data.attributes;
            const orderId = String(event.data.id);

            // Extract custom data (multiple possible locations)
            let customData = {};
            if (attributes.checkout_data?.custom) {
                customData = attributes.checkout_data.custom;
            } else if (attributes.first_order_item?.custom_data) {
                customData = attributes.first_order_item.custom_data;
            } else if (event.meta?.custom_data) {
                customData = event.meta.custom_data;
            }

            const userId = customData.userId || customData.user_id;
            const points = parseInt(customData.points) || 0;

            if (!userId || points <= 0) {
                console.error(`[Webhook] ❌ Missing userId or points in custom data:`, customData);
                return res.json({ received: true, warning: 'Missing userId or points' });
            }


            try {
                // addPointsToUser is idempotent — checks processedOrders
                await addPointsToUser(userId, points, orderId);
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
