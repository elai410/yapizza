# Setting up live keys

Every service runs in sim mode with no keys. Each one switches to live when its keys are in `.env`. Restart `pnpm dev` after any change to `.env`.

## 1. Grok (xAI)

1. Create an API key in the xAI console.
2. Set `XAI_API_KEY`. Leave `GROK_MODE` blank (live with a key, replay without one).
3. Run `pnpm grok:record` before the demo so every demo input also works offline.

## 2. Google Cloud (Gmail intake, Calendar insert, sign-in)

1. Create a project in Google Cloud Console.
2. Enable the Gmail API and the Google Calendar API.
3. OAuth consent screen: User type External, publishing status Testing. Add the intake inbox and every demo student account as test users.
4. Credentials: create an OAuth client ID, type Web application, with these authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `http://localhost:3005/oauth2callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Set `GMAIL_INTAKE_ADDRESS` to the intake inbox address.
7. Run `pnpm google:token`, sign in as the intake inbox, and copy the printed `GMAIL_INTAKE_REFRESH_TOKEN=...` line into `.env`.
8. Run `pnpm worker` alongside `pnpm dev` to poll the inbox.

Scopes: `gmail.readonly` for the intake inbox, `calendar.events` for students.

Yale Google accounts may block unverified apps. If they do, use a personal Gmail for the intake inbox and for the calendar demo. Refresh tokens from a Testing app expire after 7 days; rerun `pnpm google:token` when Gmail intake stops.

## 3. Email alerts (Resend)

1. Create an API key in Resend.
2. Set `RESEND_API_KEY` and `ALERT_FROM_EMAIL` (an address on a domain verified in Resend, or `onboarding@resend.dev` for testing).

## 4. Bad Wi-Fi

Set `YAPIZZA_FORCE_SIM=1` to force every service, Grok included, to sim or replay. Set it back to `0` to go live again.

## 5. Check

Restart `pnpm dev`, then open `/demo` or `/api/integrations/status`. Each service shows `live` or `sim`.
