import './config.js';  // just import to run dotenv.config()

import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

// Or better, import the constants from config.js and log those:
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, PORT } from './config.js';
import { csrfProtection } from './middleware/csrf.js';

const app = express();
const port = PORT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'client')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 2 // 2 hours
    }
}));

app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = Math.random().toString(36).substring(2);
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
});
app.use(csrfProtection);

import authRoutes from './routes/authRoutes.js';
import googleRoutes from './routes/googleRoutes.js';

app.use(authRoutes);
app.use(googleRoutes);

// Set security headers for GDPR/ePrivacy compliance
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self' https://accounts.google.com https://apis.google.com");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=()');
    next();
});

// Global Express error handler for all unhandled errors
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    } else {
        res.status(500).send('Internal server error');
    }
});

app.listen(port, () => {
    open(`http://localhost:${port}/login.html`);
});
