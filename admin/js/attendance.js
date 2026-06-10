// =============================================
// PROTON HUB ADMIN — Attendance Module
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar, updateSidebarUser } from './sidebar.js';
import {
  showToast, showSpinner, hideSpinner, formatDateFull, formatDateKey, escapeHTML
} from './utils.js';
import {
  collection, getDocs, doc, setDoc, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let selectedDate = new Date();
let studentsForClass = [];
let currentMode = 'students'; // 'students' or 'teachers'
let teachersList = []; // list of teachers

// =============================================
// DEMO / MOCK DATA FOR LOCAL TESTING
// =============================================
const MOCK_TEACHERS = [
  { id: 't1', name: 'Dr. Mayank Aggarwal', subject: 'Physics', active: true },
  { id: 't2', name: 'Mrs. Neha Sharma', subject: 'Chemistry', active: true },
  { id: 't3', name: 'Mr. Rajesh Verma', subject: 'Mathematics', active: true },
  { id: 't4', name: 'Ms. Priya Singh', subject: 'English', active: true },
  { id: 't5', name: 'Mr. Amit Patel', subject: 'Computer Science', active: true }
];

const MOCK_STUDENTS = [
  { id: 's1', name: 'Aarav Sharma', class: 'Class 10' },
  { id: 's2', name: 'Ananya Goel', class: 'Class 10' },
  { id: 's3', name: 'Kabir Malhotra', class: 'Class 10' },
  { id: 's4', name: 'Diya Sen', class: 'Class 10' },
  { id: 's5', name: 'Ishaan Verma', class: 'Class 10' },
  { id: 's6', name: 'Rohan Gupta', class: 'Class 11' },
  { id: 's7', name: 'Sneha Reddy', class: 'Class 11' }
];

function isDemoMode() {
  return new URLSearchParams(window.location.search).get('demo') === 'true';
}

function getMockDatabase() {
  let dbState = localStorage.getItem('proton_hub_mock_db');
  if (!dbState) {
    const initialRecords = {};
    const todayStr = formatDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateKey(yesterday);

    // Initial student records
    initialRecords[`${todayStr}_students`] = {
      s1: 'present', s2: 'absent', s3: 'present', s4: 'late', s5: 'present'
    };
    initialRecords[`${yesterdayStr}_students`] = {
      s1: 'present', s2: 'present', s3: 'present', s4: 'present', s5: 'present'
    };

    // Initial teacher records
    initialRecords[`${todayStr}_teachers`] = {
      t1: 'present', t2: 'present', t3: 'absent', t4: 'present', t5: 'late'
    };
    initialRecords[`${yesterdayStr}_teachers`] = {
      t1: 'present', t2: 'present', t3: 'present', t4: 'present', t5: 'present'
    };

    // Populate some monthly history for student and teacher reports
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dateKey === todayStr || dateKey === yesterdayStr) continue;

      const dayOfWeek = new Date(year, month - 1, d).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      initialRecords[`${dateKey}_students`] = {
        s1: Math.random() > 0.1 ? 'present' : 'absent',
        s2: Math.random() > 0.15 ? 'present' : 'absent',
        s3: Math.random() > 0.05 ? 'present' : 'absent',
        s4: Math.random() > 0.2 ? 'present' : (Math.random() > 0.5 ? 'absent' : 'late'),
        s5: Math.random() > 0.1 ? 'present' : 'late'
      };

      initialRecords[`${dateKey}_teachers`] = {
        t1: Math.random() > 0.05 ? 'present' : 'absent',
        t2: Math.random() > 0.08 ? 'present' : 'absent',
        t3: Math.random() > 0.05 ? 'present' : 'absent',
        t4: Math.random() > 0.1 ? 'present' : (Math.random() > 0.5 ? 'absent' : 'late'),
        t5: Math.random() > 0.12 ? 'present' : 'late'
      };
    }

    dbState = JSON.stringify(initialRecords);
    localStorage.setItem('proton_hub_mock_db', dbState);
  }
  return JSON.parse(dbState);
}

function saveMockDatabase(data) {
  localStorage.setItem('proton_hub_mock_db', JSON.stringify(data));
}

function getMockRecords(dateKey, type) {
  const dbState = getMockDatabase();
  return dbState[`${dateKey}_${type}`] || {};
}

function saveMockRecords(dateKey, type, items) {
  const dbState = getMockDatabase();
  const records = {};
  let count = 0;
  items.forEach(item => {
    const el = document.querySelector(`input[name="att_${item.id}"]:checked`);
    if (el) {
      records[item.id] = el.value;
      count++;
    }
  });
  dbState[`${dateKey}_${type}`] = records;
  saveMockDatabase(dbState);
  return count;
}

