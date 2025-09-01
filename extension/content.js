let selectionPopup = null;
let selectionTimeout = null;
let lastSelection = '';
let lastMousePosition = { x: 0, y: 0 };
let imagePopup = null;
let hoveredImage = null;

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

// Image capture functions
function createImagePopup() {
  if (imagePopup) return imagePopup;

  imagePopup = document.createElement('div');
  imagePopup.id = 'text-to-notes-image-popup';
  imagePopup.innerHTML = `
    <div class="popup-content">
      <button class="save-image-btn" title="Save image as note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="9" cy="9" r="2"></circle>
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
        </svg>
        <span>Save Image</span>
      </button>
      <button class="save-image-with-tags-btn" title="Save image with tags">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span>+ Tags</span>
      </button>
    </div>
  `;

  document.body.appendChild(imagePopup);

  imagePopup.querySelector('.save-image-btn').addEventListener('click', handleSaveImage);
  imagePopup.querySelector('.save-image-with-tags-btn').addEventListener('click', handleSaveImageWithTags);

  return imagePopup;
}

function showImagePopup(imageElement, mouseX, mouseY) {
  if (!imageElement || !isValidImage(imageElement)) {
    hideImagePopup();
    return;
  }

  // Clear any pending hide timeout
  if (typeof imagePopupTimeout !== 'undefined' && imagePopupTimeout) {
    clearTimeout(imagePopupTimeout);
    imagePopupTimeout = null;
  }

  hoveredImage = imageElement;
  const popup = createImagePopup();

  // Position popup next to the mouse cursor (PopClip-style)
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  
  const popupWidth = popup.offsetWidth || 200; // fallback width
  const popupHeight = popup.offsetHeight || 60; // fallback height
  
  // Try positioning to the right of mouse first
  let left = mouseX + scrollX + 15; // 15px to the right of cursor
  let top = mouseY + scrollY - (popupHeight / 2); // vertically centered on cursor
  
  // If popup would go off right edge, position to the left
  if (left + popupWidth > scrollX + viewportWidth - 10) {
    left = mouseX + scrollX - popupWidth - 15; // 15px to the left of cursor
  }
  
  // If popup would go off left edge, position on right but closer
  if (left < scrollX + 10) {
    left = mouseX + scrollX + 10;
  }
  
  // Keep popup within viewport vertically
  if (top < scrollY + 10) {
    top = scrollY + 10;
  } else if (top + popupHeight > scrollY + viewportHeight - 10) {
    top = scrollY + viewportHeight - popupHeight - 10;
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

function hideImagePopup() {
  if (imagePopup) {
    imagePopup.style.display = 'none';
  }
  hoveredImage = null;
  
  // Clear any pending timeouts
  if (typeof imagePopupTimeout !== 'undefined' && imagePopupTimeout) {
    clearTimeout(imagePopupTimeout);
    imagePopupTimeout = null;
  }
  if (typeof mouseMovementTimeout !== 'undefined' && mouseMovementTimeout) {
    clearTimeout(mouseMovementTimeout);
    mouseMovementTimeout = null;
  }
}

function isValidImage(imageElement) {
  if (!imageElement || imageElement.tagName !== 'IMG') return false;
  
  const src = imageElement.src;
  if (!src || src === '' || src.startsWith('data:image/svg')) return false;
  
  // Check minimum size (avoid tiny icons, spacers, etc.)
  const width = imageElement.naturalWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.height;
  
  return width >= 50 && height >= 50;
}

async function handleSaveImage() {
  if (!hoveredImage) return;

  try {
    // Store reference to image before hiding popup (which sets hoveredImage to null)
    const imageToSave = hoveredImage;
    hideImagePopup();
    
    const imageData = await imageToBase64(imageToSave);
    const metadata = getImageMetadata(imageToSave);
    
    // If imageData is null, it means we hit CORS issues, use URL fallback
    const messageData = {
      metadata: {
        ...metadata,
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        caption: metadata.alt || '',
        tags: []
      }
    };
    
    let response;
    if (imageData) {
      // Store as base64 (preferred method)
      response = await chrome.runtime.sendMessage({
        action: 'saveImageNote',
        data: {
          imageData: imageData,
          metadata: messageData.metadata
        }
      });
    } else {
      // Fall back to URL-based storage for cross-origin images
      response = await chrome.runtime.sendMessage({
        action: 'saveImageUrlNote',
        data: {
          imageUrl: imageToSave.src,
          metadata: messageData.metadata
        }
      });
    }
    
    if (response && response.success) {
      showImageSaveToast('Image saved to notes!');
    } else {
      throw new Error(response?.error || 'Failed to save image');
    }
  } catch (error) {
    console.error('Error saving image:', error);
    showImageSaveToast('Failed to save image', 'error');
  }
}

async function handleSaveImageWithTags() {
  if (!hoveredImage) return;

  try {
    // Store reference before hiding popup
    const imageToSave = hoveredImage;
    const imageData = await imageToBase64(imageToSave);
    const metadata = getImageMetadata(imageToSave);
    
    hideImagePopup();
    
    // Show tag dialog for image (pass both imageData and imageUrl for fallback)
    showImageTagsDialog(imageData, metadata, imageToSave.src);
  } catch (error) {
    console.error('Error preparing image for tagging:', error);
    showImageSaveToast('Failed to prepare image', 'error');
  }
}

function showImageTagsDialog(imageData, metadata, imageUrl) {
  try {
    // Apply current theme before showing dialog
    applyTheme();
    
    const existingDialog = document.getElementById('image-tags-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'image-tags-dialog';
    dialog.innerHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog-content">
        <h3>Save Image with Tags</h3>
        
        <div class="image-preview">
          <img src="${imageData || imageUrl}" alt="Preview" style="max-width: 200px; max-height: 150px; border-radius: 6px;">
        </div>
        
        <div class="form-group">
          <label>Caption (optional):</label>
          <input type="text" id="image-caption" placeholder="Add a caption for this image..." value="${metadata.alt || ''}">
        </div>
        
        <div class="form-group">
          <label>Tags:</label>
          <div id="image-tags-container"></div>
        </div>
        
        <div class="form-actions">
          <button type="button" id="cancel-image-tags" class="btn btn-secondary">Cancel</button>
          <button type="button" id="save-image-with-tags" class="btn btn-primary">Save Image</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Initialize tag input for image dialog
    let imageTagInput = null;
    try {
      if (typeof TagInput !== 'undefined') {
        imageTagInput = new TagInput(document.getElementById('image-tags-container'), {
          placeholder: 'Add tags...',
          showRecentTags: true
        });
      }
    } catch (error) {
      console.error('TagInput not available, using fallback:', error);
      // Fallback input
      const tagsContainer = document.getElementById('image-tags-container');
      tagsContainer.innerHTML = '<input type="text" class="tag-input" placeholder="Enter tags separated by commas...">';
    }

    // Event handlers
    dialog.querySelector('#cancel-image-tags').addEventListener('click', () => {
      dialog.remove();
    });

    dialog.querySelector('#save-image-with-tags').addEventListener('click', async () => {
      try {
        const caption = document.getElementById('image-caption').value.trim();
        let tags = [];
        
        if (imageTagInput && imageTagInput.getTags) {
          tags = imageTagInput.getTags();
        } else {
          const fallbackInput = document.querySelector('#image-tags-container .tag-input');
          const value = fallbackInput?.value.trim() || '';
          tags = value ? value.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
        }

        metadata.caption = caption;
        metadata.tags = tags;
        metadata.url = window.location.href;
        metadata.title = document.title;
        metadata.domain = window.location.hostname;

        // Use the same fallback logic as handleSaveImage
        let response;
        if (imageData) {
          // Store as base64 (preferred method)
          response = await chrome.runtime.sendMessage({
            action: 'saveImageNote',
            data: {
              imageData: imageData,
              metadata: metadata
            }
          });
        } else {
          // Fall back to URL-based storage for cross-origin images
          response = await chrome.runtime.sendMessage({
            action: 'saveImageUrlNote',
            data: {
              imageUrl: imageUrl,
              metadata: metadata
            }
          });
        }
        
        if (response && response.success) {
          dialog.remove();
          showImageSaveToast('Image saved with tags!');
        } else {
          throw new Error(response?.error || 'Failed to save image');
        }
      } catch (error) {
        console.error('Error saving image with tags:', error);
        showImageSaveToast('Failed to save image', 'error');
      }
    });

    dialog.querySelector('.dialog-overlay').addEventListener('click', () => {
      dialog.remove();
    });

    // Show dialog
    dialog.style.display = 'flex';
  } catch (error) {
    console.error('Error showing image tags dialog:', error);
  }
}

function showImageSaveToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `image-save-toast ${type}`;
  toast.textContent = message;
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10001;
    transform: translateX(400px);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });
  
  setTimeout(() => {
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Image utility functions
async function imageToBase64(imageElement) {
  return new Promise((resolve, reject) => {
    if (!imageElement) {
      reject(new Error('Image element is null or undefined'));
      return;
    }

    try {
      // First try direct canvas conversion (works for same-origin images)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = imageElement.naturalWidth || imageElement.width;
      canvas.height = imageElement.naturalHeight || imageElement.height;
      
      ctx.drawImage(imageElement, 0, 0);
      
      const base64 = canvas.toDataURL('image/png');
      resolve(base64);
    } catch (corsError) {
      if (corsError.name === 'SecurityError') {
        // Handle cross-origin images by creating a new image with crossOrigin
        const corsImage = new Image();
        corsImage.crossOrigin = 'anonymous';
        
        corsImage.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = corsImage.naturalWidth || corsImage.width;
            canvas.height = corsImage.naturalHeight || corsImage.height;
            
            ctx.drawImage(corsImage, 0, 0);
            
            const base64 = canvas.toDataURL('image/png');
            resolve(base64);
          } catch (retryError) {
            // If still fails, fall back to URL-based storage
            console.warn('Cannot convert cross-origin image to base64, using URL fallback');
            resolve(null); // Signal to use URL fallback
          }
        };
        
        corsImage.onerror = function() {
          console.warn('Failed to load image with CORS, using URL fallback');
          resolve(null); // Signal to use URL fallback
        };
        
        corsImage.src = imageElement.src;
      } else {
        reject(corsError);
      }
    }
  });
}

function getImageMetadata(imageElement) {
  if (!imageElement) {
    throw new Error('Image element is null or undefined');
  }
  
  return {
    width: imageElement.naturalWidth || imageElement.width,
    height: imageElement.naturalHeight || imageElement.height,
    format: getImageFormat(imageElement.src),
    originalSrc: imageElement.src,
    alt: imageElement.alt || '',
    size: null // Will be calculated from base64 data
  };
}

function getImageFormat(src) {
  const extension = src.split('.').pop()?.toLowerCase();
  const formatMap = {
    'jpg': 'jpeg',
    'jpeg': 'jpeg',
    'png': 'png',
    'gif': 'gif',
    'webp': 'webp',
    'svg': 'svg'
  };
  return formatMap[extension] || 'png';
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

// Image capture click handler
document.addEventListener('click', (e) => {
  // Only trigger on Option/Alt + Click on images
  if (!e.altKey) {
    hideImagePopup();
    return;
  }
  
  const target = e.target;
  if (target && target.tagName === 'IMG' && isValidImage(target)) {
    e.preventDefault();
    e.stopPropagation();
    
    // Small delay to avoid conflicts with other click handlers
    setTimeout(() => {
      showImagePopup(target, e.clientX, e.clientY);
    }, 10);
  } else {
    hideImagePopup();
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

  // Handle context menu actions
  if (request.action === 'contextMenuSaveText') {
    handleContextMenuSaveText(request.data);
  } else if (request.action === 'contextMenuSaveTextWithTags') {
    handleContextMenuSaveTextWithTags(request.data);
  } else if (request.action === 'contextMenuSaveImage') {
    handleContextMenuSaveImage(request.data);
  } else if (request.action === 'contextMenuSaveImageWithTags') {
    handleContextMenuSaveImageWithTags(request.data);
  }
});

// Context menu handlers for text
async function handleContextMenuSaveText(data) {
  try {
    if (!data.selectionText) return;

    const response = await chrome.runtime.sendMessage({
      action: 'saveNote',
      data: {
        text: data.selectionText,
        url: data.pageUrl || window.location.href,
        title: document.title,
        tags: ''
      }
    });

    if (response && response.success) {
      showSaveConfirmation();
      // Clear selection 
      window.getSelection().removeAllRanges();
    } else {
      showError('Failed to save note');
    }
  } catch (error) {
    console.error('Error saving note from context menu:', error);
    showError('Failed to save note');
  }
}

function handleContextMenuSaveTextWithTags(data) {
  try {
    if (!data.selectionText) return;

    // Show the tags dialog with the selected text from context menu
    showTagsDialog(data.selectionText);
    // Clear selection after opening dialog
    setTimeout(() => {
      window.getSelection().removeAllRanges();
    }, 100);
  } catch (error) {
    console.error('Error opening tags dialog from context menu:', error);
    // Fallback to simple save
    handleContextMenuSaveText(data);
  }
}

// Context menu handlers for images
async function handleContextMenuSaveImage(data) {
  try {
    if (!data.srcUrl) return;

    // Find the image element by src URL
    const imageElement = findImageElementBySrc(data.srcUrl);
    if (!imageElement) {
      showImageSaveToast('Image not found', 'error');
      return;
    }

    // Use existing image save logic
    const imageData = await imageToBase64(imageElement);
    const metadata = getImageMetadata(imageElement);
    
    const messageData = {
      metadata: {
        ...metadata,
        url: data.pageUrl || window.location.href,
        title: document.title,
        domain: window.location.hostname,
        caption: metadata.alt || '',
        tags: []
      }
    };
    
    let response;
    if (imageData) {
      response = await chrome.runtime.sendMessage({
        action: 'saveImageNote',
        data: {
          imageData: imageData,
          metadata: messageData.metadata
        }
      });
    } else {
      response = await chrome.runtime.sendMessage({
        action: 'saveImageUrlNote',
        data: {
          imageUrl: data.srcUrl,
          metadata: messageData.metadata
        }
      });
    }
    
    if (response && response.success) {
      showImageSaveToast('Image saved to notes!');
    } else {
      throw new Error(response?.error || 'Failed to save image');
    }
  } catch (error) {
    console.error('Error saving image from context menu:', error);
    showImageSaveToast('Failed to save image', 'error');
  }
}

async function handleContextMenuSaveImageWithTags(data) {
  try {
    if (!data.srcUrl) return;

    // Find the image element by src URL
    const imageElement = findImageElementBySrc(data.srcUrl);
    if (!imageElement) {
      showImageSaveToast('Image not found', 'error');
      return;
    }

    // Use existing image save with tags logic
    const imageData = await imageToBase64(imageElement);
    const metadata = getImageMetadata(imageElement);
    
    // Show tag dialog for image
    showImageTagsDialog(imageData, metadata, data.srcUrl);
  } catch (error) {
    console.error('Error preparing image for tagging from context menu:', error);
    showImageSaveToast('Failed to prepare image', 'error');
  }
}

// Helper function to find image element by src URL
function findImageElementBySrc(srcUrl) {
  const images = document.querySelectorAll('img');
  for (let img of images) {
    if (img.src === srcUrl) {
      return img;
    }
  }
  return null;
}

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

/* Image popup styles */
#text-to-notes-image-popup {
  position: absolute;
  z-index: 10000;
  display: none;
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

#text-to-notes-image-popup * {
  pointer-events: auto;
}

#text-to-notes-image-popup .popup-content {
  background: #1f2937;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  gap: 4px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

#text-to-notes-image-popup .popup-content button {
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

#text-to-notes-image-popup .popup-content button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

#text-to-notes-image-popup .popup-content button:active {
  transform: translateY(0);
}

#text-to-notes-image-popup .popup-content button svg {
  flex-shrink: 0;
}

