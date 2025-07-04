import { getDriveClient, getSheetsClient } from '../services/googleService.js';
import { getEmbedding } from '../services/openaiService.js';
import { vectorStore } from '../utils/vectorStore.js';

export const createFolder = async (req, res) => {
    const { name } = req.body;
    const drive = getDriveClient(req);
    try {
        const result = await drive.files.create({
            resource: { name, mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id'
        });
        res.json({ folderId: result.data.id });
    } catch {
        res.status(500).json({ error: 'Could not create folder' });
    }
};

export const createSheet = async (req, res) => {
    const sheets = getSheetsClient(req);
    const title = req.body.title;
    try {
        const sheet = await sheets.spreadsheets.create({
            resource: { properties: { title } },
            fields: 'spreadsheetId'
        });
        res.json({ sheetId: sheet.data.spreadsheetId });
    } catch {
        res.status(500).json({ error: 'Sheet creation failed' });
    }
};

export const listDriveFiles = async (req, res) => {
    const drive = getDriveClient(req);
    const response = await drive.files.list({
        fields: 'files(id, name, mimeType, parents)',
        pageSize: 1000,
    });

    const files = response.data.files;

    const folders = {};
    const fileMap = {};

    // Build quick lookup maps
    files.forEach(file => {
        file.url = `https://drive.google.com/open?id=${file.id}`;
        fileMap[file.id] = file;
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            folders[file.id] = { ...file, files: [] };
        }
    });

    const structured = [];

    // Assign files to folders
    files.forEach(file => {
        if (file.mimeType !== 'application/vnd.google-apps.folder') {
            const parentId = file.parents?.[0]; // might be undefined
            if (folders[parentId]) {
                folders[parentId].files.push(file);
            } else {
                structured.push(file); // top-level file
            }
        }
    });

    // Add folders to structured list
    Object.values(folders).forEach(folder => {
        structured.push(folder);
    });

    // Sort so folders come first, then files, both alphabetically by name
    structured.sort((a, b) => {
        const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
        const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';

        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;

        return a.name.localeCompare(b.name);
    });

    res.json({ structured });
};

export const embedDriveFiles = async (req, res) => {
    const drive = getDriveClient(req);
    const files = await drive.files.list({
        pageSize: 10,
        fields: 'files(id, name)'
    });

    for (const file of files.data.files) {
        const embedding = await getEmbedding(file.name);
        vectorStore.push({ text: file.name, embedding });
    }

    res.json({ status: 'Embedded successfully' });
};

export const searchDriveFiles = async (req, res) => {
    try {
        const drive = getDriveClient(req);
        const query = req.query.q || ''; // optional search query

        console.log('Received search query:', query); // Add this log

        const folderQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false` + (query ? ` and name contains '${query}'` : '');
        const fileQuery = `mimeType != 'application/vnd.google-apps.folder' and trashed = false` + (query ? ` and name contains '${query}'` : '');

        const foldersRes = await drive.files.list({
            q: folderQuery,
            fields: 'files(id, name, mimeType)',
            includeItemsFromAllDrives: true,
            supportsAllDrives: true
        });

        const filesRes = await drive.files.list({
            q: fileQuery,
            fields: 'files(id, name, mimeType)',
            includeItemsFromAllDrives: true,
            supportsAllDrives: true
        });

        res.json({ files: [...foldersRes.data.files, ...filesRes.data.files] });

    } catch (err) {
        console.error('Drive search error:', err);
        res.status(500).json({ error: 'Failed to search Drive files' });
    }
};

export const createFile = async (req, res) => {
    const { folderId, fileType } = req.body;
    const drive = getDriveClient(req);

    const mimeTypes = {
        document: 'application/vnd.google-apps.document',
        spreadsheet: 'application/vnd.google-apps.spreadsheet',
        presentation: 'application/vnd.google-apps.presentation'
    };

    const mimeType = mimeTypes[fileType];

    if (!mimeType) {
        return res.status(400).json({ error: 'Invalid file type' });
    }

    try {
        const response = await drive.files.create({
            resource: {
                name: `New ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}`,
                mimeType,
                parents: [folderId]
            },
            fields: 'id, name'
        });

        const fileId = response.data.id;

        // Generate file edit URL based on file type
        const baseUrls = {
            document: `https://docs.google.com/document/d/${fileId}/edit`,
            spreadsheet: `https://docs.google.com/spreadsheets/d/${fileId}/edit`,
            presentation: `https://docs.google.com/presentation/d/${fileId}/edit`,
        };

        res.json({
            fileId,
            fileName: response.data.name,
            fileUrl: baseUrls[fileType]
        });
    } catch (error) {
        console.error('Failed to create file:', error);
        res.status(500).json({ error: 'File creation failed' });
    }
};
