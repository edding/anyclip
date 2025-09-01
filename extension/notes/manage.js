class NotesManager {
  constructor() {
    this.notes = [];
    this.filteredNotes = [];
    this.allTags = {};
    this.selectedNotes = new Set();
    this.currentView = 'all';
    this.currentTag = '';
    this.searchTerm = '';
    this.sortBy = 'newest';
    this.viewMode = 'grid'; // 'grid' or 'list'
    this.bulkTagInput = null;
    
    this.initializeElements();
    this.attachEventListeners();
    this.initializeTagInput();
    this.initializeTheme();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      // Header
      totalNotesCount: document.getElementById('totalNotesCount'),
      totalTagsCount: document.getElementById('totalTagsCount'),
      themeToggleBtn: document.getElementById('themeToggleBtn'),
      exportNotesBtn: document.getElementById('exportNotesBtn'),
      importNotesBtn: document.getElementById('importNotesBtn'),
      importFileInput: document.getElementById('importFileInput'),

      // Sidebar
      navItems: document.querySelectorAll('.nav-item'),
      tagSearchInput: document.getElementById('tagSearchInput'),
      tagsList: document.getElementById('tagsList'),

      // Toolbar
      globalSearchInput: document.getElementById('globalSearchInput'),
      clearGlobalSearch: document.getElementById('clearGlobalSearch'),
      bulkActions: document.getElementById('bulkActions'),
      bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
      bulkTagBtn: document.getElementById('bulkTagBtn'),
      bulkExportBtn: document.getElementById('bulkExportBtn'),
      sortSelect: document.getElementById('sortSelect'),
      toggleViewBtn: document.getElementById('toggleViewBtn'),

      // Content
      emptyState: document.getElementById('emptyState'),
      notesGrid: document.getElementById('notesGrid'),

      // Modals
      editModal: document.getElementById('editModal'),
      editForm: document.getElementById('editForm'),
      editText: document.getElementById('editText'),
      editTags: document.getElementById('editTags'),
      editUrl: document.getElementById('editUrl'),
      closeEditModal: document.getElementById('closeEditModal'),
      cancelEdit: document.getElementById('cancelEdit'),

      bulkTagModal: document.getElementById('bulkTagModal'),
      bulkTagsContainer: document.getElementById('bulkTagsContainer'),
      closeBulkTagModal: document.getElementById('closeBulkTagModal'),
      cancelBulkTag: document.getElementById('cancelBulkTag'),
      applyBulkTag: document.getElementById('applyBulkTag'),

      deleteModal: document.getElementById('deleteModal'),
      deleteMessage: document.getElementById('deleteMessage'),
      deletePreview: document.getElementById('deletePreview'),
      closeDeleteModal: document.getElementById('closeDeleteModal'),
      cancelDelete: document.getElementById('cancelDelete'),
      confirmDelete: document.getElementById('confirmDelete'),

      toast: document.getElementById('toast')
    };
  }

  initializeTagInput() {
    // Initialize the tag input component for bulk operations
    this.bulkTagInput = new TagInput(this.elements.bulkTagsContainer, {
      placeholder: 'Add tags...',
      showRecentTags: true,
      recentTagsLimit: 3,
      onTagsChange: (tags) => {
        // Tags changed callback if needed
      }
    });
  }

  attachEventListeners() {
    // Header actions
    this.elements.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.elements.exportNotesBtn.addEventListener('click', () => this.exportNotes());
    this.elements.importNotesBtn.addEventListener('click', () => this.elements.importFileInput.click());
    this.elements.importFileInput.addEventListener('change', (e) => this.importNotes(e));

    // Navigation
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => this.handleViewChange(e.target.dataset.view));
    });

    // Tag search
    this.elements.tagSearchInput.addEventListener('input', 
      Utils.debounce((e) => this.filterTags(e.target.value), 300)
    );

    // Global search
    this.elements.globalSearchInput.addEventListener('input', 
      Utils.debounce((e) => this.handleGlobalSearch(e.target.value), 300)
    );
    this.elements.clearGlobalSearch.addEventListener('click', () => this.clearGlobalSearch());

    // Bulk actions
    this.elements.bulkDeleteBtn.addEventListener('click', () => this.handleBulkDelete());
    this.elements.bulkTagBtn.addEventListener('click', () => this.openBulkTagModal());
    this.elements.bulkExportBtn.addEventListener('click', () => this.exportSelectedNotes());

    // View controls
    this.elements.sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
    this.elements.toggleViewBtn.addEventListener('click', () => this.toggleView());

    // Edit modal
    this.elements.editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
    this.elements.closeEditModal.addEventListener('click', () => this.closeEditModal());
    this.elements.cancelEdit.addEventListener('click', () => this.closeEditModal());

    // Bulk tag modal
    this.elements.closeBulkTagModal.addEventListener('click', () => this.closeBulkTagModal());
    this.elements.cancelBulkTag.addEventListener('click', () => this.closeBulkTagModal());
    this.elements.applyBulkTag.addEventListener('click', () => this.handleBulkTagSubmit());

    // Delete modal
    this.elements.closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
    this.elements.cancelDelete.addEventListener('click', () => this.closeDeleteModal());
    this.elements.confirmDelete.addEventListener('click', () => this.handleDeleteConfirm());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Modal backdrop clicks
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeAllModals();
      }
    });
  }

  async loadData() {
    await Promise.all([
      this.loadNotes(),
      this.loadTags()
    ]);
    this.updateStats();
  }

  async loadNotes() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (response.success) {
        this.notes = response.notes || [];
        this.applyFiltersAndSort();
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
        this.allTags = response.data || {};
        this.renderTags();
      } else {
        console.error('Error loading tags:', response.error);
        this.allTags = {};
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      this.allTags = {};
    }
  }

  applyFiltersAndSort() {
    let filtered = [...this.notes];

    // Apply view filter
    switch (this.currentView) {
      case 'recent':
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(note => new Date(note.created_at) >= sevenDaysAgo);
        break;
      case 'untagged':
        filtered = filtered.filter(note => !note.tags || note.tags.length === 0);
        break;
      case 'images':
        filtered = filtered.filter(note => this.isImageNote(note));
        break;
      case 'all':
      default:
        break;
    }

    // Apply tag filter
    if (this.currentTag) {
      filtered = filtered.filter(note => note.tags && note.tags.includes(this.currentTag));
    }

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(note =>
        note.text.toLowerCase().includes(term) ||
        note.title.toLowerCase().includes(term) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(term)))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'alphabetical':
          return a.text.localeCompare(b.text);
        case 'domain':
          const domainA = Utils.extractDomain(a.url);
          const domainB = Utils.extractDomain(b.url);
          return domainA.localeCompare(domainB);
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    this.filteredNotes = filtered;
    this.renderNotes();
    this.updateBulkActionsVisibility();
  }

  renderNotes() {
    if (this.filteredNotes.length === 0) {
      this.elements.emptyState.style.display = 'flex';
      this.elements.notesGrid.style.display = 'none';
      return;
    }

    this.elements.emptyState.style.display = 'none';
    this.elements.notesGrid.style.display = 'grid';
    this.elements.notesGrid.className = `notes-grid ${this.viewMode === 'list' ? 'list-view' : ''}`;

    this.elements.notesGrid.innerHTML = this.filteredNotes
      .map(note => this.createNoteHTML(note))
      .join('');

    this.attachNoteEventListeners();
  }

  createNoteHTML(note) {
    const domain = Utils.extractDomain(note.url);
    const formattedDate = Utils.formatDate(note.created_at);
    const truncatedText = Utils.truncateText(note.text, this.viewMode === 'list' ? 200 : 150);
    const tagsHTML = (note.tags || []).map(tag => 
      `<span class="note-tag" data-tag="${Utils.escapeHtml(tag)}">${Utils.escapeHtml(tag)}</span>`
    ).join('');
    const isSelected = this.selectedNotes.has(note.id);

    return `
      <div class="note-card ${this.isImageNote(note) ? 'image-note' : ''} ${isSelected ? 'selected' : ''}" data-id="${note.id}">
        <input type="checkbox" class="note-checkbox" ${isSelected ? 'checked' : ''} 
               data-id="${note.id}">
        
        <div class="note-header">
          <div class="note-meta">
            ${this.createNoteTypeIcon(note)}
            <div class="note-domain">${Utils.escapeHtml(domain)}</div>
            <div class="note-date">${formattedDate}</div>
          </div>
          <div class="note-actions">
            <button class="btn btn-icon edit-btn" data-id="${note.id}" title="Edit note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn-icon delete-btn" data-id="${note.id}" title="Delete note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="note-content">
          ${this.isImageNote(note) ? '' : `
            <h3 class="note-title">
              <a href="${note.url}" target="_blank" rel="noopener noreferrer" title="Open source page">
                ${Utils.escapeHtml(note.title)}
              </a>
            </h3>
          `}
          ${this.createNoteContentHTML(note, truncatedText)}
          <div class="note-tags">${tagsHTML}</div>
        </div>
      </div>
    `;
  }

  isImageNote(note) {
    return note.type === 'image' || note.type === 'text_with_image' || note.type === 'image_url';
  }

  createNoteTypeIcon(note) {
    if (!this.isImageNote(note)) return '';

    const iconTitle = note.type === 'image' ? 'Image note' : 
                     note.type === 'image_url' ? 'Image note (linked)' : 
                     'Text with image';
    
    return `
      <span class="note-type-icon" title="${iconTitle}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="9" cy="9" r="2"></circle>
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
        </svg>
      </span>
    `;
  }

  createNoteContentHTML(note, truncatedText) {
    const hasImage = this.isImageNote(note) && (note.imageData || note.imageUrl);
    
    if (!hasImage) {
      // Regular text note
      return `<p class="note-text">${Utils.escapeHtml(truncatedText)}</p>`;
    }

    // Image note
    const imageSrc = note.imageData || note.imageUrl;
    let content = `
      <div class="note-image-container">
        <img src="${imageSrc}" alt="${Utils.escapeHtml(note.imageMetadata?.alt || 'Saved image')}" class="note-image" loading="lazy">
      </div>
    `;
    
    // Add text content for text_with_image notes or if there's a caption
    if ((note.type === 'text_with_image' && note.text) || (note.text && note.text !== (note.imageMetadata?.alt || ''))) {
      content += `<p class="note-text">${Utils.escapeHtml(truncatedText)}</p>`;
    }
    
    return content;
  }

  attachNoteEventListeners() {
    // Note selection
    this.elements.notesGrid.querySelectorAll('.note-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleNoteSelection(e.target.dataset.id, e.target.checked);
      });
    });

    // Note editing
    this.elements.notesGrid.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(btn.dataset.id);
      });
    });

    // Note deletion
    this.elements.notesGrid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDeleteModal(btn.dataset.id);
      });
    });

    // Tag filtering
    this.elements.notesGrid.querySelectorAll('.note-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        this.filterByTag(e.target.dataset.tag);
      });
    });

    // Add click handlers for images to open source URL
    this.elements.notesGrid.querySelectorAll('.note-image').forEach(img => {
      const noteCard = img.closest('.note-card');
      if (noteCard) {
        const noteId = noteCard.dataset.id;
        const note = this.notes.find(n => n.id === noteId);
        if (note && note.url) {
          img.style.cursor = 'pointer';
          img.title = 'Click to open source page';
          img.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.create({ url: note.url });
          });
        }
      }
    });

    // Note card clicks for selection
    this.elements.notesGrid.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) return;
        if (e.target.classList.contains('note-tag')) return;
        if (e.target.classList.contains('btn') || e.target.closest('.btn')) return;
        if (e.target.classList.contains('note-image')) return; // Don't select when clicking image
        
        const checkbox = card.querySelector('.note-checkbox');
        checkbox.checked = !checkbox.checked;
        this.toggleNoteSelection(card.dataset.id, checkbox.checked);
      });
    });
  }

  renderTags() {
    const tagEntries = Object.entries(this.allTags);
    
    if (tagEntries.length === 0) {
      this.elements.tagsList.innerHTML = '<div class="no-tags">No tags found</div>';
      return;
    }

    // Sort tags by count
    tagEntries.sort((a, b) => b[1].count - a[1].count);

    this.elements.tagsList.innerHTML = tagEntries
      .map(([tagName, tagData]) => `
        <button class="tag-item ${this.currentTag === tagName ? 'active' : ''}" 
                data-tag="${tagName}">
          <div class="tag-info">
            <span class="tag-name">${Utils.escapeHtml(tagName)}</span>
            <span class="tag-count">${tagData.count}</span>
          </div>
        </button>
      `).join('');

    // Attach click listeners
    this.elements.tagsList.querySelectorAll('.tag-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tagName = e.currentTarget.dataset.tag;
        this.filterByTag(tagName);
      });
    });
  }

  // Event Handlers
  handleViewChange(view) {
    this.currentView = view;
    this.currentTag = '';
    
    // Update navigation
    this.elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Update tag list
    this.renderTags();
    
    this.applyFiltersAndSort();
  }

  handleGlobalSearch(term) {
    this.searchTerm = term.trim();
    this.elements.clearGlobalSearch.style.display = this.searchTerm ? 'block' : 'none';
    this.applyFiltersAndSort();
  }

  clearGlobalSearch() {
    this.elements.globalSearchInput.value = '';
    this.searchTerm = '';
    this.elements.clearGlobalSearch.style.display = 'none';
    this.applyFiltersAndSort();
  }

  handleSort(sortBy) {
    this.sortBy = sortBy;
    this.applyFiltersAndSort();
  }

  toggleView() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
    this.renderNotes();
  }

  filterByTag(tagName) {
    if (this.currentTag === tagName) {
      // Clear tag filter
      this.currentTag = '';
    } else {
      this.currentTag = tagName;
    }
    
    this.renderTags();
    this.applyFiltersAndSort();
  }

  filterTags(searchTerm) {
    const tagItems = this.elements.tagsList.querySelectorAll('.tag-item');
    const term = searchTerm.toLowerCase();
    
    tagItems.forEach(item => {
      const tagName = item.querySelector('.tag-name').textContent.toLowerCase();
      item.style.display = tagName.includes(term) ? 'block' : 'none';
    });
  }

  toggleNoteSelection(noteId, selected) {
    if (selected) {
      this.selectedNotes.add(noteId);
    } else {
      this.selectedNotes.delete(noteId);
    }

    // Update card appearance
    const card = document.querySelector(`[data-id="${noteId}"]`);
    if (card) {
      card.classList.toggle('selected', selected);
    }

    this.updateBulkActionsVisibility();
  }

  updateBulkActionsVisibility() {
    const count = this.selectedNotes.size;
    const bulkCount = this.elements.bulkActions.querySelector('.bulk-count');
    
    if (count > 0) {
      this.elements.bulkActions.style.display = 'flex';
      bulkCount.textContent = `${count} selected`;
    } else {
      this.elements.bulkActions.style.display = 'none';
    }
  }

  // Modal handlers
  openEditModal(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.currentEditId = noteId;
    this.elements.editText.value = note.text;
    this.elements.editTags.value = Utils.tagsToString(note.tags || []);
    this.elements.editUrl.value = note.url;
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
    const url = this.elements.editUrl.value.trim();

    if (!text) {
      this.showToast('Note text cannot be empty', 'error');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateNote',
        id: this.currentEditId,
        data: { text, tags, url }
      });

      if (response.success) {
        const noteIndex = this.notes.findIndex(n => n.id === this.currentEditId);
        if (noteIndex !== -1) {
          this.notes[noteIndex] = response.note;
        }
        
        this.closeEditModal();
        this.applyFiltersAndSort();
        this.loadTags(); // Refresh tags
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
    this.elements.deleteMessage.textContent = 'Are you sure you want to delete this note?';
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

  async handleDeleteConfirm() {
    if (!this.currentDeleteId) return;

    // Handle bulk delete
    if (this.currentDeleteId === 'bulk') {
      return this.handleBulkDeleteConfirm();
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        id: this.currentDeleteId
      });

      if (response.success) {
        this.notes = this.notes.filter(n => n.id !== this.currentDeleteId);
        this.selectedNotes.delete(this.currentDeleteId);
        
        this.closeDeleteModal();
        this.applyFiltersAndSort();
        this.loadTags(); // Refresh tags
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

  // Bulk operations
  handleBulkDelete() {
    if (this.selectedNotes.size === 0) return;

    this.elements.deleteMessage.textContent = 
      `Are you sure you want to delete ${this.selectedNotes.size} selected note${this.selectedNotes.size > 1 ? 's' : ''}?`;
    this.elements.deletePreview.innerHTML = '';
    this.currentDeleteId = 'bulk';
    this.elements.deleteModal.style.display = 'flex';
  }

  async handleBulkDeleteConfirm() {
    if (this.selectedNotes.size === 0) return;

    try {
      const deletePromises = Array.from(this.selectedNotes).map(noteId => 
        chrome.runtime.sendMessage({ action: 'deleteNote', id: noteId })
      );

      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.success).length;

      this.notes = this.notes.filter(n => !this.selectedNotes.has(n.id));
      this.selectedNotes.clear();
      
      this.closeDeleteModal();
      this.applyFiltersAndSort();
      this.loadTags();
      this.updateStats();
      
      this.showToast(`${successful} note${successful > 1 ? 's' : ''} deleted successfully`, 'success');
    } catch (error) {
      console.error('Error bulk deleting notes:', error);
      this.showToast('Failed to delete notes', 'error');
    }
  }

  openBulkTagModal() {
    if (this.selectedNotes.size === 0) return;
    
    this.elements.bulkTagModal.style.display = 'flex';
    this.bulkTagInput.clear(); // Clear any previous tags
    this.bulkTagInput.focus();
  }

  closeBulkTagModal() {
    this.elements.bulkTagModal.style.display = 'none';
    if (this.bulkTagInput) {
      this.bulkTagInput.clear();
    }
  }

  async handleBulkTagSubmit() {
    const newTags = this.bulkTagInput.getTags();
    if (!newTags.length || this.selectedNotes.size === 0) return;
    
    try {
      const updatePromises = Array.from(this.selectedNotes).map(noteId => {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return Promise.resolve({ success: false });
        
        const existingTags = note.tags || [];
        const combinedTags = [...new Set([...existingTags, ...newTags])];
        
        return chrome.runtime.sendMessage({
          action: 'updateNote',
          id: noteId,
          data: { 
            text: note.text,
            tags: Utils.tagsToString(combinedTags)
          }
        });
      });

      const results = await Promise.all(updatePromises);
      const successful = results.filter(r => r.success).length;

      // Update local notes
      results.forEach((result, index) => {
        if (result.success) {
          const noteId = Array.from(this.selectedNotes)[index];
          const noteIndex = this.notes.findIndex(n => n.id === noteId);
          if (noteIndex !== -1) {
            this.notes[noteIndex] = result.note;
          }
        }
      });

      this.closeBulkTagModal();
      this.applyFiltersAndSort();
      this.loadTags();
      
      this.showToast(`Tags added to ${successful} note${successful > 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error bulk tagging notes:', error);
      this.showToast('Failed to add tags', 'error');
    }
  }

  exportSelectedNotes() {
    if (this.selectedNotes.size === 0) return;
    
    const selectedNotesData = this.notes.filter(note => this.selectedNotes.has(note.id));
    this.downloadJSON(selectedNotesData, `selected-notes-${new Date().toISOString().split('T')[0]}.json`);
    this.showToast(`Exported ${selectedNotesData.length} notes`, 'success');
  }

  exportNotes() {
    if (this.notes.length === 0) {
      this.showToast('No notes to export', 'warning');
      return;
    }
    
    const exportData = {
      notes: this.notes,
      tags: this.allTags,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    this.downloadJSON(exportData, `notes-export-${new Date().toISOString().split('T')[0]}.json`);
    this.showToast(`Exported ${this.notes.length} notes`, 'success');
  }

  async importNotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate import data
      if (!data.notes || !Array.isArray(data.notes)) {
        throw new Error('Invalid import file format');
      }

      // Import notes
      let imported = 0;
      for (const noteData of data.notes) {
        try {
          const note = {
            id: Utils.generateUUID(),
            text: noteData.text || '',
            url: noteData.url || '',
            title: noteData.title || 'Imported Note',
            tags: noteData.tags || [],
            created_at: noteData.created_at || new Date().toISOString()
          };

          const response = await chrome.runtime.sendMessage({
            action: 'saveNote',
            note: note
          });

          if (response.success) {
            imported++;
          }
        } catch (error) {
          console.error('Error importing note:', error);
        }
      }

      // Reload data
      await this.loadData();
      
      this.showToast(`Imported ${imported} notes successfully`, 'success');
    } catch (error) {
      console.error('Error importing notes:', error);
      this.showToast('Failed to import notes. Please check file format.', 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  handleKeyboard(e) {
    if (e.key === 'Escape') {
      this.closeAllModals();
    }
    
    // Ctrl/Cmd + A to select all visible notes
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      this.selectAllVisibleNotes();
    }
    
    // Delete key to delete selected notes
    if (e.key === 'Delete' && this.selectedNotes.size > 0 && !e.target.matches('input, textarea')) {
      this.handleBulkDelete();
    }
  }

  selectAllVisibleNotes() {
    this.filteredNotes.forEach(note => {
      this.selectedNotes.add(note.id);
    });
    
    // Update UI
    this.renderNotes();
    this.updateBulkActionsVisibility();
  }

  closeAllModals() {
    this.closeEditModal();
    this.closeDeleteModal();
    this.closeBulkTagModal();
  }

  async initializeTheme() {
    try {
      const storage = new NotesStorage();
      const theme = await storage.getTheme();
      this.applyTheme(theme);
    } catch (error) {
      console.error('Error initializing theme:', error);
      this.applyTheme('light'); // fallback
    }
  }

  async toggleTheme() {
    try {
      console.log('NotesStorage available:', typeof NotesStorage);
      const storage = new NotesStorage();
      console.log('Storage instance created:', storage);
      const newTheme = await storage.toggleTheme();
      console.log('Theme toggled to:', newTheme);
      this.applyTheme(newTheme);
      this.showToast(`Switched to ${newTheme} mode`, 'info');
    } catch (error) {
      console.error('Error toggling theme:', error);
      // Fallback: toggle theme manually if storage fails
      const currentTheme = document.body.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      this.applyTheme(newTheme);
      this.showToast(`Theme switched to ${newTheme} mode (local only)`, 'info');
    }
  }

  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    
    // Update theme toggle button icons
    const sunIcon = this.elements.themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = this.elements.themeToggleBtn.querySelector('.moon-icon');
    
    if (theme === 'dark') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  }

  updateStats() {
    const totalNotes = this.notes.length;
    const totalTags = Object.keys(this.allTags).length;
    
    this.elements.totalNotesCount.textContent = `${totalNotes} note${totalNotes !== 1 ? 's' : ''}`;
    this.elements.totalTagsCount.textContent = `${totalTags} tag${totalTags !== 1 ? 's' : ''}`;
  }

  showToast(message, type = 'info') {
    this.elements.toast.textContent = message;
    this.elements.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      this.elements.toast.classList.remove('show');
    }, 3000);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new NotesManager();
});