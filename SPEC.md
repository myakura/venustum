# Venustum - English Learning Browser Extension

## Overview
A browser extension that helps users learn English by selecting/clicking on words or phrases, highlighting the containing sentence, providing explanations, and recording the content for later review.

## Features

### Core Features

1. **Word/Phrase Selection**
   - Detect text selection (mouse drag)
   - Detect double-click on words
   - Support multi-word phrase selection

2. **Sentence Highlighting**
   - Automatically identify and highlight the complete sentence containing the selected text
   - Visual highlighting with customizable colors
   - Clear highlighting when clicking elsewhere

3. **Explanation Display**
   - Show popup/tooltip with:
     - Word/phrase definition
     - Pronunciation (optional)
     - Part of speech
     - Example usage
   - Source: Free Dictionary API

4. **Recording System**
   - Save selected words/phrases with context (full sentence)
   - Store source URL and page title
   - Timestamp each entry
   - View and manage saved entries in popup

### Optional/Future Features
- Spaced repetition review system
- Export saved entries (JSON/CSV)
- Sync across devices
- Custom word lists/categories
- Audio pronunciation

## Technical Architecture

### Components

```
venustum/
├── manifest.json              # Extension manifest (MV3)
├── venustum_content.js        # Content script - handles text selection, highlighting, popup
├── venustum_background.js     # Service worker - handles API calls, storage
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── options/
│   ├── options.html           # Options page
│   └── options.js             # Options logic
└── icons/
    └── *.png                  # Extension icons
```

### Data Flow

```
User selects text
       ↓
Content script detects selection
       ↓
Extract sentence containing selection
       ↓
Highlight sentence in page
       ↓
Send word/phrase to background script
       ↓
Background fetches definition from Dictionary API
       ↓
Display explanation popup
       ↓
User saves entry
       ↓
Store in chrome.storage.local
```

### Data Model

```javascript
/**
 * @typedef {Object} SavedEntry
 * @property {string} id - Unique identifier
 * @property {string} word - The selected word/phrase
 * @property {string} sentence - Full sentence containing the word
 * @property {string} definition - Dictionary definition
 * @property {string} partOfSpeech - Part of speech (noun, verb, etc.)
 * @property {string} sourceUrl - URL where the word was found
 * @property {string} sourceTitle - Page title
 * @property {number} createdAt - Unix timestamp
 */
```

### APIs

- **Dictionary API**: Free Dictionary API (https://dictionaryapi.dev/)
  - No API key required
  - Endpoint: `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`

## Implementation Plan

### Phase 1: Project Setup
- [ ] Create manifest.json for MV3
- [ ] Set up directory structure
- [ ] Create basic content script
- [ ] Create basic background script
- [ ] Create placeholder icons

### Phase 2: Core Content Script
- [ ] Implement text selection detection
- [ ] Implement double-click detection for single words
- [ ] Implement sentence extraction algorithm
- [ ] Implement sentence highlighting

### Phase 3: Explanation System
- [ ] Create dictionary API client in background script
- [ ] Implement message passing between content and background
- [ ] Design and implement explanation popup UI
- [ ] Handle API errors and fallbacks

### Phase 4: Recording System
- [ ] Implement storage utilities
- [ ] Create save functionality
- [ ] Design and implement popup UI for viewing entries
- [ ] Add delete functionality

### Phase 5: Polish & Options
- [ ] Create options page
- [ ] Add customization (highlight color, click behavior)
- [ ] Add keyboard shortcuts
- [ ] Handle edge cases (iframes, dynamic content)

### Phase 6: Testing
- [ ] Test on multiple websites
- [ ] Create proper extension icons

## Technology Stack

- **Language**: Plain JavaScript with JSDoc comments
- **Build**: No build step (load unpacked extension)
- **UI**: Plain HTML/CSS
- **Storage**: chrome.storage.local
- **API**: Free Dictionary API

## Browser Support

- Chrome (primary)
- Firefox (secondary, with manifest adjustments)

## Design Principles

1. **Minimal intrusion**: Don't interfere with normal browsing
2. **Fast response**: Show explanations quickly
3. **Lightweight**: Keep bundle size small
4. **Privacy-focused**: All data stored locally

## Constraints

- Must work on most websites (handle dynamic content)
- Must handle iframes carefully
- Must respect existing page styles
- No external dependencies
