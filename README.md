<div align="center">
  <h1>uxwVend</h1>
  <p><strong>Open Source Game Server Management & Marketplace Platform</strong></p>
  <p>The all-in-one solution for managing your game server website, store, community, and support system.</p>

  ![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
  ![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)
  ![Zod](https://img.shields.io/badge/Zod-4-3E67B1)
  ![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)
  ![License](https://img.shields.io/badge/License-MIT-green)
</div>

---

## Features

### Store & Payments
- Product management with categories, images, gallery, and custom variables
- Stripe checkout + PayPal integration
- Coupons, bulk discounts, creator codes
- Gift codes with bulk generation
- VIP comparison table
- Community revenue goals
- Credit system (site balance)
- Chest system (store items, redeem later, gift to others)
- Cumulative upgrades (pay difference to upgrade ranks)
- Per-product RCON delivery commands

### Community
- Forum with categories, topics, replies, likes
- Blog with rich text editor, comments, tags
- Suggestions with community voting
- Leaderboard (buyers, voters, contributors)
- Vote sites with credit rewards
- Wheel of Fortune game
- Staff page and applications
- Changelog
- Player profiles with Minecraft skin avatars
- Account linking (Discord, Steam, Minecraft)
- Announcements, popups, custom pages
- Download center, punishments page

### Support
- Ticket system with departments and priority
- Help center / knowledge base
- Canned responses

### Admin Panel
- Dashboard with charts (revenue, orders, users)
- 40+ management pages
- 14 settings categories (navbar, footer, hero, widgets, CSS, SEO, etc.)
- Role & permission management
- User management with ban system
- Activity log and webhook logs
- Module enable/disable
- First-time setup wizard
- Global search (users, products, orders, tickets)
- Export/Import (CSV)
- API key management
- Scheduled tasks (cron)

### Customization
- Theme system with ZIP upload
- Dark mode toggle
- Live color customization from admin
- Custom CSS injection
- Configurable navbar, footer, hero banner
- Widget visibility and ordering
- Slider/carousel management
- Custom pages (HTML editor)
- Custom forms builder
- SEO settings per page

### Integrations
- Discord webhooks (orders, tickets, forum, registrations)
- Discord & Google OAuth login
- Stripe + PayPal payments
- RCON game server commands with auto-delivery
- Multi-server management (Minecraft, FiveM, Rust, ARK, CS2)
- Minecraft server query (live status)
- Google Analytics
- Cloudflare Turnstile CAPTCHA
- Resend email service (welcome, order, reset)
- Minecraft skin avatars

### Security
- Two-factor authentication (TOTP + backup codes)
- Email verification
- Password reset flow
- Rate limiting on auth endpoints
- API key authentication
- GDPR cookie consent
- DOMPurify sanitization
- Soft delete for products
- Security-audited codebase

### i18n
- 3 languages (English, Turkish, German)
- Locale-prefixed URLs
- Multi-currency support

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Installation

```bash
# Clone
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AUTH_SECRET

# Setup database
npx prisma db push

# Seed demo data (optional)
npm run db:seed

# Start development server
npm run dev
```

### Docker

```bash
docker-compose up -d
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL + Prisma 6.19 |
| ORM Validation | Zod 4 |
| Auth | Auth.js v5 (NextAuth) |
| Styling | Tailwind CSS 4 |
| Payments | Stripe + PayPal |
| Email | Resend |
| Charts | Chart.js |
| Icons | Lucide React 1.7 |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/           # i18n locale routing
│   │   ├── (admin)/        # Admin panel pages
│   │   ├── (auth)/         # Auth pages
│   │   └── (public)/       # Public pages
│   └── api/v1/             # API routes
├── core/                   # Core framework
│   ├── components/         # Shared UI components
│   ├── lib/                # Utilities (auth, db, stripe, email, discord, rcon)
│   ├── hooks/              # React hooks
│   └── providers/          # Context providers
├── modules/                # Feature modules
│   ├── store/              # E-commerce
│   ├── blog/               # Blog/news
│   ├── support/            # Tickets & help center
│   └── forum/              # Community forum
├── themes/                 # Theme packages
└── proxy.ts                # Middleware (i18n + module routing)
```

---

## Creating Plugins

See [Plugin SDK Documentation](docs/PLUGIN_SDK.md) for creating custom modules.

---

## Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Start production
npm run lint             # ESLint
npm run clean            # Clear .next cache
npm run db:push          # Push schema to DB
npm run db:seed          # Seed demo data
npm run db:studio        # Prisma Studio GUI
npm run db:migrate       # Create migration
npm run db:backup        # Backup database
npm run db:restore       # Restore from backup
npm run generate:themes  # Regenerate themes
```

---

## API Documentation

OpenAPI spec available at `/api/v1/openapi` when the server is running.

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.
