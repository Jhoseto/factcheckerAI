import { auth } from '../firebase';
import { handleApiError } from '../errorHandler';
import { getLinkAnalysisPrompt } from '../prompts/linkAnalysisPrompt';
import { getLinkAnalysisPromptEn } from '../prompts/linkAnalysisPrompt.en';
import { VideoAnalysis, APIUsage } from '../../types';
import { getApiLang } from '../../i18n';

/**
 * Scrapes the content of a URL via server-side Jina+direct fetch.
 * Returns the extracted text and whether it's partial.
 */
const scrapeLinkContent = async (url: string, token: string): Promise<{ content: string; isPartial: boolean; error?: string }> => {
    try {
        const response = await fetch('/api/link/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error || (response.status === 408 ? 'Timeout' : 'Scrape failed');
            return { content: '', isPartial: true, error: msg };
        }
        return {
            content: data.content || '',
            isPartial: data.isPartial ?? true
        };
    } catch {
        return { content: '', isPartial: true };
    }
};

/**
 * Analyzes a news article URL.
 * 1. Scrapes the URL (Jina → direct fetch) to get real article text.
 * 2. Injects content into prompt for accurate analysis.
 * 3. Gemini uses Google Search only for fact verification.
 */
export const analyzeLinkDeep = async (
    url: string,
    onProgress?: (status: string) => void
): Promise<{ analysis: VideoAnalysis; usage: APIUsage }> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User must be logged in');

        const token = await user.getIdToken();
        const lang = getApiLang();
        onProgress?.(lang === 'en' ? 'Scraping article...' : 'Извличане на статията...');

        const scraped = await scrapeLinkContent(url, token);
        const scrapedContent = (!scraped.isPartial && scraped.content.length > 300) ? scraped.content : undefined;

        if (scraped.error && !scrapedContent) {
            const err = scraped.error.toLowerCase();
            if (err.includes('paywall') || err.includes('ограничен') || err.includes('403')) {
                throw new Error(lang === 'en' ? 'Access restricted (paywall). Try a different article.' : 'Достъпът е ограничен (paywall). Опитайте друга статия.');
            }
            if (err.includes('timeout') || err.includes('408')) {
                throw new Error(lang === 'en' ? 'The site did not respond in time. Try again.' : 'Сайтът не отговори навреме. Опитайте отново.');
            }
        }

        onProgress?.(lang === 'en' ? 'Analysing article...' : 'Анализиране на статията...');


        const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                prompt: lang === 'en' ? getLinkAnalysisPromptEn(url, scrapedContent) : getLinkAnalysisPrompt(url, scrapedContent),
                mode: 'deep',
                serviceType: 'linkArticle',
                systemInstruction: lang === 'en'
                    ? 'You are a professional fact-checker and investigative journalist. Answer ONLY in English language.'
                    : 'You are a professional fact-checker and investigative journalist. Answer ONLY in Bulgarian language.',
                lang
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
            const lang = getApiLang();
            throw new Error(lang === 'en'
                ? 'The analysis does not contain enough information. Please try again.'
                : 'Анализът не съдържа достатъчно информация. Моля, опитайте отново.');
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
        raw = JSON.parse(rawText);
    } catch (e) {
        console.error('[LinkService] Failed to parse response JSON:', e);
        throw new Error('Невалиден формат на отговора от сървъра. Моля, опитайте отново.');
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
            verdict: (c.verdict?.toUpperCase?.() || 'UNVERIFIABLE') as string,
            explanation: c.evidence || (getApiLang() === 'en' ? 'No information available' : 'Няма налична информация'),
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
    const lang = getApiLang();
    if (lang === 'en') {
        const mapEn: Record<string, string> = {
            'TRUE': 'true', 'MOSTLY_TRUE': 'mostly true', 'MIXED': 'partially true',
            'MOSTLY_FALSE': 'misleading', 'FALSE': 'false', 'UNVERIFIABLE': 'unverifiable'
        };
        return mapEn[verdict] || 'partially true';
    }
    const map: Record<string, string> = {
        'TRUE': 'вярно', 'MOSTLY_TRUE': 'предимно вярно', 'MIXED': 'частично вярно',
        'MOSTLY_FALSE': 'подвеждащо', 'FALSE': 'невярно', 'UNVERIFIABLE': 'непроверимо'
    };
    return map[verdict] || 'частично вярно';
};
