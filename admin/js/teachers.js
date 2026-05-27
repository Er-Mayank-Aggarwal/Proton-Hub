// =============================================
// PROTON HUB ADMIN — Teachers CRUD
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import {
  showToast, showConfirm, showModal, closeModal,
  showSpinner, hideSpinner, formatDate, debounce, escapeHTML
} from './utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allTeachers = [];

async function init() {
  try {
    const user = await checkAuth();
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Teachers', 'fas fa-chalkboard-teacher'));
    initSidebar(user);



    await loadTeachers();
    document.getElementById('addTeacherBtn')?.addEventListener('click', () => openTeacherForm());
    document.getElementById('searchInput')?.addEventListener('input', debounce(() => renderTeachers(), 250));
  } catch (err) {
    console.error('Teachers init error:', err);
  }
}

async function loadTeachers() {
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    allTeachers = [];
    snap.forEach(d => allTeachers.push({ id: d.id, ...d.data() }));
    allTeachers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderTeachers();
  } catch (err) {
    console.error('Error loading teachers:', err);
    showToast('Failed to load teachers.', 'error');
    document.getElementById('teachersGrid').innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i>
        <h4>Access Denied / Error</h4>
        <p>Please check your Firebase Firestore Database Rules.</p>
      </div>`;
  }
}

function renderTeachers() {
  const grid = document.getElementById('teacherGrid');
  const search = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

  let filtered = allTeachers;
  if (search) {
    filtered = allTeachers.filter(t =>
      (t.name || '').toLowerCase().includes(search) ||
      (t.subject || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:48px;">
      <i class="fas fa-chalkboard-teacher"></i>
      <h4>No teachers found</h4>
      <p>Add teachers to manage your faculty.</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const initials = (t.name || 'T').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const statusBadge = t.active !== false
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Inactive</span>';

    return `
      <div class="teacher-card">
        <div class="teacher-card-header">
          <div class="teacher-avatar">${initials}</div>
          <div>
            <div class="teacher-name">${escapeHTML(t.name || '')}</div>
            <div class="teacher-subject">${escapeHTML(t.subject || '')}</div>
          </div>
        </div>
        <div class="teacher-details">
          <div class="teacher-detail"><i class="fas fa-phone"></i> ${escapeHTML(t.phone || '—')}</div>
          <div class="teacher-detail"><i class="fas fa-envelope"></i> ${escapeHTML(t.email || '—')}</div>
          <div class="teacher-detail"><i class="fas fa-tag"></i> ${escapeHTML(t.designation || '—')}</div>
          <div class="teacher-detail"><i class="fas fa-calendar"></i> Joined: ${formatDate(t.joinDate)}</div>
        </div>
        <div class="teacher-card-footer">
          ${statusBadge}
          <div class="btn-group">
            <button class="btn btn-ghost btn-icon btn-sm" title="Edit" onclick="window._editTeacher('${t.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-ghost btn-icon btn-sm" title="Toggle Active" onclick="window._toggleTeacher('${t.id}', ${t.active !== false})">
              <i class="fas fa-power-off" style="color:${t.active !== false ? 'var(--success)' : 'var(--text-muted)'}"></i>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" title="Delete" onclick="window._deleteTeacher('${t.id}', '${escapeHTML(t.name || '')}')"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getFormHTML(teacher = null) {
  const t = teacher || {};
  const joinDateVal = t.joinDate?.toDate ? t.joinDate.toDate().toISOString().split('T')[0] : (t.joinDate || '');
  return `
    <form id="teacherForm">
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="tfName" value="${escapeHTML(t.name || '')}" required placeholder="Teacher's name">
        </div>
        <div class="form-group">
          <label>Subject <span class="required">*</span></label>
          <input type="text" class="form-input" id="tfSubject" value="${escapeHTML(t.subject || '')}" required placeholder="e.g., Mathematics">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" class="form-input" id="tfPhone" value="${escapeHTML(t.phone || '')}" placeholder="10-digit number" maxlength="10">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-input" id="tfEmail" value="${escapeHTML(t.email || '')}" placeholder="teacher@email.com">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Designation</label>
          <input type="text" class="form-input" id="tfDesignation" value="${escapeHTML(t.designation || '')}" placeholder="e.g., Senior Faculty">
        </div>
        <div class="form-group">
          <label>Join Date</label>
          <input type="date" class="form-input" id="tfJoinDate" value="${joinDateVal}">
        </div>
      </div>
      <div class="form-group">
        <label>Bio</label>
        <textarea class="form-textarea" id="tfBio" rows="3" placeholder="Brief description...">${escapeHTML(t.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <div class="toggle-wrapper">
          <label class="toggle">
            <input type="checkbox" id="tfActive" ${t.active !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Active</span>
        </div>
      </div>
    </form>
  `;
}

