import fs from 'fs';

const rawResponse = JSON.parse(fs.readFileSync('phase2_raw.json', 'utf8'));

// Copy of transformGeminiResponse logic to test mapping
function formatMultimodalField(value) {
    if (typeof value === 'string') return value || undefined;
    if (!Array.isArray(value) || value.length === 0) return undefined;
    return value.map((item, i) => {
        const point = item?.point ?? item?.title ?? '';
        const details = item?.details ?? item?.description ?? item?.text ?? '';
        return `${i + 1}. ${point}${details ? ': ' + details : ''}`;
    }).join('\n\n').trim() || undefined;
}

const claims = Array.isArray(rawResponse?.factualClaims) ? rawResponse.factualClaims
    : Array.isArray(rawResponse?.claims) ? rawResponse.claims : [];
const quotes = Array.isArray(rawResponse?.quotes) ? rawResponse.quotes : [];
const manipulations = Array.isArray(rawResponse?.manipulationTechniques) ? rawResponse.manipulationTechniques
    : Array.isArray(rawResponse?.manipulations) ? rawResponse.manipulations : [];

let allClaims = [...claims];
quotes.forEach((q) => {
    if (q && q.quote && !allClaims.find(c => c && c.claim === q.quote)) {
        allClaims.push({
            claim: q.quote,
            verdict: 'UNVERIFIABLE',
            evidence: q.context || 'Цитат от предаването',
            sources: [],
            confidence: 0.5,
            speaker: q.speaker,
            timestamp: q.timestamp
        });
    }
});

const transformedClaims = allClaims.map((c) => ({
    quote: c.claim || c.quote || c.text || '',
    verdict: (c.verdict?.toUpperCase?.() || 'UNVERIFIABLE'),
}));

const result = {
    claimsCount: transformedClaims.length,
    manipulationsCount: manipulations.length,
    visualAnalysis: formatMultimodalField(rawResponse?.visualAnalysis),
    bodyLanguageAnalysis: formatMultimodalField(rawResponse?.bodyLanguageAnalysis),
    vocalAnalysis: formatMultimodalField(rawResponse?.vocalAnalysis),
    deceptionAnalysis: formatMultimodalField(rawResponse?.deceptionAnalysis),
    humorAnalysis: formatMultimodalField(rawResponse?.humorAnalysis),
};

console.log("Transformation Result:");
console.log(JSON.stringify(result, null, 2));
