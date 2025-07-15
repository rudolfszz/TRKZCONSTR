// This middleware checks for CSRF tokens on all POST, PUT, DELETE requests
export function csrfProtection(req, res, next) {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const token = req.headers['x-csrf-token'] || req.body?._csrf;
        if (!token || token !== req.session.csrfToken) {
            return res.status(403).json({ error: 'Invalid or missing CSRF token' });
        }
    }
    next();
}

// To use: import and add to your routes or app.use()
