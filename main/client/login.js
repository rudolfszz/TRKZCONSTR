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

});
