# Deployment Guide

## Install

On a fresh Linux server:

```bash
curl -fsSL https://raw.githubusercontent.com/UXPLIMA/uxw-vend/main/install.sh | sudo bash
```

It installs Docker if it is missing, generates every secret, writes `.env`,
pulls the image, starts Postgres + Redis + the app, waits until the site
answers, and prints the URL and the admin password. Three questions — domain,
admin e-mail, HTTPS yes/no — each with a default.

Give a domain and say yes to HTTPS and a Caddy container obtains and renews a
Let's Encrypt certificate on its own. Leave the domain blank and the site is
served over HTTP on the server's IP.

Non-interactive:

```bash
curl -fsSL .../install.sh | sudo bash -s -- \
    --domain shop.example.com --email you@example.com --tls --yes
```

| Flag | Meaning |
|---|---|
| `--dir PATH` | Install root (default `/opt/uxwvend`) |
| `--domain HOST` | Public hostname; blank means "use the server IP" |
| `--email ADDR` | Admin account e-mail |
| `--tls` / `--no-tls` | Run Caddy for automatic HTTPS (needs `--domain`) |
| `--port N` | Host port for HTTP installs (default 3001) |
| `--version TAG` | Image tag to install (default `latest`) |
| `--build` | Build from the local source tree instead of pulling |
| `--yes` | Never prompt |
| `--dry-run` | Compute everything, change nothing |

Re-running the installer is an upgrade. Your `.env` is never overwritten, so
secrets and answers survive.

### After it finishes

```bash
uxwvend update          # pull the newest image, migrate, restart
uxwvend update v1.4.0   # pin a specific version
uxwvend backup          # dump the database to <install-dir>/backups
uxwvend restore FILE    # restore a dump (asks first)
uxwvend logs [service]  # follow logs
uxwvend status          # what is running, and whether the app is healthy
uxwvend restart | stop | start
```

**Back up `/opt/uxwvend/.env`.** It holds `SECRET_ENCRYPTION_KEY`, and the
database rows encrypted with it cannot be read without it. A database dump
alone is not a complete backup.

### What gets exposed

Only the app's port (or 80/443 with TLS). Postgres and Redis are reachable
only from inside the compose network — no host port is published for either.
For a psql shell use `docker compose exec db psql -U uxwvend uxwvend` from the
install directory; to reach them from your laptop, use an SSH tunnel together
with `docker-compose.debug.yml`, which binds them to `127.0.0.1` only.

### If the image cannot be pulled

The installer names the tag it tried. Either no release has been published
yet, or the GHCR package is private. Clone the repository and run
`./install.sh --build` to compile on the server instead.

---

## Manual install (advanced)

Everything below describes running uxwVend without the installer — directly on
the host with Node, PostgreSQL, PM2 and Nginx. It is supported but not the
recommended path: the Docker install above is the one that is tested end to
end on every release.

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Node.js | 24 | Enforced by `engines` field in `package.json` |
| PostgreSQL | 14 | Required |
| Redis | 4 or 5 | Optional but strongly recommended in multi-worker prod |
| PM2 | Latest | Recommended process manager |

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Example: `postgresql://user:pass@localhost:5432/uxwvend`. Append `?connection_limit=20` for a high-traffic site. |
| `AUTH_SECRET` | JWT signing secret. Must be 32+ chars. Generate: `openssl rand -base64 32`. Must be identical across all replicas behind the same load balancer. |
| `AUTH_URL` | Canonical public URL of the site (e.g. `https://yourdomain.com`). Used for OAuth callback URLs and password-reset links. **Must start with `https://` in production** to activate `__Secure-` cookie prefixes and the `Secure` flag. On plain-HTTP deployments, leave this unset and Auth.js picks safe defaults. |

### Production-recommended

| Variable | Description |
|---|---|
| `SECRET_ENCRYPTION_KEY` | **Required in production.** Encrypts at-rest secrets (RCON passwords, module-stored third-party API tokens) with AES-256-GCM. The app hard-throws the first time a module reads/writes an encrypted secret if this is unset and `NODE_ENV=production`. 64-char hex (32 bytes). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `REDIS_URL` | **Required in production**, whatever your worker count. Redis connection string (e.g. `redis://localhost:6379`). The in-memory rate limiter is process-local and bypassable, so production does not silently fall back to it: without `REDIS_URL` (and without the opt-out below) every rate-limited request is denied with 429. `/api/health` is one of them, so the site reads as down. |
| `ALLOW_MEMORY_RATE_LIMIT` | Set to `1` to run production on the in-memory limiter anyway. Only sane on a true single-worker deployment: counters are per-process, so any multi-worker setup can be bypassed by rotating between workers. |
| `RESEND_API_KEY` | Resend email provider API key. Without it, outbound email degrades to `console.log` in dev and is silently dropped in prod. |
| `EMAIL_FROM` | Sender address for transactional email (e.g. `noreply@example.com`). |

