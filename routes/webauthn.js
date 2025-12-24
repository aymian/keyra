const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { supabaseAdmin } = require('../supa');
const base64url = require('base64url');

// Server-side verification library (Required)
let verifyRegistrationResponse;
try {
    const SimpleWebAuthnServer = require('@simplewebauthn/server');
    verifyRegistrationResponse = SimpleWebAuthnServer.verifyRegistrationResponse;
} catch (e) {
    console.warn('@simplewebauthn/server not found. Registration verification will fail until installed.');
}

// REGISTER: Get Challenge
router.post('/register/public-key/challenge', async (req, res) => {
    if (!req.session.access_token) return res.status(401).json({ error: 'Unauthorized' });

    // Generate challenge
    const challenge = require('crypto').randomBytes(32);
    req.session.challenge = base64url.encode(challenge);

    // User info for the authenticator
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.session.access_token);

    res.json({
        challenge: req.session.challenge,
        user: {
            id: user.id,
            name: user.email,
            displayName: user.user_metadata.full_name || user.email
        }
    });
});

// REGISTER: Verify & Save
router.post('/register/public-key', async (req, res) => {
    if (!req.session.access_token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { body } = req;
        const user = req.session.user;

        const expectedChallenge = req.session.challenge;

        if (!verifyRegistrationResponse) {
            return res.status(500).json({ error: 'Server missing @simplewebauthn/server dependency. Please install it.' });
        }

        // Verify the attestation
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: [
                'http://localhost:3000',
                process.env.SITE_URL,
                'https://keyra-production-a826.up.railway.app'
            ],
            expectedRPID: process.env.RP_ID || 'keyra-production-a826.up.railway.app', // Should match the domain
            requireUserVerification: false,
        });

        const { verified, registrationInfo } = verification;

        if (verified && registrationInfo) {
            const { credentialPublicKey, credentialID, counter } = registrationInfo;

            // Store in DB
            const credentialIDBase64 = base64url.encode(credentialID);
            const publicKeyBase64 = base64url.encode(credentialPublicKey);

            const { error: dbError } = await supabaseAdmin
                .from('authenticators')
                .insert({
                    credential_id: credentialIDBase64,
                    user_id: user.id,
                    public_key: publicKeyBase64,
                    counter: counter,
                    transports: body.response.transports ? body.response.transports.join(',') : null
                });

            if (dbError) throw dbError;

            delete req.session.challenge;
            return res.json({ verified: true });
        } else {
            return res.status(400).json({ verified: false, error: 'Verification failed' });
        }

    } catch (e) {
        console.error('Registration failed:', e);
        res.status(500).json({ error: e.message });
    }
});

// LOGIN: Get Challenge
router.post('/login/public-key/challenge', (req, res) => {
    const challenge = require('crypto').randomBytes(32);
    req.session.challenge = base64url.encode(challenge);
    res.json({ challenge: req.session.challenge });
});

// LOGIN: Verify (Passport Strategy)
router.post('/login/public-key',
    passport.authenticate('webauthn', {
        failureRedirect: '/auth/login?error=Invalid+Passkey'
    }),
    (req, res) => {
        // Successful authentication
        req.session.user = {
            id: req.user.id,
            email: req.user.email,
            user_metadata: req.user.user_metadata
        };

        // Handle redirect
        const redirect = req.session.returnTo || '/developers';
        delete req.session.returnTo;

        res.json({ success: true, redirect });
    }
);

module.exports = router;
