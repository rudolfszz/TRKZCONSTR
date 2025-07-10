import express from 'express';
import { createProjectFolder, listProjectFolders, listProjectFiles, getWorkerFolderId, shareWorkerFolder, listAccessibleWorkerFolders, addWorkerNote } from '../controllers/googleController.js';
const router = express.Router();

router.post('/create-project-folder', createProjectFolder);
router.get('/list-project-folders', listProjectFolders);
router.get('/list-project-files', listProjectFiles);
router.get('/get-worker-folder-id', getWorkerFolderId);
router.post('/share-worker-folder', shareWorkerFolder);
router.get('/list-accessible-worker-folders', listAccessibleWorkerFolders);
router.post('/add-worker-note', addWorkerNote);

export default router;
