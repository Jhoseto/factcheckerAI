/**
 * Archive Service
 * Saves and retrieves past analyses
 */

import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, limit, Timestamp, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { VideoAnalysis } from '../types';

export interface SavedAnalysis {
    id?: string;
    userId: string;
    type: 'video' | 'link' | 'social';
    title: string;
    url?: string;
    analysis: VideoAnalysis;
    createdAt: Timestamp | Date;
    isPublic?: boolean; // Flag for public sharing
}

/**
 * Get count of analyses by type for a user
 */
export const getAnalysisCountByType = async (userId: string, type: 'video' | 'link' | 'social'): Promise<number> => {
    try {
        const q = query(
            collection(db, 'analyses'),
            where('userId', '==', userId),
            where('type', '==', type)
        );
        // Using getDocs for now as 'count()' might require newer SDK/server support or different aggregation query
        // For < 100 items, getDocs is fine cost-wise.
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('[ArchiveService] Error counting analyses:', error);
        return 0;
    }
};

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
            createdAt: Timestamp.fromDate(new Date()),
            isPublic: true, // Запазените доклади са публични за споделяне
        });

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

/**
 * Get analysis by ID (for report page)
 * Works for both private (owner) and public (shared) analyses
 */
export const getAnalysisById = async (id: string): Promise<SavedAnalysis | null> => {
    try {
        const docRef = doc(db, 'analyses', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            } as SavedAnalysis;
        } else {
            return null;
        }
    } catch (error) {
        console.error('[ArchiveService] Error fetching analysis by ID:', error);
        return null;
    }
};

/**
 * Mark an analysis as public (for sharing)
 */
export const makeAnalysisPublic = async (analysisId: string, userId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'analyses', analysisId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('Analysis not found');
        }
        
        const data = docSnap.data();
        if (data.userId !== userId) {
            throw new Error('Unauthorized: Only owner can make analysis public');
        }
        
        // Update the document to mark it as public
        await updateDoc(docRef, { isPublic: true });
    } catch (error) {
        console.error('[ArchiveService] Error making analysis public:', error);
        throw error;
    }
};

/**
 * Save public report (for sharing)
 */
export const savePublicReport = async (analysisId: string, data: any): Promise<string> => {
    // For now, we reuse the 'analyses' collection but we might want a separate 'public_reports' 
    // collection if we want to separate private/public data strictly.
    // However, since we want to share existing analyses, we can just ensure the ID exists.
    // If we want to create a separate permalink with specific metadata, we can do it here.

    // Implementation: Just return the ID for now, assuming 'analyses' is readable if we configure rules.
    // Alternatively, copy to 'public_reports'.
    try {
        const publicRef = await addDoc(collection(db, 'public_reports'), {
            originalAnalysisId: analysisId,
            data,
            createdAt: Timestamp.now()
        });
        return publicRef.id;
    } catch (error) {
        console.error("Error creating public report", error);
        throw error;
    }
};

/**
 * Delete an analysis
 */
export const deleteAnalysis = async (analysisId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'analyses', analysisId));
    } catch (error) {
        console.error('[ArchiveService] Error deleting analysis:', error);
        throw error;
    }
};
