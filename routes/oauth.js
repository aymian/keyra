const express = require('express');
const router = express.Router();
const { supabase } = require('../supa');

// Middleware to ensure user is logged in
const ensureLoggedIn = (req, res, next) => {
    if (!req.session.access_token) {
        // Redirect to login, but persist the current URL as returnTo to resume flow
        const returnTo = req.originalUrl;
        return res.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    next();
};

/**
 * GET /authorize
 * 
 * Standard OAuth2 authorization endpoint.
 * Validates params, checks user session, displays consent.
 */
router.get('/authorize', ensureLoggedIn, async (req, res) => {
    const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        nonce
    } = req.query;

    // 1. Validate Client ID & Redirect URI
    // Query our 'clients' table
    const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('client_id', client_id)
        .single();

    if (error || !client) {
        return res.status(400).send('Invalid client_id');
    }

    if (client.redirect_uri !== redirect_uri) {
        return res.status(400).send('Mismatching redirect_uri');
    }

    // 2. Check if user is logged in
    // Note: 'scope' is handled loosely here. In real OIDC, you'd validate/persist it.

    // Generate a transaction ID to track this consent flow securely
    const transaction_id = Math.random().toString(36).substring(7);

    // Store params in session or signed cookie to verify on POST
    req.session.oauth_transaction = {
        transaction_id,
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        nonce
    };

    res.render('consent', {
        user: req.session.user,
        client_name: client.name,
        client_id,
        scope: scope || 'email profile',
        redirect_uri,
        state,
        transaction_id
    });
});

/**
 * POST /decision
 * 
 * Handles the user's consent decision (Allow/Deny).
 */
router.post('/decision', ensureLoggedIn, (req, res) => {
    console.log('[OAuth:Decision] Received decision POST', req.body);
    try {
        const { decision, transaction_id } = req.body;
        const storedTransaction = req.session.oauth_transaction;

        console.log('[OAuth:Decision] Verifying transaction:', {
            received: transaction_id,
            stored: storedTransaction ? storedTransaction.transaction_id : 'null'
        });

        // Security check
        if (!storedTransaction || storedTransaction.transaction_id !== transaction_id) {
            console.error('[OAuth:Decision] Invalid transaction or session expired');
            return res.status(400).render('error', { error: 'Invalid transaction. Please try again.' });
        }

        // Clear transaction
        delete req.session.oauth_transaction;

        const { redirect_uri, state } = storedTransaction;
        console.log('[OAuth:Decision] Redirect URI:', redirect_uri);

        let url;
        try {
            url = new URL(redirect_uri);
        } catch (e) {
            console.error('[OAuth:Decision] Invalid Redirect URI stored:', redirect_uri);
            return res.status(500).render('error', { error: 'Invalid configuration: bad redirect_uri' });
        }

        if (decision === 'deny') {
            console.log('[OAuth:Decision] User denied access');
            url.searchParams.append('error', 'access_denied');
            if (state) url.searchParams.append('state', state);
            return res.redirect(url.toString());
        }

        if (decision === 'allow') {
            console.log('[OAuth:Decision] User allowed access');

            // Generate a placeholder code
            const code = 'spl_code_' + Math.random().toString(36).substring(2) + '_' + Date.now();
            console.log('[OAuth:Decision] Generated code:', code);

            url.searchParams.append('code', code);
            if (state) url.searchParams.append('state', state);

            const finalUrl = url.toString();
            console.log('[OAuth:Decision] Redirecting to:', finalUrl);
            return res.redirect(finalUrl);
        }

        // Fallback
        res.status(400).send('Invalid decision');

    } catch (err) {
        console.error('[OAuth:Decision] Unexpected error:', err);
        return res.status(500).render('error', { error: 'An unexpected error occurred during authorization.' });
    }
});

module.exports = router;
