/**
 * Archive Service
 * Saves and retrieves past analyses
 */

import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, limit, Timestamp } from 'firebase/firestore';
import { VideoAnalysis } from '../types';

export interface SavedAnalysis {
    id?: string;
    userId: string;
    type: 'video' | 'link' | 'social';
    title: string;
    url?: string;
    analysis: VideoAnalysis;
    createdAt: Timestamp | Date;
}

/**
 * Save an analysis to archive
 */
export const saveAnalysis = async (
    userId: string,
    type: 'video' | 'link' | 'social',
    title: string,
    analysis: VideoAnalysis,
    url?: string
): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, 'analyses'), {
            userId,
            type,
            title,
            url,
            analysis: JSON.parse(JSON.stringify(analysis)), // Remove non-serializable fields
            createdAt: Timestamp.fromDate(new Date())
        });
        
        console.log('[ArchiveService] Analysis saved:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('[ArchiveService] Error saving analysis:', error);
        throw error;
    }
};

/**
 * Get user's archived analyses
 */
export const getUserAnalyses = async (
    userId: string,
    type?: 'video' | 'link' | 'social',
    maxResults: number = 50
): Promise<SavedAnalysis[]> => {
    try {
        let q = query(
            collection(db, 'analyses'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(maxResults)
        );

        if (type) {
            q = query(
                collection(db, 'analyses'),
                where('userId', '==', userId),
                where('type', '==', type),
                orderBy('createdAt', 'desc'),
                limit(maxResults)
            );
        }

        const snapshot = await getDocs(q);
        const analyses: SavedAnalysis[] = [];
        
        snapshot.forEach((doc) => {
            analyses.push({
                id: doc.id,
                ...doc.data()
            } as SavedAnalysis);
        });

        return analyses;
    } catch (error) {
        console.error('[ArchiveService] Error fetching analyses:', error);
        return [];
    }
};

/**
 * Get recent analyses (for dashboard)
 */
export const getRecentAnalyses = async (
    userId: string,
    maxResults: number = 5
): Promise<SavedAnalysis[]> => {
    return getUserAnalyses(userId, undefined, maxResults);
};
