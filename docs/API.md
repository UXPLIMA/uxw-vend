# API Documentation

Base URL: `/api/v1`

## Authentication

API requests are authenticated in two ways:
- **Session cookie**: Set automatically when a user logs in via the web UI (Auth.js / NextAuth).
- **API key**: Pass via the `x-api-key` header. Create API keys in Admin > API Keys with scoped permissions.

## OpenAPI Specification

```
GET /api/v1/openapi
```

Returns a generated OpenAPI spec that includes all currently installed module API routes. Use this for auto-generated documentation of module endpoints.

Module APIs are not documented in this file. They come from installed modules and are described in the OpenAPI spec above.

---

## Core Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/profile` | Session | Get current user profile |
| PATCH | `/auth/profile` | Session | Update profile or change password |
| POST | `/auth/verify-email` | Session | Send verification email |
| POST | `/auth/two-factor/setup` | Session | Start 2FA setup (returns QR code) |
| POST | `/auth/two-factor/verify` | Session | Verify TOTP code and enable 2FA |
| POST | `/auth/two-factor/disable` | Session | Disable 2FA |

### Users (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | Admin | List users (search, pagination) |
| PATCH | `/users/:id` | Admin | Update user (role, ban status) |

### Roles (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/roles` | Admin | List all roles |
| POST | `/roles` | Admin | Create role |
| PATCH | `/roles/:id` | Admin | Update role |
| DELETE | `/roles/:id` | Admin | Delete role |

### Settings (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings` | Admin | Read all settings |
| PATCH | `/settings` | Admin | Update settings |
| GET | `/public-settings` | None | Public settings (site name, theme, etc.) |

### Modules (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/modules` | Admin | List all installed modules with status |
| POST | `/modules/upload` | Admin | Upload and install a module ZIP |
| POST | `/modules/marketplace/install` | Admin | Install a module from the marketplace |
| PATCH | `/modules/:id` | Admin | Enable or disable a module |
| DELETE | `/modules/:id` | Admin | Uninstall a module |
| GET | `/modules/status` | Admin | Module status and dependency info |

### Themes (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/themes/upload` | Admin | Upload a theme ZIP |
| DELETE | `/themes/:id` | Admin | Delete a theme |

### API Keys (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api-keys` | Admin | List API keys |
| POST | `/api-keys` | Admin | Create API key with permissions |
| DELETE | `/api-keys/:id` | Admin | Revoke API key |

### Dashboard (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stats` | Admin | Dashboard statistics |
| GET | `/activity-log` | Admin | Activity log entries |

### Utilities

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Health check (`{ status, uptime, database }`) |
| POST | `/admin/cron` | API Key | Run scheduled maintenance tasks |
| POST | `/admin/search` | Admin | Global admin search |
| POST | `/admin/export` | Admin | Export data as CSV |
| POST | `/admin/import` | Admin | Import data from CSV |

---

## Webhooks

| Path | Description |
|------|-------------|
| `POST /api/webhooks/stripe` | Stripe payment event handler (provided by the stripe-gateway module) |

---

## Error Format

All endpoints return errors in a consistent format:

```json
{ "error": "Description of what went wrong" }
```

Validation errors (Zod 4) return the `issues` array:

```json
{ "error": "Validation failed", "issues": [...] }
```

---

## Module APIs

Each installed module provides its own API endpoints under `/api/v1/`. These are defined in the module's `module.json` manifest and documented in the OpenAPI spec at `/api/v1/openapi`.

For example, a `store` module might provide:
- `GET /api/v1/store/products`
- `POST /api/v1/store/checkout`
- `GET /api/v1/store/orders`

A `blog` module might provide:
- `GET /api/v1/blog/articles`
- `GET /api/v1/blog/categories`

These endpoints exist only when their module is installed and enabled.
