import { getOAuth2Client, SCOPES } from '../services/googleService.js';

export const login = (req, res) => {
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    res.redirect(authUrl);
};

export const oauthCallback = async (req, res) => {
    const code = req.query.code;
    const oauth2Client = getOAuth2Client();
    try {
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
            } catch (e) {
                console.error('id_token decode error:', e);
            }
        }

        // Log for debugging
        console.log('Extracted email:', email);
        req.session.user = { authenticated: true, tokens, email };
        res.redirect('/index.html');
    } catch (err) {
        res.status(500).send('Auth failed');
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
        res.json({ loggedIn: true, email: req.session.user.email || null });
    } else {
        res.json({ loggedIn: false });
    }
};
