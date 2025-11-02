import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, setPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// User's provided Firebase configuration (fallback)
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

// Enable debug logging
setLogLevel('debug');

const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Asynchronous function to handle initial authentication
async function initializePrimaryAuth() {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            // Use in-memory persistence for the primary auth instance
            // This ensures that when we create staff, we don't overwrite the admin's session
            await setPersistence(auth, inMemoryPersistence); 
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Primary auth instance (admin) signed in with custom token.");
        } catch (error) {
            console.error("Primary custom token sign-in failed:", error);
        }
    } else {
        // This case is for public pages like login/register where no token is provided
        console.log("No custom token provided. Auth instance is unauthenticated (e.g., for login/register pages).");
    }
}

// Call the initialization
initializePrimaryAuth();

// Export the necessary instances AND the config object
export { app, auth, db, appId, firebaseConfig };

