const express = require('express');
const router = express.Router();
const { supabase } = require('../supa');

// GET /auth/login
router.get('/login', (req, res) => {
    if (req.session.access_token) {
        return res.redirect('/dashboard');
    }
    const { returnTo } = req.query; // If we were redirected here
    res.render('login', { error: null, returnTo });
});

// POST /auth/login
router.post('/login', async (req, res) => {
    const { username, password, returnTo } = req.body;
    const email = `${username}@keyra-production-a826.up.railway.app`;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Save session
        if (data.session) {
            req.session.access_token = data.session.access_token;
            req.session.refresh_token = data.session.refresh_token;
            req.session.user = {
                id: data.user.id,
                email: data.user.email,
                user_metadata: data.user.user_metadata,
                app_metadata: data.user.app_metadata
            };
        }

        if (returnTo) {
            return res.redirect(returnTo);
        }
        res.redirect('/dashboard');
    } catch (err) {
        res.render('login', { error: err.message, returnTo });
    }
});

// GET /auth/signup
router.get('/signup', (req, res) => {
    if (req.session.access_token) {
        return res.redirect('/dashboard');
    }
    const { returnTo } = req.query;
    res.render('signup', { error: null, returnTo });
});

// POST /auth/signup
router.post('/signup', async (req, res) => {
    const { username, password, confirmPassword, returnTo } = req.body;
    const email = `${username}@keyra-production-a826.up.railway.app`;

    if (password !== confirmPassword) {
        return res.render('signup', { error: 'Passwords do not match', returnTo });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        // Depending on Supabase settings, user might need to confirm email.
        // If auto-confirm is on or just created:
        if (data.session) {
            req.session.access_token = data.session.access_token;
            req.session.refresh_token = data.session.refresh_token;
            req.session.user = {
                id: data.user.id,
                email: data.user.email,
                user_metadata: data.user.user_metadata,
                app_metadata: data.user.app_metadata
            };
            if (returnTo) return res.redirect(returnTo);
            return res.redirect('/dashboard');
        }

        // If email confirmation is required:
        res.render('login', {
            error: null,
            returnTo,
            message: 'Registration successful! Please check your email to confirm your account.'
        });

    } catch (err) {
        res.render('signup', { error: err.message, returnTo });
    }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
    await supabase.auth.signOut();
    req.session = null;
    res.redirect('/');
});

module.exports = router;
