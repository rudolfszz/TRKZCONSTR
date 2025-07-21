import { getOAuth2Client } from './googleService.js';
import { google } from 'googleapis';

/**
 * Initialize Google API client with OAuth2 credentials
 * @param {Object} req - Express request object with session
 * @returns {Object} - OAuth2 client with credentials set
 */
export const initOAuth2Client = (req) => {
    const oauth2Client = getOAuth2Client();
    
    if (!req.session.user?.tokens) {
        throw new Error('Not authenticated');
    }
    
    oauth2Client.setCredentials(req.session.user.tokens);
    return oauth2Client;
};

/**
 * Get Google Calendar API client
 * @param {Object} req - Express request object with session
 * @returns {Object} - Google Calendar API client
 */
export const getCalendarClient = (req) => {
    const oauth2Client = initOAuth2Client(req);
    return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Get Google Gmail API client
 * @param {Object} req - Express request object with session
 * @returns {Object} - Google Gmail API client
 */
export const getGmailClient = (req) => {
    const oauth2Client = initOAuth2Client(req);
    return google.gmail({ version: 'v1', auth: oauth2Client });
};

/**
 * Get Google Docs API client
 * @param {Object} req - Express request object with session
 * @returns {Object} - Google Docs API client
 */
export const getDocsClient = (req) => {
    const oauth2Client = initOAuth2Client(req);
    return google.docs({ version: 'v1', auth: oauth2Client });
};

/**
 * Get Google Drive API client
 * @param {Object} req - Express request object with session
 * @returns {Object} - Google Drive API client
 */
export const getDriveClient = (req) => {
    const oauth2Client = initOAuth2Client(req);
    return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * Get Google Sheets API client
 * @param {Object} req - Express request object with session
 * @returns {Object} - Google Sheets API client
 */
export const getSheetsClient = (req) => {
    const oauth2Client = initOAuth2Client(req);
    return google.sheets({ version: 'v4', auth: oauth2Client });
};
