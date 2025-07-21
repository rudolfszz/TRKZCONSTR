// Route to get projectId -> calendarId mapping
import { getProjectCalendarMap } from '../controllers/googleController.js';
import { createCalendar, deleteCalendar } from '../controllers/googleController.js';
import express from 'express';
import { createProjectFolder, listProjectFolders, listProjectFiles, 
    getWorkerFolderId, shareWorkerFolder, listAccessibleWorkerFolders, 
    addWorkerNote, uploadWorkerPhoto, getRecentEmails, getRecentEntries, 
    addFileToProject, addManagerNote, getManagerInboxEmails, 
    getCalendarEvents, addCalendarEvent, getCalendarList, createProjectWorkspace,
    getTodos, addTodo, updateTodo, updateTodoTask, deleteTodo,
    getDailyCheckin, saveDailyCheckin, getCheckinHistory } from '../controllers/googleController.js';
import { getDriveClient } from '../services/googleService.js';
import multer from 'multer';

const router = express.Router();
const upload = multer();

router.get('/api/project-calendar-map', getProjectCalendarMap);

// Create a new Google Calendar
router.post('/api/create-calendar', createCalendar);

// Delete a Google Calendar
router.post('/api/delete-calendar', deleteCalendar);

// List user's calendars
router.get('/api/calendar-list', getCalendarList);

// Get recent emails from manager's Gmail inbox
router.get('/api/manager-inbox-emails', getManagerInboxEmails);

// Get Google Calendar events for a date range
router.get('/api/calendar-events', getCalendarEvents);

// Add a Google Calendar event for the authenticated user
router.post('/api/calendar-add-event', addCalendarEvent);

// Middleware to require projectId in query or body
function requireProjectId(req, res, next) {
    const projectId = req.query.projectId || req.body.projectId;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
    next();
}

// Get recent emails (activity) for a project
router.get('/api/recent-emails', requireProjectId, getRecentEmails);

// Get recent entries (notes) by workers for a project
router.get('/api/recent-entries', requireProjectId, getRecentEntries);

// Add a file (Doc, Sheet, Folder) to a project
router.post('/api/add-file', addFileToProject);

// Add a note to the manager's personal doc (notepad)
router.post('/api/manager-notepad', addManagerNote);

router.post('/create-project-folder', createProjectFolder);
router.post('/api/create-project-workspace', createProjectWorkspace);
router.get('/list-project-folders', listProjectFolders);
router.get('/list-project-files', listProjectFiles);
router.get('/get-worker-folder-id', getWorkerFolderId);
router.post('/share-worker-folder', shareWorkerFolder);
router.get('/list-accessible-worker-folders', listAccessibleWorkerFolders);
router.post('/add-worker-note', addWorkerNote);
router.post('/upload-worker-photo', upload.single('photo'), uploadWorkerPhoto);

// API to get permissions (emails) for a worker folder
router.get('/api/worker-folder-permissions', async (req, res) => {
    const { folderId } = req.query;
    if (!folderId) return res.status(400).json({ error: 'Missing folderId' });
    try {
        const drive = getDriveClient(req);
        const perms = await drive.permissions.list({
            fileId: folderId,
            fields: 'permissions(emailAddress,role,type)',
        });
        const emails = (perms.data.permissions || [])
            .filter(p => p.type === 'user' && p.role === 'writer' && p.emailAddress)
            .map(p => p.emailAddress);
        res.json({ emails });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// Todo API endpoints
router.get('/api/get-todos', getTodos);
router.post('/api/add-todo', addTodo);
router.post('/api/update-todo', updateTodo);
router.post('/api/update-todo-task', updateTodoTask);
router.post('/api/delete-todo', deleteTodo);

// Daily Check-in API endpoints
router.get('/api/get-daily-checkin', getDailyCheckin);
router.post('/api/save-daily-checkin', saveDailyCheckin);
router.get('/api/get-checkin-history', getCheckinHistory);

export default router;
