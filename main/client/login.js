import { initializeCommonFeatures } from './utils.js';

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize common features (CSRF protection, error handlers)
    initializeCommonFeatures();
    
    const loginBtn = document.getElementById("login-btn");
    
    // Check for error parameters
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
        let errorMessage = 'Login failed. Please try again.';
        switch(error) {
            case 'oauth_denied':
                errorMessage = 'OAuth permission denied. Please grant access to continue.';
                break;
            case 'no_code':
                errorMessage = 'No authorization code received. Please try again.';
                break;
            case 'email_extraction_failed':
                errorMessage = 'Failed to extract email from OAuth response.';
                break;
            case 'auth_failed':
                errorMessage = 'Authentication failed. Please try again.';
                break;
        }
        
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background-color: #fee;
            color: #c33;
            padding: 10px;
            border: 1px solid #fcc;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
        `;
        errorDiv.textContent = errorMessage;
        document.body.insertBefore(errorDiv, loginBtn);
    }

    loginBtn.onclick = () => {
        console.log('🔐 Initiating login...');
        window.location.href = "/login";
    };

    // Check if already logged in
    try {
        const response = await fetch('/user');
        const data = await response.json();
        if (data.loggedIn) {
            console.log('✅ Already logged in, redirecting to project.html');
            window.location.href = 'project.html';
        }
    } catch (error) {
        console.error('❌ Error checking login status:', error);
    }
});
