// =============================================
// PROTON HUB ADMIN — Content Editor
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import {
  showToast, showConfirm, showModal, closeModal,
  showSpinner, hideSpinner, formatDate, truncate, escapeHTML
} from './utils.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allTestimonials = [];
let allResults = [];

async function init() {
  try {
    const user = await checkAuth();
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Content Editor', 'fas fa-edit'));
    initSidebar(user);

    document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('active');
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Load all data
    await Promise.all([loadSiteConfig(), loadTestimonials(), loadResults()]);

    // Save handlers
    document.getElementById('saveHeroBtn')?.addEventListener('click', saveHero);
    document.getElementById('saveCoursesBtn')?.addEventListener('click', saveCourses);
    document.getElementById('saveDirectorBtn')?.addEventListener('click', saveDirector);
    document.getElementById('addTestimonialBtn')?.addEventListener('click', () => openTestimonialForm());
    document.getElementById('addResultBtn')?.addEventListener('click', () => openResultForm());
  } catch (err) {
    console.error('Content editor init error:', err);
  }
}

// ---- Site Config (Hero, Director) ----
async function loadSiteConfig() {
  try {
    const displayDoc = await getDoc(doc(db, 'siteConfig', 'display'));
    if (displayDoc.exists()) {
      const data = displayDoc.data();
      document.getElementById('heroHeading').value = data.heroHeading || '';
      document.getElementById('heroSubtext').value = data.heroSubtext || '';
      document.getElementById('heroCtaText').value = data.heroCtaText || '';
      document.getElementById('directorQuote').value = data.directorQuote || '';
    }

    const coursesDoc = await getDoc(doc(db, 'siteConfig', 'courses'));
    if (coursesDoc.exists()) {
      const data = coursesDoc.data();
      const c58 = data.class5to8 || {};
      const c910 = data.class9to10 || {};
      const c1112 = data.class11to12 || {};
      document.getElementById('course58Subjects').value = (c58.subjects || []).join(', ');
      document.getElementById('course58Highlights').value = (c58.highlights || []).join(', ');
      document.getElementById('course910Subjects').value = (c910.subjects || []).join(', ');
      document.getElementById('course910Highlights').value = (c910.highlights || []).join(', ');
      document.getElementById('course1112Subjects').value = (c1112.subjects || []).join(', ');
      document.getElementById('course1112Highlights').value = (c1112.highlights || []).join(', ');
    }
  } catch (err) {
    console.error('Error loading site config:', err);
  }
}

async function saveHero() {
  try {
    const existing = await getExistingDisplayFields();
    await setDoc(doc(db, 'siteConfig', 'display'), {
      ...existing,
      heroHeading: document.getElementById('heroHeading').value.trim(),
      heroSubtext: document.getElementById('heroSubtext').value.trim(),
      heroCtaText: document.getElementById('heroCtaText').value.trim(),
      directorQuote: document.getElementById('directorQuote').value.trim()
    });
    flashSave('heroSaveIndicator');
    showToast('Hero section saved!', 'success');
  } catch (err) {
    console.error('Error saving hero:', err);
    showToast('Failed to save.', 'error');
  }
}

async function saveDirector() {
  try {
    const existing = await getExistingDisplayFields();
    await setDoc(doc(db, 'siteConfig', 'display'), {
      ...existing,
      directorQuote: document.getElementById('directorQuote').value.trim()
    });
    flashSave('directorSaveIndicator');
    showToast('Director\'s quote saved!', 'success');
  } catch (err) {
    showToast('Failed to save.', 'error');
  }
}

async function saveCourses() {
  const toArray = (val) => val.split(',').map(s => s.trim()).filter(s => s);
  try {
    await setDoc(doc(db, 'siteConfig', 'courses'), {
      class5to8: {
        subjects: toArray(document.getElementById('course58Subjects').value),
        highlights: toArray(document.getElementById('course58Highlights').value)
      },
      class9to10: {
        subjects: toArray(document.getElementById('course910Subjects').value),
        highlights: toArray(document.getElementById('course910Highlights').value)
      },
      class11to12: {
        subjects: toArray(document.getElementById('course1112Subjects').value),
        highlights: toArray(document.getElementById('course1112Highlights').value)
      }
    });
    flashSave('coursesSaveIndicator');
    showToast('Courses saved!', 'success');
  } catch (err) {
    showToast('Failed to save courses.', 'error');
  }
}

async function getExistingDisplayFields() {
  try {
    const docSnap = await getDoc(doc(db, 'siteConfig', 'display'));
    return docSnap.exists() ? docSnap.data() : {};
  } catch { return {}; }
}

