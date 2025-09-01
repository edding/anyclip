# Technical Decisions Log

This document tracks key technical decisions made during the development of the Text-to-Notes Chrome extension with image clipping capabilities.

## Selection Popup Display Logic

### Decision: When to Show the PopClip-Style Popup

**Date**: 2025-08-25  
**Context**: Users reported that the popup sometimes doesn't appear when selecting text.

#### Current Implementation:
The popup appears when text is selected based on these conditions:

**Timing:**
- Triggered on `mouseup` event (when user finishes selecting)
- 50ms delay to let selection settle + 100ms debounce
- `selectionchange` used only for cleanup when selection is cleared
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
1. **Mouse-up trigger**: Only shows popup after user finishes selecting (more intuitive)
2. **Dual delay system**: 50ms for selection settling + 100ms debounce prevents premature popup
3. **Minimum 2 chars**: Single characters are rarely useful as notes
4. **Lenient validation**: Allow numbers, mixed content, and technical text which are common note-worthy selections
5. **Smart hiding**: Disappears when user scrolls or clicks elsewhere to avoid UI clutter

#### Previous Issues Resolved:
- **V1**: Too restrictive - rejected numbers and mixed punctuation
- **V2**: Fixed Unicode support - was rejecting Chinese/international text
- **V3**: Fixed popup timing - was showing during selection instead of after
- **V4**: Current implementation uses mouseup trigger and Unicode-aware regex (`\p{L}\p{N}`)

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

### Decision: Relational-Style Storage with Tag Management

**Date**: 2025-08-25  
**Context**: Need to support tag-centric operations like "view by tag", tag analytics, and tag management.

#### Database Schema:
```javascript
// Storage Keys
const STORAGE_KEYS = {
  NOTES: 'notes_collection',
  TAGS: 'tags_collection', 
  TAG_STATS: 'tag_statistics'
};

// Note Schema
{
  "id": "uuid",
  "text": "captured snippet",
  "url": "https://example.com/path",
  "title": "Example Page",
  "tags": ["tag1", "tag2"], // Denormalized for performance
  "created_at": "2025-08-24T10:00:00Z",
  "updated_at": "2025-08-24T10:00:00Z"
}

// Tag Schema (for tag management and analytics)
{
  "name": "work",
  "count": 15, // Number of notes with this tag
  "created_at": "2025-08-24T09:00:00Z",
  "last_used": "2025-08-24T10:00:00Z",
  "color": "#3b82f6" // Optional: for UI theming
}

// Tag Statistics (for insights and recent tags)
{
  "recent_tags": ["work", "important", "research"], // Last 10 used
  "popular_tags": ["work", "ideas", "todo"], // Top 10 by count
  "total_tags": 25,
  "total_notes": 150
}
```

#### Operations Supported:
- **Notes CRUD**: Create, read, update, delete notes
- **Tag Management**: Get all tags, tag statistics, rename tags
- **Tag Filtering**: Get notes by tag, get tags by frequency
- **Recent Tags**: Last used tags for quick access
- **Tag Analytics**: Usage patterns, popular tags

#### Rationale:
1. **Denormalized tags on notes**: Fast note retrieval and display
2. **Separate tag collection**: Enables tag management and analytics  
3. **Tag statistics**: Powers recent tags, popular tags, insights
4. **Future-ready**: Easy to add tag colors, descriptions, hierarchies

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

## Tag Input UX Enhancement

### Decision: Visual Tag Chips with Recent Tag Shortcuts

**Date**: 2025-08-25  
**Context**: Improve tag input experience with visual feedback and shortcuts.

#### Implementation Details:

**Tag Chip UI:**
- Convert comma-separated tags into visual "chips/blobs"
- Real-time parsing as user types
- Individual delete buttons on each chip
- Visual distinction between chips and text input

