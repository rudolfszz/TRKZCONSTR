import { getOAuth2Client, SCOPES } from '../services/googleService.js';

export const login = (req, res) => {
    try {
        const oauth2Client = getOAuth2Client();
        const authUrl = oauth2Client.generateAuthUrl({ 
            access_type: 'offline', 
            scope: SCOPES,
            prompt: 'consent'
        });
        console.log('🔐 Redirecting to Google OAuth:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            error: 'Failed to initialize login', 
            details: error.message,
            solution: 'Please check your Google OAuth credentials in .env file'
        });
    }
};

export const oauthCallback = async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    
    if (error) {
        console.error('❌ OAuth callback error:', error);
        return res.redirect('/login.html?error=oauth_denied');
    }
    
    if (!code) {
        console.error('❌ No authorization code received');
        return res.redirect('/login.html?error=no_code');
    }
    
    const oauth2Client = getOAuth2Client();
    try {
        console.log('🔄 Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Try to get id_token from oauth2Client.credentials if not present in tokens
        let idToken = tokens.id_token;
        if (!idToken && oauth2Client.credentials && oauth2Client.credentials.id_token) {
            idToken = oauth2Client.credentials.id_token;
        }

        // Fallback: try to get email from id_token
        let email = null;
        if (idToken) {
            try {
                const base64Url = idToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                let jsonPayload;
                if (typeof Buffer !== 'undefined') {
                    jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
                } else {
                    jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                }
                email = JSON.parse(jsonPayload).email;
                console.log('✅ Successfully extracted email:', email);
            } catch (e) {
                console.error('❌ id_token decode error:', e);
            }
        }

        // Log for debugging
        if (!email) {
            console.error('❌ Email extraction failed');
            return res.redirect('/login.html?error=email_extraction_failed');
        }
        
        req.session.user = { authenticated: true, tokens, email };
        console.log('✅ Login successful, redirecting to /index.html');
        res.redirect('/index.html');
    } catch (err) {
        console.error('❌ OAuth callback error:', err);
        res.redirect('/login.html?error=auth_failed');
    }
};

export const logout = (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send('Logout failed');
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};

export const getUser = (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, email: req.session.user.email || null, csrfToken: req.session.csrfToken });
    } else {
        res.json({ loggedIn: false });
    }
};
