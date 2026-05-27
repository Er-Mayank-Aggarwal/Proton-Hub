// =============================================
// PROTON HUB — LIVE FIREBASE INTEGRATION
// =============================================
// This script connects the static frontend to Firebase
// and dynamically injects content (announcements, testimonials, etc.)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Import config (shared with admin, but here we can hardcode if needed, or point to same module)
// For the static site, we'll initialize directly to avoid dependency issues if it's served differently.
const firebaseConfig = {
  apiKey: "AIzaSyCp5T90tGsmGbTH2QfkVGvqLQMhbYdoQ5o",
  authDomain: "proton-hub-52453.firebaseapp.com",
  projectId: "proton-hub-52453",
  storageBucket: "proton-hub-52453.firebasestorage.app",
  messagingSenderId: "958737099834",
  appId: "1:958737099834:web:20ee776c0ccc8de54ed903",
  measurementId: "G-NJNCZDN5BB"
};

let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

// ---------------------------------------------
// ANNOUNCEMENTS POPUP
// ---------------------------------------------
async function initAnnouncements() {
  if (!db) return;
  try {
    // Get active announcements
    const q = query(
      collection(db, "announcements"),
      where("active", "==", true),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    if (snap.empty) return;

    // Build popup UI
    let popupHTML = `
      <div id="live-announcement-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);opacity:0;transition:opacity 0.3s;padding:20px;">
        <div style="background:#fff;border-radius:12px;width:100%;max-width:500px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.2);transform:translateY(20px);transition:transform 0.3s;">
          <div style="background:#4a6fa5;color:#fff;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:1.1rem;"><i class="fas fa-bullhorn"></i> Important Updates</h3>
            <button id="close-announcement-btn" style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;">&times;</button>
          </div>
          <div style="padding:20px;max-height:60vh;overflow-y:auto;">
    `;

    snap.forEach(docSnap => {
      const a = docSnap.data();
      const typeColor = a.type === 'alert' ? '#dc2626' : (a.type === 'event' ? '#d97706' : '#3b82f6');
      const typeBg = a.type === 'alert' ? '#fee2e2' : (a.type === 'event' ? '#fef3c7' : '#dbeafe');

      popupHTML += `
        <div style="margin-bottom:15px;padding:15px;border-radius:8px;border:1px solid #e2e8f0;border-left:4px solid ${typeColor};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h4 style="margin:0;font-size:1rem;color:#1e293b;">${escapeHTML(a.title)}</h4>
            <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${typeBg};color:${typeColor};text-transform:uppercase;font-weight:600;">${a.type}</span>
          </div>
          <p style="margin:0;font-size:0.9rem;color:#475569;line-height:1.5;">${escapeHTML(a.message).replace(/\n/g, '<br>')}</p>
        </div>
      `;
    });

    popupHTML += `
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHTML);
    const overlay = document.getElementById('live-announcement-overlay');
    const inner = overlay.querySelector('div');

    // Show with animation
    setTimeout(() => {
      overlay.style.opacity = '1';
      inner.style.transform = 'translateY(0)';
    }, 500);

    // Close handler
    document.getElementById('close-announcement-btn').addEventListener('click', () => {
      overlay.style.opacity = '0';
      inner.style.transform = 'translateY(20px)';
      setTimeout(() => overlay.remove(), 300);
    });

  } catch (err) {
    console.error("Error loading announcements:", err);
  }
}

// ---------------------------------------------
// LIVE DATE BADGE
// ---------------------------------------------
async function initLiveDateBadge() {
  if (!db) return;
  try {
    const docSnap = await getDoc(doc(db, 'siteConfig', 'display'));
    if (docSnap.exists() && docSnap.data().showDayDate) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

      const badgeHTML = `
        <div style="position:fixed;bottom:20px;left:20px;background:rgba(255,255,255,0.9);backdrop-filter:blur(5px);border:1px solid #e2e8f0;padding:8px 16px;border-radius:50px;box-shadow:0 4px 6px rgba(0,0,0,0.05);z-index:9000;display:flex;align-items:center;gap:8px;font-family:'Poppins',sans-serif;font-size:0.85rem;color:#1e293b;font-weight:500;">
          <i class="fas fa-calendar-day" style="color:#4a6fa5;"></i> ${dateStr}
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', badgeHTML);
    }
  } catch (err) {
    console.error("Error loading date badge settings:", err);
  }
}

// ---------------------------------------------
// DYNAMIC CONTENT INJECTION
// ---------------------------------------------