**Recent Tags Shortcuts:**
- Show 3 most recently used tags below input
- Clickable shortcuts to add tags quickly  
- Smart deduplication (don't show if already added)
- Stored in chrome.storage.local under 'recent_tags' key

**Technical Implementation:**
```javascript
// Tag storage format
recentTags: ["work", "important", "research"] // Max 3, most recent first

// Real-time tag parsing
onTagInputChange() {
  const tags = parseTagsInput(input.value);
  renderTagChips(tags);
  updateRecentTagShortcuts(tags);
}
```

#### Rationale:
1. **Visual Feedback**: Users see tags as they type, reducing errors
2. **Shortcuts**: Frequently used tags are easily accessible
3. **Modern UX**: Matches familiar tag interfaces (GitHub, Notion, etc.)
4. **Efficiency**: Reduces typing for common tags

#### Storage Strategy:
- Recent tags stored separately from notes
- Updated whenever a note is saved with tags
- Maintains chronological order (most recent first)
- Limited to 3 items to avoid UI clutter

---

## Image Clipping Architecture

### Decision: Three-Tier CORS Handling System

**Date**: 2025-09-01  
**Context**: Need to capture images from web pages while respecting cross-origin policies.

#### Implementation Strategy:

**Tier 1: Direct Canvas Conversion**
```javascript
// Same-origin images - direct base64 conversion
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = image.naturalWidth;
canvas.height = image.naturalHeight;
ctx.drawImage(image, 0, 0);
const base64 = canvas.toDataURL('image/png');
```

**Tier 2: CORS Retry**
```javascript
// Cross-origin with CORS support
const corsImage = new Image();
corsImage.crossOrigin = 'anonymous';
corsImage.onload = () => {
  // Retry canvas conversion with CORS-enabled image
  const base64 = convertToBase64(corsImage);
};
corsImage.src = originalImage.src;
```

**Tier 3: URL Fallback**
```javascript
// CORS-blocked images - store URL reference
const imageNote = {
  type: 'image_url',
  imageUrl: originalImage.src,
  imageData: null, // No base64 available
  imageMetadata: extractMetadata(originalImage)
};
```

#### Rationale:
1. **Maximum compatibility**: Works across all website configurations
2. **Privacy-respecting**: Follows browser security policies
3. **Performance-optimized**: Base64 storage for offline access when possible
4. **Graceful degradation**: Always captures something useful

#### Storage Schema:
```javascript
// Base64 storage (Tier 1 & 2)
{
  "type": "image",
  "imageData": "data:image/png;base64,iVBOR...",
  "imageUrl": null
}

// URL fallback (Tier 3)
{
  "type": "image_url", 
  "imageData": null,
  "imageUrl": "https://example.com/image.jpg"
}
```

---

## PopClip-Style Image Capture UX

### Decision: Hover-Based Image Popup System

**Date**: 2025-09-01  
**Context**: Need intuitive image capture that doesn't interfere with normal browsing.

#### Implementation Details:

**Hover Detection:**
- Mouse enter on `<img>` elements triggers popup after 300ms delay
- Popup positioned above image with viewport-aware placement
- Mouse leave from image or popup area triggers fade-out with 500ms delay

**Smart Positioning:**
```javascript
function positionImagePopup(imageElement, popup) {
  const rect = imageElement.getBoundingClientRect();
  const popupHeight = 45;
  const margin = 8;
  
  // Prefer above image, fall back to below if no space
  if (rect.top > popupHeight + margin) {
    popup.style.top = `${rect.top - popupHeight - margin}px`;
  } else {
    popup.style.top = `${rect.bottom + margin}px`;
  }
  
  // Center horizontally on image
  popup.style.left = `${rect.left + rect.width/2 - popup.offsetWidth/2}px`;
}
```

**UI Design:**
- Dark theme matching text selection popup
- "Save Image" button and optional "+ Tags" 
- Smooth fade in/out animations (200ms)
- High z-index (2147483647) to appear above all content

#### Rationale:
1. **Non-disruptive**: Only appears on intentional hover
2. **Consistent UX**: Matches text selection popup design
3. **Accessible**: Works without requiring clicks or keyboard shortcuts
4. **Performance**: Minimal DOM impact, event delegation

---

## Image Metadata Preservation

### Decision: Comprehensive Metadata Capture

**Date**: 2025-09-01  
**Context**: Preserve context and enable future search/organization features.

#### Metadata Schema:
```javascript
imageMetadata: {
  width: image.naturalWidth || image.width,
  height: image.naturalHeight || image.height,
  size: base64Data ? base64Data.length : null,
  format: 'png', // Always PNG for canvas conversion
  originalSrc: image.src,
  alt: image.alt || image.title || '',
  loading: image.loading, // lazy/eager/auto
  className: image.className,
  id: image.id
}
```

#### Benefits:
1. **Search capability**: Find images by dimensions, alt text
2. **Organization**: Group by format, size ranges
3. **Context preservation**: Original source and descriptive text
4. **Performance insights**: Track lazy-loaded images
5. **Future features**: Enable advanced filtering and analytics

---

## Mixed Content Display Strategy

### Decision: Unified Note Rendering System

**Date**: 2025-09-01  
**Context**: Support both text and image notes in consistent UI.

#### Implementation:

**Content Type Detection:**
```javascript
function isImageNote(note) {
  return note.type === 'image' || note.type === 'image_url' || 
         (note.imageData || note.imageUrl);
}

function renderNoteContent(note) {
  if (isImageNote(note)) {
    return renderImageContent(note);
  }
  return renderTextContent(note);
}
```

**Image Display:**
```javascript
function renderImageContent(note) {
  const imageSrc = note.imageData || note.imageUrl;
  return `
    <div class="note-image-container">
      <img src="${imageSrc}" 
           alt="${escapeHtml(note.imageMetadata?.alt || 'Saved image')}"
           class="note-image" 
           loading="lazy">
    </div>
    ${note.text ? `<p class="note-text">${escapeHtml(note.text)}</p>` : ''}
  `;
}
```

**CSS Styling:**
```css
.note-image-container {
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
}

.note-image {
  width: 100%;
  height: auto;
  max-height: 200px;
  object-fit: cover;
  display: block;
}
```

#### Rationale:
1. **Consistent design**: Images follow same visual patterns as text
2. **Performance**: Lazy loading prevents initial load slowdown
3. **Responsive**: Images scale appropriately in different layouts  
4. **Accessibility**: Proper alt text and semantic markup

---

## Notes

- All decisions are documented with rationale for future reference
- Breaking changes should be logged here with migration notes
- Performance implications should be noted for significant changes
- Image-related decisions focus on browser compatibility and user privacy