let selectionPopup = null;
let selectionTimeout = null;
let lastSelection = '';
let lastMousePosition = { x: 0, y: 0 };

// Theme support for content script
async function applyTheme() {
  try {
    const result = await chrome.storage.local.get('app_theme');
    const theme = result.app_theme || 'light';
    
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--dialog-bg', '#1e293b');
      root.style.setProperty('--dialog-text', '#f8fafc');
      root.style.setProperty('--dialog-text-secondary', '#cbd5e1');
      root.style.setProperty('--dialog-border', '#334155');
      root.style.setProperty('--dialog-preview-bg', '#334155');
      root.style.setProperty('--dialog-shadow', 'rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--dialog-accent', '#3b82f6');
      root.style.setProperty('--dialog-placeholder', '#94a3b8');
      root.style.setProperty('--dialog-chip-bg', '#374151');
      root.style.setProperty('--dialog-chip-text', '#60a5fa');
      root.style.setProperty('--dialog-chip-border', '#4b5563');
    } else {
      root.style.setProperty('--dialog-bg', 'white');
      root.style.setProperty('--dialog-text', '#1f2937');
      root.style.setProperty('--dialog-text-secondary', '#6b7280');
      root.style.setProperty('--dialog-border', '#e5e7eb');
      root.style.setProperty('--dialog-preview-bg', '#f9fafb');
      root.style.setProperty('--dialog-shadow', 'rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--dialog-accent', '#3b82f6');
      root.style.setProperty('--dialog-placeholder', '#9ca3af');
      root.style.setProperty('--dialog-chip-bg', '#eff6ff');
      root.style.setProperty('--dialog-chip-text', '#1d4ed8');
      root.style.setProperty('--dialog-chip-border', '#bfdbfe');
    }
  } catch (error) {
    console.error('Error applying theme:', error);
  }
}

// Initialize theme on content script load
applyTheme();

function createSelectionPopup() {
  if (selectionPopup) return selectionPopup;

  selectionPopup = document.createElement('div');
  selectionPopup.id = 'text-to-notes-popup';
  selectionPopup.innerHTML = `
    <div class="popup-content">
      <button class="save-note-btn" title="Save as note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17,21 17,13 7,13 7,21"></polyline>
          <polyline points="7,3 7,8 15,8"></polyline>
        </svg>
        <span>Save Note</span>
      </button>
      <button class="save-with-tags-btn" title="Save with tags">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span>+ Tags</span>
      </button>
    </div>
  `;

  document.body.appendChild(selectionPopup);

  selectionPopup.querySelector('.save-note-btn').addEventListener('click', handleSaveNote);
  selectionPopup.querySelector('.save-with-tags-btn').addEventListener('click', handleSaveWithTags);

  return selectionPopup;
}

function showSelectionPopup() {
  const selection = window.getSelection();
  if (!selection.rangeCount || !isValidSelection()) {
    hideSelectionPopup();
    return;
  }

  const popup = createSelectionPopup();

  // Use the stored mouse position for consistent placement
  if (lastMousePosition.x > 0 && lastMousePosition.y > 0) {
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Position popup above mouse to avoid covering selected text
    let top = lastMousePosition.y + scrollY - popupRect.height - 15; // 15px gap above mouse
    let left = lastMousePosition.x + scrollX - (popupRect.width / 2);

    // If popup would be above viewport, show below mouse (but try to avoid this)
    if (top < scrollY + 10) {
      top = lastMousePosition.y + scrollY + 15; // 15px below mouse as fallback
    }

    // Keep popup within viewport horizontally
    if (left < scrollX) {
      left = scrollX + 8;
    } else if (left + popupRect.width > scrollX + viewportWidth) {
      left = scrollX + viewportWidth - popupRect.width - 8;
    }

    popup.style.display = 'block';
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  } else {
    // Fallback to selection-based positioning
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    popup.style.display = 'block';
    popup.style.top = `${rect.top + scrollY - 50}px`;
    popup.style.left = `${rect.left + scrollX}px`;
  }
  
  popup.style.opacity = '0';
  popup.style.transform = 'translateY(-10px) scale(0.95)';
  
  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0) scale(1)';
  });
}

function hideSelectionPopup() {
  if (selectionPopup) {
    selectionPopup.style.display = 'none';
  }
}

function isValidSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText) return false;
  if (selectedText.length < 2) return false;
  if (selectedText.length > 10000) return false;
  
  // More lenient patterns - only reject obvious non-content
  const invalidPatterns = [
    /^[\s\n\r\t]*$/,          // Only whitespace
    /^[^\p{L}\p{N}\s]*$/u,    // Only punctuation (no letters or numbers, Unicode-aware)
    /^\.+$|^\?+$|^!+$/        // Only dots, question marks, or exclamation marks
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(selectedText));
}

