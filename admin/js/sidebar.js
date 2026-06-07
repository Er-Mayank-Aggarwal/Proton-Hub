// =============================================
// PROTON HUB ADMIN — Sidebar Navigation
// =============================================

import { logout } from './auth.js';
import { showModal } from './utils.js';

const NAV_ITEMS = [
  { section: 'Main' },
  { label: 'Dashboard', icon: 'fas fa-th-large', href: '/admin/dashboard.html' },
  { section: 'Management' },
  { label: 'Students', icon: 'fas fa-user-graduate', href: '/admin/students.html' },
  { label: 'Teachers', icon: 'fas fa-chalkboard-teacher', href: '/admin/teachers.html' },
  { label: 'Attendance', icon: 'fas fa-calendar-check', href: '/admin/attendance.html' },
  { label: 'Announcements', icon: 'fas fa-bullhorn', href: '/admin/announcements.html' },
  { section: 'Website' },
  { label: 'Content Editor', icon: 'fas fa-edit', href: '/admin/content-editor.html' },
  { label: 'Settings', icon: 'fas fa-cog', href: '/admin/settings.html' }
];

/**
 * Initialize the sidebar on a page.
 * @param {Object} user - The authenticated Firebase user object
 */
export function updateSidebarUser(user) {
  if (!user) return;
  const adminName = user.email?.split('@')[0] || 'Admin';
  const initials = adminName.substring(0, 2).toUpperCase();
  
  const nameEl = document.querySelector('.sidebar-footer .admin-name');
  const avatarEl = document.querySelector('.sidebar-footer .admin-avatar');
  
  if (nameEl) nameEl.textContent = adminName;
  if (avatarEl) avatarEl.textContent = initials;
}

export function initSidebar(user) {
  if (document.getElementById('sidebar')) {
    updateSidebarUser(user);
    setupPwaInstall();
    return;
  }
  
  const sidebarHTML = buildSidebarHTML(user);
  
  // Insert sidebar into the DOM
  const appLayout = document.querySelector('.app-layout');
  if (!appLayout) return;

  // Create sidebar element
  const sidebarEl = document.createElement('aside');
  sidebarEl.className = 'sidebar';
  sidebarEl.id = 'sidebar';
  sidebarEl.innerHTML = sidebarHTML;

  // Create overlay for mobile
  const overlayEl = document.createElement('div');
  overlayEl.className = 'sidebar-overlay';
  overlayEl.id = 'sidebarOverlay';

  // Insert at beginning of app layout
  appLayout.prepend(overlayEl);
  appLayout.prepend(sidebarEl);

  // Set active nav link
  setActiveLink();

  // Setup hamburger toggle
  setupMobileToggle();

  // Setup logout
  setupLogout();
  
  // Setup PWA install button
  setupPwaInstall();
}

function buildSidebarHTML(user) {
  const currentPage = window.location.pathname;
  const adminName = user?.email?.split('@')[0] || 'Admin';
  const initials = adminName.substring(0, 2).toUpperCase();

  let navHTML = '';
  for (const item of NAV_ITEMS) {
    if (item.section) {
      navHTML += `<div class="nav-section-title">${item.section}</div>`;
    } else {
      const isActive = currentPage.includes(item.href.split('/').pop());
      navHTML += `<a href="${item.href}" class="${isActive ? 'active' : ''}">
        <i class="${item.icon}"></i>
        <span>${item.label}</span>
      </a>`;
    }
  }

  return `
    <div class="sidebar-header">
      <img src="/Components/Utilities/logo.jpg" alt="Proton Hub Logo">
      <div>
        <div class="brand-name">Proton Hub</div>
        <div class="brand-tag">Admin Panel</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${navHTML}
      <a href="#" id="pwaInstallBtn" style="display: none; color: var(--success); font-weight: 600; border-top: 1px dashed rgba(255,255,255,0.15); margin-top: 10px; padding-top: 15px;">
        <i class="fas fa-download"></i>
        <span>Install App</span>
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="admin-info">
        <div class="admin-avatar">${initials}</div>
        <div>
          <div class="admin-name">${adminName}</div>
          <div class="admin-role">Administrator</div>
        </div>
      </div>
      <button class="logout-btn" id="logoutBtn">
        <i class="fas fa-sign-out-alt"></i>
        <span>Logout</span>
      </button>
    </div>
  `;
}

