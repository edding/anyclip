# Text-to-Notes Chrome Extension

## Project Overview
A Chrome extension that allows users to select text and capture images on any web page and save them as notes with advanced tag management. Features both a popup interface and a full-page notes manager for comprehensive note organization with support for both text and image content.

## Architecture
- **Manifest Version:** MV3
- **Background Service Worker:** Handles API requests and orchestrates data flow
- **Content Script:** PopClip-style text selection and image capture with mouse-based positioning
- **Popup Interface:** Quick notes overview with basic management
- **Full-Page Manager:** Comprehensive notes management with advanced features
- **Storage:** Relational-style storage with separate collections for scalability

## Directory Structure
```
/extension
  ├─ manifest.json
  ├─ background.js         # service worker + API handlers
  ├─ content.js            # PopClip-style text/image capture + tag dialog
  ├─ notes/
  │   ├─ notes.html        # popup interface
  │   ├─ notes.css         # popup styles
  │   ├─ notes.js          # popup logic
  │   ├─ manage.html       # full-page manager
  │   ├─ manage.css        # full-page styles
  │   └─ manage.js         # full-page logic
  └─ lib/
      ├─ storage.js        # relational storage with tag + image management
      └─ utils.js          # helpers + reusable TagInput component
```

## Data Architecture

### Note Schema
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

// Image Note
{
  "id": "uuid",
  "type": "image",
  "imageData": "data:image/png;base64,iVBOR...", // or null for CORS fallback
  "imageUrl": "https://example.com/image.jpg", // fallback for cross-origin
  "imageMetadata": {
    "width": 800,
    "height": 600,
    "size": 45000,
    "format": "png",
    "originalSrc": "https://example.com/original.jpg",
    "alt": "Image description"
  },
  "text": "optional caption",
  "url": "https://example.com/path",
  "title": "Example Page",
  "tags": ["tag1", "tag2"],
  "created_at": "2025-08-24T10:00:00Z"
}
```

### Storage Collections
```javascript
// Separate collections for relational-style storage
STORAGE_KEYS = {
  NOTES: 'notes_collection',      // Note data with denormalized tags (text + images)
  TAGS: 'tags_collection',        // Tag metadata and statistics  
  TAG_STATS: 'tag_statistics'     // Recent/popular tag tracking
}
```

### Tag Management Schema
```json
{
  "tagName": {
    "count": 5,
    "created_at": "2025-08-24T10:00:00Z",
    "last_used": "2025-08-25T15:30:00Z",
    "color": "#3b82f6"
  }
}
```

## Permissions Required
- `storage`: Save notes and tags locally
- `scripting`: Inject content script for text selection
- `activeTab`: Access active tab for metadata
- `tabs`: Open full-page manager in new tab

## User Interaction Flow

### Text Selection & Image Clipping
1. **Text Selection**: Option+Mouse-up trigger shows popup with "Save Note" and "+ Tags" buttons
2. **Image Capture**: Hover over images to show capture popup with save options
3. **PopClip-style interface**: Contextual UI appears near mouse cursor
4. **Tag dialog**: Visual tag chips with recent tags shortcuts for both text and images
5. **Mouse-position based**: All UI appears near cursor for natural flow
6. **CORS handling**: Automatic fallback for cross-origin images (base64 → URL storage)

### Image Capture System
1. **Hover Detection**: Images become interactive on mouse hover
2. **Popup Positioning**: Save popup appears above hovered image
3. **Three-tier Storage**:
   - **Primary**: Canvas-based base64 encoding for same-origin images
   - **Secondary**: CORS retry with `crossOrigin="anonymous"` attribute
   - **Fallback**: URL storage for cross-origin images when base64 fails
4. **Smart UI**: Popup disappears when mouse moves away from image area
5. **Tag Integration**: Same tag system works for both text and image content
6. **Metadata Capture**: Preserves image dimensions, format, alt text, and source URL

### Tag Input Experience (Consistent Across Interfaces)
- **Visual tag chips** with individual remove buttons
- **Comma parsing**: Type "work, important" → creates both tags
- **Recent tags shortcuts**: Click to add frequently used tags
- **Keyboard shortcuts**: Enter to add, Backspace to remove
- **Duplicate prevention**: Same tag can't be added twice

## Key Features

### Core Functionality
1. **PopClip-Style Content Capture**: Text selection and image hover capture
2. **Advanced Tag Management**: Visual chips, recent tags, tag statistics
3. **Dual Interface**: Popup for quick access + full-page for management
4. **Smart Positioning**: Mouse-position based UI placement
5. **Unicode Support**: Works with Chinese, Japanese, Arabic text
6. **Image Processing**: Base64 encoding with CORS fallback to URL storage

### Popup Interface (`notes.html`)
- **Quick overview**: Recent notes with tag filtering
- **Basic management**: Edit, delete, search functionality
- **Mixed content**: Displays both text and image notes
- **Tag filtering**: Click tags to filter notes
- **"Manage" button**: Navigate to full-page interface

### Full-Page Manager (`manage.html`)
- **Professional dashboard**: Header, sidebar, main content layout
- **Advanced filtering**: By date, tags, search terms combined
- **Content type filtering**: All/Recent/Images/Untagged navigation views
- **Bulk operations**: Select multiple notes for batch actions
- **Import/Export**: JSON format with full data preservation
- **Multiple views**: Grid/list modes with image thumbnails
- **Tag browser**: Sidebar with searchable tag list and usage counts

### Advanced Features
- **Bulk tagging**: Add tags to multiple notes at once
- **Export options**: All notes or selected notes to JSON (including image data)
- **Import support**: Restore from JSON backup with validation
- **Keyboard shortcuts**: Ctrl+A to select all, Delete for bulk delete
- **Responsive design**: Works on desktop and mobile
- **Error handling**: Graceful fallbacks and user feedback
- **Image optimization**: Lazy loading and responsive display

## Performance Optimizations
- **Debounced search**: 300ms delay to reduce API calls
- **Cached tag data**: Recent tags cached during dialog sessions
- **Efficient rendering**: Only render visible notes
- **Background processing**: Tag statistics updated asynchronously
- **Image optimization**: Lazy loading for images and base64 caching
- **CORS handling**: Smart fallback prevents blocking on cross-origin images

## Development Commands
```bash
# Development
# Load unpacked extension in Chrome for manual testing:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" 
# 4. Select /extension folder