async function handleSaveNote() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText) return;

  try {
    if (!chrome || !chrome.runtime) {
      showError('Extension context invalid - please reload page');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'saveNote',
      data: {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        tags: ''
      }
    });

    if (response && response.success) {
      showSaveConfirmation();
      hideSelectionPopup();
      selection.removeAllRanges();
    } else {
      showError('Failed to save note');
    }
  } catch (error) {
    console.error('Error saving note:', error);
    if (error.message.includes('Extension context invalidated')) {
      showError('Extension reloaded - please refresh page');
    } else {
      showError('Failed to save note');
    }
  }
}

function handleSaveWithTags() {
  try {
    const selection = window.getSelection();
    if (!selection) {
      console.warn('Text-to-Notes: No selection available for tags dialog');
      return;
    }

    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      console.warn('Text-to-Notes: No selected text for tags dialog');
      return;
    }

    console.log('Text-to-Notes: Opening tags dialog for text:', selectedText.substring(0, 50) + '...');
    showTagsDialog(selectedText);
  } catch (error) {
    console.error('Text-to-Notes: Error in handleSaveWithTags:', error);
    // Fallback to simple save
    handleSaveNote();
  }
}

function showTagsDialog(selectedText) {
  try {
    console.log('Text-to-Notes: showTagsDialog called with text:', selectedText);
    
    // Apply current theme before showing dialog
    applyTheme();
    
    const existingDialog = document.getElementById('tags-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Verify document body exists
    if (!document.body) {
      console.error('Text-to-Notes: document.body not available');
      return;
    }

    // Get current selection position
    const selection = window.getSelection();
    let selectionRect = null;
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        selectionRect = range.getBoundingClientRect();
      } catch (rangeError) {
        console.warn('Text-to-Notes: Could not get selection rectangle:', rangeError);
      }
    }

  const dialog = document.createElement('div');
  dialog.id = 'tags-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <h3>Save Note with Tags</h3>
        <div class="note-preview">${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}</div>
        <div id="tags-container"></div>
        <div class="dialog-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="save-btn">Save Note</button>
        </div>
      </div>
    </div>
  `;

    try {
      document.body.appendChild(dialog);
      console.log('Text-to-Notes: Dialog added to DOM successfully');
    } catch (appendError) {
      console.error('Text-to-Notes: Failed to append dialog to body:', appendError);
      return;
    }

    // Position dialog near the last mouse position
    try {
      const dialogContent = dialog.querySelector('.dialog-content');
      
      if (dialogContent && lastMousePosition.x > 0 && lastMousePosition.y > 0) {
        console.log('Text-to-Notes: Positioning dialog near mouse position:', lastMousePosition);
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Position dialog near mouse position, offset to avoid covering the selection
        let left = lastMousePosition.x - 200; // 200px = half dialog width, center on mouse
        let top = lastMousePosition.y + 20; // 20px below mouse to avoid covering selection
        
        // Adjust if dialog would go off-screen horizontally
        if (left < 20) {
          left = 20;
        } else if (left + 400 > viewportWidth - 20) {
          left = viewportWidth - 420;
        }
        
        // Adjust if dialog would go off-screen vertically
        if (top + 350 > viewportHeight - 20) { // 350px = approx dialog height
          top = lastMousePosition.y - 370; // Show above mouse
          if (top < 20) {
            top = 20; // Fallback to top of viewport
          }
        }
        
        // Apply positioning
        dialogContent.style.position = 'fixed';
        dialogContent.style.left = `${left}px`;
        dialogContent.style.top = `${top}px`;
        dialogContent.style.margin = '0';
        
        // Remove centering from the main dialog
        dialog.style.alignItems = 'flex-start';
        dialog.style.justifyContent = 'flex-start';
        
        console.log('Text-to-Notes: Dialog positioned at:', { left, top });
      } else {
        console.log('Text-to-Notes: Using default centered positioning');
      }
    } catch (positionError) {
      console.warn('Text-to-Notes: Error positioning dialog near mouse:', positionError);
    }

  const tagsContainer = dialog.querySelector('#tags-container');
  const saveBtn = dialog.querySelector('.save-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  
  try {
    // Initialize tag input component
    console.log('Text-to-Notes: Initializing TagInput component');
    const tagInput = new TagInput(tagsContainer, {
      placeholder: 'Add tags...',
      showRecentTags: true,
      recentTagsLimit: 3,
      onTagsChange: (tags) => {
        dialog._currentTags = tags;
      }
    });

    // Store references for global access
    dialog._tagInput = tagInput;
    dialog._currentTags = [];

    console.log('Text-to-Notes: TagInput component initialized successfully');
    tagInput.focus();
  } catch (error) {
    console.error('Text-to-Notes: Error initializing TagInput:', error);
    
    // Fallback: create a simple input
    tagsContainer.innerHTML = `
      <div class="tag-input-container">
        <input type="text" class="tag-input" placeholder="Add tags..." />
      </div>
    `;
    
    const fallbackInput = tagsContainer.querySelector('.tag-input');
    fallbackInput.focus();
    
    // Store fallback reference
    dialog._tagInput = {
      getTags: () => {
        const value = fallbackInput.value.trim();
        return value ? value.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
      }
    };
  }

  saveBtn.addEventListener('click', async () => {
    const currentTags = dialog._tagInput.getTags();
    const tagsString = currentTags.join(', ');
    
    try {
      if (!chrome || !chrome.runtime) {
        showError('Extension context invalid - please reload page');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'saveNote',
        data: {
          text: selectedText,
          url: window.location.href,
          title: document.title,
          tags: tagsString
        }
      });

      if (response && response.success) {
        showSaveConfirmation();
        dialog.remove();
        hideSelectionPopup();
        window.getSelection().removeAllRanges();
      } else {
        showError('Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      if (error.message.includes('Extension context invalidated')) {
        showError('Extension reloaded - please refresh page');
      } else {
        showError('Failed to save note');
      }
    }
  });

  cancelBtn.addEventListener('click', () => {
    dialog.remove();
  });

  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (dialog.parentNode) {
      if (e.key === 'Enter' && (e.target.classList.contains('tag-input'))) {
        e.preventDefault();
        saveBtn.click();
      } else if (e.key === 'Escape') {
        dialog.remove();
      }
    }
  });

    console.log('Text-to-Notes: Tags dialog setup complete');

  } catch (error) {
    console.error('Text-to-Notes: Error in showTagsDialog:', error);
    // Fallback: try simple save instead
    try {
      handleSaveNote();
    } catch (fallbackError) {
      console.error('Text-to-Notes: Fallback save also failed:', fallbackError);
      showError('Could not open tags dialog');
    }
  }
}

function showSaveConfirmation() {
  const confirmation = document.createElement('div');
  confirmation.className = 'save-confirmation';
  confirmation.innerHTML = `
    <div class="confirmation-content">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"></polyline>
      </svg>
      <span>Note saved!</span>
    </div>
  `;
  
  document.body.appendChild(confirmation);
  
  setTimeout(() => {
    confirmation.style.opacity = '0';
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.parentNode.removeChild(confirmation);
      }
    }, 300);
  }, 2000);
}

function showError(message) {
  const error = document.createElement('div');
  error.className = 'save-error';
  error.innerHTML = `
    <div class="error-content">
      <span>❌ ${message}</span>
    </div>
  `;
  
  document.body.appendChild(error);
  
  setTimeout(() => {
    error.style.opacity = '0';
    setTimeout(() => {
      if (error.parentNode) {
        error.parentNode.removeChild(error);
      }
    }, 300);
  }, 3000);
}

async function updateRecentTagsStorage(newTags) {
  // This function is now handled by the storage layer when notes are saved
  // The background script will automatically update tag statistics
  console.log('Text-to-Notes: Recent tags will be updated automatically by storage layer');
}

document.addEventListener('mouseup', (e) => {
  // Store mouse position for later use in dialog positioning
  lastMousePosition = { x: e.clientX, y: e.clientY };
  
  // Only show popup if Option/Alt key is held down
  if (!e.altKey) {
    hideSelectionPopup();
    return;
  }
  
  // Small delay to ensure selection has been finalized
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText === lastSelection) return;
    lastSelection = selectedText;
    
    if (selectedText && isValidSelection()) {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        showSelectionPopup();
      }, 100); // Reduced delay since we're already after mouseup
    } else {
      hideSelectionPopup();
    }
  }, 50); // Small delay to let selection settle
});

// Keep selectionchange for cleanup when selection is cleared
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  // Only hide if selection is actually cleared
  if (!selectedText) {
    clearTimeout(selectionTimeout);
    hideSelectionPopup();
    lastSelection = '';
  }
});

document.addEventListener('mousedown', (e) => {
  if (selectionPopup && !selectionPopup.contains(e.target)) {
    const tagsDialog = document.getElementById('tags-dialog');
    if (!tagsDialog || !tagsDialog.contains(e.target)) {
      hideSelectionPopup();
    }
  }
});

document.addEventListener('scroll', () => {
  hideSelectionPopup();
});

document.addEventListener('resize', () => {
  hideSelectionPopup();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectionInfo') {
    try {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (!selectedText) {
        sendResponse({ 
          success: false, 
          error: 'No text selected' 
        });
        return;
      }

      const selectionInfo = {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        timestamp: new Date().toISOString()
      };

      sendResponse({ 
        success: true, 
        data: selectionInfo 
      });

    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }
});

const style = document.createElement('style');
style.textContent = `
#text-to-notes-popup {
  position: absolute;
  z-index: 10000;
  display: none;
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

#text-to-notes-popup * {
  pointer-events: auto;
}

