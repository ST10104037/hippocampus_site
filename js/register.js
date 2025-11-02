import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db, appId } from './firebase_config.js'; // Import from central config

// DOM Elements
const registerForm = document.getElementById('register-form');
const nameInput = document.getElementById('name');
const surnameInput = document.getElementById('surname');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const registerButton = document.getElementById('register-button');
const errorContainer = document.getElementById('error-container');
const messageContainer = document.getElementById('message-container');

// Show error message
function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
    messageContainer.classList.add('hidden');
}

// Show success message
function showMessage(message) {
    messageContainer.textContent = message;
    messageContainer.classList.remove('hidden');
    errorContainer.classList.add('hidden');
}

// Handle registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value;
    const surname = surnameInput.value;
    const email = emailInput.value;
    const phone = phoneInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters long.');
        return;
    }

    registerButton.textContent = 'Registering...';
    registerButton.disabled = true;
    errorContainer.classList.add('hidden');

    try {
        // 1. Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log('User created in Auth:', user.uid);

        // 2. Create the user document in Firestore
        // **FIXED:** Using the correct path that matches db.js and auth_service.js
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'user_role', 'role');

        await setDoc(userDocRef, {
            uid: user.uid,
            name: name,
            surname: surname,
            email: email,
            phone: phone,
            role: 'student', // Default role as requested
            createdAt: new Date()
        });

        console.log('User document created in Firestore');

        // On success, redirect to the main dashboard.
        showMessage('Registration successful! Redirecting...');
        window.location.href = 'dashboard.html'; // We will create this file next

    } catch (error)
    {
        console.error('Registration Error:', error.message);
        showError(getFriendlyErrorMessage(error.code));
    } finally {
        registerButton.textContent = 'Register';
        registerButton.disabled = false;
    }
});

// Friendly error messages
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email address is already registered. Please login.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return 'Your password is too weak. Please choose a stronger one.';
        default:
            return 'An error occurred during registration. Please try again.';
    }
}


