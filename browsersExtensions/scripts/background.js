/**
 * FactChecker AI - Background Service Worker
 * Handles extension lifecycle and messaging
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open welcome page on first install (optional)
    console.log('[FactChecker AI] Extension installed successfully');
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageUrl') {
    sendResponse({ url: sender.url });
  }
});
