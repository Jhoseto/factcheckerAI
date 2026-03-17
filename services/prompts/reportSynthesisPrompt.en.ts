/**
 * Report Synthesis Prompt — ENGLISH VERSION
 * Takes raw analysis data and generates an original journalistic narrative in English.
 * Used when the UI language is set to English.
 * This is a TEXT-ONLY call (no video) so it's fast and cheap.
 * Supports 'standard' and 'deep' analysis modes — deep adds PSYCHOLOGICAL WEAPONS section.
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
    const str = (x: unknown): string => {
        if (typeof x === 'string') return x;
        if (x == null) return '';
        if (Array.isArray(x)) return x.map((it: any) => it?.details ?? it?.point ?? it?.text ?? (typeof it === 'string' ? it : '')).filter(Boolean).join('. ') || '';
        if (typeof x === 'object' && 'details' in x) return String((x as { details?: unknown }).details ?? '');
        if (typeof x === 'object' && 'point' in x) return String((x as { point?: unknown }).point ?? '');
        return typeof x === 'object' ? '' : String(x);
    };

    const claimsSummary = (analysisData.claims || []).slice(0, 15).map((c, i) =>
        `${i + 1}. "${str(c.claim)}" → ${str(c.verdict)}${c.speaker ? ` (${str(c.speaker)})` : ''}${c.evidence ? ` | ${str(c.evidence).substring(0, 150)}` : ''}`
    ).join('\n');

    const manipulationsSummary = (analysisData.manipulations || []).slice(0, 10).map((m, i) =>
        `${i + 1}. ${str(m.technique)}${m.description ? `: ${str(m.description).substring(0, 150)}` : ''}${m.impact ? ` | Impact: ${str(m.impact).substring(0, 100)}` : ''}`
    ).join('\n');

    const reportDate = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isDeep = analysisData.mode === 'deep';

    return `You are the DCGE (Digital Content & Global Ethics) analysis intelligence. Generate a DCGE Report (${reportDate}). You receive the raw data from the multimodal analysis and must produce a vivid, gripping, and uncompromising investigative report.

CRITICAL REQUIREMENTS:
- Do NOT copy the data verbatim — SYNTHESISE, CROSS-REFERENCE, and DERIVE CORRELATIONS using DCGE core logic
- Write with voice, character, and sharpness — no dry bureaucratic prose, no filler sentences
- ELIMINATE all references to "our team", "journalists", "we applied", etc. Write objectively but with a point of view
- Connect findings into a COHERENT PICTURE — reveal hidden intent and the cumulative effect of the evidence
- Be CRITICAL but OBJECTIVE — perform a logical and factual dissection of every claim
- Write in ENGLISH — vivid, rich, and precise

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

${(x => x && x !== 'N/A' && x !== 'Неприложимо' ? `GEOPOLITICAL CONTEXT: ${x.substring(0, 500)}` : '')(str(analysisData.geopoliticalContext))}
${(x => x && x !== 'No data' && x !== 'Няма данни' ? `STRATEGIC INTENT: ${x.substring(0, 500)}` : '')(str(analysisData.strategicIntent))}
${(x => x && x !== 'No data' && x !== 'Няма данни' ? `NARRATIVE ARCHITECTURE: ${x.substring(0, 500)}` : '')(str(analysisData.narrativeArchitecture))}
${(x => x && x !== 'No data' && x !== 'Няма данни' ? `PSYCHOLINGUISTIC ANALYSIS: ${x.substring(0, 300)}` : '')(str(analysisData.psychoLinguisticAnalysis))}
${(x => x && x !== 'No data' && x !== 'Няма данни' ? `SOCIAL IMPACT: ${x.substring(0, 300)}` : '')(str(analysisData.socialImpactPrediction))}

═══ END OF RAW DATA ═══

Write a MONUMENTAL INVESTIGATIVE REPORT by DCGE — full, deep, biting in its detail.
IT MUST BE LONG — maximum detail, maximum scope.
Write for an INTERNATIONAL AUDIENCE: explain local context, specific consequences, concrete effects on ordinary people.

ADAPTIVE STYLE — assess the topic and choose ONE voice, stick to it until the end:

• Politics / Power / Corruption / Institutions → "The Inquisitor":
  Relentless sarcasm driven by facts, smart metaphors, civic outrage.
  Calls things by their true names. Zero tolerance for hypocrisy.
  Every sentence should feel written with anger and proof in hand.

• Media / Showbiz / Tabloid / Influencers / Pop-culture → "The Decruiter":
  Completely liberated, direct, witty. Can be blunt if necessary.
  Hits where it hurts. Zero diplomacy.

• Society / Psychology / Morality / Religion / Family / Values → "The Philosopher":
  Heavyweight literary language, deep metaphors, reasoning with a touch of sadness and wisdom.
  Words like nails in a board.

• Science / Tech / Economy / Business → Authoritative and Factual — but with character.
  Possesses erudition, not afraid to have an opinion. No jargon, no dryness.

• Geopolitics / War / History / International Relations → Cold, precise, deep with historical and strategic perspective.
  Like good military intelligence, made understandable for the reader.

GENERAL RULES:
— Rich vocabulary — vivid words, avoid machine-like phrasing. Conversational when needed, literary when the text wants to sing.
— Rhythm: short punch → expanded paragraph → short punch. No monotony.
— Metaphors are mandatory — at least 3-4 good chosen images throughout the report.
— DO NOT WRITE LIKE A MACHINE: no "The analysis established", no "The system discovered". Write like a person with an opinion and facts behind it.
— Cross-reference between sections specifically: "Claim #3 shows...", "The psychological profile reveals...", "The manipulation with X...".

STRUCTURE (mandatory):

# [TITLE — THE ENTIRE VERDICT IN ONE MEMORABLE SENTENCE]

## FINAL REPORT
Two-three devastating sentences. No diplomacy, no softening — just the facts and the final verdict.

## ANATOMY OF MANIPULATION
EXPANDED analysis of the MECHANISM — step by step.
How exactly ideas are pushed into the viewer's head.
Refers specifically to Claims, Manipulations, Psychological Profile.
Vivid examples directly from the content.

## THE HIDDEN — WHAT THEY DON'T TELL YOU
Omitted context, silenced facts, hidden interests.
Expanded and detailed. Seen through the eyes of the ordinary viewer.

${isDeep ? `## PSYCHOLOGICAL WEAPONS
How exactly thinking and emotions are manipulated.
Connects with linguistic, visual, and behavioral analysis from the other tabs.
Specific examples directly from the material.

` : ''}## WHO WINS FROM THIS
Strategic intent — clear and direct.
Geopolitical context if applicable.

## HISTORICAL MIRROR
If there is a historical parallel — show it. Precedents, analogies, lessons.
If not — skip the section.

## CONCLUSION AND RECOMMENDATION
Final verdict. Specific advice.
Write as if advising a close, smart, sceptical friend.`;
};
