// Returns a map of { [projectId]: calendarId } for all projects
import * as db from '../services/googleService.js';
import { 
    getCalendarClient, 
    getGmailClient, 
    getDocsClient, 
    getDriveClient,
    getSheetsClient
} from '../services/googleUtils.js';
export const getProjectCalendarMap = async (req, res) => {
    try {
        // You may need to adjust this logic to match your data storage
        // Example: Assume you have a function getAllProjectCalendarMappings()
        // that returns { [projectId]: calendarId }
        if (typeof db.getAllProjectCalendarMappings === 'function') {
            const map = await db.getAllProjectCalendarMappings();
            return res.json(map);
        }
        // Fallback: If you store mapping in a file or memory, load it here
        // Example: import map from '../data/projectCalendarMap.json' assert { type: 'json' };
        // return res.json(map);
        return res.json({});
    } catch (err) {
        res.status(500).json({ error: 'Failed to get project calendar map' });
    }
};
// Create a new Google Calendar
export const createCalendar = async (req, res) => {
    try {
        const { summary } = req.body;
        if (!summary) return res.status(400).json({ error: 'Missing calendar name' });
        
        const calendarApi = getCalendarClient(req);
        const calendarResp = await calendarApi.calendars.insert({ requestBody: { summary } });
        
        // Add to user's calendar list
        try {
            await calendarApi.calendarList.insert({ requestBody: { id: calendarResp.data.id } });
        } catch (e) {}
        
        res.json({ success: true, calendarId: calendarResp.data.id });
    } catch (err) {
        if (err.message === 'Not authenticated') {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        res.status(500).json({ error: 'Failed to create calendar', details: err.message });
    }
};

// Delete a Google Calendar
export const deleteCalendar = async (req, res) => {
    try {
        const { calendarId } = req.body;
        if (!calendarId) return res.status(400).json({ error: 'Missing calendarId' });
        
        const calendarApi = getCalendarClient(req);
        await calendarApi.calendars.delete({ calendarId });
        
        res.json({ success: true });
    } catch (err) {
        if (err.message === 'Not authenticated') {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        res.status(500).json({ error: 'Failed to delete calendar', details: err.message });
    }
};
// List user's calendars
export const getCalendarList = async (req, res) => {
    try {
        const calendar = getCalendarClient(req);
        const resp = await calendar.calendarList.list();
        console.log('[getCalendarList] Google API response:', JSON.stringify(resp.data, null, 2));
        const items = (resp.data.items || []).map(cal => ({
            id: cal.id,
            summary: cal.summary,
            primary: !!cal.primary
        }));
        console.log('[getCalendarList] Calendars returned:', items);
        res.json({ items });
    } catch (err) {
        if (err.message === 'Not authenticated') {
            console.error('[getCalendarList] Not authenticated');
            return res.status(401).json({ error: 'Not authenticated' });
        }
        console.error('[getCalendarList] Error:', err);
        res.status(500).json({ error: 'Failed to fetch calendar list', details: err.message });
    }
};
// Add a Google Calendar event for the authenticated user
export const addCalendarEvent = async (req, res) => {
    try {
        let { title, description, start, end, location, notify, projectName, calendarId } = req.body;
        if (!title || !start || !end) {
            return res.status(400).json({ error: 'Missing required fields: title, start, end' });
        }
        
        const calendar = getCalendarClient(req);
        const event = {
            summary: title,
            description: description || '',
            start: { dateTime: new Date(start).toISOString() },
            end: { dateTime: new Date(end).toISOString() },
            location: location || '',
            extendedProperties: {
                private: {
                    projectName: projectName || ''
                }
            }
        };
        
        if (notify) {
            event.reminders = {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 30 },
                    { method: 'popup', minutes: 10 }
                ]
            };
        }
        
        // Use projectName as calendarId if provided, fallback to 'primary'
        if (!calendarId && projectName) calendarId = projectName;
        const response = await calendar.events.insert({
            calendarId: calendarId || 'primary',
            resource: event,
        });
        
        res.json({ success: true, eventId: response.data.id, htmlLink: response.data.htmlLink });
    } catch (err) {
        if (err.message === 'Not authenticated') {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        res.status(500).json({ error: 'Failed to add calendar event', details: err.message });
    }
};
// Get Google Calendar events for a date range
export const getCalendarEvents = async (req, res) => {
    try {
        let { start, end, projectName, calendarId } = req.query;
        if (!start || !end) {
            console.error('[getCalendarEvents] Missing start or end', { start, end });
            return res.status(400).json({ error: 'Missing start or end' });
        }
        
        const calendar = getCalendarClient(req);
        
        // Build query params
        // Use projectName as calendarId if provided, fallback to 'primary'
        if (!calendarId && projectName) calendarId = projectName;
        let query = {
            calendarId: calendarId || 'primary',
            timeMin: new Date(start).toISOString(),
            timeMax: new Date(end).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100
        };
        if (projectName) {
            query.privateExtendedProperty = `projectName=${projectName}`;
        }
        console.log('[getCalendarEvents] Query:', query);
        try {
            // Try to fetch events from the specified calendarId
            let eventsResp;
            try {
                eventsResp = await calendar.events.list(query);
            } catch (apiErr) {
                // If calendar not found, fallback to 'primary' and notify client
                if (apiErr && apiErr.response && apiErr.response.data && apiErr.response.data.error && apiErr.response.data.error.code === 404) {
                    query.calendarId = 'primary';
                    eventsResp = await calendar.events.list(query);
                    return res.json({ events: (eventsResp.data.items || []).map(ev => ({
                        id: ev.id,
                        summary: ev.summary,
                        description: ev.description,
                        start: ev.start?.dateTime || ev.start?.date,
                        end: ev.end?.dateTime || ev.end?.date,
                        location: ev.location,
                        projectName: ev.extendedProperties?.private?.projectName || ''
                    })), fallback: true, message: 'Project calendar not found, showing primary calendar.' });
                } else {
                    throw apiErr;
                }
            }
            const events = (eventsResp.data.items || []).map(ev => ({
                id: ev.id,
                summary: ev.summary,
                description: ev.description,
                start: ev.start?.dateTime || ev.start?.date,
                end: ev.end?.dateTime || ev.end?.date,
                location: ev.location,
                projectName: ev.extendedProperties?.private?.projectName || ''
            }));
            console.log('[getCalendarEvents] Events returned:', events);
            res.json({ events });
        } catch (apiErr) {
            console.error('[getCalendarEvents] Google API error:', apiErr.response?.data || apiErr.message);
            res.status(500).json({ error: 'Failed to fetch calendar events', details: apiErr.message, apiError: apiErr.response?.data });
        }
    } catch (err) {
        console.error('[getCalendarEvents] Error:', err);
        res.status(500).json({ error: 'Failed to fetch calendar events', details: err.message });
    }
};
// Get recent emails from the manager's Gmail inbox (last 10)
export const getManagerInboxEmails = async (req, res) => {
    try {
        const gmail = getGmailClient(req);
        
        // Get query parameters for pagination and limit
        const maxResults = parseInt(req.query.maxResults) || 50; // Default to 50 emails
        const pageToken = req.query.pageToken || undefined;
        
        // Get messages from the inbox
        const messagesResp = await gmail.users.messages.list({ 
            userId: 'me', 
            maxResults: maxResults, 
            labelIds: ['INBOX'],
            pageToken: pageToken
        });
        
        const messages = messagesResp.data.messages || [];
        
        const emailResults = [];
        for (const msg of messages) {
            try {
                const msgData = await gmail.users.messages.get({ 
                    userId: 'me', 
                    id: msg.id, 
                    format: 'metadata', 
                    metadataHeaders: ['From', 'Subject', 'Date', 'Message-ID']
                });
                
                const headers = msgData.data.payload.headers;
                const from = headers.find(h => h.name === 'From')?.value || '';
                const subject = headers.find(h => h.name === 'Subject')?.value || '';
                const date = headers.find(h => h.name === 'Date')?.value || '';
                const messageId = headers.find(h => h.name === 'Message-ID')?.value || msg.id;
                
                emailResults.push({ 
                    id: msg.id,
                    from, 
                    subject, 
                    date, 
                    messageId,
                    threadId: msg.threadId
                });
            } catch (msgErr) {
                console.error('Error fetching message:', msgErr);
                // Continue with other messages even if one fails
            }
        }
        console.log(emailResults);
        res.json({ 
            emails: emailResults,
            nextPageToken: messagesResp.data.nextPageToken,
            resultSizeEstimate: messagesResp.data.resultSizeEstimate
        });
    } catch (err) {
        if (err.message === 'Not authenticated') {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        res.status(500).json({ error: 'Failed to fetch Gmail inbox', details: err.message });
    }
};
// Get recent emails (activity) for a project
export const getRecentEmails = async (req, res) => {
    const { projectId } = req.query;
    try {
        const drive = getDriveClient(req);
        // Find the Docs folder inside the project
        const docsFolderResp = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docsFolderResp.data.files.length) return res.json({ emails: [] });
        const docsFolderId = docsFolderResp.data.files[0].id;
        // Find the Workers folder inside the Docs folder
        const workersFolderResp = await drive.files.list({
            q: `'${docsFolderId}' in parents and name contains 'Workers' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!workersFolderResp.data.files.length) return res.json({ emails: [] });
        const workersFolderId = workersFolderResp.data.files[0].id;
        // Get permissions (emails) for the workers folder
        const perms = await drive.permissions.list({
            fileId: workersFolderId,
            fields: 'permissions(emailAddress,role,type)',
        });
        const emails = (perms.data.permissions || [])
            .filter(p => p.type === 'user' && p.role === 'writer' && p.emailAddress)
            .map(p => p.emailAddress);
        res.json({ emails });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch recent emails', details: err.message });
    }
};

// Get recent entries (notes) by workers for a project
export const getRecentEntries = async (req, res) => {
    const { projectId } = req.query;
    try {
        const drive = getDriveClient(req);
        // Find the Docs folder inside the project
        const docsFolderResp = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docsFolderResp.data.files.length) return res.json({ entries: [] });
        const docsFolderId = docsFolderResp.data.files[0].id;
        // Find the Workers folder inside the Docs folder
        const workersFolderResp = await drive.files.list({
            q: `'${docsFolderId}' in parents and name contains 'Workers' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!workersFolderResp.data.files.length) return res.json({ entries: [] });
        const workersFolderId = workersFolderResp.data.files[0].id;
        // List all subfolders (workers)
        const subfolders = await drive.files.list({
            q: `'${workersFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        let entries = [];
        for (const folder of subfolders.data.files) {
            // Find log doc in subfolder
            const docs = await drive.files.list({
                q: `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.document' and name contains 'log' and trashed = false`,
                fields: 'files(id, name)',
            });
            if (docs.data.files.length) {
                // Get the latest content from the log doc (last 1-2 notes)
                const googleDocs = getDocsClient(req);
                const doc = await googleDocs.documents.get({ documentId: docs.data.files[0].id });
                const content = (doc.data.body && doc.data.body.content) ? doc.data.body.content.map(c => c.paragraph && c.paragraph.elements ? c.paragraph.elements.map(e => e.textRun ? e.textRun.content : '').join('') : '').join('') : '';
                // Get last 2 notes (split by double newline)
                const notes = content.split(/\n\n+/).filter(Boolean).slice(-2);
                notes.forEach(note => entries.push({ worker: folder.name, note }));
            }
        }
        // Sort by recency if possible (not guaranteed)
        res.json({ entries: entries.reverse() });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch recent entries', details: err.message });
    }
};

// Add a file (Doc, Sheet, Folder) to a project
export const addFileToProject = async (req, res) => {
    const { projectId, fileType, fileName } = req.body;
    if (!projectId || !fileType || !fileName) return res.status(400).json({ error: 'Missing required fields' });
    try {
        const drive = getDriveClient(req);
        // Find the correct parent folder
        let parentFolderId = projectId;
        if (fileType === 'document' || fileType === 'spreadsheet') {
            // Find Docs or Sheets folder
            const folderType = fileType === 'document' ? 'Docs' : 'Sheets';
            const folderResp = await drive.files.list({
                q: `'${projectId}' in parents and name contains '${folderType}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
            });
            if (!folderResp.data.files.length) return res.status(400).json({ error: `No ${folderType} folder found` });
            parentFolderId = folderResp.data.files[0].id;
        }
        let resource = { name: fileName };
        if (fileType === 'document') {
            resource.mimeType = 'application/vnd.google-apps.document';
        } else if (fileType === 'spreadsheet') {
            resource.mimeType = 'application/vnd.google-apps.spreadsheet';
        } else if (fileType === 'folder') {
            resource.mimeType = 'application/vnd.google-apps.folder';
        } else {
            return res.status(400).json({ error: 'Invalid file type' });
        }
        resource.parents = [parentFolderId];
        const file = await drive.files.create({ resource, fields: 'id, name' });
        res.json({ success: true, file: { id: file.data.id, name: file.data.name } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add file', details: err.message });
    }
};

// Add a note to the manager's personal doc (notepad)
export const addManagerNote = async (req, res) => {
    const { projectId, note } = req.body;
    if (!projectId || !note) return res.status(400).json({ error: 'Missing projectId or note' });
    try {
        const drive = getDriveClient(req);
        // Find Docs folder
        const docsFolderResp = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docsFolderResp.data.files.length) return res.status(400).json({ error: 'No Docs folder found' });
        const docsFolderId = docsFolderResp.data.files[0].id;
        // Find Personal Docs folder
        const personalDocsResp = await drive.files.list({
            q: `'${docsFolderId}' in parents and name = 'My Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!personalDocsResp.data.files.length) return res.status(400).json({ error: 'No Personal Docs folder found' });
        const personalDocsId = personalDocsResp.data.files[0].id;
        // Find the personal doc
        const docResp = await drive.files.list({
            q: `'${personalDocsId}' in parents and mimeType = 'application/vnd.google-apps.document' and name = 'My Quick Notes' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docResp.data.files.length) return res.status(400).json({ error: 'No personal doc found' });
        const docId = docResp.data.files[0].id;
        // Add note to doc (append)
        const googleDocs = getDocsClient(req);
        
        // Get current doc content to find end
        const doc = await googleDocs.documents.get({ documentId: docId });
        let endIndex = 1;
        if (doc.data.body && doc.data.body.content && doc.data.body.content.length > 0) {
            const last = doc.data.body.content[doc.data.body.content.length - 1];
            if (last.endIndex) endIndex = last.endIndex - 1;
        }
        
        const now = new Date();
        const dateStr = now.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const noteText = `${dateStr}\n${note}\n\n`;
        
        await googleDocs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: endIndex },
                            text: noteText
                        }
                    }
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add note to personal doc', details: err.message });
    }
};
import { Readable } from 'stream';

export const createProjectFolder = async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });
    try {
        const drive = getDriveClient(req);
        // 1. Create the main project folder
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        };
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id, name',
        });
        const folderId = folder.data.id;

        // 1b. Create a new Google Calendar for this project (named after the project)
        let projectCalendarId = null;
        try {
            const calendarApi = getCalendarClient(req);
            
            // Create the calendar
            const calendarResp = await calendarApi.calendars.insert({ requestBody: { summary: name } });
            projectCalendarId = calendarResp.data.id;
            
            // Add to user's calendar list
            try {
                await calendarApi.calendarList.insert({ requestBody: { id: projectCalendarId } });
            } catch (e) {}
            
            // Make the calendar public so it can be embedded
            try {
                const { setCalendarPublicOrShare } = await import('../services/calendarAclUtil.js');
                await setCalendarPublicOrShare(projectCalendarId);
            } catch (err) {
                console.error('[createProjectFolder] Failed to set calendar public:', err);
            }
        } catch (err) {
            console.error('[createProjectFolder] Failed to create project calendar:', err);
        }

        // 2. Create subfolders: [projectName] Sheets, [projectName] Docs
        const sheetsFolderMeta = {
            name: `${name} Sheets`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folderId]
        };
        const docsFolderMeta = {
            name: `${name} Docs`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folderId]
        };
        const sheetsFolder = await drive.files.create({
            resource: sheetsFolderMeta,
            fields: 'id, name'
        });
        const docsFolder = await drive.files.create({
            resource: docsFolderMeta,
            fields: 'id, name'
        });
        const sheetsFolderId = sheetsFolder.data.id;
        const docsFolderId = docsFolder.data.id;

        // 3. In Sheets folder, create two sheets: Auto Generating, Personal
        const autoGenSheetMeta = {
            name: 'Auto Generating',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [sheetsFolderId]
        };
        const personalSheetMeta = {
            name: 'My Sheet',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [sheetsFolderId]
        };
        const autoGenSheet = await drive.files.create({
            resource: autoGenSheetMeta,
            fields: 'id, name'
        });
        const personalSheet = await drive.files.create({
            resource: personalSheetMeta,
            fields: 'id, name'
        });

        // 4. In Docs folder, create [projectName] Workers folder and Personal folder
        const workersFolderMeta = {
            name: `${name} Workers`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [docsFolderId]
        };
        const personalDocsFolderMeta = {
            name: 'My Docs',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [docsFolderId]
        };
        const workersFolder = await drive.files.create({
            resource: workersFolderMeta,
            fields: 'id, name'
        });
        const personalDocsFolder = await drive.files.create({
            resource: personalDocsFolderMeta,
            fields: 'id, name'
        });
        const workersFolderId = workersFolder.data.id;
        const personalDocsFolderId = personalDocsFolder.data.id;

        // 5. In Personal Docs folder, create a doc called Personal
        const personalDocMeta = {
            name: 'My Quick Notes',
            mimeType: 'application/vnd.google-apps.document',
            parents: [personalDocsFolderId]
        };
        const personalDoc = await drive.files.create({
            resource: personalDocMeta,
            fields: 'id, name'
        });

        res.json({
            id: folderId,
            name: folder.data.name,
            calendarId: projectCalendarId,
            subfolders: {
                sheets: { id: sheetsFolderId, name: `${name} Sheets` },
                docs: { id: docsFolderId, name: `${name} Docs` },
                workers: { id: workersFolderId, name: `${name} Workers` },
                personalDocs: { id: personalDocsFolderId, name: 'My Docs' }
            },
            sheets: {
                autoGenerating: { id: autoGenSheet.data.id, name: autoGenSheet.data.name },
                personal: { id: personalSheet.data.id, name: personalSheet.data.name }
            },
            docs: {
                personal: { id: personalDoc.data.id, name: personalDoc.data.name }
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create folder structure and templates' });
    }
};

// List all project folders (top-level folders)
export const listProjectFolders = async (req, res) => {
    try {
        const drive = getDriveClient(req);
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
            fields: 'files(id, name)',
        });
        res.json({ folders: response.data.files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list project folders' });
    }
};

// List all files/folders in a project folder
export const listProjectFiles = async (req, res) => {
    const { folderId } = req.query;
    if (!folderId) return res.status(400).json({ error: 'Missing folderId' });
    try {
        const drive = getDriveClient(req);
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType)',
        });
        res.json({ files: response.data.files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list project files' });
    }
};

// Get the worker folder id for a project
export const getWorkerFolderId = async (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });
    try {
        const drive = getDriveClient(req);
        // 1. Find the Docs folder inside the project
        const docsFolderResp = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docsFolderResp.data.files.length) {
            return res.status(404).json({ error: 'No Docs folder found for project' });
        }
        const docsFolderId = docsFolderResp.data.files[0].id;
        // 2. Find the Workers folder inside the Docs folder (match exact name)
        const workersFolderResp = await drive.files.list({
            q: `'${docsFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!workersFolderResp.data.files.length) {
            return res.status(404).json({ error: 'No Workers folder found in Docs' });
        }
        // Try to match exact name '[projectName] Workers'
        let projectName = '';
        try {
            const parentFolder = await drive.files.get({ fileId: projectId, fields: 'name' });
            projectName = parentFolder.data.name;
        } catch (e) {
            projectName = '';
        }
        let workersFolder = workersFolderResp.data.files.find(f => f.name === `${projectName} Workers`);
        if (!workersFolder) {
            // fallback: match any folder with 'Workers' in the name
            workersFolder = workersFolderResp.data.files.find(f => f.name && f.name.includes('Workers'));
        }
        if (workersFolder) {
            res.json({ workerFolderId: workersFolder.id });
        } else {
            return res.status(404).json({ error: 'No matching Workers folder found for project' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to get worker folder id', details: err.message });
    }
};

// Share the worker folder with a user and create a subfolder for them
export const shareWorkerFolder = async (req, res) => {
    if (!req.session.user || !req.session.user.tokens) {
        return res.status(401).json({ error: 'Not authenticated. Please log in as a manager.' });
    }
    const { projectId, email, firstName, surname } = req.body;
    if (!projectId || !email || !firstName || !surname) return res.status(400).json({ error: 'Missing projectId, email, first name, or surname' });
    try {
        // Do NOT store firstName and surname in session globally (fix cross-project bug)
        const drive = getDriveClient(req);
        // 1. Find the Docs folder inside the project
        const docsFolderResp = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docsFolderResp.data.files.length) {
            return res.status(400).json({ error: 'Docs folder not found for project' });
        }
        const docsFolderId = docsFolderResp.data.files[0].id;
        // 2. Find the Workers folder inside the Docs folder
        const workersFolderResp = await drive.files.list({
            q: `'${docsFolderId}' in parents and name contains 'Workers' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!workersFolderResp.data.files.length) {
            return res.status(400).json({ error: 'Workers folder not found in Docs' });
        }
        const workersFolderId = workersFolderResp.data.files[0].id;
        // 3. Create a subfolder for the worker (projectName-workerName)
        // Use firstName and surname for the worker folder and log doc name
        let projectName = '';
        try {
            const parentFolder = await drive.files.get({ fileId: projectId, fields: 'name' });
            projectName = parentFolder.data.name;
        } catch (e) {
            projectName = '';
        }
        const workerFullName = `${firstName} ${surname}`.trim();
        const workerFolderMeta = {
            name: `${projectName}-${workerFullName}`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workersFolderId]
        };
        const workerFolder = await drive.files.create({
            resource: workerFolderMeta,
            fields: 'id, name'
        });
        // 4. Create a template Google Doc for the worker log
        const docMeta = {
            name: `${projectName} ${workerFullName} log`,
            mimeType: 'application/vnd.google-apps.document',
            parents: [workerFolder.data.id]
        };
        const docFile = await drive.files.create({
            resource: docMeta,
            fields: 'id, name'
        });
        // 5. Share the worker folder and log doc with the user
        await drive.permissions.create({
            fileId: workersFolderId,
            resource: {
                type: 'user',
                role: 'writer',
                emailAddress: email
            },
            fields: 'id',
        });
        await drive.permissions.create({
            fileId: workerFolder.data.id,
            resource: {
                type: 'user',
                role: 'writer',
                emailAddress: email
            },
            fields: 'id',
        });
        await drive.permissions.create({
            fileId: docFile.data.id,
            resource: {
                type: 'user',
                role: 'writer',
                emailAddress: email
            },
            fields: 'id',
        });
        res.json({ success: true, workerFolderId: workerFolder.data.id, logDocId: docFile.data.id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to share folder, create worker subfolder, or log doc', details: err.message });
    }
};

// List all worker folders the current user has access to (folders with 'Workers' in the name)
export const listAccessibleWorkerFolders = async (req, res) => {
    try {
        const drive = getDriveClient(req);
        // List all folders shared with the user that are not trashed and are folders
        const sharedFoldersResp = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true",
            fields: 'files(id, name, parents)',
        });
        const sharedFolders = sharedFoldersResp.data.files;
        let resultFolders = [];
        for (const folder of sharedFolders) {
            // Only include subfolders (worker-specific) that contain a log doc
            if (folder.name && folder.name.match(/-.+/)) {
                // Check if this folder contains a log doc
                const filesResp = await drive.files.list({
                    q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.document' and name contains 'log' and trashed=false`,
                    fields: 'files(id, name)',
                });
                if (filesResp.data.files && filesResp.data.files.length > 0) {
                    // Try to find the project name by traversing up to the project root
                    let projectName = '';
                    let currentParent = folder.parents && folder.parents[0];
                    for (let i = 0; i < 3 && currentParent; i++) { // Traverse up to 3 levels
                        try {
                            const parentResp = await drive.files.get({ fileId: currentParent, fields: 'id, name, parents' });
                            if (parentResp.data.name && !parentResp.data.name.includes('Docs') && !parentResp.data.name.includes('Workers')) {
                                projectName = parentResp.data.name;
                                break;
                            }
                            currentParent = parentResp.data.parents && parentResp.data.parents[0];
                        } catch { break; }
                    }
                    folder.projectName = projectName || folder.name;
                    folder.displayName = folder.projectName;
                    resultFolders.push(folder);
                }
            }
        }
        // Remove duplicate folders by id
        // Use a Map for efficient deduplication by folder.id
        const uniqueFoldersMap = new Map();
        for (const folder of resultFolders) {
            if (!uniqueFoldersMap.has(folder.id)) {
                uniqueFoldersMap.set(folder.id, folder);
            }
        }
        res.json({ folders: Array.from(uniqueFoldersMap.values()) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list accessible worker folders' });
    }
};

// Add a note to the worker's log Google Doc
export const addWorkerNote = async (req, res) => {
    const { docId, body } = req.body;
    if (!docId || !body) return res.status(400).json({ error: 'Missing docId or body' });
    try {
        const docs = getDocsClient(req);
        
        // Get the current document content to find the end
        const doc = await docs.documents.get({ documentId: docId });
        let endIndex = 1;
        if (doc.data.body && doc.data.body.content && doc.data.body.content.length > 0) {
            const last = doc.data.body.content[doc.data.body.content.length - 1];
            if (last.endIndex) {
                endIndex = last.endIndex - 1;
            }
        }
        
        // Prepare the note content (no title, just timestamp and body)
        const now = new Date();
        const dateStr = now.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const noteText = `${dateStr}\n${body}\n\n`;
        
        // Insert the note at the end
        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: endIndex },
                            text: noteText
                        }
                    }
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add note to log document', details: err.message });
    }
};

// Upload a photo to the worker's folder
export const uploadWorkerPhoto = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user.tokens) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const drive = getDriveClient(req);
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ error: 'Invalid or missing image file' });
        }

        // Find the Docs folder inside the project
        const docsFolderResp = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Docs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!docsFolderResp.data.files.length) {
            return res.status(400).json({ error: 'Docs folder not found for project' });
        }
        const docsFolderId = docsFolderResp.data.files[0].id;
        // Find the Workers folder inside the Docs folder
        const workersFolderResp = await drive.files.list({
            q: `'${docsFolderId}' in parents and name contains 'Workers' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (!workersFolderResp.data.files.length) {
            return res.status(400).json({ error: 'Workers folder not found in Docs' });
        }
        const workersFolderId = workersFolderResp.data.files[0].id;

        // Find the worker's subfolder in the Workers folder
        const userEmail = req.session.user.email;
        const workerName = userEmail.split('@')[0];
        // List subfolders in the Workers folder
        const subfolders = await drive.files.list({
            q: `'${workersFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)'
        });
        // Error handling: ensure subfolders were found
        if (!subfolders.data.files || !Array.isArray(subfolders.data.files)) {
            return res.status(500).json({ error: 'Internal error: subfolders list invalid' });
        }
        const mySubfolder = subfolders.data.files.find(f => f.name && f.name.includes(workerName));
        if (!mySubfolder) {
            return res.status(404).json({ error: 'Worker subfolder not found' });
        }

        // Upload the photo to the worker's subfolder
        const fileMeta = {
            name: req.file.originalname,
            parents: [mySubfolder.id]
        };
        // Use a Readable stream for Google Drive upload
        const bufferStream = new Readable();
        bufferStream.push(req.file.buffer);
        bufferStream.push(null);
        await drive.files.create({
            resource: fileMeta,
            media: {
                mimeType: req.file.mimetype,
                body: bufferStream
            },
            fields: 'id, name'
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to upload photo', details: err.message });
    }
};

