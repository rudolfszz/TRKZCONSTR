import { initializeCommonFeatures } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize common features (CSRF protection, error handlers)
    initializeCommonFeatures();
    
    // Check login status before showing page
    fetch('/user')
        .then(res => res.json())
        .then(data => {
            if (!data.loggedIn) {
                window.location.href = 'login.html';
            }
        });
    document.getElementById('manager-view').onclick = () => {
        window.location.href = 'project.html';
    };
    document.getElementById('worker-view').onclick = () => {
        window.location.href = 'workerSide.html';
    };
    document.getElementById('logout-btn').onclick = () => {
        fetch('/logout').then(() => window.location.href = 'login.html');
    };
});
window.addEventListener('unhandledrejection', function(e) {
    alert('A critical error occurred: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});
