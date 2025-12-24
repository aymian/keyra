const passport = require('passport');
const WebAuthnStrategy = require('passport-fido2-webauthn');
const { supabaseAdmin } = require('../supa');

passport.use(new WebAuthnStrategy({
    // Retrieve the user from the database by their ID
    // In a real app, you might look up by username/email first if using conditional UI or username-first flow
    // For this strategy, the 'username' (or userHandle) is often passed during the assertion phase
    origin: process.env.SITE_URL || 'http://localhost:3000',
    store: {
        // Callback to get a user's registered credentials
        // id: The credential ID (base64url encoded usually)
        challenge: (req, cb) => {
            // Retrieve challenge from session
            const challenge = req.session.challenge;
            delete req.session.challenge; // Single use
            cb(null, challenge);
        },
        user: async (id, cb) => {
            // 'id' here is the User Handle (user.id) provided during registration
            try {
                const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(id);
                if (error) return cb(error);
                cb(null, { id: user.user.id, email: user.user.email, displayName: user.user.user_metadata.full_name });
            } catch (err) {
                cb(err);
            }
        },
        token: async (credentialId, cb) => {
            // Retrieve the public key for this credential ID
            try {
                const { data, error } = await supabaseAdmin
                    .from('authenticators')
                    .select('public_key, user_id, counter')
                    .eq('credential_id', credentialId)
                    .single();

                if (error || !data) return cb(null, null);

                cb(null, {
                    publicKey: data.public_key,
                    user: { id: data.user_id },
                    counter: data.counter
                });
            } catch (err) {
                cb(err);
            }
        }
    }
}, async (destination, user, result, cb) => {
    // Verification successful
    // Update the counter in the DB
    try {
        await supabaseAdmin
            .from('authenticators')
            .update({ counter: result.counter, last_used: new Date() })
            .eq('credential_id', result.id);

        cb(null, user);
    } catch (err) {
        cb(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(id);
        if (error) return done(error);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