// Create a complete project workspace with specific sheets
export const createProjectWorkspace = async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });
    
    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);
        
        // 1. Create the main project folder
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        };
        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id, name',
        });
        const folderId = folder.data.id;

        // 2. Create the main project spreadsheet with 3 sheets
        const spreadsheetResource = {
            properties: {
                title: name // Use the project name as the spreadsheet title
            },
            sheets: [
                {
                    properties: {
                        title: 'todoList',
                        gridProperties: {
                            rowCount: 1000,
                            columnCount: 3
                        }
                    }
                },
                {
                    properties: {
                        title: 'dailyLogs',
                        gridProperties: {
                            rowCount: 1000,
                            columnCount: 10
                        }
                    }
                },
                {
                    properties: {
                        title: 'notes',
                        gridProperties: {
                            rowCount: 1000,
                            columnCount: 3
                        }
                    }
                }
            ]
        };

        const spreadsheet = await sheets.spreadsheets.create({
            resource: spreadsheetResource,
            fields: 'spreadsheetId,properties.title,sheets.properties'
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId;
        
        // Get the actual sheet IDs from the created spreadsheet
        const sheetIds = {};
        spreadsheet.data.sheets.forEach(sheet => {
            const title = sheet.properties.title;
            const sheetId = sheet.properties.sheetId;
            sheetIds[title] = sheetId;
        });

        // 2. Set up headers and sample data for each sheet using actual sheet IDs
        const requests = [
            // todoList headers and sample data
            {
                updateCells: {
                    range: {
                        sheetId: sheetIds['todoList'],
                        startRowIndex: 0,
                        endRowIndex: 6,
                        startColumnIndex: 0,
                        endColumnIndex: 3
                    },
                    rows: [
                        // Headers
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Date' } },
                                { userEnteredValue: { stringValue: 'Due' } },
                                { userEnteredValue: { stringValue: 'Is Done' } }
                            ]
                        },
                        // Sample data
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-21' } },
                                { userEnteredValue: { stringValue: 'Finish project setup' } },
                                { userEnteredValue: { stringValue: 'Yes' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-22' } },
                                { userEnteredValue: { stringValue: 'Review documentation' } },
                                { userEnteredValue: { stringValue: 'No' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-23' } },
                                { userEnteredValue: { stringValue: 'Test functionality' } },
                                { userEnteredValue: { stringValue: 'No' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-24' } },
                                { userEnteredValue: { stringValue: 'Deploy to production' } },
                                { userEnteredValue: { stringValue: 'No' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-25' } },
                                { userEnteredValue: { stringValue: 'Create user guide' } },
                                { userEnteredValue: { stringValue: 'No' } }
                            ]
                        }
                    ],
                    fields: 'userEnteredValue'
                }
            },
                        // dailyLogs headers and sample data
            {
                updateCells: {
                    range: {
                        sheetId: sheetIds['dailyLogs'],
                        startRowIndex: 0,
                        endRowIndex: 6,
                        startColumnIndex: 0,
                        endColumnIndex: 6
                    },
                    rows: [
                        // Headers
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Date' } },
                                { userEnteredValue: { stringValue: 'Hours Worked' } },
                                { userEnteredValue: { stringValue: 'Tasks Completed' } },
                                { userEnteredValue: { stringValue: 'Progress %' } },
                                { userEnteredValue: { stringValue: 'Number of X' } },
                                { userEnteredValue: { stringValue: 'Status' } }
                            ]
                        },
                        // Sample data
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-21' } },
                                { userEnteredValue: { numberValue: 7.5 } },
                                { userEnteredValue: { numberValue: 5 } },
                                { userEnteredValue: { numberValue: 85 } },
                                { userEnteredValue: { numberValue: 15 } },
                                { userEnteredValue: { stringValue: 'On Track' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-20' } },
                                { userEnteredValue: { numberValue: 6.0 } },
                                { userEnteredValue: { numberValue: 3 } },
                                { userEnteredValue: { numberValue: 65 } },
                                { userEnteredValue: { numberValue: 12 } },
                                { userEnteredValue: { stringValue: 'On Track' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-19' } },
                                { userEnteredValue: { numberValue: 8.0 } },
                                { userEnteredValue: { numberValue: 6 } },
                                { userEnteredValue: { numberValue: 75 } },
                                { userEnteredValue: { numberValue: 10 } },
                                { userEnteredValue: { stringValue: 'Ahead' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-18' } },
                                { userEnteredValue: { numberValue: 5.5 } },
                                { userEnteredValue: { numberValue: 4 } },
                                { userEnteredValue: { numberValue: 55 } },
                                { userEnteredValue: { numberValue: 8 } },
                                { userEnteredValue: { stringValue: 'Behind' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-17' } },
                                { userEnteredValue: { numberValue: 9.0 } },
                                { userEnteredValue: { numberValue: 7 } },
                                { userEnteredValue: { numberValue: 90 } },
                                { userEnteredValue: { numberValue: 18 } },
                                { userEnteredValue: { stringValue: 'Ahead' } }
                            ]
                        }
                    ],
                    fields: 'userEnteredValue'
                }
            },
            // notes headers and sample data
            {
                updateCells: {
                    range: {
                        sheetId: sheetIds['notes'],
                        startRowIndex: 0,
                        endRowIndex: 8,
                        startColumnIndex: 0,
                        endColumnIndex: 3
                    },
                    rows: [
                        // Headers
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Date' } },
                                { userEnteredValue: { stringValue: 'Time' } },
                                { userEnteredValue: { stringValue: 'Note' } }
                            ]
                        },
                        // Sample data
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-21' } },
                                { userEnteredValue: { stringValue: '09:15' } },
                                { userEnteredValue: { stringValue: 'Started working on the project setup. Good energy today!' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-21' } },
                                { userEnteredValue: { stringValue: '11:30' } },
                                { userEnteredValue: { stringValue: 'Fixed the authentication issues. CSRF tokens working properly now.' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-21' } },
                                { userEnteredValue: { stringValue: '14:45' } },
                                { userEnteredValue: { stringValue: 'Implemented the dark theme. Looks much better!' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-20' } },
                                { userEnteredValue: { stringValue: '10:00' } },
                                { userEnteredValue: { stringValue: 'Meeting with team about requirements. Need to focus on user experience.' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-20' } },
                                { userEnteredValue: { stringValue: '16:20' } },
                                { userEnteredValue: { stringValue: 'Discovered a bug in the sheet creation. Working on fix.' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-19' } },
                                { userEnteredValue: { stringValue: '08:45' } },
                                { userEnteredValue: { stringValue: 'Great breakthrough! Found the solution to the Google Sheets API issue.' } }
                            ]
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: '2025-07-19' } },
                                { userEnteredValue: { stringValue: '15:30' } },
                                { userEnteredValue: { stringValue: 'Code review completed. Ready for testing phase.' } }
                            ]
                        }
                    ],
                    fields: 'userEnteredValue'
                }
            }
        ];

        // Apply the headers and sample data
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests
            }
        });

        // 3. Move the spreadsheet to the project folder
        await drive.files.update({
            fileId: spreadsheetId,
            addParents: folderId,
            fields: 'id, parents'
        });

        // 4. Create a project calendar
        let projectCalendarId = null;
        try {
            const calendarApi = getCalendarClient(req);
            const calendarResp = await calendarApi.calendars.insert({ 
                requestBody: { 
                    summary: `${name} - Project Calendar`,
                    description: description || `Calendar for project: ${name}`
                } 
            });
            projectCalendarId = calendarResp.data.id;
            
            // Add to user's calendar list
            try {
                await calendarApi.calendarList.insert({ requestBody: { id: projectCalendarId } });
            } catch (e) {
                console.log('Calendar already in list or error adding:', e.message);
            }
        } catch (err) {
            console.error('Failed to create project calendar:', err);
        }

        res.json({
            success: true,
            projectId: folderId, // Use folder ID as project ID
            projectName: name,
            spreadsheetId,
            calendarId: projectCalendarId,
            folderId,
            message: 'Project workspace created successfully'
        });

    } catch (err) {
        console.error('Failed to create project workspace:', err);
        res.status(500).json({ 
            error: 'Failed to create project workspace', 
            details: err.message 
        });
    }
};

// Get todos from project spreadsheet
export const getTodos = async (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Read the todoList sheet
        const range = 'todoList!A:C';
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });

        const rows = response.data.values || [];
        if (rows.length <= 1) {
            return res.json({ todos: [], spreadsheetId });
        }

        // Skip header row and convert to objects
        const todos = rows.slice(1).map(row => ({
            dueDate: row[0] || '',
            task: row[1] || '',
            completed: row[2] === 'Yes'
        }));

        res.json({ todos, spreadsheetId });

    } catch (err) {
        console.error('Failed to get todos:', err);
        res.status(500).json({ 
            error: 'Failed to get todos', 
            details: err.message 
        });
    }
};

// Add a new todo to project spreadsheet
export const addTodo = async (req, res) => {
    const { projectId, task, dueDate } = req.body;
    if (!projectId || !task || !dueDate) {
        return res.status(400).json({ error: 'Missing projectId, task, or dueDate' });
    }

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Append new todo to the todoList sheet
        const values = [[dueDate, task, 'No']];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'todoList!A:C',
            valueInputOption: 'RAW',
            resource: { values }
        });

        res.json({ success: true });

    } catch (err) {
        console.error('Failed to add todo:', err);
        res.status(500).json({ 
            error: 'Failed to add todo', 
            details: err.message 
        });
    }
};

// Update todo completion status
export const updateTodo = async (req, res) => {
    const { projectId, rowIndex, completed } = req.body;
    if (!projectId || !rowIndex || completed === undefined) {
        return res.status(400).json({ error: 'Missing projectId, rowIndex, or completed' });
    }

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Update the completion status (column C)
        const range = `todoList!C${rowIndex}`;
        const values = [[completed ? 'Yes' : 'No']];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
        });

        res.json({ success: true });

    } catch (err) {
        console.error('Failed to update todo:', err);
        res.status(500).json({ 
            error: 'Failed to update todo', 
            details: err.message 
        });
    }
};

