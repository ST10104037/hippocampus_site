// --- HTML Template for Admin Panel ---
// This HTML is injected dynamically by script.js when an admin logs in.
export const adminPanelHTML = `
    <h1>Admin Panel: User & Data Management</h1>
    
    <!-- 1. STAFF CREATION FORM -->
    <div class="card bg-gray-50 mb-8 p-6 border-l-4 border-teal-400">
        <h3 class="text-xl mb-4">Create New Admin / Lecturer Account</h3>
        <form id="staff-creation-form" class="grid cards-2 gap-4">
            <input type="email" id="staff-email" placeholder="Email" required>
            <input type="password" id="staff-password" placeholder="Password" required>
            <select id="staff-role" required>
                <option value="lecturer">Lecturer</option>
                <option value="admin">Admin</option>
            </select>
            <button type="submit" class="btn primary">Create Staff User</button>
        </form>
        <div id="staff-creation-message" class="message hidden mt-3"></div>
    </div>

    <!-- 2. STUDENT/USER CRUD & LIST CONTAINER -->
    <h2 class="mt-8">All System Users</h2>
    <div class="grid cards-2" id="admin-user-list">
        <p class="muted">Loading user data...</p>
        <!-- User cards will be rendered here by JavaScript -->
    </div>

    <!-- 3. USER DATA UPDATE FORM -->
    <div class="card bg-yellow-50 mt-8 p-6 border-l-4 border-yellow-400" id="user-crud">
        <h3 class="text-xl mb-4" id="user-update-title">Edit User Profile</h3>
        <p class="mb-3">Editing UID: <strong id="user-update-id">N/A</strong></p>
        
        <form id="user-update-form" class="grid cards-2 gap-4">
            <!-- Common Fields -->
            <input type="text" id="user-update-name" placeholder="Name" required>
            <input type="text" id="user-update-surname" placeholder="Surname" required>
            <input type="text" id="user-update-phone" placeholder="Phone Number" required>
            
            <!-- Student-Only Fields -->
            <div class.="student-only-field">
                <label for="user-update-number">Student Number</label>
                <input type="text" id="user-update-number" placeholder="Student Number (e.g., S12345)">
            </div>
            
            <div class="col-span-full student-only-field">
                <p class="font-semibold mt-2 mb-1">Marking Scheme (JSON):</p>
                <textarea id="user-update-scheme" rows="4" class="w-full" placeholder='{"assignment1": 0.4, "exam": 0.6}'></textarea>
            </div>
            
            <div class="col-span-full student-only-field">
                <p class="font-semibold mt-2 mb-1">Student Marks (JSON):</p>
                <textarea id="user-update-marks" rows="4" class="w-full" placeholder='{"assignment1": 80, "exam": 65}'></textarea>
            </div>
            
            <!-- Form Actions -->
            <div class="col-span-full flex gap-3 mt-3">
                <button type="submit" class="btn primary flex-grow">Update User Data</button>
                <button type="button" id="user-delete-btn" class="btn danger outline">Delete User</button>
            </div>
        </form>
        <div id="user-update-message" class="message hidden mt-3"></div>
    </div>
`;

