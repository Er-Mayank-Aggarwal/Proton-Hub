// =============================================
// PROTON HUB ADMIN — Attendance Module
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import {
  showToast, showSpinner, hideSpinner, formatDateFull, formatDateKey, escapeHTML
} from './utils.js';
import {
  collection, getDocs, doc, setDoc, getDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let selectedDate = new Date();
let studentsForClass = [];

async function init() {
  try {
    const user = await checkAuth();
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Attendance', 'fas fa-calendar-check'));
    initSidebar(user);

    document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('active');
    });

    // Set default date
    const datePicker = document.getElementById('attendanceDatePicker');
    datePicker.value = formatDateKey(selectedDate);
    updateDateDisplay();

    datePicker.addEventListener('change', () => {
      selectedDate = new Date(datePicker.value + 'T00:00:00');
      updateDateDisplay();
      const cls = document.getElementById('attendanceClassFilter').value;
      if (cls) loadAttendanceForClass(cls);
    });

    document.getElementById('attendanceClassFilter').addEventListener('change', (e) => {
      if (e.target.value) loadAttendanceForClass(e.target.value);
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

    // Set default month for reports
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('reportMonth').value = monthStr;
    document.getElementById('reportClassMonth').value = monthStr;

    // Load students for report dropdown
    await loadStudentsForReportDropdown();
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
    const studentsSnap = await getDocs(collection(db, 'students'));
    studentsForClass = [];
    studentsSnap.forEach(d => {
      const data = d.data();
      if (data.class === className) {
        studentsForClass.push({ id: d.id, ...data });
      }
    });
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
    const existingAttendance = {};
    const recordsSnap = await getDocs(collection(db, `attendance/${dateKey}/records`));
    recordsSnap.forEach(d => {
      existingAttendance[d.id] = d.data().status;
    });

    // Render
    let html = `
      <div class="card">
        <div class="card-header">
          <h3 style="font-size:0.95rem;"><i class="fas fa-users" style="color:var(--primary);margin-right:6px;"></i> ${className} — ${studentsForClass.length} students</h3>
          <button class="btn btn-secondary btn-sm" id="selectAllPresentBtn"><i class="fas fa-check-double"></i> Select All Present</button>
        </div>
        <div class="card-body">
    `;

    studentsForClass.forEach(s => {
      const existing = existingAttendance[s.id] || '';
      html += `
        <div class="attendance-student-row">
          <span class="attendance-student-name">${escapeHTML(s.name || 'Unknown')}</span>
          <div class="radio-group">
            <input type="radio" class="radio-option" name="att_${s.id}" id="present_${s.id}" value="present" ${existing === 'present' ? 'checked' : ''}>
            <label class="radio-label present" for="present_${s.id}">Present</label>
            <input type="radio" class="radio-option" name="att_${s.id}" id="absent_${s.id}" value="absent" ${existing === 'absent' ? 'checked' : ''}>
            <label class="radio-label absent" for="absent_${s.id}">Absent</label>
            <input type="radio" class="radio-option" name="att_${s.id}" id="late_${s.id}" value="late" ${existing === 'late' ? 'checked' : ''}>
            <label class="radio-label late" for="late_${s.id}">Late</label>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
      <div style="margin-top:16px; display:flex; justify-content:flex-end;">
        <button class="btn btn-success" id="submitAttendanceBtn"><i class="fas fa-save"></i> Submit Attendance</button>
      </div>
    `;

    content.innerHTML = html;

    // Select All Present
    document.getElementById('selectAllPresentBtn').addEventListener('click', () => {
      studentsForClass.forEach(s => {
        document.getElementById(`present_${s.id}`).checked = true;
      });
      showToast('All marked as Present.', 'info');
    });

    // Submit
    document.getElementById('submitAttendanceBtn').addEventListener('click', submitAttendance);

  } catch (err) {
    console.error('Error loading attendance:', err);
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
    showToast(`Attendance saved for ${count} students!`, 'success');
  } catch (err) {
    console.error('Error saving attendance:', err);
    showToast('Failed to save attendance.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

async function loadStudentsForReportDropdown() {
  try {
    const snap = await getDocs(collection(db, 'students'));
    const select = document.getElementById('reportStudentSelect');
    const students = [];
    snap.forEach(d => students.push({ id: d.id, ...d.data() }));
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.class || 'N/A'})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading students for report:', err);
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

    // Load attendance for each day of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const docRef = doc(db, `attendance/${dateKey}/records`, studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        records[d] = docSnap.data().status;
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
    // Get students of this class
    const studentsSnap = await getDocs(collection(db, 'students'));
    const classStudents = [];
    studentsSnap.forEach(d => {
      const data = d.data();
      if (data.class === className) classStudents.push({ id: d.id, ...data });
    });
    classStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (classStudents.length === 0) {
      area.innerHTML = '<p class="text-sm text-muted">No students in this class.</p>';
      return;
    }

    const [year, month] = monthVal.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Load all attendance for the month
    const studentRecords = {}; // studentId -> { present, absent, late }
    for (const s of classStudents) {
      studentRecords[s.id] = { present: 0, absent: 0, late: 0 };
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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

init();
