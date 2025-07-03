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

      data.structured.forEach(item => {
        const li = document.createElement('li');

        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // Create folder header as clickable toggle
          const folderHeader = document.createElement('span');
          folderHeader.style.cursor = 'pointer';
          folderHeader.textContent = '📁 ' + item.name;

          // Container for files inside folder, initially hidden
          const filesContainer = document.createElement('ul');
          filesContainer.style.display = 'none';
          filesContainer.style.paddingLeft = '1.5em';

          if (Array.isArray(item.files)) {
            item.files.forEach(file => {
              const fileLi = document.createElement('li');
              const fileLink = document.createElement('a');
              fileLink.textContent = `📄 ${file.name}`;
              fileLink.target = '_blank';
              fileLink.rel = 'noopener noreferrer';
              fileLink.href = `https://drive.google.com/file/d/${file.id}/view`;
              fileLi.appendChild(fileLink);
              filesContainer.appendChild(fileLi);
            });
          }

          // Toggle files on folder header click
          folderHeader.addEventListener('click', () => {
            filesContainer.style.display = filesContainer.style.display === 'none' ? 'block' : 'none';
          });

          li.appendChild(folderHeader);
          li.appendChild(filesContainer);
        } else {
          // Regular file link
          const link = document.createElement('a');
          link.textContent = '📄 ' + item.name;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.href = `https://drive.google.com/file/d/${item.id}/view`;
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
});
