# Admin Guide

## Accessing the Admin Panel

Navigate to `/admin` in your browser. You must be logged in with an account that has the `admin.access` permission. The seeded admin account is `admin@example.com` / `password123` — change this immediately after first login.

The admin sidebar uses an icon rail on the left with a contextual panel that expands on hover or click. Top-level groups:

- **Dashboard** — overview stats + module-contributed cards
- **Content** — module-contributed content management pages
- **Users** — user list, roles, permissions
- **Modules** — marketplace and installed module management
- **Theme** — active theme appearance settings (dynamic: label and icon come from the active theme's manifest)
- **Design** — Custom CSS, Navbar, Footer
- **Settings** — Site, Maintenance, Rate Limits, Alerting, Moderation, and other core settings
- **Observability** — health, email queue, scheduler, cron errors, failed emails, stats

Module-contributed menu groups appear below the core groups.

---

## Module Management

The platform ships with no modules installed. All domain features (store, forum, blog, chat, analytics, etc.) come from modules.

### Installing from the Marketplace

1. Go to **Admin > Modules > Marketplace**.
2. Browse the 41 available modules. Each card shows the module name, description, version, and any dependencies.
3. Click **Install** on the module you want.
4. The system extracts the ZIP to `src/modules/<id>/`, regenerates the registry synchronously, creates the `ModuleConfig` database record, and syncs translations to the `Translation` table.
5. If the module has a database schema, the merged schema is updated. If it includes SQL migrations, they run automatically.
6. If the module has dependencies, they must be installed first. The UI shows which dependencies are missing.

Install fails atomically — if registry regeneration fails, the module files are removed and the `ModuleConfig` record is not created. No silent partial installs.

### Installing from a ZIP Upload

1. Go to **Admin > Modules** and click **Upload ZIP**.
2. Select a `.zip` file containing a valid `module.json` manifest at its root.
3. The system validates the manifest against the Zod schema before extracting any files.
4. Same install process as marketplace: extract → regenerate registry → create DB record → sync translations.

### Enable / Disable

1. Go to **Admin > Modules**.
2. Toggle the switch on any installed module card.

Disabling a module hides all its routes (public pages, admin pages, API endpoints) via the proxy middleware. Module files remain on disk. The `ModuleConfig.enabled` flag is all that changes — re-enabling is instant.

A module with unmet dependencies cannot be enabled. The UI shows which dependency is missing.

### Deleting a Module

1. Click the delete button on a module card.
2. A confirmation dialog appears.
3. Confirm — the module files are removed from disk, the `ModuleConfig` record is deleted, and the registry is regenerated.

Data created by the module (its database tables and rows) is **not deleted** on uninstall by default. This matches established convention: data survives so it can be recovered if the module is reinstalled. To permanently drop the module's tables, a maintainer must manually run the appropriate SQL.

---

## Theme Management

### Theme Library

Go to **Admin > Settings > Theme** (or follow the **Theme** sidebar group). The library shows all installed themes as cards with a preview of their primary color palette.

Two themes ship out of the box:
- **Flat** — minimal baseline, light and dark modes
- **PixelCraft** — gaming dark theme with MC hero section

### Switching the Active Theme

Click on a theme card and confirm. The `ThemeState` singleton is updated immediately. All pages reflect the new theme on next load — no rebuild required.

### Installing a New Theme

1. Click **Upload Theme**.
2. Select a `.zip` file containing a `theme.json` manifest at its root (`schemaVersion: 2` required).
3. The manifest is validated. If validation passes, files are extracted to `src/themes/<id>/` and the theme registry is regenerated.
4. The theme appears in the library and can be activated immediately.

### Deleting a Theme

Themes that are currently active cannot be deleted. Switch to a different theme first, then click the delete icon on the theme card. Deletion:
- Cascades `ThemeCustomization` and `ThemeSetting` rows in a single database transaction
- Removes the theme directory from disk

### Theme Appearance Settings

When a theme is active, the **Theme** sidebar group provides access to its appearance settings. The group label and icon come from the theme's `adminNav` declaration in the manifest.

- **Appearance** is always present — shows the color token editor and mode selector.
- Additional groups correspond to `settings` blocks declared in the theme manifest (e.g., a "Hero" group for hero section configuration).
- Additional pages correspond to `adminRoutes` declared in the theme manifest (e.g., PixelCraft's hero banner page).

#### Color Tokens and Mode Overrides

1. Navigate to **Theme > Appearance**.
2. Select the mode to customize (light or dark).
3. Use the color picker for each token. Values are validated as hex colors.
4. Save — overrides are stored in `ThemeCustomization` (one row per theme+mode combination) as a diff against the manifest defaults. Resetting a token removes it from the diff and falls back to the manifest default.

#### Theme Settings

Settings declared in the theme's `settings` groups (text fields, toggles, selects, URLs) appear as schema-driven forms. Values are stored in `ThemeSetting` (one row per `themeId + groupKey + key`).

### Mode Toggle

Users can toggle light/dark mode via the UI control in the navbar. The mode resolution priority:

1. Admin-forced mode (if set in `ThemeState`)
2. User cookie (`uxw_mode`)
3. Browser `prefers-color-scheme`
4. Manifest default mode

Single-mode themes short-circuit this chain and always render in their declared mode.

### Custom CSS

Go to **Admin > Design > Custom CSS**. Enter arbitrary CSS that loads site-wide, after theme tokens. This is the escape hatch for one-off overrides that are not worth a theme update.

---

## User Management

### User List

Go to **Admin > Users**. The list shows all registered users with their email, username, role, and registration date. Use the search box to filter.

### Editing a User

Click on a user row to open the detail page. From here you can:

- Change the user's **role** (applied immediately — propagates to active sessions within one hour via JWT `updateAge`)
- **Ban** the user with an optional reason. Banned users cannot log in. The `isBanned`, `banReason`, and `bannedAt` fields are set.
- **Unban** the user, clearing those fields.
- View the user's activity history, profile details, and any module-contributed profile data.

### Roles and Permissions

Go to **Admin > Users > Roles**.

**Built-in roles:**
- `admin` — all permissions, priority 100
- `moderator` — moderation permissions, priority 50
- `member` — default role for new registrations, priority 0

**Creating a custom role:**
1. Click **New Role**.
2. Set name, display name, color, and priority.
3. Assign permissions from the list. Permissions are grouped by source: core permissions (`admin.access`, `admin.settings`, `admin.users`, `admin.roles`) and permissions registered by each installed module.
4. Save.

**Editing permissions:** Click a role to open its permission editor. Toggle individual permissions. Changes take effect within the JWT update window (one hour) for users already logged in.

**Priority:** When a user's role priority is evaluated, higher numbers win. Priority affects ordering and display, not permission inheritance — each role has its own explicit permission set.

---

## Observability

Go to **Admin > Observability**. This page aggregates:

- **Health** — live database connectivity, uptime, and the same response as `GET /api/health`
- **Email Queue** — pending, sent, and failed transactional emails
- **Scheduler** — scheduled task registry and last-run timestamps
- **Cron Errors** — history of failed cron endpoint calls
- **Failed Emails** — list of emails that failed to deliver with error details
- **Stats** — aggregate counters from installed module `statsApi` endpoints

The health sub-section respects the `HEALTH_DEBUG` environment variable. Raw database errors are only shown when `HEALTH_DEBUG=1` is set.

---

## Activity Log

Go to **Admin > Activity Log**. Every admin action is recorded here: user changes, setting updates, module installs, role edits, etc.

Each entry includes:
- Timestamp
- Actor (which admin performed the action)
- Action type (`user.ban`, `module.install`, `setting.update`, etc.)
- Entity and entity ID
- Metadata (JSON diff of what changed)

The log is append-only. There is no UI to delete entries.

---

## Maintenance Mode

Go to **Admin > Settings > Maintenance**. Toggle maintenance mode on. When enabled:

- All public-facing pages redirect to a maintenance page.
- The admin panel remains accessible to users with `admin.access`.
- API endpoints return `503 Service Unavailable`.

The maintenance page content can be customized in the same settings panel.

---

## Rate Limits

Go to **Admin > Settings > Rate Limits**.

The platform uses a Redis-backed (or memory-backed) sliding window rate limiter. Three base configs exist:

| Profile | Default limit | Window |
|---|---|---|
| Auth (login, register, password reset) | 10 requests | 15 minutes |
| API | 100 requests | 1 minute |
| Upload | 20 requests | 1 minute |

**Per-role multipliers** let trusted roles bypass tighter limits. For example, setting the `admin` role multiplier to `10` allows admins 100 auth attempts per window instead of 10. Multipliers are stored in the `Setting` table under `rate_limit_role_multipliers` and are read at runtime — no rebuild required.

---

## Translation Overrides

Translations live in the `Translation` DB table and are read at request time. Core strings are seeded from `messages-core/{en,tr}.json`. Module strings are synced from each `module.json` on install.

To override a translation:
1. Go to **Admin > Settings > Translations** (if the translations UI module is installed), or edit the `Translation` table directly.
2. Find the key you want to override (e.g., `common.welcome`).
3. Set a custom value for the locale. Admin-overridden rows survive module reinstallation — module sync does not overwrite rows that have been manually edited.

---

## API Keys

Go to **Admin > API Keys**.

API keys are scoped to specific permissions. Use cases:
- Cron job caller (`cron:run` permission)
- External integration (module-specific permissions)
- Server-to-server API access

Each key shows its permission scope, creation date, and last-used timestamp. Keys can be revoked at any time.

---

## Navbar and Footer

### Navbar Links

Go to **Admin > Design > Navbar**. Module-contributed links appear here (sourced from each module's `navLinks` manifest field). You can reorder links and toggle visibility.

### Footer Links

Go to **Admin > Design > Footer**. Module-contributed footer links are grouped by `section` as declared in the module manifest. Edit labels, toggle visibility, and reorder within sections.

---

## Dashboard

The admin dashboard adapts to installed modules. Each module can contribute:

- **Dashboard cards** — stat counters (revenue, user count, orders, tickets, etc.) with links to the relevant admin page
- **Stats API** — a module endpoint that returns dynamic numbers for those cards

With no modules installed, the dashboard shows only core metrics (total users, total roles).

---

## Backups and Restores

Run from the server (not from the UI):

```bash
npm run db:backup      # creates ./backups/uxwvend_<timestamp>.sql.gz
npm run db:restore backups/uxwvend_<timestamp>.sql.gz   # restores from that file
```

The backup script keeps the last 10 dumps and removes older ones automatically. The restore script prompts for confirmation before overwriting.

See [DEPLOYMENT.md](DEPLOYMENT.md) for scheduling automated backups with cron.
