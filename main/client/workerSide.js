document.addEventListener('DOMContentLoaded', async () => {
    const projectSelect = document.getElementById('worker-project-select');
    const fileList = document.getElementById('worker-file-list');
    const infoDiv = document.getElementById('worker-info');

    // Fetch all worker folders the user has access to
    async function fetchWorkerProjects() {
        try {
            const res = await fetch('/list-accessible-worker-folders');
            const data = await res.json();
            projectSelect.innerHTML = '';
            if (data.folders && data.folders.length) {
                data.folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder.id;
                    option.textContent = folder.displayName || folder.projectName || folder.name;
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
        } catch (err) {
            projectSelect.innerHTML = '';
            const option = document.createElement('option');
            option.textContent = 'Error loading projects';
            option.disabled = true;
            projectSelect.appendChild(option);
            fileList.innerHTML = '<li>Error loading folders.</li>';
        }
    }

    // Fetch files in the selected worker folder
    async function loadWorkerFiles(folderId) {
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

    // Add quick note functionality
    const quickNoteForm = document.getElementById('quick-note-form');
    const noteBodyInput = document.getElementById('note-body');
    const noteResult = document.getElementById('note-result');
    let currentProjectId = null;
    let logDocId = null;

    // Disable form until log doc is loaded
    quickNoteForm.querySelectorAll('textarea, button').forEach(el => el.disabled = true);

    // Helper to get the worker log doc id for the selected Workers folder
    async function fetchWorkerLogDocId(workersFolderId) {
        // Look for the log doc directly in the selected folder
        if (!workersFolderId) return null;
        try {
            const docRes = await fetch(`/list-project-files?folderId=${workersFolderId}`);
            const docData = await docRes.json();
            if (!docData.files || !Array.isArray(docData.files)) return null;
            const logDoc = docData.files.find(f => f.name && f.name.endsWith('log') && f.mimeType === 'application/vnd.google-apps.document');
            return logDoc ? logDoc.id : null;
        } catch {
            return null;
        }
    }

    async function enableQuickNoteFormIfReady() {
        const elements = quickNoteForm.querySelectorAll('textarea, button');
        if (logDocId) {
            elements.forEach(el => el.disabled = false);
            noteResult.textContent = '';
        } else {
            elements.forEach(el => el.disabled = true);
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

    const switchToManagerBtn = document.getElementById('switch-to-manager-btn');
    if (switchToManagerBtn) {
        switchToManagerBtn.onclick = () => {
            window.location.href = 'managerSide.html';
        };
    }

    // Camera/photo functionality
    const startCameraBtn = document.getElementById('start-camera-btn');
    const takePhotoBtn = document.getElementById('take-photo-btn');
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    const cameraStream = document.getElementById('camera-stream');
    const photoCanvas = document.getElementById('photo-canvas');
    const photoResult = document.getElementById('photo-result');
    const selectPhotoInput = document.getElementById('select-photo-input');
    let photoBlob = null;
    let stream = null;

    startCameraBtn.onclick = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                cameraStream.srcObject = stream;
                cameraStream.style.display = '';
                takePhotoBtn.style.display = '';
                startCameraBtn.style.display = 'none';
                photoResult.textContent = '';
            } catch (err) {
                photoResult.textContent = 'Camera access denied or unavailable.';
            }
        } else {
            photoResult.textContent = 'Camera not supported.';
        }
    };

    takePhotoBtn.onclick = () => {
        photoCanvas.getContext('2d').drawImage(cameraStream, 0, 0, photoCanvas.width, photoCanvas.height);
        photoCanvas.toBlob(blob => {
            photoBlob = blob;
            uploadPhotoBtn.style.display = '';
        }, 'image/jpeg');
        photoCanvas.style.display = '';
        cameraStream.style.display = 'none';
        takePhotoBtn.style.display = 'none';
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    selectPhotoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            photoBlob = file;
            photoResult.textContent = '';
            uploadPhotoBtn.style.display = '';
            cameraStream.style.display = 'none';
            photoCanvas.style.display = 'none';
            takePhotoBtn.style.display = 'none';
        }
    };

    uploadPhotoBtn.onclick = async () => {
        if (!photoBlob || !currentProjectId) {
            photoResult.textContent = 'No photo to upload or no project selected.';
            return;
        }
        photoResult.textContent = 'Uploading photo...';
        const formData = new FormData();
        formData.append('photo', photoBlob, `photo_${Date.now()}.jpg`);
        formData.append('projectId', currentProjectId);
        try {
            const res = await fetch('/upload-worker-photo', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                photoResult.textContent = 'Photo uploaded!';
                photoCanvas.style.display = 'none';
                uploadPhotoBtn.style.display = 'none';
                startCameraBtn.style.display = '';
                selectPhotoInput.value = '';
                photoBlob = null;
                loadWorkerFiles(currentProjectId);
            } else {
                photoResult.textContent = data.error || 'Failed to upload photo.';
            }
        } catch (err) {
            photoResult.textContent = 'Error uploading photo.';
        }
    };

    // Add CSRF token to all fetch POST/PUT/DELETE requests
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
        if (init && (!init.method || ['POST','PUT','DELETE'].includes(init.method.toUpperCase()))) {
            init.headers = init.headers || {};
            // Try to get CSRF token from cookie or meta tag or ask backend for it
            const csrfToken = window.localStorage.getItem('csrfToken') || document.querySelector('meta[name="csrf-token"]')?.content;
            if (csrfToken) {
                init.headers['x-csrf-token'] = csrfToken;
            }
        }
        return originalFetch(input, init);
    };
    // On login, fetch and store CSRF token
    fetch('/user').then(res => res.json()).then(data => {
        if (data.csrfToken) {
            window.localStorage.setItem('csrfToken', data.csrfToken);
        }
    });

    // Global error and unhandledrejection handlers for robust error reporting
    window.addEventListener('error', function(e) {
        alert('A critical error occurred: ' + e.message);
    });
    window.addEventListener('unhandledrejection', function(e) {
        alert('A critical error occurred: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
    });
});
