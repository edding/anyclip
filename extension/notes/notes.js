class NotesApp {
  constructor() {
    this.notes = [];
    this.filteredNotes = [];
    this.currentEditId = null;
    this.currentDeleteId = null;
    this.searchTerm = '';
    this.sortBy = 'newest';
    this.selectedTag = '';
    this.allTags = {};
    
    this.initializeElements();
    this.attachEventListeners();
    this.loadNotes();
    this.loadTags();
  }

  initializeElements() {
    this.elements = {
      searchInput: document.getElementById('searchInput'),
      clearSearch: document.getElementById('clearSearch'),
      sortSelect: document.getElementById('sortSelect'),
      notesCount: document.getElementById('notesCount'),
      storageInfo: document.getElementById('storageInfo'),
      emptyState: document.getElementById('emptyState'),
      notesContainer: document.getElementById('notesContainer'),
      manageNotesBtn: document.getElementById('manageNotesBtn'),
      editModal: document.getElementById('editModal'),
      editForm: document.getElementById('editForm'),
      editText: document.getElementById('editText'),
      editTags: document.getElementById('editTags'),
      closeModal: document.getElementById('closeModal'),
      cancelEdit: document.getElementById('cancelEdit'),
      deleteModal: document.getElementById('deleteModal'),
      deletePreview: document.getElementById('deletePreview'),
      closeDeleteModal: document.getElementById('closeDeleteModal'),
      cancelDelete: document.getElementById('cancelDelete'),
      confirmDelete: document.getElementById('confirmDelete'),
      toast: document.getElementById('toast'),
      tagFilterSection: document.getElementById('tagFilterSection'),
      tagList: document.getElementById('tagList'),
      clearTagFilter: document.getElementById('clearTagFilter')
    };
  }

  attachEventListeners() {
    this.elements.searchInput.addEventListener('input', 
      Utils.debounce((e) => this.handleSearch(e.target.value), 300)
    );
    
    this.elements.clearSearch.addEventListener('click', () => this.clearSearch());
    this.elements.sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
    this.elements.clearTagFilter.addEventListener('click', () => this.clearTagFilter());
    this.elements.manageNotesBtn.addEventListener('click', () => this.openFullManager());
    
    this.elements.editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
    this.elements.closeModal.addEventListener('click', () => this.closeEditModal());
    this.elements.cancelEdit.addEventListener('click', () => this.closeEditModal());
    
    this.elements.closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
    this.elements.cancelDelete.addEventListener('click', () => this.closeDeleteModal());
    this.elements.confirmDelete.addEventListener('click', () => this.handleDelete());
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeEditModal();
        this.closeDeleteModal();
      }
    });
  }

  async loadNotes() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (response.success) {
        this.notes = response.notes;
        this.applyFiltersAndSort();
        this.updateStats();
        this.loadTags(); // Reload tags when notes change
      } else {
        this.showToast('Error loading notes: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      this.showToast('Failed to load notes', 'error');
    }
  }

  async loadTags() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllTags' });
      
      if (response.success) {
        this.allTags = response.data;
        this.renderTagFilter();
      } else {
        console.log('Error loading tags: ' + response.error);
        this.allTags = {};
        this.elements.tagFilterSection.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      this.allTags = {};
      this.elements.tagFilterSection.style.display = 'none';
    }
  }

  applyFiltersAndSort() {
    let filtered = [...this.notes];
    
    // Apply tag filter first
    if (this.selectedTag) {
      filtered = filtered.filter(note => note.tags.includes(this.selectedTag));
    }
    
    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(note =>
        note.text.toLowerCase().includes(term) ||
        note.title.toLowerCase().includes(term) ||
        note.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'alphabetical':
          return a.text.localeCompare(b.text);
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    
    this.filteredNotes = filtered;
    this.renderNotes();
  }

  renderNotes() {
    if (this.filteredNotes.length === 0) {
      this.elements.emptyState.style.display = 'flex';
      this.elements.notesContainer.style.display = 'none';
      
      if (this.searchTerm) {
        this.elements.emptyState.innerHTML = `
          <div class="empty-icon">🔍</div>
          <h2>No matching notes</h2>
          <p>No notes found for "${this.searchTerm}". Try a different search term.</p>
        `;
      }
    } else {
      this.elements.emptyState.style.display = 'none';
      this.elements.notesContainer.style.display = 'block';
      
      this.elements.notesContainer.innerHTML = this.filteredNotes
        .map(note => this.createNoteHTML(note))
        .join('');
      
      this.attachNoteEventListeners();
    }
  }

  createNoteHTML(note) {
    const domain = Utils.extractDomain(note.url);
    const formattedDate = Utils.formatDate(note.created_at);
    const truncatedText = Utils.truncateText(note.text, 150);
    const tagsHTML = note.tags.map(tag => 
      `<span class="tag">${Utils.escapeHtml(tag)}</span>`
    ).join('');

    return `
      <div class="note-card" data-id="${note.id}">
        <div class="note-header">
          <div class="note-meta">
            <span class="note-domain">${Utils.escapeHtml(domain)}</span>
            <span class="note-date">${formattedDate}</span>
          </div>
          <div class="note-actions">
            <button class="btn-icon edit-btn" data-id="${note.id}" title="Edit note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon delete-btn" data-id="${note.id}" title="Delete note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="note-content">
          <h3 class="note-title">
            <a href="${note.url}" target="_blank" rel="noopener noreferrer" title="Open source page">
              ${Utils.escapeHtml(note.title)}
            </a>
          </h3>
          <p class="note-text">${Utils.escapeHtml(truncatedText)}</p>
          <div class="note-tags">${tagsHTML}</div>
        </div>
      </div>
    `;
  }

  attachNoteEventListeners() {
    this.elements.notesContainer.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(btn.dataset.id);
      });
    });

    this.elements.notesContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDeleteModal(btn.dataset.id);
      });
    });
  }

  handleSearch(term) {
    this.searchTerm = term.trim();
    this.elements.clearSearch.style.display = this.searchTerm ? 'block' : 'none';
    this.applyFiltersAndSort();
    this.updateStats();
  }

  clearSearch() {
    this.elements.searchInput.value = '';
    this.searchTerm = '';
    this.elements.clearSearch.style.display = 'none';
    this.applyFiltersAndSort();
    this.updateStats();
  }

  handleSort(sortBy) {
    this.sortBy = sortBy;
    this.applyFiltersAndSort();
  }

  openEditModal(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.currentEditId = noteId;
    this.elements.editText.value = note.text;
    this.elements.editTags.value = Utils.tagsToString(note.tags);
    this.elements.editModal.style.display = 'flex';
    this.elements.editText.focus();
  }

  closeEditModal() {
    this.elements.editModal.style.display = 'none';
    this.currentEditId = null;
    this.elements.editForm.reset();
  }

  async handleEditSubmit(e) {
    e.preventDefault();
    
    if (!this.currentEditId) return;

    const text = this.elements.editText.value.trim();
    const tags = this.elements.editTags.value;

    if (!text) {
      this.showToast('Note text cannot be empty', 'error');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateNote',
        id: this.currentEditId,
        data: { text, tags }
      });

      if (response.success) {
        const noteIndex = this.notes.findIndex(n => n.id === this.currentEditId);
        if (noteIndex !== -1) {
          this.notes[noteIndex] = response.note;
        }
        
        this.closeEditModal();
        this.applyFiltersAndSort();
        this.loadTags(); // Refresh tags after edit
        this.showToast('Note updated successfully', 'success');
      } else {
        this.showToast('Error updating note: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      this.showToast('Failed to update note', 'error');
    }
  }

  openDeleteModal(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.currentDeleteId = noteId;
    this.elements.deletePreview.innerHTML = `
      <strong>${Utils.escapeHtml(note.title)}</strong><br>
      <small>${Utils.truncateText(note.text, 80)}</small>
    `;
    this.elements.deleteModal.style.display = 'flex';
  }

  closeDeleteModal() {
    this.elements.deleteModal.style.display = 'none';
    this.currentDeleteId = null;
  }

  async handleDelete() {
    if (!this.currentDeleteId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        id: this.currentDeleteId
      });

      if (response.success) {
        this.notes = this.notes.filter(n => n.id !== this.currentDeleteId);
        this.closeDeleteModal();
        this.applyFiltersAndSort();
        this.loadTags(); // Refresh tags after delete
        this.updateStats();
        this.showToast('Note deleted successfully', 'success');
      } else {
        this.showToast('Error deleting note: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      this.showToast('Failed to delete note', 'error');
    }
  }

  updateStats() {
    const totalNotes = this.notes.length;
    const filteredCount = this.filteredNotes.length;
    
    let countText = '';
    if (this.selectedTag && this.searchTerm) {
      countText = `${filteredCount} of ${totalNotes} notes (tag: "${this.selectedTag}", search: "${this.searchTerm}")`;
    } else if (this.selectedTag) {
      countText = `${filteredCount} of ${totalNotes} notes (tag: "${this.selectedTag}")`;
    } else if (this.searchTerm) {
      countText = `${filteredCount} of ${totalNotes} notes (search: "${this.searchTerm}")`;
    } else {
      countText = `${totalNotes} note${totalNotes === 1 ? '' : 's'}`;
    }
    
    this.elements.notesCount.textContent = countText;

    const totalChars = this.notes.reduce((sum, note) => sum + note.text.length, 0);
    const avgCharsPerNote = totalNotes > 0 ? Math.round(totalChars / totalNotes) : 0;
    this.elements.storageInfo.textContent = `Avg: ${avgCharsPerNote} chars/note`;
  }

  showToast(message, type = 'info') {
    this.elements.toast.textContent = message;
    this.elements.toast.className = `toast toast-${type} toast-show`;
    
    setTimeout(() => {
      this.elements.toast.classList.remove('toast-show');
    }, 3000);
  }

  renderTagFilter() {
    const tagEntries = Object.entries(this.allTags);
    
    if (tagEntries.length === 0) {
      this.elements.tagFilterSection.style.display = 'none';
      return;
    }

    // Sort tags by count (most used first)
    tagEntries.sort((a, b) => b[1].count - a[1].count);

    this.elements.tagFilterSection.style.display = 'block';
    this.elements.tagList.innerHTML = tagEntries
      .map(([tagName, tagData]) => `
        <div class="filter-tag ${this.selectedTag === tagName ? 'active' : ''}" 
             data-tag="${tagName}">
          ${Utils.escapeHtml(tagName)}
          <span class="tag-count">(${tagData.count})</span>
        </div>
      `).join('');

    // Attach click event listeners to tag filters
    this.elements.tagList.querySelectorAll('.filter-tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        const tagName = e.currentTarget.dataset.tag;
        this.handleTagFilter(tagName);
      });
    });
  }

  handleTagFilter(tagName) {
    if (this.selectedTag === tagName) {
      // If clicking the same tag, clear the filter
      this.clearTagFilter();
    } else {
      this.selectedTag = tagName;
      this.applyFiltersAndSort();
      this.updateStats();
      this.renderTagFilter(); // Re-render to update active state
    }
  }

  clearTagFilter() {
    this.selectedTag = '';
    this.applyFiltersAndSort();
    this.updateStats();
    this.renderTagFilter(); // Re-render to remove active state
  }

  openFullManager() {
    // Open the full-page notes manager in a new tab
    chrome.tabs.create({ url: 'notes/manage.html' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NotesApp();
});