/* Image tags dialog styles */
#image-tags-dialog {
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

#image-tags-dialog .dialog-overlay {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background: var(--overlay, rgba(0, 0, 0, 0.5)) !important;
  backdrop-filter: blur(4px) !important;
  pointer-events: auto !important;
}

#image-tags-dialog .dialog-content {
  background: var(--dialog-bg, white) !important;
  border-radius: 12px !important;
  padding: 20px !important;
  box-shadow: 0 20px 25px -5px var(--dialog-shadow, rgba(0, 0, 0, 0.1)) !important;
  width: 90% !important;
  max-width: 500px !important;
  position: relative !important;
  z-index: 2 !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  transition: background-color 0.3s ease !important;
}

#image-tags-dialog .dialog-content h3 {
  margin: 0 0 16px 0 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: var(--dialog-text, #1f2937) !important;
  display: block !important;
  visibility: visible !important;
}

.image-preview {
  text-align: center;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--dialog-preview-bg, #f9fafb);
  border-radius: 8px;
  border: 1px solid var(--dialog-border, #e5e7eb);
}

.image-preview img {
  max-width: 100% !important;
  height: auto !important;
  border-radius: 6px !important;
}

#image-tags-dialog .form-group {
  margin-bottom: 16px;
}

#image-tags-dialog .form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--dialog-text, #1f2937);
}

