/**
 * FactChecker AI - Content Script
 * Injects analysis buttons directly into YouTube interface
 */

function injectAnalyzeButton() {
  // Target YouTube's subscribe button container or metadata actions
  const targetSelector = '#subscribe-button, #owner-and-teaser';
  const target = document.querySelector(targetSelector);

  if (target && !document.getElementById('factchecker-ai-btn')) {
    const btnContainer = document.createElement('div');
    btnContainer.id = 'factchecker-ai-btn-container';
    btnContainer.style.display = 'inline-flex';
    btnContainer.style.marginLeft = '12px';
    btnContainer.style.verticalAlign = 'middle';

    const btn = document.createElement('button');
    btn.id = 'factchecker-ai-btn';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="M9 12l2 2 4-4"></path>
      </svg>
      Analyze
    `;
    
    // Apply styles to match YouTube's modern UI
    btn.style.backgroundColor = '#968B74';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '18px';
    btn.style.padding = '0 16px';
    btn.style.height = '36px';
    btn.style.fontSize = '14px';
    btn.style.fontWeight = '500';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.transition = 'background-color 0.2s';
    btn.style.fontFamily = 'Roboto, Arial, sans-serif';

    btn.onmouseover = () => btn.style.backgroundColor = '#C4B091';
    btn.onmouseout = () => btn.style.backgroundColor = '#968B74';

    btn.onclick = () => {
      const url = window.location.href;
      const baseUrl = 'https://factcheckerai.info/'; // Official production URL
      const analysisUrl = `${baseUrl}?url=${encodeURIComponent(url)}&mode=standard&autoStart=true`;
      window.open(analysisUrl, '_blank');
    };

    btnContainer.appendChild(btn);
    target.parentNode.insertBefore(btnContainer, target.nextSibling);
  }
}

// Run on load and when navigation happens (YouTube is a SPA)
const observer = new MutationObserver(() => {
  if (window.location.href.includes('youtube.com/watch')) {
    injectAnalyzeButton();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
injectAnalyzeButton();
