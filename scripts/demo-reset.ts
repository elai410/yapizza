// Owner: qa-demo. Runs after `pnpm db:reset`: asks the running app to clear the sim inbox and outbox.
const BASE = process.env.YAPIZZA_BASE_URL ?? 'http://localhost:3000';

async function main() {
  try {
    const res = await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
    console.log(`demo reset: POST /api/demo/reset -> ${res.status} ${await res.text()}`);
  } catch {
    console.log(`demo reset: app not reachable at ${BASE}; database reset only. Start pnpm dev and rerun to clear the sim inbox and outbox.`);
  }
}

main();

export {};
