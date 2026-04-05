# Deployment Guide

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/uxwvend`) |
| `AUTH_SECRET` | Random 32-char string. Generate with `openssl rand -base64 32` |
| `AUTH_URL` | Your site's public URL (e.g. `https://yourdomain.com`) |

### Optional

| Variable | Description |
|----------|-------------|
| `AUTH_DISCORD_ID` | Discord OAuth client ID |
| `AUTH_DISCORD_SECRET` | Discord OAuth client secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `STRIPE_PUBLIC_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PAYPAL_CLIENT_ID` | PayPal client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret |
| `PAYPAL_MODE` | `sandbox` or `live` |
| `RESEND_API_KEY` | Resend email API key |
| `EMAIL_FROM` | Sender email address |
| `RCON_HOST` | Game server RCON host |
| `RCON_PORT` | Game server RCON port (default: 25575) |
| `RCON_PASSWORD` | Game server RCON password |
| `MC_SERVER_HOST` | Minecraft server host (for status widget) |
| `MC_SERVER_PORT` | Minecraft server port (default: 25565) |
| `DISCORD_WEBHOOK_URL` | Default Discord webhook URL |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key |
| `NEXT_PUBLIC_GA_ID` | Google Analytics tracking ID |
| `PUNISHMENTS_API_KEY` | API key for external punishment plugin |
| `NEXT_PUBLIC_APP_NAME` | Site display name (default: `uxwVend`) |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

See `.env.example` for the full list.

---

## PostgreSQL Setup

```bash
sudo apt install -y postgresql postgresql-contrib

sudo -u postgres createuser uxwvend
sudo -u postgres createdb uxwvend -O uxwvend
sudo -u postgres psql -c "ALTER USER uxwvend PASSWORD 'your_secure_password';"
```

Your `DATABASE_URL` will be:
```
postgresql://uxwvend:your_secure_password@localhost:5432/uxwvend
```

---

## VPS Deployment (Ubuntu)

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Clone and Configure

```bash
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
npm install
cp .env.example .env
# Edit .env with your values
```

### Initialize Database

```bash
npx prisma db push
npm run db:seed  # optional: seed demo data
```

### Build and Start

```bash
npm run build
npm run start  # runs on port 3000
```

### PM2 Process Management

```bash
npm install -g pm2
pm2 start npm --name uxwvend -- start
pm2 save
pm2 startup
```

---

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Production Checklist

- [ ] `AUTH_SECRET` is a unique, randomly generated string
- [ ] `AUTH_URL` matches your production domain (including `https://`)
- [ ] `DATABASE_URL` points to the production PostgreSQL instance
- [ ] Database schema is pushed (`npx prisma db push`)
- [ ] Stripe webhook endpoint is configured in the Stripe dashboard (`https://yourdomain.com/api/webhooks/stripe`)
- [ ] `STRIPE_WEBHOOK_SECRET` is set from the Stripe dashboard
- [ ] Nginx is configured with SSL (HTTPS)
- [ ] PM2 is set up with startup script (`pm2 startup`)
- [ ] Cron job is configured for scheduled tasks
- [ ] Firewall allows ports 80 and 443 only (not 3000 directly)
- [ ] Backups are scheduled

---

## Backups

```bash
npm run db:backup   # creates a timestamped SQL dump
npm run db:restore  # restore from the latest backup file
```

---

## Health Check

```
GET /api/health
```

Returns:
```json
{ "status": "healthy", "uptime": 12345, "database": "ok" }
```

---

## Scheduled Tasks

Set up a cron job to run maintenance tasks hourly:

```bash
0 * * * * curl -X POST https://yourdomain.com/api/v1/admin/cron -H "x-api-key: YOUR_API_KEY"
```

Create an API key with `cron:run` permission in Admin > API Keys.

---

## Post-Deployment

1. Visit `/admin/setup` for first-time configuration.
2. Create an admin account (or use the seeded one: `admin@example.com` / `admin123` -- change immediately).
3. Install modules from the marketplace (Admin > Modules).
4. Configure payment settings, Discord webhooks, and email in Admin > Settings.
