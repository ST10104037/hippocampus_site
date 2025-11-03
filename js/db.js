import { db, appId } from './firebase_config.js';
import { 
    collection, onSnapshot, query, doc, setDoc, deleteDoc, 
    updateDoc, getDocs, getDoc, collectionGroup, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Path Helpers ---
// const getUsersCollection = () => collection(db, 'artifacts', appId, 'users');
const getRoleDocRef = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'user_role', 'role');
const getBookingsPublicCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'bookings');

// --- READ / LISTEN FUNCTIONS ---

/**
 * Subscribes to changes in all user roles/profiles (Admin View).
 * This queries the 'user_role' collectionGroup directly.
 */
export function subscribeToAllUsers(callback) {
    const q = collectionGroup(db, 'user_role');
    console.log("Subscribing to all user roles (collectionGroup)...");
    
    return onSnapshot(q, (snapshot) => {
        const users = [];
        console.log(`Found ${snapshot.docs.length} user role documents in collectionGroup.`);
        
        try {
            for (const roleDoc of snapshot.docs) {
                if (roleDoc.exists()) {
                    const data = roleDoc.data();
                    if (data.uid) { 
                        console.log(`  -> Found role doc for ${data.uid}, role: ${data.role}`);
                        users.push(data); // The document data is the user data
                    } else {
                        console.warn(`  -> Found role doc but it's missing a 'uid' field.`);
                    }
                }
            }
            
            console.log(`Callback called with ${users.length} total users.`);
            callback(users);

        } catch (error) {
            console.error("Error processing user roles:", error.message);
            callback([]); // Send an empty array on error
        }
    }, (error) => {
        // This will fire if the rules are wrong
        console.error("Error subscribing to collectionGroup 'user_role':", error.message);
    });
}

/**
 * NEW: Subscribes to all students assigned to a specific lecturer.
 */
export function subscribeToMyStudents(lecturerUid, callback) {
    const q = query(
        collectionGroup(db, 'user_role'), 
        where("role", "==", "student"), // Ensure we only get students
        where("lecturerUid", "==", lecturerUid)
    );
    console.log(`Subscribing to students for lecturer ${lecturerUid}...`);

    return onSnapshot(q, (snapshot) => {
        const students = [];
        console.log(`Found ${snapshot.docs.length} assigned students.`);
        
        try {
            for (const studentDoc of snapshot.docs) {
                if (studentDoc.exists()) {
                    const data = studentDoc.data();
                    if (data.uid) { 
                        students.push(data);
                    }
                }
            }
            callback(students);

        } catch (error) {
            console.error("Error processing assigned students:", error.message);
            callback([]); // Send an empty array on error
        }
    }, (error) => {
        // This will fire if the rules are wrong
        console.error("Error subscribing to assigned students:", error.message);
    });
}


/**
 * Subscribes to a specific student's data (Student View).
 */
export function subscribeToMyStudentData(userId, callback) {
    const roleDocRef = getRoleDocRef(userId);

    return onSnapshot(roleDocRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Error subscribing to student data:", error.message);
    });
}

// --- ADMIN CRUD FUNCTIONS ---

/**
 * Admin updates core user/student information.
 * @param {string} uid User ID
 * @param {object} data Object containing fields 
 */
export async function updateStudentData(uid, data) {
    const roleDocRef = getRoleDocRef(uid);
    try {
        // Build the update payload dynamically
        const updatePayload = {
            name: data.name,
            surname: data.surname,
            phone: data.phone,
        };

        // Conditionally add student-only fields if they exist in the data object
        if (data.studentNumber !== undefined) {
            updatePayload.studentNumber = data.studentNumber;
        }
        if (data.markingScheme !== undefined) {
            // Ensure JSON is valid before parsing
            try {
                updatePayload.markingScheme = JSON.parse(data.markingScheme || '{}');
            } catch (e) {
                console.error("Invalid Marking Scheme JSON:", e.message);
                throw new Error("Marking Scheme is not valid JSON.");
            }
        }
        if (data.marks !== undefined) {
             // Ensure JSON is valid before parsing
             try {
                updatePayload.marks = JSON.parse(data.marks || '{}');
             } catch (e) {
                console.error("Invalid Marks JSON:", e.message);
                throw new Error("Marks data is not valid JSON.");
            }
        }
        // NEW: Add lecturerUid
        if (data.lecturerUid !== undefined) {
            updatePayload.lecturerUid = data.lecturerUid;
        }

        await updateDoc(roleDocRef, updatePayload);
        console.log(`Student data for ${uid} updated.`);
    } catch (error) {
        console.error("Error updating student data:", error);
        throw error;
    }
}

/**
 * Updates the currently logged-in user's profile.
 * @param {string} uid User ID
 * @param {object} data { name, surname, phone }
 */
export async function updateMyProfile(uid, data) {
    const roleDocRef = getRoleDocRef(uid);
    try {
        await updateDoc(roleDocRef, {
            name: data.name,
            surname: data.surname,
            phone: data.phone,
        });
        console.log(`Profile for ${uid} updated.`);
    } catch (error) {
        console.error("Error updating profile:", error);
        throw error;
    }
}


/**
 * Admin deletes a user's Firestore profile.
 * (Note: Does not delete their Auth account).
 */
export async function deleteUser(uid) {
    try {
        // Delete the profile/role document
        const roleDocRef = getRoleDocRef(uid);
        await deleteDoc(roleDocRef);
        
        // We must also delete the parent 'user' doc to clean up
        const userDocRef = doc(db, 'artifacts', appId, 'users', uid);
        await deleteDoc(userDocRef);

        console.log(`User profile deleted for UID: ${uid}`);
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
            lecturerUid: lecturerUid || 'unassigned',
            moduleName,
            preferredTime,
            status: 'pending',
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
    // This query is insecure if rules aren't set up, but for client-side...
    // In a real app, you would filter by lecturerUid here with a query.
    const q = getBookingsPublicCollection(); 

    return onSnapshot(q, (snapshot) => {
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter on the client-side
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

