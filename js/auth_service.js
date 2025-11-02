// Import the *named* exports from our config file
import { auth, db, appId, firebaseConfig } from './firebase_config.js'; 
// Import *all* necessary functions from the SDK
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence // For the temp app to sign in the new user
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// deleteApp is part of the 'app' module, not 'auth'
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Path: artifacts/{appId}/users/{userId}/user_role/role
const getRoleDocRef = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'user_role', 'role');

/**
 * Attaches an observer to the authentication state.
 */
export function setupAuthListener(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) { 
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
            callback(null); // Logged out
        }
    });
}


/**
 * Admin function to create a new Lecturer or Admin account.
 * This uses a temporary, isolated Firebase app instance.
 */
export async function createStaffUser(email, password, role) {
    // 1. Create a unique name for the temporary app
    const tempAppName = `staff-creation-${Date.now()}`;
    
    // 2. Initialize a new, temporary Firebase app
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    
    // 3. Get Auth and DB services from the temporary app
    const tempAuth = getAuth(tempApp);
    
    // 4. Set persistence for the temporary auth
    await setPersistence(tempAuth, browserLocalPersistence);

    try {
        // 5. Create the user with the temporary Auth instance
        const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
        const user = userCredential.user;

        // 6. Save the user's role using the MAIN app's db instance (which is authenticated as admin)
        await setDoc(getRoleDocRef(user.uid), { 
            role: role,
            email: user.email,
            name: 'Staff', // Default name
            surname: role, // Default surname
            phone: '',
            createdAt: new Date().toISOString(),
            uid: user.uid // Store the UID in the document
        });

        // 7. Sign out the user from the temporary app
        await signOut(tempAuth);
        
        // 8. Delete the temporary app to clean up
        await deleteApp(tempApp);
        
        console.log(`Successfully created ${role} ${email} and cleaned up temp app.`);

    } catch (error) {
        // 9. Clean up even if there's an error
        await signOut(tempAuth);
        await deleteApp(tempApp);
        
        console.error(`Error creating staff user: ${error.message}`);
        // Rethrow the error to be handled by the UI
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

