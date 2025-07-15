document.addEventListener("DOMContentLoaded", async () => {
    const loginBtn = document.getElementById("login-btn");

    loginBtn.onclick = () => {
        window.location.href = "/login";
    };

    // After login, redirect to project.html if logged in
    fetch('/user').then(res => res.json()).then(data => {
        if (data.loggedIn) {
            window.location.href = 'project.html';
        }
    });

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