// Update todo task text
export const updateTodoTask = async (req, res) => {
    const { projectId, rowIndex, task } = req.body;
    if (!projectId || !rowIndex || !task) {
        return res.status(400).json({ error: 'Missing projectId, rowIndex, or task' });
    }

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Update the task text (column B)
        const range = `todoList!B${rowIndex}`;
        const values = [[task]];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
        });

        res.json({ success: true });

    } catch (err) {
        console.error('Failed to update todo task:', err);
        res.status(500).json({ 
            error: 'Failed to update todo task', 
            details: err.message 
        });
    }
};

// Delete a todo from project spreadsheet
export const deleteTodo = async (req, res) => {
    const { projectId, rowIndex } = req.body;
    if (!projectId || !rowIndex) {
        return res.status(400).json({ error: 'Missing projectId or rowIndex' });
    }

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Get the sheet metadata to find the todoList sheet ID
        const spreadsheetMetadata = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties'
        });

        const todoSheet = spreadsheetMetadata.data.sheets.find(
            sheet => sheet.properties.title === 'todoList'
        );

        if (!todoSheet) {
            return res.status(404).json({ error: 'todoList sheet not found' });
        }

        const sheetId = todoSheet.properties.sheetId;

        // Delete the row using batchUpdate
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // Convert to 0-based index
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });

        res.json({ success: true });

    } catch (err) {
        console.error('Failed to delete todo:', err);
        res.status(500).json({ 
            error: 'Failed to delete todo', 
            details: err.message 
        });
    }
};

