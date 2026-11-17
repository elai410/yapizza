// Owner: integrations. `pnpm google:token`: sign in as the intake inbox, print its Gmail refresh token.
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { oauthClient } from '../src/lib/adapters/live/google';

const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Set ${missing.join(' and ')} in .env, then rerun pnpm google:token.`);
  process.exit(1);
}

const PORT = 3005;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const state = randomBytes(16).toString('hex');
const client = oauthClient(REDIRECT);
const url = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  state,
});

const server = createServer(async (req, res) => {
  const q = new URL(req.url ?? '/', REDIRECT);
  if (q.pathname !== '/oauth2callback') return void res.writeHead(404).end();
  const code = q.searchParams.get('code');
  if (q.searchParams.get('state') !== state || !code) {
    res.writeHead(400).end('State mismatch or missing code.');
    return;
  }
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error('No refresh token returned. Remove the app at myaccount.google.com/permissions and retry.');
    res.end('Done. Return to the terminal.');
    console.log(`\nGMAIL_INTAKE_REFRESH_TOKEN=${tokens.refresh_token}`);
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end('Token exchange failed. See terminal.');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`${REDIRECT} must be an authorized redirect URI on the OAuth client.`);
  console.log(`Sign in as the intake inbox:\n${url}`);
  execFile('open', [url], () => {});
});
