import app from './firebase_config.js';
import { getFirestore, collection, onSnapshot, query, doc, setDoc, deleteDoc, runTransaction, updateDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Collection paths
const getUsersCollection = () => collection(db, 'artifacts', appId, 'users');
const getRoleDocRef = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'user_role', 'role');
// const getStudentPrivateCollection = (uid) => collection(db, 'artifacts', appId, 'users', uid, 'student_data'); // This path is not used
const getBookingsPublicCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'bookings');

// --- READ / LISTEN FUNCTIONS ---

/**
 * Subscribes to changes in all user roles/profiles (Admin View).
 */
export function subscribeToAllUsers(callback) {
    const q = getUsersCollection();
    
    // We need to fetch the subcollection 'user_role/role' for each user.
    // This implementation fetches all users, then iterates to get their role doc.
    // This is not perfectly real-time for *role changes* but is real-time for *new users*.
    // A more complex setup (e.g., Cloud Function mirroring data) would be needed for true real-time on subcollections.
    return onSnapshot(q, async (snapshot) => {
        const users = [];
        for (const userDoc of snapshot.docs) {
            const uid = userDoc.id;
            // Fetch the role sub-document for each user
            const roleDocRef = getRoleDocRef(uid);
            try {
                const roleDoc = await getDoc(roleDocRef);
                if (roleDoc.exists()) {
                    users.push({ 
                        uid, 
                        ...roleDoc.data(),
                    });
                }
            } catch (error) {
                console.warn(`Could not fetch role for user ${uid}:`, error.message);
            }
        }
        callback(users);
    }, (error) => {
        console.error("Error subscribing to users:", error.message);
    });
}

/**
 * Subscribes to a specific student's data (Student View).
 * FIXED: This now listens to the correct 'user_role/role' document where
 * all student data (including scheme and marks) is stored.
 */
export function subscribeToMyStudentData(userId, callback) {
    const roleDocRef = getRoleDocRef(userId);

    return onSnapshot(roleDocRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            // Document doesn't exist (e.g., user created but profile not set)
            callback(null);
        }
    }, (error) => {
        // This is expected to throw "Missing or insufficient permissions" if logged out or not owner
        console.error("Error subscribing to student data:", error.message);
    });
}

// --- ADMIN CRUD FUNCTIONS ---

/**
 * Admin updates core user/student information.
 * @param {string} uid User ID
 * @param {object} data Object containing fields like {name, surname, studentNumber, markingScheme (JSON string), marks (JSON string)}
 */
export async function updateStudentData(uid, data) {
    const roleDocRef = getRoleDocRef(uid);
    try {
        // Data structure for the role document in user_role/role
        const updatePayload = {
            name: data.name,
            surname: data.surname,
            phone: data.phone,
            studentNumber: data.studentNumber,
            // Convert markingScheme string back to a JSON object
            markingScheme: JSON.parse(data.markingScheme || '{}'),
            // NEW: Convert marks string back to a JSON object
            marks: JSON.parse(data.marks || '{}'),
        };

        // Use updateDoc to merge data, preserving fields like 'role'
        await updateDoc(roleDocRef, updatePayload);
        console.log(`Student data for ${uid} updated.`);
    } catch (error) {
        console.error("Error updating student data:", error);
        throw error;
    }
}


/**
 * Admin deletes a user and their profile data (requires Auth and Firestore deletion).
 * NOTE: Deleting the user from Auth requires server-side code (Cloud Functions/Admin SDK).
 * We will only delete the Firestore profile here.
 */
export async function deleteUser(uid) {
    try {
        // Delete the profile/role document
        const roleDocRef = getRoleDocRef(uid);
        await deleteDoc(roleDocRef);
        console.log(`User profile deleted for UID: ${uid}`);

        // Ideally, Auth.deleteUser(uid) would be called via Cloud Functions here.
        // For client-side simulation, we assume successful deletion.

    } catch (error) {
        console.error("Error deleting user profile:", error);
        throw error;
    }
}


// --- BOOKING FUNCTIONS ---

/**
 * Student function to create a new booking request.
 */
export async function addBooking(studentUid, lecturerUid, moduleName, preferredTime) {
    const bookingDoc = doc(getBookingsPublicCollection());
    try {
        await setDoc(bookingDoc, {
            studentUid,
            lecturerUid: lecturerUid || 'unassigned', // Allow booking without specific lecturer initially
            moduleName,
            preferredTime,
            status: 'pending', // 'pending', 'accepted', 'rejected'
            createdAt: new Date().toISOString()
        });
        console.log("Booking successfully added.");
    } catch (error) {
        console.error("Error adding booking:", error);
        throw error;
    }
}

/**
 * Lecturer function to subscribe to their bookings.
 */
export function subscribeToLecturerBookings(lecturerUid, callback) {
    // In a real app, you would filter by lecturerUid here.
    const q = getBookingsPublicCollection(); 

    return onSnapshot(q, (snapshot) => {
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Simulate filtering on client-side for simplicity if Firestore filter isn't set up
        const filteredBookings = bookings.filter(b => b.lecturerUid === lecturerUid || b.lecturerUid === 'unassigned');
        callback(filteredBookings);
    }, (error) => {
        console.error("Error subscribing to lecturer bookings:", error.message);
    });
}

/**
 * Lecturer function to update booking status (accept/reject).
 */
export async function updateBookingStatus(bookingId, newStatus) {
    const bookingDocRef = doc(getBookingsPublicCollection(), bookingId);
    try {
        await updateDoc(bookingDocRef, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        console.log(`Booking ${bookingId} status updated to ${newStatus}.`);
    } catch (error) {
        console.error("Error updating booking status:", error);
        throw error;
    }
}

