document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('project_form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Form submit triggered!');  // <-- check if this appears
    const folderName = document.getElementById('project_name_input').value;

    const response = await fetch('http://localhost:3001/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName }),
      credentials: 'include',
    });

    const data = await response.json();
    if (response.ok) {
      alert('Folder created! ID: ' + data.folderId);
    } else {
      alert('Error: ' + (data.error || 'Unknown'));
    }
  });
});