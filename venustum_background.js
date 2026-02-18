'use strict';

/**
 * @file background script for Venustum
 */

const EXTENSION_ID = 'venustum';
const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

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
 * @typedef {Object} DictionaryEntry
 * @property {string} word
 * @property {string} phonetic
 * @property {Phonetic[]} phonetics
 * @property {Meaning[]} meanings
 */

/**
 * @typedef {Object} Phonetic
 * @property {string} text
 * @property {string} audio
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
// Storage Keys
// ============================================================================

const STORAGE_KEY = 'venustum_entries';

// ============================================================================
// Dictionary API
// ============================================================================

/**
 * Fetches definition from Dictionary API.
 * @param {string} word
 * @returns {Promise<DictionaryEntry | null>}
 */
async function fetchDefinitionFromAPI(word) {
	const url = `${DICTIONARY_API_BASE}/${encodeURIComponent(word)}`;
	
	try {
		const response = await fetch(url);
		
		if (!response.ok) {
			if (response.status === 404) {
				console.log(`${EXTENSION_ID}: word not found: ${word}`);
				return null;
			}
			throw new Error(`HTTP ${response.status}`);
		}
		
		const data = await response.json();
		
		if (!Array.isArray(data) || data.length === 0) {
			return null;
		}
		
		const entry = data[0];
		
		// Extract phonetic
		let phonetic = entry.phonetic || '';
		if (!phonetic && entry.phonetics) {
			const withText = entry.phonetics.find(p => p.text);
			if (withText) phonetic = withText.text;
		}
		
		return {
			word: entry.word,
			phonetic: phonetic,
			phonetics: entry.phonetics || [],
			meanings: (entry.meanings || []).map(m => ({
				partOfSpeech: m.partOfSpeech,
				definitions: (m.definitions || []).map(d => ({
					definition: d.definition,
					example: d.example || '',
				})),
			})),
		};
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to fetch definition for "${word}"`, error);
		return null;
	}
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Gets all saved entries from storage.
 * @returns {Promise<SavedEntry[]>}
 */
async function getEntries() {
	try {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		return result[STORAGE_KEY] || [];
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to get entries`, error);
		return [];
	}
}

/**
 * Saves an entry to storage.
 * @param {SavedEntry} entry
 * @returns {Promise<boolean>}
 */
async function saveEntry(entry) {
	try {
		const entries = await getEntries();
		
		// Check for duplicates
		const exists = entries.some(e => 
			e.word.toLowerCase() === entry.word.toLowerCase() && 
			e.sentence === entry.sentence
		);
		
		if (exists) {
			console.log(`${EXTENSION_ID}: entry already exists`);
			return false;
		}
		
		entries.unshift(entry);
		await chrome.storage.local.set({ [STORAGE_KEY]: entries });
		
		console.log(`${EXTENSION_ID}: entry saved, total: ${entries.length}`);
		return true;
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to save entry`, error);
		return false;
	}
}

/**
 * Deletes an entry from storage.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function deleteEntry(id) {
	try {
		const entries = await getEntries();
		const filtered = entries.filter(e => e.id !== id);
		await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
		
		console.log(`${EXTENSION_ID}: entry deleted, remaining: ${filtered.length}`);
		return true;
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to delete entry`, error);
		return false;
	}
}

/**
 * Clears all entries from storage.
 * @returns {Promise<boolean>}
 */
async function clearAllEntries() {
	try {
		await chrome.storage.local.set({ [STORAGE_KEY]: [] });
		console.log(`${EXTENSION_ID}: all entries cleared`);
		return true;
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to clear entries`, error);
		return false;
	}
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handles messages from content script and popup.
 * @param {Object} message
 * @param {chrome.runtime.MessageSender} sender
 * @param {Function} sendResponse
 * @returns {boolean}
 */
function handleMessage(message, sender, sendResponse) {
	(async () => {
		try {
			switch (message.action) {
				case 'fetch-definition': {
					const definition = await fetchDefinitionFromAPI(message.word);
					sendResponse({ definition });
					break;
				}
				
				case 'save-entry': {
					const success = await saveEntry(message.entry);
					sendResponse({ success });
					break;
				}
				
				case 'get-entries': {
					const entries = await getEntries();
					sendResponse({ entries });
					break;
				}
				
				case 'delete-entry': {
					const success = await deleteEntry(message.id);
					sendResponse({ success });
					break;
				}
				
				case 'clear-entries': {
					const success = await clearAllEntries();
					sendResponse({ success });
					break;
				}
				
				default:
					sendResponse({ error: 'Unknown action' });
			}
		} catch (error) {
			console.error(`${EXTENSION_ID}: message handler error`, error);
			sendResponse({ error: 'Internal error' });
		}
	})();
	
	return true; // Keep channel open for async response
}

// ============================================================================
// Action Button
// ============================================================================

const ICONS = {
	disabled: 'icons/icon_lightgray.png',
	enabledLight: 'icons/icon_black.png',
	enabledDark: 'icons/icon_white.png',
};

/**
 * Updates the extension icon badge with entry count.
 */
async function updateBadge() {
	try {
		const entries = await getEntries();
		const count = entries.length;
		
		if (count > 0) {
			await chrome.action.setBadgeText({ text: count.toString() });
			await chrome.action.setBadgeBackgroundColor({ color: '#1976d2' });
		} else {
			await chrome.action.setBadgeText({ text: '' });
		}
	} catch (error) {
		console.error(`${EXTENSION_ID}: failed to update badge`, error);
	}
}

// ============================================================================
// Initialization
// ============================================================================

function initialize() {
	chrome.runtime.onMessage.addListener(handleMessage);
	
	// Update badge on storage changes
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName === 'local' && changes[STORAGE_KEY]) {
			updateBadge();
		}
	});
	
	// Initial badge update
	updateBadge();
	
	console.log(`${EXTENSION_ID}: background script loaded`);
}

initialize();
