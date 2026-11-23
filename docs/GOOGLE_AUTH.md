# Setting up "Continue with Google"

Google sign-in is already built in, and the button shows on `/login` and `/signup`. It starts
working once you add two settings to the backend: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
Until then, clicking it explains that Google sign-in isn't set up yet ("coming soon" on the live
site). Setup takes about 10 minutes and is free.

## How it works

```
Browser ── "Continue with Google" ──► frontend /api/v1/auth/sign-in/social ──► backend
   ▲                                                                              │
   │                         returns Google's sign-in URL ◄──────────────────────┘
   │
   └── user picks an account on accounts.google.com
             │
             ▼
      <APP_URL>/api/v1/auth/callback/google  (frontend, forwarded to the backend)
             │   backend checks the code with Google, creates or finds the member,
             ▼   sets the session cookie
      /onboarding (new member) or the page they came from (returning member)
```

- **Sign-up page:** the button says "Sign up with Google as a business owner / an investor".
  The choice is passed along in a short-lived cookie, so the new account gets the right role.
- **Login page:** existing members sign straight in. A brand-new Google user who starts here
  becomes a business owner by default and can switch to investor on the onboarding page until
  they save their profile.
- **Same email, two methods:** if someone signed up with email and password and later uses
  Google with the same address, both sign-in methods lead to the same account (Google has
  confirmed the email).
- Google members still go through the same profile photo, profile and NID verification steps.
- Every Google sign-up and sign-in appears in the admin activity log.

## Step 1: Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with the
   Google account that should own the app (ideally a team account, not a personal one).
2. Top bar → project picker → **New project** → name it `SME Connect` → **Create**.

## Step 2: Configure the consent screen

1. Menu → **APIs & Services → OAuth consent screen** (in newer consoles: **Google Auth
   Platform → Branding**).
2. **User type: External** → Create.
3. Fill in:
   - App name: `SME Connect`
   - User support email: your team's email
   - App logo: optional (`frontend/public/images/logo.svg` exported as PNG)
   - Authorised domains: your live domain, e.g. `vercel.app` or your custom domain
   - Developer contact email
4. **Scopes:** add only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
   These are "non-sensitive" scopes, so Google doesn't need to review the app.
5. **Audience / Test users:** while the app is in *Testing* mode, only listed test users can
   sign in. Add your team's Gmail addresses. When you're ready for the public, click
   **Publish app**. With only basic scopes it goes live straight away.

## Step 3: Create the OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID** (or
   **Google Auth Platform → Clients → Create client**).
2. Application type: **Web application**. Name: `SME Connect web`.
3. **Authorised JavaScript origins:**
   - `http://localhost:3000` (local development)
   - `https://smeconnect.vercel.app` (your live frontend URL)
4. **Authorised redirect URIs** (must match exactly, including `https` and no trailing slash):
   - `http://localhost:3000/api/v1/auth/callback/google`
   - `https://smeconnect.vercel.app/api/v1/auth/callback/google`
5. **Create**, then copy the **Client ID** and **Client secret**.

> The redirect goes to the **frontend** URL, not the backend's. Browsers only ever talk to the
> frontend, which forwards `/api/v1/*` to the backend, so the sign-in cookies stay on one site.
> The backend builds the redirect URL from `APP_URL`, so `APP_URL` must be the frontend URL.

## Step 4: Add the settings

**Local development** (`backend/.env`, never committed):

```
GOOGLE_CLIENT_ID="1234567890-abc.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
APP_URL="http://localhost:3000"
```

Restart the backend. The button starts working within five minutes (the frontend caches the
setting briefly), or straight away after restarting the frontend.

**Production** (Vercel → backend project → Settings → Environment Variables): add the same
two variables, check that `APP_URL` is the live frontend URL, then redeploy the backend.

## Step 5: Test it

1. Open `/signup`, choose **I want to invest**, click **Sign up with Google as an investor**.
2. Pick a test account. You land on `/onboarding` as an investor, with your Google photo
   already set (you can change it or choose a blank photo).
3. Sign out, then use **Continue with Google** on `/login`. You go straight back in.
4. As admin, open **Admin panel → Activity log → Accounts / Sign-ins** to see both events.

## Troubleshooting

| What you see | Cause and fix |
| --- | --- |
| `Error 400: redirect_uri_mismatch` | The redirect URI in Google Cloud doesn't exactly match `<APP_URL>/api/v1/auth/callback/google`. Check http/https, the domain and no trailing slash. |
| `Error 403: access_denied` while in Testing | The Google account isn't in the test-user list. Add it, or publish the app. |
| Back on `/login` with "Google sign-in didn't complete" | The state cookie was lost: usually `APP_URL` points at the backend instead of the frontend, or the browser blocks cookies. |
| "Google sign-in isn't configured yet" | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is empty, or the backend wasn't restarted. Check `GET /api/v1/auth-options` returns `google: true`. |
| Google photo doesn't show | The frontend must allow `lh3.googleusercontent.com` (already set in `frontend/next.config.mjs`). |

## Security notes

- The client secret lives only in the backend's environment variables. It's never sent to
  the browser or committed to Git.
- Better Auth checks Google's `state` parameter (CSRF protection) and verifies the ID token
  with Google before creating a session.
- Members can't pick the ADMIN role through Google; the role cookie only accepts OWNER or INVESTOR.
- Suspended members are blocked whether they sign in with a password or with Google.
