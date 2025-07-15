
document.addEventListener('DOMContentLoaded', async () => {
    const projectSelect = document.getElementById('project-select');
    const fileList = document.getElementById('file-list');
    const workerForm = document.getElementById('add-worker-form');
    const workerEmailInput = document.getElementById('worker-email');
    const workerNameInput = document.getElementById('worker-name');
    const workerSurnameInput = document.getElementById('worker-surname');
    const workerList = document.getElementById('worker-list');
    const workerShareResult = document.getElementById('worker-share-result');
    const existingWorkerList = document.getElementById('existing-worker-list');
    const pageTitle = document.getElementById('page-title');
    const dashboardTitle = document.getElementById('dashboard-title');
    const recentEmailsList = document.getElementById('recent-emails-list');
    const recentEntriesList = document.getElementById('recent-entries-list');
    const addFileForm = document.getElementById('add-file-form');
    const fileTypeSelect = document.getElementById('file-type-select');
    const newFileNameInput = document.getElementById('new-file-name');
    const addFileResult = document.getElementById('add-file-result');
    const notepadForm = document.getElementById('notepad-form');
    const notepadInput = document.getElementById('notepad-input');
    const notepadResult = document.getElementById('notepad-result');
    const calendarFrame = document.getElementById('google-calendar-frame');
    let addedWorkers = [];
    let existingWorkers = [];

    // Add 'Create New Project' button if not present
    let createProjectBtn = document.getElementById('create-project-btn');
    if (!createProjectBtn) {
        createProjectBtn = document.createElement('button');
        createProjectBtn.id = 'create-project-btn';
        createProjectBtn.textContent = 'Create New Project';
        // Insert at the top of the page or above the project select
        const container = document.body;
        container.insertBefore(createProjectBtn, container.firstChild);
    }
    createProjectBtn.onclick = () => {
        window.location.href = 'project.html';
    };

    // Helper to get projectId from URL
    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('projectId');
    }

    // Set dashboard title and page title to project name
    function setDashboardTitle(name) {
        if (pageTitle) pageTitle.textContent = name ? `${name} Dashboard` : 'Manager Dashboard';
        if (dashboardTitle) dashboardTitle.textContent = name ? `${name} Dashboard` : 'Manager Dashboard';
    }

    // Fetch all project folders (assume they are top-level folders)
    async function fetchProjects(selectedId) {
        try {
            const res = await fetch('/list-project-folders');
            const data = await res.json();
            projectSelect.innerHTML = '';
            data.folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.name;
                projectSelect.appendChild(option);
            });
            let projectName = '';
            if (selectedId && data.folders.some(f => f.id === selectedId)) {
                projectSelect.value = selectedId;
                projectName = data.folders.find(f => f.id === selectedId).name;
                loadProjectFiles(selectedId);
                fetchAndDisplayExistingWorkers(selectedId);
                fetchRecentEmails();
                fetchRecentEntries(selectedId);
                setCalendar(selectedId, projectName);
            } else if (data.folders.length > 0) {
                projectSelect.value = data.folders[0].id;
                projectName = data.folders[0].name;
                loadProjectFiles(data.folders[0].id);
                fetchAndDisplayExistingWorkers(data.folders[0].id);
                fetchRecentEmails();
                fetchRecentEntries(data.folders[0].id);
                setCalendar(data.folders[0].id, projectName);
            }
            setDashboardTitle(projectName);
        } catch (err) {
            projectSelect.innerHTML = '';
            const option = document.createElement('option');
            option.textContent = 'Error loading projects';
            option.disabled = true;
            projectSelect.appendChild(option);
        }
    }

    // Fetch and display recent emails (worker activity)
    // Fetch and display recent manager inbox emails
    async function fetchRecentEmails() {
        if (!recentEmailsList) return;
        recentEmailsList.innerHTML = 'Loading...';
        try {
            const res = await fetch('/api/manager-inbox-emails');
            const data = await res.json();
            if (data.emails && data.emails.length) {
                recentEmailsList.innerHTML = data.emails.map(email => `<li><b>${email.from}</b>: ${email.subject} <span style="color:gray;font-size:smaller">${email.date}</span></li>`).join('');
            } else {
                recentEmailsList.innerHTML = '<li>No recent emails.</li>';
            }
        } catch {
            recentEmailsList.innerHTML = '<li>Error loading emails.</li>';
        }
    }

    // Fetch and display recent entries (notes)
    async function fetchRecentEntries(projectId) {
        if (!recentEntriesList) return;
        recentEntriesList.innerHTML = 'Loading...';
        try {
            const res = await fetch(`/api/recent-entries?projectId=${projectId}`);
            const data = await res.json();
            if (data.entries && data.entries.length) {
                recentEntriesList.innerHTML = data.entries.map(e => `<li><b>${e.worker}:</b> ${e.note}</li>`).join('');
            } else {
                recentEntriesList.innerHTML = '<li>No recent entries.</li>';
            }
        } catch {
            recentEntriesList.innerHTML = '<li>Error loading entries.</li>';
        }
    }

    // Set Google Calendar iframe (public calendar for now)
    function setCalendar(projectId, projectName) {
        if (!calendarFrame) return;
        // You can replace the src below with a project-specific calendar if available
        calendarFrame.src = 'https://calendar.google.com/calendar/embed?src=en.latvian%23holiday%40group.v.calendar.google.com&ctz=Europe%2FRiga';
    }

    // Fetch files/folders for a project
    async function loadProjectFiles(folderId) {
        fileList.innerHTML = 'Loading...';
        try {
            const res = await fetch(`/list-project-files?folderId=${folderId}`);
            const data = await res.json();
            fileList.innerHTML = '';
            if (!data.files.length) {
                fileList.innerHTML = '<li>No files found.</li>';
                return;
            }
            data.files.forEach(file => {
                const li = document.createElement('li');
                let url = '#';
                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    url = `https://drive.google.com/drive/folders/${file.id}`;
                } else if (file.mimeType === 'application/vnd.google-apps.document') {
                    url = `https://docs.google.com/document/d/${file.id}/edit`;
                } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
                    url = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
                } else {
                    url = `https://drive.google.com/file/d/${file.id}/view`;
                }
                li.innerHTML = `<a href="${url}" target="_blank">${file.name}</a>`;
                fileList.appendChild(li);
            });
        } catch (err) {
            fileList.innerHTML = '<li>Error loading files.</li>';
        }
    }

    // Helper to fetch and display existing workers for the selected project
    async function fetchAndDisplayExistingWorkers(projectId) {
        existingWorkers = [];
        if (!projectId) {
            existingWorkerList.innerHTML = '';
            return;
        }
        // Get the worker folder id for the selected project
        const res = await fetch(`/get-worker-folder-id?projectId=${projectId}`);
        const data = await res.json();
        if (!data.workerFolderId) {
            existingWorkerList.innerHTML = '<li>No worker folder found for this project.</li>';
            return;
        }
        // Fetch permissions (shared users) for the worker folder
        try {
            const permRes = await fetch(`/api/worker-folder-permissions?folderId=${data.workerFolderId}`);
            const permData = await permRes.json();
            if (permData && Array.isArray(permData.emails)) {
                existingWorkers = permData.emails;
                if (existingWorkers.length) {
                    existingWorkerList.innerHTML = existingWorkers.map(email => `<li>${email}</li>`).join('');
                } else {
                    existingWorkerList.innerHTML = '<li>No workers added yet.</li>';
                }
            } else {
                existingWorkerList.innerHTML = '<li>Could not fetch workers.</li>';
            }
        } catch {
            existingWorkerList.innerHTML = '<li>Could not fetch workers.</li>';
        }
    }

    // Worker form submission handler
    if (workerForm) {
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
            const projectId = projectSelect.value;
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
                    workerNameInput.value = '';
                    workerSurnameInput.value = '';
                    // Refresh the existing workers list
                    await fetchAndDisplayExistingWorkers(projectId);
                } else {
                    workerShareResult.textContent = (shareData.error ? shareData.error + (shareData.details ? ' (' + shareData.details + ')' : '') : 'Failed to share folder.');
                }
            } catch (err) {
                workerShareResult.textContent = 'Error sharing folder.';
            }
        };
    }

    function renderWorkerList() {
        workerList.innerHTML = '';
        addedWorkers.forEach(email => {
            const li = document.createElement('li');
            li.textContent = email;
            workerList.appendChild(li);
        });
    }

    projectSelect.addEventListener('change', e => {
        const projectId = e.target.value;
        const projectName = projectSelect.options[projectSelect.selectedIndex]?.textContent || '';
        loadProjectFiles(projectId);
        addedWorkers = [];
        renderWorkerList();
        fetchAndDisplayExistingWorkers(projectId);
        fetchRecentEmails();
        fetchRecentEntries(projectId);
        setDashboardTitle(projectName);
        setCalendar(projectId, projectName);
    });
    // Add file to project
    if (addFileForm) {
        addFileForm.onsubmit = async (e) => {
            e.preventDefault();
            addFileResult.textContent = 'Adding file...';
            const projectId = projectSelect.value;
            const fileType = fileTypeSelect.value;
            const fileName = newFileNameInput.value.trim();
            if (!projectId || !fileType || !fileName) {
                addFileResult.textContent = 'All fields are required.';
                return;
            }
            try {
                const res = await fetch('/api/add-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, fileType, fileName })
                });
                const data = await res.json();
                if (data.success) {
                    addFileResult.textContent = 'File added!';
                    newFileNameInput.value = '';
                    loadProjectFiles(projectId);
                } else {
                    addFileResult.textContent = data.error || 'Failed to add file.';
                }
            } catch (err) {
                addFileResult.textContent = 'Error adding file.';
            }
        };
    }

    // Notepad (manager personal doc)
    if (notepadForm) {
        notepadForm.onsubmit = async (e) => {
            e.preventDefault();
            notepadResult.textContent = 'Saving note...';
            const projectId = projectSelect.value;
            const note = notepadInput.value.trim();
            if (!projectId || !note) {
                notepadResult.textContent = 'Note cannot be empty.';
                return;
            }
            try {
                const res = await fetch('/api/manager-notepad', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, note })
                });
                const data = await res.json();
                if (data.success) {
                    notepadResult.textContent = 'Note saved!';
                    notepadInput.value = '';
                } else {
                    notepadResult.textContent = data.error || 'Failed to save note.';
                }
            } catch (err) {
                notepadResult.textContent = 'Error saving note.';
            }
        };
    }

    // On load, check for projectId in URL
    const projectId = getProjectIdFromUrl();
    fetchProjects(projectId);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            fetch('/logout').then(() => window.location.href = 'login.html');
        };
    }

    const switchToWorkerBtn = document.getElementById('switch-to-worker-btn');
    if (switchToWorkerBtn) {
        switchToWorkerBtn.onclick = () => {
            window.location.href = 'workerSide.html';
        };
    }

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
