import { initializeCommonFeatures } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize common features (CSRF protection, error handlers)
    initializeCommonFeatures();
    const form = document.getElementById('project-form');
    const nameInput = document.getElementById('project-name');
    const resultDiv = document.getElementById('result');
    const workerAccessSection = document.getElementById('worker-access-section');
    // Hide worker section on load
    if (workerAccessSection) workerAccessSection.style.display = 'none';

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
                // Store the new projectId for worker form usage
                window.currentCreatedProjectId = data.id;
                // Show worker section after project is created
                if (workerAccessSection) workerAccessSection.style.display = '';
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

    // Removed worker project dropdown logic: project context is now implicit

    // Add worker email to the worker folder
    const workerForm = document.getElementById('add-worker-form');
    const workerEmailInput = document.getElementById('worker-email');
    // Add name and surname fields if not present
    let workerNameInput = document.getElementById('worker-name');
    let workerSurnameInput = document.getElementById('worker-surname');
    if (!workerNameInput) {
        workerNameInput = document.createElement('input');
        workerNameInput.type = 'text';
        workerNameInput.id = 'worker-name';
        workerNameInput.placeholder = 'First Name';
        workerNameInput.required = true;
        workerEmailInput.parentNode.insertBefore(workerNameInput, workerEmailInput);
    }
    if (!workerSurnameInput) {
        workerSurnameInput = document.createElement('input');
        workerSurnameInput.type = 'text';
        workerSurnameInput.id = 'worker-surname';
        workerSurnameInput.placeholder = 'Surname';
        workerSurnameInput.required = true;
        workerEmailInput.parentNode.insertBefore(workerSurnameInput, workerEmailInput.nextSibling);
    }
    const workerList = document.getElementById('worker-list');
    const workerShareResult = document.getElementById('worker-share-result');
    let addedWorkers = [];
    let existingWorkers = [];

    // Helper to fetch and display existing workers for the selected project
    async function fetchAndDisplayExistingWorkers(projectId) {
        existingWorkers = [];
        const workerListDiv = document.getElementById('existing-worker-list');
        if (!projectId) {
            workerListDiv.innerHTML = '';
            return;
        }
        // Get the worker folder id for the selected project
        const res = await fetch(`/get-worker-folder-id?projectId=${projectId}`);
        const data = await res.json();
        if (!data.workerFolderId) {
            workerListDiv.innerHTML = '<li>No worker folder found for this project.</li>';
            return;
        }
        // Fetch permissions (shared users) for the worker folder
        try {
            const permRes = await fetch(`/api/worker-folder-permissions?folderId=${data.workerFolderId}`);
            const permData = await permRes.json();
            if (permData && Array.isArray(permData.emails)) {
                existingWorkers = permData.emails;
                if (existingWorkers.length) {
                    workerListDiv.innerHTML = existingWorkers.map(email => `<li>${email}</li>`).join('');
                } else {
                    workerListDiv.innerHTML = '<li>No workers added yet.</li>';
                }
            } else {
                workerListDiv.innerHTML = '<li>Could not fetch workers.</li>';
            }
        } catch {
            workerListDiv.innerHTML = '<li>Could not fetch workers.</li>';
        }
    }

    // Worker form submission handler
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
        const firstName = workerNameInput.value.trim();
        const surname = workerSurnameInput.value.trim();
        // Use the newly created projectId for worker addition
        const projectId = window.currentCreatedProjectId;
        if (!email || !firstName || !surname || !projectId) {
            workerShareResult.textContent = 'All fields are required.';
            return;
        }
        workerShareResult.textContent = 'Sharing folder...';
        try {
            // Get the worker folder id for the selected project (for validation only)
            const res = await fetch(`/get-worker-folder-id?projectId=${projectId}`);
            const data = await res.json();
            if (!data.workerFolderId) {
                workerShareResult.textContent = 'Could not find worker folder.';
                return;
            }
            // Share the worker folder with the email, using the correct projectId
            const shareRes = await fetch('/share-worker-folder', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ projectId, email, firstName, surname })
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
                // Refresh the existing workers list
                await fetchAndDisplayExistingWorkers(projectId);
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

    // Add a section to show existing workers for the selected project
    let workerListDiv = document.getElementById('existing-worker-list');
    if (!workerListDiv) {
        workerListDiv = document.createElement('ul');
        workerListDiv.id = 'existing-worker-list';
        workerListDiv.style.marginTop = '10px';
        workerListDiv.style.marginBottom = '10px';
        workerListDiv.innerHTML = '';
        workerForm.parentNode.insertBefore(workerListDiv, workerForm);
    }

    // When project changes, clear addedWorkers and show existing workers
    const projectSelect = document.getElementById('project-select');
    if (projectSelect) {
        projectSelect.addEventListener('change', async e => {
            addedWorkers = [];
            renderWorkerList();
            await fetchAndDisplayExistingWorkers(projectSelect.value);
        });
    }


    // On load, show existing workers for the first project
    fetchAndDisplayExistingWorkers(projectSelect.value);

    loadProjectsDropdown();
    // loadWorkerProjectsDropdown removed: worker project selection is no longer needed
});
