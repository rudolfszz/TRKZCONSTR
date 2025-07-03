import express from 'express';
import { askQuestion } from '../controllers/aiController.js';
const router = express.Router();

router.post('/ask-question', askQuestion);

export default router;