function flashSave(indicatorId) {
  const el = document.getElementById(indicatorId);
  if (el) {
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 2500);
  }
}

// ---- Testimonials CRUD ----
async function loadTestimonials() {
  try {
    const snap = await getDocs(collection(db, 'testimonials'));
    allTestimonials = [];
    snap.forEach(d => allTestimonials.push({ id: d.id, ...d.data() }));
    renderTestimonials();
  } catch (err) {
    console.error('Error loading testimonials:', err);
  }
}

function renderTestimonials() {
  const tbody = document.getElementById('testimonialsBody');
  if (allTestimonials.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-comments"></i><h4>No testimonials</h4></div></td></tr>';
    return;
  }
  tbody.innerHTML = allTestimonials.map(t => `
    <tr>
      <td><strong>${escapeHTML(t.parentName || '')}</strong></td>
      <td class="text-sm" style="max-width:200px;">${escapeHTML(truncate(t.quote || '', 60))}</td>
      <td class="text-sm">${escapeHTML(t.relation || '—')}</td>
      <td>
        <label class="toggle"><input type="checkbox" ${t.active !== false ? 'checked' : ''} onchange="window._toggleTestimonial('${t.id}', this.checked)"><span class="toggle-slider"></span></label>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="window._editTestimonial('${t.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="window._deleteTestimonial('${t.id}')"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openTestimonialForm(id = null) {
  const t = id ? allTestimonials.find(x => x.id === id) : {};
  const isEdit = !!id;
  const modal = showModal(isEdit ? 'Edit Testimonial' : 'Add Testimonial', `
    <div class="form-group"><label>Parent Name <span class="required">*</span></label><input class="form-input" id="tmParent" value="${escapeHTML(t.parentName || '')}"></div>
    <div class="form-group"><label>Quote <span class="required">*</span></label><textarea class="form-textarea" id="tmQuote" rows="3">${escapeHTML(t.quote || '')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Student Class</label><input class="form-input" id="tmClass" value="${escapeHTML(t.studentClass || '')}"></div>
      <div class="form-group"><label>Relation</label><input class="form-input" id="tmRelation" value="${escapeHTML(t.relation || '')}" placeholder="e.g., Father of Class 10 Student"></div>
    </div>
    <div class="form-group"><label>Photo URL</label><input class="form-input" id="tmPhoto" value="${escapeHTML(t.photoUrl || '')}" placeholder="https://..."></div>
    <div class="form-group"><div class="toggle-wrapper"><label class="toggle"><input type="checkbox" id="tmActive" ${t.active !== false ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Active</span></div></div>
  `, {
    icon: 'fas fa-comments', maxWidth: '520px',
    footerHTML: `<button class="btn btn-secondary" id="modalCancelBtn">Cancel</button><button class="btn btn-primary" id="modalSaveBtn"><i class="fas fa-save"></i> Save</button>`
  });

  modal.querySelector('#modalCancelBtn').addEventListener('click', () => closeModal(modal));
  modal.querySelector('#modalSaveBtn').addEventListener('click', async () => {
    const parentName = modal.querySelector('#tmParent').value.trim();
    const quote = modal.querySelector('#tmQuote').value.trim();
    if (!parentName || !quote) { showToast('Name and quote required.', 'warning'); return; }

    const data = {
      parentName, quote,
      studentClass: modal.querySelector('#tmClass').value.trim(),
      relation: modal.querySelector('#tmRelation').value.trim(),
      photoUrl: modal.querySelector('#tmPhoto').value.trim(),
      active: modal.querySelector('#tmActive').checked
    };

    try {
      if (id) { await updateDoc(doc(db, 'testimonials', id), data); }
      else { await addDoc(collection(db, 'testimonials'), data); }
      showToast('Testimonial saved!', 'success');
      closeModal(modal);
      await loadTestimonials();
    } catch (err) { showToast('Failed to save.', 'error'); }
  });
}

async function toggleTestimonial(id, active) {
  try { await updateDoc(doc(db, 'testimonials', id), { active }); await loadTestimonials(); } catch { showToast('Error.', 'error'); }
}

async function deleteTestimonial(id) {
  showConfirm('Delete Testimonial', 'Are you sure?', async () => {
    try { await deleteDoc(doc(db, 'testimonials', id)); showToast('Deleted.', 'success'); await loadTestimonials(); } catch { showToast('Error.', 'error'); }
  });
}

// ---- Results CRUD ----
async function loadResults() {
  try {
    const snap = await getDocs(collection(db, 'results'));
    allResults = [];
    snap.forEach(d => allResults.push({ id: d.id, ...d.data() }));
    renderResults();
  } catch (err) {
    console.error('Error loading results:', err);
  }
}

function renderResults() {
  const tbody = document.getElementById('resultsBody');
  if (allResults.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-trophy"></i><h4>No results</h4></div></td></tr>';
    return;
  }
  tbody.innerHTML = allResults.map(r => `
    <tr>
      <td><strong>${escapeHTML(r.studentName || '')}</strong></td>
      <td>${escapeHTML(r.percentage || '')}%</td>
      <td>${escapeHTML(r.class || '')}</td>
      <td>${escapeHTML(r.subject || '—')}</td>
      <td>
        <label class="toggle"><input type="checkbox" ${r.active !== false ? 'checked' : ''} onchange="window._toggleResult('${r.id}', this.checked)"><span class="toggle-slider"></span></label>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="window._editResult('${r.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="window._deleteResult('${r.id}')"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openResultForm(id = null) {
  const r = id ? allResults.find(x => x.id === id) : {};
  const isEdit = !!id;
  const modal = showModal(isEdit ? 'Edit Result' : 'Add Result', `
    <div class="form-row">
      <div class="form-group"><label>Student Name <span class="required">*</span></label><input class="form-input" id="rsName" value="${escapeHTML(r.studentName || '')}"></div>
      <div class="form-group"><label>Percentage <span class="required">*</span></label><input class="form-input" id="rsPercent" value="${escapeHTML(r.percentage || '')}" placeholder="e.g., 95.4"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Class</label><input class="form-input" id="rsClass" value="${escapeHTML(r.class || '')}"></div>
      <div class="form-group"><label>Subject (Topper in)</label><input class="form-input" id="rsSubject" value="${escapeHTML(r.subject || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Score</label><input class="form-input" id="rsScore" value="${escapeHTML(r.score || '')}" placeholder="e.g., 99/100"></div>
      <div class="form-group"><label>Image URL</label><input class="form-input" id="rsImage" value="${escapeHTML(r.imageUrl || '')}"></div>
    </div>
    <div class="form-group"><div class="toggle-wrapper"><label class="toggle"><input type="checkbox" id="rsActive" ${r.active !== false ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Active</span></div></div>
  `, {
    icon: 'fas fa-trophy', maxWidth: '520px',
    footerHTML: `<button class="btn btn-secondary" id="modalCancelBtn">Cancel</button><button class="btn btn-primary" id="modalSaveBtn"><i class="fas fa-save"></i> Save</button>`
  });

  modal.querySelector('#modalCancelBtn').addEventListener('click', () => closeModal(modal));
  modal.querySelector('#modalSaveBtn').addEventListener('click', async () => {
    const studentName = modal.querySelector('#rsName').value.trim();
    const percentage = modal.querySelector('#rsPercent').value.trim();
    if (!studentName || !percentage) { showToast('Name and percentage required.', 'warning'); return; }

    const data = {
      studentName, percentage,
      class: modal.querySelector('#rsClass').value.trim(),
      subject: modal.querySelector('#rsSubject').value.trim(),
      score: modal.querySelector('#rsScore').value.trim(),
      imageUrl: modal.querySelector('#rsImage').value.trim(),
      active: modal.querySelector('#rsActive').checked
    };

    try {
      if (id) { await updateDoc(doc(db, 'results', id), data); }
      else { await addDoc(collection(db, 'results'), data); }
      showToast('Result saved!', 'success');
      closeModal(modal);
      await loadResults();
    } catch (err) { showToast('Failed to save.', 'error'); }
  });
}

async function toggleResult(id, active) {
  try { await updateDoc(doc(db, 'results', id), { active }); await loadResults(); } catch { showToast('Error.', 'error'); }
}

async function deleteResult(id) {
  showConfirm('Delete Result', 'Are you sure?', async () => {
    try { await deleteDoc(doc(db, 'results', id)); showToast('Deleted.', 'success'); await loadResults(); } catch { showToast('Error.', 'error'); }
  });
}

// Global handlers
window._editTestimonial = (id) => openTestimonialForm(id);
window._toggleTestimonial = (id, active) => toggleTestimonial(id, active);
window._deleteTestimonial = (id) => deleteTestimonial(id);
window._editResult = (id) => openResultForm(id);
window._toggleResult = (id, active) => toggleResult(id, active);
window._deleteResult = (id) => deleteResult(id);

init();
