import app from './firebase_config.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);
// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize anonymous/custom authentication 
// This is critical for initial Firestore access (like role check)
async function initializeAuth() {
    if (typeof __initial_auth_token !== 'undefined') {
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
}
initializeAuth();

// Path: artifacts/{appId}/users/{userId}/user_role/role
const getRoleDocRef = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'user_role', 'role');

/**
 * Attaches an observer to the authentication state.
 */
export function setupAuthListener(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) { // Only fetch role for non-anonymous users
            try {
                const roleDoc = await getDoc(getRoleDocRef(user.uid));
                
                let userData = {
                    user,
                    role: 'student', // Default fallback role
                    name: user.email.split('@')[0], // Default name from email
                    surname: '', 
                    phone: '',
                    email: user.email,
                    uid: user.uid,
                };
                
                if (roleDoc.exists()) {
                    const data = roleDoc.data();
                    // Merge all data from the role document
                    Object.assign(userData, data);
                }
                
                callback(userData);

            } catch (error) {
                console.error("Error fetching user role and profile:", error.message);
                // Return a default user structure on error
                callback({ user, role: 'student', name: user.email.split('@')[0], surname: '', phone: '', email: user.email, uid: user.uid });
            }
        } else {
            callback(null); // Logged out or Anonymous
        }
    });
}

/**
 * Logs in a user.
 */
export async function loginUser(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error.message);
        throw error;
    }
}

/**
 * Registers a new user (hardcoded as 'student') with full profile details.
 */
export async function registerUser(email, password, name, surname, phone) {
    const initialRole = 'student';
    
    try {
        // Step 1: Create user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Save the user's role and profile data to Firestore
        // Use a basic setDoc with no merge to ensure the document is created.
        await setDoc(getRoleDocRef(user.uid), { 
            role: initialRole,
            email: user.email,
            name: name,
            surname: surname,
            phone: phone,
            createdAt: new Date().toISOString()
        });
        
    } catch (error) {
        // Log the error for debugging
        console.error("Registration Error:", error.message);
        // Rethrow the error to be handled by the UI
        throw error;
    }
}

/**
 * Admin function to create a new Lecturer or Admin account.
 */
export async function createStaffUser(email, password, role) {
    // NOTE: This client-side function relies on Firebase Security Rules to ensure 
    // only existing Admins can write new roles to the Firestore collection.
    
    try {
        // Using createUserWithEmailAndPassword in client code is generally for self-registration.
        // For Admin to create users, you would ideally use a Cloud Function, 
        // but for this client-only demo, we'll use a direct registration and 
        // rely on a check in the Admin UI and the Firestore Rules.
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save the user's role immediately
        await setDoc(getRoleDocRef(user.uid), { 
            role: role,
            email: user.email,
            name: 'Staff', 
            surname: role,
            createdAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`Staff Creation Error (${role}):`, error.message);
        throw error;
    }
}

/**
 * Logs out the current user.
 */
export async function logoutUser() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error.message);
        throw error;
    }
}
