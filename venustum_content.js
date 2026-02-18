'use strict';

/**
 * @file content script for Venustum
 */

const EXTENSION_ID = 'venustum';

// ============================================================================
// Types
// ============================================================================

/**
 * @typedef {Object} SavedEntry
 * @property {string} id
 * @property {string} word
 * @property {string} sentence
 * @property {string} definition
 * @property {string} partOfSpeech
 * @property {string} phonetic
 * @property {string} sourceUrl
 * @property {string} sourceTitle
 * @property {number} createdAt
 */

/**
 * @typedef {Object} DictionaryResponse
 * @property {string} word
 * @property {string} phonetic
 * @property {Meaning[]} meanings
 */

/**
 * @typedef {Object} Meaning
 * @property {string} partOfSpeech
 * @property {Definition[]} definitions
 */

/**
 * @typedef {Object} Definition
 * @property {string} definition
 * @property {string} example
 */

// ============================================================================
// State
// ============================================================================

/** @type {string | null} */
let currentWord = null;
/** @type {Range | null} */
let currentRange = null;
/** @type {HTMLElement | null} */
let highlightElement = null;
/** @type {HTMLElement | null} */
let popupElement = null;

// ============================================================================
// Sentence Extraction
// ============================================================================

/**
 * Extracts the sentence containing the given range.
 * @param {Range} range
 * @returns {string}
 */
function extractSentence(range) {
	const container = range.commonAncestorContainer;
	const textContent = container.textContent || '';
	
	const startNode = range.startContainer;
	const startOffset = range.startOffset;
	const endNode = range.endContainer;
	const endOffset = range.endOffset;
	
	// Get the full text and find boundaries
	let text = '';
	let startIdx = 0;
	let endIdx = 0;
	
	if (startNode === endNode && startNode.nodeType === Node.TEXT_NODE) {
		text = startNode.textContent || '';
		startIdx = findSentenceStart(text, startOffset);
		endIdx = findSentenceEnd(text, endOffset);
		return text.slice(startIdx, endIdx).trim();
	}
	
	// For complex selections, get parent element's text
	const parent = container.nodeType === Node.TEXT_NODE 
		? container.parentElement 
		: container;
	
	if (parent) {
		const walker = document.createTreeWalker(
			parent,
			NodeFilter.SHOW_TEXT,
			null
		);
		
		let foundStart = false;
		let foundSelection = false;
		let beforeText = '';
		let selectedText = '';
		let afterText = '';
		
		while (walker.nextNode()) {
			const node = walker.currentNode;
			
			if (node === startNode) {
				foundStart = true;
				beforeText = (node.textContent || '').slice(0, startOffset);
				selectedText = (node.textContent || '').slice(startOffset);
				if (node === endNode) {
					selectedText = (node.textContent || '').slice(startOffset, endOffset);
					afterText = (node.textContent || '').slice(endOffset);
					foundSelection = true;
				}
			} else if (node === endNode && foundStart) {
				selectedText += (node.textContent || '').slice(0, endOffset);
				afterText = (node.textContent || '').slice(endOffset);
				foundSelection = true;
			} else if (!foundStart) {
				beforeText += node.textContent || '';
			} else if (foundStart && !foundSelection) {
				selectedText += node.textContent || '';
			} else if (foundSelection) {
				afterText += node.textContent || '';
			}
		}
		
		// Find sentence boundaries
		const sentenceStart = findSentenceStart(beforeText, beforeText.length) + beforeText.length;
		const sentenceEnd = findSentenceEnd(afterText, 0);
		
		text = beforeText + selectedText + afterText;
		startIdx = sentenceStart;
		endIdx = beforeText.length + selectedText.length + sentenceEnd;
		
		return text.slice(startIdx, endIdx).trim();
	}
	
	return range.toString().trim();
}

