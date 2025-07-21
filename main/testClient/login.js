// Login functionality
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('google-login-btn');
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');

    // Check if user is already logged in
    checkAuthStatus();

    loginBtn.addEventListener('click', handleGoogleLogin);

    async function handleGoogleLogin() {
        console.log('🔐 Login button clicked - redirecting to /login');
        try {
            showLoading();
            hideError();

            // Redirect to Google OAuth with return URL
            const redirectUrl = '/login?redirect=' + encodeURIComponent('/test/create-project.html');
            console.log('🔗 Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
        } catch (error) {
            console.error('Login error:', error);
            showError();
            hideLoading();
        }
    }

    async function checkAuthStatus() {
        try {
            const response = await fetch('/user');
            const data = await response.json();
            
            if (data.loggedIn) {
                // User is already logged in, redirect to project creation
                window.location.href = '/test/create-project.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // Stay on login page
        }
    }

    function showLoading() {
        loading.classList.remove('hidden');
        loginBtn.style.display = 'none';
    }

    function hideLoading() {
        loading.classList.add('hidden');
        loginBtn.style.display = 'flex';
    }

    function showError() {
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }
});
