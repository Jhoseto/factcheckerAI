# FactChecker AI Browser Extensions

This directory contains the source code for the FactChecker AI browser extensions for Chrome and Firefox.

## Overview

The extensions allow users to analyze YouTube videos and web articles directly from their browser with a single click. When a user clicks the extension button and selects an analysis mode (Standard or Deep), they are redirected to the main FactChecker AI website with the video/article URL and chosen mode as parameters. The site then automatically starts the analysis if the user is logged in.

## Directory Structure

```
browsersExtensions/
├── manifest.json           # Extension configuration (Manifest V3)
├── popup/
│   ├── popup.html         # UI for the extension popup
│   └── popup.js           # Logic for popup interactions
├── scripts/
│   ├── content.js         # Injects "Analyze" button into YouTube
│   └── content.css        # Styles for injected elements
├── icons/                 # Extension icons (16x16, 48x48, 128x128)
└── README.md             # This file
```

## Features

- **YouTube Integration:** Automatically detects YouTube videos and injects an "Analyze" button
- **Popup Menu:** Users select between Standard and Deep analysis modes
- **Auto-Start:** When redirected to the main site, analysis starts automatically if the user is logged in
- **Seamless UX:** No need to manually enter URLs or select modes again

## Setup for Development

### Chrome

1. Open `chrome://extensions/` in your browser
2. Enable **"Developer mode"** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `browsersExtensions` folder
5. The extension will appear in your extensions list

### Firefox

1. Open `about:debugging#/runtime/this-firefox` in your browser
2. Click **"Load Temporary Add-on"**
3. Select the `manifest.json` file from the `browsersExtensions` folder
4. The extension will appear in your extensions list

## Testing

1. Navigate to any YouTube video (e.g., `https://www.youtube.com/watch?v=...`)
2. Click the FactChecker AI extension icon
3. Select **"Standard Analysis"** or **"Deep Analysis"**
4. You will be redirected to the main FactChecker AI site with the video URL and mode pre-filled
5. If you're logged in, the analysis will start automatically

## Deployment to App Stores

### Chrome Web Store

1. Create a Google Developer account (one-time fee: ~$5)
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Create a new extension and upload a `.zip` file containing the `browsersExtensions` folder
4. Fill in the extension details (name, description, screenshots, privacy policy)
5. Submit for review (typically takes 1-3 days)
6. Once approved, you'll receive a unique extension URL (e.g., `https://chrome.google.com/webstore/detail/factchecker-ai/...`)

### Firefox Add-ons

1. Create a Mozilla Developer account (free)
2. Go to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/)
3. Upload a `.zip` file containing the `browsersExtensions` folder
4. Fill in the extension details
5. Submit for review (typically takes 1-5 days)
6. Once approved, you'll receive a unique add-on URL (e.g., `https://addons.mozilla.org/firefox/addon/factchecker-ai/`)

## Integration with Main Site

Once you have the store URLs, update the `downloadUrl` values in `components/common/BrowserExtensionsSection.tsx`:

```tsx
const extensions = [
  {
    id: 'chrome',
    // ... other properties
    downloadUrl: 'https://chrome.google.com/webstore/detail/factchecker-ai/YOUR_EXTENSION_ID',
  },
  {
    id: 'firefox',
    // ... other properties
    downloadUrl: 'https://addons.mozilla.org/firefox/addon/factchecker-ai/',
  }
];
```

## Auto-Start Logic

The main site (`App.tsx`) now includes logic to handle the following URL parameters:

- `url` - The YouTube video URL or article link
- `mode` - The analysis mode (`standard` or `deep`)
- `autoStart` - Set to `true` to automatically start the analysis

**Example URL:**
```
https://factcheckerai.info/?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&mode=deep&autoStart=true
```

If the user is logged in and has sufficient points, the analysis will start automatically.

## Troubleshooting

### Extension not appearing in YouTube

- Ensure you're on a YouTube video page (not the homepage or search results)
- Check the browser console for errors (F12 → Console tab)
- Reload the extension or the YouTube page

### Auto-start not working

- Verify that you're logged into the main FactChecker AI site
- Check that you have sufficient points for the analysis
- Ensure the URL parameters are correctly formatted

### Icon not showing

- Verify that the icon files exist in the `icons/` folder
- Check that the paths in `manifest.json` are correct

## Support

For issues or questions, please contact the development team or open an issue in the project repository.
