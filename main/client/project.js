document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('project-form');
    const nameInput = document.getElementById('project-name');
    const resultDiv = document.getElementById('result');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        resultDiv.textContent = 'Creating project...';
        try {
            const res = await fetch('/create-project-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (data.id) {
                resultDiv.innerHTML = `Project folder created: ${data.name} <br><button id="go-to-project">Go to Project Dashboard</button>`;
                document.getElementById('go-to-project').onclick = () => {
                    window.location.href = `managerSide.html?projectId=${data.id}`;
                };
                // Add to worker project dropdown
                const workerSelect = document.getElementById('worker-project-select');
                const option = document.createElement('option');
                option.value = data.id;
                option.textContent = `${data.name} (Current Project)`;
                option.setAttribute('data-current', 'true');
                workerSelect.appendChild(option);
                workerSelect.value = data.id;
            } else {
                resultDiv.textContent = data.error || 'Failed to create project.';
            }
        } catch (err) {
            resultDiv.textContent = 'Error creating project.';
        }
    };

    // Populate the project dropdown with existing projects
    async function loadProjectsDropdown() {
        const select = document.getElementById('project-select');
        select.innerHTML = '';
        try {
            const res = await fetch('/list-project-folders');
            const data = await res.json();
            if (data.folders && data.folders.length) {
                data.folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder.id;
                    option.textContent = folder.name;
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.textContent = 'No projects found';
                option.disabled = true;
                select.appendChild(option);
            }
        } catch (err) {
            const option = document.createElement('option');
            option.textContent = 'Error loading projects';
            option.disabled = true;
            select.appendChild(option);
        }
    }

    // Go to selected project on button click
    document.getElementById('go-to-selected-project').onclick = () => {
        const select = document.getElementById('project-select');
        const projectId = select.value;
        if (projectId) {
            window.location.href = `managerSide.html?projectId=${projectId}`;
        }
    };

    // Populate the worker project dropdown with existing projects
    // In loadWorkerProjectsDropdown, mark the current project if present
    async function loadWorkerProjectsDropdown() {
        const select = document.getElementById('worker-project-select');
        select.innerHTML = '';
        try {
            const res = await fetch('/list-project-folders');
            const data = await res.json();
            if (data.folders && data.folders.length) {
                data.folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder.id;
                    option.textContent = folder.name;
                    if (folder.id === select.value) {
                        option.textContent += ' (Current Project)';
                    }
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.textContent = 'No projects found';
                option.disabled = true;
                select.appendChild(option);
            }
        } catch (err) {
            const option = document.createElement('option');
            option.textContent = 'Error loading projects';
            option.disabled = true;
            select.appendChild(option);
        }
    }

    // Add worker email to the worker folder
    const workerForm = document.getElementById('add-worker-form');
    const workerEmailInput = document.getElementById('worker-email');
    const workerList = document.getElementById('worker-list');
    const workerShareResult = document.getElementById('worker-share-result');
    let addedWorkers = [];

    workerForm.onsubmit = async (e) => {
        e.preventDefault();
        // Check if manager is logged in before sharing
        const userRes = await fetch('/user');
        const userData = await userRes.json();
        if (!userData.loggedIn) {
            workerShareResult.textContent = 'You must be logged in as a manager to add a worker.';
            window.location.href = 'login.html';
            return;
        }
        const email = workerEmailInput.value.trim();
        const projectId = document.getElementById('worker-project-select').value;
        if (!email || !projectId) return;
        workerShareResult.textContent = 'Sharing folder...';
        try {
            // Get the worker folder id for the selected project
            const res = await fetch(`/get-worker-folder-id?projectId=${projectId}`);
            const data = await res.json();
            if (!data.workerFolderId) {
                workerShareResult.textContent = 'Could not find worker folder.';
                return;
            }
            // Share the worker folder with the email
            const shareRes = await fetch('/share-worker-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId: data.workerFolderId, email })
            });
            if (shareRes.status === 401) {
                workerShareResult.textContent = 'Session expired. Please log in again.';
                window.location.href = 'login.html';
                return;
            }
            const shareData = await shareRes.json();
            if (shareData.success) {
                addedWorkers.push(email);
                renderWorkerList();
                workerShareResult.textContent = 'Worker added and folder shared!';
                workerEmailInput.value = '';
            } else {
                workerShareResult.textContent = (shareData.error ? shareData.error + (shareData.details ? ' (' + shareData.details + ')' : '') : 'Failed to share folder.');
            }
        } catch (err) {
            workerShareResult.textContent = 'Error sharing folder.';
        }
    };

    function renderWorkerList() {
        workerList.innerHTML = '';
        addedWorkers.forEach(email => {
            const li = document.createElement('li');
            li.textContent = email;
            workerList.appendChild(li);
        });
    }

    // Logout button functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            fetch('/logout').then(() => window.location.href = 'login.html');
        };
    }

    loadProjectsDropdown();
    loadWorkerProjectsDropdown();
});
