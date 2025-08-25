let selectionPopup = null;
let selectionTimeout = null;
let lastSelection = '';

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

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const popup = createSelectionPopup();

  const popupRect = popup.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let top = rect.top + scrollY - popupRect.height - 8;
  let left = rect.left + scrollX + (rect.width / 2) - (popupRect.width / 2);

  if (top < scrollY) {
    top = rect.bottom + scrollY + 8;
  }

  if (left < scrollX) {
    left = scrollX + 8;
  } else if (left + popupRect.width > scrollX + viewportWidth) {
    left = scrollX + viewportWidth - popupRect.width - 8;
  }

  popup.style.display = 'block';
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  
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
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText) return;

  showTagsDialog(selectedText);
}

function showTagsDialog(selectedText) {
  const existingDialog = document.getElementById('tags-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Get current selection position
  const selection = window.getSelection();
  let selectionRect = null;
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    selectionRect = range.getBoundingClientRect();
  }

  const dialog = document.createElement('div');
  dialog.id = 'tags-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <h3>Save Note with Tags</h3>
        <div class="note-preview">${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}</div>
        <div class="tag-input-container">
          <div class="tag-chips" id="tag-chips"></div>
          <input type="text" id="tags-input" placeholder="Add tags..." />
        </div>
        <div class="recent-tags" id="recent-tags">
          <div class="recent-tags-label">Recent tags:</div>
          <div class="recent-tags-list" id="recent-tags-list"></div>
        </div>
        <div class="dialog-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="save-btn">Save Note</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Position dialog near the selection if available
  if (selectionRect) {
    const dialogContent = dialog.querySelector('.dialog-content');
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate initial position (centered on selection)
    let left = selectionRect.left + scrollX + (selectionRect.width / 2) - 200; // 200px = half dialog width
    let top = selectionRect.bottom + scrollY + 20; // 20px offset below selection
    
    // Adjust if dialog would go off-screen horizontally
    if (left < scrollX + 20) {
      left = scrollX + 20;
    } else if (left + 400 > scrollX + viewportWidth - 20) { // 400px = dialog width
      left = scrollX + viewportWidth - 420;
    }
    
    // Adjust if dialog would go off-screen vertically
    if (top + 300 > scrollY + viewportHeight - 20) { // 300px = approx dialog height
      top = selectionRect.top + scrollY - 320; // Show above selection
    }
    
    // Ensure dialog stays within viewport
    if (top < scrollY + 20) {
      top = scrollY + 20;
    }
    
    dialogContent.style.position = 'absolute';
    dialogContent.style.left = `${left}px`;
    dialogContent.style.top = `${top}px`;
    dialogContent.style.margin = '0';
    
    // Remove centering from overlay
    dialog.querySelector('.dialog-overlay').style.alignItems = 'flex-start';
    dialog.querySelector('.dialog-overlay').style.justifyContent = 'flex-start';
  }

  const tagsInput = dialog.querySelector('#tags-input');
  const tagChips = dialog.querySelector('#tag-chips');
  const recentTagsList = dialog.querySelector('#recent-tags-list');
  const saveBtn = dialog.querySelector('.save-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  
  let currentTags = [];

  // Store reference for global access
  dialog._currentTags = currentTags;

  // Load and display recent tags
  loadRecentTags(recentTagsList, currentTags);

  // Tag input handling
  tagsInput.addEventListener('input', () => {
    handleTagInput(tagsInput, tagChips, currentTags);
    updateRecentTagsDisplay(recentTagsList, currentTags);
    dialog._currentTags = currentTags;
  });

  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processCurrentInput(tagsInput, tagChips, currentTags);
      updateRecentTagsDisplay(recentTagsList, currentTags);
      dialog._currentTags = currentTags;
    } else if (e.key === 'Backspace' && tagsInput.value === '' && currentTags.length > 0) {
      // Remove last tag when backspacing on empty input
      removeTag(currentTags.length - 1, tagChips, currentTags);
      updateRecentTagsDisplay(recentTagsList, currentTags);
      dialog._currentTags = currentTags;
    }
  });

  tagsInput.focus();

  saveBtn.addEventListener('click', async () => {
    // Process any remaining input before saving
    processCurrentInput(tagsInput, tagChips, currentTags);
    
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
        // Update recent tags
        if (currentTags.length > 0) {
          updateRecentTagsStorage(currentTags);
        }
        
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

  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    } else if (e.key === 'Escape') {
      dialog.remove();
    }
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog.querySelector('.dialog-overlay')) {
      dialog.remove();
    }
  });
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