// Get today's daily check-in data
export const getDailyCheckin = async (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Read the dailyLogs sheet
        const range = 'dailyLogs!A:F';
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });

        const rows = response.data.values || [];
        if (rows.length <= 1) {
            return res.json({ todayData: null, spreadsheetId });
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // Find today's row (skip header row)
        const todayRow = rows.slice(1).find(row => row[0] === today);

        let todayData = null;
        if (todayRow) {
            todayData = {
                date: todayRow[0] || '',
                hoursWorked: parseFloat(todayRow[1]) || 0,
                tasksCompleted: parseInt(todayRow[2]) || 0,
                progressPercent: parseInt(todayRow[3]) || 0,
                numberX: parseInt(todayRow[4]) || 0,
                status: todayRow[5] || ''
            };
        }

        res.json({ todayData, spreadsheetId });

    } catch (err) {
        console.error('Failed to get daily check-in:', err);
        res.status(500).json({ 
            error: 'Failed to get daily check-in', 
            details: err.message 
        });
    }
};

// Save daily check-in data
export const saveDailyCheckin = async (req, res) => {
    const { projectId, date, hoursWorked, tasksCompleted, progressPercent, numberX, status } = req.body;
    
    if (!projectId || !date) {
        return res.status(400).json({ error: 'Missing projectId or date' });
    }

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Read the current dailyLogs sheet to check if today's entry exists
        const range = 'dailyLogs!A:F';
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });

        const rows = response.data.values || [];
        let todayRowIndex = -1;

        // Find if today's row already exists (skip header row)
        if (rows.length > 1) {
            todayRowIndex = rows.slice(1).findIndex(row => row[0] === date);
            if (todayRowIndex !== -1) {
                todayRowIndex += 2; // Convert to 1-based index and account for header
            }
        }

        const values = [
            [date, hoursWorked, tasksCompleted, progressPercent, numberX, status || 'On Track']
        ];

        if (todayRowIndex > 0) {
            // Update existing row
            const updateRange = `dailyLogs!A${todayRowIndex}:F${todayRowIndex}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: { values }
            });
        } else {
            // Append new row
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'dailyLogs!A:F',
                valueInputOption: 'RAW',
                resource: { values }
            });
        }

        res.json({ success: true });

    } catch (err) {
        console.error('Failed to save daily check-in:', err);
        res.status(500).json({ 
            error: 'Failed to save daily check-in', 
            details: err.message 
        });
    }
};

// Get check-in history
export const getCheckinHistory = async (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    try {
        const drive = getDriveClient(req);
        const sheets = getSheetsClient(req);

        // Find the project spreadsheet
        const filesResp = await drive.files.list({
            q: `'${projectId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id, name)'
        });

        if (!filesResp.data.files.length) {
            return res.status(404).json({ error: 'No spreadsheet found for project' });
        }

        const spreadsheetId = filesResp.data.files[0].id;

        // Read the dailyLogs sheet
        const range = 'dailyLogs!A:F';
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });

        const rows = response.data.values || [];
        if (rows.length <= 1) {
            return res.json({ history: [] });
        }

        // Convert rows to objects (skip header row) and sort by date descending
        const history = rows.slice(1)
            .filter(row => row[0]) // Only rows with dates
            .map(row => ({
                date: row[0] || '',
                hoursWorked: parseFloat(row[1]) || 0,
                tasksCompleted: parseInt(row[2]) || 0,
                progressPercent: parseInt(row[3]) || 0,
                numberX: parseInt(row[4]) || 0,
                status: row[5] || ''
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

        res.json({ history });

    } catch (err) {
        console.error('Failed to get check-in history:', err);
        res.status(500).json({ 
            error: 'Failed to get check-in history', 
            details: err.message 
        });
    }
};
