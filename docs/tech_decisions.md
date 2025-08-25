# Technical Decisions Log

This document tracks key technical decisions made during the development of the Text-to-Notes Chrome extension.

## Selection Popup Display Logic

### Decision: When to Show the PopClip-Style Popup

**Date**: 2025-08-25  
**Context**: Users reported that the popup sometimes doesn't appear when selecting text.

#### Current Implementation:
The popup appears when text is selected based on these conditions:

**Timing:**
- 300ms delay after `selectionchange` event to avoid flickering during selection
- Popup hides immediately on scroll, resize, or clicking outside

**Validation Rules:**
```javascript
function isValidSelection() {
  const selectedText = selection.toString().trim();
  
  // Basic length checks
  if (!selectedText) return false;
  if (selectedText.length < 2) return false;
  if (selectedText.length > 10000) return false;
  
  // Pattern-based rejections
  const invalidPatterns = [
    /^[\s\n\r\t]*$/,          // Only whitespace
    /^[^\w\s]*$/,             // Only punctuation (no letters or numbers)
    /^\.+$|^\?+$|^!+$/        // Only dots, question marks, or exclamation marks
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(selectedText));
}
```

**What Shows Popup:**
- ✅ Words and phrases (2+ characters)
- ✅ Numbers ("123", "42")
- ✅ Mixed content ("hello world!", "test@example.com")
- ✅ Code snippets, URLs, technical content
- ✅ Most normal text selections

**What Doesn't Show Popup:**
- ❌ Single characters
- ❌ Pure whitespace/newlines
- ❌ Only punctuation marks ("!!!", "...")
- ❌ Empty selections

#### Rationale:
1. **300ms delay**: Prevents popup from flickering while user is still selecting text
2. **Minimum 2 chars**: Single characters are rarely useful as notes
3. **Lenient validation**: Allow numbers, mixed content, and technical text which are common note-worthy selections
4. **Smart hiding**: Disappears when user scrolls or clicks elsewhere to avoid UI clutter

#### Previous Issues Resolved:
- **V1**: Too restrictive - rejected numbers and mixed punctuation
- **V2**: Fixed Unicode support - was rejecting Chinese/international text
- **V3**: Current implementation uses Unicode-aware regex (`\p{L}\p{N}`) to support all languages

---

## Context Menu vs Popup UI

### Decision: PopClip-Style Selection Popup

**Date**: 2025-08-25  
**Context**: User requested PopClip-style popup instead of right-click context menu.

#### Implementation Details:
- **Trigger**: Automatic on text selection (replaces right-click)
- **Design**: Dark theme with smooth animations
- **Positioning**: Smart positioning above/below selection, viewport-aware
- **Actions**: Two buttons - "Save Note" (quick save) and "+ Tags" (save with tags)

#### Benefits:
- More intuitive UX (no need to remember right-click)
- Faster workflow for frequent note-taking
- Visual consistency with popular tools like PopClip
- Better mobile compatibility (no right-click on touch)

---

## Storage Architecture

### Decision: Chrome Storage Local with Class-Based DAO

**Date**: 2025-08-25  
**Context**: MVP needs reliable local storage with future extensibility.

#### Implementation:
```javascript
class NotesStorage {
  constructor() {
    this.STORAGE_KEY = 'text_to_notes';
  }
  // CRUD operations using chrome.storage.local
}
```

#### Schema:
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

#### Rationale:
- **Local Storage**: No privacy concerns, works offline
- **DAO Pattern**: Easy to migrate to IndexedDB or cloud storage later
- **Simple Schema**: Covers MVP requirements while being extensible

---

## Extension Architecture

### Decision: MV3 with Modular Structure

**Date**: 2025-08-25  
**Context**: Chrome extension requirements and future-proofing.

#### Structure:
```
/extension
  ├─ manifest.json          # MV3 manifest
  ├─ background.js          # Service worker  
  ├─ content.js             # Selection popup logic
  ├─ notes/                 # UI components
  │   ├─ notes.html
  │   ├─ notes.css  
  │   └─ notes.js
  └─ lib/                   # Shared utilities
      ├─ storage.js
      └─ utils.js
```

#### Key Decisions:
- **Manifest V3**: Required for Chrome Web Store
- **Service Worker**: Event-driven background processing
- **Content Scripts**: Minimal injection for popup functionality
- **Modular Utilities**: Reusable across components

---

## UI/UX Design Patterns

### Decision: Compact Popup Design for Extension

**Date**: 2025-08-25  
**Context**: Extension popup needs to fit in small Chrome extension popup window.

#### Design Specifications:
- **Popup Size**: 400px width, 600px min-height
- **Layout**: Vertical stack with compact spacing
- **Typography**: 13-14px font sizes for density
- **Actions**: Always-visible action buttons (no hover-only)

#### Responsive Strategy:
- Mobile-first approach for small screens
- Flexible containers with minimum widths
- Stack controls vertically when space is limited

---

## Notes

- All decisions are documented with rationale for future reference
- Breaking changes should be logged here with migration notes
- Performance implications should be noted for significant changes