# Venustum

English learning browser extension - select words to get definitions and save them.

## Quick Facts

- Plain JavaScript (no build step, no package manager)
- Load as unpacked extension in Chrome/Firefox
- No tests, no linting configured

## Key Files

- `venustum_content.js` - text selection, highlighting, popup
- `venustum_background.js` - API calls, storage
- `popup/venustum_popup.*` - extension popup UI

## Tech References

- [Free Dictionary API](https://dictionaryapi.dev/)
- [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- [CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/anchor)

For detailed specs, see `SPEC.md`
