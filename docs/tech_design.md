# Text-to-Notes Chrome Extension — Technical Design Document

## 1. Architecture Overview
The extension follows a **modular MV3 architecture** with clear separation of concerns:

- **Background Service Worker**: Manages message passing, orchestrates text/image capture, and persists notes to storage
- **Content Script**: PopClip-style popups, text selection extraction, and image capture with CORS handling
- **Notes Page (UI)**: A standalone HTML/JS/CSS page that lists, edits, and deletes mixed content (text + images)
- **Storage Layer**: Uses `chrome.storage.local` for persistence with support for base64 image data and URL fallbacks

```
Text Selection Flow:
User Action (Option+mouseup on text) 
   → PopClip-style popup
   → Content Script (extract selection + metadata)
   → Background Worker (message handling)
   → Storage (chrome.storage.local)

Image Capture Flow:
User Action (hover over image)
   → Image popup with save options
   → Content Script (3-tier CORS handling: base64 → CORS retry → URL fallback)
   → Background Worker (message handling)
   → Storage (chrome.storage.local)

Notes Management:
   → Notes Page (mixed content CRUD operations)
```

---

## 2. Components

### 2.1 Background Service Worker
- **Responsibilities**:
  - Handle message passing between content script and storage
  - Coordinate saving of text and image notes with metadata
  - Generate UUIDs and timestamps for all note types
  - Manage badge updates for user feedback
- **Implementation Notes**:
  - Runs as a service worker (event-driven, stateless between invocations)
  - Supports `saveTextNote`, `saveImageNote`, and `saveImageUrlNote` message types
  - Implements error handling for CORS and storage failures

### 2.2 Content Script
- **Responsibilities**:
  - PopClip-style text selection popup with Option+mouseup trigger
  - Image hover detection and popup display for capture
  - Three-tier CORS handling for image capture (base64 → CORS retry → URL fallback)
  - Extract text selections and page metadata (title, URL, domain)
  - Tag dialog integration for both text and image content
- **Implementation Notes**:
  - Comprehensive image processing with canvas-based base64 conversion
  - Smart popup positioning with viewport awareness
  - Mouse tracking and timeout management for UX
  - Must handle edge cases (iframes, cross-origin restrictions, tainted canvas)

### 2.3 Notes Page (UI)
- **Responsibilities**:
  - Display mixed content (text + images) in unified list/grid views
  - Support editing note text, tags, and viewing image details
  - Enable deleting notes and opening source URLs
  - Provide search, tag filtering, and content type filtering (All/Recent/Images/Untagged)
  - Image thumbnails with lazy loading and responsive display
- **Implementation Notes**:
  - Loads mixed content from `chrome.storage.local` on init
  - Handles both base64 image data and URL fallback display
  - Two-way binding: updates propagate to storage immediately
  - Image optimization: lazy loading, max-height constraints, object-fit
  - Framework: Vanilla JS for MVP, React/Vue optional later

### 2.4 Storage Layer
- **Responsibilities**:
  - Provide CRUD operations for text and image notes
  - Abstract `chrome.storage.local` API into promise-based functions
  - Handle base64 image data and URL fallback storage strategies
  - Support image metadata preservation and tag management
- **Schema**:
  ```json
  // Text Note
  {
    "id": "uuid",
    "type": "text",
    "text": "captured snippet",
    "url": "https://example.com/path",
    "title": "Example Page",
    "tags": ["tag1", "tag2"],
    "created_at": "2025-08-24T10:00:00Z"
  }
  
  // Image Note (Base64)
  {
    "id": "uuid",
    "type": "image",
    "imageData": "data:image/png;base64,iVBOR...",
    "imageUrl": null,
    "imageMetadata": {
      "width": 800, "height": 600,
      "size": 45000, "format": "png",
      "originalSrc": "https://example.com/image.jpg",
      "alt": "Image description"
    },
    "text": "optional caption",
    "url": "https://example.com/path",
    "title": "Example Page",
    "tags": ["tag1", "tag2"],
    "created_at": "2025-08-24T10:00:00Z"
  }
  
  // Image Note (URL Fallback)
  {
    "id": "uuid",
    "type": "image_url",
    "imageData": null,
    "imageUrl": "https://example.com/cors-blocked.jpg",
    "imageMetadata": { /* same structure */ },
    "text": "optional caption",
    "url": "https://example.com/path",
    "tags": ["tag1", "tag2"],
    "created_at": "2025-08-24T10:00:00Z"
  }
  ```

---

## 3. Data Flow

