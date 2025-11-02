// --- Module Imports ---
import { setupAuthListener, loginUser, registerUser, logoutUser, createStaffUser } from '../js/auth_service.js';
import { 
    subscribeToAllUsers, 
    updateStudentData, 
    deleteUser, 
    addBooking, 
    subscribeToLecturerBookings, 
    updateBookingStatus,
    subscribeToMyStudentData
} from '../js/db.js';
import { adminPanelHTML } from '../js/admin_panel.js'; // Import the admin panel HTML

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element Selectors (Global) ---
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const toggleRegisterBtn = document.getElementById('toggle-register');
    const authError = document.getElementById('auth-error');
    const authButton = document.getElementById('auth-button');
    const navLinks = document.querySelectorAll('.nav-link[data-role]');
    const roleViews = document.querySelectorAll('.role-view');
    const welcomeText = document.getElementById('welcome-text');
    const authTitle = document.querySelector('#auth-modal h2');
    const nameInput = document.getElementById('auth-name');
    const surnameInput = document.getElementById('auth-surname');
    const phoneInput = document.getElementById('auth-phone');
    const confirmPasswordInput = document.getElementById('auth-confirm-password');
    const adminPanelContainer = document.getElementById('admin-panel-container');

    let isRegisterMode = false;
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
        const loggedIn = !!userData;
        const role = loggedIn ? userData.role : null;
        
        // 1. Update Auth Button & Modal Visibility
        if (loggedIn) {
            authButton.textContent = 'Log Out';
            authButton.classList.remove('outline');
            authButton.classList.add('primary');
            // Hide public sections when logged in
            document.querySelectorAll('main > section[data-role="public"]').forEach(sec => sec.classList.add('hidden'));
            
            // Set welcome message
            welcomeText.textContent = `Welcome, ${userData.name || ''} ${userData.surname || ''}! (${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)})`;

            // Inject Admin Panel HTML if user is admin
            if (role === 'admin' && adminPanelContainer) {
                adminPanelContainer.innerHTML = adminPanelHTML;
                // IMPORTANT: Wire up event listeners *after* HTML is injected
                setupAdminPanelListeners(); 
            }

            // Start role-specific data subscriptions
            startRoleSubscriptions(userData);
        } else {
            authButton.textContent = 'Log In / Register';
            authButton.classList.remove('primary');
            authButton.classList.add('outline');
            // Show public sections and hide role-based views
            document.querySelectorAll('main > section[data-role="public"]').forEach(sec => sec.classList.remove('hidden'));
            
            // Stop data subscriptions
            stopAllSubscriptions();

            // Default to Home view
            document.querySelector('#home').scrollIntoView({ behavior: 'smooth' });
        }

        // 2. Control Navigation Tabs
        navLinks.forEach(link => {
            const requiredRoles = link.dataset.role.split(',');
            // Show if:
            // 1. Role is 'public' and user is logged out
            // 2. User is logged in AND their role is in the list
            const showPublic = requiredRoles.includes('public') && !loggedIn;
            const showRole = loggedIn && requiredRoles.includes(role);
            
            link.classList.toggle('hidden', !showPublic && !showRole);
        });

        // 3. Control Main Content Sections
        roleViews.forEach(view => {
            const requiredRoles = view.dataset.role.split(',');
            const shouldShow = loggedIn && requiredRoles.includes(role);
            view.classList.toggle('hidden', !shouldShow);
        });
    }

    // --- Subscription Management ---

    function startRoleSubscriptions(userData) {
        // Stop any existing subscriptions first
        stopAllSubscriptions();

        if (userData.role === 'admin') {
            allUsersUnsubscribe = subscribeToAllUsers(renderAdminUserList);
        } else if (userData.role === 'student') {
            // FIXED: Switched to the correct single-doc listener
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


    // --- Authentication & Modal Logic ---

    // Initial listener setup
    setupAuthListener(updateUI); 
    
    // Toggle between Login and Register forms
    function toggleAuthMode(register = null) {
        isRegisterMode = register === null ? !isRegisterMode : register;
        authTitle.textContent = isRegisterMode ? 'Register New Student Account' : 'Log In to Portal';
        toggleRegisterBtn.textContent = isRegisterMode ? 'Already have an account? Log In' : 'Need an account? Register New Student';
        
        // Show/hide specific fields
        nameInput.parentElement.classList.toggle('hidden', !isRegisterMode);
        surnameInput.parentElement.classList.toggle('hidden', !isRegisterMode);
        phoneInput.parentElement.classList.toggle('hidden', !isRegisterMode);
        confirmPasswordInput.parentElement.classList.toggle('hidden', !isRegisterMode);
    }
    toggleAuthMode(false); // Default to login mode

    authButton.addEventListener('click', () => {
        if (currentUserData) {
            // If logged in, click logs out
            logoutUser();
        } else {
            // If logged out, show the modal
            authModal.classList.remove('hidden');
        }
    });

    toggleRegisterBtn.addEventListener('click', () => toggleAuthMode());

    // Close modal when clicking outside
    authModal.querySelector('.modal-content').addEventListener('click', (e) => e.stopPropagation());
    authModal.addEventListener('click', () => authModal.classList.add('hidden'));

    // Handle form submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = nameInput.value;
        const surname = surnameInput.value;
        const phone = phoneInput.value;
        const confirmPassword = confirmPasswordInput.value;

        try {
            if (isRegisterMode) {
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match.");
                }
                if (!name || !surname || !phone) {
                    throw new Error("Name, Surname, and Phone are required for registration.");
                }
                await registerUser(email, password, name, surname, phone);
            } else {
                await loginUser(email, password);
            }
            authModal.classList.add('hidden'); // Close modal on success
            authForm.reset();
        } catch (error) {
            let message = error.message || "An unknown error occurred.";
            if (message.includes("Firebase: Error (auth/")) {
                 message = message.replace("Firebase: Error (auth/", "").replace(").", "").replace(/-/g, ' ');
            }
            authError.textContent = message;
            authError.classList.remove('hidden');
        }
    });

    // --- Admin Panel Functions ---

    /**
     * Wires up all event listeners for the Admin Panel.
     * This function is called *after* the admin HTML is injected into the DOM.
     */
    function setupAdminPanelListeners() {
        // --- Selectors (must be inside this function) ---
        const adminUserList = document.getElementById('admin-user-list');
        const staffForm = document.getElementById('staff-creation-form');
        const studentUpdateForm = document.getElementById('student-update-form');
        const studentUpdateId = document.getElementById('student-update-id');
        const studentUpdateName = document.getElementById('student-update-name');
        const studentUpdateSurname = document.getElementById('student-update-surname');
        const studentUpdatePhone = document.getElementById('student-update-phone');
        const studentUpdateNumber = document.getElementById('student-update-number');
        const studentUpdateScheme = document.getElementById('student-update-scheme');
        const studentUpdateMarks = document.getElementById('student-update-marks'); // NEW
        const studentUpdateMessage = document.getElementById('student-update-message');
        const studentDeleteBtn = document.getElementById('student-delete-btn');

        // Admin: Staff Creation Form Submission
        staffForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('staff-email').value;
            const password = document.getElementById('staff-password').value;
            const role = document.getElementById('staff-role').value;
            const messageEl = document.getElementById('staff-creation-message');
            messageEl.textContent = 'Processing...';

            try {
                await createStaffUser(email, password, role);
                messageEl.textContent = `Success: New ${role} account created for ${email}.`;
                messageEl.classList.remove('hidden');
                messageEl.classList.remove('error');
                staffForm.reset();
            } catch (error) {
                messageEl.textContent = `Error creating staff user: ${error.message}`;
                messageEl.classList.add('error');
                messageEl.classList.remove('hidden');
            }
        });

        // Admin: Student Data Update Form Submission
        studentUpdateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uid = studentUpdateId.textContent;
            if (!uid || uid === 'N/A') {
                studentUpdateMessage.textContent = 'Error: Select a user to update first.';
                studentUpdateMessage.classList.add('error');
                return;
            }

            const data = {
                name: studentUpdateName.value,
                surname: studentUpdateSurname.value,
                phone: studentUpdatePhone.value,
                studentNumber: studentUpdateNumber.value,
                markingScheme: studentUpdateScheme.value, // Passed as JSON string
                marks: studentUpdateMarks.value, // NEW: Passed as JSON string
            };
            studentUpdateMessage.textContent = 'Updating...';
            studentUpdateMessage.classList.remove('hidden', 'error');

            try {
                await updateStudentData(uid, data);
                studentUpdateMessage.textContent = `Success: Student ${uid.slice(0, 8)} data updated.`;
                studentUpdateMessage.classList.remove('error');
            } catch (error) {
                studentUpdateMessage.textContent = `Error updating data: ${error.message}`;
                studentUpdateMessage.classList.add('error');
            }
        });

        // Admin: Delete User Button
        studentDeleteBtn.addEventListener('click', async () => {
            const uid = studentUpdateId.textContent;
            if (!uid || uid === 'N/A') {
                // Use a custom message box instead of alert
                studentUpdateMessage.textContent = 'Please select a user to delete.';
                studentUpdateMessage.classList.add('error');
                return;
            }

            // Create a custom confirmation modal (simple text-based)
            studentUpdateMessage.textContent = `Are you sure you want to delete user ${uid}? This cannot be undone. Click 'Delete' again to confirm.`;
            studentUpdateMessage.classList.add('error'); // Use error style for warning
            
            // Simple confirm: if they click delete *again* while message is up
            if (studentUpdateMessage.dataset.confirmDelete === uid) {
                try {
                    await deleteUser(uid);
                    studentUpdateMessage.textContent = `Success: User profile ${uid.slice(0, 8)} deleted.`;
                    studentUpdateMessage.classList.remove('error');
                    studentUpdateForm.reset();
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


    /**
     * Renders the list of all users/students in the Admin panel.
     */
    function renderAdminUserList(users) {
        const adminUserList = document.getElementById('admin-user-list');
        if (!adminUserList) return; // Guard clause if admin panel isn't loaded

        adminUserList.innerHTML = '';
        if (users.length === 0) {
            adminUserList.innerHTML = '<p class="muted">No users found in the database.</p>';
            return;
        }

        users.sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));

        users.forEach(user => {
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
                    ${user.studentNumber ? `<p>Student No: <strong>${user.studentNumber}</strong></p>` : `<p>Student No: <span class="muted">N/A</span></p>`}
                    <p>Phone: ${user.phone || 'N/A'}</p>
                </div>
                <button class="btn outline small edit-user-btn" data-uid="${user.uid}">Edit/Update Student Data</button>
            `;
            adminUserList.appendChild(el);
        });

        // Add event listeners for the edit buttons
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.target.dataset.uid;
                const user = users.find(u => u.uid === uid);
                
                if (!user) return;
                
                // Populate the update form fields (must be selected *after* injection)
                document.getElementById('student-update-id').textContent = uid;
                document.getElementById('student-update-name').value = user.name || '';
                document.getElementById('student-update-surname').value = user.surname || '';
                document.getElementById('student-update-phone').value = user.phone || '';
                document.getElementById('student-update-number').value = user.studentNumber || '';
                
                // Display marking scheme JSON cleanly
                const schemeString = user.markingScheme ? JSON.stringify(user.markingScheme, null, 2) : '{"assignment1": 0.4, "exam": 0.6}';
                document.getElementById('student-update-scheme').value = schemeString;

                // NEW: Display marks JSON cleanly
                const marksString = user.marks ? JSON.stringify(user.marks, null, 2) : '{}';
                document.getElementById('student-update-marks').value = marksString;

                // Scroll to the update form for easy editing
                document.getElementById('student-crud').scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    
    // --- Student Dashboard Functions ---

    /**
     * NEW: Renders the student's marks in a table.
     * Receives the user's single data object from the 'user_role/role' doc.
     */
    function renderStudentDashboard(userData) {
        const studentModuleList = document.getElementById('student-module-list');
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

        // Calculate final weighted mark, prevent division by zero
        const displayMark = totalWeight > 0 ? (finalMark / totalWeight) : finalMark;
        // The displayMark is the average based on the weight. If totalWeight < 1, it reflects the mark "so far".
        // To get the mark out of 100, we just use finalMark, which is the sum of (grade * weight).
        // Let's show the finalMark as the total percentage achieved.
        
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
                <p class="text-sm muted mt-3">Your Final Grade is the sum of (Your Grade * Weight). If Total Weight is not 100%, the scheme is not fully defined.</p>
            </div>
        `;
        
        studentModuleList.innerHTML = html;
    }

    // --- Lecturer Booking Functions ---
    function renderLecturerBookings(bookings) {
        const bookingsList = document.getElementById('lecturer-bookings-list');
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

    // Smooth scroll with offset for fixed header
    document.querySelectorAll('.nav a, .nav-link, .brand').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (!target) return; // Exit if anchor doesn't exist
                
                const headerH = document.querySelector('.navbar').offsetHeight;
                const top = target.getBoundingClientRect().top + window.scrollY - headerH;
                window.scrollTo({ top, behavior: 'smooth' });
                
                // Close mobile nav on click
                document.querySelector('.nav')?.classList.remove('show');
                document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Chart.js Setup 
    const tabs = document.querySelectorAll('.tab');
    const canvases = {
        subjects: document.getElementById('chartSubjects'),
        trend: document.getElementById('chartTrend'),
        distribution: document.getElementById('chartDistribution')
    };

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            Object.entries(canvases).forEach(([key, canvas]) => {
                if(canvas) { 
                    canvas.classList.toggle('hidden', key !== tab);
                }
            });
        });
    });

    // Chart.js defaults themed to cyan
    if (window.Chart) {
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.color = '#164e63';
        Chart.defaults.plugins.legend.labels.boxWidth = 8;
    }

    // Sample data (edit/replace as needed)
    const subjects = ['English','Maths','Science','Art','History','Geography'];
    const averages = [72, 64, 67, 86, 74, 70];

    // Subject Marks (Bar)
    const chartSubjects = document.getElementById('chartSubjects');
    if (chartSubjects) {
        const ctxSubjects = chartSubjects.getContext('2d');
        new Chart(ctxSubjects, {
            type: 'bar',
            data: {
                labels: subjects,
                datasets: [{
                    label: 'Average %',
                    data: averages,
                    backgroundColor: 'rgba(6,182,212,0.35)',
                    borderColor: '#06b6d4',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } }
                },
                plugins: {
                    tooltip: {
                        callbacks: { label: (ctx) => ` ${ctx.parsed.y}%` }
                    }
                }
            }
        });
    }


    // Term Trend (Line) - per week
    const weeks = ['Week1','Week2','Week3','Week4','Week5','Week6','Week7','Week8'];
    const trend = [58, 62, 65, 69, 72, 75, 79, 83];
    const chartTrend = document.getElementById('chartTrend');
    if (chartTrend) {
        const ctxTrend = chartTrend.getContext('2d');
        new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: weeks,
                datasets: [{
                    label: 'Class Average %',
                    data: trend,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6,182,212,0.15)',
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: false, ticks: { callback: (v) => v + '%' } }
                }
            }
        });
    }
    

    // Distribution (Doughnut)
    const bands = ['Excellent (80-100)','Good (60-79)','Average (40-59)','Below 40'];
    const counts = [30, 50, 15, 5]; // Example cohort split
    const chartDistribution = document.getElementById('chartDistribution');
    if (chartDistribution) {
        const ctxDist = chartDistribution.getContext('2d');
        new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: bands,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        'rgba(6,182,212,0.85)',
                        'rgba(6,182,212,0.55)',
                        'rgba(6,182,212,0.35)',
                        'rgba(6,182,212,0.18)',
                    ],
                    borderColor: '#06b6d4'
                }]
            },
            options: {
                responsive: true,
                cutout: '60%'
            }
        });
    }

    // Mobile nav toggle (unchanged)
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            nav.classList.toggle('show');
        });
    }
});
