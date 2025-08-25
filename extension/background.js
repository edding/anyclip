importScripts('lib/storage.js', 'lib/utils.js');

const storage = new NotesStorage();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveNote',
    title: 'Save selection as note',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveNote' && info.selectionText) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getSelectionInfo'
      });

      const note = {
        id: Utils.generateUUID(),
        text: Utils.sanitizeText(info.selectionText),
        url: tab.url,
        title: tab.title,
        tags: [],
        created_at: Utils.getCurrentISOString()
      };

      await storage.saveNote(note);
      
      chrome.action.setBadgeText({ text: 'New', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId: tab.id });
      
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 3000);

    } catch (error) {
      console.error('Error saving note:', error);
    }
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
});