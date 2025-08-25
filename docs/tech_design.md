# Text-to-Notes Chrome Extension — Technical Design Document

## 1. Architecture Overview
The extension follows a **modular MV3 architecture** with clear separation of concerns:

- **Background Service Worker**: Manages context menu actions, orchestrates data flow, and persists notes to storage.
- **Content Script**: Extracts selected text and page metadata when requested by background worker.
- **Notes Page (UI)**: A standalone HTML/JS/CSS page that lists, edits, and deletes notes.
- **Storage Layer**: Uses `chrome.storage.local` for persistence, abstracted by a simple DAO.

```
User Action (highlight text) 
   → Context Menu ("Save Note") 
   → Background Worker 
   → Content Script (get selection, title, URL) 
   → Storage (chrome.storage.local) 
   → Notes Page (CRUD operations)
```

---

## 2. Components

### 2.1 Background Service Worker
- **Responsibilities**:
  - Register context menu item `"Save selection as note"`.
  - Listen for context menu clicks and request data from content script.
  - Save note to storage (generate UUID, timestamp).
- **Implementation Notes**:
  - Runs as a service worker (event-driven, stateless between invocations).
  - Communicates with content scripts via `chrome.tabs.sendMessage`.

### 2.2 Content Script
- **Responsibilities**:
  - Extract highlighted text (`window.getSelection()`).
  - Provide page metadata (title, URL).
  - Return payload to background service worker.
- **Implementation Notes**:
  - Minimal footprint; injected only when needed.
  - Must handle edge cases (iframes, cross-origin restrictions).

### 2.3 Notes Page (UI)
- **Responsibilities**:
  - Display saved notes in a list view.
  - Support editing note text and tags.
  - Enable deleting notes and opening source URLs.
  - Provide search and tag filtering.
- **Implementation Notes**:
  - Loads data from `chrome.storage.local` on init.
  - Two-way binding: updates propagate to storage immediately.
  - Framework: Vanilla JS for MVP, React/Vue optional later.

### 2.4 Storage Layer
- **Responsibilities**:
  - Provide CRUD operations for notes.
  - Abstract `chrome.storage.local` API into promise-based functions.
- **Schema**:
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

---

## 3. Data Flow

### Save Flow
1. User highlights text → right-clicks → selects “Save as note”.
2. Background worker receives menu click event.
3. Worker sends request to content script in active tab.
4. Content script extracts text + metadata and sends back.
5. Worker enriches with UUID + timestamp, persists to storage.

### View/Edit/Delete Flow
1. User opens Notes Page (`notes.html`).
2. Page loads notes from storage via DAO.
3. User edits/deletes notes → changes applied immediately in storage.
4. Page re-renders based on updated dataset.

---

## 4. Storage Strategy
- **Default:** `chrome.storage.local` (quota ~5MB, sufficient for MVP).
- **Future-proofing:** Abstracted DAO so we can switch to `indexedDB` or cloud sync later without changing UI/business logic.

---

## 5. Permissions
Minimal permissions in `manifest.json`:
```json
{
  "permissions": [
    "storage",
    "contextMenus",
    "scripting",
    "activeTab"
  ]
}
```
- `storage`: save notes.
- `contextMenus`: add right-click option.
- `scripting`: inject content script if needed.
- `activeTab`: access active tab for metadata.

---

## 6. Error Handling
- **Storage failures:** Show non-blocking error toast (Notes not saved).
- **Empty selection:** Disable context menu option if no text selected.
- **Invalid URL (chrome:// pages):** Skip save with message.

---

## 7. Performance Considerations
- Storage writes are small (<1 KB/note). Well within Chrome limits.
- UI rendering optimized by lazy loading note list (render visible range).
- Target: Save action completes <150 ms p50, list loads <300 ms for 500 notes.

---

## 8. Security & Privacy
- No external network calls in MVP.
- No analytics collection.
- All data local by default.
- Future sync features must be opt-in with clear disclosure.

---

## 9. Testing Plan
- **Unit Tests**: storage DAO (CRUD), utils (UUID, tag parsing).
- **Integration Tests**: save flow via background+content scripts.
- **Manual E2E**: verify capture, view, edit, delete across sites (news, docs, blogs).
- **Regression**: test after Chrome version updates (MV3 compatibility).

---

## 10. Directory Structure
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

---

## 11. Future Considerations
- **Scalability:** Switch to `indexedDB` for larger notes collections.
- **Sync:** Cloud storage connectors (Drive, Supabase, Firebase).
- **AI:** Add summarization/auto-tagging pipeline in v4.
- **Offline robustness:** Export/import notes for backup.

---
