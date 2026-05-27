// =============================================
// PROTON HUB ADMIN — Announcements CRUD
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import {
  showToast, showConfirm, showModal, closeModal,
  showSpinner, hideSpinner, formatDate, truncate, escapeHTML
} from './utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy, query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allAnnouncements = [];

async function init() {
  try {
    const user = await checkAuth();
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Announcements', 'fas fa-bullhorn'));
    initSidebar(user);



    await loadAnnouncements();
    document.getElementById('addAnnouncementBtn')?.addEventListener('click', () => openForm());

    // Check if auto-open
    if (new URLSearchParams(window.location.search).get('action') === 'add') {
      openForm();
    }
  } catch (err) {
    console.error('Announcements init error:', err);
  }
}

async function loadAnnouncements() {
  try {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    allAnnouncements = [];
    snap.forEach(d => allAnnouncements.push({ id: d.id, ...d.data() }));
    renderTable();
  } catch (err) {
    console.error('Error loading announcements:', err);
    showToast('Failed to load announcements.', 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('announcementsBody');

  if (allAnnouncements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><i class="fas fa-bullhorn"></i><h4>No announcements yet</h4><p>Create one to display on the website.</p></div>
    </td></tr>`;
    return;
  }

  const typeBadge = (type) => {
    const map = { info: 'badge-info', alert: 'badge-alert', event: 'badge-event' };
    return `<span class="badge ${map[type] || 'badge-info'}">${escapeHTML(type || 'info')}</span>`;
  };

  tbody.innerHTML = allAnnouncements.map(a => `
    <tr>
      <td>
        <strong>${escapeHTML(a.title || '')}</strong>
        ${a.active ? ' <span class="badge badge-live" style="font-size:0.6rem;">LIVE</span>' : ''}
      </td>
      <td class="text-sm" style="max-width:200px;">${escapeHTML(truncate(a.message || '', 80))}</td>
      <td>${typeBadge(a.type)}</td>
      <td>
        <div class="toggle-wrapper">
          <label class="toggle">
            <input type="checkbox" ${a.active ? 'checked' : ''} onchange="window._toggleAnnouncement('${a.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </td>
      <td class="text-sm">${a.expiresAt ? formatDate(a.expiresAt) : '—'}</td>
      <td class="text-sm">${formatDate(a.createdAt)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon btn-sm" title="Preview" onclick="window._previewAnnouncement('${a.id}')"><i class="fas fa-eye" style="color:var(--info)"></i></button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Edit" onclick="window._editAnnouncement('${a.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Delete" onclick="window._deleteAnnouncement('${a.id}', '${escapeHTML(a.title || '')}')"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getFormHTML(announcement = null) {
  const a = announcement || {};
  const expiresVal = a.expiresAt?.toDate ? a.expiresAt.toDate().toISOString().split('T')[0] : '';
  return `
    <form id="announcementForm">
      <div class="form-group">
        <label>Title <span class="required">*</span></label>
        <input type="text" class="form-input" id="afTitle" value="${escapeHTML(a.title || '')}" required placeholder="Announcement title">
      </div>
      <div class="form-group">
        <label>Message <span class="required">*</span></label>
        <textarea class="form-textarea" id="afMessage" rows="4" required placeholder="Write your announcement message...">${escapeHTML(a.message || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select class="form-select" id="afType">
            <option value="info" ${a.type === 'info' ? 'selected' : ''}>ℹ️ Info</option>
            <option value="alert" ${a.type === 'alert' ? 'selected' : ''}>🚨 Alert</option>
            <option value="event" ${a.type === 'event' ? 'selected' : ''}>🎉 Event</option>
          </select>
        </div>
        <div class="form-group">
          <label>Expires At <span class="text-muted text-xs">(optional)</span></label>
          <input type="date" class="form-input" id="afExpires" value="${expiresVal}">
        </div>
      </div>
      <div class="form-group">
        <div class="toggle-wrapper">
          <label class="toggle">
            <input type="checkbox" id="afActive" ${a.active !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Active (visible on website)</span>
        </div>
      </div>
      <div class="announcement-preview" id="formPreview" style="display:none;">
        <div class="preview-label">Preview</div>
        <h4 id="previewTitle"></h4>
        <p id="previewMessage"></p>
        <span class="preview-close">✕</span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm mt-8" id="togglePreviewBtn"><i class="fas fa-eye"></i> Toggle Preview</button>
    </form>
  `;
}

function openForm(announcementId = null) {
  const announcement = announcementId ? allAnnouncements.find(a => a.id === announcementId) : null;
  const isEdit = !!announcement;

  const modal = showModal(
    isEdit ? 'Edit Announcement' : 'New Announcement',
    getFormHTML(announcement),
    {
      icon: 'fas fa-bullhorn',
      maxWidth: '560px',
      footerHTML: `
        <button class="btn btn-secondary" id="modalCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="modalSaveBtn">
          <span class="btn-text"><i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'}</span>
          <span class="btn-spinner"></span>
        </button>
      `
    }
  );

  modal.querySelector('#modalCancelBtn').addEventListener('click', () => closeModal(modal));
  modal.querySelector('#modalSaveBtn').addEventListener('click', () => saveAnnouncement(modal, announcementId));

  // Preview toggle
  modal.querySelector('#togglePreviewBtn').addEventListener('click', () => {
    const preview = modal.querySelector('#formPreview');
    const title = modal.querySelector('#afTitle').value || 'Announcement Title';
    const message = modal.querySelector('#afMessage').value || 'Message will appear here.';
    modal.querySelector('#previewTitle').textContent = title;
    modal.querySelector('#previewMessage').textContent = message;
    preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
  });
}

async function saveAnnouncement(modal, id = null) {
  const title = modal.querySelector('#afTitle').value.trim();
  const message = modal.querySelector('#afMessage').value.trim();
  if (!title || !message) {
    showToast('Title and message are required.', 'warning');
    return;
  }

  const expiresVal = modal.querySelector('#afExpires').value;
  const data = {
    title,
    message,
    type: modal.querySelector('#afType').value,
    active: modal.querySelector('#afActive').checked,
    expiresAt: expiresVal ? Timestamp.fromDate(new Date(expiresVal)) : null
  };

  if (!id) {
    data.createdAt = Timestamp.now();
  }

  const saveBtn = modal.querySelector('#modalSaveBtn');
  saveBtn.classList.add('loading');
  saveBtn.disabled = true;

  try {
    if (id) {
      await updateDoc(doc(db, 'announcements', id), data);
      showToast('Announcement updated!', 'success');
    } else {
      await addDoc(collection(db, 'announcements'), data);
      showToast('Announcement created!', 'success');
    }
    closeModal(modal);
    await loadAnnouncements();
  } catch (err) {
    console.error('Error saving announcement:', err);
    showToast('Failed to save.', 'error');
  } finally {
    saveBtn.classList.remove('loading');
    saveBtn.disabled = false;
  }
}

async function toggleAnnouncement(id, active) {
  try {
    await updateDoc(doc(db, 'announcements', id), { active });
    showToast(`Announcement ${active ? 'activated' : 'deactivated'}.`, 'success');
    await loadAnnouncements();
  } catch (err) {
    showToast('Failed to update.', 'error');
  }
}

function previewAnnouncement(id) {
  const a = allAnnouncements.find(x => x.id === id);
  if (!a) return;
  showModal('Announcement Preview', `
    <div class="announcement-preview">
      <div class="preview-label">Website Preview</div>
      <h4>${escapeHTML(a.title || '')}</h4>
      <p>${escapeHTML(a.message || '')}</p>
      <span class="preview-close">✕</span>
    </div>
    <div style="margin-top:12px; font-size:0.8rem; color:var(--text-muted);">
      Type: <span class="badge badge-${a.type || 'info'}">${a.type || 'info'}</span> &nbsp;
      Status: ${a.active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}
    </div>
  `, { icon: 'fas fa-eye', maxWidth: '480px' });
}

async function deleteAnnouncement(id, title) {
  showConfirm('Delete Announcement', `Delete "<strong>${title}</strong>"? This will remove it from the website.`, async () => {
    try {
      showSpinner('Deleting...');
      await deleteDoc(doc(db, 'announcements', id));
      showToast('Announcement deleted.', 'success');
      await loadAnnouncements();
    } catch (err) {
      showToast('Failed to delete.', 'error');
    } finally {
      hideSpinner();
    }
  });
}

window._editAnnouncement = (id) => openForm(id);
window._toggleAnnouncement = (id, active) => toggleAnnouncement(id, active);
window._previewAnnouncement = (id) => previewAnnouncement(id);
window._deleteAnnouncement = (id, title) => deleteAnnouncement(id, title);

init();
