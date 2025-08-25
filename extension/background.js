importScripts('lib/storage.js', 'lib/utils.js');

const storage = new NotesStorage();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Text-to-Notes extension installed');
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