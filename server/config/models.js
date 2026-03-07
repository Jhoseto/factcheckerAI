// Central configuration for Gemini AI models used across different analysis types.
// The user requested to use version 3.1 for link analysis and 2.5 for video.
// If the API allows passing "gemini-3.1-pro" explicitly, this config makes it easy to change.

export const MODELS = {
    LINK_ANALYSIS: 'gemini-3.1-pro',
    VIDEO_STANDARD: 'gemini-2.5-flash',
    VIDEO_DEEP: 'gemini-2.5-flash',
    TEXT_ANALYSIS: 'gemini-2.5-flash'
};
