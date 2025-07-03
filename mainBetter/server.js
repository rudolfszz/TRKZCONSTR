import './config.js';  // just import to run dotenv.config()

import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

// Or better, import the constants from config.js and log those:
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, PORT } from './config.js';

const app = express();
const port = PORT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'client')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.json());
app.use(session({
    secret: 'supersecret',
    resave: false,
    saveUninitialized: false
}));

import authRoutes from './routes/authRoutes.js';
import googleRoutes from './routes/googleRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

app.use(authRoutes);
app.use(googleRoutes);
app.use(aiRoutes);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    open(`http://localhost:${port}/login`);
});
