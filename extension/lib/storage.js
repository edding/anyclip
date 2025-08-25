class NotesStorage {
  constructor() {
    this.STORAGE_KEY = 'text_to_notes';
  }

  async getAllNotes() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('Error getting notes:', error);
      return [];
    }
  }

  async saveNote(note) {
    try {
      const notes = await this.getAllNotes();
      notes.push(note);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: notes });
      return note;
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
    }
  }

  async updateNote(noteId, updatedNote) {
    try {
      const notes = await this.getAllNotes();
      const noteIndex = notes.findIndex(note => note.id === noteId);
      
      if (noteIndex === -1) {
        throw new Error('Note not found');
      }

      notes[noteIndex] = { ...notes[noteIndex], ...updatedNote };
      await chrome.storage.local.set({ [this.STORAGE_KEY]: notes });
      return notes[noteIndex];
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  async deleteNote(noteId) {
    try {
      const notes = await this.getAllNotes();
      const filteredNotes = notes.filter(note => note.id !== noteId);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredNotes });
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  async getNoteById(noteId) {
    try {
      const notes = await this.getAllNotes();
      return notes.find(note => note.id === noteId) || null;
    } catch (error) {
      console.error('Error getting note by ID:', error);
      return null;
    }
  }

  async searchNotes(query) {
    try {
      const notes = await this.getAllNotes();
      const lowerQuery = query.toLowerCase();
      
      return notes.filter(note => 
        note.text.toLowerCase().includes(lowerQuery) ||
        note.title.toLowerCase().includes(lowerQuery) ||
        note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('Error searching notes:', error);
      return [];
    }
  }

  async getStorageInfo() {
    try {
      const result = await chrome.storage.local.getBytesInUse();
      return {
        bytesInUse: result,
        quota: chrome.storage.local.QUOTA_BYTES
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotesStorage;
} else if (typeof window !== 'undefined') {
  window.NotesStorage = NotesStorage;
}