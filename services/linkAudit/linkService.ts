
import { auth } from '../firebase';
import { handleApiError } from '../errorHandler';
import { getLinkAnalysisPrompt } from '../prompts/linkAnalysisPrompt';
import { VideoAnalysis, APIUsage } from '../../types';

export interface LinkScrapeResponse {
    title: string;
    content: string;
    siteName: string;
}

/**
 * Isolated service for Link Audit (Link Analysis)
 */
export const scrapeLink = async (url: string): Promise<LinkScrapeResponse> => {
    try {
        const response = await fetch('/api/link/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to scrape link');
        }

        return response.json();
    } catch (error: any) {
        console.error('[LinkService] ❌ Scrape error:', error);
        throw error;
    }
};

/**
 * Performs Deep Analysis on a news link/article content
 */
export const analyzeLinkDeep = async (
    url: string,
    content: string,
    onProgress?: (status: string) => void
): Promise<{ analysis: VideoAnalysis; usage: APIUsage }> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User must be logged in');

        const token = await user.getIdToken();
        const prompt = getLinkAnalysisPrompt(url, content);

        onProgress?.('Иницииране на задълбочен анализ на съдържанието...');

        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                prompt: prompt,
                mode: 'deep',
                enableGoogleSearch: true,
                systemInstruction: 'You are a professional fact-checker. You MUST answer in Bulgarian language only.'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.error || 'Analysis failed');
            (error as any).status = response.status;
            throw error;
        }

        const data = await response.json();
        const rawAnalysis = JSON.parse(cleanJsonResponse(data.text));

        // Note: We use 10 points fixed cost for link analysis (per user request or logic)
        // Or we deduct based on actual token usage if implemented in server.js
        const usage: APIUsage = {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            candidatesTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0,
            estimatedCostUSD: 0,
            pointsCost: 10 // Fixed 10 points for link analysis
        };

        return {
            analysis: transformAnalysis(rawAnalysis, usage.pointsCost),
            usage
        };

    } catch (error: any) {
        throw handleApiError(error);
    }
};

/**
 * Utility to clean Gemini JSON response
 */
const cleanJsonResponse = (text: string): string => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);
    return jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
};

/**
 * Transform raw Gemini JSON into our VideoAnalysis type (adapted for links)
 */
const transformAnalysis = (raw: any, pointsCost: number): VideoAnalysis => {
    return {
        id: `link-${Date.now()}`,
        timestamp: Date.now(),
        videoTitle: raw.title || 'Link Audit',
        videoAuthor: raw.siteName || 'Web',
        transcription: [],
        segments: [],
        claims: (raw.factualClaims || []).map((c: any) => ({
            quote: c.claim,
            formulation: c.claim,
            category: 'general',
            weight: 'средна',
            confidence: c.confidence || 0,
            veracity: transformVerdict(c.verdict),
            explanation: c.evidence,
            missingContext: c.context || ''
        })),
        manipulations: (raw.manipulationTechniques || []).map((m: any) => ({
            technique: m.technique,
            timestamp: m.timestamp || '0:00',
            logic: m.description,
            effect: m.impact || '',
            severity: m.severity || 0,
            counterArgument: m.counterArgument || ''
        })),
        fallacies: [],
        timeline: [],
        summary: {
            credibilityIndex: raw.detailedMetrics?.factualAccuracy || 0,
            manipulationIndex: raw.detailedMetrics?.propagandaScore || 0,
            unverifiablePercent: 0,
            finalClassification: raw.overallAssessment || 'MIXED',
            overallSummary: raw.summary || '',
            totalDuration: '0:00',
            detailedStats: {
                factualAccuracy: raw.detailedMetrics?.factualAccuracy || 0,
                logicalSoundness: raw.detailedMetrics?.logicalSoundness || 0,
                emotionalBias: raw.detailedMetrics?.emotionalBias || 0,
                propagandaScore: raw.detailedMetrics?.propagandaScore || 0,
                sourceReliability: raw.detailedMetrics?.sourceReliability || 0,
                subjectivityScore: raw.detailedMetrics?.subjectivityScore || 0,
                objectivityScore: raw.detailedMetrics?.objectivityScore || 0,
                biasIntensity: raw.detailedMetrics?.biasIntensity || 0,
                narrativeConsistencyScore: raw.detailedMetrics?.narrativeConsistencyScore || 0,
                semanticDensity: raw.detailedMetrics?.semanticDensity || 0,
                contextualStability: raw.detailedMetrics?.contextualStability || 0
            },
            finalInvestigativeReport: raw.finalInvestigativeReport || '',
            geopoliticalContext: raw.geopoliticalContext || '',
            historicalParallel: raw.historicalParallel || '',
            psychoLinguisticAnalysis: raw.psychoLinguisticAnalysis || '',
            strategicIntent: raw.strategicIntent || '',
            narrativeArchitecture: raw.narrativeArchitecture || '',
            technicalForensics: raw.technicalForensics || '',
            socialImpactPrediction: raw.socialImpactPrediction || '',
            sourceNetworkAnalysis: '',
            dataPointsProcessed: 0,
            recommendations: raw.recommendations || ''
        },
        pointsCost: pointsCost,
        visualAnalysis: raw.visualAnalysis,
        bodyLanguageAnalysis: raw.bodyLanguageAnalysis,
        vocalAnalysis: raw.vocalAnalysis,
        deceptionAnalysis: raw.deceptionAnalysis,
        humorAnalysis: raw.humorAnalysis,
        psychologicalProfile: raw.psychologicalProfile,
        culturalSymbolicAnalysis: raw.culturalSymbolicAnalysis
    };
};

/**
 * Maps Gemini verdicts to our internal veracity types
 */
const transformVerdict = (verdict: string): any => {
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
