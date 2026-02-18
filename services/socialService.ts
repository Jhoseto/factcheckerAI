/**
 * Social Media Analysis Service
 * Client-side service for analyzing Facebook, Twitter/X, TikTok posts
 */

import { auth } from './firebase';
import { handleApiError } from './errorHandler';
import { VideoAnalysis, APIUsage } from '../types';
import { getSocialAnalysisPrompt, getCommentAnalysisPrompt } from './prompts/socialAnalysisPrompt';

export interface SocialScrapeResponse {
    postContent: string;
    author: string;
    platform: 'facebook' | 'twitter' | 'tiktok';
    likes?: number;
    shares?: number;
    comments?: string[];
    timestamp?: string;
}

/**
 * Scrapes a social media post for analysis
 * Note: Real implementation would use server-side scraping
 */
export const scrapeSocialPost = async (url: string): Promise<SocialScrapeResponse> => {
    try {
        const response = await fetch('/api/social/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to scrape social post');
        }

        return response.json();
    } catch (error: any) {
        console.error('[SocialService] Scrape error:', error);
        throw error;
    }
};

/**
 * Analyzes a social media post
 */
export const analyzeSocialPost = async (
    url: string,
    scraped: SocialScrapeResponse,
    analysisType: 'post' | 'comments' | 'full',
    onProgress?: (status: string) => void
): Promise<{ analysis: VideoAnalysis; usage: APIUsage }> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User must be logged in');

        const token = await user.getIdToken();
        
        // Determine service type based on analysis type
        const serviceType = analysisType === 'full' ? 'socialFullAudit' 
            : analysisType === 'comments' ? 'commentAnalysis' 
            : 'socialPost';

        const prompt = analysisType === 'comments' && scraped.comments
            ? getCommentAnalysisPrompt(scraped.platform, scraped.comments)
            : getSocialAnalysisPrompt(scraped.platform, scraped.postContent, scraped.comments);

        onProgress?.('Инициализиране на AI анализатор...');

        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                prompt: prompt,
                mode: 'standard',
                serviceType: serviceType,
                systemInstruction: 'You are a professional fact-checker. You MUST answer in Bulgarian language only.'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.error || 'Analysis failed');
            (error as any).status = response.status;
            (error as any).code = errorData.code;
            throw error;
        }

        const data = await response.json();
        const rawAnalysis = JSON.parse(cleanJsonResponse(data.text));

        const usage: APIUsage = {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0,
            estimatedCostUSD: 0,
            pointsCost: data.points?.costInPoints || 8,
            newBalance: data.points?.newBalance
        };

        return {
            analysis: transformSocialAnalysis(rawAnalysis, scraped, usage.pointsCost, analysisType),
            usage
        };

    } catch (error: any) {
        throw handleApiError(error);
    }
};

/**
 * Clean JSON response from Gemini
 */
const cleanJsonResponse = (text: string): string => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);
    return jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
};

/**
 * Transform social analysis response to VideoAnalysis format
 */
const transformSocialAnalysis = (
    raw: any, 
    scraped: SocialScrapeResponse, 
    pointsCost: number,
    analysisType: string
): VideoAnalysis => {
    return {
        id: `social-${Date.now()}`,
        timestamp: Date.now(),
        videoTitle: raw.title || `${scraped.platform} Post Analysis`,
        videoAuthor: scraped.author || 'Unknown',
        transcription: [],
        segments: [],
        claims: (raw.factualClaims || raw.problematicComments || []).map((c: any) => ({
            quote: c.claim || c.comment || '',
            formulation: c.claim || c.comment || '',
            category: 'social',
            weight: 'средна' as const,
            confidence: c.confidence || 0.5,
            veracity: transformVerdict(c.verdict || (c.issue === 'deztinfo' ? 'FALSE' : 'MIXED')),
            explanation: c.evidence || c.issue || '',
            missingContext: ''
        })),
        manipulations: (raw.manipulationTechniques || []).map((m: any) => ({
            technique: m.technique || 'Emotional Manipulation',
            timestamp: '0:00',
            logic: m.description || '',
            effect: '',
            severity: m.severity || 0.5
        })),
        fallacies: [],
        timeline: [],
        summary: {
            credibilityIndex: raw.sentimentAnalysis?.overall === 'positive' ? 0.7 
                : raw.sentimentAnalysis?.overall === 'negative' ? 0.3 
                : 0.5,
            manipulationIndex: raw.manipulationTechniques?.length ? 0.6 : 0.2,
            unverifiablePercent: 0,
            finalClassification: raw.overallAssessment || 'MIXED',
            overallSummary: raw.summary || raw.commentSummary || '',
            totalDuration: '0:00',
            detailedStats: {
                factualAccuracy: 0.5,
                logicalSoundness: 0.5,
                emotionalBias: raw.sentimentAnalysis?.toxicity || 0.3,
                propagandaScore: 0.3,
                sourceReliability: 0.5,
                subjectivityScore: 0.6,
                objectivityScore: 0.4,
                biasIntensity: 0.5,
                narrativeConsistencyScore: 0.7,
                semanticDensity: 0.5,
                contextualStability: 0.5
            },
            finalInvestigativeReport: raw.summary || '',
            geopoliticalContext: '',
            historicalParallel: '',
            psychoLinguisticAnalysis: '',
            strategicIntent: '',
            narrativeArchitecture: '',
            technicalForensics: '',
            socialImpactPrediction: raw.commentSummary || '',
            sourceNetworkAnalysis: '',
            dataPointsProcessed: 0,
            recommendations: raw.recommendations || ''
        },
        pointsCost: pointsCost,
        analysisMode: 'standard'
    };
};

/**
 * Transform verdict strings
 */
const transformVerdict = (verdict: string): string => {
    const map: Record<string, string> = {
        'TRUE': 'вярно',
        'MOSTLY_TRUE': 'предимно вярно',
        'MIXED': 'частично вярно',
        'MOSTLY_FALSE': 'подвеждащо',
        'FALSE': 'невярно',
        'UNVERIFIABLE': 'непроверимо'
    };
    return map[verdict] || 'частично вярно';
};
