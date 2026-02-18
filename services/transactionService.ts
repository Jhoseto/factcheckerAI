// Firestore imports removed as we now use Server API
// import { collection, query, where, getDocs } from 'firebase/firestore';
// import { db } from './firebase';

export interface Transaction {
    id: string;
    userId: string;
    type: 'deduction' | 'purchase' | 'bonus';
    amount: number;
    description: string;
    analysisId?: string;
    paymentIntentId?: string;
    createdAt: string;
    metadata?: {
        videoTitle?: string;
        videoAuthor?: string;
        videoDuration?: string | number;
        videoId?: string;
        thumbnailUrl?: string;
    };
}

import { auth } from './firebase';

export const getUserTransactions = async (userId: string, limitCount: number = 50): Promise<Transaction[]> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        const token = await user.getIdToken();

        const response = await fetch('/api/transactions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const transactions: Transaction[] = data.transactions || [];

        // Client-side sort/limit is still fine, though server does it too.
        // Server limits to 50 hardcoded in my route, but logic might change.
        // We'll return what the server gave us.
        return transactions;

    } catch (error) {
        console.error('Error fetching transactions:', error);
        throw error;
    }
};
