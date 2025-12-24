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

router.get('/developers', (req, res) => {
    res.render('developers', { user: req.session.user || null });
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
