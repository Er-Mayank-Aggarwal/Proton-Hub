// =============================================
// PROTON HUB ADMIN — Students CRUD
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import {
  showToast, showConfirm, showModal, closeModal,
  showSpinner, hideSpinner, exportToCSV, formatDate,
  paginate, renderPagination, debounce, escapeHTML
} from './utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SUBJECTS = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer Science'];
let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
const PER_PAGE = 10;

async function init() {
  try {
    const user = await checkAuth();
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Students', 'fas fa-user-graduate'));
    initSidebar(user);

    // Hamburger
    document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('active');
    });

    await loadStudents();
    setupEventListeners();

    // Check if we should auto-open add modal
    if (new URLSearchParams(window.location.search).get('action') === 'add') {
      openStudentForm();
    }
  } catch (err) {
    console.error('Students init error:', err);
  }
}

async function loadStudents() {
  try {
    const snap = await getDocs(collection(db, 'students'));
    allStudents = [];
    snap.forEach(docSnap => {
      allStudents.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by name
    allStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    applyFilters();
  } catch (err) {
    console.error('Error loading students:', err);
    showToast('Failed to load students.', 'error');
    document.getElementById('studentsBody').innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i>
        <h4>Access Denied / Error</h4>
        <p>Please check your Firebase Firestore Database Rules.</p>
      </div>
    </td></tr>`;
  }
}

function applyFilters() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const classFilter = document.getElementById('filterClass')?.value || '';
  const feeFilter = document.getElementById('filterFee')?.value || '';

  filteredStudents = allStudents.filter(s => {
    const matchSearch = !searchTerm ||
      (s.name || '').toLowerCase().includes(searchTerm) ||
      (s.class || '').toLowerCase().includes(searchTerm);
    const matchClass = !classFilter || s.class === classFilter;
    const matchFee = !feeFilter || s.feeStatus === feeFilter;
    return matchSearch && matchClass && matchFee;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('studentsBody');
  const paginationContainer = document.getElementById('paginationContainer');

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <i class="fas fa-user-graduate"></i>
        <h4>No students found</h4>
        <p>Try adjusting your filters or add a new student.</p>
      </div>
    </td></tr>`;
    paginationContainer.innerHTML = '';
    return;
  }

  const { items, totalPages, currentPage: page, total, start, end } = paginate(filteredStudents, currentPage, PER_PAGE);

  const feeBadge = (status) => {
    const map = { paid: 'badge-paid', pending: 'badge-pending', partial: 'badge-partial' };
    return `<span class="badge ${map[status] || 'badge-inactive'}">${escapeHTML(status || 'N/A')}</span>`;
  };

  tbody.innerHTML = items.map(s => `
    <tr>
      <td><strong>${escapeHTML(s.name || '')}</strong></td>
      <td>${escapeHTML(s.class || '')}</td>
      <td>${escapeHTML(s.section || '—')}</td>
      <td>${escapeHTML(s.phone || '—')}</td>
      <td>${escapeHTML(s.parentName || '—')}</td>
      <td>${feeBadge(s.feeStatus)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon btn-sm" title="Edit" onclick="window._editStudent('${s.id}')">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Delete" onclick="window._deleteStudent('${s.id}', '${escapeHTML(s.name || '')}')">
            <i class="fas fa-trash-alt" style="color:var(--danger)"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  paginationContainer.innerHTML = renderPagination(page, totalPages, total, start, end);

  // Pagination click handlers
  paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (!isNaN(p)) {
        currentPage = p;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function setupEventListeners() {
  document.getElementById('searchInput')?.addEventListener('input', debounce(() => applyFilters(), 250));
  document.getElementById('filterClass')?.addEventListener('change', () => applyFilters());
  document.getElementById('filterFee')?.addEventListener('change', () => applyFilters());
  document.getElementById('addStudentBtn')?.addEventListener('click', () => openStudentForm());
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    const exportData = filteredStudents.map(s => ({
      Name: s.name, Class: s.class, Section: s.section, Phone: s.phone,
      'Parent Name': s.parentName, 'Parent Phone': s.parentPhone,
      'Fee Status': s.feeStatus, 'Admission Date': formatDate(s.admissionDate), Notes: s.notes
    }));
    exportToCSV(exportData, 'protonhub_students');
  });
}

function getFormHTML(student = null) {
  const s = student || {};
  const subjectCheckboxes = SUBJECTS.map(subj => {
    const checked = (s.subjects || []).includes(subj) ? 'checked' : '';
    const id = 'subj_' + subj.replace(/\s+/g, '_');
    return `<input type="checkbox" class="subject-checkbox" id="${id}" value="${subj}" ${checked}>
            <label class="subject-label" for="${id}"><i class="fas fa-check" style="font-size:0.7rem;"></i> ${subj}</label>`;
  }).join('');

  return `
    <form id="studentForm">
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="sfName" value="${escapeHTML(s.name || '')}" required placeholder="Student's full name">
        </div>
        <div class="form-group">
          <label>Class <span class="required">*</span></label>
          <select class="form-select" id="sfClass" required>
            <option value="">Select Class</option>
            ${['Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
              .map(c => `<option value="${c}" ${s.class === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Section</label>
          <input type="text" class="form-input" id="sfSection" value="${escapeHTML(s.section || '')}" placeholder="e.g., A, B">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" class="form-input" id="sfPhone" value="${escapeHTML(s.phone || '')}" placeholder="10-digit number" maxlength="10" pattern="\\d{10}">
        </div>
      </div>
      <div class="form-group">
        <label>Subjects</label>
        <div class="subject-selector">${subjectCheckboxes}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Parent Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="sfParentName" value="${escapeHTML(s.parentName || '')}" required placeholder="Parent's name">
        </div>
        <div class="form-group">
          <label>Parent Phone</label>
          <input type="tel" class="form-input" id="sfParentPhone" value="${escapeHTML(s.parentPhone || '')}" placeholder="10-digit number" maxlength="10">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Admission Date</label>
          <input type="date" class="form-input" id="sfAdmissionDate" value="${s.admissionDate?.toDate ? s.admissionDate.toDate().toISOString().split('T')[0] : (s.admissionDate || '')}">
        </div>
        <div class="form-group">
          <label>Fee Status <span class="required">*</span></label>
          <select class="form-select" id="sfFeeStatus" required>
            <option value="pending" ${s.feeStatus === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="paid" ${s.feeStatus === 'paid' ? 'selected' : ''}>Paid</option>
            <option value="partial" ${s.feeStatus === 'partial' ? 'selected' : ''}>Partial</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-textarea" id="sfNotes" rows="3" placeholder="Any additional notes...">${escapeHTML(s.notes || '')}</textarea>
      </div>
    </form>
  `;
}

function openStudentForm(studentId = null) {
  const student = studentId ? allStudents.find(s => s.id === studentId) : null;
  const isEdit = !!student;

  const modal = showModal(
    isEdit ? 'Edit Student' : 'Add New Student',
    getFormHTML(student),
    {
      icon: isEdit ? 'fas fa-pen' : 'fas fa-user-plus',
      maxWidth: '640px',
      footerHTML: `
        <button class="btn btn-secondary" id="modalCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="modalSaveBtn">
          <span class="btn-text"><i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Save'} Student</span>
          <span class="btn-spinner"></span>
        </button>
      `
    }
  );

  modal.querySelector('#modalCancelBtn').addEventListener('click', () => closeModal(modal));
  modal.querySelector('#modalSaveBtn').addEventListener('click', () => saveStudent(modal, studentId));
}

async function saveStudent(modal, studentId = null) {
  const form = modal.querySelector('#studentForm');
  const name = modal.querySelector('#sfName').value.trim();
  const cls = modal.querySelector('#sfClass').value;
  const parentName = modal.querySelector('#sfParentName').value.trim();
  const feeStatus = modal.querySelector('#sfFeeStatus').value;

  if (!name || !cls || !parentName || !feeStatus) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  const subjects = [];
  modal.querySelectorAll('.subject-checkbox:checked').forEach(cb => subjects.push(cb.value));

  const admissionDateVal = modal.querySelector('#sfAdmissionDate').value;

  const data = {
    name,
    class: cls,
    section: modal.querySelector('#sfSection').value.trim(),
    phone: modal.querySelector('#sfPhone').value.trim(),
    subjects,
    parentName,
    parentPhone: modal.querySelector('#sfParentPhone').value.trim(),
    feeStatus,
    admissionDate: admissionDateVal ? Timestamp.fromDate(new Date(admissionDateVal)) : null,
    notes: modal.querySelector('#sfNotes').value.trim()
  };

  const saveBtn = modal.querySelector('#modalSaveBtn');
  saveBtn.classList.add('loading');
  saveBtn.disabled = true;

  try {
    if (studentId) {
      await updateDoc(doc(db, 'students', studentId), data);
      showToast('Student updated successfully!', 'success');
    } else {
      await addDoc(collection(db, 'students'), data);
      showToast('Student added successfully!', 'success');
    }
    closeModal(modal);
    await loadStudents();
  } catch (err) {
    console.error('Error saving student:', err);
    showToast('Failed to save student. Please try again.', 'error');
  } finally {
    saveBtn.classList.remove('loading');
    saveBtn.disabled = false;
  }
}

async function deleteStudent(id, name) {
  showConfirm(
    'Delete Student',
    `Are you sure you want to delete <strong>${name}</strong>? This action cannot be undone.`,
    async () => {
      try {
        showSpinner('Deleting...');
        await deleteDoc(doc(db, 'students', id));
        showToast('Student deleted.', 'success');
        await loadStudents();
      } catch (err) {
        console.error('Error deleting student:', err);
        showToast('Failed to delete student.', 'error');
      } finally {
        hideSpinner();
      }
    }
  );
}

// Global handlers for inline onclick
window._editStudent = (id) => openStudentForm(id);
window._deleteStudent = (id, name) => deleteStudent(id, name);

init();