### Text Save Flow
1. User highlights text with Option key held → popup appears
2. User clicks "Save Note" or "+ Tags" in popup
3. Content script extracts selection + metadata, sends to background
4. Background worker enriches with UUID + timestamp, persists to storage

### Image Save Flow
1. User hovers over image → capture popup appears
2. User clicks "Save Image" or adds tags via dialog
3. Content script attempts three-tier capture:
   - Tier 1: Direct canvas base64 conversion (same-origin)
   - Tier 2: CORS retry with crossOrigin="anonymous" 
   - Tier 3: URL fallback storage for blocked images
4. Content script sends image data/URL + metadata to background
5. Background worker persists with UUID + timestamp

### View/Edit/Delete Flow
1. User opens Notes Page (`notes.html`) or popup interface
2. Page loads mixed content (text + images) from storage via DAO
3. Images display using base64 data or fallback URLs with lazy loading
4. User can filter by content type (All/Recent/Images/Untagged)
5. User edits/deletes notes → changes applied immediately in storage
6. Page re-renders mixed content based on updated dataset

---

## 4. Storage Strategy
- **Default:** `chrome.storage.local` (quota ~5MB, sufficient for MVP with mixed content)
- **Image Storage:** Base64 encoding for same-origin, URL references for CORS-blocked
- **Future-proofing:** Abstracted DAO supports migration to `indexedDB` for larger image collections
- **Optimization:** Image compression and size limits to manage storage usage

---

## 5. Permissions
Minimal permissions in `manifest.json`:
```json
{
  "permissions": [
    "storage",
    "scripting", 
    "activeTab",
    "tabs"
  ]
}
```
- `storage`: save text and image notes with metadata
- `scripting`: inject content script for PopClip-style popups and image capture
- `activeTab`: access active tab for metadata and image processing
- `tabs`: open full-page manager in new tab

---

## 6. Error Handling
- **Storage failures:** Show non-blocking error toast (Notes not saved)
- **CORS image errors:** Graceful fallback to URL storage with user notification
- **Tainted canvas errors:** Automatic retry with CORS-enabled image loading
- **Empty selection:** Disable popup if no valid text selected
- **Invalid URLs (chrome:// pages):** Skip save with message
- **Large image files:** Size limits with compression options

---

## 7. Performance Considerations
- **Text notes:** Small storage writes (<1 KB/note), well within Chrome limits
- **Image notes:** Base64 encoding increases size (~1.3x), URL fallback minimizes impact
- **UI rendering:** Lazy loading for images and note list (render visible range)
- **Image processing:** Canvas-based conversion with async handling
- **Target:** Save action <150ms p50, mixed content list loads <300ms for 500 notes
- **Optimization:** Image compression and thumbnail generation for large collections

---

## 8. Security & Privacy
- **No external network calls** in MVP - respects user privacy
- **CORS compliance:** Respects cross-origin policies, graceful fallback
- **No analytics collection** - all telemetry is local
- **Local storage only:** All text and image data remains on user's device
- **Image privacy:** Base64 encoding ensures offline access without external requests
- **Future sync features:** Must be opt-in with clear disclosure

---

## 9. Testing Plan
- **Unit Tests:** storage DAO (CRUD for text/images), utils (UUID, tag parsing), CORS handling
- **Integration Tests:** text and image save flows via background+content scripts
- **Manual E2E:** verify capture, view, edit, delete across sites with different CORS policies
- **Image Testing:** same-origin, CORS-enabled, and CORS-blocked image capture scenarios
- **UI Testing:** mixed content display, lazy loading, responsive image sizing
- **Regression:** test after Chrome version updates (MV3 compatibility)

---

## 10. Directory Structure
```
/extension
  ├─ manifest.json
  ├─ background.js         # service worker + message handling
  ├─ content.js            # PopClip popups + text/image capture with CORS
  ├─ notes/
  │   ├─ notes.html        # UI entry point
  │   ├─ notes.css
  │   ├─ manage.html       # full-page manager
  │   ├─ manage.css        # full-page styles  
  │   ├─ manage.js         # full-page logic
  │   └─ notes.js          # popup interface logic
  └─ lib/
      ├─ storage.js        # storage abstraction (text/image CRUD)
      └─ utils.js          # helpers (uuid, TagInput component, image utils)
```

---

## 11. Future Considerations
- **Scalability:** Switch to `indexedDB` for larger mixed content collections
- **Image optimization:** Compression, format conversion, thumbnail generation
- **Sync:** Cloud storage connectors with efficient image synchronization
- **AI:** Image recognition, visual search, auto-tagging for mixed content
- **Advanced capture:** GIF recording, video frame extraction
- **Offline robustness:** Export/import with embedded image data preservation

---
