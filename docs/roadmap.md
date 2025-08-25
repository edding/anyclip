# Text-to-Notes — Milestones & Roadmap

## v0 — MVP (This release)
**Goal:** Validate core workflow (capture → save → review).  
**Features:**
- Right‑click **Save selection as note**.
- Store: text, title, URL, timestamp; optional tags.
- Notes page: list, edit text, edit tags, delete, open source URL.
- Local storage (`chrome.storage.local`).

**Acceptance Criteria:**
- End‑to‑end capture and management works across typical sites.
- Data persists across restarts.
- Minimal permissions; no network calls.

---

## v1 — Usability & Discoverability
**Goal:** Reduce friction and improve organization.  
**Features:**
- **Selection popup** (mini toolbar) and **keyboard shortcut** to save.
- **Search & filter** on notes page (keyword + tag).
- Tag **auto-suggestion** (from history).
- Basic UX polish (sorting by date/title).

**Tech Notes:**
- Debounced search; simple client‑side indexing.
- Optional lightweight framework for notes UI.

---

## v2 — Organization & Portability
**Goal:** Help users manage growing libraries.  
**Features:**
- **Auto-group** by URL/domain on notes page.
- **Bulk actions:** bulk tag/delete.
- **Export/Import** (JSON/CSV).

**Tech Notes:**
- Introduce a `source` dimension (domain) in schema.
- Add migration helpers for storage.

---

## v3 — Resilience Against Link Rot
**Goal:** Preserve context when pages change.  
**Features:**
- Store extended metadata (favicon, author, published date if detectable).
- **Screenshot** the page at save time (permission-gated).
- Optional **reader-mode extraction** stored alongside note.

**Tech Notes:**
- Use `tabs.captureVisibleTab` (with user gesture) for screenshots.
- Add size limits and user toggles.

---

## v4 — Intelligence
**Goal:** Make libraries navigable with minimal manual effort.  
**Features:**
- **Auto‑tagging** and **topic grouping** (local/offline first or pluggable backend).
- **One‑click summarize** notes from the same page or tag.
- **Semantic search** over notes.

**Tech Notes:**
- Start with lightweight local models or optional cloud connectors.
- Guardrails: opt‑in, transparent model usage, privacy docs.

---

## v5 — Sync & Sharing
**Goal:** Multi-device continuity and collaboration.  
**Features:**
- **Cloud sync** (e.g., user’s Drive/Supabase/Firebase) with account login.
- **Share** collections (public link) and **export to** Notion/Obsidian/Markdown.
- Simple **conflict resolution** rules.

**Tech Notes:**
- Abstract storage: repository interface (Local | Cloud).
- Auth + rate limiting; background sync strategies.

---

## v6 — Product Polish & Growth
**Goal:** Ready for broader release.  
**Features:**
- PWA or mobile companion (read‑only first).
- Capture other media (image/selection screenshot/voice).
- Integrations (send to Slack/Trello) and automation rules.
- Basic telemetry (opt‑in).

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
