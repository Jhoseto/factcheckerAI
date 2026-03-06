/**
 * Lemon Squeezy Checkout Route
 * /api/lemonsqueezy/checkout — Creates a checkout session
 */

import express from 'express';

const router = express.Router();

router.post('/checkout', async (req, res) => {
    try {
        const { variantId, userId, userEmail, points } = req.body;

        if (!variantId) return res.status(400).json({ error: 'Variant ID is required' });
        if (!userId) return res.status(400).json({ error: 'User ID is required' });
        const email = (userEmail || '').trim();
        if (!email) return res.status(400).json({ error: 'Email is required for checkout. Please add an email to your account.' });

        const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
        const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

        if (!apiKey || !storeId) {
            console.error('[Lemon Squeezy] Missing API_KEY or STORE_ID');
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        const origin = req.headers.origin || req.headers.referer || `${req.protocol}://${req.get('host')}`;
        const redirectUrl = origin.replace(/\/$/, '') + '/?payment=success';

        const checkout = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                data: {
                    type: 'checkouts',
                    attributes: {
                        product_options: { redirect_url: redirectUrl },
                        checkout_data: {
                            email,
                            custom: {
                                userId,
                                user_id: userId,
                                points: String(points ?? 0)
                            }
                        }
                    },
                    relationships: {
                        store: { data: { type: 'stores', id: String(storeId) } },
                        variant: { data: { type: 'variants', id: String(variantId) } }
                    }
                }
            })
        });

        const checkoutData = await checkout.json();

        if (checkoutData.data?.attributes?.url) {
            res.json({ checkoutUrl: checkoutData.data.attributes.url });
        } else {
            const errDetail = checkoutData.errors?.[0]?.detail || checkoutData.errors?.[0]?.title || checkoutData.message;
            console.error('[Lemon Squeezy] ❌ API error:', errDetail || JSON.stringify(checkoutData, null, 2));
            res.status(checkout.status >= 400 ? checkout.status : 500).json({
                error: errDetail || 'Failed to create checkout'
            });
        }
    } catch (error) {
        console.error('[Lemon Squeezy] ❌ Checkout error:', error.message);
        res.status(500).json({ error: 'Failed to create checkout' });
    }
});

export default router;
