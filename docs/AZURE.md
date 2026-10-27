# Hosting Mailcraft Studio on Azure

Status: the application, the PostgreSQL port and the container start-up were tested locally (real PostgreSQL, plain Node,
production build). The Docker image and the Azure template in `infra/azure/` have **not been run yet**; expect to fix small
things on the first deployment.

## What gets created

| Resource | Purpose |
| --- | --- |
| Azure Container Apps (one app, one environment) | Runs the website and API over HTTPS. Exactly one copy runs (migrations run at start). |
| Azure Database for PostgreSQL, Flexible Server (Burstable B1ms, 32 GB, PostgreSQL 16) | All data. Automatic backups kept for 7 days. |
| Azure Container Registry (Basic) | Holds the built image. The app pulls it with a managed identity, not a password. |
| Log Analytics workspace | Application logs (30 days). |

## Before you start

1. Install the Azure CLI and sign in: `az login`. Choose the subscription: `az account set --subscription "<name>"`.
2. Your account needs permission to create resources and role assignments in the resource group (Owner, or Contributor plus
   User Access Administrator). If something is refused, ask your Azure administrator for that role on one resource group.
3. Decide the public address. You can start with the address Azure assigns (`https://mailcraft-app.<random>.<region>.azurecontainerapps.io`)
   and add a company domain later.

## Deploy

From the project folder:

```powershell
./infra/azure/deploy.ps1 -ResourceGroup mailcraft-rg -Location eastus
```

The script shows the subscription and asks for a `yes`, then:

1. creates the resource group, registry, database and environment,
2. builds the container image inside the registry (no local Docker needed),
3. creates the container app and prints its address.

Secrets (database password, setup token, SendGrid key) are generated once into `infra/azure/.secrets/mailcraft.json`. That file is
git-ignored. **Back it up** (password manager); the script reuses it on later runs.

## First sign-in

Open the printed address. While no accounts exist the page shows "Create the first administrator". Enter the setup token from
`infra/azure/.secrets/mailcraft.json`, your name, email and a password. Then remove the token so it cannot be used again:

```powershell
az containerapp update -n mailcraft-app -g mailcraft-rg --remove-env-vars SETUP_TOKEN
az containerapp secret remove -n mailcraft-app -g mailcraft-rg --secret-names setup-token
```

Add everyone else from **Manage team access** in the account menu.

## Deploying a new version

Run the same `deploy.ps1` command again. It builds a new image tag and updates the app; the database is untouched and any new
migrations are applied automatically when the app starts.

## SendGrid

Put the API key (Mail Send permission only) into `infra/azure/.secrets/mailcraft.json` as `sendGridApiKey`, then run `deploy.ps1`
again. Then, per client, save the from address in **Sending settings** and tick the verified box.

## A company web address

1. In your DNS, add a CNAME from `mailcraft.example.com` to the app address, and the TXT verification record Azure asks for.
2. `az containerapp hostname add -n mailcraft-app -g mailcraft-rg --hostname mailcraft.example.com`
3. `az containerapp hostname bind -n mailcraft-app -g mailcraft-rg --hostname mailcraft.example.com --environment mailcraft-env --validation-method CNAME`
4. Run `deploy.ps1` again with `-PublicBaseUrl https://mailcraft.example.com` so links in emails and the same-origin check use it.

## Settings the app reads

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required). |
| `PUBLIC_BASE_URL` | The public address, used for tracking and unsubscribe links and the same-origin check. |
| `SETUP_TOKEN` | Only while creating the first administrator. |
| `SENDGRID_API_KEY` | Enables test emails. |
| `PORT` | Defaults to 3000. |

## Known limits and next hardening steps

- The database allows connections from Azure services, protected by the password and TLS. For tighter control, put the database and
  the container environment in a virtual network with private access.
- Secrets are stored as Container Apps secrets. Key Vault references are the next step if your policy requires them.
- Exactly one copy of the app runs. Running several would need a lock around migrations and a shared rate limit for sign-in attempts.
- Backups are the database's automatic 7 days. Do a test restore before relying on them.
- Run locally: `docker compose up --build` (Docker needed), or without Docker `node scripts/dev-db.mjs`, then
  `npm run db:migrate` and `npm run dev` with `DATABASE_URL` set.
