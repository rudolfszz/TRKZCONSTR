import { google } from 'googleapis';
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from '../config.js';

export const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/spreadsheets'
];

// Export a factory function for OAuth2 client for compatibility
export const getOAuth2Client = () => new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

export const getDriveClient = (req) => {
    const oauth2Client = getOAuth2Client();
    if (!req.session.user?.tokens) {
        throw new Error('No tokens found in session. User must log in.');
    }
    oauth2Client.setCredentials(req.session.user.tokens);
    return google.drive({ version: 'v3', auth: oauth2Client });
};