### Optional platform settings

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_NAME` | Site display name (default: `uxwVend`). |
| `NEXT_PUBLIC_APP_URL` | Public app URL, used in frontend links. |
| `NEXT_PUBLIC_IMAGE_DOMAINS` | Comma-separated image hostnames allowed through `next/image`. |
| `STORAGE_PROVIDER` | Override the active storage provider. Provider modules register themselves; admin picks the active one from the panel. |
| `NODE_ENV` | `development` or `production`. |

### Security / hardening

| Variable | Description |
|---|---|
| `CSRF_ALLOWED_ORIGINS` | Extra origins accepted by the CSRF proxy guard. `AUTH_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL` are always allowed. Add staging or preview hosts here. |
| `CSRF_INTERNAL_SECRET` | Shared secret for server-to-server calls that need to bypass the CSRF origin check (`x-internal-request: <secret>`). Leave unset to disable. |
| `INTERNAL_API_SECRET` | Shared secret authorizing trusted server-to-server calls to internal status endpoints (sent as the `x-internal-request` header). Leave unset to disable. |
| `DEMO_MODE` | Set to `1` on a public demo deployment to reject all mutating requests, so visitors can browse but not change anything. |
| `TRUSTED_PROXY_IPS` | Comma-separated list of trusted reverse-proxy IPs. When set, forwarded headers (`x-forwarded-for`) are only honored when the direct connection comes from one of these addresses — prevents header spoofing. |
| `HEALTH_DEBUG` | Set to `1` to surface raw error details on `GET /api/health`. Only set this behind authentication in production. |
| `OPENAPI_PUBLIC` | Set to `1` to make the OpenAPI spec at `/api/v1/openapi` readable without admin auth. Off by default. |
| `HOOK_LISTENER_TIMEOUT_MS` | Abort hook listeners that take longer than this many milliseconds (default: 5000). Prevents misbehaving modules from hanging requests. |
| `SHUTDOWN_GRACE_MS` | Milliseconds the graceful-shutdown handler has to drain before force-exit. Set lower than PM2 `kill_timeout`. |
| `SKIP_POSTINSTALL` | Set to `1` to skip registry/schema regeneration during `npm install`. Useful for Docker layer caching when scripts run explicitly afterward. |

Module-specific secrets (Stripe, PayPal keys, RCON, Discord bot token, etc.) are configured through Admin Panel > Settings after installing the relevant module. They do not belong in `.env`.

The exception is OAuth sign-in: a module that declares `authProviders` names the env vars holding its client id and secret, because Auth.js builds its configuration at process start, before any database read. The provider stays inactive until both variables are set.

See `.env.example` for the full annotated list with inline documentation.

---

## PostgreSQL Setup

```bash
sudo apt install -y postgresql postgresql-contrib

sudo -u postgres createuser uxwvend
sudo -u postgres createdb uxwvend -O uxwvend
sudo -u postgres psql -c "ALTER USER uxwvend PASSWORD 'your_secure_password';"
```

`DATABASE_URL` for the above:

```
postgresql://uxwvend:your_secure_password@localhost:5432/uxwvend
```

---

## Install and Initialize

```bash
git clone https://github.com/UXPLIMA/uxw-vend.git
cd uxwVend
npm install              # also runs postinstall: merge-schemas + generate-registry + generate-themes
cp .env.example .env
# Edit .env with your DATABASE_URL, AUTH_SECRET, AUTH_URL
```

Push the schema and seed core data:

```bash
npm run db:merge         # merge core + module schemas into prisma/schema.prisma
npm run db:push          # push schema to the database (db:push, not prisma migrate)
npm run db:seed          # creates 3 roles + core permissions + admin user
npx tsx scripts/seed-translations.ts   # seed default locale strings
```

The seed creates:
- Roles: `admin`, `moderator`, `member` (member is the default)
- Admin user: `admin@example.com`, password from `SEED_ADMIN_PASSWORD` — or, if unset, randomly generated and **printed once** in the seed output

---

## Docker Compose by hand

`install.sh` above is the supported way to run this stack. Drive compose
yourself only if you need to change something the installer does not expose.

```bash
cp .env.example .env
# Set at minimum: AUTH_SECRET, SECRET_ENCRYPTION_KEY, POSTGRES_PASSWORD
docker compose up -d                                   # pull the published image
docker compose --profile tls up -d                     # ...with Caddy in front
docker compose -f docker-compose.yml \
               -f docker-compose.build.yml up -d --build   # ...from source
