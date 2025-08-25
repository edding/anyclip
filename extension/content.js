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

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      let contextElement = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container;

      const selectionInfo = {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        timestamp: new Date().toISOString(),
        context: {
          tagName: contextElement.tagName || 'UNKNOWN',
          className: contextElement.className || '',
          id: contextElement.id || ''
        }
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

function isValidSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText) return false;
  if (selectedText.length < 3) return false;
  if (selectedText.length > 10000) return false;
  
  const invalidPatterns = [
    /^[\s\n\r\t]*$/,
    /^[0-9\s\-\+\=\*\/\(\)\[\]]*$/,
    /^[\W]*$/
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(selectedText));
}

document.addEventListener('selectionchange', () => {
  const hasValidSelection = isValidSelection();
  
  if (hasValidSelection) {
    chrome.runtime.sendMessage({
      action: 'enableContextMenu'
    });
  }
});

function addVisualFeedback() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  const feedback = document.createElement('div');
  feedback.id = 'note-saved-feedback';
  feedback.textContent = '✓ Note saved!';
  feedback.style.cssText = `
    position: fixed;
    top: ${rect.top - 30}px;
    left: ${rect.left}px;
    background: #4285f4;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: Arial, sans-serif;
    z-index: 10000;
    pointer-events: none;
    animation: fadeInOut 2s ease-in-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(10px); }
      20% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.parentNode.removeChild(feedback);
    }
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 2000);
}