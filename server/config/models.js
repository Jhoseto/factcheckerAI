// Central configuration for Gemini AI models used across different analysis types.
// The user requested to use version 3.1 for link analysis and 2.5 for video.
// If the API allows passing "gemini-3.1-pro" explicitly, this config makes it easy to change.

export const MODELS = {
    // Stage 1: Fast & Cheap (Heavy Video Input)
    VIDEO_EXTRACTOR: 'gemini-2.5-flash',

    // Stage 2: Smart & Current (Grounding, Search, Synthesis)
    REPORT_SYNTHESIZER: 'gemini-3.1-pro-preview',

    // Legacy/Generic mappings for single-call modes if any
    LINK_ANALYSIS: 'gemini-3.1-pro-preview',
    VIDEO_STANDARD: 'gemini-2.5-flash',
    VIDEO_DEEP: 'gemini-2.5-flash', // We'll override this in hybrid logic
    TEXT_ANALYSIS: 'gemini-2.5-flash'
};
