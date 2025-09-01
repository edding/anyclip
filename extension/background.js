importScripts('lib/storage.js', 'lib/utils.js');

const storage = new NotesStorage();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Text-to-Notes extension installed');
  
  // Create context menu items
  createContextMenuItems();
});

// Create context menu items
function createContextMenuItems() {
  // Remove any existing context menu items first
  chrome.contextMenus.removeAll(() => {
    // Create parent menu item
    chrome.contextMenus.create({
      id: "text-to-notes-parent",
      title: "Text-to-Notes",
      contexts: ["selection", "image"]
    });

    // Text selection context menu items
    chrome.contextMenus.create({
      id: "save-selected-text",
      parentId: "text-to-notes-parent",
      title: "Save Selected Text",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "save-selected-text-with-tags",
      parentId: "text-to-notes-parent", 
      title: "Save Selected Text with Tags",
      contexts: ["selection"]
    });

    // Image context menu items
    chrome.contextMenus.create({
      id: "save-image",
      parentId: "text-to-notes-parent",
      title: "Save Image",
      contexts: ["image"]
    });

    chrome.contextMenus.create({
      id: "save-image-with-tags",
      parentId: "text-to-notes-parent",
      title: "Save Image with Tags", 
      contexts: ["image"]
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-selected-text") {
    // Send message to content script to save selected text
    chrome.tabs.sendMessage(tab.id, {
      action: "contextMenuSaveText",
      data: {
        selectionText: info.selectionText,
        pageUrl: info.pageUrl,
        frameUrl: info.frameUrl
      }
    });
  } else if (info.menuItemId === "save-selected-text-with-tags") {
    // Send message to content script to save selected text with tags
    chrome.tabs.sendMessage(tab.id, {
      action: "contextMenuSaveTextWithTags",
      data: {
        selectionText: info.selectionText,
        pageUrl: info.pageUrl,
        frameUrl: info.frameUrl
      }
    });
  } else if (info.menuItemId === "save-image") {
    // Send message to content script to save image
    chrome.tabs.sendMessage(tab.id, {
      action: "contextMenuSaveImage",
      data: {
        srcUrl: info.srcUrl,
        pageUrl: info.pageUrl,
        frameUrl: info.frameUrl
      }
    });
  } else if (info.menuItemId === "save-image-with-tags") {
    // Send message to content script to save image with tags
    chrome.tabs.sendMessage(tab.id, {
      action: "contextMenuSaveImageWithTags",
      data: {
        srcUrl: info.srcUrl,
        pageUrl: info.pageUrl,
        frameUrl: info.frameUrl
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAllNotes') {
    storage.getAllNotes().then(notes => {
      sendResponse({ success: true, notes });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'saveNote') {
    const note = {
      id: Utils.generateUUID(),
      text: Utils.sanitizeText(request.data.text),
      url: request.data.url,
      title: request.data.title,
      tags: Utils.parseTagsInput(request.data.tags),
      created_at: Utils.getCurrentISOString()
    };

    storage.saveNote(note).then(() => {
      // Show "New" badge on extension icon
      chrome.action.setBadgeText({ text: 'New', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId: sender.tab.id });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
      }, 3000);

      sendResponse({ success: true, note });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'saveImageNote') {
    storage.saveImageNote(
      request.data.imageData, 
      request.data.metadata
    ).then((note) => {
      // Show "New" badge on extension icon
      chrome.action.setBadgeText({ text: 'New', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId: sender.tab.id });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
      }, 3000);

      sendResponse({ success: true, note });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'saveImageUrlNote') {
    storage.saveImageUrlNote(
      request.data.imageUrl, 
      request.data.metadata
    ).then((note) => {
      // Show "New" badge on extension icon
      chrome.action.setBadgeText({ text: 'New', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId: sender.tab.id });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
      }, 3000);

      sendResponse({ success: true, note });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'updateNote') {
    storage.updateNote(request.id, {
      text: Utils.sanitizeText(request.data.text),
      tags: Utils.parseTagsInput(request.data.tags)
    }).then(updatedNote => {
      sendResponse({ success: true, note: updatedNote });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'deleteNote') {
    storage.deleteNote(request.id).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'searchNotes') {
    storage.searchNotes(request.query).then(notes => {
      sendResponse({ success: true, notes });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getRecentTags') {
    const limit = request.data?.limit || 10;
    storage.getRecentTags(limit).then(tags => {
      sendResponse({ success: true, data: tags });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getPopularTags') {
    const limit = request.data?.limit || 10;
    storage.getPopularTags(limit).then(tags => {
      sendResponse({ success: true, data: tags });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getAllTags') {
    storage.getAllTags().then(tags => {
      sendResponse({ success: true, data: tags });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getTagStatistics') {
    storage.getTagStatistics().then(stats => {
      sendResponse({ success: true, data: stats });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getNotesByTag') {
    storage.getNotesByTag(request.data.tagName).then(notes => {
      sendResponse({ success: true, data: notes });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});