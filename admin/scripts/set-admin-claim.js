#!/usr/bin/env node
/**
 * Set admin custom claims for a user.
 * Usage:
 *   node admin/scripts/set-admin-claim.js <UID>           — sets admin: true
 *   node admin/scripts/set-admin-claim.js <UID> --super-admin — sets admin: true, super_admin: true
 */
import 'dotenv/config';
import { initializeFirebaseAdmin } from '../../server/services/firebaseAdmin.js';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const uid = args.find(a => !a.startsWith('--'));
const isSuperAdmin = args.includes('--super-admin');

if (!uid) {
    console.error('Usage: node admin/scripts/set-admin-claim.js <UID> [--super-admin]');
    process.exit(1);
}

initializeFirebaseAdmin();

const claims = isSuperAdmin ? { admin: true, super_admin: true } : { admin: true };

admin.auth().setCustomUserClaims(uid, claims)
    .then(() => {
        console.log(`OK: Set claims for ${uid}:`, claims);
    })
    .catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    });
