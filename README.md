<div align="center">
  <h1>uxwVend</h1>
  <p><strong>Open Source Game Server Management & Marketplace Platform</strong></p>
  <p>The all-in-one solution for managing your game server website, store, community, and support system.</p>

  ![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
  ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
  ![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)
  ![License](https://img.shields.io/badge/License-MIT-green)
</div>

---

## Features

### Store & Payments
- Product management with categories, images, and variants
- Stripe checkout with 120+ payment methods
- Coupons, bulk discounts, creator codes
- Gift codes with bulk generation
- VIP comparison table
- Community revenue goals
- Credit system (site balance)

### Community
- Forum with categories, topics, replies, likes
- Blog with rich text editor, comments, tags
- Suggestions with community voting
- Leaderboard (buyers, voters, contributors)
- Vote sites with credit rewards
- Wheel of Fortune game
- Staff page and applications
- Changelog

### Support
- Ticket system with departments and priority
- Help center / knowledge base
- Canned responses

### Admin Panel
- Dashboard with charts (revenue, orders, users)
- 30+ management pages
- 14 settings categories
- Role & permission management
- User management with ban system
- Activity log and webhook logs
- Module enable/disable
- First-time setup wizard

### Customization
- Theme system with ZIP upload
- Dark mode
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
- Stripe payments
- RCON game server commands
- Minecraft server query (live status)
- Google Analytics
- Cloudflare Turnstile CAPTCHA
- Resend email service
- Minecraft skin avatars

### Security
- Two-factor authentication (TOTP)
- Email verification
- Password reset flow
- Rate limiting
- GDPR cookie consent
- DOMPurify sanitization

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
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7 |
| Database | PostgreSQL + Prisma 6 |
| Auth | Auth.js v5 (NextAuth) |
| Styling | Tailwind CSS 4 |
| State | Zustand + TanStack Query |
| Payments | Stripe |
| Email | Resend |
| Charts | Chart.js |

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
npm run db:push          # Push schema to DB
npm run db:seed          # Seed demo data
npm run db:studio        # Prisma Studio GUI
npm run db:migrate       # Create migration
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
