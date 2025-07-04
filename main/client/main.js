document.addEventListener("DOMContentLoaded", async () => {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const listFilesBtn = document.getElementById("list-files-btn");
  const embedBtn = document.getElementById("embed-btn");
  const askBtn = document.getElementById("ask-btn");
  const fileList = document.getElementById("file-list");
  const questionInput = document.getElementById("question");
  const answerBox = document.getElementById("answer");
  const mainSection = document.getElementById("main-section");
  const addFolderForm = document.getElementById("add-Folder-Form");
  const folderNameInput = document.getElementById("folder-Name");
  const folderSelect = document.getElementById('folder-select');
  const createFileForm = document.getElementById('create-file-form');

  // Check auth status
  const userStatus = await fetch("/user").then(res => res.json());
  if (userStatus.loggedIn) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    mainSection.style.display = "block";
  }

  loginBtn.onclick = () => {
    window.location.href = "/login";
  };

  logoutBtn.onclick = () => {
    window.location.href = "/logout";
  };

  listFilesBtn.onclick = async () => {
    fileList.innerHTML = '';

    try {
      const res = await fetch('/drive-files');
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data.structured)) {
        throw new Error('Invalid response: missing "structured" array');
      }

      function getEditorUrl(mimeType, fileId) {
        switch (mimeType) {
          case 'application/vnd.google-apps.document':
            return `https://docs.google.com/document/d/${fileId}/edit`;
          case 'application/vnd.google-apps.spreadsheet':
            return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
          case 'application/vnd.google-apps.presentation':
            return `https://docs.google.com/presentation/d/${fileId}/edit`;
          case 'application/vnd.google-apps.drawing':
            return `https://docs.google.com/drawings/d/${fileId}/edit`;
          case 'application/vnd.google-apps.form':
            return `https://docs.google.com/forms/d/${fileId}/edit`;
          default:
            return `https://drive.google.com/file/d/${fileId}/view`;
        }
      }

      data.structured.forEach(item => {
        const li = document.createElement('li');

        if (item.mimeType === 'application/vnd.google-apps.folder') {
          const folderToggle = document.createElement('button');
          folderToggle.className = 'folder-toggle';
          folderToggle.setAttribute('aria-expanded', 'false');
          folderToggle.innerHTML = '▶ 📁 ' + item.name;

          const filesContainer = document.createElement('ul');
          filesContainer.style.display = 'none';
          filesContainer.style.paddingLeft = '1.5em';
          filesContainer.setAttribute('role', 'group');

          if (Array.isArray(item.files)) {
            item.files.forEach(file => {
              const fileLi = document.createElement('li');
              const fileLink = document.createElement('a');
              fileLink.textContent = `📄 ${file.name}`;
              fileLink.target = '_blank';
              fileLink.rel = 'noopener noreferrer';
              fileLink.href = getEditorUrl(file.mimeType, file.id);
              fileLi.appendChild(fileLink);
              filesContainer.appendChild(fileLi);
            });
          }

          folderToggle.addEventListener('click', () => {
            const expanded = filesContainer.style.display === 'block';
            filesContainer.style.display = expanded ? 'none' : 'block';
            folderToggle.setAttribute('aria-expanded', String(!expanded));
            folderToggle.innerHTML = (expanded ? '▶' : '▼') + ' 📁 ' + item.name;
          });

          li.appendChild(folderToggle);
          li.appendChild(filesContainer);
        } else {
          const link = document.createElement('a');
          link.textContent = '📄 ' + item.name;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.href = getEditorUrl(item.mimeType, item.id);
          li.appendChild(link);
        }

        fileList.appendChild(li);
      });
    } catch (error) {
      console.error('Failed to fetch or render files:', error);
      fileList.innerHTML = `<li style="color: red;">Failed to load files. See console for details.</li>`;
    }
  };



  askBtn.onclick = async () => {
    const question = questionInput.value;
    const res = await fetch("/ask-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    answerBox.textContent = data.answer;
  };

  addFolderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newFolderName = folderNameInput.value.trim();
    if (!newFolderName) {
      alert('Folder name cannot be empty');
      return;
    }

    try {
      const res = await fetch('/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();
      alert(`Folder created with ID: ${data.folderId}`);
      folderNameInput.value = '';
      listFilesBtn.onclick(); // Refresh file list
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. See console for details.');
    }
  });

  document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return alert('Please enter a search term.');

    try {
      const res = await fetch(`/search-drive-files?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);

      const data = await res.json();
      const resultsContainer = document.getElementById('search-results');
      resultsContainer.innerHTML = '';

      data.files.forEach(file => {
        const item = document.createElement('li');
        item.textContent = `${file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'} ${file.name}`;
        resultsContainer.appendChild(item);
      });
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. See console for details.');
    }
  });


  async function populateFolderSelect() {
    folderSelect.innerHTML = '<option value="" disabled selected>Select folder</option>';

    try {
      const res = await fetch('/drive-files');
      if (!res.ok) throw new Error(`Failed to fetch folders: ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data.structured)) throw new Error('Invalid response: missing "structured" array');

      // Filter folders only
      const folders = data.structured.filter(item => item.mimeType === 'application/vnd.google-apps.folder');

      folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        folderSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error populating folders dropdown:', err);
    }
  }

  // Call once after login to populate folders dropdown
  if (userStatus.loggedIn) {
    populateFolderSelect();
  }

  // Also refresh folder list after creating a folder
  addFolderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newFolderName = folderNameInput.value.trim();
    if (!newFolderName) {
      alert('Folder name cannot be empty');
      return;
    }

    try {
      const res = await fetch('/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();
      alert(`Folder created with ID: ${data.folderId}`);
      folderNameInput.value = '';
      listFilesBtn.onclick(); // Refresh file list
      await populateFolderSelect(); // Refresh folder dropdown
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. See console for details.');
    }
  });

  // Handle file creation form submission
  createFileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const folderId = folderSelect.value;
    const fileType = document.getElementById('file-type-select').value;

    if (!folderId || !fileType) {
      alert('Please select both folder and file type.');
      return;
    }

    try {
      const res = await fetch('/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, fileType }),
      });

      if (!res.ok) throw new Error(`Create file failed: ${res.status}`);

      const data = await res.json();

      // Redirect to new file's Google editor URL
      window.open(data.fileUrl, '_blank');

    } catch (error) {
      console.error('Failed to create file:', error);
      alert('Failed to create file. See console for details.');
    }
  });


});