// Tag management functions
function handleTagInput(input, chipContainer, currentTags) {
  const value = input.value;
  const parts = value.split(',');
  
  if (parts.length > 1) {
    // User typed a comma, process all complete tags
    for (let i = 0; i < parts.length - 1; i++) {
      const tag = parts[i].trim().toLowerCase();
      if (tag && !currentTags.includes(tag)) {
        currentTags.push(tag);
      }
    }
    input.value = parts[parts.length - 1].trim();
    renderTagChips(chipContainer, currentTags);
  }
}

function processCurrentInput(input, chipContainer, currentTags) {
  const tag = input.value.trim().toLowerCase();
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag);
    input.value = '';
    renderTagChips(chipContainer, currentTags);
  }
}

function renderTagChips(container, tags) {
  container.innerHTML = tags.map((tag, index) => `
    <div class="tag-chip">
      <span class="tag-text">${tag}</span>
      <button class="tag-remove" data-index="${index}" type="button">×</button>
    </div>
  `).join('');
  
  // Add event listeners to remove buttons
  container.querySelectorAll('.tag-remove').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeTagHandler(index);
    });
  });
}

function removeTag(index, chipContainer, currentTags) {
  currentTags.splice(index, 1);
  renderTagChips(chipContainer, currentTags);
}

// Handler for removing tags
function removeTagHandler(index) {
  const dialog = document.getElementById('tags-dialog');
  if (dialog) {
    const chipContainer = dialog.querySelector('#tag-chips');
    const recentTagsList = dialog.querySelector('#recent-tags-list');
    const tagsInput = dialog.querySelector('#tags-input');
    
    // Get current tags from dialog
    let currentTags = dialog._currentTags || [];
    
    if (index >= 0 && index < currentTags.length) {
      currentTags.splice(index, 1);
      dialog._currentTags = currentTags;
      renderTagChips(chipContainer, currentTags);
      updateRecentTagsDisplay(recentTagsList, currentTags);
      
      // Focus input after removing tag
      if (tagsInput) {
        tagsInput.focus();
      }
    }
  }
}

// Keep the global function for backwards compatibility
window.removeTagByIndex = removeTagHandler;

async function loadRecentTags(container, currentTags) {
  try {
    // Check if chrome.storage is available
    if (!chrome || !chrome.storage) {
      console.warn('Chrome storage not available, using fallback tags');
      const fallbackTags = ['work', 'important', 'research'];
      updateRecentTagsDisplay(container, currentTags, fallbackTags);
      return;
    }

    const result = await chrome.storage.local.get('recent_tags');
    let recentTags = result.recent_tags || [];
    
    // If no recent tags exist, add some sample ones for testing
    if (recentTags.length === 0) {
      recentTags = ['work', 'important', 'research'];
      try {
        await chrome.storage.local.set({ recent_tags: recentTags });
      } catch (storageError) {
        console.warn('Could not save recent tags to storage:', storageError);
      }
    }
    
    updateRecentTagsDisplay(container, currentTags, recentTags);
  } catch (error) {
    console.warn('Error loading recent tags, using fallback:', error);
    // Use fallback tags when storage fails
    const fallbackTags = ['work', 'important', 'research'];
    updateRecentTagsDisplay(container, currentTags, fallbackTags);
  }
}