# No build process required - direct Chrome extension loading
```

## Storage Architecture Benefits

### Current Implementation
- **Relational design**: Separate collections for notes, tags, statistics
- **Tag analytics**: Track usage patterns and recent tags
- **Performance optimized**: Denormalized tags on notes for fast display
- **Consistent experience**: Same tag input across all interfaces

### Future-Ready Design
- **Multi-media support**: Full image support with base64/URL dual storage
- **Cross-device sync**: Normalized tag collections enable efficient sync
- **Scalable**: Clean separation supports large note collections with media
- **Analytics ready**: Built-in usage tracking for insights

## Browser Compatibility
- **Chrome MV3**: Primary target with full feature support
- **Content Security Policy**: Handles strict CSP websites
- **Unicode support**: Works with international text
- **High z-index**: UI appears above all website elements
- **CORS compliance**: Respects cross-origin policies with graceful fallbacks

## Privacy & Security
- **Local storage only**: All data remains on user's device
- **No external calls**: No analytics or telemetry
- **Minimal permissions**: Only essential Chrome APIs
- **No data collection**: User privacy fully protected
- **Content script isolation**: Secure injection on all websites

## Technical Highlights
- **Reusable components**: TagInput class shared across interfaces  
- **Error boundaries**: Graceful degradation on component failures
- **Consistent UX**: Same interaction patterns throughout
- **Mouse-based positioning**: Natural UI placement based on user actions
- **Comprehensive tag management**: Full CRUD operations with statistics
- **Advanced image handling**: Canvas-based capture with CORS fallback system
- **Dual storage strategy**: Base64 for same-origin, URL for cross-origin images
- **PopClip-inspired UX**: Hover-triggered image capture with smart positioning