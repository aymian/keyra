const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../supa');

// In-memory storage for authorization codes (in production, use Redis or database)
// Structure: { code: { user_id, client_id, scope, expires_at, used } }
const authorizationCodes = new Map();

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
    const { data: client, error } = await supabaseAdmin
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
        client_name: client.name,
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
            return res.render('redirect', {
                url: url.toString(),
                client_name: storedTransaction.client_name || 'the application'
            });
        }

        if (decision === 'allow') {
            console.log('[OAuth:Decision] User allowed access');

            // Generate authorization code
            const code = 'spl_code_' + Math.random().toString(36).substring(2) + '_' + Date.now();
            console.log('[OAuth:Decision] Generated code:', code);

            // Store authorization code with metadata (expires in 10 minutes)
            authorizationCodes.set(code, {
                user_id: req.session.user.id,
                client_id: storedTransaction.client_id,
                scope: storedTransaction.scope || 'email profile',
                expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes
                used: false
            });

            url.searchParams.append('code', code);
            if (state) url.searchParams.append('state', state);

            const finalUrl = url.toString();
            console.log('[OAuth:Decision] Redirecting to:', finalUrl);
            return res.render('redirect', {
                url: finalUrl,
                client_name: storedTransaction.client_name || 'your application'
            });
        }

        // Fallback
        res.status(400).send('Invalid decision');

    } catch (err) {
        console.error('[OAuth:Decision] Unexpected error:', err);
        return res.status(500).render('error', { error: 'An unexpected error occurred during authorization.' });
    }
});

/**
 * POST /token
 * 
 * OAuth2 token endpoint - exchanges authorization code for access token
 */
router.post('/token', async (req, res) => {
    console.log('[OAuth:Token] Received token request', req.body);

    try {
        const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;

        // Validate grant_type
        if (grant_type !== 'authorization_code') {
            return res.status(400).json({
                error: 'unsupported_grant_type',
                error_description: 'Only authorization_code grant type is supported'
            });
        }

        // Validate required parameters
        if (!code || !client_id || !client_secret) {
            return res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing required parameters'
            });
        }

        // Validate client credentials
        const { data: client, error: clientError } = await supabaseAdmin
            .from('clients')
            .select('*')
            .eq('client_id', client_id)
            .eq('client_secret', client_secret)
            .single();

        if (clientError || !client) {
            console.error('[OAuth:Token] Invalid client credentials');
            return res.status(401).json({
                error: 'invalid_client',
                error_description: 'Invalid client credentials'
            });
        }

        // Validate authorization code
        const codeData = authorizationCodes.get(code);

        if (!codeData) {
            console.error('[OAuth:Token] Invalid or expired authorization code');
            return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid or expired authorization code'
            });
        }

        // Check if code has been used
        if (codeData.used) {
            console.error('[OAuth:Token] Authorization code already used');
            authorizationCodes.delete(code);
            return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Authorization code has already been used'
            });
        }

        // Check if code has expired
        if (Date.now() > codeData.expires_at) {
            console.error('[OAuth:Token] Authorization code expired');
            authorizationCodes.delete(code);
            return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Authorization code has expired'
            });
        }

        // Validate client_id matches
        if (codeData.client_id !== client_id) {
            console.error('[OAuth:Token] Client ID mismatch');
            return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Authorization code was issued to a different client'
            });
        }

        // Mark code as used
        codeData.used = true;

        // Get user data
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(codeData.user_id);

        if (userError || !userData.user) {
            console.error('[OAuth:Token] User not found');
            return res.status(500).json({
                error: 'server_error',
                error_description: 'Failed to retrieve user data'
            });
        }

        const user = userData.user;

        // Generate access token (in production, use JWT with proper signing)
        const access_token = 'keyra_at_' + Math.random().toString(36).substring(2) + '_' + Date.now();
        const refresh_token = 'keyra_rt_' + Math.random().toString(36).substring(2) + '_' + Date.now();

        console.log('[OAuth:Token] Successfully issued tokens for user:', user.id);

        // Return token response
        res.json({
            access_token,
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token,
            scope: codeData.scope || 'email profile',
            // Include user info for convenience (optional in OAuth2, standard in OIDC with id_token)
            user: {
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata,
                app_metadata: user.app_metadata
            }
        });

        // Clean up used code after a delay
        setTimeout(() => {
            authorizationCodes.delete(code);
        }, 60000); // Delete after 1 minute

    } catch (err) {
        console.error('[OAuth:Token] Unexpected error:', err);
        return res.status(500).json({
            error: 'server_error',
            error_description: 'An unexpected error occurred'
        });
    }
});

module.exports = router;
module.exports.authorizationCodes = authorizationCodes;
