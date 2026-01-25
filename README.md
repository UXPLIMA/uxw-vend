<div align="center">
  <br />
  <h1>🛍️ uxwVend</h1>
  <p>
    <strong>Next-Generation Digital Marketplace & Community Platform</strong>
  </p>
  <p>An open-source, modular, and modern game server management platform.</p>

  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-15.1-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Prisma-6.0-green?style=for-the-badge&logo=prisma" alt="Prisma" />
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License" />
  </p>
</div>

<br />

## 📋 Overview

**uxwVend** is a powerful, full-stack web application designed to be the ultimate all-in-one platform for creators, game server owners, and digital sellers. Built with the absolute latest web technologies, it combines a robust e-commerce store with a fully integrated community forum, blog, and support ticket system.

Unlike fragmented solutions, uxwVend provides a unified experience where your users can buy products, ask for help, read updates, and discuss in forums—all with a single account.

## ✨ Key Features

### 🛒 Advanced Store Module
- **Digital & Physical Products**: Sell software, game items, keys, or physical merchandise.
- **Dynamic Pricing**: Support for discounts, coupons, and variable pricing.
- **Cart & Checkout**: Seamless shopping experience with Stripe & PayPal integration.
- **Instant Delivery**: Automated delivery for digital assets and license keys.
- **Multi-Currency Support**: Dynamic currency conversion (USD, EUR, TRY, etc.).

### 👥 Community & Social
- **Full-Featured Forum**: Categories, topics, sticky posts, and rich text editing.
- **User Profiles**: Avatars, role-based badges, and activity history.
- **Engagement**: Like system, post reporting, and moderation tools.

### 📝 CMS & Content
- **Blog System**: SEO-friendly articles, categories, and tags.
- **Help Center**: Knowledge base for FAQs and guides to reduce support load.
- **Rich Text Editor**: Integrated React Quill for beautiful content creation.

### 🎫 Professional Support
- **Ticket System**: Department-based routing (Sales, Support, Technical).
- **Priorities & Statuses**: Manage workflow with custom statuses.
- **File Attachments**: Users can upload proofs or screenshots.

### 🛠️ Technical Highlights
- **Role-Based Access Control (RBAC)**: Granular permissions for Admins, Mods, and Users.
- **Internationalization (i18n)**: Native multi-language support (English, Turkish, German, etc.).
- **Theming System**: Dynamic theme generation and dark mode support.
- **Modular Architecture**: Features are built as independent modules.
- **SEO Optimized**: Server-Side Rendering (SSR) and proper metadata management.

## 🚀 Tech Stack

This project is built on the bleeding edge of the JavaScript ecosystem:

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Auth**: [Auth.js (NextAuth v5)](https://authjs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest)
- **Forms**: [Zod](https://zod.dev/) for validation
- **Documentation**: [React](https://react.dev/)

## 🗺️ Roadmap & Progress

We are actively developing uxwVend. Here is our current progress:

### ✅ Completed
- **Core Infrastructure**: Next.js 16 setup, Auth v5, RBAC, Database Schema.
- **Internationalization**: Full i18n support with `next-intl`.
- **Store Module**: Product management, Cart, Checkout flow, Orders.
- **Blog Module**: Article management, Rich text editor, Comments.
- **User System**: Profile management, Role management.

### 🚧 In Progress
- **Forum Module**: Topic creation, Category management (Partially implemented).
- **Ticket System**: Support ticket workflow, Department routing.
- **Theme System**: Advanced theme uploading (ZIP) and live preview.

### 📅 Planned
- **Plugin System**: Fully modular plugin loader.
- **Discord Integration**: Sync roles and notifications.
- **Marketplace**: Theme and plugin marketplace.
- **Analytics Dashboard**: Sales and user engagement metrics.

## 🛠️ Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- Node.js 20+ installed
- PostgreSQL database running

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/siracozmen01/uxwVend.git
   cd uxwVend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Duplicate the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your database credentials (`DATABASE_URL`) and authentication secrets.

4. **Database Setup**
   Push the schema to your database:
   ```bash
   npm run db:push
   ```
   *(Optional) Seed the database if a seed script exists.*

5. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

```bash
uxwVend/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   ├── core/
│   │   ├── components/   # Reusable UI components
│   │   ├── lib/          # Utilities, exact types, and helpers
│   │   ├── hooks/        # Custom React hooks
│   │   └── providers/    # Context providers (Theme, Auth, Query)
│   ├── modules/          # Feature-specific logic (Store, Blog, etc.)
├── prisma/               # Database schema
├── public/               # Static assets
└── messages/             # i18n translation files
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/siracozmen01">Siraç Özmen</a>
</p>