function updateRecentTagsDisplay(container, currentTags, recentTags = null) {
  if (!recentTags) {
    if (chrome && chrome.storage) {
      chrome.storage.local.get('recent_tags').then(result => {
        const recent = result.recent_tags || ['work', 'important', 'research'];
        renderRecentTags(container, recent, currentTags);
      }).catch(error => {
        console.warn('Could not load recent tags:', error);
        renderRecentTags(container, ['work', 'important', 'research'], currentTags);
      });
    } else {
      renderRecentTags(container, ['work', 'important', 'research'], currentTags);
    }
  } else {
    renderRecentTags(container, recentTags, currentTags);
  }
}

function renderRecentTags(container, recentTags, currentTags) {
  // Filter out tags that are already added
  const availableTags = recentTags.filter(tag => !currentTags.includes(tag)).slice(0, 3);
  
  if (availableTags.length === 0) {
    container.parentElement.style.display = 'none';
    return;
  }
  
  container.parentElement.style.display = 'block';
  container.innerHTML = availableTags.map((tag, index) => `
    <button class="recent-tag-btn" data-tag="${tag}" data-index="${index}" type="button">${tag}</button>
  `).join('');
  
  // Add event listeners to recent tag buttons
  container.querySelectorAll('.recent-tag-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const tag = e.target.dataset.tag;
      addRecentTagHandler(tag);
    });
  });
}

// Handler for adding recent tags
function addRecentTagHandler(tag) {
  const dialog = document.getElementById('tags-dialog');
  if (dialog) {
    const chipContainer = dialog.querySelector('#tag-chips');
    const recentTagsList = dialog.querySelector('#recent-tags-list');
    const tagsInput = dialog.querySelector('#tags-input');
    
    // Get current tags array from dialog
    let currentTags = dialog._currentTags || [];
    
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);
      dialog._currentTags = currentTags;
      renderTagChips(chipContainer, currentTags);
      updateRecentTagsDisplay(recentTagsList, currentTags);
      
      // Clear any text in input and focus it
      if (tagsInput) {
        tagsInput.value = '';
        tagsInput.focus();
      }
    }
  }
}

// Keep the global function for backwards compatibility
window.addRecentTag = addRecentTagHandler;

async function updateRecentTagsStorage(newTags) {
  try {
    if (!chrome || !chrome.storage) {
      console.warn('Chrome storage not available, cannot save recent tags');
      return;
    }

    const result = await chrome.storage.local.get('recent_tags');
    const recentTags = result.recent_tags || [];
    
    // Add new tags to the beginning, remove duplicates, keep only 3
    const updatedTags = [...new Set([...newTags, ...recentTags])].slice(0, 3);
    
    await chrome.storage.local.set({ recent_tags: updatedTags });
  } catch (error) {
    console.warn('Error updating recent tags:', error);
  }
}

document.addEventListener('selectionchange', () => {
  clearTimeout(selectionTimeout);
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText === lastSelection) return;
  lastSelection = selectedText;
  
  if (selectedText && isValidSelection()) {
    selectionTimeout = setTimeout(() => {
      showSelectionPopup();
    }, 300);
  } else {
    hideSelectionPopup();
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
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.dialog-content {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 400px;
  position: relative;
  z-index: 1;
}

.dialog-content h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.note-preview {
  background: #f9fafb;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 16px;
  border-left: 3px solid #e5e7eb;
}

.tag-input-container {
  border: 2px solid #e5e7eb;
  border-radius: 6px;
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
  border-color: #3b82f6;
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
  background: #eff6ff;
  color: #1d4ed8;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #bfdbfe;
  gap: 4px;
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

#tags-input {
  flex: 1;
  min-width: 120px;
  border: none;
  outline: none;
  padding: 4px;
  font-size: 14px;
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
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
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

document.head.appendChild(style);