/**
 * Finds the start of a sentence from a given position.
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function findSentenceStart(text, offset) {
	const sentenceEnders = /[.!?]/;
	let pos = offset;
	
	while (pos > 0) {
		if (sentenceEnders.test(text[pos - 1])) {
			// Skip whitespace after the period
			while (pos < text.length && /\s/.test(text[pos])) {
				pos++;
			}
			return pos;
		}
		pos--;
	}
	
	return 0;
}

/**
 * Finds the end of a sentence from a given position.
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function findSentenceEnd(text, offset) {
	const sentenceEnders = /[.!?]/;
	let pos = offset;
	
	while (pos < text.length) {
		if (sentenceEnders.test(text[pos])) {
			return pos + 1;
		}
		pos++;
	}
	
	return text.length;
}

// ============================================================================
// Highlighting
// ============================================================================

/**
 * Highlights the range containing the selected text.
 * @param {Range} range
 */
function highlightRange(range) {
	clearHighlight();
	
	try {
		highlightElement = document.createElement('span');
		highlightElement.className = `${EXTENSION_ID}-highlight`;
		
		range.surroundContents(highlightElement);
		currentRange = range;
	} catch (error) {
		console.log(`${EXTENSION_ID}: cannot surround contents, using fallback`);
		highlightElement = null;
	}
}

/**
 * Clears the current highlight.
 */
function clearHighlight() {
	if (highlightElement && highlightElement.parentNode) {
		const parent = highlightElement.parentNode;
		while (highlightElement.firstChild) {
			parent.insertBefore(highlightElement.firstChild, highlightElement);
		}
		parent.removeChild(highlightElement);
	}
	highlightElement = null;
	currentRange = null;
}

// ============================================================================
// Popup UI
// ============================================================================

/**
 * Creates and shows the explanation popup.
 * @param {string} word
 * @param {string} sentence
 * @param {DictionaryResponse | null} definition
 * @param {DOMRect} selectionRect
 */
function showPopup(word, sentence, definition, selectionRect) {
	hidePopup();
	
	popupElement = document.createElement('div');
	popupElement.className = `${EXTENSION_ID}-popup`;
	popupElement.setAttribute('popover', 'auto');
	popupElement.innerHTML = createPopupContent(word, sentence, definition);
	
	document.body.appendChild(popupElement);
	
	positionPopup(popupElement, selectionRect);
	
	popupElement.showPopover();
	
	addPopupEventListeners(popupElement, word, sentence, definition);
}

/**
 * Creates the popup HTML content.
 * @param {string} word
 * @param {string} sentence
 * @param {DictionaryResponse | null} definition
 * @returns {string}
 */
function createPopupContent(word, sentence, definition) {
	const escapedWord = escapeHtml(word);
	const escapedSentence = escapeHtml(sentence);
	
	let definitionHtml = `<p class="${EXTENSION_ID}-popup-loading">Loading definition...</p>`;
	
	if (definition) {
		definitionHtml = definition.meanings.map(meaning => {
			const defs = meaning.definitions.slice(0, 2).map((def, i) => {
				let html = `<div class="${EXTENSION_ID}-popup-def">
					<span class="${EXTENSION_ID}-popup-def-num">${i + 1}.</span> ${escapeHtml(def.definition)}
				</div>`;
				if (def.example) {
					html += `<div class="${EXTENSION_ID}-popup-example">
						"${escapeHtml(def.example)}"
					</div>`;
				}
				return html;
			}).join('');
			
			return `<div class="${EXTENSION_ID}-popup-meaning">
				<span class="${EXTENSION_ID}-popup-pos">${escapeHtml(meaning.partOfSpeech)}</span>
				${defs}
			</div>`;
		}).join('');
	}
	
	const phonetic = definition?.phonetic || '';
	
	return `
		<div class="${EXTENSION_ID}-popup-header">
			<span class="${EXTENSION_ID}-popup-word">${escapedWord}</span>
			${phonetic ? `<span class="${EXTENSION_ID}-popup-phonetic">${escapeHtml(phonetic)}</span>` : ''}
		</div>
		<div class="${EXTENSION_ID}-popup-definitions">
			${definitionHtml}
		</div>
		<div class="${EXTENSION_ID}-popup-sentence">
			${escapedSentence}
		</div>
		<div class="${EXTENSION_ID}-popup-actions">
			<button class="${EXTENSION_ID}-save-btn">Save to vocabulary</button>
			<button class="${EXTENSION_ID}-close-btn">Close</button>
		</div>
	`;
}

