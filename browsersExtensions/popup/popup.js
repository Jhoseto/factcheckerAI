document.addEventListener('DOMContentLoaded', async () => {
  const statusText = document.getElementById('status-text');
  const standardBtn = document.getElementById('standard-btn');
  const deepBtn = document.getElementById('deep-btn');

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;

  if (url.includes('youtube.com/watch')) {
    statusText.textContent = 'YouTube video detected. Choose analysis mode:';
  } else if (url.startsWith('http')) {
    statusText.textContent = 'Web article detected. Choose analysis mode:';
  } else {
    statusText.textContent = 'Navigate to a video or article to begin.';
    standardBtn.disabled = true;
    deepBtn.disabled = true;
    standardBtn.style.opacity = '0.5';
    deepBtn.style.opacity = '0.5';
  }

  const startAnalysis = (mode) => {
    const baseUrl = 'https://factcheckerai.info/'; // Official production URL
    const analysisUrl = `${baseUrl}?url=${encodeURIComponent(url)}&mode=${mode}&autoStart=true`;
    chrome.tabs.create({ url: analysisUrl });
  };

  standardBtn.addEventListener('click', () => startAnalysis('standard'));
  deepBtn.addEventListener('click', () => startAnalysis('deep'));
});
