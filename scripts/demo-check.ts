// Owner: qa-demo. Last step of `pnpm demo:check`: prints which services are live or sim.
const BASE = process.env.YAPIZZA_BASE_URL ?? 'http://localhost:3000';

async function main() {
  try {
    const res = await fetch(`${BASE}/api/integrations/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const status = (await res.json()) as Record<string, unknown>;
    for (const [service, mode] of Object.entries(status)) console.log(`${service.padEnd(10)} ${mode}`);
  } catch (err) {
    console.error(`integration status unavailable at ${BASE}: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

main();

export {};
