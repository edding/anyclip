# Text-to-Notes Chrome Extension — Product Requirements Document (PRD)

## 1) Overview
A Chrome extension that lets users select text on any web page and save it as a note with tags and the source URL. A companion notes page allows viewing, editing, searching, and organizing notes.

**Scope (MVP):** minimal, reliable text clipping + tagging + notes management. Future ideas (grouping, AI summarize, full-page capture) are out of scope for v0 but considered in architecture.

---

## 2) Goals
- Provide a **fast, intuitive** capture → save → review workflow.
- Store notes in a **structured, searchable, editable** format.
- Preserve **context** via URL, page title, and timestamp.
- Offer a **dedicated notes page** for managing notes.

**Non-Goals (MVP):**
- Auto-grouping by URL/domain.
- AI organization/summarization.
- Full-page archival/screenshot.
- Cloud accounts/sync/sharing.

---

## 3) Target Users
- Researchers, students, and knowledge workers who frequently clip references.
- Anyone who wants lightweight note-taking without leaving the browser.

---

## 4) User Stories (MVP)
### 4.1 Capture Note
- As a user, I can select text on a webpage and **right‑click → “Save as note.”**
- The saved note includes **selected text, page title, URL, timestamp**.
- (Optional) The save flow lets me **add tags** immediately.

### 4.2 Tagging
- As a user, I can **add/edit/remove tags** when saving or later on the notes page.
- As a user, I can **filter or search** by tag/keyword on the notes page.

### 4.3 Notes Management
- As a user, I can **view, edit, and delete** notes on the notes page.
- As a user, I can **open the source URL** from a note.

---

## 5) Key Features & Requirements
### 5.1 Text Capture
- **Trigger:** Context menu on selected text (v0). (Popup/tooltip and keyboard shortcut in v1+)
- **Captured fields:** text, title, URL, timestamp; optional user-entered tags.
- **Reliability:** Must handle selections across common sites and frames when permitted.

### 5.2 Storage
- **MVP:** `chrome.storage.local` with a typed schema. Consider `indexedDB` if data volume grows.
- **Note schema (v0):**
  ```json
  {
    "id": "uuid",
    "text": "captured snippet",
    "url": "https://example.com/path",
    "title": "Example Page",
    "tags": ["tag1","tag2"],
    "created_at": "2025-08-24T10:00:00Z"
  }
  ```
- **Quotas:** If later using `chrome.storage.sync`, expect ~100 KB total and per‑item limits; prefer `local/indexedDB` for larger data.

### 5.3 Notes Page
- Route: `chrome-extension://<EXT_ID>/notes.html` (or `index.html#/notes` if using SPA).
- Capabilities:
  - List notes with snippet preview, tags, source title/URL, timestamp.
  - Inline edit note text and tags.
  - Delete notes (with undo snackbar optional).
  - Filter/search by keyword and tag.
  - Open source URL in new tab.

### 5.4 Performance
- Save operation should complete in **<150 ms p50** on typical hardware.
- Notes list should render **<300 ms p50** for 500 notes.

### 5.5 Privacy & Security
- All data remains **local** in v0.
- No third‑party calls; no analytics in MVP.
- Request **minimal permissions** (contextMenus, storage, activeTab if needed).

---

## 6) UX / UI
### 6.1 Context Menu
- **Label:** “Save selection as note”
- On success: non-blocking toast/notification (optional in v0).

### 6.2 Notes Page
- **Header:** Search box + tag filter.
- **Table/List:** snippet, tags (chips), title (clickable), URL (icon), timestamp, actions (edit/delete).
- **Edit Drawer/Modal:** Multi-line text editor + tag input.

Accessibility: keyboard navigation for search, edit, delete; proper ARIA roles.

---

## 7) Technical Design (MVP)
- **Manifest:** MV3.
- **Background service worker:** create context menu, handle selection capture, write to storage.
- **Content script:** (only if needed) help extract selection + metadata reliably.
- **UI:** Notes page (`notes.html` + JS). Optional lightweight framework (Vanilla JS for v0; React in v1+).
- **Utilities:** UUID generator, storage DAO, tag parser.
- **Testing:** Unit tests for storage and parsing; manual E2E flows on Chrome stable.

Suggested structure:
```
/extension
  ├─ manifest.json
  ├─ background.js
  ├─ content.js
  ├─ notes/
  │   ├─ notes.html
  │   ├─ notes.css
  │   └─ notes.js
  └─ lib/
      ├─ storage.js
      └─ utils.js
```

---

## 8) Metrics (MVP)
- **Activation:** # notes saved / day.
- **Engagement:** % users who open notes page after saving.
- **Organization adoption:** avg # tags per note; % notes with ≥1 tag.
- **Quality (qual):** user feedback on correctness of captured text + metadata.

---

## 9) Risks & Mitigations
- **Discoverability (only right‑click):** add keyboard shortcut/selection popup in v1.
- **Quota/scale:** migrate to `indexedDB` when notes grow; export/import as JSON in v2.
- **Link rot:** add screenshot/reader‑mode capture in v3.
- **Site restrictions/iframes:** fallback to document.getSelection in content script; handle edge cases with permissions.

---

## 10) Acceptance Criteria (v0)
- Install extension and capture a selection via context menu.
- Note contains **text, title, URL, timestamp**; optional tags.
- Notes page loads, lists notes, allows **edit, tag edit, delete**, and **open URL**.
- All data persists locally across browser restarts.
