# Text-to-Notes Chrome Extension

## Project Overview
A Chrome extension that allows users to select text on any web page and save it as a note with tags and source URL. Includes a companion notes page for managing saved notes.

## Architecture
- **Manifest Version:** MV3
- **Background Service Worker:** Handles context menu and orchestrates data flow
- **Content Script:** Extracts selected text and page metadata
- **Notes Page:** Standalone UI for CRUD operations on notes
- **Storage:** `chrome.storage.local` for MVP

## Directory Structure
```
/extension
  ├─ manifest.json
  ├─ background.js         # service worker
  ├─ content.js            # selection + metadata capture
  ├─ notes/
  │   ├─ notes.html        # UI entry point
  │   ├─ notes.css
  │   └─ notes.js
  └─ lib/
      ├─ storage.js        # storage abstraction (CRUD)
      └─ utils.js          # helpers (uuid, date formatting)
```

## Note Schema
```json
{
  "id": "uuid",
  "text": "captured snippet",
  "url": "https://example.com/path",
  "title": "Example Page",
  "tags": ["tag1", "tag2"],
  "created_at": "2025-08-24T10:00:00Z"
}
```

## Permissions Required
- `storage`: Save notes locally
- `contextMenus`: Add right-click option
- `scripting`: Inject content script
- `activeTab`: Access active tab for metadata

## Key Features (MVP)
1. **Text Capture**: Right-click context menu on selected text
2. **Note Storage**: Local storage with structured schema
3. **Notes Management**: View, edit, delete, and search notes
4. **Tagging**: Add/edit/remove tags for organization
5. **Source Context**: Preserve URL, page title, and timestamp

## Development Commands
```bash
# Development
npm run build        # Build extension for development
npm run test         # Run unit tests
npm run lint         # Check code quality

# Testing
# Load unpacked extension in Chrome for manual testing
# chrome://extensions/ -> Load unpacked -> select /extension folder
```

## Performance Targets
- Save operation: <150ms p50
- Notes list render: <300ms p50 for 500 notes

## Privacy & Security
- All data remains local (no external calls in MVP)
- Minimal permissions requested
- No analytics or telemetry in MVP