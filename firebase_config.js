import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// User's provided Firebase configuration
const userFirebaseConfig = {
    apiKey: "AIzaSyAaBJLT2fRoJlCAq-0PP8R13wxrJjmz_Xw",
    authDomain: "hippocampuseducation-aa66c.firebaseapp.com",
    projectId: "hippocampuseducation-aa66c",
    storageBucket: "hippocampuseducation-aa66c.firebasestorage.app",
    messagingSenderId: "431625539017",
    appId: "1:431625539017:web:db58163a37748d244fec18",
    measurementId: "G-4RWW39T45V"
};

// Use the environment-provided config if available, otherwise fall back to the user's config
const firebaseConfig = JSON.parse(
    typeof __firebase_config !== 'undefined' 
    ? __firebase_config 
    : JSON.stringify(userFirebaseConfig)
);

// Initialize Firebase App instance
const app = initializeApp(firebaseConfig);

// Export the app instance
export default app;