// Hero Section
async function injectHero() {
  if (!db) return;
  try {
    const docSnap = await getDoc(doc(db, 'siteConfig', 'display'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const headingEl = document.getElementById('dyn-hero-heading');
      const subtextEl = document.getElementById('dyn-hero-subtext');
      const ctaEl = document.getElementById('dyn-hero-cta');

      if (headingEl && data.heroHeading) headingEl.textContent = data.heroHeading;
      if (subtextEl && data.heroSubtext) subtextEl.textContent = data.heroSubtext;
      if (ctaEl && data.heroCtaText) ctaEl.textContent = data.heroCtaText;
    }
  } catch (e) { console.error("Error injecting hero:", e); }
}

// Director's Quote
async function injectDirectorQuote() {
  if (!db) return;
  try {
    const docSnap = await getDoc(doc(db, 'siteConfig', 'display'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const quoteEl = document.getElementById('dyn-director-quote');
      if (quoteEl && data.directorQuote) {
        quoteEl.innerHTML = `"${escapeHTML(data.directorQuote).replace(/\n/g, '<br>')}"`;
      }
    }
  } catch (e) { console.error("Error injecting director quote:", e); }
}

// Courses
async function injectCourses() {
  if (!db) return;
  try {
    const docSnap = await getDoc(doc(db, 'siteConfig', 'courses'));
    if (!docSnap.exists()) return;
    const data = docSnap.data();

    const injectCourseBlock = (idPrefix, courseData) => {
      const subjectsEl = document.getElementById(`${idPrefix}-subjects`);
      const highlightsEl = document.getElementById(`${idPrefix}-highlights`);

      if (subjectsEl && courseData.subjects) {
        subjectsEl.innerHTML = courseData.subjects.map(s => `<li><i class="fas fa-check text-primary"></i> ${escapeHTML(s)}</li>`).join('');
      }
      if (highlightsEl && courseData.highlights) {
        highlightsEl.innerHTML = courseData.highlights.map(h => `<li><i class="fas fa-star text-warning"></i> ${escapeHTML(h)}</li>`).join('');
      }
    };

    injectCourseBlock('dyn-course-58', data.class5to8 || {});
    injectCourseBlock('dyn-course-910', data.class9to10 || {});
    injectCourseBlock('dyn-course-1112', data.class11to12 || {});
  } catch (e) { console.error("Error injecting courses:", e); }
}

// Testimonials
async function injectTestimonials() {
  const container = document.getElementById('dyn-testimonials-container');
  if (!container || !db) return;

  try {
    const q = query(collection(db, 'testimonials'), where('active', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return;

    let html = '';
    snap.forEach(docSnap => {
      const t = docSnap.data();
      const photo = t.photoUrl || '/Components/Utilities/default-avatar.png'; // Fallback
      html += `
        <div class="testimonial">
          <p>"${escapeHTML(t.quote)}"</p>
          <div class="author">
            <img src="${escapeHTML(photo)}" alt="${escapeHTML(t.parentName)}">
            <div>
              <strong>${escapeHTML(t.parentName)}</strong><br>
              ${escapeHTML(t.relation)}${t.studentClass ? ` (${escapeHTML(t.studentClass)})` : ''}
            </div>
          </div>
        </div>
      `;
    });

    // Replace the inner HTML. Note: depends on existing website CSS
    container.innerHTML = html;

  } catch (e) { console.error("Error injecting testimonials:", e); }
}

// Results
async function injectResults() {
  const container = document.getElementById('dyn-results-container');
  if (!container || !db) return;

  try {
    const q = query(collection(db, 'results'), where('active', '==', true), orderBy('percentage', 'desc'), limit(12));
    const snap = await getDocs(q);
    if (snap.empty) return;

    let html = '';
    snap.forEach(docSnap => {
      const r = docSnap.data();
      html += `
        <div class="slider-item">
          <h3>${escapeHTML(r.studentName)}</h3>
          <p><strong>${escapeHTML(r.percentage)}%</strong> in ${escapeHTML(r.class)}</p>
          ${r.subject ? `<span class="category">Top in ${escapeHTML(r.subject)} ${r.score ? `(${escapeHTML(r.score)})` : ''}</span>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;

  } catch (e) { console.error("Error injecting results:", e); }
}

// Helper
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------
// BOOTSTRAP
// ---------------------------------------------
function bootstrap() {
  initAnnouncements();
  initLiveDateBadge();

  // Specific page injections based on IDs present
  if (document.getElementById('dyn-hero-heading')) injectHero();
  if (document.getElementById('dyn-director-quote')) injectDirectorQuote();
  if (document.getElementById('dyn-course-58-subjects')) injectCourses();
  if (document.getElementById('dyn-testimonials-container')) injectTestimonials();
  if (document.getElementById('dyn-results-container')) injectResults();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
