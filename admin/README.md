# Proton Hub Admin Dashboard

This directory contains the completely standalone Administration Dashboard for Proton Hub.

## Architecture

The admin dashboard is built as a pure HTML/CSS/JS single-page-like application that lives entirely within the `/admin` folder. 
It does not rely on Vite, React, or any build step, ensuring 100% compatibility with the existing static website structure.

- **Authentication**: Firebase Authentication (Email/Password)
- **Database**: Firebase Firestore
- **Styling**: Custom CSS Design System (no Tailwind or external frameworks)
- **Icons**: FontAwesome 6.4

## Folder Structure

```
admin/
├── index.html               # Login Page
├── dashboard.html           # Main Analytics Dashboard
├── students.html            # Student Management (CRUD)
├── teachers.html            # Teacher Management (CRUD)
├── attendance.html          # Daily Attendance Tracker
├── announcements.html       # Manage Live Site Announcements
├── content-editor.html      # Edit Site Content (Hero, Testimonials, Results, etc.)
├── settings.html            # Global Site Settings (Date badge, WhatsApp number)
├── css/
│   ├── admin-base.css       # CSS Variables and Resets
│   ├── admin-components.css # Reusable UI Components (Cards, Modals, Toasts)
│   └── admin-pages.css      # Page-specific layouts
└── js/
    ├── firebase-config.js   # Firebase Initialization
    ├── auth.js              # Auth Guard and Login Logic
    ├── utils.js             # Shared helpers (Toasts, Modals, Formatters)
    ├── sidebar.js           # Dynamic Sidebar & Topbar Injection
    └── [page].js            # Logic for each respective HTML page
```

## Setup & Deployment

1. **Firebase Configuration**
   - Open `admin/js/firebase-config.js` and `Pages_JS/firebase-live.js`.
   - Replace the `firebaseConfig` object with your actual Firebase project credentials.
   
2. **Security Rules**
   - In your Firebase Console, navigate to Firestore Database -> Rules.
   - Copy the contents of `/firestore.rules` from the root of this repository and paste them there.
   - This ensures public data (announcements, content) is readable by anyone, but sensitive data (students, attendance) and write access is restricted to authenticated admins only.

3. **Admin User Creation**
   - The dashboard does not have a "Sign Up" page for security.
   - You must manually create the first Admin user in the Firebase Console (Authentication -> Add User).
   - Use that Email and Password to log in at `/admin/index.html`.

4. **Deployment**
   - Because this is purely static, you can deploy the entire repository to Netlify (or any static host) exactly as before.
   - The admin panel will be accessible at `yourdomain.com/admin`.

## Connecting to the Frontend

The main website uses `Pages_JS/firebase-live.js` to dynamically fetch and display content managed from this admin dashboard.

The static HTML pages have been modified with specific `id` attributes (e.g., `id="dyn-hero-heading"`) which the live script targets for content injection. If the dynamic content is not found in Firestore, the static HTML content serves as a graceful fallback.
