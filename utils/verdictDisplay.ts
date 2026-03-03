const VERDICT_KEYS: Record<string, string> = {
  TRUE: 'analysis.verdictTrue',
  MOSTLY_TRUE: 'analysis.verdictMostlyTrue',
  MIXED: 'analysis.verdictMixed',
  MOSTLY_FALSE: 'analysis.verdictMostlyFalse',
  FALSE: 'analysis.verdictFalse',
  UNVERIFIABLE: 'analysis.verdictUnverifiable',
};

const VERACITY_KEYS: Record<string, string> = {
  'вярно': 'analysis.verdictTrue',
  'предимно вярно': 'analysis.verdictMostlyTrue',
  'частично вярно': 'analysis.verdictMixed',
  'подвеждащо': 'analysis.verdictMostlyFalse',
  'невярно': 'analysis.verdictFalse',
  'непроверимо': 'analysis.verdictUnverifiable',
  'true': 'analysis.verdictTrue',
  'mostly true': 'analysis.verdictMostlyTrue',
  'partially true': 'analysis.verdictMixed',
  'misleading': 'analysis.verdictMostlyFalse',
  'false': 'analysis.verdictFalse',
  'unverifiable': 'analysis.verdictUnverifiable',
};

/** Maps verdict (TRUE, UNVERIFIABLE...) or veracity (BG string) to i18n key for display */
export function getVerdictKey(claim: { verdict?: string; veracity?: string }): string {
  const v = claim.verdict?.toUpperCase?.();
  if (v && v in VERDICT_KEYS) return VERDICT_KEYS[v];
  return VERACITY_KEYS[claim.veracity || ''] || 'analysis.verdictUnverifiable';
}