.popup-content {
  background: #1f2937;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  gap: 4px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.popup-content button {
  background: transparent;
  border: none;
  color: #f9fafb;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.popup-content button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.popup-content button:active {
  transform: translateY(0);
}

.popup-content button svg {
  flex-shrink: 0;
}

#tags-dialog {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 2147483647 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  pointer-events: auto !important;
}

.dialog-overlay {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(4px) !important;
  pointer-events: auto !important;
}

.dialog-content {
  background: var(--dialog-bg, white) !important;
  border-radius: 12px !important;
  padding: 20px !important;
  box-shadow: 0 20px 25px -5px var(--dialog-shadow, rgba(0, 0, 0, 0.1)) !important;
  width: 90% !important;
  max-width: 400px !important;
  position: relative !important;
  z-index: 2 !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  transition: background-color 0.3s ease !important;
}

.dialog-content h3 {
  margin: 0 0 12px 0 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: var(--dialog-text, #1f2937) !important;
  display: block !important;
  visibility: visible !important;
}

.note-preview {
  background: var(--dialog-preview-bg, #f9fafb);
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--dialog-text-secondary, #6b7280);
  margin-bottom: 16px;
  border-left: 3px solid var(--dialog-border, #e5e7eb);
  transition: background-color 0.3s ease;
}

.tag-input-container {
  border: 2px solid var(--dialog-border, #e5e7eb);
  border-radius: 6px;
  background: var(--dialog-bg, white);
  transition: border-color 0.3s ease, background-color 0.3s ease;
  padding: 8px;
  margin-bottom: 12px;
  min-height: 44px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  transition: border-color 0.2s;
}

.tag-input-container:focus-within {
  border-color: var(--dialog-accent, #3b82f6);
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  background: var(--dialog-chip-bg, #eff6ff);
  color: var(--dialog-chip-text, #1d4ed8);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--dialog-chip-border, #bfdbfe);
  gap: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.tag-remove {
  background: none;
  border: none;
  color: #6366f1;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
}

.tag-remove:hover {
  background: rgba(99, 102, 241, 0.1);
}

.tag-input {
  flex: 1;
  min-width: 120px;
  border: none;
  outline: none;
  padding: 4px;
  font-size: 14px;
  background: transparent;
  color: var(--dialog-text, #1f2937);
}

.tag-input::placeholder {
  color: var(--dialog-placeholder, #9ca3af);
}

#tags-input {
  flex: 1;
  min-width: 120px;
  border: none;
  outline: none;
  padding: 4px;
  font-size: 14px;
  background: transparent;
  color: var(--dialog-text, #1f2937);
  background: transparent;
}

#tags-input::placeholder {
  color: #9ca3af;
}

.recent-tags {
  margin-bottom: 16px;
}

.recent-tags-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  font-weight: 500;
}

.recent-tags-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.recent-tag-btn {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #374151;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.recent-tag-btn:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.dialog-actions button {
  padding: 8px 16px !important;
  border: none !important;
  border-radius: 6px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  display: inline-block !important;
  visibility: visible !important;
}

.cancel-btn {
  background: #f3f4f6;
  color: #6b7280;
}

.cancel-btn:hover {
  background: #e5e7eb;
}

.save-btn {
  background: #3b82f6;
  color: white;
}

.save-btn:hover {
  background: #2563eb;
}

.save-confirmation,
.save-error {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10002;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.confirmation-content,
.error-content {
  background: #10b981;
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.save-error .error-content {
  background: #ef4444;
}
`;

// Only initialize if we have the required APIs and DOM
if (typeof chrome !== 'undefined' && chrome.runtime && document.body) {
  document.head.appendChild(style);
  console.log('Text-to-Notes: Extension initialized successfully');
} else {
  console.warn('Text-to-Notes: Extension could not initialize - missing required APIs or DOM not ready');
  
  // Try again when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && document.body) {
        document.head.appendChild(style);
        console.log('Text-to-Notes: Extension initialized after DOM ready');
      }
    });
  }
}