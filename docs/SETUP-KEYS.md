# Setting up live keys

Every service runs in sim mode with no keys. Each one switches to live when its keys are in `.env`. Restart `pnpm dev` after any change to `.env`, then check `/api/integrations/status` (or `/demo`): each service shows `live` or `sim`.

If `.env` doesn't exist yet: `cp .env.example .env`.

## Fastest path

| Goal | Time | Keys | Steps |
|---|---|---|---|
| Grok reads emails and flyers | 2 min | `XAI_API_KEY` | Section 1 |
| Alert emails really send | 3 min | `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | Section 3 |
| Students sign in with Google, events land on their real calendar | 10 min | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Section 2, steps 1 to 5 |
| Forwarding to a real inbox creates cards | +5 min | `GMAIL_INTAKE_REFRESH_TOKEN` | Section 2, steps 6 to 8 |

Each row works on its own. Do them in this order.

## 1. Grok (xAI)

1. Create an API key at https://console.x.ai (API Keys).
2. Set `XAI_API_KEY=...` in `.env`. Leave `GROK_MODE` blank (live with a key, replay without one).
3. Restart `pnpm dev`. Status shows `"grok":"live"`.
4. On demo day, run `pnpm grok:record` so every demo input also works offline. Replay files include the date, so record on the day you present.

If calls fail on the model name, check https://docs.x.ai/docs/models and set `GROK_MODEL`.

## 2. Google Cloud (sign-in, Calendar insert, Gmail intake)

1. Create a project at https://console.cloud.google.com/projectcreate.
2. Enable both APIs for the project:
   - https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
3. OAuth consent screen (https://console.cloud.google.com/apis/credentials/consent): user type External, publishing status Testing. Add every Google account you'll sign in with as a test user: the intake inbox and each demo phone or laptop account. Accounts not on this list get "access blocked".
4. Credentials (https://console.cloud.google.com/apis/credentials): Create credentials, OAuth client ID, type Web application. Add both authorized redirect URIs exactly:
   - `http://localhost:3000/api/auth/google/callback`
   - `http://localhost:3005/oauth2callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Restart `pnpm dev`. Status shows `"auth":"live"` and `"gcal":"live"`. Students now see Sign in with Google (`/api/auth/google`), and Add to calendar inserts into their real calendar. The five demo students still work and still use the sim calendar.
6. Set `GMAIL_INTAKE_ADDRESS` to the intake inbox address.
7. Run `pnpm google:token`. It opens a browser. Sign in as the intake inbox, then copy the printed `GMAIL_INTAKE_REFRESH_TOKEN=...` line into `.env`.
8. Restart `pnpm dev` and start `pnpm worker` in another terminal. The worker polls the inbox. Status shows `"gmail":"live"`.

Scopes: `gmail.readonly` for the intake inbox, `calendar.events` for students.

Yale Google accounts may block unverified apps. If they do, use a personal Gmail for the intake inbox and for the calendar demo. Refresh tokens from a Testing app expire after 7 days. Rerun `pnpm google:token` when Gmail intake stops.

## 3. Email alerts (Resend)

1. Create an API key at https://resend.com/api-keys.
2. Set `RESEND_API_KEY` and `ALERT_FROM_EMAIL`.
   - Without a verified domain, use `ALERT_FROM_EMAIL=onboarding@resend.dev`. Resend then only delivers to the address on your Resend account, so subscribe with that address in the demo.
   - With a domain verified in Resend, use any address on it.
3. Restart `pnpm dev`. Status shows `"notify":"live"`. Every alert still shows in `/sim/outbox` with mode `live`.

## 4. Bad Wi-Fi

Set `YAPIZZA_FORCE_SIM=1` to force every service, Grok included, to sim or replay. Set it back to `0` to go live again. Restart `pnpm dev` either way.

## 5. When a live call fails

A failed live call never shows an error page. That request falls back to sim and the error goes to the `pnpm dev` log:

| Service | On failure |
|---|---|
| Gmail intake | Logs `[gmail] pull failed`, returns what it already read, retries next poll |
| Calendar insert | Logs the error, adds the event to `/sim/calendar`, returns mode `sim` |
| Alerts | Logs `[notify:live] send failed`, writes the alert to `/sim/outbox` as `sim` |
| Google sign-in | Redirects to `/?signin=failed`; the demo students still work |
| Grok | Falls back to the rule-based reader; low-confidence events go to review |
