# 🍋 Lemon Squeezy Setup Guide

## Защо Lemon Squeezy?

- ✅ **Директно плащане с карта** - Visa, Mastercard, Amex, PayPal
- ✅ **Автоматично управление на ДДС** - За всички EU държави
- ✅ **По-ниски такси** от Stripe
- ✅ **Лесна интеграция** - Няколко минути setup
- ✅ **Безплатен план** за начало

---

## Стъпка 1: Създаване на Lemon Squeezy акаунт

1. **Отидете на:** https://lemonsqueezy.com
2. **Кликнете** "Get started" → Sign up
3. **Попълнете** данните си
4. **Потвърдете** email адреса

---

## Стъпка 2: Създаване на Store

1. **В Dashboard:** Кликнете "Create a store"
2. **Име:** "FactChecker AI" (или друго)
3. **URL:** factchecker-ai (или каквото искате)
4. **Currency:** EUR (за цените €5, €15, €44, €99)
5. **Запазете** store ID-то (ще ви трябва)

---

## Стъпка 3: Създаване на продукти

За всеки tier трябва да създадете продукт + variant:

### **Starter Pack** (€5)
1. **Products** → "Create product"
2. **Name:** "Starter Points Pack"
3. **Description:** "500 analysis points"
4. **Price:** €5.00
5. **Type:** Single payment
6. **Запазете** → Копирайте **Variant ID**

### **Standard Pack** (€15)
- **Name:** "Standard Points Pack"
- **Price:** €15.00
- **Description:** "1700 analysis points (1500 + 200 bonus)"
- Копирайте **Variant ID**

### **Professional Pack** (€44)
- **Name:** "Professional Points Pack"  
- **Price:** €44.00
- **Description:** "5500 analysis points (4500 + 1000 bonus)"
- Копирайте **Variant ID**

### **Enterprise Pack** (€99)
- **Name:** "Enterprise Points Pack"
- **Price:** €99.00
- **Description:** "13000 analysis points (10000 + 3000 bonus)"
- Копирайте **Variant ID**

---

## Стъпка 4: Вземане на API ключове

### API Key:
1. **Settings** → **API** 
2. **Create API Key**
3. **Name:** "FactChecker Backend"
4. **Permissions:** Read checkouts, Write checkouts, Read orders
5. **Копирайте** ключа (показва се само веднъж!)

### Store ID:
1. **Settings** → **Stores**
2. **Вашият store** → Вижте ID-то в URL или Settings

### Webhook Secret:
1. **Settings** → **Webhooks**
2. **Create webhook**
3. **URL:** `https://your-domain.com/api/lemonsqueezy/webhook`
4. **Events:** Изберете `order_created`
5. **Копирайте** Signing Secret

---

## Стъпка 5: Конфигуриране на .env

Добавете в `.env` файла:

```bash
# Lemon Squeezy Configuration
LEMON_SQUEEZY_API_KEY=your_api_key_here
LEMON_SQUEEZY_STORE_ID=your_store_id_here
LEMON_SQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Стъпка 6: Добавяне на Variant IDs

Отворете `components/pricing/PricingPage.tsx` и добавете variant IDs:

```typescript
const pricingTiers = [
  {
    id: 'starter',
    variantId: '123456', // ⬅️ Вашият Starter variant ID
    // ...
  },
  {
    id: 'standard',
    variantId: '123457', // ⬅️ Вашият Standard variant ID
    // ...
  },
  {
    id: 'professional',
    variantId: '123458', // ⬅️ Вашият Professional variant ID
    // ...
  },
  {
    id: 'enterprise',
    variantId: '123459', // ⬅️ Вашият Enterprise variant ID
    // ...
  }
];
```

---

## Стъпка 7: Тестване

### Test режим (безплатно):
1. В Lemon Squeezy dashboard активирайте **Test mode**
2. Използвайте тестови карти:
   - **Card:** 4242 4242 4242 4242
   - **Expiry:** Всяка бъдеща дата
   - **CVC:** Всяко 3-цифрено число

### Тестов поток:
1. Отворете `/pricing`
2. Изберете tier
3. Кликнете "Плати с карта"
4. Ще се отвори Lemon Squeezy checkout
5. Попълнете тестови данни
6. Потвърдете плащането
7. Ще бъдете пренасочени обратно

---

## Стъпка 8: Production

### Когато сте готови:
1. **Деактивирайте** Test mode
2. **Добавете** банкови детайли в Settings → Payouts
3. **Активирайте** Live mode
4. **Тествайте** с реална карта (малка сума)

---

## 🔐 Webhook Signature Verification (Production)

**ВАЖНО:** За production трябва да верифицирате webhook signatures!

В `server.js` на ред ~346, добавете:

```javascript
const crypto = require('crypto');

// Verify signature
const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body.toString())
    .digest('hex');

if (hash !== signature) {
    return res.status(400).json({ error: 'Invalid signature' });
}
```

---

## 💡 Автоматично кредитиране на точки

След успешно плащане, трябва да добавите точки към потребителя.

В webhook endpoint (`server.js`):

```javascript
// Import Firebase Admin
import admin from 'firebase-admin';

// In webhook handler:
if (userId && points > 0) {
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
        pointsBalance: admin.firestore.FieldValue.increment(points)
    });
    
    // Log transaction
    await db.collection('transactions').add({
        userId,
        type: 'purchase',
        amount: points,
        orderId: event.data.id,
        createdAt: new Date()
    });
}
```

---

## 📊 Dashboard

В Lemon Squeezy dashboard можете да следите:
- 💰 Продажби в реално време
- 📈 Revenue графики
- 👥 Customer списък
- 💳 Refunds управление

---

## ❓ Troubleshooting

**"Variant ID is required"**
→ Добавете variant IDs в `PricingPage.tsx`

**"Lemon Squeezy not configured"**
→ Проверете `.env` файла за API key и Store ID

**Checkout не се отваря**
→ Проверете console за грешки, уверете се че варіант ID е валиден

**Webhook не работи**
→ Използвайте ngrok за локално тестване: `ngrok http 8080`

---

**Готово!** Сега имате работеща payment система с директно плащане с карта! 🎉
