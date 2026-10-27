# Mailcraft Studio

Internal email design workspace with D1 persistence, separate client brands, reusable versioned components, templates, image URL libraries, drag/drop, nested columns, undo/redo, desktop/mobile HTML preview and table-based HTML export.

## Template collection

The Templates tab opens a visual collection of six original starter designs, client templates, and shared team templates. Filter by campaign, industry, style, or search words/tags. Accurate miniatures and full-size previews use the same HTML renderer as email export. Desktop/mobile previews show the active client's logo and contact details; the colors/fonts switch chooses client styling or the template's original design styling. Creating an email clones every block into an independent saved draft.

Use **Save as template** from the editor's email settings to publish a snapshot with description, categories, tags, and client/shared scope. Publishing a new version preserves prior versions and existing email copies. The preview's version selector can use an older published version. Previously saved document templates remain available in the client library.

Starter definitions and catalog filtering live in `lib/email/catalog.ts`. Add a new starter by composing supported blocks and supplying its metadata and preview brand. Shared/client template versions are stored in `template_versions`; they require migration `0001_empty_arachne.sql`. No existing records are rewritten. Starter sale percentages, discount codes, and event details are editable sample copy.

Run `node --test scripts/test-email.mjs` for catalog/rendering tests. With the local preview and migrations running, `node scripts/test-workspace.mjs` tests persistence, concurrent saves, template versions, metadata validation, and library scope rules. This integration script creates clearly named QA records only in the loopback development database.

## Development

## Client onboarding packs

On **Clients → Import client pack**, select a `mailcraft-client-pack-v1` JSON file and review its summary before creating the workspace. The server validates the brand, document tree, image URLs, template metadata, and components, then saves everything in one database transaction. Reimporting an existing client opens it without replacing saved work. ID/domain conflicts are rejected; a failed import rolls back the whole transaction. This imports data only; it never executes code or sends email.

`lib/email/client-pack.ts` documents the portable format. `node scripts/create-hyundai-pack.mjs` prepares `outputs/hyundai-meridian-client-pack.json` for the hosted app. Use `--local` only for loopback development; it writes a separate `.local.json` with local asset URLs. Supplied coupon PNGs are copied unchanged under `public/clients/hyundai-of-meridian/` so exported emails can use public absolute image URLs. The Hyundai pack contains its brand kit, a draft, a client-only reusable template, four image-library entries, and three components. Service prices and eligibility come from the supplied artwork; contact details and destination URLs were checked against the dealership website. No expiration date or additional offer terms were invented.

Client/document deep links use `?client=<client-id>&email=<document-id>` and open the matching saved draft after authenticated workspace loading.

Node 22.13+ is required. Install with `npm install`, generate the schema with `npm run db:generate`, and build with `npm run build`. Apply the generated migrations using the D1 command in the starter README. Run `npm run dev`; local sign-in uses `/signin-with-chatgpt?return_to=/`.

## Structure

- `lib/email/model.ts`: typed document tree, built-in block registry/defaults, seed newsletter reconstructed from the supplied Toyota sample.
- `lib/email/render.ts`: shared HTML renderer used by preview and export. Escapes content and accepts http(s), mailto and telephone links only.
- `components/studio.tsx`: editor, nested drag/drop, client workspace, templates and component lifecycle.
- `app/api/studio/route.ts`: authenticated API with validation, client references, immutable component versions, optimistic revision checks and same-origin writes.
- `db/schema.ts` / `drizzle/`: persistent client, document, component-version and image URL records.

## Extending components

Most team-created components are saved trees of existing blocks, without code. New primitives require a `types` entry, default properties in `newBlock`, a label/icon, editor controls, canvas rendering and a `renderBlock` exporter case. Backend validation derives supported block types from the registry. Brand placeholders resolve when rendered for the active client. Component insertions clone content and retain a source/version reference; updates never rewrite existing email copies. Published versions are immutable.

## Access and deployment

Sign-in is built into the app: email and password, accounts created only by an administrator, no public sign-up. Every API route except the recipient-facing `/unsubscribe` and `/r/<token>` pages requires an active signed-in account, and writes must come from the same origin.

- **First administrator:** set a `SETUP_TOKEN` secret (for local development put `SETUP_TOKEN=...` in `.dev.vars`). While no accounts exist, the sign-in page shows a first-time setup form that asks for that token. Setup closes itself once an account exists; remove the token afterwards.
- **Team access:** administrators open **Manage team access** from the account menu (`/users`) to add people, change roles, reset passwords and deactivate accounts. A new or reset account gets a one-time temporary password and must choose its own at first sign-in. Administrators cannot deactivate or demote themselves, and at least one active administrator must remain.
- **Passwords and sessions:** PBKDF2-SHA256 hashes (the iteration count is stored per hash), at least 12 characters, five failed sign-ins lock an account for 15 minutes, sessions last at most 7 days or 12 hours idle, and the session cookie is HttpOnly, SameSite=Lax and Secure over HTTPS. Changing or resetting a password signs out other devices.
- **Tests:** `node scripts/test-auth.mjs` runs the password checks, and with `MAILCRAFT_QA_ADMIN_EMAIL`/`MAILCRAFT_QA_ADMIN_PASSWORD` set it runs the full flow against a local copy. The other integration scripts read `MAILCRAFT_QA_EMAIL`/`MAILCRAFT_QA_PASSWORD`.

Test emails need a `SENDGRID_API_KEY` server secret (Mail Send permission only) and a saved, verified sender per client; live sending and scheduling are not enabled. Apply every migration in `drizzle/` to the database before running a new version. Client segmentation is organizational, not separate external-client authorization; all signed-in team members can see every client.

Images use existing public hosting/CDNs so they remain accessible to email recipients. This version stores image URLs, not uploaded binaries. Verify exported email appearance in your sending platform and actual email clients; browser preview is not a substitute for Outlook/Gmail testing. Add the sending platform's unsubscribe field before sending. The app does not send campaigns.

Manual Save changes persists drafts to D1. Unsaved changes are indicated and protected on navigation. Simultaneous stale saves receive a conflict instead of overwriting newer content. JSON backups can be downloaded to recover unsaved work after a conflict; JSON import is not included yet.
