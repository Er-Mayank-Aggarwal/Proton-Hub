// =============================================
// PROTON HUB ADMIN — Dashboard Page
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar, updateSidebarUser } from './sidebar.js';
import { showToast, formatDate, formatDateKey } from './utils.js';
import {
  collection, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let deferredPrompt;

async function init() {
  try {
    // Inject topbar
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Dashboard', 'fas fa-th-large'));

    // Init sidebar
    initSidebar(null);
    const user = await checkAuth();
    updateSidebarUser(user);

    // Load stats and activity using onSnapshot for instant loading
    loadStats();
    loadRecentActivity();

    // PWA Install Logic
    setupPwaInstall();
  } catch (err) {
    console.error('Dashboard init error:', err);
  }
}

function setupPwaInstall() {
  const installBtn = document.getElementById('pwaInstallBtn');
  if (!installBtn) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can add to home screen
    installBtn.style.display = 'inline-flex';
  });

  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again, throw it away
      deferredPrompt = null;
      installBtn.style.display = 'none';
    }
  });

  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    deferredPrompt = null;
    console.log('PWA was installed');
  });
}

function loadStats() {
  try {
    // Total students
    onSnapshot(collection(db, 'students'), (snap) => {
      document.getElementById('statStudents').textContent = snap.size;
    });

    // Total teachers
    onSnapshot(collection(db, 'teachers'), (snap) => {
      document.getElementById('statTeachers').textContent = snap.size;
    });

    // Today's attendance
    const today = formatDateKey(new Date());
    onSnapshot(collection(db, `attendance/${today}/records`), (snap) => {
      if (snap.size > 0) {
        let present = 0;
        snap.forEach(doc => {
          if (doc.data().status === 'present') present++;
        });
        const pct = Math.round((present / snap.size) * 100);
        document.getElementById('statAttendance').textContent = `${pct}%`;
      } else {
        document.getElementById('statAttendance').textContent = 'N/A';
      }
    });

    // Active announcements
    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('active', '==', true)
    );
    onSnapshot(announcementsQuery, (snap) => {
      document.getElementById('statAnnouncements').textContent = snap.size;
    });

  } catch (err) {
    console.error('Error loading stats:', err);
    showToast('Error loading dashboard data.', 'error');
  }
}

function loadRecentActivity() {
  const activityList = document.getElementById('activityList');
  let recentStudents = [];
  let recentAnnouncements = [];

  const renderActivities = () => {
    const activities = [...recentStudents, ...recentAnnouncements];
    if (activities.length === 0) return;

    activityList.innerHTML = activities.slice(0, 5).map(a => `
      <div class="activity-item">
        <div class="activity-icon ${a.iconClass}"><i class="${a.icon}"></i></div>
        <div>
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${a.time}</div>
        </div>
      </div>
    `).join('');
  };

  try {
    // Recent students
    const studentsQuery = query(
      collection(db, 'students'),
      orderBy('admissionDate', 'desc'),
      limit(3)
    );
    onSnapshot(studentsQuery, (snap) => {
      recentStudents = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        recentStudents.push({
          icon: 'fas fa-user-plus',
          iconClass: 'blue',
          text: `<strong>${data.name || 'Student'}</strong> enrolled in ${data.class || 'N/A'}`,
          time: data.admissionDate ? formatDate(data.admissionDate) : 'Recently'
        });
      });
      renderActivities();
    });

    // Recent announcements
    const announcementsQuery = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    onSnapshot(announcementsQuery, (snap) => {
      recentAnnouncements = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        recentAnnouncements.push({
          icon: 'fas fa-bullhorn',
          iconClass: 'orange',
          text: `Announcement: <strong>${data.title || 'Untitled'}</strong>`,
          time: data.createdAt ? formatDate(data.createdAt) : 'Recently'
        });
      });
      renderActivities();
    });

  } catch (err) {
    console.error('Error loading activity:', err);
  }
}

init();
