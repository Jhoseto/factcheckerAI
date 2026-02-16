import {
    collection,
    query,
    where,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

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

export const getUserTransactions = async (userId: string, limitCount: number = 50): Promise<Transaction[]> => {
    try {
        // Query only by userId to avoid composite index requirements
        // We will sort and limit client-side
        const q = query(
            collection(db, 'transactions'),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        const transactions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Transaction));

        // Sort by createdAt desc (newest first)
        transactions.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Return limited results
        return transactions.slice(0, limitCount);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        throw error;
    }
};
