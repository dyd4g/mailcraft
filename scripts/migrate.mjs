// Applies the SQL migrations in ./drizzle to the database named by DATABASE_URL. Safe to run on every start:
// already-applied migrations are skipped. Retries while the database is still starting.
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL?.trim();
if (!url) { console.error('DATABASE_URL is not set.'); process.exit(1); }
const folder = fileURLToPath(new URL('../drizzle', import.meta.url));
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 });
let lastError;
for (let attempt = 1; attempt <= 30; attempt++) {
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
    console.log('Database migrations are up to date.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.log(`Database not ready (attempt ${attempt}/30): ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
console.error('Could not apply migrations:', lastError?.message);
process.exit(1);
