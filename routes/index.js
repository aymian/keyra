const express = require('express');
const router = express.Router();
const { supabase } = require('../supa');

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
    if (!req.session.access_token) {
        return res.redirect('/auth/login');
    }

    const { data: { user }, error } = await supabase.auth.getUser(req.session.access_token);

    if (error || !user) {
        req.session = null;
        return res.redirect('/auth/login');
    }

    req.user = user;
    next();
};

router.get('/', (req, res) => {
    res.render('index', { user: req.session.user || null });
});

// Developer Portal - List Apps
router.get('/developers', async (req, res) => {
    const user = req.session.user || null;
    let clients = [];

    if (user) {
        // Fetch users apps
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            clients = data;
        }
    }

    res.render('developers', { user, clients });
});

// Create New App
router.post('/developers/create', requireAuth, async (req, res) => {
    const { name, website, redirect_uri } = req.body;
    const client_id = 'kp_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const client_secret = 'ksec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const { error } = await supabase
        .from('clients')
        .insert({
            user_id: req.user.id,
            name,
            website,
            redirect_uri,
            client_id,
            client_secret
        });

    if (error) {
        console.error('Error creating app:', error);
        // ideally flash error
    }
    res.redirect('/developers');
});

// Delete App
router.post('/developers/delete', requireAuth, async (req, res) => {
    const { id } = req.body;

    await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

    res.redirect('/developers');
});

router.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard', { user: req.user });
});

// Protected Example endpoint
router.get('/api/me', requireAuth, (req, res) => {
    res.json({
        user_id: req.user.id,
        email: req.user.email,
        app_metadata: req.user.app_metadata,
        user_metadata: req.user.user_metadata,
        aud: req.user.aud
    });
});

module.exports = router;
