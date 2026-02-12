import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Load service account (MUST exist locally)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');

console.log('--- Verifying Firebase Admin Connection ---');
console.log(`Service Account Path: ${serviceAccountPath}`);

try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service account loaded successfully.');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized.');

    const db = admin.firestore();

    // 1. Try to list users (or document)
    console.log('--- Listing Users ---');
    const usersSnapshot = await db.collection('users').limit(1).get();

    if (usersSnapshot.empty) {
        console.warn('⚠️ No users found in Firestore "users" collection.');
        console.log('Creating a test user: "test-user-verify"');
        const testUserRef = db.collection('users').doc('test-user-verify');
        await testUserRef.set({
            email: 'test@verify.com',
            pointsBalance: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Created test user: test-user-verify');
    } else {
        const user = usersSnapshot.docs[0];
        console.log(`✅ Found first user: ${user.id} (${user.data().email || 'no email'})`);
        console.log(`Current Balance: ${user.data().pointsBalance}`);

        // Use this user for points test
        const userId = user.id;

        console.log('--- Adding 10 Points ---');
        const userRef = db.collection('users').doc(userId);

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw "User does not exist!";

            const currentPoints = userDoc.data().pointsBalance || 0;
            const newPoints = currentPoints + 10;
            transaction.update(userRef, { pointsBalance: newPoints });
            console.log(`Updated balance: ${currentPoints} -> ${newPoints}`);
        });

        console.log('✅ Points added successfully!');
    }

} catch (error) {
    console.error('❌ ERROR:', error);
    if (error.code === 'ENOENT') {
        console.error('The firebase-service-account.json file is NOT FOUND locally.');
        console.error('Please download it from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.');
    }
}
