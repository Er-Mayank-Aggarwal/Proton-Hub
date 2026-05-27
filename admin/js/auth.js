// =============================================
// PROTON HUB ADMIN — Authentication Module
// =============================================

import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/**
 * Check if user is authenticated. If not, redirect to login page.
 * Call this on every protected page.
 * @returns {Promise<Object>} The authenticated user object.
 */
export function checkAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        window.location.href = '/admin/index.html';
        reject(new Error('Not authenticated'));
      }
    });
  });
}

/**
 * Login with email and password.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} User credential
 */
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Logout and redirect to login page.
 */
export async function logout() {
  await signOut(auth);
  window.location.href = '/admin/index.html';
}

/**
 * Get the current authenticated user (or null).
 * @returns {Object|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Initialize login form handler.
 * Call this only on the login page.
 */
export function initLoginForm() {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const submitBtn = document.getElementById('loginBtn');

  if (!form) return;

  // If already logged in, redirect to dashboard
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = '/admin/dashboard.html';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      showLoginError('Please fill in all fields.');
      return;
    }

    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    hideLoginError();

    try {
      await login(email, password);
      window.location.href = '/admin/dashboard.html';
    } catch (error) {
      let message = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Check your internet connection.';
      }
      showLoginError(message);
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  function showLoginError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  }

  function hideLoginError() {
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }
}
