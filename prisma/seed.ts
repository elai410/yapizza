// Owner: api. `prisma db seed` entry point; the loader lives in src/lib/db/seed.ts so the demo reset can reuse it.
import { prisma } from '../src/lib/db';
import { seedFromFile } from '../src/lib/db/seed';

seedFromFile()
  .then((r) => console.log(`seed: ${r.events} events, ${r.listings} listings, ${r.skipped} skipped`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
