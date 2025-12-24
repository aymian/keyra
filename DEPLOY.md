# How to Host Keyra

Keyra is a Node.js application that can be hosted on any platform that supports Node.js.

## Option 1: Render (Recommended for persistence)
Render is great because it keeps your server running (Standard Node.js).

1.  Push your code to a GitHub repository.
2.  Go to [dashboard.render.com](https://dashboard.render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Settings**:
    *   **Runtime**: Node
    *   **Build Command**: `pnpm install` (or `npm install`)
    *   **Start Command**: `node app.js`
6.  **Environment Variables**:
    *   Add all keys from your `.env` file (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`, `DEFAULT_RETURN_URL`, etc).
    *   Set `NODE_VERSION` to `18` or higher if needed.

## Option 2: Railway
Railway is very simple and robust.

1.  Push code to GitHub.
2.  Go to [railway.app](https://railway.app/).
3.  Click **New Project** -> **Deploy from GitHub repo**.
4.  Railway will auto-detect Node.js.
5.  Go to **Variables** tab and add your `.env` variables.
6.  Go to **Settings** -> **Generate Domain** to get a public URL (e.g., `keyra-production.up.railway.app`).
7.  **Important**: Update `app.js` or `.env` `SITE_URL` and `Supabase` Redirect URIs to match this new domain.

## Option 3: Vercel (Serverless)
I have added a `vercel.json` file to make this easy.

1.  Push code to GitHub.
2.  Go to [vercel.com](https://vercel.com).
3.  **Add New...** -> **Project**.
4.  Import your repository.
5.  **Environment Variables**: Paste your `.env` content.
6.  Deploy.

## Post-Deployment Checklist

1.  **Update Supabase Redirects**:
    *   Go to Supabase Dashboard > Authentication > URL Configuration.
    *   Add your new production URL (e.g., `https://keyra.onrender.com/**`) to **Redirect URLs**.
2.  **Update Environment Variables**:
    *   Change `SITE_URL` in your hosting dashboard to the real domain.
    *   Change `DEFAULT_RETURN_URL` to your real app URL.

## Custom Domains
If you own `keyra.com`:
1.  Add the domain in your hosting provider (Render/Vercel/Railway) settings.
2.  Update DNS records (A/CNAME) as instructed by them.
