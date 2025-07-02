import express from 'express';
import { google } from 'googleapis';
import open from 'open'; // optional, to open browser automatically
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';


const app = express();
const port = 3001;

// Your OAuth2 credentials
const CLIENT_ID = '715819257451-hjcjejiv2tullr2jf6kmk6nmm1v5vedo.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3001/oauth2callback';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'HTMLCode')));
app.use('/JScode', express.static(path.join(__dirname, 'JScode')));

app.use(session({
  secret: 'af9f8afj@29sdj!#sdklf8923ufwqef',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true only if using HTTPS
    httpOnly: true,
    sameSite: 'lax' // or 'none' if using cross-site cookies (must be secure then)
  }
}));

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Scopes to request (allow folder creation in Drive)
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let userTokens = null; // Store user tokens here for simplicity

app.get('/', (req, res) => {
    console.log(__dirname);
    res.sendFile(path.join(__dirname, '../HTMLCode/index.html'));
});

app.get('/login', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // to get refresh token
        scope: SCOPES,
    });
    res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        userTokens = tokens; // save tokens for API calls
        // res.send('Login successful! You can now close this tab and use the app.');
        // setTimeout(1000);
        res.redirect("http://localhost:3001/")
    } catch (err) {
        res.status(500).send('Error retrieving access token');
    }
});

app.use(express.json());

app.post('/create-folder', async (req, res) => {
    if (!userTokens) return res.status(401).json({ error: 'User not authenticated' });

    oauth2Client.setCredentials(userTokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderName = req.body.name;
    if (!folderName) return res.status(400).json({ error: 'Folder name is required' });

    try {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        const response = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });
        res.json({ folderId: response.data.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    // Optional: open login page automatically
    open(`http://localhost:${port}/login`);
});

app.get('/user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});