// =============================================
// PROTON HUB ADMIN — Shared Utilities
// =============================================

// ---- Toast Notification System ----
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.id = 'toastContainer';
    document.body.appendChild(toastContainer);
  }
}

/**
 * Show a toast notification.
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} type 
 * @param {number} duration - Auto-dismiss in ms (default 3500)
 */
export function showToast(message, type = 'info', duration = 3500) {
  ensureToastContainer();

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${icons[type] || icons.info}"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;

  toastContainer.appendChild(toast);

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}


// ---- Confirmation Dialog ----

/**
 * Show a confirmation dialog.
 * @param {string} title 
 * @param {string} message 
 * @param {Function} onConfirm - Callback when user confirms
 * @param {string} confirmText - Confirm button text (default "Delete")
 */
export function showConfirm(title, message, onConfirm, confirmText = 'Delete') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay confirm-dialog active';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 420px;">
      <div class="modal-body" style="padding: 32px 24px 8px; text-align: center;">
        <div class="confirm-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>${title}</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px;">${message}</p>
      </div>
      <div class="modal-footer" style="justify-content: center; border-top: none; padding-top: 8px;">
        <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
        <button class="btn btn-danger" id="confirmOk"><i class="fas fa-trash-alt"></i> ${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#confirmCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirmOk').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}


// ---- Modal System ----

/**
 * Show a modal with custom HTML content.
 * @param {string} title
 * @param {string} bodyHTML
 * @param {Object} options - { footerHTML, maxWidth, onOpen, icon }
 * @returns {HTMLElement} The modal overlay element
 */
export function showModal(title, bodyHTML, options = {}) {
  const { footerHTML = '', maxWidth = '600px', onOpen, icon = '' } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width: ${maxWidth};">
      <div class="modal-header">
        <h3>${icon ? `<i class="${icon}"></i>` : ''} ${title}</h3>
        <button class="modal-close" id="modalClose"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Close handlers
  overlay.querySelector('#modalClose').addEventListener('click', () => closeModal(overlay));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });

  if (onOpen) onOpen(overlay);

  return overlay;
}

/**
 * Close and remove a modal overlay.
 * @param {HTMLElement} overlay 
 */
export function closeModal(overlay) {
  if (!overlay) return;
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 250);
}


// ---- Loading Spinner ----
let spinnerEl = null;

/**
 * Show a full-page loading spinner.
 * @param {string} text - Optional loading text
 */
export function showSpinner(text = '') {
  if (!spinnerEl) {
    spinnerEl = document.createElement('div');
    spinnerEl.className = 'spinner-overlay';
    spinnerEl.id = 'spinnerOverlay';
    spinnerEl.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div class="spinner"></div>
        <div class="spinner-text" id="spinnerText">${text}</div>
      </div>
    `;
    document.body.appendChild(spinnerEl);
  } else {
    document.getElementById('spinnerText').textContent = text;
  }
  requestAnimationFrame(() => spinnerEl.classList.add('active'));
}

/**
 * Hide the loading spinner.
 */
export function hideSpinner() {
  if (spinnerEl) {
    spinnerEl.classList.remove('active');
  }
}


// ---- CSV Export ----

/**
 * Export an array of objects to CSV and trigger download.
 * @param {Array<Object>} data 
 * @param {string} filename 
 * @param {Array<string>} columns - Optional column keys to include
 */
export function exportToCSV(data, filename, columns) {
  if (!data || !data.length) {
    showToast('No data to export.', 'warning');
    return;
  }

  const keys = columns || Object.keys(data[0]);
  
  // Header row
  const csvRows = [keys.join(',')];
  
  // Data rows
  for (const row of data) {
    const values = keys.map(key => {
      let val = row[key];
      if (val === null || val === undefined) val = '';
      if (typeof val === 'object') val = JSON.stringify(val);
      // Escape quotes and wrap in quotes
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${formatDateShort(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('CSV exported successfully!', 'success');
}


// ---- Date Formatting ----

/**
 * Format a Firestore Timestamp or Date to a readable string.
 * @param {Object|Date|string} timestamp 
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(timestamp, options = {}) {
  if (!timestamp) return '—';
  
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate(); // Firestore Timestamp
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return '—';

  const defaults = { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-IN', { ...defaults, ...options });
}

/**
 * Format date as YYYY-MM-DD (for Firestore attendance keys).
 * @param {Date} date 
 * @returns {string}
 */
export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format date as YYYY-MM-DD for filenames.
 */
function formatDateShort(date) {
  return formatDateKey(date);
}

/**
 * Format date with full weekday name.
 * @param {Date} date 
 * @returns {string}
 */
export function formatDateFull(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}


// ---- Pagination Helper ----

/**
 * Get a page of items from an array.
 * @param {Array} items 
 * @param {number} page - 1-indexed page number
 * @param {number} perPage - Items per page
 * @returns {{ items: Array, totalPages: number, currentPage: number, total: number }}
 */
export function paginate(items, page = 1, perPage = 10) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;
  const paginatedItems = items.slice(start, start + perPage);

  return {
    items: paginatedItems,
    totalPages,
    currentPage,
    total,
    start: start + 1,
    end: Math.min(start + perPage, total)
  };
}

/**
 * Render pagination buttons HTML.
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @param {number} total 
 * @param {number} start 
 * @param {number} end 
 * @returns {string}
 */
export function renderPagination(currentPage, totalPages, total, start, end) {
  if (totalPages <= 1) return '';

  let buttonsHTML = '';

  // Prev button
  buttonsHTML += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
    <i class="fas fa-chevron-left"></i>
  </button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    buttonsHTML += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) buttonsHTML += `<span style="padding: 0 4px; color: var(--text-muted);">…</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    buttonsHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) buttonsHTML += `<span style="padding: 0 4px; color: var(--text-muted);">…</span>`;
    buttonsHTML += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  buttonsHTML += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
    <i class="fas fa-chevron-right"></i>
  </button>`;

  return `
    <div class="pagination">
      <div class="pagination-info">Showing ${start}–${end} of ${total}</div>
      <div class="pagination-buttons">${buttonsHTML}</div>
    </div>
  `;
}


// ---- Misc Helpers ----

/**
 * Truncate a string to a max length.
 */
export function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

/**
 * Debounce a function.
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Escape HTML to prevent XSS.
 */
export function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
