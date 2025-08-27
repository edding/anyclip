# Text-to-Notes Chrome Extension

## Project Overview
A Chrome extension that allows users to select text on any web page and save it as notes with advanced tag management. Features both a popup interface and a full-page notes manager for comprehensive note organization.

## Architecture
- **Manifest Version:** MV3
- **Background Service Worker:** Handles API requests and orchestrates data flow
- **Content Script:** PopClip-style text selection with mouse-based positioning
- **Popup Interface:** Quick notes overview with basic management
- **Full-Page Manager:** Comprehensive notes management with advanced features
- **Storage:** Relational-style storage with separate collections for scalability

## Directory Structure
```
/extension
  ├─ manifest.json
  ├─ background.js         # service worker + API handlers
  ├─ content.js            # PopClip-style selection + tag dialog
  ├─ notes/
  │   ├─ notes.html        # popup interface
  │   ├─ notes.css         # popup styles
  │   ├─ notes.js          # popup logic
  │   ├─ manage.html       # full-page manager
  │   ├─ manage.css        # full-page styles
  │   └─ manage.js         # full-page logic
  └─ lib/
      ├─ storage.js        # relational storage with tag management
      └─ utils.js          # helpers + reusable TagInput component
```

## Data Architecture

### Note Schema
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

### Storage Collections
```javascript
// Separate collections for relational-style storage
STORAGE_KEYS = {
  NOTES: 'notes_collection',      // Note data with denormalized tags
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

### Text Selection & Clipping
1. **Mouse-up trigger**: Popup appears above cursor after text selection
2. **PopClip-style interface**: "Save Note" and "+ Tags" buttons
3. **Tag dialog**: Visual tag chips with recent tags shortcuts
4. **Mouse-position based**: All UI appears near cursor for natural flow

### Tag Input Experience (Consistent Across Interfaces)
- **Visual tag chips** with individual remove buttons
- **Comma parsing**: Type "work, important" → creates both tags
- **Recent tags shortcuts**: Click to add frequently used tags
- **Keyboard shortcuts**: Enter to add, Backspace to remove
- **Duplicate prevention**: Same tag can't be added twice

## Key Features

### Core Functionality
1. **PopClip-Style Text Capture**: Mouse-up triggered selection popup
2. **Advanced Tag Management**: Visual chips, recent tags, tag statistics
3. **Dual Interface**: Popup for quick access + full-page for management
4. **Smart Positioning**: Mouse-position based UI placement
5. **Unicode Support**: Works with Chinese, Japanese, Arabic text

### Popup Interface (`notes.html`)
- **Quick overview**: Recent notes with tag filtering
- **Basic management**: Edit, delete, search functionality
- **Tag filtering**: Click tags to filter notes
- **"Manage" button**: Navigate to full-page interface

### Full-Page Manager (`manage.html`)
- **Professional dashboard**: Header, sidebar, main content layout
- **Advanced filtering**: By date, tags, search terms combined
- **Bulk operations**: Select multiple notes for batch actions
- **Import/Export**: JSON format with full data preservation
- **Multiple views**: Grid/list modes, recent/untagged filters
- **Tag browser**: Sidebar with searchable tag list and usage counts

### Advanced Features
- **Bulk tagging**: Add tags to multiple notes at once
- **Export options**: All notes or selected notes to JSON
- **Import support**: Restore from JSON backup with validation
- **Keyboard shortcuts**: Ctrl+A to select all, Delete for bulk delete
- **Responsive design**: Works on desktop and mobile
- **Error handling**: Graceful fallbacks and user feedback

## Performance Optimizations
- **Debounced search**: 300ms delay to reduce API calls
- **Cached tag data**: Recent tags cached during dialog sessions
- **Efficient rendering**: Only render visible notes
- **Background processing**: Tag statistics updated asynchronously

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
- **Image support**: Schema supports adding image metadata
- **Cross-device sync**: Normalized tag collections enable efficient sync
- **Scalable**: Clean separation supports large note collections
- **Analytics ready**: Built-in usage tracking for insights

## Browser Compatibility
- **Chrome MV3**: Primary target with full feature support
- **Content Security Policy**: Handles strict CSP websites
- **Unicode support**: Works with international text
- **High z-index**: UI appears above all website elements

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