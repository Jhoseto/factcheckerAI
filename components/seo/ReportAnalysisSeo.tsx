import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import type { VideoAnalysis } from '../../types';
import { extractVerdictFromAnalysis, getVerdictInfo } from '../../services/shareImageGenerator';

const FALLBACK_DESC =
  'DCGE фактчек и мултимодален анализ — споделен доклад в FACTCHECKER AI.';

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function reportDescription(analysis: VideoAnalysis): string {
  const raw = analysis.summary?.overallSummary?.trim();
  if (raw) return truncate(raw, 160);
  return FALLBACK_DESC;
}

/** Overrides route defaults when a report payload is available (no sensitive fields). */
const ReportAnalysisSeo: React.FC<{ analysis: VideoAnalysis }> = ({ analysis }) => {
  const { pathname } = useLocation();
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://factcheckerai.info';
  const base = (analysis.videoTitle || 'Анализ').trim();
  const title = `${truncate(base, 52)} | FACTCHECKER AI`;
  const description = reportDescription(analysis);
  const url = `${origin}${pathname}`;
  
  // Generate dynamic Open Graph image based on verdict
  const verdict = extractVerdictFromAnalysis(analysis);
  const verdictInfo = getVerdictInfo(verdict);
  const ogImage = `${origin}/api/og-image?title=${encodeURIComponent(base)}&verdict=${verdict}&emoji=${encodeURIComponent(verdictInfo.emoji)}`;

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="article" />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default ReportAnalysisSeo;
