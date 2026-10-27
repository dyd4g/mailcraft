// Container entrypoint: apply database migrations, then start the production server.
import { spawn, spawnSync } from 'node:child_process';

const migrate = spawnSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit' });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const port = process.env.PORT || '3000';
const server = spawn(process.execPath, ['node_modules/vinext/dist/cli.js', 'start', '--port', port, '--hostname', '0.0.0.0'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
