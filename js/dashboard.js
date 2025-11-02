// --- Module Imports ---
import { setupAuthListener, logoutUser, createStaffUser } from './auth_service.js';
import { 
    subscribeToAllUsers, 
    updateStudentData, 
    deleteUser, 
    addBooking, 
    subscribeToLecturerBookings, 
    updateBookingStatus,
    subscribeToMyStudentData,
    updateMyProfile // Import the new profile update function
} from './db.js';
import { adminPanelHTML } from './admin_panel.js'; // Import the admin panel HTML

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element Selectors (Global) ---
    const navLinks = document.querySelectorAll('.nav-link[data-role]');
    const roleViews = document.querySelectorAll('.role-view');
    const welcomeText = document.getElementById('welcome-text');
    const logoutButton = document.getElementById('logout-button');
    const adminPanelContainer = document.getElementById('admin-panel-container');

    // NEW: Profile Form Selectors
    const profileForm = document.getElementById('profile-update-form');
    const profileMessage = document.getElementById('profile-update-message');
    const profileEmail = document.getElementById('profile-email');
    const profileRole = document.getElementById('profile-role');
    const profileName = document.getElementById('profile-name');
    const profileSurname = document.getElementById('profile-surname');
    const profilePhone = document.getElementById('profile-phone');

    let currentUserData = null; 
    let allUsersUnsubscribe = null;
    let myStudentDataUnsubscribe = null;
    let lecturerBookingsUnsubscribe = null;

    // --- Core UI Functions ---

    /**
     * Updates the UI based on the logged-in user and their role.
     */
    function updateUI(userData) {
        currentUserData = userData;
        
        if (userData) {
            const role = userData.role;
            
            // 1. Set welcome message
            welcomeText.textContent = `Welcome, ${userData.name || ''} ${userData.surname || ''}! (${role.charAt(0).toUpperCase() + role.slice(1)})`;

            // 2. Control Navigation Tabs
            navLinks.forEach(link => {
                const requiredRoles = link.dataset.role.split(',');
                link.classList.toggle('hidden', !requiredRoles.includes(role));
            });

            // 3. Control Main Content Sections
            roleViews.forEach(view => {
                const requiredRoles = view.dataset.role.split(',');
                view.classList.toggle('hidden', !requiredRoles.includes(role));
            });

            // 4. NEW: Populate the "My Profile" form
            renderMyProfile(userData);

            // 5. Inject Admin Panel HTML if user is admin
            if (role === 'admin' && adminPanelContainer) {
                adminPanelContainer.innerHTML = adminPanelHTML;
                setupAdminPanelListeners(); // Wire up listeners *after* HTML is injected
            }

            // 6. Start role-specific data subscriptions
            startRoleSubscriptions(userData);
            
            // 7. Show the default view for the role
            let defaultViewId = '#my-profile'; // Default to profile
            if (role === 'student') defaultViewId = '#student-view';
            if (role === 'lecturer') defaultViewId = '#lecturer-view';
            if (role === 'admin') defaultViewId = '#admin-view';
            
            console.log(`Default view for ${role} is ${defaultViewId}`);
            // Use location.hash to navigate to the default view
            if (window.location.hash !== defaultViewId) {
                window.location.hash = defaultViewId;
            }

        } else {
            // Not logged in
            stopAllSubscriptions();
            // Redirect to login page
            window.location.href = 'login.html';
        }
    }

    // --- Subscription Management ---

    function startRoleSubscriptions(userData) {
        stopAllSubscriptions();

        if (userData.role === 'admin') {
            allUsersUnsubscribe = subscribeToAllUsers((users) => {
                renderAdminUserList(users, userData.uid); // Pass current admin's UID
            });
        } else if (userData.role === 'student') {
            myStudentDataUnsubscribe = subscribeToMyStudentData(userData.uid, renderStudentDashboard);
        } else if (userData.role === 'lecturer') {
            lecturerBookingsUnsubscribe = subscribeToLecturerBookings(userData.uid, renderLecturerBookings);
        }
    }

    function stopAllSubscriptions() {
        if (allUsersUnsubscribe) allUsersUnsubscribe();
        if (myStudentDataUnsubscribe) myStudentDataUnsubscribe();
        if (lecturerBookingsUnsubscribe) lecturerBookingsUnsubscribe();
    }


    // --- Authentication & Listeners ---

    // Initial listener setup
    setupAuthListener(updateUI); 
    
    // Logout Button
    logoutButton.addEventListener('click', () => {
        logoutUser().catch(error => console.error("Logout failed:", error));
    });

    // NEW: Profile Form Submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUserData) return;

        const data = {
            name: profileName.value,
            surname: profileSurname.value,
            phone: profilePhone.value,
        };

        profileMessage.textContent = 'Updating...';
        profileMessage.classList.remove('hidden', 'error');

        try {
            await updateMyProfile(currentUserData.uid, data);
            profileMessage.textContent = 'Profile successfully updated!';
            profileMessage.classList.remove('error');
        } catch (error) {
            profileMessage.textContent = `Error updating profile: ${error.message}`;
            profileMessage.classList.add('error');
        }
    });

    // --- Admin Panel Functions ---

    /**
     * Wires up all event listeners for the Admin Panel.
     */
    function setupAdminPanelListeners() {
        const staffForm = document.getElementById('staff-creation-form');
        const studentUpdateForm = document.getElementById('student-update-form');
        const studentDeleteBtn = document.getElementById('student-delete-btn');

        if (staffForm) {
            staffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('staff-email').value;
                const password = document.getElementById('staff-password').value;
                const role = document.getElementById('staff-role').value;
                const messageEl = document.getElementById('staff-creation-message');
                
                messageEl.textContent = 'Processing...';
                messageEl.classList.remove('hidden', 'error');

                try {
                    await createStaffUser(email, password, role);
                    messageEl.textContent = `Success: New ${role} account created for ${email}.`;
                    messageEl.classList.remove('error');
                    staffForm.reset();
                } catch (error) {
                    messageEl.textContent = `Error creating staff user: ${error.message}`;
                    messageEl.classList.add('error');
                }
            });
        }

        if (studentUpdateForm) {
            studentUpdateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const studentUpdateId = document.getElementById('student-update-id');
                const studentUpdateMessage = document.getElementById('student-update-message');
                const uid = studentUpdateId.textContent;
                
                if (!uid || uid === 'N/A') {
                    studentUpdateMessage.textContent = 'Error: Select a user to update first.';
                    studentUpdateMessage.classList.add('error');
                    return;
                }

                const data = {
                    name: document.getElementById('student-update-name').value,
                    surname: document.getElementById('student-update-surname').value,
                    phone: document.getElementById('student-update-phone').value,
                };

                // Only add student-specific fields if they are visible
                if (document.getElementById('student-update-number').offsetParent !== null) {
                    data.studentNumber = document.getElementById('student-update-number').value;
                    data.markingScheme = document.getElementById('student-update-scheme').value;
                    data.marks = document.getElementById('student-update-marks').value;
                }

                studentUpdateMessage.textContent = 'Updating...';
                studentUpdateMessage.classList.remove('hidden', 'error');

                try {
                    await updateStudentData(uid, data);
                    studentUpdateMessage.textContent = `Success: User ${uid.slice(0, 8)} data updated.`;
                    studentUpdateMessage.classList.remove('error');
                } catch (error) {
                    studentUpdateMessage.textContent = `Error updating data: ${error.message}`;
                    studentUpdateMessage.classList.add('error');
                }
            });
        }

        if (studentDeleteBtn) {
            studentDeleteBtn.addEventListener('click', async () => {
                const studentUpdateId = document.getElementById('student-update-id');
                const studentUpdateMessage = document.getElementById('student-update-message');
                const uid = studentUpdateId.textContent;

                if (!uid || uid === 'N/A') {
                    studentUpdateMessage.textContent = 'Please select a user to delete.';
                    studentUpdateMessage.classList.add('error');
                    return;
                }

                // Custom confirmation
                studentUpdateMessage.textContent = `Are you sure you want to delete user ${uid}? This cannot be undone. Click 'Delete' again to confirm.`;
                studentUpdateMessage.classList.add('error');
                
                if (studentUpdateMessage.dataset.confirmDelete === uid) {
                    try {
                        await deleteUser(uid);
                        studentUpdateMessage.textContent = `Success: User profile ${uid.slice(0, 8)} deleted.`;
                        studentUpdateMessage.classList.remove('error');
                        document.getElementById('student-update-form').reset();
                        studentUpdateId.textContent = 'N/A';
                        delete studentUpdateMessage.dataset.confirmDelete;
                    } catch (error) {
                        studentUpdateMessage.textContent = `Error deleting user: ${error.message}`;
                        studentUpdateMessage.classList.add('error');
                    }
                } else {
                    studentUpdateMessage.dataset.confirmDelete = uid;
                }
            });
        }
    }


    /**
     * Renders the list of all users/students in the Admin panel.
     * Filters out the currently logged-in admin.
     */
    function renderAdminUserList(users, adminUid) {
        const adminUserList = document.getElementById('admin-user-list');
        if (!adminUserList) return;

        // Filter out the current admin
        const filteredUsers = users.filter(user => user.uid !== adminUid);

        adminUserList.innerHTML = '';
        if (filteredUsers.length === 0) {
            adminUserList.innerHTML = '<p class="muted">No other users found in the database.</p>';
            return;
        }

        filteredUsers.sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));

        filteredUsers.forEach(user => {
            const el = document.createElement('div');
            el.className = 'admin-card';
            const roleColor = user.role === 'admin' ? 'red-600' : user.role === 'lecturer' ? 'teal-600' : 'blue-600';
            
            el.innerHTML = `
                <div class="header">
                    <span class="role-tag bg-${roleColor}">${user.role.toUpperCase()}</span>
                    <strong>${user.name || 'N/A'} ${user.surname || 'N/A'}</strong>
                </div>
                <div class="details">
                    <p>Email: <span class="small">${user.email}</span></p>
                    <p>UID: <span class="small">${user.uid}</span></p>
                    ${user.studentNumber ? `<p>Student No: <strong>${user.studentNumber}</strong></p>` : ''}
                    <p>Phone: ${user.phone || 'N/A'}</p>
                </div>
                <button class="btn outline small edit-user-btn" data-uid="${user.uid}">Edit User Data</button>
            `;
            adminUserList.appendChild(el);
        });

        // Add event listeners for the new edit buttons
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.dataset.uid;
                const user = filteredUsers.find(u => u.uid === uid);
                
                if (!user) return;
                
                // Populate the update form fields
                document.getElementById('student-update-id').textContent = uid;
                document.getElementById('student-update-name').value = user.name || '';
                document.getElementById('student-update-surname').value = user.surname || '';
                document.getElementById('student-update-phone').value = user.phone || '';

                // Show/hide student-only fields based on role
                const studentFields = document.querySelectorAll('.student-only-field');
                const showStudentFields = user.role === 'student';
                
                studentFields.forEach(field => {
                    field.classList.toggle('hidden', !showStudentFields);
                });

                // Populate student fields if they are a student
                if (showStudentFields) {
                    document.getElementById('student-update-number').value = user.studentNumber || '';
                    const schemeString = user.markingScheme ? JSON.stringify(user.markingScheme, null, 2) : '{"assignment1": 0.4, "exam": 0.6}';
                    document.getElementById('student-update-scheme').value = schemeString;
                    const marksString = user.marks ? JSON.stringify(user.marks, null, 2) : '{}';
                    document.getElementById('student-update-marks').value = marksString;
                }

                // Scroll to the update form
                document.getElementById('student-crud').scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    
    // --- Student Dashboard Functions ---

    /**
     * NEW: Populates the "My Profile" form for the current user.
     */
    function renderMyProfile(userData) {
        if (!profileForm) return; // Exit if form isn't on the page
        profileEmail.value = userData.email || '';
        profileRole.value = userData.role || '';
        profileName.value = userData.name || '';
        profileSurname.value = userData.surname || '';
        profilePhone.value = userData.phone || '';
    }

    /**
     * Renders the student's marks in a table.
     */
    function renderStudentDashboard(userData) {
        const studentModuleList = document.getElementById('student-module-list');
        if (!studentModuleList) return;
        studentModuleList.innerHTML = '';
        
        if (!userData || !userData.markingScheme) {
            studentModuleList.innerHTML = '<p class="muted">No module data or marking scheme found. Please contact your admin for enrollment and setup.</p>';
            return;
        }

        const scheme = userData.markingScheme;
        const marks = userData.marks || {};
        
        let html = `
            <div class="card bg-gray-50 p-6 border-l-4 border-cyan-400">
                <h3 class="text-xl font-bold mb-3">Your Performance</h3>
                <p><strong>Student Number:</strong> ${userData.studentNumber || 'N/A'}</p>
                <div class="overflow-x-auto">
                    <table class="marks-table">
                        <thead>
                            <tr>
                                <th>Assessment</th>
                                <th>Grade</th>
                                <th>Weight</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        let finalMark = 0;
        let totalWeight = 0;

        for (const item in scheme) {
            const weight = parseFloat(scheme[item]) || 0;
            const grade = parseFloat(marks[item]) || 0;
            
            finalMark += grade * weight;
            totalWeight += weight;

            html += `
                <tr>
                    <td>${item.charAt(0).toUpperCase() + item.slice(1)}</td>
                    <td>${grade} / 100</td>
                    <td>${(weight * 100).toFixed(0)}%</td>
                </tr>
            `;
        }
        
        html += `
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><strong>Final Grade</strong></td>
                                <td><strong>${finalMark.toFixed(1)}%</strong></td>
                                <td><strong>${(totalWeight * 100).toFixed(0)}%</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p class="text-sm muted mt-3">Your Final Grade is the sum of (Your Grade * Weight).</p>
            </div>
        `;
        
        studentModuleList.innerHTML = html;
    }

    // --- Lecturer Booking Functions ---
    function renderLecturerBookings(bookings) {
        const bookingsList = document.getElementById('lecturer-bookings-list');
        if (!bookingsList) return;
        bookingsList.innerHTML = '';

        if (bookings.length === 0) {
            bookingsList.innerHTML = '<p class="muted">No pending or accepted bookings.</p>';
            return;
        }

        bookings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        bookings.forEach(booking => {
            const statusColor = booking.status === 'accepted' ? 'green' : booking.status === 'pending' ? 'yellow' : 'red';
            const el = document.createElement('div');
            el.className = 'admin-card border-l-4 border-' + statusColor + '-400';
            el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <span class="role-tag bg-${statusColor}-500">${booking.status.toUpperCase()}</span>
                    <strong class="text-lg">${booking.moduleName}</strong>
                </div>
                <p>Student UID: <span class="small">${booking.studentUid.slice(0, 8)}</span></p>
                <p>Preferred Time: <strong>${booking.preferredTime}</strong></p>
                <p class="text-sm text-gray-500">Booked: ${new Date(booking.createdAt).toLocaleString()}</p>
                ${booking.status === 'pending' ? `
                    <div class="flex gap-2 mt-3">
                        <button class="btn primary small accept-btn" data-id="${booking.id}">Accept</button>
                        <button class="btn outline small reject-btn" data-id="${booking.id}">Reject</button>
                    </div>
                ` : ''}
            `;
            bookingsList.appendChild(el);
        });

        document.querySelectorAll('.accept-btn').forEach(btn => btn.addEventListener('click', (e) => handleBookingAction(e.target.dataset.id, 'accepted')));
        document.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', (e) => handleBookingAction(e.target.dataset.id, 'rejected')));
    }

    async function handleBookingAction(bookingId, status) {
        try {
            await updateBookingStatus(bookingId, status);
            console.log(`Booking ${bookingId} updated to ${status}.`);
        } catch (error) {
            console.error(`Failed to update booking to ${status}:`, error);
        }
    }


    // --- Global Utility / Aesthetic Setup ---
    if (window.lucide) lucide.createIcons();

    // Mobile nav toggle
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            nav.classList.toggle('show');
        });
    }

    // Handle hash change for navigation
    function onHashChange() {
        const hash = window.location.hash || '#my-profile'; // Default to profile
        if (!currentUserData) return;

        let targetView = document.querySelector(hash);
        
        // Default to a role-appropriate view if hash is invalid
        if (!targetView || targetView.classList.contains('role-view.hidden')) {
            const role = currentUserData.role;
            if (role === 'student') targetView = document.querySelector('#student-view');
            if (role === 'lecturer') targetView = document.querySelector('#lecturer-view');
            if (role === 'admin') targetView = document.querySelector('#admin-view');
            if (!targetView) targetView = document.querySelector('#my-profile');
        }

        // Scroll to the target view
        if (targetView) {
            const headerH = document.querySelector('.navbar').offsetHeight;
            const top = targetView.getBoundingClientRect().top + window.scrollY - headerH - 20; // 20px offset
            window.scrollTo({ top, behavior: 'smooth' });
        }
    }

    window.addEventListener('hashchange', onHashChange);
});