function openTeacherForm(teacherId = null) {
  const teacher = teacherId ? allTeachers.find(t => t.id === teacherId) : null;
  const isEdit = !!teacher;

  const modal = showModal(
    isEdit ? 'Edit Teacher' : 'Add New Teacher',
    getFormHTML(teacher),
    {
      icon: isEdit ? 'fas fa-pen' : 'fas fa-plus',
      maxWidth: '580px',
      footerHTML: `
        <button class="btn btn-secondary" id="modalCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="modalSaveBtn">
          <span class="btn-text"><i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Save'}</span>
          <span class="btn-spinner"></span>
        </button>
      `
    }
  );

  modal.querySelector('#modalCancelBtn').addEventListener('click', () => closeModal(modal));
  modal.querySelector('#modalSaveBtn').addEventListener('click', () => saveTeacher(modal, teacherId));
}

async function saveTeacher(modal, teacherId = null) {
  const name = modal.querySelector('#tfName').value.trim();
  const subject = modal.querySelector('#tfSubject').value.trim();
  if (!name || !subject) {
    showToast('Name and Subject are required.', 'warning');
    return;
  }

  const joinDateVal = modal.querySelector('#tfJoinDate').value;
  const data = {
    name,
    subject,
    phone: modal.querySelector('#tfPhone').value.trim(),
    email: modal.querySelector('#tfEmail').value.trim(),
    designation: modal.querySelector('#tfDesignation').value.trim(),
    joinDate: joinDateVal ? Timestamp.fromDate(new Date(joinDateVal)) : null,
    bio: modal.querySelector('#tfBio').value.trim(),
    active: modal.querySelector('#tfActive').checked
  };

  const saveBtn = modal.querySelector('#modalSaveBtn');
  saveBtn.classList.add('loading');
  saveBtn.disabled = true;

  try {
    if (teacherId) {
      await updateDoc(doc(db, 'teachers', teacherId), data);
      showToast('Teacher updated!', 'success');
    } else {
      await addDoc(collection(db, 'teachers'), data);
      showToast('Teacher added!', 'success');
    }
    closeModal(modal);
    await loadTeachers();
  } catch (err) {
    console.error('Error saving teacher:', err);
    showToast('Failed to save teacher.', 'error');
  } finally {
    saveBtn.classList.remove('loading');
    saveBtn.disabled = false;
  }
}

async function toggleTeacher(id, currentlyActive) {
  try {
    await updateDoc(doc(db, 'teachers', id), { active: !currentlyActive });
    showToast(`Teacher ${currentlyActive ? 'deactivated' : 'activated'}.`, 'success');
    await loadTeachers();
  } catch (err) {
    showToast('Failed to update status.', 'error');
  }
}

async function deleteTeacher(id, name) {
  showConfirm('Delete Teacher', `Are you sure you want to delete <strong>${name}</strong>?`, async () => {
    try {
      showSpinner('Deleting...');
      await deleteDoc(doc(db, 'teachers', id));
      showToast('Teacher deleted.', 'success');
      await loadTeachers();
    } catch (err) {
      showToast('Failed to delete teacher.', 'error');
    } finally {
      hideSpinner();
    }
  });
}

window._editTeacher = (id) => openTeacherForm(id);
window._toggleTeacher = (id, active) => toggleTeacher(id, active);
window._deleteTeacher = (id, name) => deleteTeacher(id, name);

init();
