// Starts a local PostgreSQL for development and tests without Docker (data lives in ./.data/postgres).
// Leave it running, then in another terminal:
//   $env:DATABASE_URL='postgres://mailcraft:mailcraft@127.0.0.1:54329/mailcraft'; npm run db:migrate; npm run dev
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.DEV_DB_PORT || 54329);
const databaseDir = new URL('../.data/postgres', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const server = new EmbeddedPostgres({ databaseDir, user: 'mailcraft', password: 'mailcraft', port, persistent: true, onLog: () => {}, onError: (e) => console.error(String(e)) });
if (!existsSync(`${databaseDir}/PG_VERSION`)) await server.initialise();
await server.start();
try { await server.createDatabase('mailcraft'); } catch { /* already exists */ }
console.log(`PostgreSQL is running.\nDATABASE_URL=postgres://mailcraft:mailcraft@127.0.0.1:${port}/mailcraft\nPress Ctrl+C to stop.`);
const stop = async () => { await server.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
