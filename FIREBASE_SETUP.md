# Firebase Service Account Setup

## Инструкции

За да работи автоматичното добавяне на точки, трябва да създадете Firebase Service Account JSON файл.

### Стъпки:

1. **Отворете Firebase Console:**
   https://console.firebase.google.com/project/factcheckerai-d376d/settings/serviceaccounts/adminsdk

2. **Генерирайте Private Key:**
   - Кликнете бутона **"Generate new private key"**
   - Кликнете **"Generate key"** в popup прозореца
   - JSON файлът ще се изтегли автоматично

3. **Преместете файла:**
   - Преименувайте го на: `firebase-service-account.json`
   - Преместете го в root папката на проекта: `H:\Apps\factcheckerAI\firebase-service-account.json`

4. **Добавете в .env:**
   Файлът вече е добавен в `.gitignore`, така че е безопасен.

5. **Рестартирайте сървъра:**
   ```bash
   # Спрете текущия сървър (Ctrl+C)
   node server.js
   ```

### Проверка:

Когато сървърът стартира успешно, трябва да видите:
```
[Firebase Admin] ✅ Initialized successfully
```

Ако видите грешка:
```
[Firebase Admin] ❌ Failed to initialize: ...
```
Проверете че:
- Файлът съществува: `H:\Apps\factcheckerAI\firebase-service-account.json`
- JSON синтаксисът е валиден

## Какво работи сега:

✅ **Welcome Bonus:** Всеки нов потребител получава 100 точки автоматично при регистрация
✅ **Lemon Squeezy:** След покупка на пакет, точките се добавят автоматично
✅ **Firestore:** Всички операции с точки се записват в базата данни

## Следващи стъпки:

1. Генериране на Service Account файл
2. Рестартиране на сървърите
3. Тестване на:
   - Нова регистрация → получаване на 100 точки
   - Покупка на пакет → добавяне на точки
   - Анализ → приспадане на точки
