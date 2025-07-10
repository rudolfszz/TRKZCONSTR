import { google } from 'googleapis';
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from '../config.js';

export const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

export const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/spreadsheets'
];

export const getDriveClient = (req) => {
    if (!req.session.user?.tokens) {
        console.error('No tokens found in session');
    }
    oauth2Client.setCredentials(req.session.user.tokens);
    return google.drive({ version: 'v3', auth: oauth2Client });
};