'use strict';

/**
 * @file popup script for Venustum
 */

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

// ============================================================================
// DOM Elements
// ============================================================================

const entriesContainer = document.getElementById('entries');
const emptyState = document.getElementById('empty-state');
const entryCount = document.getElementById('entry-count');
const clearBtn = document.getElementById('clear-btn');

// ============================================================================
// Rendering
// ============================================================================

/**
 * Renders entries list.
 * @param {SavedEntry[]} entries
 */
function renderEntries(entries) {
	if (entries.length === 0) {
		entriesContainer.style.display = 'none';
		emptyState.style.display = 'block';
		clearBtn.disabled = true;
		entryCount.textContent = '0 entries';
		return;
	}
	
	entriesContainer.style.display = 'block';
	emptyState.style.display = 'none';
	clearBtn.disabled = false;
	entryCount.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
	
	entriesContainer.innerHTML = entries.map(entry => `
		<div class="entry" data-id="${entry.id}">
			<div class="entry-header">
				<div>
					<span class="entry-word">${escapeHtml(entry.word)}</span>
					${entry.partOfSpeech ? `<span class="entry-pos">${escapeHtml(entry.partOfSpeech)}</span>` : ''}
				</div>
				<button class="entry-delete" title="Delete">×</button>
			</div>
			${entry.definition ? `<div class="entry-definition">${escapeHtml(entry.definition)}</div>` : ''}
			${entry.sentence ? `<div class="entry-sentence">${escapeHtml(entry.sentence)}</div>` : ''}
			<div class="entry-meta">
				<span>${entry.sourceTitle ? escapeHtml(truncate(entry.sourceTitle, 30)) : ''}</span>
				<span>${formatDate(entry.createdAt)}</span>
			</div>
		</div>
	`).join('');
	
	// Add click handlers
	addEntryHandlers();
}

/**
 * Adds event handlers to entries.
 */
function addEntryHandlers() {
	const entries = entriesContainer.querySelectorAll('.entry');
	
	entries.forEach(entryEl => {
		const id = entryEl.dataset.id;
		const deleteBtn = entryEl.querySelector('.entry-delete');
		
		// Click to open source URL
		entryEl.addEventListener('click', (e) => {
			if (e.target === deleteBtn) return;
			openEntry(id);
		});
		
		// Delete button
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			deleteEntry(id);
		});
	});
}

// ============================================================================
// Data Operations
// ============================================================================

/**
 * Loads entries from storage.
 */
async function loadEntries() {
	try {
		const response = await chrome.runtime.sendMessage({ action: 'get-entries' });
		if (response?.entries) {
			renderEntries(response.entries);
		}
	} catch (error) {
		console.error('Failed to load entries:', error);
		entriesContainer.innerHTML = '<div class="loading">Failed to load</div>';
	}
}

/**
 * Deletes an entry.
 * @param {string} id
 */
async function deleteEntry(id) {
	try {
		await chrome.runtime.sendMessage({ action: 'delete-entry', id });
		await loadEntries();
	} catch (error) {
		console.error('Failed to delete entry:', error);
	}
}

/**
 * Opens the entry's source URL.
 * @param {string} id
 */
async function openEntry(id) {
	try {
		const response = await chrome.runtime.sendMessage({ action: 'get-entries' });
		const entry = response?.entries?.find(e => e.id === id);
		
		if (entry?.sourceUrl) {
			chrome.tabs.create({ url: entry.sourceUrl });
		}
	} catch (error) {
		console.error('Failed to open entry:', error);
	}
}

/**
 * Clears all entries.
 */
async function clearAll() {
	if (!confirm('Delete all saved entries? This cannot be undone.')) {
		return;
	}
	
	try {
		await chrome.runtime.sendMessage({ action: 'clear-entries' });
		await loadEntries();
	} catch (error) {
		console.error('Failed to clear entries:', error);
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
 * Truncates a string to a maximum length.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength) {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - 1) + '…';
}

/**
 * Formats a timestamp as a relative date.
 * @param {number} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
	const date = new Date(timestamp);
	const now = new Date();
	const diff = now - date;
	
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);
	
	if (minutes < 1) return 'Just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	
	return date.toLocaleDateString();
}

// ============================================================================
// Initialization
// ============================================================================

clearBtn.addEventListener('click', clearAll);

loadEntries();