```

What happens:
- `db` (Postgres) and `redis` start with persistent named volumes.
- The one-shot `migrate` service runs `scripts/docker-bootstrap.ts`, which on a
  **fresh** database pushes the schema and seeds the 3 roles + admin user, then
  exits. It is a no-op once the DB is initialized, so it is safe on every `up`.
- `app` starts only after `migrate` completes successfully → login works out of
  the box at <http://localhost:3001> as `admin@example.com`. Set
  `SEED_ADMIN_PASSWORD` in `.env` before the first `up`; without it the seed
  generates one and prints it once, so read it with
  `docker compose logs migrate`.

Compose injects its own `DATABASE_URL`/`REDIS_URL` pointing at the sibling
services, so those values in `.env` are ignored on the compose path. Required
`.env` keys for compose: `POSTGRES_PASSWORD`, `AUTH_SECRET` (and
`SECRET_ENCRYPTION_KEY` for any module that stores secrets). Wipe everything
with `docker compose down -v`.

---

## Build and Start

```bash
npm run build            # prebuild runs: merge-schemas → generate-themes → generate-registry → generate-openapi
npm run start            # starts Next.js on port 3000 (default)
```

The `prebuild` hook runs the full code-generation pipeline automatically. Do not skip it.

---

## PM2 Process Management

Install PM2 globally and start the app on port 3001:

```bash
npm install -g pm2

pm2 start npm --name uxwvend -- start -- -p 3001 -H 0.0.0.0
pm2 save
pm2 startup    # follow the printed command to register PM2 on boot
```

**Do not use cluster mode.** PM2 will happily run `-i max`, and it will look
fine until someone installs a module. Only one worker takes the install lock
and rebuilds; the others keep serving the build they read at boot, so the
module appears and disappears depending on which worker answers. Worse, a
second worker that starts its own build writes into the same `.next` the first
is reading. One process per installation is the supported topology — see
["The Build Lifecycle"](#the-build-lifecycle) for why, and for what to do when
you outgrow it.

`REDIS_URL` is required in production. Without it the rate limiter fails closed
and answers every rate-limited request with 429 — see the environment table
above.

Useful PM2 commands:

```bash
pm2 logs uxwvend          # stream logs
pm2 reload uxwvend        # zero-downtime reload
pm2 restart uxwvend       # hard restart
pm2 monit                 # live metrics
```

---

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    client_max_body_size 50M;   # match your upload limits

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade            $http_upgrade;
        proxy_set_header   Connection         "upgrade";
        proxy_set_header   Host               $host;
        proxy_set_header   X-Real-IP          $remote_addr;
        proxy_set_header   X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto  $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

With this config, set `TRUSTED_PROXY_IPS=127.0.0.1` in `.env` so the app trusts the `X-Forwarded-For` header only when it arrives from nginx.

### SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Redis Setup

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Set `REDIS_URL=redis://localhost:6379` in `.env`. The rate limiter detects and uses Redis on its own. If Redis goes down *at runtime* it falls back to the in-memory backend rather than taking the site down — that failover is deliberate, and is not the same as starting with no `REDIS_URL` at all, which denies requests instead.

The Docker install needs none of this — the stack runs its own Redis container
and wires `REDIS_URL` to it.

---

## Rate Limiting

The rate limiter has two backends:

- **Redis** (recommended in production): shared across all workers, survives restarts.
- **Memory** (fallback): process-local. Valid for single-worker deployments only.

Without Redis in production and without `ALLOW_MEMORY_RATE_LIMIT=1`, rate-limited endpoints return 503. This is intentional: silent single-process rate limiting in a multi-worker deployment provides a false sense of security.

Per-role rate limit multipliers are stored in the `Setting` table under the key `rate_limit_role_multipliers`. Admins can tune these from Admin > Settings > Rate Limits without redeployment.

