checkIfLoggedIn();


async function checkIfLoggedIn() {
    try {
        const response = await fetch("http://localhost:3001/user", {
            credentials: 'include'
        });
        console.log("sent REQ");

        const data = await response.json();

        if (data.loggedIn) {
            console.log("logged IN make invis");
            logInWithGoogleButton.style.display = "none"; // hide if logged in
        } else {
            logInWithGoogleButton.style.display = "block"; // show if not
        }
    } catch (err) {
        console.error("Failed to check login status", err);
        logInWithGoogleButton.style.display = "block"; // show it by default on error
    }
}