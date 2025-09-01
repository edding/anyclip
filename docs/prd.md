# Text-to-Notes Chrome Extension — Product Requirements Document (PRD)

## 1) Overview
A Chrome extension that lets users select text and capture images on any web page and save them as notes with tags and the source URL. A companion notes page allows viewing, editing, searching, and organizing notes.

**Scope (MVP):** minimal, reliable text/image clipping + tagging + notes management. Future ideas (grouping, AI summarize, full-page capture) are out of scope for v0 but considered in architecture.

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
- As a user, I can select text on a webpage and see a **popup to "Save Note"**
- As a user, I can hover over images on a webpage and see a **popup to save the image**
- The saved note includes **selected text/image, page title, URL, timestamp**
- (Optional) The save flow lets me **add tags** immediately

### 4.2 Tagging
- As a user, I can **add/edit/remove tags** when saving or later on the notes page.
- As a user, I can **filter or search** by tag/keyword on the notes page.

### 4.3 Notes Management
- As a user, I can **view, edit, and delete** notes on the notes page.
- As a user, I can **open the source URL** from a note.

---

## 5) Key Features & Requirements
### 5.1 Content Capture
- **Text Trigger:** PopClip-style popup on text selection (Option+mouseup)
- **Image Trigger:** Hover-based popup on images with save options
- **Captured fields:** text/image data, title, URL, timestamp; optional user-entered tags
- **Reliability:** Must handle selections across common sites and frames when permitted
- **CORS Handling:** Three-tier image storage (base64 → CORS retry → URL fallback)

### 5.2 Storage
- **MVP:** `chrome.storage.local` with a typed schema. Consider `indexedDB` if data volume grows.
- **Note schema (v0):**
  ```json
  // Text Note
  {
    "id": "uuid",
    "type": "text",
    "text": "captured snippet",
    "url": "https://example.com/path",
    "title": "Example Page",
    "tags": ["tag1","tag2"],
    "created_at": "2025-08-24T10:00:00Z"
  }
  
  // Image Note
  {
    "id": "uuid",
    "type": "image",
    "imageData": "data:image/png;base64,iVBOR...",
    "imageUrl": "https://example.com/fallback.jpg",
    "imageMetadata": {
      "width": 800, "height": 600,
      "originalSrc": "https://example.com/image.jpg",
      "alt": "Image description"
    },
    "text": "optional caption",
    "url": "https://example.com/path",
    "tags": ["tag1","tag2"],
    "created_at": "2025-08-24T10:00:00Z"
  }
  ```
- **Quotas:** If later using `chrome.storage.sync`, expect ~100 KB total and per‑item limits; prefer `local/indexedDB` for larger data.

### 5.3 Notes Page
- Route: `chrome-extension://<EXT_ID>/notes.html` (or `index.html#/notes` if using SPA).
- Capabilities:
  - List notes with snippet/image preview, tags, source title/URL, timestamp
  - Support both text and image note display with thumbnails
  - Inline edit note text and tags
  - Delete notes (with undo snackbar optional)
  - Filter/search by keyword, tag, and content type (text/images)
  - Open source URL in new tab

### 5.4 Performance
- Save operation should complete in **<150 ms p50** on typical hardware.
- Notes list should render **<300 ms p50** for 500 notes.

### 5.5 Privacy & Security
- All data remains **local** in v0.
- No third‑party calls; no analytics in MVP.
- Request **minimal permissions** (contextMenus, storage, activeTab if needed).

---

## 6) UX / UI
### 6.1 PopClip-Style Popups
- **Text Selection:** Popup with "Save Note" and "+ Tags" buttons
- **Image Hover:** Popup with save options and tag integration
- **Design:** Dark theme with smooth animations and smart positioning
- On success: non-blocking toast/notification (optional in v0)

### 6.2 Notes Page
- **Header:** Search box + tag filter + content type filter (All/Recent/Images/Untagged)
- **Table/List:** text/image preview, tags (chips), title (clickable), URL (icon), timestamp, actions (edit/delete)
- **Edit Drawer/Modal:** Multi-line text editor + tag input + image display
- **Image Support:** Thumbnails, lazy loading, responsive display

Accessibility: keyboard navigation for search, edit, delete; proper ARIA roles.

---

## 7) Technical Design (MVP)
- **Manifest:** MV3.
- **Background service worker:** handle message passing, coordinate text/image capture, write to storage
- **Content script:** PopClip-style popups, extract text selection + image capture with CORS handling
- **UI:** Notes page (`notes.html` + JS) with mixed content support. Optional lightweight framework (Vanilla JS for v0; React in v1+)
- **Utilities:** UUID generator, storage DAO, tag parser.
- **Testing:** Unit tests for storage and parsing; manual E2E flows on Chrome stable.

Suggested structure:
```
/extension
  ├─ manifest.json
  ├─ background.js         # message handling + storage coordination
  ├─ content.js            # PopClip popups + text/image capture
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
- **Activation:** # notes saved / day (text + images)
- **Engagement:** % users who open notes page after saving
- **Content Mix:** ratio of text vs image notes captured
- **Organization adoption:** avg # tags per note; % notes with ≥1 tag
- **Quality (qual):** user feedback on correctness of captured content + metadata

---

## 9) Risks & Mitigations
- **Image CORS restrictions:** three-tier fallback system (base64 → CORS retry → URL storage)
- **Quota/scale:** migrate to `indexedDB` when notes grow; export/import as JSON in v2
- **Large image files:** implement size limits and compression for base64 storage
- **Site restrictions/iframes:** fallback to document.getSelection in content script; handle edge cases with permissions

---

## 10) Acceptance Criteria (v0)
- Install extension and capture text via PopClip-style popup and images via hover popup
- Text notes contain **text, title, URL, timestamp**; optional tags
- Image notes contain **image data/URL, metadata, title, URL, timestamp**; optional tags
- Notes page loads, lists mixed content, allows **edit, tag edit, delete**, and **open URL**
- Content type filtering works (All/Recent/Images/Untagged)
- All data persists locally across browser restarts with CORS fallback working