/**
 * Adds event listeners to popup elements.
 * @param {HTMLElement} popup
 * @param {string} word
 * @param {string} sentence
 * @param {DictionaryResponse | null} definition
 */
function addPopupEventListeners(popup, word, sentence, definition) {
	const saveBtn = popup.querySelector(`.${EXTENSION_ID}-save-btn`);
	const closeBtn = popup.querySelector(`.${EXTENSION_ID}-close-btn`);
	
	if (saveBtn) {
		saveBtn.addEventListener('click', () => {
			saveEntry(word, sentence, definition);
			saveBtn.textContent = 'Saved!';
			saveBtn.disabled = true;
		});
	}
	
	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			popup.hidePopover();
		});
	}
	
	popup.addEventListener('toggle', (event) => {
		if (event.newState === 'closed') {
			clearHighlight();
			currentWord = null;
		}
	});
}

/**
 * Positions the popup relative to the selection.
 * @param {HTMLElement} popup
 * @param {DOMRect} selectionRect
 */
function positionPopup(popup, selectionRect) {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	
	let left = selectionRect.left;
	let top = selectionRect.bottom + 8;
	
	popup.style.left = `${left}px`;
	popup.style.top = `${top}px`;
	
	const rect = popup.getBoundingClientRect();
	
	if (rect.right > viewportWidth - 10) {
		popup.style.left = `${viewportWidth - rect.width - 10}px`;
	}
	
	if (rect.bottom > viewportHeight - 10) {
		popup.style.top = `${selectionRect.top - rect.height - 8}px`;
	}
}

/**
 * Hides and removes the popup.
 */
function hidePopup() {
	if (popupElement) {
		if (popupElement.matches(':popover-open')) {
			popupElement.hidePopover();
		}
		if (popupElement.parentNode) {
			popupElement.parentNode.removeChild(popupElement);
		}
	}
	popupElement = null;
}

// ============================================================================
// Data Operations
// ============================================================================

/**
 * Saves an entry to storage.
 * @param {string} word
 * @param {string} sentence
 * @param {DictionaryResponse | null} definition
 */
async function saveEntry(word, sentence, definition) {
	/** @type {SavedEntry} */
	const entry = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		word: word,
		sentence: sentence,
		definition: definition?.meanings[0]?.definitions[0]?.definition || '',
		partOfSpeech: definition?.meanings[0]?.partOfSpeech || '',
		phonetic: definition?.phonetic || '',
		sourceUrl: location.href,
		sourceTitle: document.title,
		createdAt: Date.now(),
	};
	
	try {
		const response = await chrome.runtime.sendMessage({
			action: 'save-entry',
			entry: entry,
		});
		
		if (response?.success) {
			console.log(`${EXTENSION_ID}: entry saved`, entry.id);
		}
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to save entry`, error);
	}
}

/**
 * Fetches definition from dictionary API via background script.
 * @param {string} word
 * @returns {Promise<DictionaryResponse | null>}
 */
async function fetchDefinition(word) {
	try {
		const response = await chrome.runtime.sendMessage({
			action: 'fetch-definition',
			word: word,
		});
		return response?.definition || null;
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to fetch definition`, error);
		return null;
	}
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Escapes HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

/**
 * Gets the selected text from a selection event.
 * @param {Selection} selection
 * @returns {{text: string, range: Range} | null}
 */
