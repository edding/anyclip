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
    const response = await chrome.runtime.sendMessage({
      action: 'saveNote',
      data: {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        tags: ''
      }
    });

    if (response.success) {
      showSaveConfirmation();
      hideSelectionPopup();
      selection.removeAllRanges();
    } else {
      showError('Failed to save note');
    }
  } catch (error) {
    console.error('Error saving note:', error);
    showError('Failed to save note');
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

  const dialog = document.createElement('div');
  dialog.id = 'tags-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <h3>Save Note with Tags</h3>
        <div class="note-preview">${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}</div>
        <input type="text" id="tags-input" placeholder="Enter tags (comma separated)" />
        <div class="dialog-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="save-btn">Save Note</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const tagsInput = dialog.querySelector('#tags-input');
  const saveBtn = dialog.querySelector('.save-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');

  tagsInput.focus();

  saveBtn.addEventListener('click', async () => {
    const tags = tagsInput.value.trim();
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveNote',
        data: {
          text: selectedText,
          url: window.location.href,
          title: document.title,
          tags: tags
        }
      });

      if (response.success) {
        showSaveConfirmation();
        dialog.remove();
        hideSelectionPopup();
        window.getSelection().removeAllRanges();
      } else {
        showError('Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      showError('Failed to save note');
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

#tags-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
  outline: none;
  transition: border-color 0.2s;
}

#tags-input:focus {
  border-color: #3b82f6;
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