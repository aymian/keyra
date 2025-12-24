const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supa');
const oauthRouter = require('./oauth');

// Middleware to ensure user is logged in
const requireAuth = async (req, res, next) => {
    if (!req.session.access_token) {
        return res.redirect('/auth/login');
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(req.session.access_token);

    if (error || !user) {
        req.session = null;
        return res.redirect('/auth/login');
    }

    req.user = user;
    next();
};

// Admin Dashboard - OAuth Debug View
router.get('/oauth-debug', requireAuth, async (req, res) => {
    try {
        // Get all clients for this user
        const { data: clients, error: clientsError } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (clientsError) {
            console.error('Error fetching clients:', clientsError);
        }

        // Get authorization codes from the oauth module
        const authCodes = [];
        if (oauthRouter.authorizationCodes) {
            oauthRouter.authorizationCodes.forEach((value, key) => {
                // Only show codes for this user's clients
                const clientIds = (clients || []).map(c => c.client_id);
                if (clientIds.includes(value.client_id)) {
                    authCodes.push({
                        code: key,
                        ...value,
                        expires_in_seconds: Math.max(0, Math.floor((value.expires_at - Date.now()) / 1000))
                    });
                }
            });
        }

        res.render('admin/oauth-debug', {
            user: req.user,
            clients: clients || [],
            authCodes,
            currentTime: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error in oauth-debug:', err);
        res.status(500).render('error', { error: 'Failed to load OAuth debug data' });
    }
});

// API endpoint to get OAuth data as JSON
router.get('/api/oauth-data', requireAuth, async (req, res) => {
    try {
        const { data: clients } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('user_id', req.user.id);

        const authCodes = [];
        if (oauthRouter.authorizationCodes) {
            oauthRouter.authorizationCodes.forEach((value, key) => {
                const clientIds = (clients || []).map(c => c.client_id);
                if (clientIds.includes(value.client_id)) {
                    authCodes.push({
                        code: key,
                        ...value,
                        expires_in_seconds: Math.max(0, Math.floor((value.expires_at - Date.now()) / 1000))
                    });
                }
            });
        }

        res.json({
            timestamp: new Date().toISOString(),
            user: {
                id: req.user.id,
                email: req.user.email
            },
            clients: clients || [],
            authorization_codes: authCodes
        });
    } catch (err) {
        console.error('Error in oauth-data API:', err);
        res.status(500).json({ error: 'Failed to fetch OAuth data' });
    }
});

module.exports = router;
