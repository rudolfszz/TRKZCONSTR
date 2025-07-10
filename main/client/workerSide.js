document.addEventListener('DOMContentLoaded', async () => {
    const projectSelect = document.getElementById('worker-project-select');
    const fileList = document.getElementById('worker-file-list');
    const infoDiv = document.getElementById('worker-info');

    // Fetch all worker folders the user has access to
    async function fetchWorkerProjects() {
        const res = await fetch('/list-accessible-worker-folders');
        const data = await res.json();
        projectSelect.innerHTML = '';
        if (data.folders && data.folders.length) {
            data.folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.projectName || folder.name;
                projectSelect.appendChild(option);
            });
            loadWorkerFiles(data.folders[0].id);
        } else {
            const option = document.createElement('option');
            option.textContent = 'No projects found';
            option.disabled = true;
            projectSelect.appendChild(option);
            fileList.innerHTML = '<li>No accessible worker folders.</li>';
        }
    }

    // Fetch files in the selected worker folder
    async function loadWorkerFiles(folderId) {
        fileList.innerHTML = 'Loading...';
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
    }

    // Add quick note functionality
    const quickNoteForm = document.getElementById('quick-note-form');
    const noteBodyInput = document.getElementById('note-body');
    const noteResult = document.getElementById('note-result');
    let currentProjectId = null;
    let logDocId = null;

    // Disable form until log doc is loaded
    quickNoteForm.querySelectorAll('textarea, button').forEach(el => el.disabled = true);

    // Helper to get the worker log doc id for the selected project
    async function fetchWorkerLogDocId(workersFolderId) {
        // 1. Find the subfolder for the current worker inside the selected Workers folder
        // We'll use the user's email (from /user endpoint) to match the subfolder
        let userEmail = '';
        try {
            const userRes = await fetch('/user');
            const userData = await userRes.json();
            userEmail = userData.email || '';
            console.log('User email:', userEmail);
        } catch {}
        if (!userEmail) return null;
        const workerName = userEmail.split('@')[0];
        // 2. List subfolders in the Workers folder
        const subRes = await fetch(`/list-project-files?folderId=${workersFolderId}`);
        const subData = await subRes.json();
        const mySubfolder = subData.files.find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name && f.name.includes(workerName));
        if (!mySubfolder) return null;
        // 3. Find the log doc in the subfolder
        const docRes = await fetch(`/list-project-files?folderId=${mySubfolder.id}`);
        const docData = await docRes.json();
        const logDoc = docData.files.find(f => f.name && f.name.endsWith('log') && f.mimeType === 'application/vnd.google-apps.document');
        return logDoc ? logDoc.id : null;
    }

    async function enableQuickNoteFormIfReady() {
        if (logDocId) {
            quickNoteForm.querySelectorAll('textarea, button').forEach(el => el.disabled = false);
            noteResult.textContent = '';
        } else {
            quickNoteForm.querySelectorAll('textarea, button').forEach(el => el.disabled = true);
            noteResult.textContent = 'Log document not found for this project.';
        }
    }

    quickNoteForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!currentProjectId) {
            noteResult.textContent = 'Select a project first.';
            return;
        }
        if (!logDocId) {
            noteResult.textContent = 'Could not find your log document.';
            return;
        }
        const body = noteBodyInput.value.trim();
        if (!body) return;
        noteResult.textContent = 'Adding note...';
        try {
            const res = await fetch('/add-worker-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId: logDocId, body })
            });
            const data = await res.json();
            if (data.success) {
                noteResult.textContent = 'Note added!';
                noteBodyInput.value = '';
            } else {
                noteResult.textContent = data.error || 'Failed to add note.';
            }
        } catch (err) {
            noteResult.textContent = 'Error adding note.';
        }
    };

    // Update logDocId when project changes
    async function updateLogDocId(folderId) {
        logDocId = await fetchWorkerLogDocId(folderId);
        await enableQuickNoteFormIfReady();
    }

    // Update currentProjectId and logDocId on project change
    projectSelect.addEventListener('change', async e => {
        currentProjectId = e.target.value;
        console.log(currentProjectId);
        await updateLogDocId(currentProjectId);
        loadWorkerFiles(currentProjectId);
    });

    // On load, set currentProjectId and logDocId
    async function initialSetup() {
        await fetchWorkerProjects();
        currentProjectId = projectSelect.value;
        await updateLogDocId(currentProjectId);
    }
    initialSetup();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            fetch('/logout').then(() => window.location.href = 'login.html');
        };
    }
});
