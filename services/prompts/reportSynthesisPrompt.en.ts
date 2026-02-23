/**
 * Report Synthesis Prompt — ENGLISH VERSION
 * Takes raw analysis data and generates an original journalistic narrative in English.
 * Used when the UI language is set to English.
 * This is a TEXT-ONLY call (no video) so it's fast and cheap.
 */
export const getReportSynthesisPromptEn = (analysisData: {
    videoTitle: string;
    videoAuthor: string;
    summary: string;
    credibilityIndex: number;
    manipulationIndex: number;
    classification: string;
    claims: Array<{ claim: string; verdict: string; evidence?: string; speaker?: string }>;
    manipulations: Array<{ technique: string; description?: string; impact?: string; example?: string }>;
    geopoliticalContext?: string;
    narrativeArchitecture?: string;
    psychoLinguisticAnalysis?: string;
    strategicIntent?: string;
    technicalForensics?: string;
    historicalParallel?: string;
    socialImpactPrediction?: string;
    mode: string;
}): string => {
    const claimsSummary = (analysisData.claims || []).slice(0, 15).map((c, i) =>
        `${i + 1}. "${c.claim}" → ${c.verdict}${c.speaker ? ` (${c.speaker})` : ''}${c.evidence ? ` | ${c.evidence.substring(0, 150)}` : ''}`
    ).join('\n');

    const manipulationsSummary = (analysisData.manipulations || []).slice(0, 10).map((m, i) =>
        `${i + 1}. ${m.technique}${m.description ? `: ${m.description.substring(0, 150)}` : ''}${m.impact ? ` | Impact: ${m.impact.substring(0, 100)}` : ''}`
    ).join('\n');

    return `You are an independent expert in fact-checking and media analysis. Produce a DCGE Report (${new Date().toISOString()}). You are given the raw data from the analysis of a video and must write a professional report.

CRITICAL REQUIREMENTS:
- Do NOT copy the data verbatim — ANALYSE, SYNTHESISE, REASON like an experienced journalist
- Write as an EXPERT JOURNALIST on behalf of the entire team who worked on the analysis — your reasoning, your conclusions
- Connect things into a COHERENT PICTURE — show what the facts mean TOGETHER
- Be CRITICAL but OBJECTIVE — point out both strengths and weaknesses
- Write in ENGLISH, professionally, readably, compellingly

═══ RAW INVESTIGATION DATA ═══

VIDEO: "${analysisData.videoTitle}" by ${analysisData.videoAuthor}
CLASSIFICATION: ${analysisData.classification}
CREDIBILITY INDEX: ${Math.round(analysisData.credibilityIndex * 100)}%
MANIPULATION INDEX: ${Math.round(analysisData.manipulationIndex * 100)}%

SUMMARY: ${analysisData.summary}

VERIFIED CLAIMS:
${claimsSummary || 'No data'}

DISCOVERED MANIPULATIONS:
${manipulationsSummary || 'No data'}

${analysisData.geopoliticalContext && analysisData.geopoliticalContext !== 'N/A' && analysisData.geopoliticalContext !== 'Неприложимо' ? `GEOPOLITICAL CONTEXT: ${analysisData.geopoliticalContext.substring(0, 500)}` : ''}
${analysisData.strategicIntent && analysisData.strategicIntent !== 'No data' && analysisData.strategicIntent !== 'Няма данни' ? `STRATEGIC INTENT: ${analysisData.strategicIntent.substring(0, 500)}` : ''}
${analysisData.narrativeArchitecture && analysisData.narrativeArchitecture !== 'No data' && analysisData.narrativeArchitecture !== 'Няма данни' ? `NARRATIVE ARCHITECTURE: ${analysisData.narrativeArchitecture.substring(0, 500)}` : ''}
${analysisData.psychoLinguisticAnalysis && analysisData.psychoLinguisticAnalysis !== 'No data' && analysisData.psychoLinguisticAnalysis !== 'Няма данни' ? `PSYCHOLINGUISTIC ANALYSIS: ${analysisData.psychoLinguisticAnalysis.substring(0, 300)}` : ''}
${analysisData.socialImpactPrediction && analysisData.socialImpactPrediction !== 'No data' && analysisData.socialImpactPrediction !== 'Няма данни' ? `SOCIAL IMPACT: ${analysisData.socialImpactPrediction.substring(0, 300)}` : ''}

═══ END OF RAW DATA ═══

Now write the DCGE Report with the following structure. Use MARKDOWN formatting (# for headings). Each section MUST be at least 2–4 paragraphs, not one or two sentences.

# EXECUTIVE SUMMARY
Minimum 3–4 paragraphs. What did we uncover? What is the big picture? Why does it matter? Who is affected?

# KEY FINDINGS
Minimum 2–3 paragraphs. What surprised us? Which facts are critical? What is not obvious at first glance? Specifics, not generalities.

# CLAIM VERIFICATION
Minimum 3–4 paragraphs. A journalistic narrative of the verification — not a list, but REASONING. Which claims hold up? Which don't? Why? Connect them with evidence from the data.

# ANATOMY OF THE MANIPULATION
Minimum 2–3 paragraphs. How do the discovered manipulations work? Why are they effective? What is the mechanism? Connect them into an overall strategy and impact on the audience.

# CONTEXT AND IMPLICATIONS
Minimum 2–3 paragraphs. Geopolitical, historical, social context. What does this mean in the bigger picture? What are the consequences?

# EXPERT ASSESSMENT
Minimum 2–3 paragraphs. Professional expert opinion. Objective evaluation. Strengths and weaknesses of the material. Clearly stated criteria.

# CONCLUSION AND RECOMMENDATIONS
Minimum 2 paragraphs. Closing thoughts. What questions remain? What should the user know?

# END
Just one line: DCGE Report (${new Date().toISOString()})

REQUIREMENT: Minimum 18–25 paragraphs TOTAL. Each section must be developed and specific. Short, superficial responses are UNACCEPTABLE. The report must be so good that the user says "WOW — this is real investigative journalism!"`;
};
