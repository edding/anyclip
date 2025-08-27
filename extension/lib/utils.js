class Utils {
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static getCurrentISOString() {
    return new Date().toISOString();
  }

  static formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  static formatDateFull(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString();
  }

  static sanitizeText(text) {
    return text.trim().replace(/\s+/g, ' ');
  }

  static truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  static parseTagsInput(tagsString) {
    if (!tagsString || typeof tagsString !== 'string') {
      return [];
    }
    
    return tagsString
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index);
  }

  static tagsToString(tagsArray) {
    if (!Array.isArray(tagsArray)) {
      return '';
    }
    return tagsArray.join(', ');
  }

  static isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  static extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (_) {
      return '';
    }
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static unescapeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Reusable Tag Input Component
class TagInput {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      placeholder: 'Add tags...',
      showRecentTags: true,
      recentTagsLimit: 3,
      onTagsChange: () => {},
      ...options
    };
    
    this.currentTags = [];
    this.recentTags = [];
    this.elements = {};
    
    this.init();
  }
  
  init() {
    this.createHTML();
    this.attachEventListeners();
    if (this.options.showRecentTags) {
      this.loadRecentTags();
    }
  }
  
  createHTML() {
    this.container.innerHTML = `
      <div class="tag-input-container">
        <div class="tag-chips" id="tag-chips"></div>
        <input type="text" class="tag-input" placeholder="${this.options.placeholder}" />
      </div>
      ${this.options.showRecentTags ? `
        <div class="recent-tags" style="display: none;">
          <div class="recent-tags-label">Recent tags:</div>
          <div class="recent-tags-list"></div>
        </div>
      ` : ''}
    `;
    
    this.elements = {
      tagChips: this.container.querySelector('.tag-chips'),
      tagInput: this.container.querySelector('.tag-input'),
      recentTags: this.container.querySelector('.recent-tags'),
      recentTagsList: this.container.querySelector('.recent-tags-list')
    };
  }
  
  attachEventListeners() {
    // Tag input handling
    this.elements.tagInput.addEventListener('input', () => {
      this.handleTagInput();
      this.updateRecentTagsDisplay();
    });

    this.elements.tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.processCurrentInput();
        this.updateRecentTagsDisplay();
      } else if (e.key === 'Backspace' && this.elements.tagInput.value === '' && this.currentTags.length > 0) {
        // Remove last tag when backspacing on empty input
        this.removeTag(this.currentTags.length - 1);
        this.updateRecentTagsDisplay();
      }
    });
  }
  
  handleTagInput() {
    const value = this.elements.tagInput.value;
    const parts = value.split(',');
    
    if (parts.length > 1) {
      // User typed a comma, process all complete tags
      for (let i = 0; i < parts.length - 1; i++) {
        const tag = parts[i].trim().toLowerCase();
        if (tag && !this.currentTags.includes(tag)) {
          this.currentTags.push(tag);
        }
      }
      this.elements.tagInput.value = parts[parts.length - 1].trim();
      this.renderTagChips();
      this.notifyChange();
    }
  }
  
  processCurrentInput() {
    const tag = this.elements.tagInput.value.trim().toLowerCase();
    if (tag && !this.currentTags.includes(tag)) {
      this.currentTags.push(tag);
      this.elements.tagInput.value = '';
      this.renderTagChips();
      this.notifyChange();
    }
  }
  
  renderTagChips() {
    this.elements.tagChips.innerHTML = this.currentTags.map((tag, index) => `
      <div class="tag-chip">
        <span class="tag-text">${Utils.escapeHtml(tag)}</span>
        <button class="tag-remove" data-index="${index}" type="button">×</button>
      </div>
    `).join('');
    
    // Add event listeners to remove buttons
    this.elements.tagChips.querySelectorAll('.tag-remove').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.removeTag(index);
      });
    });
  }
  
  removeTag(index) {
    if (index >= 0 && index < this.currentTags.length) {
      this.currentTags.splice(index, 1);
      this.renderTagChips();
      this.updateRecentTagsDisplay();
      this.notifyChange();
      this.elements.tagInput.focus();
    }
  }
  
  addTag(tag) {
    if (tag && !this.currentTags.includes(tag)) {
      this.currentTags.push(tag);
      this.renderTagChips();
      this.updateRecentTagsDisplay();
      this.notifyChange();
      this.elements.tagInput.value = '';
      this.elements.tagInput.focus();
    }
  }
  
  async loadRecentTags() {
    try {
      if (!chrome || !chrome.runtime) {
        this.recentTags = ['work', 'important', 'research'];
        this.updateRecentTagsDisplay();
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'getRecentTags',
        data: { limit: this.options.recentTagsLimit }
      });

      if (response && response.success) {
        this.recentTags = response.data || [];
        this.updateRecentTagsDisplay();
      } else {
        this.recentTags = ['work', 'important', 'research'];
        this.updateRecentTagsDisplay();
      }
    } catch (error) {
      console.error('Error loading recent tags:', error);
      this.recentTags = ['work', 'important', 'research'];
      this.updateRecentTagsDisplay();
    }
  }
  
  updateRecentTagsDisplay() {
    if (!this.options.showRecentTags || !this.elements.recentTags) return;
    
    // Filter out tags that are already added
    const availableTags = this.recentTags.filter(tag => !this.currentTags.includes(tag));
    
    if (availableTags.length === 0) {
      this.elements.recentTags.style.display = 'none';
      return;
    }
    
    this.elements.recentTags.style.display = 'block';
    this.elements.recentTagsList.innerHTML = availableTags
      .slice(0, this.options.recentTagsLimit)
      .map(tag => `
        <button class="recent-tag-btn" data-tag="${tag}" type="button">${Utils.escapeHtml(tag)}</button>
      `).join('');
    
    // Add event listeners to recent tag buttons
    this.elements.recentTagsList.querySelectorAll('.recent-tag-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const tag = e.target.dataset.tag;
        this.addTag(tag);
      });
    });
  }
  
  getTags() {
    return [...this.currentTags];
  }
  
  setTags(tags) {
    this.currentTags = Array.isArray(tags) ? [...tags] : [];
    this.renderTagChips();
    this.updateRecentTagsDisplay();
    this.notifyChange();
  }
  
  clear() {
    this.currentTags = [];
    this.elements.tagInput.value = '';
    this.renderTagChips();
    this.updateRecentTagsDisplay();
    this.notifyChange();
  }
  
  focus() {
    this.elements.tagInput.focus();
  }
  
  notifyChange() {
    this.options.onTagsChange(this.getTags());
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
} else if (typeof window !== 'undefined') {
  window.Utils = Utils;
}