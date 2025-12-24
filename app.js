const express = require('express');
const session = require('cookie-session');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.SUPABASE_URL]
        }
    }
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
    name: 'keyra:session',
    secret: process.env.SESSION_SECRET || 'default_secret',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// Passport Config
const passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Routes (Placeholder)
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/oauth', require('./routes/oauth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/webauthn'));

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Keyra Auth Provider running on ${process.env.SITE_URL}`);
});
