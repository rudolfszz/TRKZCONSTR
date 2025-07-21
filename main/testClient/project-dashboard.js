// Project Dashboard - Todo List functionality
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    const projectName = urlParams.get('name') || 'Project Dashboard';
    
    let todos = [];
    let csrfToken = null;
    let spreadsheetId = null;

    // DOM elements
    const projectTitle = document.getElementById('project-title');
    const logoutBtn = document.getElementById('logout-btn');
    const addTodoBtn = document.getElementById('add-todo-btn');
    const addTodoForm = document.getElementById('add-todo-form');
    const saveTodoBtn = document.getElementById('save-todo-btn');
    const cancelTodoBtn = document.getElementById('cancel-todo-btn');
    const todoList = document.getElementById('todo-list');
    const todoTaskInput = document.getElementById('todo-task');
    const todoDueInput = document.getElementById('todo-due');

    // Daily check-in elements
    const checkinDate = document.getElementById('checkin-date');
    const hoursInput = document.getElementById('hours-input');
    const tasksInput = document.getElementById('tasks-input');
    const progressInput = document.getElementById('progress-input');
    const numberxInput = document.getElementById('numberx-input');
    const saveIndicator = document.getElementById('save-indicator');

    // Stats elements
    const totalTodosEl = document.getElementById('total-todos');
    const completedTodosEl = document.getElementById('completed-todos');
    const pendingTodosEl = document.getElementById('pending-todos');
    const completionRateEl = document.getElementById('completion-rate');

    if (!projectId) {
        alert('No project ID provided');
        window.location.href = '/test/create-project.html';
        return;
    }

    // Set project title
    projectTitle.textContent = decodeURIComponent(projectName);
    
    // Set today's date for check-in
    const today = new Date();
    checkinDate.textContent = today.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });

    // Initialize
    init();

    // Event listeners
    logoutBtn.addEventListener('click', handleLogout);
    addTodoBtn.addEventListener('click', showAddTodoForm);
    saveTodoBtn.addEventListener('click', handleSaveTodo);
    cancelTodoBtn.addEventListener('click', hideAddTodoForm);
    
    // Auto-save event listeners for check-in inputs
    hoursInput.addEventListener('input', debounceAutoSave);
    tasksInput.addEventListener('input', debounceAutoSave);
    progressInput.addEventListener('input', debounceAutoSave);
    numberxInput.addEventListener('input', debounceAutoSave);

    async function init() {
        try {
            await checkAuth();
            await loadTodos();
            await loadTodayCheckin();
        } catch (error) {
            console.error('Initialization failed:', error);
            showError('Failed to initialize dashboard');
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
            console.log('CSRF token retrieved:', csrfToken ? 'Yes' : 'No');
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/test/index.html';
        }
    }

    async function loadTodos() {
        try {
            showLoading('Loading tasks...');
            
            const response = await fetch(`/api/get-todos?projectId=${projectId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load todos');
            }

            todos = data.todos || [];
            spreadsheetId = data.spreadsheetId;
            renderTodos();
            updateStats();

        } catch (error) {
            console.error('Failed to load todos:', error);
            showError('Failed to load tasks. Please try again.');
        }
    }

    function renderTodos() {
        if (todos.length === 0) {
            todoList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>No tasks yet</h3>
                    <p>Click "Add Task" to create your first todo item.</p>
                </div>
            `;
            return;
        }

        todoList.innerHTML = todos.map((todo, index) => `
            <div class="todo-item" data-index="${index}">
                <input type="checkbox" class="todo-checkbox" 
                       ${todo.completed ? 'checked' : ''} 
                       onchange="toggleTodo(${index})">
                <div class="todo-content-item">
                    <div class="todo-task ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.task)}</div>
                    <div class="todo-date">Due: ${todo.dueDate}</div>
                </div>
                <div class="todo-actions">
                    <button class="todo-btn edit" onclick="editTodo(${index})">Edit</button>
                    <button class="todo-btn delete" onclick="deleteTodo(${index})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    function updateStats() {
        const total = todos.length;
        const completed = todos.filter(todo => todo.completed).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Add visual feedback animation
        const statItems = document.querySelectorAll('.stat-item');
        statItems.forEach(item => {
            item.classList.add('updated');
            setTimeout(() => item.classList.remove('updated'), 300);
        });

        // Update values with smooth animation
        animateCounterTo(totalTodosEl, total);
        animateCounterTo(completedTodosEl, completed);
        animateCounterTo(pendingTodosEl, pending);
        
        // Update completion rate
        completionRateEl.textContent = `${completionRate}%`;
    }

    function animateCounterTo(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const increment = targetValue > currentValue ? 1 : -1;
        const duration = 300; // ms
        const steps = Math.abs(targetValue - currentValue);
        const stepDuration = steps > 0 ? duration / steps : 0;

        if (steps === 0) return;

        let currentStep = 0;
        const timer = setInterval(() => {
            currentStep++;
            const newValue = currentValue + (increment * currentStep);
            element.textContent = newValue;
            
            if (currentStep >= steps) {
                clearInterval(timer);
                element.textContent = targetValue; // Ensure final value is exact
            }
        }, stepDuration);
    }

    function showAddTodoForm() {
        addTodoForm.classList.add('show');
        todoTaskInput.focus();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        todoDueInput.value = today;
    }

    function hideAddTodoForm() {
        addTodoForm.classList.remove('show');
        todoTaskInput.value = '';
        todoDueInput.value = '';
    }

    async function handleSaveTodo() {
        const task = todoTaskInput.value.trim();
        const dueDate = todoDueInput.value;

        if (!task || !dueDate) {
            alert('Please fill in all fields');
            return;
        }

        try {
            saveTodoBtn.disabled = true;
            saveTodoBtn.textContent = 'Saving...';

            const response = await fetch('/api/add-todo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    projectId,
                    task,
                    dueDate
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to add task');
            }

            // Add to local array
            todos.push({
                task,
                dueDate,
                completed: false
            });

            hideAddTodoForm();
            renderTodos();
            updateStats(); // Instant stats update

        } catch (error) {
            console.error('Failed to save todo:', error);
            alert('Failed to save task. Please try again.');
        } finally {
            saveTodoBtn.disabled = false;
            saveTodoBtn.textContent = 'Save Task';
        }
    }

    // Global functions for inline event handlers
    window.toggleTodo = async function(index) {
        try {
            const todo = todos[index];
            const newStatus = !todo.completed;

            // Update UI immediately for instant feedback
            todos[index].completed = newStatus;
            updateStats();
            renderTodos();

            const response = await fetch('/api/update-todo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    projectId,
                    rowIndex: index + 2, // +2 because row 1 is header, array is 0-indexed
                    completed: newStatus
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update task');
            }

        } catch (error) {
            console.error('Failed to toggle todo:', error);
            // Revert changes on error
            todos[index].completed = !todos[index].completed;
            updateStats();
            renderTodos();
            alert('Failed to update task. Please try again.');
        }
    };

    window.editTodo = function(index) {
        const todo = todos[index];
        const newTask = prompt('Edit task:', todo.task);
        
        if (newTask && newTask.trim() && newTask.trim() !== todo.task) {
            updateTodoTask(index, newTask.trim());
        }
    };

    window.deleteTodo = async function(index) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const response = await fetch('/api/delete-todo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    projectId,
                    rowIndex: index + 2 // +2 because row 1 is header, array is 0-indexed
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete task');
            }

            // Remove from local array
            todos.splice(index, 1);
            updateStats(); // Instant stats update
            renderTodos();

        } catch (error) {
            console.error('Failed to delete todo:', error);
            alert('Failed to delete task. Please try again.');
        }
    };

    async function updateTodoTask(index, newTask) {
        try {
            const response = await fetch('/api/update-todo-task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    projectId,
                    rowIndex: index + 2, // +2 because row 1 is header, array is 0-indexed
                    task: newTask
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update task');
            }

            // Update local state
            todos[index].task = newTask;
            renderTodos();

        } catch (error) {
            console.error('Failed to update todo task:', error);
            alert('Failed to update task. Please try again.');
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

    function showLoading(message = 'Loading...') {
        todoList.innerHTML = `<div class="loading">${message}</div>`;
    }

    function showError(message) {
        todoList.innerHTML = `<div class="error">${message}</div>`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Daily Check-in Functions
    let autoSaveTimeout = null;
    
    function debounceAutoSave() {
        // Clear existing timeout
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        
        // Show saving indicator immediately
        showSaveIndicator('saving');
        
        // Set new timeout for auto-save after 1 second of no input
        autoSaveTimeout = setTimeout(() => {
            handleAutoSaveCheckin();
        }, 1000);
    }

    async function loadTodayCheckin() {
        try {
            const response = await fetch(`/api/get-daily-checkin?projectId=${projectId}`);
            const data = await response.json();
            
            if (response.ok && data.todayData) {
                // Populate the form with today's existing data
                hoursInput.value = data.todayData.hoursWorked || '';
                tasksInput.value = data.todayData.tasksCompleted || '';
                progressInput.value = data.todayData.progressPercent || '';
                numberxInput.value = data.todayData.numberX || '';
            }
        } catch (error) {
            console.error('Failed to load today\'s check-in:', error);
        }
    }

    async function handleAutoSaveCheckin() {
        try {
            const checkinData = {
                projectId,
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
                hoursWorked: parseFloat(hoursInput.value) || 0,
                tasksCompleted: parseInt(tasksInput.value) || 0,
                progressPercent: parseInt(progressInput.value) || 0,
                numberX: parseInt(numberxInput.value) || 0,
                numberY: 0, // Not used in compact version
                weather: '',
                mood: '',
                notes: '',
                status: ''
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

            showSaveIndicator('saved');

        } catch (error) {
            console.error('Failed to auto-save check-in:', error);
            showSaveIndicator('error');
        }
    }

    function showSaveIndicator(state) {
        saveIndicator.className = `save-indicator show ${state}`;
        
        // Auto-hide after 2 seconds for saved/error states
        if (state === 'saved' || state === 'error') {
            setTimeout(() => {
                saveIndicator.className = 'save-indicator';
            }, 2000);
        }
    }
});
