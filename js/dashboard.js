// --- Module Imports ---
import { setupAuthListener, logoutUser, createStaffUser } from './auth_service.js';
import {
    subscribeToAllUsers,
    updateStudentData,
    deleteUser,
    subscribeToLecturerBookings,
    updateBookingStatus,
    subscribeToMyStudentData,
    updateMyProfile,
    subscribeToMyStudents // NEW: Import the new function
} from './db.js';
import { adminPanelHTML } from './admin_panel.js'; // Import the admin panel HTML

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element Selectors (Global) ---
    const navLinks = document.querySelectorAll('.nav-link[data-role]');
    const roleViews = document.querySelectorAll('.role-view');
    const welcomeText = document.getElementById('welcome-text');
    const logoutButton = document.getElementById('logout-button');

    // Profile Edit Form
    const profileEditForm = document.getElementById('profile-edit-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileSurnameInput = document.getElementById('profile-surname');
    const profilePhoneInput = document.getElementById('profile-phone');
    const profileEmailInput = document.getElementById('profile-email');
    const profileUpdateMessage = document.getElementById('profile-update-message');
    
    // NEW: Lecturer Analytics & Modal
    const lecturerStudentList = document.getElementById('lecturer-student-list'); // Corrected ID
    const studentMarksModal = document.getElementById('student-marks-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalStudentName = document.getElementById('modal-student-name');
    const modalStudentMarksContent = document.getElementById('modal-student-marks-content');
    const lecturerChartAss1 = document.getElementById('lecturer-chart-ass1');
    const lecturerChartExam = document.getElementById('lecturer-chart-exam');
    let ass1ChartInstance = null;
    let examChartInstance = null;


    let currentUserData = null;
    let allUsersUnsubscribe = null;
    let myStudentDataUnsubscribe = null;
    let lecturerBookingsUnsubscribe = null;
    let allStudentsUnsubscribe = null; // NEW: Unsubscriber for lecturer's student list
    let allUsersDataCache = [];
    let allStudentsDataCache = []; // NEW: Cache for lecturer's student data


    // --- Auth Initialization ---
    setupAuthListener(handleAuthStateChange);


    /**
     * Main auth callback. Runs when auth state changes.
     */
    function handleAuthStateChange(userData) {
        if (userData) {
            // User is logged in
            currentUserData = userData;
            if (welcomeText) {
                updateUIForLoggedInUser(userData);
                startRoleSubscriptions(userData);
            }
        } else {
            // User is logged out
            currentUserData = null;
            stopAllSubscriptions(); 
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'login.html' && currentPage !== 'register.html' && currentPage !== 'index.html' && currentPage !== '') {
                window.location.href = 'login.html';
            }
        }
    }

    /**
     * Updates the UI based on the logged-in user and their role.
     */
    function updateUIForLoggedInUser(userData) {
        const role = userData.role || 'student';

        // 1. Set welcome message and fill profile form
        if (welcomeText) {
            welcomeText.textContent = `Welcome, ${userData.name || ''} ${userData.surname || ''}! (${role.charAt(0).toUpperCase() + role.slice(1)})`;
        }
        if (profileNameInput) profileNameInput.value = userData.name || '';
        if (profileSurnameInput) profileSurnameInput.value = userData.surname || '';
        if (profilePhoneInput) profilePhoneInput.value = userData.phone || '';
        if (profileEmailInput) profileEmailInput.value = userData.email || '';
        if (document.getElementById('profile-role')) {
             document.getElementById('profile-role').value = role;
        }


        // 2. Control Navigation Tabs
        navLinks.forEach(link => {
            const requiredRoles = link.dataset.role.split(',');
            const showRole = requiredRoles.includes(role) || requiredRoles.includes('all');
            link.classList.toggle('hidden', !showRole);
        });

        // 3. Control Main Content Sections (Views)
        let viewToShow = `#${role}-view`; // Default to role's view
        const hash = window.location.hash;
        if (hash && document.querySelector(hash)) {
             const targetView = document.querySelector(hash);
             if(targetView) {
                const requiredRoles = targetView.dataset.role.split(',');
                if (requiredRoles.includes(role) || requiredRoles.includes('all')) {
                    viewToShow = hash;
                }
             }
        } else {
             const firstVisibleLink = document.querySelector('.nav-link:not(.hidden)');
             if (firstVisibleLink) {
                  viewToShow = firstVisibleLink.getAttribute('href');
             }
        }
        
        console.log(`Default view for ${role} is ${viewToShow}`);
        showView(viewToShow);

        // 4. Inject Admin Panel HTML if user is admin
        const adminPanelContainer = document.getElementById('admin-panel-container');
        if (role === 'admin' && adminPanelContainer) {
            // Use a more robust check to see if the container is empty
            if (adminPanelContainer.innerHTML.trim().endsWith('...</p>')) { 
                adminPanelContainer.innerHTML = adminPanelHTML;
                // IMPORTANT: Wire up event listeners *after* HTML is injected
                setupAdminPanelListeners();
            }
        }
        
        // --- FIX for Lucide Error ---
        // Call Lucide to render icons *after* the UI is updated
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Hides all views and shows the one specified by the ID.
     */
    function showView(viewId) {
        roleViews.forEach(view => view.classList.add('hidden'));
        const targetView = document.querySelector(viewId);
        if (targetView) {
            targetView.classList.remove('hidden');
        } else {
            const defaultViewId = `#${(currentUserData && currentUserData.role) || 'student'}-view`;
            const defaultView = document.querySelector(defaultViewId);
            if (defaultView) {
                defaultView.classList.remove('hidden');
            }
        }
    }


    // --- Event Listeners ---

    // Handle navigation clicks
    const navMenu = document.querySelector('.nav');
    if (navMenu) {
        navMenu.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && link.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const viewId = link.getAttribute('href');
                showView(viewId);
                window.location.hash = viewId;
                navMenu.classList.remove('show');
                const toggle = document.querySelector('.nav-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }
    
    // Handle logo click (scroll to profile)
    const brandLink = document.querySelector('.brand');
    if (brandLink) {
        brandLink.addEventListener('click', (e) => {
           if (e.currentTarget.getAttribute('href') === '#my-profile') {
                e.preventDefault();
                showView('#my-profile');
                window.location.hash = '#my-profile';
                const profileView = document.querySelector('#my-profile');
                if (profileView) {
                    profileView.scrollIntoView({ behavior: 'smooth' });
                }
           }
        });
    }

    // Logout button
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            logoutUser().catch(error => {
                console.error("Error logging out:", error);
                window.location.href = 'login.html';
            });
        });
    }

    // Profile update form
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!profileUpdateMessage) return; 

            profileUpdateMessage.classList.add('hidden');
            profileUpdateMessage.classList.remove('error');
            profileUpdateMessage.textContent = 'Updating...';
            
            const data = {
                name: profileNameInput.value,
                surname: profileSurnameInput.value,
                phone: profilePhoneInput.value,
            };

            try {
                if (!currentUserData || !currentUserData.uid) {
                    throw new Error("No user data found. Please log in again.");
                }
                await updateMyProfile(currentUserData.uid, data);
                profileUpdateMessage.textContent = 'Profile updated successfully!';
                profileUpdateMessage.classList.remove('hidden');
            } catch (error) {
                profileUpdateMessage.textContent = `Error: ${error.message}`;
                profileUpdateMessage.classList.remove('hidden');
                profileUpdateMessage.classList.add('error');
            }
        });
    }
    
    // NEW: Lecturer Modal Listeners
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            if (studentMarksModal) studentMarksModal.classList.add('hidden');
        });
    }
    if (studentMarksModal) {
        studentMarksModal.addEventListener('click', (e) => {
            // Close if clicking on the background
            if (e.target === studentMarksModal) {
                studentMarksModal.classList.add('hidden');
            }
        });
    }


    // --- Subscription Management ---

    function startRoleSubscriptions(userData) {
        stopAllSubscriptions();
        if (userData.role === 'admin') {
            allUsersUnsubscribe = subscribeToAllUsers(renderAdminUserList);
        } else if (userData.role === 'student') {
            myStudentDataUnsubscribe = subscribeToMyStudentData(userData.uid, renderStudentDashboard);
        } else if (userData.role === 'lecturer') {
            lecturerBookingsUnsubscribe = subscribeToLecturerBookings(userData.uid, renderLecturerBookings);
            // NEW: Subscribe to all student data for analytics
            allStudentsUnsubscribe = subscribeToMyStudents(userData.uid, renderLecturerAnalytics); // Corrected function call
        }
    }

    function stopAllSubscriptions() {
        if (allUsersUnsubscribe) allUsersUnsubscribe();
        if (myStudentDataUnsubscribe) myStudentDataUnsubscribe();
        if (lecturerBookingsUnsubscribe) lecturerBookingsUnsubscribe();
        if (allStudentsUnsubscribe) allStudentsUnsubscribe(); // NEW
    }


    // --- Admin Panel Functions ---

    /**
     * Wires up all event listeners for the Admin Panel using event delegation.
     */
    function setupAdminPanelListeners() {
        const staffForm = document.getElementById('staff-creation-form');
        const studentUpdateForm = document.getElementById('student-update-form');
        const adminPanelContainer = document.getElementById('admin-panel-container');

        // Admin: Staff Creation Form Submission
        if (staffForm) {
            staffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('staff-email').value;
                const password = document.getElementById('staff-password').value;
                const role = document.getElementById('staff-role').value;
                const messageEl = document.getElementById('staff-creation-message');
                
                if (!messageEl) return;

                messageEl.textContent = 'Processing...';
                messageEl.classList.remove('hidden', 'error');

                try {
                    await createStaffUser(email, password, role);
                    messageEl.textContent = `Success: New ${role} account created for ${email}.`;
                    staffForm.reset();
                } catch (error) {
                    console.error("Staff creation error:", error);
                    messageEl.textContent = `Error creating staff user: ${error.message}`;
                    messageEl.classList.add('error');
                }
            });
        }

        // Admin: Student Data Update Form Submission
        if (studentUpdateForm) {
            studentUpdateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const studentUpdateId = document.getElementById('student-update-id');
                const studentUpdateMessage = document.getElementById('student-update-message');
                if (!studentUpdateId || !studentUpdateMessage) return;

                const uid = studentUpdateId.textContent;
                if (!uid || uid === 'N/A') {
                    studentUpdateMessage.textContent = 'Error: Select a user to update first.';
                    studentUpdateMessage.classList.add('error');
                    return;
                }

                // Base data for all users
                const data = {
                    name: document.getElementById('student-update-name').value,
                    surname: document.getElementById('student-update-surname').value,
                    phone: document.getElementById('student-update-phone').value,
                };

                // Check if student-only fields are visible and add them
                const studentFields = document.querySelector('.student-only-fields');
                if (studentFields && !studentFields.classList.contains('hidden')) {
                    data.studentNumber = document.getElementById('student-update-number').value;
                    data.markingScheme = document.getElementById('student-update-scheme').value;
                    data.marks = document.getElementById('student-update-marks').value;
                    data.lecturerUid = document.getElementById('student-update-lecturer').value; // NEW: Save lecturerUid
                }
                
                studentUpdateMessage.textContent = 'Updating...';
                studentUpdateMessage.classList.remove('hidden', 'error');

                try {
                    await updateStudentData(uid, data);
                    studentUpdateMessage.textContent = `Success: User ${uid.slice(0, 8)} data updated.`;
                } catch (error) {
                    studentUpdateMessage.textContent = `Error updating data: ${error.message}`;
                    studentUpdateMessage.classList.add('error');
                }
            });
        }

        // --- Event Delegation for Admin Panel ---
        if (adminPanelContainer) {
            adminPanelContainer.addEventListener('click', async (e) => {
                
                // Handle "Edit User" button clicks
                const editButton = e.target.closest('.edit-user-btn');
                if (editButton) {
                    handleEditUserClick(editButton.dataset.uid);
                }

                // Handle "Delete User" button clicks
                if (e.target.id === 'user-delete-btn') { // Corrected ID from user's file
                    await handleDeleteUserClick();
                }
            });
        }
    }

    /**
     * Handles the logic for clicking the "Edit User" button.
     */
    function handleEditUserClick(uid) {
        if (!uid) return;
        const user = allUsersDataCache.find(u => u.uid === uid);
        if (!user) return;

        // --- Selectors for form fields ---
        const updateIdEl = document.getElementById('student-update-id');
        const updateNameEl = document.getElementById('student-update-name');
        const updateSurnameEl = document.getElementById('student-update-surname');
        const updatePhoneEl = document.getElementById('student-update-phone');
        const studentOnlyFields = document.querySelector('.student-only-fields');
        const lecturerSelectEl = document.getElementById('student-update-lecturer'); // NEW
        
        if (!updateIdEl || !updateNameEl || !updateSurnameEl || !updatePhoneEl || !studentOnlyFields || !lecturerSelectEl) {
            console.error("Could not find all user update form fields.");
            return;
        }

        // Populate the update form fields
        updateIdEl.textContent = uid;
        updateNameEl.value = user.name || '';
        updateSurnameEl.value = user.surname || '';
        updatePhoneEl.value = user.phone || '';

        // NEW: Populate lecturer dropdown
        // 1. Clear old options
        lecturerSelectEl.innerHTML = '<option value="">-- No Lecturer --</option>';
        // 2. Filter for lecturers from the cache
        const lecturers = allUsersDataCache.filter(u => u.role === 'lecturer');
        // 3. Add new options
        lecturers.forEach(lecturer => {
            const option = document.createElement('option');
            option.value = lecturer.uid;
            option.textContent = `${lecturer.name} ${lecturer.surname} (${lecturer.email})`;
            lecturerSelectEl.appendChild(option);
        });
        
        // Show/hide student-specific fields based on role
        if (user.role === 'student') {
            studentOnlyFields.classList.remove('hidden');
            // Populate student fields
            document.getElementById('student-update-number').value = user.studentNumber || '';
            // NEW: Set selected lecturer
            lecturerSelectEl.value = user.lecturerUid || '';
            
            const schemeString = user.markingScheme ? JSON.stringify(user.markingScheme, null, 2) : '{"iceTasks": 0.1, "assignment1": 0.25, "assignment2": 0.3, "exam": 0.35}';
            document.getElementById('student-update-scheme').value = schemeString;
            const marksString = user.marks ? JSON.stringify(user.marks, null, 2) : '{}';
            document.getElementById('student-update-marks').value = marksString;
        } else {
            studentOnlyFields.classList.add('hidden');
        }

        // Scroll to the update form
        const userCrudEl = document.getElementById('student-crud'); 
        if (userCrudEl) {
            userCrudEl.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Handles the logic for clicking the "Delete User" button.
     */
    async function handleDeleteUserClick() {
        const studentUpdateId = document.getElementById('student-update-id');
        const studentUpdateMessage = document.getElementById('student-update-message');
        const studentUpdateForm = document.getElementById('student-update-form');

        if (!studentUpdateId || !studentUpdateMessage) return;

        const uid = studentUpdateId.textContent;
        if (!uid || uid === 'N/A') {
            studentUpdateMessage.textContent = 'Please select a user to delete.';
            studentUpdateMessage.classList.add('error');
            return;
        }

        studentUpdateMessage.textContent = `Are you sure you want to delete user ${uid}? This cannot be undone. Click 'Delete' again to confirm.`;
        studentUpdateMessage.classList.add('error'); 
        
        if (studentUpdateMessage.dataset.confirmDelete === uid) {
            try {
                await deleteUser(uid);
                studentUpdateMessage.textContent = `Success: User profile ${uid.slice(0, 8)} deleted.`;
                studentUpdateMessage.classList.remove('error');
                if (studentUpdateForm) studentUpdateForm.reset();
                studentUpdateId.textContent = 'N/A';
                delete studentUpdateMessage.dataset.confirmDelete;
            } catch (error) {
                studentUpdateMessage.textContent = `Error deleting user: ${error.message}`;
                studentUpdateMessage.classList.add('error');
            }
        } else {
            studentUpdateMessage.dataset.confirmDelete = uid;
        }
    }


    /**
     * Renders the list of all users/students in the Admin panel.
     */
    function renderAdminUserList(users) {
        allUsersDataCache = users; // Cache the full list
        const adminUserList = document.getElementById('admin-user-list');
        if (!adminUserList) return; 

        const otherUsers = (currentUserData) ? users.filter(u => u.uid !== currentUserData.uid) : users;

        adminUserList.innerHTML = '';
        if (otherUsers.length === 0) {
            adminUserList.innerHTML = '<p class="muted">No other users found in the database.</p>';
            return;
        }

        otherUsers.sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));

        otherUsers.forEach(user => {
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
                    ${user.role === 'student' ? `<p>Student No: <strong>${user.studentNumber || 'N/A'}</strong></p>` : ''}
                    <p>Phone: ${user.phone || 'N/A'}</p>
                </div>
                <button class="btn outline small edit-user-btn" data-uid="${user.uid}">Edit User Data</button>
            `;
            adminUserList.appendChild(el);
        });
    }

    
    // --- Student Dashboard Functions ---

    /**
     * Renders the student's marks in a table.
     * @param {object} userData - The student's user data document.
     * @param {string} targetElementId - The ID of the element to render the table into.
     */
    function renderStudentDashboard(userData, targetElementId = 'student-module-list') {
        const targetElement = document.getElementById(targetElementId);
        if (!targetElement) {
             console.error(`Target element '${targetElementId}' not found for rendering marks.`);
             return;
        }

        targetElement.innerHTML = ''; 
        
        if (!userData) {
            targetElement.innerHTML = '<p class="muted">Loading student data...</p>';
            return;
        }

        // NEW: Also render the chart for the student
        const chartContainerId = 'marks-chart-container';
        const chartContainer = document.getElementById(chartContainerId);
        
        if (!userData.markingScheme) {
            targetElement.innerHTML = '<p class="muted">No module data or marking scheme found. Please contact your admin for enrollment and setup.</p>';
            if(chartContainer) chartContainer.innerHTML = ''; // Clear chart area too
            return;
        }

        const scheme = userData.markingScheme;
        const marks = userData.marks || {};
        
        let html = `
            <div class="card bg-gray-50 p-6 border-l-4 border-cyan-400">
                <h3 class="text-xl font-bold mb-3">Student Performance</h3>
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
        
        const chartLabels = [];
        const chartData = [];

        for (const item in scheme) {
            const weight = parseFloat(scheme[item]) || 0;
            const grade = parseFloat(marks[item]) || 0;
            
            finalMark += grade * weight;
            totalWeight += weight;
            
            chartLabels.push(item.charAt(0).toUpperCase() + item.slice(1));
            chartData.push(grade);

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
                <p class="text-sm muted mt-3">Final Grade is the sum of (Your Grade * Weight).</p>
            </div>
        `;
        
        targetElement.innerHTML = html;
        
        // --- NEW: Render Student's Personal Chart ---
        if (chartContainer && targetElementId === 'student-module-list') { // Only render chart on main student view
            const ctx = chartContainer.getContext('2d');
            
            // Destroy old chart if it exists
            if (window.myStudentChart) {
                window.myStudentChart.destroy();
            }

            window.myStudentChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Your Grade (%)',
                        data: chartData,
                        backgroundColor: '#06b6d4',
                        borderColor: '#0891b2',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Your Marks per Assessment'
                        }
                    }
                }
            });
        }
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

        // Add listeners to the booking list using event delegation
        bookingsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('accept-btn')) {
                handleBookingAction(e.target.dataset.id, 'accepted');
            }
            if (e.target.classList.contains('reject-btn')) {
                handleBookingAction(e.target.dataset.id, 'rejected');
            }
        });
    }

    async function handleBookingAction(bookingId, status) {
        try {
            await updateBookingStatus(bookingId, status);
            console.log(`Booking ${bookingId} updated to ${status}.`);
        } catch (error) {
            console.error(`Failed to update booking to ${status}:`, error);
        }
    }
    
    // --- NEW: Lecturer Analytics Functions ---
    
    /**
     * Renders the lecturer's student list and analytics graphs.
     * @param {Array} students - An array of student user objects.
     */
    function renderLecturerAnalytics(students) {
        allStudentsDataCache = students; // Cache for the modal
        
        // --- 1. Render Student List ---
        if (!lecturerStudentList) {
            console.error("Lecturer student list container not found.");
            return;
        }
        lecturerStudentList.innerHTML = ''; // Clear loading text
        
        if (students.length === 0) {
            lecturerStudentList.innerHTML = '<p class="muted text-center">No students are currently assigned to you.</p>';
        } else {
            students.sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
            students.forEach(student => {
                const el = document.createElement('div');
                el.className = 'admin-card student-list-item'; // Use admin-card style
                el.dataset.uid = student.uid; // Store UID for click
                el.style.cursor = 'pointer'; // Add pointer cursor
                el.innerHTML = `
                    <strong>${student.name || ''} ${student.surname || ''}</strong>
                    <p>${student.studentNumber || student.email}</p>
                `;
                lecturerStudentList.appendChild(el);
            });
            
            // Add one event listener to the list container
            lecturerStudentList.addEventListener('click', (e) => {
                const item = e.target.closest('.student-list-item');
                if (item) {
                    showStudentMarksModal(item.dataset.uid);
                }
            });
        }
        
        // --- 2. Render Analytics Charts ---
        if (!lecturerChartAss1 || !lecturerChartExam) {
            console.warn("Chart canvas elements not found. Skipping chart render.");
            return;
        }
        
        // Helper function to categorize marks
        const categorize = (mark) => {
            if (mark >= 75) return 'Distinction';
            if (mark >= 50) return 'Pass';
            if (mark > 0) return 'Fail';
            return 'No Mark';
        };
        
        // Process data for charts
        const ass1Data = { 'Distinction': 0, 'Pass': 0, 'Fail': 0, 'No Mark': 0 };
        const examData = { 'Distinction': 0, 'Pass': 0, 'Fail': 0, 'No Mark': 0 };

        students.forEach(student => {
            const ass1Mark = student.marks ? (student.marks.assignment1 || 0) : 0;
            const examMark = student.marks ? (student.marks.exam || 0) : 0;
            
            ass1Data[categorize(ass1Mark)]++;
            examData[categorize(examMark)]++;
        });
        
        // Render Assignment 1 Chart (Doughnut)
        if (ass1ChartInstance) ass1ChartInstance.destroy(); // Clear old chart
        const ass1Ctx = lecturerChartAss1.getContext('2d');
        if (ass1Ctx) {
            ass1ChartInstance = new Chart(ass1Ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Distinction (75+)', 'Pass (50-74)', 'Fail (1-49)', 'No Mark'],
                    datasets: [{
                        label: 'Assignment 1',
                        data: [ass1Data['Distinction'], ass1Data['Pass'], ass1Data['Fail'], ass1Data['No Mark']],
                        backgroundColor: ['#06b6d4', '#22d3ee', '#f87171', '#e5e7eb'],
                        hoverOffset: 4
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Assignment 1 Distribution' }
                    }
                }
            });
        }

        // Render Exam Chart (Bar)
        if (examChartInstance) examChartInstance.destroy(); // Clear old chart
        const examCtx = lecturerChartExam.getContext('2d');
        if (examCtx) {
            examChartInstance = new Chart(examCtx, {
                type: 'bar',
                data: {
                    labels: ['Distinction (75+)', 'Pass (50-74)', 'Fail (1-49)', 'No Mark'],
                    datasets: [{
                        label: '# of Students',
                        data: [examData['Distinction'], examData['Pass'], examData['Fail'], examData['No Mark']],
                        backgroundColor: ['#06b6d4', '#22d3ee', '#f87171', '#e5e7eb']
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        title: { display: true, text: 'Exam Distribution' }
                    },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }
    }

    /**
     * Finds a student in the cache and shows their marks in the modal.
     */
    function showStudentMarksModal(uid) {
        const student = allStudentsDataCache.find(s => s.uid === uid);
        if (!student) {
            console.error("Could not find student in cache for modal.");
            return;
        }

        if (modalStudentName) modalStudentName.textContent = `${student.name} ${student.surname}'s Marks`;
        
        // Re-use the same dashboard rendering function!
        // We pass the modal's content ID as the target.
        renderStudentDashboard(student, 'modal-student-marks-content');
        
        if (studentMarksModal) studentMarksModal.classList.remove('hidden');
    }


    // --- Global Utility / Aesthetic Setup ---
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
    
    // Note: lucide.createIcons() is now called inside updateUIForLoggedInUser
    // to prevent the race condition.
});

