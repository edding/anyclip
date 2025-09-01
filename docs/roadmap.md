# Text-to-Notes — Milestones & Roadmap

## v0 — MVP (This release) ✅ COMPLETED
**Goal:** Validate core workflow (capture → save → review).  
**Features:**
- **PopClip-style text capture** with Option+mouseup trigger
- **Image capture** via hover popup with CORS handling
- Store: text/image data, metadata, title, URL, timestamp; optional tags
- Notes page: list mixed content, edit text, edit tags, delete, open source URL
- Content type filtering (All/Recent/Images/Untagged)
- Local storage (`chrome.storage.local`) with three-tier image fallback

**Acceptance Criteria:**
- End‑to‑end text and image capture works across typical sites
- CORS fallback system handles cross-origin images gracefully
- Mixed content display in popup and full-page manager
- Data persists across restarts with image data/URL storage
- Minimal permissions; no network calls

---

## v1 — Enhanced Organization & Search
**Goal:** Improve organization and search for mixed content.  
**Features:**
- **Advanced image search** (by dimensions, format, alt text)
- **Bulk operations** for mixed content (text + image selection)
- **Enhanced tag auto-suggestion** with usage statistics
- **Image thumbnails** in search results and list views
- Basic UX polish (sorting by date/title/content type)

**Tech Notes:**
- Debounced search with image metadata indexing
- Image processing optimizations (compression, lazy loading)
- Optional lightweight framework for notes UI

---

## v2 — Organization & Portability
**Goal:** Help users manage growing libraries with mixed content.  
**Features:**
- **Auto-group** by URL/domain with image galleries
- **Bulk actions:** bulk tag/delete for text and images
- **Export/Import** (JSON/CSV) with image data preservation
- **Image compression** and storage optimization

**Tech Notes:**
- Introduce a `source` dimension (domain) in schema
- Add migration helpers for storage with image data handling
- Implement image compression algorithms for storage efficiency

---

## v3 — Resilience Against Link Rot
**Goal:** Preserve context when pages change.  
**Features:**
- Store extended metadata (favicon, author, published date if detectable)
- **Full-page screenshots** at save time (permission-gated)
- **High-resolution image backup** for CORS-fallback notes
- Optional **reader-mode extraction** stored alongside note

**Tech Notes:**
- Use `tabs.captureVisibleTab` (with user gesture) for screenshots
- Implement periodic re-fetching for CORS-fallback image URLs
- Add size limits and user toggles for storage management

---

## v4 — Intelligence
**Goal:** Make libraries navigable with minimal manual effort.  
**Features:**
- **Auto‑tagging** for text and **image recognition** for automatic categorization
- **Visual search** and **similar image detection**
- **One‑click summarize** mixed content from the same page or tag
- **Semantic search** over text and **reverse image search**

**Tech Notes:**
- Integrate lightweight local models for image recognition (TensorFlow.js)
- Optional cloud connectors for advanced visual search
- Guardrails: opt‑in, transparent model usage, privacy docs

---

## v5 — Sync & Sharing
**Goal:** Multi-device continuity and collaboration.  
**Features:**
- **Cloud sync** with efficient image data synchronization
- **Share** mixed content collections (public galleries) 
- **Export to** Notion/Obsidian/Markdown with embedded images
- **Conflict resolution** for both text and image content

**Tech Notes:**
- Abstract storage: repository interface (Local | Cloud) with image handling
- Delta sync for large image collections and bandwidth optimization
- Auth + rate limiting; background sync strategies

---

## v6 — Product Polish & Growth
**Goal:** Ready for broader release.  
**Features:**
- PWA or mobile companion with image gallery support
- **Advanced media capture** (GIF recording, video screenshots)
- Integrations (send images to Slack/Pinterest) and automation rules
- Basic telemetry (opt‑in) with content type analytics

**Tech Notes:**
- Event schema for telemetry; privacy‑first defaults.
- Extension store listing assets & onboarding.

---

## Engineering Backlog (Cross‑Cutting)
- Error handling, retries, and storage migrations.
- Accessibility (keyboard navigation, ARIA).
- Basic unit/E2E tests (Playwright) for capture and notes CRUD.
- Release tooling (zip build, versioning, CHANGELOG).

---

## Nice‑to‑Have Ideas
- Quick‑open launcher (omnibox command).
- Smart de‑duplication of identical snippets.
- “Quote in context” deep‑linking (scroll to selection).