---

## Backups

Two scripts are provided:

**Backup** — creates a gzipped SQL dump and keeps the last 10:

```bash
npm run db:backup
# or directly:
bash scripts/backup.sh
```

Backups are written to `./backups/uxwvend_<timestamp>.sql.gz`. The script reads `DATABASE_URL` from `.env` automatically.

**Restore** — overwrites the current database from a backup file:

```bash
npm run db:restore backups/uxwvend_20260403_120000.sql.gz
# or directly:
bash scripts/restore.sh backups/uxwvend_20260403_120000.sql.gz
```

The restore script prompts for confirmation before overwriting.

Schedule automated backups with cron:

```bash
0 3 * * * cd /path/to/uxwVend && npm run db:backup >> /var/log/uxwvend-backup.log 2>&1
```

---

## Health Check

```
GET /api/health
```

Returns `200` with:

```json
{ "status": "healthy", "uptime": 12345, "database": "ok" }
```

On unhealthy: returns `503` with `{ "status": "unhealthy", "database": "error" }`. Raw error details are only included when `HEALTH_DEBUG=1` is set.

---

## Scheduled Tasks

Create an API key with the `cron:run` permission in Admin > API Keys, then set up a cron job:

```bash
0 * * * * curl -s -X POST https://yourdomain.com/api/v1/admin/cron \
  -H "x-api-key: YOUR_API_KEY" >> /var/log/uxwvend-cron.log 2>&1
```

The cron endpoint runs maintenance tasks registered by installed modules (expiring coupons, closing stale tickets, etc.).

---

## Upgrades

On a Docker install (the supported path), upgrading is one command:

```bash
uxwvend update            # newest published image
uxwvend update v1.4.0     # a specific tag
```

It pulls the image and restarts. The one-shot `migrate` service runs before
the app is allowed back up and performs the sequence below inside the
container — merge schemas, push them, apply module SQL migrations — so the
database can never be left behind the code. If any step fails the app stays
down rather than serving against a mismatched schema.

### Manual install

Pull the latest code and rebuild:

```bash
git pull origin main
npm install
npm run db:merge      # pick up any new module schemas
npm run db:push       # push schema changes
npm run db:migrate    # apply any module SQL migrations
npm run build
pm2 reload uxwvend    # zero-downtime reload
```

If module manifests changed, the `prebuild` hook regenerates the registry automatically. You do not need to run `generate-registry.ts` manually before building.

After upgrading, visit `GET /api/health` to confirm the database is reachable.

---

## Zero-Downtime Considerations

- `pm2 reload uxwvend` performs a rolling restart (one worker at a time) rather than a hard restart. Use this for routine upgrades.
- The module install route holds a PostgreSQL advisory lock (`pg_try_advisory_lock`) to prevent two installs from racing.
- Session JWTs refresh every hour (`updateAge: 3600`). Role, ban, and permission changes propagate to dormant sessions within that window.
- **Installing a module is not zero-downtime, and cannot be.** See the next section.

---

## The Build Lifecycle

Read this before you plan capacity or debug a "my module disappeared" report.
It is the one architectural fact about uxwVend that leaks into operations.

**Module pages are compiled into the app.** A module ships React server
components; Next.js compiles those at build time. There is no runtime loader
that could render them, so installing a module means rebuilding the app. This
is the decision everything below follows from.

### What happens on install

`scheduleBuild()` runs, debounced by 3 seconds so a bulk install of thirty
modules produces one build:

```
db:merge → apply-migrations → generate-registry → npm run build
         → record the build fingerprint → SIGTERM
```

The process then exits and the supervisor starts it again. That last step is
what makes the module live: `next start` reads its route and build manifests
once at boot, so a rebuild underneath a running process changes nothing it can
serve. Expect a gap of a few seconds to a few minutes, depending on how fast
the machine builds. Install modules during a maintenance window on a busy site.

> **Run the app under a supervisor.** Docker Compose (`restart:
> unless-stopped`) and systemd (`Restart=always`) both qualify, and so does
> pm2. A bare `npm start` in a terminal does not: the process will exit after a
> module install and nothing will bring it back. The Docker install does the
> right thing with no configuration; if you deploy manually, this is the one
> thing you must not skip.

### What happens on boot

