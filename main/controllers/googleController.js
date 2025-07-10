import { getDriveClient } from '../services/googleService.js';
import { google } from 'googleapis';

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

        // 2. Create subfolders: Tables, Managers, Workers (add project name to Workers folder)
        const subfolders = [
            { name: 'Tables', key: 'tables' },
            { name: 'Managers', key: 'managers' },
            { name: `${name} Workers`, key: 'workers' } // Add project name to Workers folder
        ];
        const subfolderIds = {};
        for (const sub of subfolders) {
            const subMeta = {
                name: sub.name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [folderId]
            };
            const subFolder = await drive.files.create({
                resource: subMeta,
                fields: 'id, name'
            });
            subfolderIds[sub.key] = subFolder.data.id;
        }

        // 3. In Tables folder, create a template sheet
        const sheetMeta = {
            name: `${name} Table Template`,
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [subfolderIds.tables]
        };
        const sheetFile = await drive.files.create({
            resource: sheetMeta,
            fields: 'id, name'
        });

        // 4. In Managers folder, create a template doc
        const docMeta = {
            name: `${name} Manager Template`,
            mimeType: 'application/vnd.google-apps.document',
            parents: [subfolderIds.managers]
        };
        const docFile = await drive.files.create({
            resource: docMeta,
            fields: 'id, name'
        });

        res.json({
            id: folderId,
            name: folder.data.name,
            subfolders: {
                tables: { id: subfolderIds.tables, name: 'Tables' },
                managers: { id: subfolderIds.managers, name: 'My files' },
                workers: { id: subfolderIds.workers, name: 'Workers' }
            },
            tableSheet: { id: sheetFile.data.id, name: sheetFile.data.name },
            managerDoc: { id: docFile.data.id, name: docFile.data.name }
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
        const response = await drive.files.list({
            q: `'${projectId}' in parents and name contains 'Workers' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
        });
        if (response.data.files.length > 0) {
            res.json({ workerFolderId: response.data.files[0].id });
        } else {
            res.json({ workerFolderId: null });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to get worker folder id' });
    }
};

// Share the worker folder with a user and create a subfolder for them
export const shareWorkerFolder = async (req, res) => {
    const { folderId, email } = req.body;
    if (!folderId || !email) return res.status(400).json({ error: 'Missing folderId or email' });
    try {
        const drive = getDriveClient(req);
        // 1. Create a subfolder for the worker (projectName-workerName)
        const workerName = email.split('@')[0];
        // Fetch the project name for this worker folder
        let projectName = '';
        try {
            const parentFolder = await drive.files.get({ fileId: folderId, fields: 'name' });
            projectName = parentFolder.data.name;
        } catch (e) {
            projectName = '';
        }
        const workerFolderMeta = {
            name: `${projectName}-${workerName}`,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folderId]
        };
        const workerFolder = await drive.files.create({
            resource: workerFolderMeta,
            fields: 'id, name'
        });
        // 2. Create a template Google Doc for the worker log
        const docMeta = {
            name: `${projectName} ${workerName} log`,
            mimeType: 'application/vnd.google-apps.document',
            parents: [workerFolder.data.id]
        };
        const docFile = await drive.files.create({
            resource: docMeta,
            fields: 'id, name'
        });
        // 3. Share the worker folder and log doc with the user
        await drive.permissions.create({
            fileId: folderId,
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
        res.status(500).json({ error: 'Failed to share folder, create worker subfolder, or log doc' });
    }
};

// List all worker folders the current user has access to (folders with 'Workers' in the name)
export const listAccessibleWorkerFolders = async (req, res) => {
    try {
        const drive = getDriveClient(req);
        // List all folders shared with the user that have 'Workers' in the name
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and name contains 'Workers' and trashed=false and sharedWithMe=true",
            fields: 'files(id, name, parents)',
        });
        // Optionally, fetch the parent project folder name for display
        const folders = response.data.files;
        for (const folder of folders) {
            if (folder.parents && folder.parents.length) {
                const parent = await drive.files.get({ fileId: folder.parents[0], fields: 'id, name' });
                folder.projectName = parent.data.name;
            }
        }
        // Remove duplicate folders by id
        const uniqueFolders = [];
        const seen = new Set();
        for (const folder of folders) {
            if (!seen.has(folder.id)) {
                uniqueFolders.push(folder);
                seen.add(folder.id);
            }
        }
        // Only keep the main Workers folder (not subfolders for each worker)
        const mainFolders = uniqueFolders.filter(folder => {
            // The main Workers folder should have a name containing 'Workers' but not the worker's name (no dash or @)
            // You may adjust this logic if your naming changes
            return !folder.name.match(/-.+/);
        });
        res.json({ folders: mainFolders });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list accessible worker folders' });
    }
};

// Add a note to the worker's log Google Doc
export const addWorkerNote = async (req, res) => {
    const { docId, title, body } = req.body;
    if (!docId || !title || !body) return res.status(400).json({ error: 'Missing docId, title, or body' });
    try {
        const drive = getDriveClient(req);
        const docs = google.docs({ version: 'v1', auth: drive._options.auth });
        // Get the current document content to find the end
        const doc = await docs.documents.get({ documentId: docId });
        const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;
        // Prepare the note content
        const now = new Date();
        const dateStr = now.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const noteText = `${dateStr}\n${title}\n${body}\n\n`;
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
        res.status(500).json({ error: 'Failed to add note to log document' });
    }
};