// =============================================
// CORE APP METHODS
// =============================================
async function init() {
  try {
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Attendance', 'fas fa-calendar-check'));
    initSidebar(null);
    
    const user = isDemoMode() ? { email: 'demo-admin@protonhub.com' } : await checkAuth();
    updateSidebarUser(user);

    // Set default date
    const datePicker = document.getElementById('attendanceDatePicker');
    datePicker.value = formatDateKey(selectedDate);
    updateDateDisplay();

    datePicker.addEventListener('change', () => {
      selectedDate = new Date(datePicker.value + 'T00:00:00');
      updateDateDisplay();
      if (currentMode === 'students') {
        const cls = document.getElementById('attendanceClassFilter').value;
        if (cls) loadAttendanceForClass(cls);
      } else {
        loadAttendanceForTeachers();
      }
    });

    document.getElementById('attendanceClassFilter').addEventListener('change', (e) => {
      if (e.target.value) loadAttendanceForClass(e.target.value);
    });

    // Mode switching
    const modeBtnStudents = document.getElementById('modeBtnStudents');
    const modeBtnTeachers = document.getElementById('modeBtnTeachers');

    modeBtnStudents?.addEventListener('click', () => {
      if (currentMode === 'students') return;
      currentMode = 'students';
      modeBtnStudents.classList.add('active');
      modeBtnTeachers.classList.remove('active');
      document.getElementById('attendanceClassFilter').style.display = 'block';
      document.getElementById('studentReportsSection').classList.remove('hidden');
      document.getElementById('teacherReportsSection').classList.add('hidden');
      
      // Reset mark view
      document.getElementById('attendanceContent').innerHTML = `
        <div class="empty-state" style="padding:48px;">
          <i class="fas fa-calendar-check"></i>
          <h4>Select a class to mark attendance</h4>
          <p>Choose a class from the dropdown above to load students.</p>
        </div>`;
    });

    modeBtnTeachers?.addEventListener('click', () => {
      if (currentMode === 'teachers') return;
      currentMode = 'teachers';
      modeBtnTeachers.classList.add('active');
      modeBtnStudents.classList.remove('active');
      document.getElementById('attendanceClassFilter').style.display = 'none';
      document.getElementById('studentReportsSection').classList.add('hidden');
      document.getElementById('teacherReportsSection').classList.remove('hidden');
      
      // Load teachers attendance directly
      loadAttendanceForTeachers();
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

    // Reports
    document.getElementById('loadStudentReportBtn')?.addEventListener('click', loadStudentReport);
    document.getElementById('loadClassReportBtn')?.addEventListener('click', loadClassReport);
    document.getElementById('loadDailySummaryBtn')?.addEventListener('click', loadDailySummary);

    // Teacher Reports
    document.getElementById('loadDailyTeacherSummaryBtn')?.addEventListener('click', loadDailyTeacherSummary);
    document.getElementById('loadTeacherReportBtn')?.addEventListener('click', loadTeacherReport);
    document.getElementById('loadFacultyReportBtn')?.addEventListener('click', loadFacultyReport);

    // Set default date/month for reports
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('reportMonth').value = monthStr;
    document.getElementById('reportClassMonth').value = monthStr;
    document.getElementById('dailySummaryDate').value = formatDateKey(now);

    // Teacher reports default values
    document.getElementById('reportTeacherMonth').value = monthStr;
    document.getElementById('reportFacultyMonth').value = monthStr;
    document.getElementById('dailyTeacherSummaryDate').value = formatDateKey(now);

    // Load dropdown contents
    await loadStudentsForReportDropdown();
    await loadTeachersForReportDropdown();
  } catch (err) {
    console.error('Attendance init error:', err);
  }
}

function updateDateDisplay() {
  document.getElementById('dateDisplayText').textContent = formatDateFull(selectedDate);
}

async function loadAttendanceForClass(className) {
  const content = document.getElementById('attendanceContent');
  content.innerHTML = '<div style="text-align:center;padding:24px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    // Load students of this class
    studentsForClass = [];
    if (isDemoMode()) {
      studentsForClass = MOCK_STUDENTS.filter(s => s.class === className);
    } else {
      const studentsSnap = await getDocs(collection(db, 'students'));
      studentsSnap.forEach(d => {
        const data = d.data();
        if (data.class === className) {
          studentsForClass.push({ id: d.id, ...data });
        }
      });
    }
    studentsForClass.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (studentsForClass.length === 0) {
      content.innerHTML = `<div class="empty-state" style="padding:48px;">
        <i class="fas fa-user-graduate"></i>
        <h4>No students in ${className}</h4>
        <p>Add students to this class first.</p>
      </div>`;
      return;
    }

    // Check existing attendance
    const dateKey = formatDateKey(selectedDate);
    let existingAttendance = {};
    if (isDemoMode()) {
      existingAttendance = getMockRecords(dateKey, 'students');
    } else {
      const recordsSnap = await getDocs(collection(db, `attendance/${dateKey}/records`));
      recordsSnap.forEach(d => {
        existingAttendance[d.id] = d.data().status;
      });
    }

    // Check if attendance was already marked
    let alreadyMarkedCount = 0;
    let existingPresent = 0, existingAbsent = 0, existingLate = 0;
    studentsForClass.forEach(s => {
      if (existingAttendance[s.id]) {
        alreadyMarkedCount++;
        if (existingAttendance[s.id] === 'present') existingPresent++;
        else if (existingAttendance[s.id] === 'absent') existingAbsent++;
        else if (existingAttendance[s.id] === 'late') existingLate++;
      }
    });

    const isAlreadyMarked = alreadyMarkedCount > 0;
    const isLocked = isAlreadyMarked;

    // Build HTML
    let html = '';

    if (isAlreadyMarked) {
      html += `
        <div class="att-submitted-banner" id="attSubmittedBanner" style="display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--success-light); border:1px solid var(--success); border-radius:var(--radius-lg); padding:14px 18px; margin-bottom:14px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <i class="fas fa-check-circle" style="color:var(--success); font-size:1.2rem;"></i>
            <div>
              <div style="font-weight:600; font-size:0.9rem; color:var(--success-dark);">Attendance Already Submitted</div>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
                <span class="badge badge-present" style="margin-right:4px;">Present: ${existingPresent}</span>
                <span class="badge badge-absent" style="margin-right:4px;">Absent: ${existingAbsent}</span>
                <span class="badge badge-late">Late: ${existingLate}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-warning btn-sm" id="editAttendanceBtn"><i class="fas fa-pen"></i> Edit Attendance</button>
        </div>
      `;
    }

    html += `
      <div class="card">
        <div class="card-header">
          <h3 style="font-size:0.95rem;"><i class="fas fa-users" style="color:var(--primary);margin-right:6px;"></i> ${className} — ${studentsForClass.length} students</h3>
          <button class="btn btn-secondary btn-sm" id="selectAllPresentBtn" ${isLocked ? 'disabled style="opacity:0.5;pointer-events:none;"' : ''}><i class="fas fa-check-double"></i> All Present</button>
        </div>
        <div class="card-body">
    `;

    studentsForClass.forEach(s => {
      const existing = existingAttendance[s.id] || '';
      const statusBadge = existing ? `<span class="badge badge-${existing}" style="margin-left:8px; font-size:0.65rem;">${existing}</span>` : '';
      
      html += `
        <div class="attendance-student-row" data-student-id="${s.id}">
          <span class="attendance-student-name">${escapeHTML(s.name || 'Unknown')}${isLocked ? statusBadge : ''}</span>
          <div class="radio-group ${isLocked ? 'att-locked' : ''}">
            <input type="radio" class="radio-option" name="att_${s.id}" id="present_${s.id}" value="present" ${existing === 'present' ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label class="radio-label present" for="present_${s.id}">Present</label>
            <input type="radio" class="radio-option" name="att_${s.id}" id="absent_${s.id}" value="absent" ${existing === 'absent' ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label class="radio-label absent" for="absent_${s.id}">Absent</label>
            <input type="radio" class="radio-option" name="att_${s.id}" id="late_${s.id}" value="late" ${existing === 'late' ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label class="radio-label late" for="late_${s.id}">Late</label>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;" id="attActionBar">
        ${isLocked ? '' : `<button class="btn btn-success" id="submitAttendanceBtn"><i class="fas fa-save"></i> ${isAlreadyMarked ? 'Update Attendance' : 'Submit Attendance'}</button>`}
      </div>
    `;

    content.innerHTML = html;

    // Select All Present
    document.getElementById('selectAllPresentBtn')?.addEventListener('click', () => {
      studentsForClass.forEach(s => {
        const el = document.getElementById(`present_${s.id}`);
        if (el && !el.disabled) el.checked = true;
      });
      showToast('All marked as Present.', 'info');
    });

    // Submit / Update
    document.getElementById('submitAttendanceBtn')?.addEventListener('click', submitAttendance);

    // Edit button — unlock the form
    document.getElementById('editAttendanceBtn')?.addEventListener('click', () => {
      const banner = document.getElementById('attSubmittedBanner');
      if (banner) banner.style.display = 'none';

      document.querySelectorAll('.att-locked input[type="radio"]').forEach(r => {
        r.disabled = false;
      });
      document.querySelectorAll('.att-locked').forEach(g => {
        g.classList.remove('att-locked');
      });

      studentsForClass.forEach(s => {
        const row = document.querySelector(`[data-student-id="${s.id}"] .attendance-student-name`);
        if (row) row.innerHTML = escapeHTML(s.name || 'Unknown');
      });

      const selAllBtn = document.getElementById('selectAllPresentBtn');
      if (selAllBtn) {
        selAllBtn.disabled = false;
        selAllBtn.style.opacity = '1';
        selAllBtn.style.pointerEvents = 'auto';
      }

      const actionBar = document.getElementById('attActionBar');
      if (actionBar) {
        actionBar.innerHTML = `<button class="btn btn-success" id="submitAttendanceBtn"><i class="fas fa-save"></i> Update Attendance</button>`;
        document.getElementById('submitAttendanceBtn').addEventListener('click', submitAttendance);
      }

      showToast('Attendance unlocked for editing.', 'info');
    });

  } catch (err) {
    console.error('Error loading student attendance:', err);
    content.innerHTML = '<div class="empty-state"><p>Error loading data.</p></div>';
  }
}

async function submitAttendance() {
  const dateKey = formatDateKey(selectedDate);
  const btn = document.getElementById('submitAttendanceBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    let count = 0;
    if (isDemoMode()) {
      count = saveMockRecords(dateKey, 'students', studentsForClass);
    } else {
      for (const s of studentsForClass) {
        const selected = document.querySelector(`input[name="att_${s.id}"]:checked`);
        if (selected) {
          await setDoc(doc(db, `attendance/${dateKey}/records`, s.id), {
            studentId: s.id,
            studentName: s.name || '',
            class: s.class || '',
            status: selected.value,
            markedAt: new Date()
          });
          count++;
        }
      }
    }
    showToast(`Attendance saved for ${count} students!`, 'success');
    if (studentsForClass.length > 0) {
      loadAttendanceForClass(studentsForClass[0].class);
    }
  } catch (err) {
    console.error('Error saving attendance:', err);
    showToast('Failed to save attendance.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

async function loadAttendanceForTeachers() {
  const content = document.getElementById('attendanceContent');
  content.innerHTML = '<div style="text-align:center;padding:24px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    teachersList = [];
    if (isDemoMode()) {
      teachersList = MOCK_TEACHERS;
    } else {
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      teachersSnap.forEach(d => {
        const data = d.data();
        if (data.active !== false) {
          teachersList.push({ id: d.id, ...data });
        }
      });
    }
    teachersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (teachersList.length === 0) {
      content.innerHTML = `<div class="empty-state" style="padding:48px;">
        <i class="fas fa-chalkboard-teacher"></i>
        <h4>No active teachers</h4>
        <p>Add teachers in the management panel first.</p>
      </div>`;
      return;
    }

    // Check existing attendance
    const dateKey = formatDateKey(selectedDate);
    let existingAttendance = {};
    if (isDemoMode()) {
      existingAttendance = getMockRecords(dateKey, 'teachers');
    } else {
      const recordsSnap = await getDocs(collection(db, `attendance/${dateKey}/teachers`));
      recordsSnap.forEach(d => {
        existingAttendance[d.id] = d.data().status;
      });
    }

    let alreadyMarkedCount = 0;
    let existingPresent = 0, existingAbsent = 0, existingLate = 0;
    teachersList.forEach(t => {
      if (existingAttendance[t.id]) {
        alreadyMarkedCount++;
        if (existingAttendance[t.id] === 'present') existingPresent++;
        else if (existingAttendance[t.id] === 'absent') existingAbsent++;
        else if (existingAttendance[t.id] === 'late') existingLate++;
      }
    });

    const isAlreadyMarked = alreadyMarkedCount > 0;
    const isLocked = isAlreadyMarked;

    let html = '';

    if (isAlreadyMarked) {
      html += `
        <div class="att-submitted-banner" id="attSubmittedBanner" style="display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--success-light); border:1px solid var(--success); border-radius:var(--radius-lg); padding:14px 18px; margin-bottom:14px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <i class="fas fa-check-circle" style="color:var(--success); font-size:1.2rem;"></i>
            <div>
              <div style="font-weight:600; font-size:0.9rem; color:var(--success-dark);">Faculty Attendance Already Submitted</div>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
                <span class="badge badge-present" style="margin-right:4px;">Present: ${existingPresent}</span>
                <span class="badge badge-absent" style="margin-right:4px;">Absent: ${existingAbsent}</span>
                <span class="badge badge-late">Late: ${existingLate}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-warning btn-sm" id="editAttendanceBtn"><i class="fas fa-pen"></i> Edit Attendance</button>
        </div>
      `;
    }

    html += `
      <div class="card">
        <div class="card-header">
          <h3 style="font-size:0.95rem;"><i class="fas fa-chalkboard-teacher" style="color:var(--primary);margin-right:6px;"></i> Faculty — ${teachersList.length} active teachers</h3>
          <button class="btn btn-secondary btn-sm" id="selectAllPresentBtn" ${isLocked ? 'disabled style="opacity:0.5;pointer-events:none;"' : ''}><i class="fas fa-check-double"></i> All Present</button>
        </div>
        <div class="card-body">
    `;

    teachersList.forEach(t => {
      const existing = existingAttendance[t.id] || '';
      const statusBadge = existing ? `<span class="badge badge-${existing}" style="margin-left:8px; font-size:0.65rem;">${existing}</span>` : '';
      
      html += `
        <div class="attendance-student-row" data-teacher-id="${t.id}">
          <span class="attendance-student-name">${escapeHTML(t.name || 'Unknown')} <span style="font-size:0.8rem;color:var(--text-secondary);font-weight:normal;">(${escapeHTML(t.subject || '')})</span>${isLocked ? statusBadge : ''}</span>
          <div class="radio-group ${isLocked ? 'att-locked' : ''}">
            <input type="radio" class="radio-option" name="att_${t.id}" id="present_${t.id}" value="present" ${existing === 'present' ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label class="radio-label present" for="present_${t.id}">Present</label>
            <input type="radio" class="radio-option" name="att_${t.id}" id="absent_${t.id}" value="absent" ${existing === 'absent' ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label class="radio-label absent" for="absent_${t.id}">Absent</label>
            <input type="radio" class="radio-option" name="att_${t.id}" id="late_${t.id}" value="late" ${existing === 'late' ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <label class="radio-label late" for="late_${t.id}">Late</label>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;" id="attActionBar">
        ${isLocked ? '' : `<button class="btn btn-success" id="submitAttendanceBtn"><i class="fas fa-save"></i> ${isAlreadyMarked ? 'Update Attendance' : 'Submit Attendance'}</button>`}
      </div>
    `;

    content.innerHTML = html;

    // Select All Present
    document.getElementById('selectAllPresentBtn')?.addEventListener('click', () => {
      teachersList.forEach(t => {
        const el = document.getElementById(`present_${t.id}`);
        if (el && !el.disabled) el.checked = true;
      });
      showToast('All marked as Present.', 'info');
    });

    // Submit / Update
    document.getElementById('submitAttendanceBtn')?.addEventListener('click', submitTeacherAttendance);

    // Edit button - unlock the form
    document.getElementById('editAttendanceBtn')?.addEventListener('click', () => {
      const banner = document.getElementById('attSubmittedBanner');
      if (banner) banner.style.display = 'none';

      document.querySelectorAll('.att-locked input[type="radio"]').forEach(r => {
        r.disabled = false;
      });
      document.querySelectorAll('.att-locked').forEach(g => {
        g.classList.remove('att-locked');
      });

      teachersList.forEach(t => {
        const row = document.querySelector(`[data-teacher-id="${t.id}"] .attendance-student-name`);
        if (row) row.innerHTML = `${escapeHTML(t.name || 'Unknown')} <span style="font-size:0.8rem;color:var(--text-secondary);font-weight:normal;">(${escapeHTML(t.subject || '')})</span>`;
      });

      const selAllBtn = document.getElementById('selectAllPresentBtn');
      if (selAllBtn) {
        selAllBtn.disabled = false;
        selAllBtn.style.opacity = '1';
        selAllBtn.style.pointerEvents = 'auto';
      }

      const actionBar = document.getElementById('attActionBar');
      if (actionBar) {
        actionBar.innerHTML = `<button class="btn btn-success" id="submitAttendanceBtn"><i class="fas fa-save"></i> Update Attendance</button>`;
        document.getElementById('submitAttendanceBtn').addEventListener('click', submitTeacherAttendance);
      }

      showToast('Attendance unlocked for editing.', 'info');
    });

  } catch (err) {
    console.error('Error loading teacher attendance:', err);
    content.innerHTML = '<div class="empty-state"><p>Error loading data.</p></div>';
  }
}

async function submitTeacherAttendance() {
  const dateKey = formatDateKey(selectedDate);
  const btn = document.getElementById('submitAttendanceBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    let count = 0;
    if (isDemoMode()) {
      count = saveMockRecords(dateKey, 'teachers', teachersList);
    } else {
      for (const t of teachersList) {
        const selected = document.querySelector(`input[name="att_${t.id}"]:checked`);
        if (selected) {
          await setDoc(doc(db, `attendance/${dateKey}/teachers`, t.id), {
            teacherId: t.id,
            teacherName: t.name || '',
            subject: t.subject || '',
            status: selected.value,
            markedAt: new Date()
          });
          count++;
        }
      }
    }
    showToast(`Attendance saved for ${count} teachers!`, 'success');
    loadAttendanceForTeachers();
  } catch (err) {
    console.error('Error saving teacher attendance:', err);
    showToast('Failed to save attendance.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

async function loadStudentsForReportDropdown() {
  try {
    const select = document.getElementById('reportStudentSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Choose a student...</option>';
    
    let students = [];
    if (isDemoMode()) {
      students = MOCK_STUDENTS;
    } else {
      const snap = await getDocs(collection(db, 'students'));
      snap.forEach(d => students.push({ id: d.id, ...d.data() }));
    }
    
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.class || 'N/A'})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading students for report dropdown:', err);
  }
}

async function loadTeachersForReportDropdown() {
  try {
    const select = document.getElementById('reportTeacherSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Choose a teacher...</option>';
    
    let teachers = [];
    if (isDemoMode()) {
      teachers = MOCK_TEACHERS;
    } else {
      const snap = await getDocs(collection(db, 'teachers'));
      snap.forEach(d => teachers.push({ id: d.id, ...d.data() }));
    }
    
    teachers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.subject || 'N/A'})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading teachers for report dropdown:', err);
  }
}

async function loadStudentReport() {
  const studentId = document.getElementById('reportStudentSelect').value;
  const monthVal = document.getElementById('reportMonth').value;
  const area = document.getElementById('studentReportArea');

  if (!studentId || !monthVal) {
    showToast('Select a student and month.', 'warning');
    return;
  }

  area.innerHTML = '<div style="text-align:center;padding:16px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    const [year, month] = monthVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const records = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isDemoMode()) {
        const dayRecs = getMockRecords(dateKey, 'students');
        if (dayRecs[studentId]) {
          records[d] = dayRecs[studentId];
        }
      } else {
        const docRef = doc(db, `attendance/${dateKey}/records`, studentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          records[d] = docSnap.data().status;
        }
      }
    }

    // Render calendar
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const firstDay = new Date(year, month - 1, 1).getDay();

    let present = 0, absent = 0, late = 0;
    Object.values(records).forEach(s => {
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'late') late++;
    });

    let calHTML = '<div class="attendance-calendar">';
    dayNames.forEach(d => calHTML += `<div class="calendar-header">${d}</div>`);
    for (let i = 0; i < firstDay; i++) calHTML += '<div class="calendar-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const status = records[d] || '';
      calHTML += `<div class="calendar-day ${status}">${d}</div>`;
    }
    calHTML += '</div>';

    area.innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
        <span class="badge badge-present" style="padding:6px 14px;">Present: ${present}</span>
        <span class="badge badge-absent" style="padding:6px 14px;">Absent: ${absent}</span>
        <span class="badge badge-late" style="padding:6px 14px;">Late: ${late}</span>
      </div>
      ${calHTML}
    `;
  } catch (err) {
    console.error('Error loading student report:', err);
    area.innerHTML = '<p class="text-sm text-muted">Error loading report.</p>';
  }
}

async function loadDailySummary() {
  const dateVal = document.getElementById('dailySummaryDate').value;
  const area = document.getElementById('dailySummaryArea');

  if (!dateVal) {
    showToast('Please select a date.', 'warning');
    return;
  }

  area.innerHTML = '<div style="text-align:center;padding:16px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    let records = [];
    if (isDemoMode()) {
      const dayRecs = getMockRecords(dateVal, 'students');
      Object.keys(dayRecs).forEach(sid => {
        const student = MOCK_STUDENTS.find(s => s.id === sid);
        if (student) {
          records.push({
            id: sid,
            studentId: sid,
            studentName: student.name,
            class: student.class,
            status: dayRecs[sid]
          });
        }
      });
    } else {
      const recordsSnap = await getDocs(collection(db, `attendance/${dateVal}/records`));
      recordsSnap.forEach(d => records.push({ id: d.id, ...d.data() }));
    }

    if (records.length === 0) {
      area.innerHTML = '<div class="empty-state" style="padding:32px;"><i class="fas fa-clipboard-list"></i><h4>No attendance records</h4><p>No attendance was marked for this date.</p></div>';
      return;
    }

    let totalPresent = 0, totalAbsent = 0, totalLate = 0;
    const classMap = {};

    records.forEach(r => {
      if (r.status === 'present') totalPresent++;
      else if (r.status === 'absent') totalAbsent++;
      else if (r.status === 'late') totalLate++;

      const cls = r.class || 'Unknown';
      if (!classMap[cls]) classMap[cls] = { present: 0, absent: 0, late: 0, total: 0 };
      classMap[cls].total++;
      if (r.status === 'present') classMap[cls].present++;
      else if (r.status === 'absent') classMap[cls].absent++;
      else if (r.status === 'late') classMap[cls].late++;
    });

    const totalStudents = totalPresent + totalAbsent + totalLate;
    const overallPct = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

    const sortedClasses = Object.keys(classMap).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    const displayDate = new Date(dateVal + 'T00:00:00');
    const dateStr = formatDateFull(displayDate);

    let html = `
      <h4 style="margin-bottom:12px;font-size:0.95rem;color:var(--text-primary);">
        <i class="fas fa-calendar" style="color:var(--primary);margin-right:6px;"></i> ${dateStr}
      </h4>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="background:var(--success-light);border:1px solid var(--success);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--success-dark);">${totalPresent}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Present</div>
        </div>
        <div style="background:#fde8e8;border:1px solid var(--danger);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--danger-dark);">${totalAbsent}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Absent</div>
        </div>
        <div style="background:#fff8e1;border:1px solid var(--warning);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--warning-dark);">${totalLate}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Late</div>
        </div>
        <div style="background:var(--primary-light);border:1px solid var(--primary);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--primary-dark);">${totalStudents}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Total</div>
        </div>
        <div style="background:#f0e6ff;border:1px solid #7c3aed;border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:#7c3aed;">${overallPct}%</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Attendance</div>
        </div>
      </div>

      <h4 style="margin-bottom:10px;font-size:0.9rem;color:var(--text-primary);">
        <i class="fas fa-layer-group" style="color:var(--primary);margin-right:6px;"></i> Class-wise Breakdown
      </h4>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>Attendance %</th></tr>
          </thead>
          <tbody>
    `;

    sortedClasses.forEach(cls => {
      const c = classMap[cls];
      const pct = c.total > 0 ? Math.round((c.present / c.total) * 100) : 0;
      html += `
        <tr>
          <td><strong>${escapeHTML(cls)}</strong></td>
          <td><span class="badge badge-present">${c.present}</span></td>
          <td><span class="badge badge-absent">${c.absent}</span></td>
          <td><span class="badge badge-late">${c.late}</span></td>
          <td><strong>${c.total}</strong></td>
          <td><strong>${pct}%</strong></td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    area.innerHTML = html;

  } catch (err) {
    console.error('Error loading daily summary:', err);
    area.innerHTML = '<p class="text-sm text-muted">Error loading summary.</p>';
  }
}

async function loadClassReport() {
  const className = document.getElementById('reportClassSelect').value;
  const monthVal = document.getElementById('reportClassMonth').value;
  const area = document.getElementById('classReportArea');

  if (!className || !monthVal) {
    showToast('Select a class and month.', 'warning');
    return;
  }

  area.innerHTML = '<div style="text-align:center;padding:16px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    let classStudents = [];
    if (isDemoMode()) {
      classStudents = MOCK_STUDENTS.filter(s => s.class === className);
    } else {
      const studentsSnap = await getDocs(collection(db, 'students'));
      studentsSnap.forEach(d => {
        const data = d.data();
        if (data.class === className) classStudents.push({ id: d.id, ...data });
      });
    }
    classStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (classStudents.length === 0) {
      area.innerHTML = '<p class="text-sm text-muted">No students in this class.</p>';
      return;
    }

    const [year, month] = monthVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const studentRecords = {};
    for (const s of classStudents) {
      studentRecords[s.id] = { present: 0, absent: 0, late: 0 };
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isDemoMode()) {
        const dayRecs = getMockRecords(dateKey, 'students');
        Object.keys(dayRecs).forEach(sid => {
          if (studentRecords[sid]) {
            const status = dayRecs[sid];
            if (status === 'present') studentRecords[sid].present++;
            else if (status === 'absent') studentRecords[sid].absent++;
            else if (status === 'late') studentRecords[sid].late++;
          }
        });
      } else {
        const recordsSnap = await getDocs(collection(db, `attendance/${dateKey}/records`));
        recordsSnap.forEach(docSnap => {
          if (studentRecords[docSnap.id]) {
            const status = docSnap.data().status;
            if (status === 'present') studentRecords[docSnap.id].present++;
            else if (status === 'absent') studentRecords[docSnap.id].absent++;
            else if (status === 'late') studentRecords[docSnap.id].late++;
          }
        });
      }
    }

    let tableHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Student</th><th>Present</th><th>Absent</th><th>Late</th><th>Attendance %</th></tr>
          </thead>
          <tbody>
    `;

    classStudents.forEach(s => {
      const r = studentRecords[s.id];
      const total = r.present + r.absent + r.late;
      const pct = total > 0 ? Math.round((r.present / total) * 100) : 0;
      tableHTML += `
        <tr>
          <td><strong>${escapeHTML(s.name || '')}</strong></td>
          <td><span class="badge badge-present">${r.present}</span></td>
          <td><span class="badge badge-absent">${r.absent}</span></td>
          <td><span class="badge badge-late">${r.late}</span></td>
          <td><strong>${total > 0 ? pct + '%' : '—'}</strong></td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table></div>';
    area.innerHTML = tableHTML;

  } catch (err) {
    console.error('Error loading class report:', err);
    area.innerHTML = '<p class="text-sm text-muted">Error loading report.</p>';
  }
}

async function loadDailyTeacherSummary() {
  const dateVal = document.getElementById('dailyTeacherSummaryDate').value;
  const area = document.getElementById('dailyTeacherSummaryArea');

  if (!dateVal) {
    showToast('Please select a date.', 'warning');
    return;
  }

  area.innerHTML = '<div style="text-align:center;padding:16px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    let records = [];
    if (isDemoMode()) {
      const dayRecs = getMockRecords(dateVal, 'teachers');
      Object.keys(dayRecs).forEach(tid => {
        const teacher = MOCK_TEACHERS.find(t => t.id === tid);
        if (teacher) {
          records.push({
            id: tid,
            teacherId: tid,
            teacherName: teacher.name,
            subject: teacher.subject,
            status: dayRecs[tid]
          });
        }
      });
    } else {
      const recordsSnap = await getDocs(collection(db, `attendance/${dateVal}/teachers`));
      recordsSnap.forEach(d => records.push({ id: d.id, ...d.data() }));
    }

    if (records.length === 0) {
      area.innerHTML = '<div class="empty-state" style="padding:32px;"><i class="fas fa-clipboard-list"></i><h4>No attendance records</h4><p>No faculty attendance was marked for this date.</p></div>';
      return;
    }

    let totalPresent = 0, totalAbsent = 0, totalLate = 0;
    records.forEach(r => {
      if (r.status === 'present') totalPresent++;
      else if (r.status === 'absent') totalAbsent++;
      else if (r.status === 'late') totalLate++;
    });

    const totalTeachers = totalPresent + totalAbsent + totalLate;
    const overallPct = totalTeachers > 0 ? Math.round((totalPresent / totalTeachers) * 100) : 0;

    const displayDate = new Date(dateVal + 'T00:00:00');
    const dateStr = formatDateFull(displayDate);

    let html = `
      <h4 style="margin-bottom:12px;font-size:0.95rem;color:var(--text-primary);">
        <i class="fas fa-calendar" style="color:var(--primary);margin-right:6px;"></i> ${dateStr}
      </h4>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="background:var(--success-light);border:1px solid var(--success);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--success-dark);">${totalPresent}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Present</div>
        </div>
        <div style="background:#fde8e8;border:1px solid var(--danger);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--danger-dark);">${totalAbsent}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Absent</div>
        </div>
        <div style="background:#fff8e1;border:1px solid var(--warning);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--warning-dark);">${totalLate}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Late</div>
        </div>
        <div style="background:var(--primary-light);border:1px solid var(--primary);border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:var(--primary-dark);">${totalTeachers}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Total</div>
        </div>
        <div style="background:#f0e6ff;border:1px solid #7c3aed;border-radius:8px;padding:12px 20px;text-align:center;min-width:120px;">
          <div style="font-size:1.5rem;font-weight:700;color:#7c3aed;">${overallPct}%</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">Attendance</div>
        </div>
      </div>

      <h4 style="margin-bottom:10px;font-size:0.9rem;color:var(--text-primary);">
        <i class="fas fa-list" style="color:var(--primary);margin-right:6px;"></i> Faculty Detailed Breakdown
      </h4>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Teacher</th><th>Subject</th><th>Status</th></tr>
          </thead>
          <tbody>
    `;

    records.sort((a, b) => (a.teacherName || '').localeCompare(b.teacherName || ''));
    records.forEach(r => {
      html += `
        <tr>
          <td><strong>${escapeHTML(r.teacherName || '')}</strong></td>
          <td>${escapeHTML(r.subject || 'N/A')}</td>
          <td><span class="badge badge-${r.status}">${r.status}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    area.innerHTML = html;

  } catch (err) {
    console.error('Error loading daily teacher summary:', err);
    area.innerHTML = '<p class="text-sm text-muted">Error loading summary.</p>';
  }
}

async function loadTeacherReport() {
  const teacherId = document.getElementById('reportTeacherSelect').value;
  const monthVal = document.getElementById('reportTeacherMonth').value;
  const area = document.getElementById('teacherReportArea');

  if (!teacherId || !monthVal) {
    showToast('Select a teacher and month.', 'warning');
    return;
  }

  area.innerHTML = '<div style="text-align:center;padding:16px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    const [year, month] = monthVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const records = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isDemoMode()) {
        const dayRecs = getMockRecords(dateKey, 'teachers');
        if (dayRecs[teacherId]) {
          records[d] = dayRecs[teacherId];
        }
      } else {
        const docRef = doc(db, `attendance/${dateKey}/teachers`, teacherId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          records[d] = docSnap.data().status;
        }
      }
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const firstDay = new Date(year, month - 1, 1).getDay();

    let present = 0, absent = 0, late = 0;
    Object.values(records).forEach(s => {
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'late') late++;
    });

    let calHTML = '<div class="attendance-calendar">';
    dayNames.forEach(d => calHTML += `<div class="calendar-header">${d}</div>`);
    for (let i = 0; i < firstDay; i++) calHTML += '<div class="calendar-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const status = records[d] || '';
      calHTML += `<div class="calendar-day ${status}">${d}</div>`;
    }
    calHTML += '</div>';

    area.innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
        <span class="badge badge-present" style="padding:6px 14px;">Present: ${present}</span>
        <span class="badge badge-absent" style="padding:6px 14px;">Absent: ${absent}</span>
        <span class="badge badge-late" style="padding:6px 14px;">Late: ${late}</span>
      </div>
      ${calHTML}
    `;
  } catch (err) {
    console.error('Error loading teacher report:', err);
    area.innerHTML = '<p class="text-sm text-muted">Error loading report.</p>';
  }
}

async function loadFacultyReport() {
  const monthVal = document.getElementById('reportFacultyMonth').value;
  const area = document.getElementById('facultyReportArea');

  if (!monthVal) {
    showToast('Select a month.', 'warning');
    return;
  }

  area.innerHTML = '<div style="text-align:center;padding:16px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    let teachers = [];
    if (isDemoMode()) {
      teachers = MOCK_TEACHERS;
    } else {
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      teachersSnap.forEach(d => {
        const data = d.data();
        if (data.active !== false) {
          teachers.push({ id: d.id, ...data });
        }
      });
    }
    teachers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (teachers.length === 0) {
      area.innerHTML = '<p class="text-sm text-muted">No active teachers found.</p>';
      return;
    }

    const [year, month] = monthVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const teacherRecords = {};
    for (const t of teachers) {
      teacherRecords[t.id] = { present: 0, absent: 0, late: 0 };
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isDemoMode()) {
        const dayRecs = getMockRecords(dateKey, 'teachers');
        Object.keys(dayRecs).forEach(tid => {
          if (teacherRecords[tid]) {
            const status = dayRecs[tid];
            if (status === 'present') teacherRecords[tid].present++;
            else if (status === 'absent') teacherRecords[tid].absent++;
            else if (status === 'late') teacherRecords[tid].late++;
          }
        });
      } else {
        const recordsSnap = await getDocs(collection(db, `attendance/${dateKey}/teachers`));
        recordsSnap.forEach(docSnap => {
          if (teacherRecords[docSnap.id]) {
            const status = docSnap.data().status;
            if (status === 'present') teacherRecords[docSnap.id].present++;
            else if (status === 'absent') teacherRecords[docSnap.id].absent++;
            else if (status === 'late') teacherRecords[docSnap.id].late++;
          }
        });
      }
    }

    let tableHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr><th>Teacher</th><th>Subject</th><th>Present</th><th>Absent</th><th>Late</th><th>Attendance %</th></tr>
          </thead>
          <tbody>
    `;

    teachers.forEach(t => {
      const r = teacherRecords[t.id];
      const total = r.present + r.absent + r.late;
      const pct = total > 0 ? Math.round((r.present / total) * 100) : 0;
      tableHTML += `
        <tr>
          <td><strong>${escapeHTML(t.name || '')}</strong></td>
          <td>${escapeHTML(t.subject || 'N/A')}</td>
          <td><span class="badge badge-present">${r.present}</span></td>
          <td><span class="badge badge-absent">${r.absent}</span></td>
          <td><span class="badge badge-late">${r.late}</span></td>
          <td><strong>${total > 0 ? pct + '%' : '—'}</strong></td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table></div>';
    area.innerHTML = tableHTML;

  } catch (err) {
    console.error('Error loading faculty report:', err);
    area.innerHTML = '<p class="text-sm text-muted">Error loading report.</p>';
  }
}

init();
