// Project creation functionality
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('project-form');
    const createBtn = document.getElementById('create-btn');
    const loading = document.getElementById('loading');
    const success = document.getElementById('success');
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const userInfo = document.getElementById('user-info');
    const logoutBtn = document.getElementById('logout-btn');
    const viewProjectBtn = document.getElementById('view-project-btn');

    let currentProjectId = null;
    let csrfToken = null;

    // Check authentication and load user info
    checkAuthAndLoadUser();

    form.addEventListener('submit', handleProjectCreation);
    logoutBtn.addEventListener('click', handleLogout);
    viewProjectBtn.addEventListener('click', viewProject);

    async function checkAuthAndLoadUser() {
        try {
            const response = await fetch('/user');
            const data = await response.json();
            
            if (!data.loggedIn) {
                // Redirect to login if not authenticated
                window.location.href = '/test/index.html';
                return;
            }

            // Store the CSRF token for later use
            csrfToken = data.csrfToken;
            console.log('CSRF token retrieved:', csrfToken ? 'Yes' : 'No');

            // Display user information
            document.getElementById('user-name').textContent = data.name || 'User';
            document.getElementById('user-email').textContent = data.email || '';
            document.getElementById('user-avatar').src = data.picture || '';
            userInfo.classList.remove('hidden');

        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/test/index.html';
        }
    }

    async function handleProjectCreation(e) {
        e.preventDefault();
        
        const projectName = document.getElementById('project-name').value.trim();
        const projectDescription = document.getElementById('project-description').value.trim();

        if (!projectName) {
            showError('Project name is required');
            return;
        }

        if (!csrfToken) {
            showError('Security token not available. Please refresh the page.');
            return;
        }

        try {
            showLoading();
            hideError();

            // Create the project
            const response = await fetch('/api/create-project-workspace', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    name: projectName,
                    description: projectDescription
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create project');
            }

            currentProjectId = result.projectId;
            showSuccess();
            hideLoading();

        } catch (error) {
            console.error('Project creation error:', error);
            showError(error.message);
            hideLoading();
        }
    }

    async function handleLogout() {
        try {
            await fetch('/logout', { 
                method: 'POST',
                headers: {
                    'x-csrf-token': csrfToken
                }
            });
            window.location.href = '/test/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/test/index.html';
        }
    }

    function viewProject() {
        if (currentProjectId) {
            window.location.href = `/test/project-dashboard.html?projectId=${currentProjectId}`;
        }
    }

    function showLoading() {
        loading.classList.remove('hidden');
        form.style.display = 'none';
        createBtn.disabled = true;
    }

    function hideLoading() {
        loading.classList.add('hidden');
        form.style.display = 'block';
        createBtn.disabled = false;
    }

    function showSuccess() {
        success.classList.remove('hidden');
        form.style.display = 'none';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }
});
