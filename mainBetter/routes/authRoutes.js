import express from 'express';
import { login, oauthCallback, logout, getUser } from '../controllers/authController.js';
const router = express.Router();

router.get('/login', login);
router.get('/oauth2callback', oauthCallback);
router.get('/logout', logout);
router.get('/user', getUser);

export default router;
