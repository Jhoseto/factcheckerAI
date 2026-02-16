
export interface TranscriptionLine {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface Claim {
  quote: string;
  formulation: string;
  category: string;
  weight: 'ниска' | 'средна' | 'висока';
  confidence: number;
  veracity: 'вярно' | 'предимно вярно' | 'частично вярно' | 'подвеждащо' | 'невярно' | 'непроверимо';
  explanation: string;
  missingContext: string;
  verified?: boolean;
  isExtremeLie?: boolean;
  lieEvidence?: string;
}

export interface Manipulation {
  technique: string;
  timestamp: string;
  logic: string;
  effect: string;
  severity: number;
  targetAudience?: string;
  counterArgument?: string;
}

export interface Fallacy {
  type: string;
  timestamp: string;
  reasoning: string;
}

export interface TimelinePoint {
  time: string;
  reliability: number;
  event?: string;
}

export interface DetailedStats {
  factualAccuracy: number;
  logicalSoundness: number;
  emotionalBias: number;
  propagandaScore: number;
  sourceReliability: number;
  subjectivityScore: number;
  objectivityScore: number;
  biasIntensity: number;
  narrativeConsistencyScore: number;
  semanticDensity: number;
  contextualStability: number;
}

export interface AnalysisSummary {
  credibilityIndex: number;
  manipulationIndex: number;
  unverifiablePercent: number;
  finalClassification: string;
  overallSummary: string;
  totalDuration: string;
  detailedStats: DetailedStats;
  finalInvestigativeReport: string;
  geopoliticalContext: string;
  historicalParallel: string;
  psychoLinguisticAnalysis: string;
  strategicIntent: string;
  narrativeArchitecture: string;
  technicalForensics: string;
  socialImpactPrediction: string;
  sourceNetworkAnalysis: string;
  dataPointsProcessed: number;
}

export interface VideoAnalysis {
  id: string;
  timestamp: number;
  videoTitle: string;
  videoAuthor: string;
  transcription: TranscriptionLine[];
  segments: { start: string; end: string; title: string; summary: string }[];
  claims: Claim[];
  manipulations: Manipulation[];
  fallacies: Fallacy[];
  timeline: TimelinePoint[];
  summary: AnalysisSummary;
  pointsCost: number;
  analysisMode?: AnalysisMode; // 'standard' or 'deep'

  // Multimodal analysis fields (deep analysis only)
  visualAnalysis?: string;
  bodyLanguageAnalysis?: string;
  vocalAnalysis?: string;
  deceptionAnalysis?: string;
  humorAnalysis?: string;
  psychologicalProfile?: string;
  culturalSymbolicAnalysis?: string;
  synthesizedReport?: string;
}

export interface APIUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  estimatedCostUSD: number; // Internal tracking only
  pointsCost: number; // User-facing cost in points
}

export interface AnalysisResponse {
  analysis: VideoAnalysis;
  usage: APIUsage;
}

// New types for analysis modes
export type AnalysisMode = 'standard' | 'deep';

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  author: string;
  duration: number; // in seconds
  durationFormatted: string; // e.g., "39:25"
}

export interface CostEstimate {
  mode: AnalysisMode;
  estimatedTokens: number;
  estimatedInputTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostObserved: number; // Cost to me (in currency)
  pointsCost: number; // User-facing cost in points
  margin: number;
}