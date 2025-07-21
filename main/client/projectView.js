import { initializeCommonFeatures } from './utils.js';

class ProjectDashboard {
    constructor() {
        this.currentProjectId = null;
        this.refreshInterval = 30000; // 30 seconds
        this.intervals = [];
        this.emailsPageToken = null;
        this.loadingMoreEmails = false;
        this.init();
    }

    async init() {
        console.log('🎯 ProjectDashboard init called');
        // Initialize common features
        initializeCommonFeatures();
        
        // Check authentication
        await this.checkAuth();
        
        // Get current project ID from URL params or storage
        this.currentProjectId = this.getCurrentProjectId();
        console.log('📁 Current project ID:', this.currentProjectId);
        
        // Initialize all dashboard sections
        console.log('🔄 Initializing dashboard...');
        await this.initializeDashboard();
        
        // Set up periodic refresh
        this.setupAutoRefresh();
        
        // Set up event handlers
        this.setupEventHandlers();
        console.log('✅ ProjectDashboard initialized');
    }

    async checkAuth() {
        try {
            const response = await fetch('/user');
            const data = await response.json();
            if (!data.loggedIn) {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = 'login.html';
        }
    }

    getCurrentProjectId() {
        // Try to get project ID from URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');
        
        if (projectId) {
            localStorage.setItem('currentProjectId', projectId);
            return projectId;
        }
        
        // Fall back to localStorage
        return localStorage.getItem('currentProjectId') || 'default';
    }

    async initializeDashboard() {
        await Promise.all([
            this.loadCalendarEvents(),
            this.loadEmails(),
            this.loadRecentEntries(),
            this.loadTodoList(),
            this.loadQuickActions(),
            this.loadCalendarOverview(),
            this.setupNotesSection()
        ]);
    }

    async loadCalendarEvents() {
        const calendarSection = document.getElementById('calendar-section');
        const calendarEvents = document.getElementById('calendar-events');
        
        try {
            // Get today's date range
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const start = today.toISOString().split('T')[0] + 'T00:00:00.000Z';
            const end = tomorrow.toISOString().split('T')[0] + 'T00:00:00.000Z';
            
            const response = await fetch(`/api/calendar-events?start=${start}&end=${end}`);
            const data = await response.json();
            
            if (data.events && data.events.length > 0) {
                calendarEvents.innerHTML = data.events.map(event => `
                    <div class="event-item">
                        <div class="event-title">${event.summary || 'No title'}</div>
                        <div class="event-time">${this.formatTime(event.start)} - ${this.formatTime(event.end)}</div>
                        ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                    </div>
                `).join('');
                calendarEvents.style.display = 'block';
            } else {
                calendarEvents.innerHTML = '<div class="no-events">No events today</div>';
                calendarEvents.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading calendar events:', error);
            calendarEvents.innerHTML = '<div class="error">Error loading events</div>';
            calendarEvents.style.display = 'block';
        }
    }

    async loadEmails() {
        const emailsSection = document.getElementById('emails-section');
        const emailsContent = document.getElementById('emails-content');
        emailsContent.innerHTML = '<div class="loading">Loading emails...</div>';
        emailsSection.style.display = 'block';
        this.emailsPageToken = null;
        this.loadingMoreEmails = false;
        try {
            // Use correct endpoint for manager emails
            const response = await fetch('/api/manager-inbox-emails?maxResults=50');
            if (!response.ok) throw new Error('Failed to fetch emails');
            const data = await response.json();
            if (!data.emails || data.emails.length === 0) {
                emailsContent.innerHTML = '<div class="no-emails">No recent emails found.</div>';
                return;
            }
            emailsContent.innerHTML = '';
            data.emails.forEach(email => {
                const div = document.createElement('div');
                div.className = 'email-item';
                div.tabIndex = 0;
                div.innerHTML = `
                    <div class="email-from"><b>From:</b> ${email.from}</div>
                    <div class="email-subject"><b>Subject:</b> ${email.subject}</div>
                    <div class="email-date">${new Date(email.date).toLocaleString()}</div>
                `;
                div.addEventListener('click', () => {
                    if (email.id) {
                        window.open(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, '_blank');
                    }
                });
                emailsContent.appendChild(div);
            });
        } catch (err) {
            emailsContent.innerHTML = `<div class="error">Error loading emails: ${err.message}</div>`;
        }
    }
    
    async loadMoreEmails() {
        if (!this.emailsPageToken || this.loadingMoreEmails) return;
        
        this.loadingMoreEmails = true;
        const emailsContent = document.getElementById('emails-content');
        const loadMoreBtn = document.getElementById('load-more-emails');
        
        if (loadMoreBtn) {
            loadMoreBtn.textContent = 'Loading...';
            loadMoreBtn.disabled = true;
        }
        
        try {
            const response = await fetch(`/api/manager-inbox-emails?maxResults=25&pageToken=${this.emailsPageToken}`);
            const data = await response.json();
            
            if (data.emails && data.emails.length > 0) {
                // Update pagination token
                this.emailsPageToken = data.nextPageToken;
                
                // Create new email items
                const emailItems = data.emails.map(email => {
                    const fromEmail = this.extractEmailAddress(email.from);
                    const fromName = this.extractEmailName(email.from);
                    const formattedDate = this.formatEmailDate(email.date);
                    
                    return `
                        <div class="email-item" onclick="dashboard.toggleEmailDetails(this)" data-email-id="${email.id}">
                            <div class="email-sender">${fromName} &lt;${fromEmail}&gt;</div>
                            <div class="email-subject">${email.subject || 'No subject'}</div>
                            <div class="email-date">${formattedDate}</div>
                            <div class="email-snippet" style="display: none;">
                                Click to view full email details
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Remove load more button temporarily
                if (loadMoreBtn) {
                    loadMoreBtn.parentElement.remove();
                }
                
                // Add new emails
                emailsContent.innerHTML += emailItems;
                
                // Add load more button again if there are more emails
                if (this.emailsPageToken) {
                    emailsContent.innerHTML += `
                        <div class="load-more-container">
                            <button id="load-more-emails" onclick="dashboard.loadMoreEmails()">
                                Load More Emails
                            </button>
                        </div>
                    `;
                }
            }
            
        } catch (error) {
            console.error('Error loading more emails:', error);
            if (loadMoreBtn) {
                loadMoreBtn.textContent = 'Error loading more';
                loadMoreBtn.disabled = false;
            }
        }
        
        this.loadingMoreEmails = false;
    }
    
    toggleEmailDetails(emailElement) {
        const snippet = emailElement.querySelector('.email-snippet');
        const isVisible = snippet.style.display !== 'none';
        
        if (isVisible) {
            snippet.style.display = 'none';
            emailElement.style.backgroundColor = '#666';
        } else {
            snippet.style.display = 'block';
            emailElement.style.backgroundColor = '#777';
            
            // If snippet is empty, try to load more details
            if (snippet.textContent.trim() === 'Click to view full email details') {
                snippet.innerHTML = `
                    <div style="margin-top: 5px; padding: 5px; background-color: #555; border-radius: 3px;">
                        <strong>From:</strong> ${emailElement.querySelector('.email-sender').textContent}<br>
                        <strong>Subject:</strong> ${emailElement.querySelector('.email-subject').textContent}<br>
                        <strong>Date:</strong> ${emailElement.querySelector('.email-date').textContent}<br>
                        <em>Full email content would be loaded here...</em>
                    </div>
                `;
            }
        }
    }
    
    extractEmailAddress(fromField) {
        if (!fromField) return 'Unknown';
        const match = fromField.match(/<([^>]+)>/);
        return match ? match[1] : fromField;
    }
    
    extractEmailName(fromField) {
        if (!fromField) return 'Unknown';
        const match = fromField.match(/^([^<]+)</);
        return match ? match[1].trim() : fromField.split('@')[0];
    }
    
    formatEmailDate(dateString) {
        if (!dateString) return 'Unknown date';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days === 0) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (days === 1) {
                return 'Yesterday';
            } else if (days < 7) {
                return `${days} days ago`;
            } else {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        } catch (error) {
            return 'Unknown date';
        }
    }

    async loadRecentEntries() {
        const recentSection = document.getElementById('recent-section');
        const recentContent = document.getElementById('recent-content');
        
        try {
            const response = await fetch(`/api/recent-entries?projectId=${this.currentProjectId}`);
            const data = await response.json();
            
            if (data.entries && data.entries.length > 0) {
                recentContent.innerHTML = data.entries.slice(0, 8).map(entry => `
                    <div class="entry-item">
                        <div class="entry-worker">${entry.worker || 'Worker'}</div>
                        <div class="entry-content">${entry.note || 'No content'}</div>
                        <div class="entry-date">${this.formatDate(new Date().toISOString())}</div>
                    </div>
                `).join('');
                recentContent.style.display = 'block';
            } else {
                recentContent.innerHTML = '<div class="no-entries">No recent entries</div>';
                recentContent.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading recent entries:', error);
            recentContent.innerHTML = '<div class="error">Error loading entries</div>';
            recentContent.style.display = 'block';
        }
    }

    async loadTodoList() {
        const todoSection = document.getElementById('todo-section');
        const todoContent = document.getElementById('todo-content');
        
        // Load from localStorage for now
        const todos = JSON.parse(localStorage.getItem('managerTodos') || '[]');
        
        if (todos.length > 0) {
            todoContent.innerHTML = `
                <div class="todo-list">
                    ${todos.slice(0, 6).map((todo, index) => `
                        <div class="todo-item ${todo.completed ? 'completed' : ''}">
                            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="dashboard.toggleTodo(${index})">
                            <span>${todo.text}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="todo-input">
                    <input type="text" id="new-todo" placeholder="Add new task..." onkeypress="dashboard.handleTodoKeyPress(event)">
                    <button onclick="dashboard.addTodo()">+</button>
                </div>
            `;
            todoContent.style.display = 'block';
        } else {
            todoContent.innerHTML = `
                <div class="todo-input">
                    <input type="text" id="new-todo" placeholder="Add new task..." onkeypress="dashboard.handleTodoKeyPress(event)">
                    <button onclick="dashboard.addTodo()">+</button>
                </div>
            `;
            todoContent.style.display = 'block';
        }
    }

    async loadQuickActions() {
        const othersSection = document.getElementById('others-section');
        const othersContent = document.getElementById('others-content');
        
        othersContent.innerHTML = `
            <button onclick="dashboard.createProject()">New Project</button>
            <button onclick="dashboard.viewProjects()">View Projects</button>
            <button onclick="dashboard.addCalendarEvent()">Add Event</button>
            <button onclick="dashboard.refreshDashboard()">Refresh</button>
        `;
        othersContent.style.display = 'block';
    }

    async loadCalendarOverview() {
        const randomSection = document.getElementById('random-section');
        const randomContent = document.getElementById('random-content');
        
        try {
            const response = await fetch('/api/calendar-list');
            const data = await response.json();
            
            if (data.calendars && data.calendars.length > 0) {
                randomContent.innerHTML = `
                    <div class="calendar-overview">
                        ${data.calendars.slice(0, 4).map(calendar => `
                            <div class="calendar-item">
                                <div class="calendar-name">${calendar.summary}</div>
                                <div class="calendar-primary">${calendar.primary ? 'Primary' : 'Secondary'}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
                randomContent.style.display = 'block';
            } else {
                randomContent.innerHTML = '<div class="no-calendars">No calendars available</div>';
                randomContent.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading calendar overview:', error);
            randomContent.innerHTML = '<div class="error">Error loading calendars</div>';
            randomContent.style.display = 'block';
        }
    }

    setupNotesSection() {
        const notesSection = document.getElementById('notes-section');
        const notesInput = document.getElementById('notes-input');
        const saveBtn = document.getElementById('save-notes-btn');
        
        // Load existing notes
        const savedNotes = localStorage.getItem('managerNotes') || '';
        notesInput.value = savedNotes;
        
        // Auto-save every 5 seconds
        setInterval(() => {
            localStorage.setItem('managerNotes', notesInput.value);
        }, 5000);
        
        notesInput.style.display = 'block';
    }

    setupEventHandlers() {
        document.getElementById('save-notes-btn').addEventListener('click', () => {
            this.saveNotes();
        });
    }

    async saveNotes() {
        const notesInput = document.getElementById('notes-input');
        const notes = notesInput.value.trim();
        
        if (!notes) return;
        
        try {
            // Save to localStorage as backup
            localStorage.setItem('managerNotes', notes);
            
            // Save to Google Drive/Docs API
            const response = await fetch('/api/manager-notepad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    projectId: this.currentProjectId, 
                    note: notes 
                })
            });
            
            const result = await response.json();
            
            // Visual feedback
            const btn = document.getElementById('save-notes-btn');
            const originalText = btn.textContent;
            
            if (result.success) {
                btn.textContent = 'Saved!';
                btn.style.backgroundColor = '#28a745';
            } else {
                btn.textContent = 'Error!';
                btn.style.backgroundColor = '#dc3545';
            }
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '';
            }, 2000);
            
        } catch (error) {
            console.error('Error saving notes:', error);
            
            // Visual feedback for error
            const btn = document.getElementById('save-notes-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Error!';
            btn.style.backgroundColor = '#dc3545';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '';
            }, 2000);
        }
    }

    // Todo functionality
    addTodo() {
        const input = document.getElementById('new-todo');
        const text = input.value.trim();
        
        if (!text) return;
        
        const todos = JSON.parse(localStorage.getItem('managerTodos') || '[]');
        todos.unshift({ text, completed: false, date: new Date().toISOString() });
        localStorage.setItem('managerTodos', JSON.stringify(todos));
        
        input.value = '';
        this.loadTodoList();
    }

    toggleTodo(index) {
        const todos = JSON.parse(localStorage.getItem('managerTodos') || '[]');
        todos[index].completed = !todos[index].completed;
        localStorage.setItem('managerTodos', JSON.stringify(todos));
        this.loadTodoList();
    }

    handleTodoKeyPress(event) {
        if (event.key === 'Enter') {
            this.addTodo();
        }
    }

    // Quick actions
    createProject() {
        window.location.href = 'project.html';
    }

    viewProjects() {
        window.location.href = 'project.html';
    }

    addCalendarEvent() {
        // Simple prompt for quick event creation
        const summary = prompt('Event title:');
        if (!summary) return;
        
        const date = prompt('Date (YYYY-MM-DD):') || new Date().toISOString().split('T')[0];
        const time = prompt('Time (HH:MM):') || '09:00';
        
        const startDateTime = `${date}T${time}:00`;
        const endDateTime = `${date}T${time.split(':')[0]}:${(parseInt(time.split(':')[1]) + 60).toString().padStart(2, '0')}:00`;
        
        fetch('/api/calendar-add-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                summary,
                start: { dateTime: startDateTime },
                end: { dateTime: endDateTime }
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Event created successfully!');
                this.loadCalendarEvents();
            } else {
                alert('Failed to create event');
            }
        })
        .catch(error => {
            console.error('Error creating event:', error);
            alert('Failed to create event');
        });
    }

    refreshDashboard() {
        this.initializeDashboard();
    }

    setupAutoRefresh() {
        // Refresh calendar events every 30 seconds
        this.intervals.push(setInterval(() => {
            this.loadCalendarEvents();
        }, this.refreshInterval));
        
        // Refresh emails every 2 minutes
        this.intervals.push(setInterval(() => {
            this.loadEmails();
        }, this.refreshInterval * 4));
        
        // Refresh recent entries every minute
        this.intervals.push(setInterval(() => {
            this.loadRecentEntries();
        }, this.refreshInterval * 2));
    }

    // Utility functions
    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    destroy() {
        // Clean up intervals
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, initializing ProjectDashboard...');
    window.dashboard = new ProjectDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});

// Error handling
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
