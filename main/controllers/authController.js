import { oauth2Client, SCOPES } from '../services/googleService.js';

export const login = (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log("Generated Auth URL:", authUrl);
    res.redirect(authUrl);
};

export const oauthCallback = async (req, res) => {
    const code = req.query.code;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        req.session.user = { authenticated: true, tokens };
        res.redirect('/');
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
    if (req.session.user) res.json({ loggedIn: true });
    else res.json({ loggedIn: false });
};
