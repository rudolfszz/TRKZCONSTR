import { initializeCommonFeatures } from './utils.js';

const customCalendarEventsList = document.getElementById('custom-calendar-events-list');

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize common features (CSRF protection, error handlers)
    initializeCommonFeatures();
    // --- Calendar Event Modal Logic (now inside main DOMContentLoaded for correct calendarId) ---
    const openModalBtn = document.getElementById('open-calendar-event-modal-btn');
    const modal = document.getElementById('calendar-event-modal');
    const closeModalBtn = document.getElementById('close-calendar-event-modal-btn');
    const form = document.getElementById('calendar-event-form');
    const resultDiv = document.getElementById('calendar-event-result');
    if (openModalBtn && modal && closeModalBtn && form) {
        openModalBtn.onclick = () => {
            modal.style.display = 'flex';
            resultDiv.textContent = '';
            form.reset();
        };
        closeModalBtn.onclick = () => {
            modal.style.display = 'none';
        };
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
        form.onsubmit = async (e) => {
            e.preventDefault();
            resultDiv.textContent = 'Adding event...';
            const title = document.getElementById('event-title').value.trim();
            const description = document.getElementById('event-description').value.trim();
            const location = document.getElementById('event-location').value.trim();
            const start = document.getElementById('event-start').value;
            const end = document.getElementById('event-end').value;
            const notify = document.getElementById('event-notify').checked;
            const projectName = projectSelect?.options[projectSelect.selectedIndex]?.textContent || '';
            // Always use the correct calendarId for the selected project
            const calendarId = findCalendarIdByProjectName(projectName);
            if (!title || !start || !end) {
                resultDiv.textContent = 'Please fill in all required fields.';
                return;
            }
            try {
                const res = await fetch('/api/calendar-add-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description, start, end, location, notify, projectName, calendarId })
                });
                const data = await res.json();
                if (data.success) {
                    resultDiv.innerHTML = 'Event added! <a href="' + data.htmlLink + '" target="_blank">View in Google Calendar</a>';
                    form.reset();
                    // Refresh event list after adding
                    if (typeof fetchAndDisplayCalendarEvents === 'function') fetchAndDisplayCalendarEvents();
                } else {
                    resultDiv.textContent = data.error || 'Failed to add event.';
                }
            } catch (err) {
                resultDiv.textContent = 'Error adding event.';
            }
        };
    }
    const projectSelect = document.getElementById('project-select');
    // No calendar dropdown: calendar is selected automatically by project
    let calendarSelect = null;
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
    const calendarStart = document.getElementById('calendar-start');
    const calendarEnd = document.getElementById('calendar-end');
    const calendarUpdateBtn = document.getElementById('calendar-update-btn');
    let addedWorkers = [];
    let existingWorkers = [];
    let calendarList = [];

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
    // Store projectId -> calendarId mapping
    let projectCalendarMap = {};
    function findCalendarIdByProjectName(name) {
        const match = calendarList.find(cal => cal.summary === name);
        return match ? match.id : (calendarList[0]?.id || 'primary');
    }

    async function fetchProjects(selectedId) {
        try {
            // Fetch folders and calendar mapping in parallel
            const [foldersRes, calendarMapRes] = await Promise.all([
                fetch('/list-project-folders'),
                fetch('/api/project-calendar-map')
            ]);
            const foldersData = await foldersRes.json();
            const calendarMapData = await calendarMapRes.json();
            // foldersData.folders: [{id, name}], calendarMapData: { [projectId]: calendarId }
            projectSelect.innerHTML = '';
            projectCalendarMap = calendarMapData || {};
            foldersData.folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.name;
                projectSelect.appendChild(option);
            });
            let projectName = '';
            let calendarId = '';
            // Fetch all calendars
            const calRes = await fetch('/api/calendar-list');
            const calData = await calRes.json();
            calendarList = calData.items || [];
            if (selectedId && foldersData.folders.some(f => f.id === selectedId)) {
                projectSelect.value = selectedId;
                projectName = foldersData.folders.find(f => f.id === selectedId).name;
                calendarId = findCalendarIdByProjectName(projectName);
                // calendarSelect removed
                loadProjectFiles(selectedId);
                fetchAndDisplayExistingWorkers(selectedId);
                fetchRecentEmails();
                fetchRecentEntries(selectedId);
                setCalendar(selectedId, projectName, calendarId);
            } else if (foldersData.folders.length > 0) {
                projectSelect.value = foldersData.folders[0].id;
                projectName = foldersData.folders[0].name;
                calendarId = findCalendarIdByProjectName(projectName);
                // calendarSelect removed
                loadProjectFiles(foldersData.folders[0].id);
                fetchAndDisplayExistingWorkers(foldersData.folders[0].id);
                fetchRecentEmails();
                fetchRecentEntries(foldersData.folders[0].id);
                setCalendar(foldersData.folders[0].id, projectName, calendarId);
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
                // setCalendar(selectedId); // removed: handled above
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
                // Filter out entries with empty or placeholder notes
                const filtered = data.entries.filter(e => e.note && e.note.trim() !== '' && e.note.trim() !== ':');
                if (filtered.length) {
                    recentEntriesList.innerHTML = filtered.map(e => `<li><b>${e.worker}:</b> ${e.note}</li>`).join('');
                    recentEntriesList.style.display = '';
                    if (recentEntriesList.parentElement) recentEntriesList.parentElement.style.display = '';
                } else {
                    recentEntriesList.innerHTML = '';
                    recentEntriesList.style.display = 'none';
                    if (recentEntriesList.parentElement) recentEntriesList.parentElement.style.display = 'none';
                }
            } else {
                recentEntriesList.innerHTML = '';
                recentEntriesList.style.display = 'none';
                if (recentEntriesList.parentElement) recentEntriesList.parentElement.style.display = 'none';
            }
        } catch {
            recentEntriesList.innerHTML = '';
            recentEntriesList.style.display = 'none';
            if (recentEntriesList.parentElement) recentEntriesList.parentElement.style.display = 'none';
        }
    }

    // Set Google Calendar iframe (public calendar for now)
    function setCalendar(projectId, projectName, calendarId) {
        if (!calendarFrame) return;
        // Always use the calendarId for the project
        const calId = calendarId || (projectCalendarMap[projectId] || 'primary');
        let src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}&ctz=Europe/Riga`;
        if (calendarStart && calendarEnd && calendarStart.value && calendarEnd.value) {
            src += `#from=${calendarStart.value}&to=${calendarEnd.value}`;
        }
        calendarFrame.src = src;
    }

    // Set default dates to today and +7 days
    function setDefaultCalendarDates() {
        if (calendarStart && calendarEnd) {
            const today = new Date();
            const weekLater = new Date();
            weekLater.setDate(today.getDate() + 7);
            calendarStart.value = today.toISOString().slice(0, 10);
            calendarEnd.value = weekLater.toISOString().slice(0, 10);
        }
    }

    async function fetchAndDisplayCalendarEvents() {
        // Use selected calendar from dropdown
        const projectId = projectSelect?.value;
        const projectName = projectSelect?.options[projectSelect.selectedIndex]?.textContent || '';
        const calendarId = findCalendarIdByProjectName(projectName);
        setCalendar(projectId, projectName, calendarId);
        if (calendarStart && calendarEnd && customCalendarEventsList) {
            customCalendarEventsList.innerHTML = 'Loading...';
            try {
                const res = await fetch(`/api/calendar-events?calendarId=${encodeURIComponent(calendarId)}&start=${calendarStart.value}&end=${calendarEnd.value}`);
                const data = await res.json();
                if (data.events && data.events.length) {
                    customCalendarEventsList.innerHTML = data.events.map(ev =>
                        `<li><b>${ev.summary || '(No Title)'}</b><br>
                        ${ev.start ? 'From: ' + new Date(ev.start).toLocaleString() : ''}<br>
                        ${ev.end ? 'To: ' + new Date(ev.end).toLocaleString() : ''}<br>
                        ${ev.location ? 'Location: ' + ev.location + '<br>' : ''}
                        ${ev.description ? '<span style="color:gray">' + ev.description + '</span>' : ''}
                        </li>`
                    ).join('');
                } else {
                    customCalendarEventsList.innerHTML = '<li>No events found for this range.</li>';
                }
            } catch {
                customCalendarEventsList.innerHTML = '<li>Error loading events.</li>';
            }
        }
    }

    if (calendarUpdateBtn) {
        calendarUpdateBtn.onclick = fetchAndDisplayCalendarEvents;
    }
    // No calendar dropdown event
    // (Removed duplicate DOMContentLoaded block)

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
        // Auto-select calendar with the same name as the project, or fallback
        const match = calendarList.find(cal => cal.summary === projectName);
        const calendarId = match ? match.id : (calendarList[0]?.id || 'primary');
        calendarSelect.value = calendarId;
        loadProjectFiles(projectId);
        addedWorkers = [];
        renderWorkerList();
        fetchAndDisplayExistingWorkers(projectId);
        fetchRecentEmails();
        fetchRecentEntries(projectId);
        setDashboardTitle(projectName);
        setCalendar(projectId, projectName, calendarId);
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
    setDefaultCalendarDates();
    const projectId = getProjectIdFromUrl();
    // Fetch projects, then set the calendar iframe for the current project
    fetchProjects(projectId).then(() => {
        // After projects are loaded, set the calendar iframe for the selected project
        const currentProjectId = projectSelect.value;
        const currentProjectName = projectSelect.options[projectSelect.selectedIndex]?.textContent || '';
        const currentCalendarId = projectCalendarMap[currentProjectId] || 'primary';
        setCalendar(currentProjectId, currentProjectName, currentCalendarId);
        // Always fetch calendar events on load
        setTimeout(fetchAndDisplayCalendarEvents, 500);
    });

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
});
