# API Documentation

Base URL: `/api/v1`

OpenAPI spec: `GET /api/v1/openapi`

## Authentication

Most endpoints require a session cookie (NextAuth). Some accept `x-api-key` header.

## Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /store/products | List products (search, category, sort, pagination) |
| GET | /store/products/:id | Get product detail |
| GET | /store/categories | List store categories |
| GET | /blog/articles | List published articles |
| GET | /blog/articles/:id | Get article |
| GET | /blog/categories | List blog categories |
| GET | /forum/categories | List forum categories |
| GET | /forum/topics | List topics (search, category, pagination) |
| GET | /forum/topics/:id | Get topic with replies |
| GET | /announcements | Active announcements |
| GET | /changelog | Changelog entries |
| GET | /staff | Staff members |
| GET | /suggestions | List suggestions |
| GET | /vote | Vote sites |
| GET | /wheel/prizes | Wheel prizes |
| GET | /downloads | Download list |
| GET | /punishments | Punishment list (search, type filter) |
| GET | /leaderboard | Leaderboard (type: buyers/voters/forum) |
| GET | /community-goal | Current goal progress |
| GET | /custom-pages/:slug | Custom page content |
| GET | /slider | Slider items |
| GET | /server-status | Game server status |
| GET | /players/:username | Public player profile |
| GET | /api/health | Health check |

## Authenticated Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /store/cart | Get cart |
| POST | /store/cart | Add to cart |
| DELETE | /store/cart | Clear cart |
| POST | /store/checkout | Create checkout session |
| GET | /store/orders | List user's orders |
| POST | /store/coupons/validate | Validate coupon |
| GET | /auth/profile | Get profile |
| PATCH | /auth/profile | Update profile / change password |
| POST | /auth/verify-email | Send verification email |
| POST | /auth/two-factor/setup | Start 2FA setup |
| POST | /auth/two-factor/verify | Verify and enable 2FA |
| POST | /auth/two-factor/disable | Disable 2FA |
| POST | /forum/topics | Create topic |
| POST | /forum/topics/:id | Reply to topic |
| POST | /forum/topics/:id/like | Toggle topic like |
| POST | /forum/posts/:id/like | Toggle post like |
| GET | /tickets | List user's tickets |
| POST | /tickets | Create ticket |
| POST | /suggestions | Create suggestion |
| POST | /suggestions/:id/vote | Toggle vote |
| POST | /vote/claim | Claim vote reward |
| POST | /wheel/spin | Spin wheel |
| GET | /credits | Get credit balance |
| GET | /chest | Get chest items |
| POST | /chest/:id | Redeem/gift chest item |
| GET | /notifications | Get notifications |
| PATCH | /notifications | Mark read |
| GET | /linked-accounts | Linked accounts |
| POST | /linked-accounts | Link account |
| DELETE | /linked-accounts | Unlink account |
| POST | /gift-codes/redeem | Redeem gift code |

## Admin Endpoints

All require admin session or API key with appropriate permissions.

| Method | Path | Description |
|--------|------|-------------|
| POST | /store/products | Create product |
| PATCH | /store/products/:id | Update product |
| DELETE | /store/products/:id | Archive product |
| POST | /store/categories | Create category |
| PATCH/DELETE | /store/categories/:id | Update/delete category |
| POST | /store/coupons | Create coupon |
| PATCH/DELETE | /store/coupons/:id | Update/delete coupon |
| PATCH | /store/orders/:id | Update order status |
| GET/POST | /roles | List/create roles |
| PATCH/DELETE | /roles/:id | Update/delete role |
| PATCH | /users/:id | Update user (role, ban) |
| GET/PATCH | /settings | Read/write settings |
| GET/POST | /announcements | Manage announcements |
| GET/POST | /changelog | Manage changelog |
| GET/POST | /staff | Manage staff |
| GET/POST | /popups | Manage popups |
| GET/POST | /vote | Manage vote sites |
| GET/POST | /wheel/prizes | Manage wheel prizes |
| GET/POST | /downloads | Manage downloads |
| GET/POST | /gift-codes | Manage gift codes |
| GET/POST | /creator-codes | Manage creator codes |
| GET/POST | /forms | Manage custom forms |
| GET/POST | /bulk-discounts | Manage discounts |
| GET/POST | /servers | Manage game servers |
| GET/POST | /api-keys | Manage API keys |
| GET | /stats | Dashboard statistics |
| GET | /activity-log | Activity log |
| GET | /webhook-logs | Webhook logs |
| GET | /admin/export | Export CSV |
| POST | /admin/import | Import CSV |
| POST | /admin/search | Global search |
| POST | /admin/cron | Run scheduled tasks |
| POST | /rcon | Send RCON command |
| POST | /themes/upload | Upload theme ZIP |
| DELETE | /themes/:id | Delete theme |

## Webhooks

| Path | Description |
|------|-------------|
| POST /api/webhooks/stripe | Stripe payment webhooks |

## External Plugin API

```
POST /api/v1/punishments
Header: x-api-key: YOUR_PUNISHMENTS_API_KEY
Body: { playerName, type, reason, duration }
```