function setActiveLink() {
  const currentPath = window.location.pathname;
  const links = document.querySelectorAll('.sidebar-nav a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    const pageName = href.split('/').pop();
    if (currentPath.endsWith(pageName)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function setupMobileToggle() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.querySelector('.hamburger-btn');

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await logout();
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }
}

/**
 * Build the topbar HTML for a page.
 * @param {string} title - Page title 
 * @param {string} icon - Font Awesome icon class
 * @returns {string} HTML string
 */
export function buildTopbar(title, icon) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="hamburger-btn" id="hamburgerBtn">
          <i class="fas fa-bars"></i>
        </button>
        <h1 class="page-title"><i class="${icon}"></i> ${title}</h1>
      </div>
      <div class="topbar-right">
        <div class="topbar-date">
          <i class="fas fa-calendar-alt"></i>
          <span>${dateStr}</span>
        </div>
      </div>
    </div>
  `;
}

let deferredPrompt = null;

// Listen for the beforeinstallprompt event globally
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // If the button already exists in DOM, show it
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

function setupPwaInstall() {
  const installBtn = document.getElementById('pwaInstallBtn');
  if (!installBtn) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isStandalone) {
    installBtn.style.display = 'none';
    return;
  }

  // If beforeinstallprompt already fired, show it
  if (deferredPrompt) {
    installBtn.style.display = 'flex';
  } else if (isIOS) {
    // iOS Safari does not support beforeinstallprompt but we can show instructions on click
    installBtn.style.display = 'flex';
  }

  // Handle click event
  installBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install prompt user choice: ${outcome}`);
      deferredPrompt = null;
      installBtn.style.display = 'none';
    } else if (isIOS) {
      showIOSInstallInstructions();
    }
  });
}

function showIOSInstallInstructions() {
  const bodyHTML = `
    <div style="text-align: center; padding: 12px 0;">
      <p style="font-size: 1rem; margin-bottom: 16px; line-height: 1.5; color: var(--text);">
        Install <strong>Proton Hub Admin</strong> on your iPhone to access it directly from your home screen.
      </p>
      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left; background: var(--bg); padding: 16px; border-radius: var(--radius);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--primary); color: #fff; border-radius: 50%; font-weight: 600; font-size: 0.9rem; flex-shrink: 0;">1</span>
          <span>Tap the <strong>Share</strong> button at the bottom of Safari: <i class="fas fa-external-link-alt" style="color: var(--primary); margin-left: 2px;"></i> or <i class="far fa-share-square" style="color: var(--primary); margin-left: 2px;"></i></span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--primary); color: #fff; border-radius: 50%; font-weight: 600; font-size: 0.9rem; flex-shrink: 0;">2</span>
          <span>Scroll down and select <strong>Add to Home Screen</strong>: <i class="far fa-plus-square" style="color: var(--primary); margin-left: 2px;"></i></span>
        </div>
      </div>
    </div>
  `;

  showModal('Install on iOS', bodyHTML, {
    icon: 'fab fa-apple',
    maxWidth: '450px',
    footerHTML: '<button class="btn btn-primary" id="modalCloseBtn" style="width: 100%;">Got It</button>',
    onOpen: (overlay) => {
      overlay.querySelector('#modalCloseBtn').addEventListener('click', () => {
        const modalOverlay = overlay;
        modalOverlay.classList.remove('active');
        setTimeout(() => modalOverlay.remove(), 250);
      });
    }
  });
}
