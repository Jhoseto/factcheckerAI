import type { VideoAnalysis } from '../types';

/**
 * Generates a dynamic Open Graph image URL for sharing reports on social media.
 * Uses a server-side image generation service or canvas-based approach.
 */

export interface ShareImageParams {
  title: string;
  verdict: 'true' | 'false' | 'mixed' | 'unknown';
  author?: string;
  thumbnail?: string;
  analysisType: 'video' | 'link';
}

/**
 * Get the verdict emoji and color based on analysis result
 */
export function getVerdictInfo(verdict: string): { emoji: string; color: string; label: string } {
  const verdictLower = verdict.toLowerCase();
  
  if (verdictLower.includes('true') || verdictLower.includes('accurate') || verdictLower.includes('verified')) {
    return { emoji: '✅', color: '#10b981', label: 'Verified' };
  }
  if (verdictLower.includes('false') || verdictLower.includes('misleading') || verdictLower.includes('manipulated')) {
    return { emoji: '⚠️', color: '#ef4444', label: 'Misleading' };
  }
  if (verdictLower.includes('mixed') || verdictLower.includes('partially')) {
    return { emoji: '⚡', color: '#f59e0b', label: 'Mixed' };
  }
  return { emoji: '❓', color: '#6b7280', label: 'Unknown' };
}

/**
 * Generate a data URL for a dynamic Open Graph image using canvas
 * This is a client-side fallback; ideally, use a server-side image generation service
 */
export function generateShareImageDataUrl(params: ShareImageParams): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const verdictInfo = getVerdictInfo(params.verdict);

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#111111');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  // Accent bar
  ctx.fillStyle = verdictInfo.color;
  ctx.fillRect(0, 0, 1200, 8);

  // Logo/Title area
  ctx.fillStyle = '#E0E0E0';
  ctx.font = 'bold 48px serif';
  ctx.textAlign = 'center';
  ctx.fillText('FACTCHECKER AI', 600, 80);

  // Verdict emoji and label
  ctx.font = '120px Arial';
  ctx.fillText(verdictInfo.emoji, 600, 200);

  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = verdictInfo.color;
  ctx.fillText(verdictInfo.label, 600, 260);

  // Main title (truncated)
  ctx.fillStyle = '#E0E0E0';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  const maxWidth = 1100;
  const lineHeight = 50;
  const words = params.title.split(' ');
  let line = '';
  let y = 340;

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      ctx.fillText(line, 600, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, 600, y);

  // Footer
  ctx.fillStyle = '#888';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Powered by DCGE (Deep Contextual Generative Engine)', 600, 600);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a server-side share image URL (recommended for production)
 * This would call a backend endpoint that generates the image server-side
 */
export function generateShareImageUrl(params: ShareImageParams, baseUrl: string = ''): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://factcheckerai.info');
  
  // Use a server-side image generation endpoint
  // Example: /api/og-image?title=...&verdict=...&type=...
  const queryParams = new URLSearchParams({
    title: params.title,
    verdict: params.verdict,
    type: params.analysisType,
    ...(params.author && { author: params.author }),
    ...(params.thumbnail && { thumbnail: params.thumbnail }),
  });

  return `${origin}/api/og-image?${queryParams.toString()}`;
}

/**
 * Extract verdict from analysis result
 */
export function extractVerdictFromAnalysis(analysis: VideoAnalysis): string {
  const summary = analysis.summary?.overallSummary || '';
  const verdict = analysis.summary?.verdict || '';
  
  // Try to determine verdict from summary or verdict field
  if (verdict) return verdict;
  
  if (summary.toLowerCase().includes('misleading') || summary.toLowerCase().includes('manipulated')) {
    return 'false';
  }
  if (summary.toLowerCase().includes('accurate') || summary.toLowerCase().includes('verified')) {
    return 'true';
  }
  if (summary.toLowerCase().includes('mixed') || summary.toLowerCase().includes('partially')) {
    return 'mixed';
  }
  
  return 'unknown';
}

/**
 * Generate share text for social media
 */
export function generateShareText(analysis: VideoAnalysis, isBg: boolean = false): string {
  const verdict = extractVerdictFromAnalysis(analysis);
  const verdictInfo = getVerdictInfo(verdict);
  const title = analysis.videoTitle || (isBg ? 'Анализ' : 'Analysis');
  
  if (isBg) {
    return `${verdictInfo.emoji} ${verdictInfo.label}: "${title}"\n\nПроверено с FactChecker AI - Захранвано от DCGE`;
  }
  
  return `${verdictInfo.emoji} ${verdictInfo.label}: "${title}"\n\nVerified with FactChecker AI - Powered by DCGE`;
}
