// =============================================
// PROTON HUB ADMIN — Firebase Configuration
// =============================================
// Replace the values below with your Firebase project config.
// You can find these in Firebase Console → Project Settings → General → Your Apps → Web App.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCp5T90tGsmGbTH2QfkVGvqLQMhbYdoQ5o",
  authDomain: "proton-hub-52453.firebaseapp.com",
  projectId: "proton-hub-52453",
  storageBucket: "proton-hub-52453.firebasestorage.app",
  messagingSenderId: "958737099834",
  appId: "1:958737099834:web:20ee776c0ccc8de54ed903",
  measurementId: "G-NJNCZDN5BB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
