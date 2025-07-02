const createFileButton = document.getElementById("create_file_button");
createFileButton.addEventListener("click", (event) => createNewFile(event));

const logInWithGoogleButton = document.getElementById("log_in_with_google_button");
logInWithGoogleButton.addEventListener("click", () => {
  location.href = "http://localhost:3001/login"
})


async function createNewFile(event) {
  event.preventDefault();
  const folderName = document.getElementById("project_name_input").value;

  const response = await fetch("http://localhost:3001/create-folder", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName }),
    credentials: 'include',
  });

  const data = await response.json();
  if (response.ok) {
    alert('FOLDER created! ID: ' + data.folderId);
  } else {
    alert('Error: ' + (data.error || 'Unknown'));
  }
}