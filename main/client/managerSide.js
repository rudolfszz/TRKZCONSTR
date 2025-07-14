document.addEventListener('DOMContentLoaded', async () => {
    const projectSelect = document.getElementById('project-select');
    const fileList = document.getElementById('file-list');

    // Helper to get projectId from URL
    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('projectId');
    }

    // Fetch all project folders (assume they are top-level folders)
    async function fetchProjects(selectedId) {
        const res = await fetch('/list-project-folders');
        const data = await res.json();
        projectSelect.innerHTML = '';
        data.folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            projectSelect.appendChild(option);
        });
        if (selectedId && data.folders.some(f => f.id === selectedId)) {
            projectSelect.value = selectedId;
            loadProjectFiles(selectedId);
        } else if (data.folders.length > 0) {
            loadProjectFiles(data.folders[0].id);
        }
    }

    // Fetch files/folders for a project
    async function loadProjectFiles(folderId) {
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

    projectSelect.addEventListener('change', e => {
        loadProjectFiles(e.target.value);
    });

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
});
