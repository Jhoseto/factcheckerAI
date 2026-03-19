/**
 * Persists the last analysis result in sessionStorage so refresh on /analysis-result
 * does not lose data; pairs with server-side billingIntentId idempotency.
 */
const SESSION_KEY = 'fc_active_analysis_v1';
const SYNTH_PREFIX = 'fc_dcge_synth_';
const BILLED_PREFIX = 'fc_billing_done_';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type StoredAnalysisSession = {
  analysis: unknown;
  billingPayload?: unknown;
  type: 'video' | 'link';
  url: string;
  ts: number;
};

export function saveAnalysisSession(data: Omit<StoredAnalysisSession, 'ts'>): void {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...data, ts: Date.now() })
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadAnalysisSession(): StoredAnalysisSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredAnalysisSession;
    if (!p?.analysis || !p?.type || !p.ts) return null;
    if (Date.now() - p.ts > MAX_AGE_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearAnalysisSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getCachedSynthesizedReport(billingIntentId: string): string | null {
  if (!billingIntentId) return null;
  try {
    return sessionStorage.getItem(SYNTH_PREFIX + billingIntentId);
  } catch {
    return null;
  }
}

export function setCachedSynthesizedReport(billingIntentId: string, report: string): void {
  if (!billingIntentId || !report) return;
  try {
    sessionStorage.setItem(SYNTH_PREFIX + billingIntentId, report);
  } catch {
    /* ignore */
  }
}

export function isBillingMarkedDoneClient(billingIntentId: string): boolean {
  if (!billingIntentId) return false;
  try {
    return sessionStorage.getItem(BILLED_PREFIX + billingIntentId) === '1';
  } catch {
    return false;
  }
}

export function markBillingDoneClient(billingIntentId: string): void {
  if (!billingIntentId) return;
  try {
    sessionStorage.setItem(BILLED_PREFIX + billingIntentId, '1');
  } catch {
    /* ignore */
  }
}
