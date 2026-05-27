// =============================================
// PROTON HUB ADMIN — Settings Page
// =============================================

import { db } from './firebase-config.js';
import { checkAuth } from './auth.js';
import { initSidebar, buildTopbar } from './sidebar.js';
import { showToast, formatDateFull } from './utils.js';
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function init() {
  try {
    const user = await checkAuth();
    const mainContent = document.getElementById('mainContent');
    mainContent.insertAdjacentHTML('afterbegin', buildTopbar('Settings', 'fas fa-cog'));
    initSidebar(user);



    // Set preview date
    document.getElementById('previewDateText').textContent = formatDateFull(new Date());

    // Load current settings
    await loadSettings();

    // Save handler
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
  } catch (err) {
    console.error('Settings init error:', err);
  }
}

async function loadSettings() {
  try {
    const docSnap = await getDoc(doc(db, 'siteConfig', 'display'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('showDayDate').checked = data.showDayDate === true;
      document.getElementById('whatsappNumber').value = data.whatsappNumber || '';
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  btn.disabled = true;

  try {
    // Get existing display data to preserve other fields
    const docSnap = await getDoc(doc(db, 'siteConfig', 'display'));
    const existing = docSnap.exists() ? docSnap.data() : {};

    await setDoc(doc(db, 'siteConfig', 'display'), {
      ...existing,
      showDayDate: document.getElementById('showDayDate').checked,
      whatsappNumber: document.getElementById('whatsappNumber').value.trim()
    });

    showToast('Settings saved!', 'success');

    const indicator = document.getElementById('settingsSaveIndicator');
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 2500);
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast('Failed to save settings.', 'error');
  } finally {
    btn.disabled = false;
  }
}

init();
