document.addEventListener('DOMContentLoaded', () => {
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
    // Add CSRF token to all fetch POST/PUT/DELETE requests
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
        if (init && (!init.method || ['POST','PUT','DELETE'].includes(init.method.toUpperCase()))) {
            init.headers = init.headers || {};
            const csrfToken = window.localStorage.getItem('csrfToken') || document.querySelector('meta[name="csrf-token"]')?.content;
            if (csrfToken) {
                init.headers['x-csrf-token'] = csrfToken;
            }
        }
        return originalFetch(input, init);
    };
    fetch('/user').then(res => res.json()).then(data => {
        if (data.csrfToken) {
            window.localStorage.setItem('csrfToken', data.csrfToken);
        }
    });
});

window.addEventListener('error', function(e) {
    alert('A critical error occurred: ' + e.message);
});
window.addEventListener('unhandledrejection', function(e) {
    alert('A critical error occurred: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});