function getSelectionInfo(selection) {
	if (!selection || selection.rangeCount === 0) return null;
	
	const range = selection.getRangeAt(0);
	const text = range.toString().trim();
	
	if (!text) return null;
	
	return { text, range };
}

/**
 * Gets the word under the cursor.
 * @param {MouseEvent} event
 * @returns {{text: string, range: Range} | null}
 */
function getWordUnderCursor(event) {
	if (!event.target) return null;
	
	const element = /** @type {Element} */ (event.target);
	
	// Only handle text nodes
	if (element.nodeType !== Node.TEXT_NODE && !element.childNodes.length) {
		return null;
	}
	
	try {
		const range = document.caretRangeFromPoint(event.clientX, event.clientY);
		if (!range) return null;
		
		const textNode = range.startContainer;
		if (textNode.nodeType !== Node.TEXT_NODE) return null;
		
		const text = textNode.textContent || '';
		const offset = range.startOffset;
		
		// Find word boundaries
		let start = offset;
		let end = offset;
		
		const isWordChar = (/** @type {string} */ c) => /[a-zA-Z'-]/.test(c);
		
		while (start > 0 && isWordChar(text[start - 1])) {
			start--;
		}
		
		while (end < text.length && isWordChar(text[end])) {
			end++;
		}
		
		if (start === end) return null;
		
		const word = text.slice(start, end).trim();
		if (!word || word.length < 2) return null;
		
		// Create a new range for the word
		const wordRange = document.createRange();
		wordRange.setStart(textNode, start);
		wordRange.setEnd(textNode, end);
		
		return { text: word, range: wordRange };
	} catch (error) {
		return null;
	}
}

// ============================================================================
// Event Handlers
// ============================================================================

let isProcessingSelection = false;

/**
 * Handles text selection.
 * @param {Event} _event
 */
async function handleSelection(_event) {
	if (isProcessingSelection) return;
	isProcessingSelection = true;
	
	try {
		const selection = window.getSelection();
		const info = getSelectionInfo(selection);
		
		if (!info) {
			hidePopup();
			clearHighlight();
			currentWord = null;
			return;
		}
		
		if (info.text === currentWord) return;
		
		currentWord = info.text;
		const sentence = extractSentence(info.range);
		
		highlightRange(info.range.cloneRange());
		
		const rect = info.range.getBoundingClientRect();
		
		showPopup(info.text, sentence, null, rect);
		
		const definition = await fetchDefinition(info.text.toLowerCase());
		
		if (popupElement) {
			popupElement.innerHTML = createPopupContent(info.text, sentence, definition);
			addPopupEventListeners(popupElement, info.text, sentence, definition);
			positionPopup(popupElement, rect);
		}
	} finally {
		isProcessingSelection = false;
	}
}

/**
 * Handles double-click on words.
 * @param {MouseEvent} event
 */
async function handleDoubleClick(event) {
	const info = getWordUnderCursor(event);
	
	if (!info) return;
	
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(info.range);
	
	currentWord = info.text;
	const sentence = extractSentence(info.range);
	
	highlightRange(info.range.cloneRange());
	
	const rect = info.range.getBoundingClientRect();
	
	showPopup(info.text, sentence, null, rect);
	
	const definition = await fetchDefinition(info.text.toLowerCase());
	
	if (popupElement) {
		popupElement.innerHTML = createPopupContent(info.text, sentence, definition);
		addPopupEventListeners(popupElement, info.text, sentence, definition);
		positionPopup(popupElement, rect);
	}
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the content script.
 */
function initialize() {
	let selectionTimeout = null;
	document.addEventListener('mouseup', () => {
		if (selectionTimeout) clearTimeout(selectionTimeout);
		selectionTimeout = setTimeout(() => handleSelection(null), 100);
	});
	
	document.addEventListener('dblclick', handleDoubleClick);
	
	console.log(`${EXTENSION_ID}: content script loaded`);
}

initialize();
