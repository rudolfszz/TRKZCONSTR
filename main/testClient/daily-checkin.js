// Daily Check-in functionality
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    const projectName = urlParams.get('name') || 'Project';
    
    let csrfToken = null;
    let spreadsheetId = null;
    let todayData = null;

    // DOM elements
    const projectTitle = document.getElementById('project-title');
    const backToDashboard = document.getElementById('back-to-dashboard');
    const logoutBtn = document.getElementById('logout-btn');
    const currentDateEl = document.getElementById('current-date');
    const loadingState = document.getElementById('loading-state');
    const checkinForm = document.getElementById('checkin-form');
    const statusMessage = document.getElementById('status-message');
    const historyView = document.getElementById('history-view');
    
    // Form elements
    const hoursWorked = document.getElementById('hours-worked');
    const tasksCompleted = document.getElementById('tasks-completed');
    const progressPercent = document.getElementById('progress-percent');
    const numberX = document.getElementById('number-x');
    const numberY = document.getElementById('number-y');
    const weather = document.getElementById('weather');
    const mood = document.getElementById('mood');
    const status = document.getElementById('status');
    const notes = document.getElementById('notes');
    
    // Action buttons
    const saveCheckinBtn = document.getElementById('save-checkin-btn');
    const viewHistoryBtn = document.getElementById('view-history-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');

    if (!projectId) {
        showError('No project ID provided');
        return;
    }

    // Set project title and back link
    projectTitle.textContent = `${decodeURIComponent(projectName)} - Daily Check-in`;
    backToDashboard.href = `/test/project-dashboard.html?projectId=${projectId}&name=${encodeURIComponent(projectName)}`;

    // Set current date
    const today = new Date();
    currentDateEl.textContent = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    // Initialize
    init();

    // Event listeners
    logoutBtn.addEventListener('click', handleLogout);
    saveCheckinBtn.addEventListener('click', handleSaveCheckin);
    viewHistoryBtn.addEventListener('click', showHistory);
    closeHistoryBtn.addEventListener('click', hideHistory);

    async function init() {
        try {
            await checkAuth();
            await loadTodayData();
            showForm();
        } catch (error) {
            console.error('Initialization failed:', error);
            showError('Failed to initialize daily check-in');
        }
    }

    async function checkAuth() {
        try {
            const response = await fetch('/user');
            const data = await response.json();
            
            if (!data.loggedIn) {
                window.location.href = '/test/index.html';
                return;
            }

            csrfToken = data.csrfToken;
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/test/index.html';
        }
    }

    async function loadTodayData() {
        try {
            const response = await fetch(`/api/get-daily-checkin?projectId=${projectId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load today\'s data');
            }

            spreadsheetId = data.spreadsheetId;
            todayData = data.todayData;

            // Populate form with today's data if it exists
            if (todayData) {
                populateForm(todayData);
            }

        } catch (error) {
            console.error('Failed to load today\'s data:', error);
            showError('Failed to load today\'s check-in data');
        }
    }

    function populateForm(data) {
        if (data.hoursWorked !== undefined) hoursWorked.value = data.hoursWorked;
        if (data.tasksCompleted !== undefined) tasksCompleted.value = data.tasksCompleted;
        if (data.progressPercent !== undefined) progressPercent.value = data.progressPercent;
        if (data.numberX !== undefined) numberX.value = data.numberX;
        if (data.numberY !== undefined) numberY.value = data.numberY;
        if (data.weather) weather.value = data.weather;
        if (data.mood) mood.value = data.mood;
        if (data.status) status.value = data.status;
        if (data.notes) notes.value = data.notes;
    }

    function showForm() {
        loadingState.style.display = 'none';
        checkinForm.style.display = 'block';
    }

    async function handleSaveCheckin() {
        try {
            saveCheckinBtn.disabled = true;
            saveCheckinBtn.textContent = '💾 Saving...';

            const checkinData = {
                projectId,
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
                hoursWorked: parseFloat(hoursWorked.value) || 0,
                tasksCompleted: parseInt(tasksCompleted.value) || 0,
                progressPercent: parseInt(progressPercent.value) || 0,
                numberX: parseInt(numberX.value) || 0,
                numberY: parseInt(numberY.value) || 0,
                weather: weather.value || '',
                mood: mood.value || '',
                status: status.value || '',
                notes: notes.value || ''
            };

            const response = await fetch('/api/save-daily-checkin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify(checkinData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save check-in');
            }

            showStatus('Check-in saved successfully! 🎉', 'success');
            todayData = checkinData; // Update local data

        } catch (error) {
            console.error('Failed to save check-in:', error);
            showStatus('Failed to save check-in. Please try again.', 'error');
        } finally {
            saveCheckinBtn.disabled = false;
            saveCheckinBtn.textContent = '💾 Save Today\'s Check-in';
        }
    }

    async function showHistory() {
        try {
            historyView.style.display = 'block';
            const historyContent = document.getElementById('history-content');
            historyContent.innerHTML = '<div class="loading">Loading history...</div>';

            const response = await fetch(`/api/get-checkin-history?projectId=${projectId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load history');
            }

            renderHistory(data.history);

        } catch (error) {
            console.error('Failed to load history:', error);
            const historyContent = document.getElementById('history-content');
            historyContent.innerHTML = '<div class="error">Failed to load history</div>';
        }
    }

    function renderHistory(history) {
        const historyContent = document.getElementById('history-content');
        
        if (!history || history.length === 0) {
            historyContent.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No check-in history found</div>';
            return;
        }

        historyContent.innerHTML = history.map(entry => `
            <div class="history-item">
                <div class="history-date">${formatDate(entry.date)}</div>
                <div class="history-data">
                    <div class="history-data-item">
                        <span class="history-data-label">Hours Worked:</span>
                        <span class="history-data-value">${entry.hoursWorked || 0}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Tasks Completed:</span>
                        <span class="history-data-value">${entry.tasksCompleted || 0}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Progress:</span>
                        <span class="history-data-value">${entry.progressPercent || 0}%</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Number X:</span>
                        <span class="history-data-value">${entry.numberX || 0}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Number Y:</span>
                        <span class="history-data-value">${entry.numberY || 0}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Weather:</span>
                        <span class="history-data-value">${entry.weather || 'N/A'}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Mood:</span>
                        <span class="history-data-value">${entry.mood || 'N/A'}</span>
                    </div>
                    <div class="history-data-item">
                        <span class="history-data-label">Status:</span>
                        <span class="history-data-value">${entry.status || 'N/A'}</span>
                    </div>
                </div>
                ${entry.notes ? `<div class="history-notes">"${entry.notes}"</div>` : ''}
            </div>
        `).join('');
    }

    function hideHistory() {
        historyView.style.display = 'none';
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    function showError(message) {
        loadingState.innerHTML = `<div class="error">${message}</div>`;
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
});
