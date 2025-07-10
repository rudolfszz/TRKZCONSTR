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
});
