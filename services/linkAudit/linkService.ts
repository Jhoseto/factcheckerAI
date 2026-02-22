import { auth } from '../firebase';
import { handleApiError } from '../errorHandler';
import { getLinkAnalysisPrompt } from '../prompts/linkAnalysisPrompt';
import { VideoAnalysis, APIUsage } from '../../types';

/**
 * Analyzes a news article URL.
 * Gemini uses urlContext to read the page and googleSearch to verify facts.
 * No scraping — Gemini does everything.
 */
export const analyzeLinkDeep = async (
    url: string,
    onProgress?: (status: string) => void
): Promise<{ analysis: VideoAnalysis; usage: APIUsage }> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User must be logged in');

        const token = await user.getIdToken();
        onProgress?.('Анализиране на статията...');

        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                prompt: getLinkAnalysisPrompt(url),
                mode: 'deep',
                serviceType: 'linkArticle',
                systemInstruction: 'You are a professional fact-checker and investigative journalist. Answer ONLY in Bulgarian language.'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.error || 'Analysis failed');
            (error as any).code = errorData.code;
            throw error;
        }

        const jsonData = await response.json();

        const usage: APIUsage = {
            promptTokens: jsonData.usageMetadata?.promptTokenCount || 0,
            candidatesTokens: jsonData.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: jsonData.usageMetadata?.totalTokenCount || 0,
            estimatedCostUSD: 0,
            pointsCost: jsonData.points?.costInPoints || 12,
            newBalance: jsonData.points?.newBalance
        };

        const analysis = transformAnalysis(jsonData.text, usage.pointsCost);

        // Client-side quality check — don't show garbage to user
        const hasContent = analysis.summary.overallSummary.length > 20 ||
            analysis.claims.length > 0 ||
            analysis.manipulations.length > 0;
        if (!hasContent) {
            throw new Error('Анализът не съдържа достатъчно информация. Моля, опитайте отново.');
        }

        return { analysis, usage };

    } catch (error: any) {
        throw handleApiError(error);
    }
};

const deriveClassification = (overallAssessment: string, metrics: any): string => {
    const factual = metrics?.factualAccuracy ?? 0;
    const propaganda = metrics?.propagandaScore ?? 0;
    const known = ['ACCURATE', 'MOSTLY_ACCURATE', 'MIXED', 'MISLEADING', 'FALSE'];
    const modelValue = (overallAssessment || '').toUpperCase();

    const derived = (() => {
        if (factual >= 0.80 && propaganda <= 0.35) return 'ACCURATE';
        if (factual >= 0.65 && propaganda <= 0.50) return 'MOSTLY_ACCURATE';
        if (factual >= 0.45) return 'MIXED';
        if (factual >= 0.25) return 'MISLEADING';
        return 'FALSE';
    })();

    if (!known.includes(modelValue)) return derived;
    if ((modelValue === 'FALSE' || modelValue === 'MISLEADING') && factual > 0.60) return derived;
    if (modelValue === 'ACCURATE' && propaganda > 0.65) return derived;
    return modelValue;
};

const transformAnalysis = (rawText: string, pointsCost: number): VideoAnalysis => {
    let raw: any = {};
    try {
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            raw = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));
        }
    } catch {
        console.error('[LinkService] Failed to parse Gemini JSON');
    }

    const classification = deriveClassification(raw.overallAssessment, raw.detailedMetrics);

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
            timestamp: '0:00',
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
            finalClassification: classification,
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
            recommendations: Array.isArray(raw.recommendations)
                ? raw.recommendations.map((r: any) => typeof r === 'string' ? r : `${r.title || ''} — ${r.url || ''}`).join('\n')
                : (raw.recommendations || '')
        },
        pointsCost,
        commentsAnalysis: raw.commentsAnalysis ?? null,
        authorProfile: raw.authorProfile ?? undefined,
        mediaProfile: raw.mediaProfile ?? undefined,
        headlineAnalysis: raw.headlineAnalysis ?? undefined,
        emotionalTriggers: raw.emotionalTriggers ?? undefined,
        sensationalismIndex: raw.sensationalismIndex ?? undefined,
        circularCitation: raw.circularCitation ?? null,
        missingVoices: raw.missingVoices ?? undefined,
        timingAnalysis: raw.timingAnalysis ?? undefined,
        freshnessCheck: raw.freshnessCheck ?? undefined,
        alternativeSources: raw.alternativeSources ?? undefined,
    };
};

const transformVerdict = (verdict: string): any => {
    const map: Record<string, string> = {
        'TRUE': 'вярно', 'MOSTLY_TRUE': 'предимно вярно', 'MIXED': 'частично вярно',
        'MOSTLY_FALSE': 'подвеждащо', 'FALSE': 'невярно', 'UNVERIFIABLE': 'непроверимо'
    };
    return map[verdict] || 'частично вярно';
};
