// =============================================
// PROTON HUB ADMIN — Dashboard Page
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import { showToast, formatDate, formatDateKey } from './utils.js';
import {
  collection, getDocs, query, where, orderBy, limit, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function init() {
  try {
    const user = await checkAuth();

    // Inject topbar
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Dashboard', 'fas fa-th-large'));

    // Init sidebar
    initSidebar(user);

    // Load stats
    await loadStats();
  } catch (err) {
    console.error('Dashboard init error:', err);
  }
}

async function loadStats() {
  try {
    // Total students
    const studentsSnap = await getDocs(collection(db, 'students'));
    document.getElementById('statStudents').textContent = studentsSnap.size;

    // Total teachers
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    document.getElementById('statTeachers').textContent = teachersSnap.size;

    // Today's attendance
    const today = formatDateKey(new Date());
    const attendanceSnap = await getDocs(collection(db, `attendance/${today}/records`));
    if (attendanceSnap.size > 0) {
      let present = 0;
      attendanceSnap.forEach(doc => {
        if (doc.data().status === 'present') present++;
      });
      const pct = Math.round((present / attendanceSnap.size) * 100);
      document.getElementById('statAttendance').textContent = `${pct}%`;
    } else {
      document.getElementById('statAttendance').textContent = 'N/A';
    }

    // Active announcements
    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('active', '==', true)
    );
    const announcementsSnap = await getDocs(announcementsQuery);
    document.getElementById('statAnnouncements').textContent = announcementsSnap.size;

    // Load recent activity
    await loadRecentActivity();
  } catch (err) {
    console.error('Error loading stats:', err);
    showToast('Error loading dashboard data.', 'error');
  }
}

async function loadRecentActivity() {
  const activityList = document.getElementById('activityList');
  const activities = [];

  try {
    // Recent students
    const studentsQuery = query(
      collection(db, 'students'),
      orderBy('admissionDate', 'desc'),
      limit(3)
    );
    const studentsSnap = await getDocs(studentsQuery);
    studentsSnap.forEach(docSnap => {
      const data = docSnap.data();
      activities.push({
        icon: 'fas fa-user-plus',
        iconClass: 'blue',
        text: `<strong>${data.name || 'Student'}</strong> enrolled in ${data.class || 'N/A'}`,
        time: data.admissionDate ? formatDate(data.admissionDate) : 'Recently'
      });
    });

    // Recent announcements
    const announcementsQuery = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const announcementsSnap = await getDocs(announcementsQuery);
    announcementsSnap.forEach(docSnap => {
      const data = docSnap.data();
      activities.push({
        icon: 'fas fa-bullhorn',
        iconClass: 'orange',
        text: `Announcement: <strong>${data.title || 'Untitled'}</strong>`,
        time: data.createdAt ? formatDate(data.createdAt) : 'Recently'
      });
    });

    // Sort by time (newest first) — rough sort
    if (activities.length === 0) return; // Keep empty state

    activityList.innerHTML = activities.slice(0, 5).map(a => `
      <div class="activity-item">
        <div class="activity-icon ${a.iconClass}"><i class="${a.icon}"></i></div>
        <div>
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${a.time}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading activity:', err);
  }
}

init();
