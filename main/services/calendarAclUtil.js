// Utility to make a Google Calendar public or share with a user
import { getOAuth2Client } from '../services/googleService.js';
import { google } from 'googleapis';

/**
 * Make a Google Calendar public or share with a specific user.
 * @param {string} calendarId - The calendar ID to update.
 * @param {string} [email] - Optional email to share with (if not public).
 * @returns {Promise<void>}
 */
export async function setCalendarPublicOrShare(calendarId, email) {
    const oauth2Client = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    try {
        await calendar.acl.insert({
            calendarId,
            requestBody: {
                role: 'reader',
                scope: email
                    ? { type: 'user', value: email }
                    : { type: 'default' }
            }
        });
        console.log(`[setCalendarPublicOrShare] Calendar ${calendarId} shared with ${email || 'public'}`);
    } catch (err) {
        // If already shared, ignore error (409)
        if (err.code === 409) {
            console.warn(`[setCalendarPublicOrShare] Calendar ${calendarId} already shared with ${email || 'public'}`);
            return;
        }
        console.error(`[setCalendarPublicOrShare] Error: ${err.message}`);
        throw err;
    }
}
