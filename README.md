# Keyra - Custom OAuth 2.1 Provider

A custom OAuth 2.1 / OIDC provider/wrapper built with Node.js, Express, and Supabase Auth. Keyra provides a centralized login experience ("Login with Keyra") for your ecosystem of applications.

## Features

-   **Centralized Identity**: Single Sign-On (SSO) backed by Supabase.
-   **Modern UI**: Beautiful, responsive interface using Tailwind CSS.
-   **Custom Consent**: Granular scope approval screens.
-   **Developer Ready**: Simple integration for OAuth2 clients.

## Setup Instructions

### 1. Supabase Setup

1.  Create a new project at [supabase.com](https://supabase.com).
2.  Go to **Authentication > Providers** and ensure **Email** is enabled.
3.  (Optional) For "Login with Keyra" to work as a true OIDC provider for other Supabase apps:
    -   Go to **Authentication > Configuration > Global/General**.
    -   Enable **"Use a custom SMTP server"** if you want custom emails (recommended for production).
    -   **Important**: This Keyra app acts as the *Interface*.
4.  Get your project credentials:
    -   Project URL (`SUPABASE_URL`)
    -   Anon Key (`SUPABASE_ANON_KEY`)
    -   Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)

### 2. Local Installation

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Run the Server

```bash
pnpm run dev
# Server running at http://localhost:3000
```

## Integration Guide for Third-Party Apps

To allow users to "Login with Keyra" in your other applications:

### Endpoints

-   **Authorization Endpoint**: `https://your-keyra-domain.com/oauth/authorize`
-   **Token Endpoint**: `https://<your-project-ref>.supabase.co/auth/v1/token` (Standard Supabase)

### Example Request

Redirect your users to:

```
GET /oauth/authorize?
  client_id=<YOUR_CLIENT_ID>
  &redirect_uri=https://your-app.com/callback
  &response_type=code
  &scope=email profile
  &state=xyz123
```

### Response

If the user approves, Keyra will redirect back to:

```
https://your-app.com/callback?code=<CODE>&state=xyz123
```

*Note: In this custom implementation, ensuring the `code` is valid for exchange against Supabase requires specific "Supabase OAuth Server" configuration or a custom exchange middleware.*

## Project Structure

-   `app.js`: Main server entry point and middleware configuration.
-   `routes/`:
    -   `auth.js`: Login, Signup, Logout logic.
    -   `oauth.js`: Authorization and Consent flow.
    -   `index.js`: Landing page and protected API examples.
-   `views/`: EJS templates for all pages.
-   `public/`: Static assets.

## Deployment

### Vercel / Railway / Render

1.  Push code to GitHub.
2.  Import project.
3.  Add environment variables (`SUPABASE_URL`, `SESSION_SECRET`, etc.).
4.  Deploy!

---
Built with ❤️ using Express & Supabase.
