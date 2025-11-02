import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './firebase_config.js'; // Import auth from the central config

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
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

// Handle login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;
    errorContainer.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);

        // On success, redirect to the main dashboard.
        // The dashboard will handle role-based routing.
        showMessage('Login successful! Redirecting...');
        window.location.href = 'dashboard.html'; // We will create this file next

    } catch (error) {
        console.error('Login Error:', error.message);
        showError(getFriendlyErrorMessage(error.code));
    } finally {
        loginButton.textContent = 'Login';
        loginButton.disabled = false;
    }
});

// Friendly error messages
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please try again.';
        case 'auth/too-many-requests':
            return 'Access to this account has been temporarily disabled. Please reset your password or try again later.';
        default:
            return 'An error occurred during login. Please try again.';
    }
}

