# Mailcraft Studio

Internal email design workspace for a team that builds newsletters for several clients: drag-and-drop editor, reusable
components and templates, per-client brand kits, campaigns, audiences, raw-data reports, and SendGrid test email.
Feature details are in [README-MAILCRAFT.md](README-MAILCRAFT.md). Hosting on Azure is in [docs/AZURE.md](docs/AZURE.md).

Runs on plain Node (Node 22.13 or newer) with [vinext](https://github.com/cloudflare/vinext) and PostgreSQL.

## Run it locally

You need a PostgreSQL database. Without Docker, a bundled one can run for development:

```bash
npm install
node scripts/dev-db.mjs            # leave running; prints DATABASE_URL
```

In another terminal, create `.env.local` (git-ignored):

```
DATABASE_URL=postgres://mailcraft:mailcraft@127.0.0.1:54329/mailcraft
SETUP_TOKEN=choose-any-long-random-value
```

```bash
npm run db:migrate
npm run dev                         # http://127.0.0.1:5173
```

Open the site and use the setup token to create the first administrator. With Docker instead: `docker compose up --build`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 5173 |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:generate` | New SQL migration after changing `db/*.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm test` | Unit tests (no server needed) |
| `npm run lint` | Lint |

Integration tests (`scripts/test-auth.mjs`, `test-campaigns.mjs`, `test-workspace.mjs`) run against a local copy of the app; see
the notes in README-MAILCRAFT.md.