`scripts/reconcile-build.ts` runs before the server binds a port. It compares a
fingerprint of `src/modules/` against the fingerprint recorded beside the build
and rebuilds when they disagree. Four situations reach it:

| Situation | What the reconciler does |
|-----------|--------------------------|
| Fresh install, no modules | Nothing. Adopts the image's build. Sub-second. |
| Restart, nothing changed | Nothing. Sub-second. |
| `uxwvend update` with modules installed | Rebuilds. The new image's build was made with zero modules; yours were not in it. **Minutes.** |
| A build was interrupted (OOM, `docker kill` mid-install) | Rebuilds. |

Row three is why `uxwvend update` can take several minutes on a site with
modules and only seconds on one without. The CLI says so while it waits.

A rebuild that *fails* is loud in the logs but does not stop the boot: the
previous build is served so the admin UI stays reachable and the offending
module can be removed. Only a completely missing build is fatal.

### Where the build lives

In Docker, `/app/.next` is the `nextbuild` named volume, so a rebuild survives
container replacement — otherwise every `uxwvend restart` on a site with
modules would pay for a full build. Docker seeds the volume from the image the
first time it is created, which is why a fresh install never rebuilds.

`docker compose down -v` deletes it along with everything else. The next boot
rebuilds; nothing is lost but time.

### The scaling ceiling this implies

**uxwVend runs one app process per installation.** Not one per core — one,
full stop. Two processes sharing the `modules` volume would both try to build
into the same `.next`, and the loser would serve a half-written build.

That is a real limit and it is not currently enforced by anything but this
paragraph. A single Node process on a 2-core VPS serves this workload
comfortably; if you outgrow it, the fix is a read replica and a CDN in front of
the public pages, not a second app container. Horizontal scaling would need the
build moved out of the app process entirely — a design change, not a config
one.

---

## Production Checklist

- [ ] `AUTH_SECRET` is a unique randomly-generated string (32+ chars)
- [ ] `AUTH_URL` starts with `https://` (required for secure cookie prefixes)
- [ ] `DATABASE_URL` points to the production PostgreSQL instance
- [ ] Schema pushed: `npm run db:push`
- [ ] Core data seeded: `npm run db:seed`
- [ ] Admin password changed from the seeded default
- [ ] Nginx configured with HTTPS
- [ ] PM2 configured with startup script (`pm2 startup`)
- [ ] `REDIS_URL` set (required in production — without it the site answers 429)
- [ ] `TRUSTED_PROXY_IPS` set to your nginx server IP
- [ ] Firewall allows only ports 80 and 443 (not 3001 directly)
- [ ] Backup cron job scheduled
- [ ] `HEALTH_DEBUG=1` is NOT set (or is behind auth)
- [ ] `OPENAPI_PUBLIC` is NOT set to `1` unless intentionally public

---

## Troubleshooting

**Every request returns 429, including `/api/health`**

`NODE_ENV=production` with no `REDIS_URL`. The rate limiter fails closed
rather than fall back to a bypassable in-memory counter, and logs
`[rate-limit] REDIS_URL is required in production` once a minute. Set
`REDIS_URL`, or `ALLOW_MEMORY_RATE_LIMIT=1` to accept the weaker limiter on a
single-worker deployment. No restart is needed after setting `REDIS_URL` —
the backend is re-evaluated per request until one is configured.

**Login cookies not persisting after OAuth redirect**

`AUTH_URL` does not start with `https://`. On HTTP deployments, leave `AUTH_URL` unset. Auth.js will use safe defaults without the `Secure` flag.

**`npx tsc --noEmit` fails with "cannot find module" errors for module models**

`src/modules/` is empty. Run `npm run db:merge` to regenerate the Prisma client with all module models, or in CI, seed `src/modules/` from `module-sources/` first.

**Module install fails and rolls back**

Registry regeneration failed (e.g. a TypeScript error in the new module). Check the install error message — it includes the generator output. Fix the module source and re-upload.

**PM2 workers each show different rate limit counters**

You are running more than one worker, which this architecture does not support
— see ["The Build Lifecycle"](#the-build-lifecycle). Drop to a single process.
The counters are the symptom you noticed; module installs are the one that will
bite you.

**A module I installed shows up on some page loads and not others**

Same cause: more than one app process. Only the one that took the install lock
rebuilt.

**Schema drift after a `git pull`**

Run `npm run db:merge && npm run db:push` to apply new schema. If module SQL migrations are included, also run `npm run db:migrate`.
