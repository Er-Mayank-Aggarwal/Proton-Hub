// =============================================
// PROTON HUB ADMIN — Students CRUD
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar, updateSidebarUser } from './sidebar.js';
import {
  showToast, showConfirm, showModal, closeModal,
  showSpinner, hideSpinner, exportToCSV, formatDate,
  paginate, renderPagination, debounce, escapeHTML
} from './utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  Timestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SUBJECTS = ['English', 'Hindi', 'Punjabi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer Science'];
let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
const PER_PAGE = 10;

async function init() {
  try {
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Students', 'fas fa-user-graduate'));
    initSidebar(null);
    const user = await checkAuth();
    updateSidebarUser(user);

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
      const data = docSnap.data();
      // One-off migration for existing records
      if (!data.session) {
        data.session = '2026-27';
        updateDoc(doc(db, 'students', docSnap.id), { session: '2026-27' }).catch(e => console.error(e));
      }
      allStudents.push({ id: docSnap.id, ...data });
    });
    // Sort by name
    allStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    applyFilters();
  } catch (err) {
    console.error('Error loading students:', err);
    showToast('Failed to load students.', 'error');
    document.getElementById('studentsBody').innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i>
        <h4>Access Denied / Error</h4>
        <p>Please check your Firebase Firestore Database Rules.</p>
      </div>
    </td></tr>`;
  }
}

function calculateFeeStatus(student) {
  const totalFee = Number(student.totalFee) || 0;
  const payments = student.payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Math.max(0, totalFee - totalPaid);
  
  let status = 'pending';
  if (student.feeStructure === 'annual') {
    if (totalPaid >= totalFee && totalFee > 0) status = 'paid';
    else if (totalPaid > 0) status = 'partial';
  } else if (student.feeStructure === 'installments') {
    if (totalPaid >= totalFee && totalFee > 0) {
       status = 'paid';
    } else {
       if (student.installmentStartDate) {
         const anchor = student.installmentStartDate.toDate ? student.installmentStartDate.toDate() : new Date(student.installmentStartDate);
         const now = new Date();
         
         // Determine current cycle start
         let cycleStart = new Date(now.getFullYear(), now.getMonth(), anchor.getDate());
         if (now.getTime() < cycleStart.getTime()) {
           cycleStart.setMonth(cycleStart.getMonth() - 1);
         }
         
         // Cycle end is exactly 1 month after cycle start
         let cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, anchor.getDate());
         
         // Sum payments strictly within this cycle
         const cyclePayments = payments.filter(p => {
           const pd = new Date(p.date);
           return pd.getTime() >= cycleStart.getTime() && pd.getTime() < cycleEnd.getTime();
         });
         
         const sumCycle = cyclePayments.reduce((acc, p) => acc + Number(p.amount), 0);
         const monthlyAmount = totalFee / 12;
         
         if (sumCycle >= monthlyAmount && monthlyAmount > 0) {
           status = 'paid'; // Fully paid for current month
         } else if (sumCycle > 0) {
           status = 'partial'; // Partially paid for current month
         } else {
           status = 'pending'; // No payments in current cycle
         }
       } else {
         if (totalPaid > 0) status = 'partial';
       }
    }
  } else {
    // Fallback for older records
    if (totalPaid >= totalFee && totalFee > 0) status = 'paid';
    else if (totalPaid > 0) status = 'partial';
    else status = student.feeStatus || 'pending';
  }

  return { totalPaid, pendingAmount, status };
}

function applyFilters() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const sessionFilter = document.getElementById('filterSession')?.value || '';
  const classFilter = document.getElementById('filterClass')?.value || '';

  filteredStudents = allStudents.filter(s => {
    const matchSearch = !searchTerm ||
      (s.name || '').toLowerCase().includes(searchTerm) ||
      (s.class || '').toLowerCase().includes(searchTerm);
    const matchSession = !sessionFilter || s.session === sessionFilter;
    const matchClass = !classFilter || s.class === classFilter;
    return matchSearch && matchSession && matchClass;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('studentsBody');
  const paginationContainer = document.getElementById('paginationContainer');

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
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

  tbody.innerHTML = items.map(s => {
    const feeInfo = calculateFeeStatus(s);
    return `
    <tr>
      <td><strong>${escapeHTML(s.name || '')}</strong></td>
      <td>${escapeHTML(s.class || '')}</td>
      <td>${escapeHTML(s.phone || '—')}</td>
      <td>${escapeHTML(s.parentName || '—')}</td>
      <td>₹${escapeHTML(s.totalFee || '0')}</td>
      <td>₹${feeInfo.pendingAmount}</td>
      <td>${feeBadge(feeInfo.status)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon btn-sm" title="Manage Payments" onclick="window._managePayments('${s.id}')">
            <i class="fas fa-rupee-sign" style="color:var(--success)"></i>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Edit" onclick="window._editStudent('${s.id}')">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Delete" onclick="window._deleteStudent('${s.id}', '${escapeHTML(s.name || '')}')">
            <i class="fas fa-trash-alt" style="color:var(--danger)"></i>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');

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
  document.getElementById('filterSession')?.addEventListener('change', () => applyFilters());
  document.getElementById('filterClass')?.addEventListener('change', () => applyFilters());
  document.getElementById('addStudentBtn')?.addEventListener('click', () => openStudentForm());
  document.getElementById('viewAllPaymentsBtn')?.addEventListener('click', () => openAllPaymentsModal());
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    const exportData = filteredStudents.map(s => {
      const feeInfo = calculateFeeStatus(s);
      return {
        Name: s.name, Class: s.class, Session: s.session || '-', Phone: s.phone,
        'Parent Name': s.parentName, 'Parent Phone': s.parentPhone,
        'Fee Structure': s.feeStructure || 'annual', 'Total Fee': s.totalFee || 0,
        'Total Paid': feeInfo.totalPaid, 'Pending Amount': feeInfo.pendingAmount,
        'Fee Status': feeInfo.status, 'Admission Date': formatDate(s.admissionDate), Notes: s.notes
      };
    });
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
            ${['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12']
              .map(c => `<option value="${c}" ${s.class === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Session <span class="required">*</span></label>
          <select class="form-select" id="sfSession" required>
            <option value="2025-26" ${s.session === '2025-26' ? 'selected' : ''}>2025-26</option>
            <option value="2026-27" ${s.session === '2026-27' || !s.session ? 'selected' : ''}>2026-27</option>
            <option value="2027-28" ${s.session === '2027-28' ? 'selected' : ''}>2027-28</option>
          </select>
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
          <label>Fee Structure <span class="required">*</span></label>
          <select class="form-select" id="sfFeeStructure" required onchange="document.getElementById('installmentDiv').style.display = this.value === 'installments' ? 'block' : 'none'">
            <option value="annual" ${s.feeStructure !== 'installments' ? 'selected' : ''}>Annual (Complete)</option>
            <option value="installments" ${s.feeStructure === 'installments' ? 'selected' : ''}>Installments</option>
          </select>
        </div>
        <div class="form-group">
          <label>Total Fee Amount (₹) <span class="required">*</span></label>
          <input type="number" class="form-input" id="sfTotalFee" value="${escapeHTML(s.totalFee || '')}" required min="0">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group" id="installmentDiv" style="display: ${s.feeStructure === 'installments' ? 'block' : 'none'}">
          <label>Installment Start Date</label>
          <input type="date" class="form-input" id="sfInstallmentStart" value="${s.installmentStartDate?.toDate ? s.installmentStartDate.toDate().toISOString().split('T')[0] : (s.installmentStartDate || '')}">
        </div>
        <div class="form-group">
          <label>Admission Date</label>
          <input type="date" class="form-input" id="sfAdmissionDate" value="${s.admissionDate?.toDate ? s.admissionDate.toDate().toISOString().split('T')[0] : (s.admissionDate || '')}">
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
  if (!form.reportValidity()) return;

  const name = modal.querySelector('#sfName').value.trim();
  const cls = modal.querySelector('#sfClass').value;
  const session = modal.querySelector('#sfSession').value;
  const parentName = modal.querySelector('#sfParentName').value.trim();
  const feeStructure = modal.querySelector('#sfFeeStructure').value;
  const totalFee = Number(modal.querySelector('#sfTotalFee').value) || 0;
  const installmentStartVal = modal.querySelector('#sfInstallmentStart').value;

  if (!name || !cls || !parentName || !session) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  const subjects = [];
  modal.querySelectorAll('.subject-checkbox:checked').forEach(cb => subjects.push(cb.value));

  const admissionDateVal = modal.querySelector('#sfAdmissionDate').value;

  const data = {
    name,
    class: cls,
    session,
    phone: modal.querySelector('#sfPhone').value.trim(),
    subjects,
    parentName,
    parentPhone: modal.querySelector('#sfParentPhone').value.trim(),
    feeStructure,
    totalFee,
    installmentStartDate: feeStructure === 'installments' && installmentStartVal ? Timestamp.fromDate(new Date(installmentStartVal)) : null,
    admissionDate: admissionDateVal ? Timestamp.fromDate(new Date(admissionDateVal)) : null,
    notes: modal.querySelector('#sfNotes').value.trim()
  };

  if (!studentId) {
    data.payments = []; // Initialize empty payments array for new students
  }

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

window._managePayments = (id) => openPaymentsModal(id);

function openPaymentsModal(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return;

  const feeInfo = calculateFeeStatus(student);

  const bodyHTML = `
    <div class="payment-summary" style="display:flex; justify-content:space-between; background:var(--bg-light); padding:1rem; border-radius:8px; margin-bottom:1rem;">
      <div><strong>Total Fee:</strong> ₹${student.totalFee || 0}</div>
      <div><strong>Paid:</strong> ₹${feeInfo.totalPaid}</div>
      <div><strong>Pending:</strong> ₹${feeInfo.pendingAmount}</div>
      <div><strong>Status:</strong> ${feeInfo.status.toUpperCase()}</div>
    </div>
    
    <form id="paymentForm" style="display:flex; gap:0.5rem; align-items:flex-end; margin-bottom:1.5rem; border-bottom: 1px solid var(--border); padding-bottom:1rem;">
      <div class="form-group" style="flex:1; margin:0;">
        <label style="font-size:0.8rem">Date</label>
        <input type="date" class="form-input" id="payDate" required value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group" style="flex:1; margin:0;">
        <label style="font-size:0.8rem">Amount (₹)</label>
        <input type="number" class="form-input" id="payAmount" required min="1" max="${feeInfo.pendingAmount > 0 ? feeInfo.pendingAmount : ''}">
      </div>
      <div class="form-group" style="flex:2; margin:0;">
        <label style="font-size:0.8rem">Description</label>
        <input type="text" class="form-input" id="payDesc" placeholder="e.g. June Installment">
      </div>
      <button type="submit" class="btn btn-primary" id="addPaymentBtn">Add</button>
    </form>

    <div class="payment-history">
      <h4 style="margin-bottom:0.5rem">Payment History</h4>
      <div id="paymentListContainer" style="max-height:300px; overflow-y:auto;">
        ${renderPaymentsList(student.payments || [])}
      </div>
    </div>
  `;

  const modal = showModal(`Manage Payments - ${escapeHTML(student.name)}`, bodyHTML, {
    icon: 'fas fa-rupee-sign', maxWidth: '650px',
    footerHTML: `<button class="btn btn-secondary" id="modalCloseBtn">Close</button>`
  });

  modal.querySelector('#modalCloseBtn').addEventListener('click', () => closeModal(modal));

  modal.querySelector('#paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.querySelector('#addPaymentBtn');
    const dVal = modal.querySelector('#payDate').value;
    const aVal = Number(modal.querySelector('#payAmount').value);
    const descVal = modal.querySelector('#payDesc').value.trim();

    if (!dVal || aVal <= 0) return;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const newPayment = {
        id: Date.now().toString(),
        date: dVal,
        amount: aVal,
        description: descVal,
        createdAt: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'students', studentId), {
        payments: arrayUnion(newPayment)
      });
      
      showToast('Payment added!', 'success');
      
      // Update local state
      if (!student.payments) student.payments = [];
      student.payments.push(newPayment);
      
      // Re-render
      closeModal(modal);
      applyFilters(); // will re-render table
      setTimeout(() => openPaymentsModal(studentId), 300); // reopen modal with updated data
    } catch (err) {
      console.error(err);
      showToast('Error adding payment', 'error');
      btn.disabled = false;
      btn.textContent = 'Add';
    }
  });
}

function renderPaymentsList(payments) {
  if (!payments || payments.length === 0) return `<div class="empty-state" style="padding:1rem;"><p>No payments recorded yet.</p></div>`;
  
  // Sort payments newest first
  const sorted = [...payments].sort((a,b) => new Date(b.date) - new Date(a.date));
  
  return sorted.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border:1px solid var(--border); border-radius:6px; margin-bottom:0.5rem; background:#fff;">
      <div>
        <div style="font-weight:600;">₹${p.amount}</div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${escapeHTML(p.description || 'No description')}</div>
      </div>
      <div style="text-align:right; font-size:0.85rem; color:var(--text-secondary);">
        <div><i class="far fa-calendar-alt"></i> ${formatDate(p.date)}</div>
      </div>
    </div>
  `).join('');
}

function openAllPaymentsModal() {
  let allPaymentsList = [];
  
  allStudents.forEach(s => {
    if (s.payments && s.payments.length > 0) {
      s.payments.forEach(p => {
        allPaymentsList.push({
          studentName: s.name,
          studentClass: s.class,
          studentId: s.id,
          date: p.date,
          amount: p.amount,
          description: p.description
        });
      });
    }
  });
  
  allPaymentsList.sort((a,b) => new Date(b.date) - new Date(a.date)); // Newest first
  
  const bodyHTML = `
    <div style="display:flex; gap:0.5rem; align-items:flex-end; margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
      <div class="form-group" style="flex:1; margin:0;">
        <label style="font-size:0.8rem">Start Date</label>
        <input type="date" class="form-input" id="ledgerStartDate">
      </div>
      <div class="form-group" style="flex:1; margin:0;">
        <label style="font-size:0.8rem">End Date</label>
        <input type="date" class="form-input" id="ledgerEndDate">
      </div>
      <button class="btn btn-secondary" id="ledgerFilterBtn">Filter</button>
      <button class="btn btn-ghost" id="ledgerClearBtn">Clear</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-light); padding:1.2rem; border-radius:8px; margin-bottom:1rem;">
      <div>
        <div style="font-size:0.9rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Filtered Revenue</div>
        <div style="font-size:1.8rem; font-weight:700; color:var(--success);" id="ledgerTotalAmount">₹0</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.9rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Transactions</div>
        <div style="font-size:1.2rem; font-weight:600;" id="ledgerTotalCount">0</div>
      </div>
    </div>
    <div id="allPaymentsListContainer" style="max-height:350px; overflow-y:auto; padding-right:0.5rem;">
    </div>
  `;

  const modal = showModal('All Payments Ledger', bodyHTML, {
    icon: 'fas fa-book', maxWidth: '700px',
    footerHTML: `<button class="btn btn-secondary" id="modalCloseBtn">Close</button>`
  });
  
  modal.id = 'allPaymentsModal'; // For closing programmatically via the link

  const listContainer = modal.querySelector('#allPaymentsListContainer');
  const amtDisplay = modal.querySelector('#ledgerTotalAmount');
  const countDisplay = modal.querySelector('#ledgerTotalCount');
  
  const startDateInput = modal.querySelector('#ledgerStartDate');
  const endDateInput = modal.querySelector('#ledgerEndDate');

  function renderFiltered() {
    const sDate = startDateInput.value ? new Date(startDateInput.value) : null;
    const eDate = endDateInput.value ? new Date(endDateInput.value) : null;
    
    if (eDate) {
      eDate.setHours(23, 59, 59, 999);
    }
    
    const filtered = allPaymentsList.filter(p => {
      const pd = new Date(p.date);
      if (sDate && pd.getTime() < sDate.getTime()) return false;
      if (eDate && pd.getTime() > eDate.getTime()) return false;
      return true;
    });
    
    const totalCollected = filtered.reduce((sum, p) => sum + Number(p.amount), 0);
    amtDisplay.textContent = '₹' + totalCollected.toLocaleString('en-IN');
    countDisplay.textContent = filtered.length;
    
    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-state" style="padding:2rem;"><p>No payments found for the selected dates.</p></div>`;
    } else {
      listContainer.innerHTML = filtered.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; border:1px solid var(--border); border-radius:6px; margin-bottom:0.5rem; background:#fff;">
          <div>
            <div style="font-weight:600; font-size:1.05rem;">₹${p.amount} <span style="font-weight:400; font-size:0.85rem; color:var(--text-secondary); margin-left:0.5rem;">from ${escapeHTML(p.studentName)} (${escapeHTML(p.studentClass)})</span></div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${escapeHTML(p.description || 'No description')}</div>
          </div>
          <div style="text-align:right; font-size:0.85rem; color:var(--text-secondary);">
            <div><i class="far fa-calendar-alt"></i> ${formatDate(p.date)}</div>
            <button class="btn btn-ghost btn-icon btn-sm" title="Manage Student Payments" onclick="closeModal(document.getElementById('allPaymentsModal')); setTimeout(() => window._managePayments('${p.studentId}'), 300)" style="margin-top:4px;">
              <i class="fas fa-external-link-alt"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  modal.querySelector('#ledgerFilterBtn').addEventListener('click', renderFiltered);
  modal.querySelector('#ledgerClearBtn').addEventListener('click', () => {
    startDateInput.value = '';
    endDateInput.value = '';
    renderFiltered();
  });

  modal.querySelector('#modalCloseBtn').addEventListener('click', () => closeModal(modal));
  
  // Initial render
  renderFiltered();
}

// Global handlers for inline onclick
window._editStudent = (id) => openStudentForm(id);
window._deleteStudent = (id, name) => deleteStudent(id, name);

init();
