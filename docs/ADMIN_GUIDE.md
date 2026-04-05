# Admin Guide

## First-Time Setup

1. Navigate to `/admin/setup`.
2. Enter site name, server IP, and contact email.
3. Optionally configure Stripe keys and Discord webhook URL.
4. Click "Finish Setup".

The platform ships empty. Install modules to add features (store, blog, forum, support, etc.).

---

## Module Management

### Installing Modules

There are two ways to install a module:

**From the Marketplace** (Admin > Modules > Marketplace):
- Browse available modules.
- Click "Install" to download and activate.
- Marketplace installs are enabled by default.

**From ZIP Upload** (Admin > Modules > Upload):
- Upload a `.zip` file containing a valid `module.json`.
- The system validates the manifest, copies files, and regenerates the registry.
- ZIP uploads are disabled by default -- enable them after review.

### Enable / Disable

- Go to Admin > Modules.
- Toggle the switch next to any installed module.
- Disabling a module hides all its routes (pages, admin pages, API endpoints) without deleting files.
- Modules with unmet dependencies cannot be enabled.

### Deleting Modules

- Click the delete button on a module card.
- This removes the module files from disk and its database record.
- The registry is regenerated automatically.

### Dependencies

Some modules depend on others. For example, a payment gateway module may depend on the store module. The admin panel shows dependency relationships and prevents enabling a module when its dependencies are missing.

---

## Theme Management

### Selecting a Theme

- Go to Admin > Settings > Appearance.
- Select from installed themes.
- Changes apply immediately.

### Uploading a Theme

- Click "Upload Theme" and select a `.zip` file.
- The theme must contain a valid theme configuration.

### Color Customization

- Open the color customization panel in Appearance settings.
- Use the live color picker to adjust any theme color.
- Changes are saved to the database and override theme defaults.

### Custom CSS

- Admin > Settings > Custom CSS.
- Inject arbitrary CSS that loads site-wide.

---

## Settings Overview

### Appearance
Theme selection, color customization, custom CSS.

### Navbar / Footer / Hero
Edit navigation links, footer content, hero banner image and text.

### Widgets
Toggle sidebar widgets on/off and reorder them. Available widgets come from installed modules.

### Discord
Configure webhook URLs per event type (new order, new ticket, etc.). Each webhook has a test button.

### Payments
Stripe API keys and webhook secret. PayPal client ID and secret. These settings may also be provided by payment gateway modules.

### Email
Resend API key, sender address, email template customization.

### RCON
Game server connection settings (host, port, password) for executing commands on purchase.

### Security
Cloudflare Turnstile CAPTCHA keys. Email verification toggle.

### Analytics
Google Analytics tracking ID.

---

## User Management

### Users
- Admin > Users: List, search, and edit users.
- Change a user's role via the dropdown (saves immediately).
- View user profile details, order history, and activity.

### Roles and Permissions
- Admin > Roles: Create custom roles with granular permissions.
- Permission categories include core permissions (admin access, settings, users, roles) plus permissions registered by each installed module.
- The default admin role has all permissions.

### Banning Users
- Open a user's detail page and toggle the ban status.
- Banned users cannot log in.

---

## Dashboard

The admin dashboard adapts to installed modules. Each module can register:
- **Dashboard cards**: Stat counters (revenue, users, orders, etc.).
- **Stats API**: An endpoint returning dynamic statistics.

With no modules installed, the dashboard shows only core metrics (total users, roles).

---

## Tools

### Export / Import
- Export products, orders, or users as CSV.
- Import products from CSV.

### API Keys
- Create keys for external integrations.
- Each key has scoped permissions.
- Use API keys for cron jobs and external system access.

### Activity Log
- Tracks admin actions: user changes, setting updates, module installs, etc.

### Webhook Logs
- Discord webhook delivery history with status and payloads.

### Scheduled Tasks
Set up a cron job to call the maintenance endpoint:

```bash
0 * * * * curl -X POST https://yourdomain.com/api/v1/admin/cron -H "x-api-key: YOUR_API_KEY"
```

Create an API key with `cron:run` permission in Admin > API Keys.

Tasks include: expiring coupons, closing old tickets, cancelling stale orders.
