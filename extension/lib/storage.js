class NotesStorage {
  constructor() {
    this.STORAGE_KEYS = {
      NOTES: 'notes_collection',
      TAGS: 'tags_collection',
      TAG_STATS: 'tag_statistics',
      THEME: 'app_theme'
    };
  }

  async getAllNotes() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.NOTES);
      return result[this.STORAGE_KEYS.NOTES] || [];
    } catch (error) {
      console.error('Error getting notes:', error);
      return [];
    }
  }

  async saveNote(note) {
    try {
      // Add updated_at timestamp
      note.updated_at = note.created_at;
      
      // Save the note
      const notes = await this.getAllNotes();
      notes.push(note);
      await chrome.storage.local.set({ [this.STORAGE_KEYS.NOTES]: notes });
      
      // Update tag statistics
      if (note.tags && note.tags.length > 0) {
        await this.updateTagStatistics(note.tags);
      }
      
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
      await chrome.storage.local.set({ [this.STORAGE_KEYS.NOTES]: notes });
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
      await chrome.storage.local.set({ [this.STORAGE_KEYS.NOTES]: filteredNotes });
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

  // ============ TAG MANAGEMENT METHODS ============

  async getAllTags() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.TAGS);
      return result[this.STORAGE_KEYS.TAGS] || {};
    } catch (error) {
      console.error('Error getting tags:', error);
      return {};
    }
  }

  async getTagStatistics() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.TAG_STATS);
      return result[this.STORAGE_KEYS.TAG_STATS] || {
        recent_tags: [],
        popular_tags: [],
        total_tags: 0,
        total_notes: 0
      };
    } catch (error) {
      console.error('Error getting tag statistics:', error);
      return { recent_tags: [], popular_tags: [], total_tags: 0, total_notes: 0 };
    }
  }

  async updateTagStatistics(newTags) {
    try {
      const tags = await this.getAllTags();
      const stats = await this.getTagStatistics();
      const now = new Date().toISOString();

      // Update tag collection
      for (const tagName of newTags) {
        if (tags[tagName]) {
          tags[tagName].count++;
          tags[tagName].last_used = now;
        } else {
          tags[tagName] = {
            name: tagName,
            count: 1,
            created_at: now,
            last_used: now,
            color: this.generateTagColor(tagName)
          };
        }
      }

      // Update recent tags (keep last 10, most recent first)
      const recentTags = [...newTags, ...stats.recent_tags.filter(tag => !newTags.includes(tag))].slice(0, 10);

      // Update popular tags (top 10 by count)
      const popularTags = Object.values(tags)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(tag => tag.name);

      const updatedStats = {
        recent_tags: recentTags,
        popular_tags: popularTags,
        total_tags: Object.keys(tags).length,
        total_notes: (await this.getAllNotes()).length
      };

      // Save both collections
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.TAGS]: tags,
        [this.STORAGE_KEYS.TAG_STATS]: updatedStats
      });

      return updatedStats;
    } catch (error) {
      console.error('Error updating tag statistics:', error);
      throw error;
    }
  }

  async getRecentTags(limit = 10) {
    const stats = await this.getTagStatistics();
    return stats.recent_tags.slice(0, limit);
  }

  async getPopularTags(limit = 10) {
    const stats = await this.getTagStatistics();
    return stats.popular_tags.slice(0, limit);
  }

  async getNotesByTag(tagName) {
    try {
      const notes = await this.getAllNotes();
      return notes.filter(note => note.tags && note.tags.includes(tagName));
    } catch (error) {
      console.error('Error getting notes by tag:', error);
      return [];
    }
  }

  async renameTag(oldName, newName) {
    try {
      // Update all notes with the old tag
      const notes = await this.getAllNotes();
      const updatedNotes = notes.map(note => {
        if (note.tags && note.tags.includes(oldName)) {
          note.tags = note.tags.map(tag => tag === oldName ? newName : tag);
          note.updated_at = new Date().toISOString();
        }
        return note;
      });

      // Update tag collection
      const tags = await this.getAllTags();
      if (tags[oldName]) {
        tags[newName] = { ...tags[oldName], name: newName };
        delete tags[oldName];
      }

      // Save updates
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.NOTES]: updatedNotes,
        [this.STORAGE_KEYS.TAGS]: tags
      });

      // Refresh statistics
      await this.refreshTagStatistics();
      
      return true;
    } catch (error) {
      console.error('Error renaming tag:', error);
      throw error;
    }
  }

  async deleteTag(tagName) {
    try {
      // Remove tag from all notes
      const notes = await this.getAllNotes();
      const updatedNotes = notes.map(note => {
        if (note.tags && note.tags.includes(tagName)) {
          note.tags = note.tags.filter(tag => tag !== tagName);
          note.updated_at = new Date().toISOString();
        }
        return note;
      });

      // Remove from tag collection
      const tags = await this.getAllTags();
      delete tags[tagName];

      // Save updates
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.NOTES]: updatedNotes,
        [this.STORAGE_KEYS.TAGS]: tags
      });

      // Refresh statistics
      await this.refreshTagStatistics();
      
      return true;
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }

  async refreshTagStatistics() {
    try {
      const notes = await this.getAllNotes();
      const tags = await this.getAllTags();
      
      // Recalculate tag counts
      const tagCounts = {};
      notes.forEach(note => {
        if (note.tags) {
          note.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      // Update tag collection with correct counts
      Object.keys(tags).forEach(tagName => {
        tags[tagName].count = tagCounts[tagName] || 0;
      });

      // Recalculate statistics
      const popularTags = Object.values(tags)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(tag => tag.name);

      const stats = await this.getTagStatistics();
      const updatedStats = {
        ...stats,
        popular_tags: popularTags,
        total_tags: Object.keys(tags).length,
        total_notes: notes.length
      };

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.TAGS]: tags,
        [this.STORAGE_KEYS.TAG_STATS]: updatedStats
      });

      return updatedStats;
    } catch (error) {
      console.error('Error refreshing tag statistics:', error);
      throw error;
    }
  }

  generateTagColor(tagName) {
    // Generate a consistent color for each tag based on its name
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
    ];
    
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  // Theme management methods
  async getTheme() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.THEME);
      return result[this.STORAGE_KEYS.THEME] || 'light';
    } catch (error) {
      console.error('Error getting theme:', error);
      return 'light';
    }
  }

  async setTheme(theme) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.THEME]: theme });
      return theme;
    } catch (error) {
      console.error('Error setting theme:', error);
      throw error;
    }
  }

  async toggleTheme() {
    try {
      const currentTheme = await this.getTheme();
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      await this.setTheme(newTheme);
      return newTheme;
    } catch (error) {
      console.error('Error toggling theme:', error);
      throw error;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotesStorage;
} else if (typeof window !== 'undefined') {
  window.NotesStorage = NotesStorage;
}