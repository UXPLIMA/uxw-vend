# Deployment Guide

## Option 1: VPS (Ubuntu)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser uxwvend
sudo -u postgres createdb uxwvend -O uxwvend
sudo -u postgres psql -c "ALTER USER uxwvend PASSWORD 'your_password';"

# Clone and setup
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
npm install
cp .env.example .env
# Edit .env with your values

# Database
npx prisma db push
npm run db:seed  # optional demo data

# Build and start
npm run build
npm run start  # runs on port 3000

# Use PM2 for process management
npm install -g pm2
pm2 start npm --name uxwvend -- start
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

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

## Option 2: Docker

```bash
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
cp .env.example .env
# Edit .env

docker-compose up -d
```

## Option 3: Vercel

1. Fork the repository
2. Import into Vercel
3. Set environment variables in Vercel dashboard
4. Add PostgreSQL (Vercel Postgres or external)
5. Deploy

**Note:** Set `AUTH_URL` to your Vercel domain.

## Option 4: Railway

1. Create new project from GitHub repo
2. Add PostgreSQL plugin
3. Set environment variables
4. Deploy automatically

## Environment Variables

See `.env.example` for all required and optional variables.

**Required:**
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Random 32-char string (`openssl rand -base64 32`)
- `AUTH_URL` — Your domain URL

**Recommended:**
- `STRIPE_SECRET_KEY` + `STRIPE_PUBLIC_KEY` — For payments
- `RESEND_API_KEY` — For emails
- Discord OAuth credentials — For Discord login

## Post-Deployment

1. Visit `/admin/setup` for first-time configuration
2. Create admin account or use seeded one (`admin@example.com` / `admin123`)
3. Configure payment settings in admin
4. Set up Discord webhooks
5. Add products and categories

## Backups

```bash
npm run db:backup   # creates timestamped SQL dump
npm run db:restore  # restore from backup file
```

## Health Check

```
GET /api/health
```

Returns: `{ status: "healthy", uptime: 12345, database: "ok" }`

## Scheduled Tasks

Set up a cron job to run maintenance tasks:

```bash
# Every hour
0 * * * * curl -X POST https://yourdomain.com/api/v1/admin/cron -H "x-api-key: YOUR_API_KEY"
```

Create an API key with `cron:run` permission in Admin → API Keys.