#image-tags-dialog input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--dialog-border, #e5e7eb);
  border-radius: 6px;
  font-size: 14px;
  background: var(--dialog-bg, white);
  color: var(--dialog-text, #1f2937);
  transition: border-color 0.2s;
  box-sizing: border-box;
}

#image-tags-dialog input[type="text"]:focus {
  outline: none;
  border-color: var(--dialog-accent, #3b82f6);
}

#image-tags-dialog .form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

#image-tags-dialog .btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

#image-tags-dialog .btn-primary {
  background: var(--dialog-accent, #3b82f6);
  color: white;
}

#image-tags-dialog .btn-primary:hover {
  background: #2563eb;
}

#image-tags-dialog .btn-secondary {
  background: var(--dialog-preview-bg, #f3f4f6);
  color: var(--dialog-text-secondary, #6b7280);
}

#image-tags-dialog .btn-secondary:hover {
  background: var(--dialog-border, #e5e7eb);
}
`;

// Initialize event listeners for image clipping
let imagePopupTimeout = null;
let currentMousePosition = { x: 0, y: 0 };
let mouseMovementTimeout = null;

function initializeImageClipping() {
  // Track mouse position continuously
  document.addEventListener('mousemove', (e) => {
    currentMousePosition.x = e.clientX;
    currentMousePosition.y = e.clientY;
    
    // If mouse is moving over an image, reset the show timeout
    if (e.target.tagName === 'IMG' && isValidImage(e.target) && hoveredImage === e.target) {
      // Clear existing timeout
      if (mouseMovementTimeout) {
        clearTimeout(mouseMovementTimeout);
      }
      
      // Set new timeout - only show popup when mouse stops moving for 300ms
      mouseMovementTimeout = setTimeout(() => {
        if (hoveredImage === e.target) { // Still hovering same image
          showImagePopup(e.target, currentMousePosition.x, currentMousePosition.y);
        }
      }, 300);
    }
  });

  // Image hover handling - detect when mouse enters an image
  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'IMG' && isValidImage(e.target)) {
      hoveredImage = e.target;
      currentMousePosition.x = e.clientX;
      currentMousePosition.y = e.clientY;
      
      // Start the "mouse stopped" detection
      if (mouseMovementTimeout) {
        clearTimeout(mouseMovementTimeout);
      }
      mouseMovementTimeout = setTimeout(() => {
        if (hoveredImage === e.target) {
          showImagePopup(e.target, currentMousePosition.x, currentMousePosition.y);
        }
      }, 300);
    }
    
    // If mouse enters the image popup, cancel any pending hide timeout
    if (e.target.closest('#text-to-notes-image-popup')) {
      if (imagePopupTimeout) {
        clearTimeout(imagePopupTimeout);
        imagePopupTimeout = null;
      }
    }
  });

  document.addEventListener('mouseout', (e) => {
    // Only start hide timeout when mouse leaves both the image and popup area
    const isLeavingImage = e.target.tagName === 'IMG' && hoveredImage === e.target;
    const isLeavingPopup = e.target.closest('#text-to-notes-image-popup');
    
    if (isLeavingImage) {
      // Clear the mouse movement timeout when leaving image
      if (mouseMovementTimeout) {
        clearTimeout(mouseMovementTimeout);
        mouseMovementTimeout = null;
      }
    }
    
    if (isLeavingImage || isLeavingPopup) {
      // Check if mouse is moving to related element (image to popup or popup to image)
      const relatedTarget = e.relatedTarget;
      const movingToPopup = relatedTarget && relatedTarget.closest('#text-to-notes-image-popup');
      const movingToImage = relatedTarget && relatedTarget.tagName === 'IMG' && relatedTarget === hoveredImage;
      
      // Only hide if not moving to related elements
      if (!movingToPopup && !movingToImage) {
        imagePopupTimeout = setTimeout(() => {
          hideImagePopup();
          hoveredImage = null;
        }, 150);
      }
    }
  });

  // Optional: Click on image to immediately show popup (skip hover delay)
  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG' && isValidImage(e.target)) {
      // Clear any pending timeouts
      if (imagePopupTimeout) {
        clearTimeout(imagePopupTimeout);
        imagePopupTimeout = null;
      }
      if (mouseMovementTimeout) {
        clearTimeout(mouseMovementTimeout);
        mouseMovementTimeout = null;
      }
      
      hoveredImage = e.target;
      currentMousePosition.x = e.clientX;
      currentMousePosition.y = e.clientY;
      showImagePopup(e.target, e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Handle text selection for existing text-to-notes functionality
  // Require Option+selection to avoid showing popup too often
  document.addEventListener('mouseup', (e) => {
    if (e.altKey) { // Only show popup when Option key is held during selection
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText && isValidSelection()) {
          lastSelection = selectedText;
          lastMousePosition = { x: e.clientX, y: e.clientY };
          showSelectionPopup();
        } else {
          hideSelectionPopup();
        }
      }, 10);
    }
  });

  // Hide popups when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#text-to-notes-popup') && 
        !e.target.closest('#text-to-notes-image-popup') && 
        !e.target.closest('#image-tags-dialog')) {
      hideSelectionPopup();
      hideImagePopup();
    }
  });
}

// Only initialize if we have the required APIs and DOM
if (typeof chrome !== 'undefined' && chrome.runtime && document.body) {
  document.head.appendChild(style);
  initializeImageClipping();
  console.log('Text-to-Notes: Extension initialized successfully');
} else {
  console.warn('Text-to-Notes: Extension could not initialize - missing required APIs or DOM not ready');
  
  // Try again when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && document.body) {
        document.head.appendChild(style);
        initializeImageClipping();
        console.log('Text-to-Notes: Extension initialized after DOM ready');
      }
    });
  }
}