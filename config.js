// ─── 4E AR Studio — Configuration ─────────────────────────────────────────────

// Firebase (Firestore for realtime metadata — client keys are safe to expose)
window.AR_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDMH3dNJcDVm0nJIMKD_TA5SMUGLKcC6Es",
  authDomain:        "ar-studio-4e.firebaseapp.com",
  projectId:         "ar-studio-4e",
  storageBucket:     "ar-studio-4e.firebasestorage.app",
  messagingSenderId: "305456357965",
  appId:             "1:305456357965:web:9f68c649bc190a74dd3204"
};

// GitHub (asset storage via repo)
// Token is entered once via the builder UI and saved to localStorage
window.AR_GITHUB_CONFIG = {
  owner: "Sean4E",
  repo:  "4e-ar-studio",
  branch: "main",
  token: ""
};

// Base URL for the player (GitHub Pages)
window.AR_BASE_URL = "https://sean4e.github.io/4e-ar-studio";
