# Deployment Guide

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
| `DATABASE_URL` | PostgreSQL connection string. Example: `postgresql://user:pass@localhost:5432/uxwvend`. Append `?connection_limit=20` for high-traffic or PM2 cluster deployments. |
| `AUTH_SECRET` | JWT signing secret. Must be 32+ chars. Generate: `openssl rand -base64 32`. Must be identical across all replicas behind the same load balancer. |
| `AUTH_URL` | Canonical public URL of the site (e.g. `https://yourdomain.com`). Used for OAuth callback URLs and password-reset links. **Must start with `https://` in production** to activate `__Secure-` cookie prefixes and the `Secure` flag. On plain-HTTP deployments, leave this unset and Auth.js picks safe defaults. |

### Production-recommended

| Variable | Description |
|---|---|
| `SECRET_ENCRYPTION_KEY` | **Required in production.** Encrypts at-rest secrets (RCON passwords, module-stored third-party API tokens) with AES-256-GCM. The app hard-throws the first time a module reads/writes an encrypted secret if this is unset and `NODE_ENV=production`. 64-char hex (32 bytes). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `REDIS_URL` | Redis connection string (e.g. `redis://localhost:6379`). Required when running more than one PM2 worker — the in-memory rate limiter is process-local and can be bypassed without this. |
| `ALLOW_MEMORY_RATE_LIMIT` | Set to `1` only on single-worker deployments where Redis is unavailable. Without Redis and without this flag, rate-limited requests return 503. |
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
git clone https://github.com/siracozmen01/uxwVend.git
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
- Admin user: `admin@example.com` / `password123` — **change this password immediately**

---

## Docker Compose (quickstart)

The bundled `docker-compose.yml` runs Postgres, Redis, and the app together,
and bootstraps the database automatically on first boot.

```bash
cp .env.example .env
# Set at minimum: AUTH_SECRET, SECRET_ENCRYPTION_KEY, POSTGRES_PASSWORD
docker compose up --build
```

What happens:
- `db` (Postgres) and `redis` start with persistent named volumes.
- The one-shot `migrate` service runs `scripts/docker-bootstrap.ts`, which on a
  **fresh** database pushes the schema and seeds the 3 roles + admin user, then
  exits. It is a no-op once the DB is initialized, so it is safe on every `up`.
- `app` starts only after `migrate` completes successfully → login works out of
  the box at <http://localhost:3001> (`admin@example.com` / `password123` —
  **change immediately**).

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

For cluster mode (multiple workers sharing one port):

```bash
pm2 start npm --name uxwvend -i max -- start -- -p 3001 -H 0.0.0.0
```

When running cluster mode, `REDIS_URL` is required for rate limiting to work correctly across workers. Without Redis in cluster mode, each worker has its own in-memory rate limiter and an attacker can bypass limits by rotating between workers.

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

Set `REDIS_URL=redis://localhost:6379` in `.env`. The rate limiter automatically detects and uses Redis. If Redis goes down at runtime, the rate limiter falls back to the in-memory backend automatically without taking the site down.

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
- The module install route holds a PostgreSQL advisory lock (`pg_try_advisory_lock`) to prevent two concurrent installs from racing in a PM2 cluster.
- After installing one or more modules, the platform schedules a deferred build (`scheduleBuild()`): `db-merge → apply-migrations → generate-registry → npm run build → pm2 restart`. A 3-second debounce ensures bulk installs don't trigger one build per module.
- Session JWTs refresh every hour (`updateAge: 3600`). Role, ban, and permission changes propagate to dormant sessions within that window.

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
- [ ] `REDIS_URL` set (required for multi-worker deployments)
- [ ] `TRUSTED_PROXY_IPS` set to your nginx server IP
- [ ] Firewall allows only ports 80 and 443 (not 3001 directly)
- [ ] Backup cron job scheduled
- [ ] `HEALTH_DEBUG=1` is NOT set (or is behind auth)
- [ ] `OPENAPI_PUBLIC` is NOT set to `1` unless intentionally public

---

## Troubleshooting

**Site returns 503 on rate-limited routes**

Redis is not configured and `ALLOW_MEMORY_RATE_LIMIT` is not set. Set `REDIS_URL` or set `ALLOW_MEMORY_RATE_LIMIT=1` (single-worker only).

**Login cookies not persisting after OAuth redirect**

`AUTH_URL` does not start with `https://`. On HTTP deployments, leave `AUTH_URL` unset. Auth.js will use safe defaults without the `Secure` flag.

**`npx tsc --noEmit` fails with "cannot find module" errors for module models**

`src/modules/` is empty. Run `npm run db:merge` to regenerate the Prisma client with all module models, or in CI, seed `src/modules/` from `module-sources/` first.

**Module install fails and rolls back**

Registry regeneration failed (e.g. a TypeScript error in the new module). Check the install error message — it includes the generator output. Fix the module source and re-upload.

**PM2 workers each show different rate limit counters**

`REDIS_URL` is not set. Multiple workers each have their own in-memory counter. Set Redis.

**Schema drift after a `git pull`**

Run `npm run db:merge && npm run db:push` to apply new schema. If module SQL migrations are included, also run `npm run db:migrate`.
