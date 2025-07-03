import express from 'express';
import { createFolder, createSheet, listDriveFiles, embedDriveFiles, searchDriveFiles, createFile } from '../controllers/googleController.js';
const router = express.Router();

router.post('/create-folder', createFolder);
router.post('/create-sheet', createSheet);
router.get('/drive-files', listDriveFiles);
router.post('/embed-drive-files', embedDriveFiles);
router.get('/search-drive-files', searchDriveFiles);
router.post('/create-file', createFile);

export default router;
