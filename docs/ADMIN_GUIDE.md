# Admin Guide

## First Time Setup

1. Navigate to `/admin/setup`
2. Enter site name, server IP, contact email
3. Optionally configure Stripe keys and Discord webhook
4. Click "Finish Setup"

## Dashboard

The admin dashboard shows:
- Revenue, orders, products, users, tickets, articles, topics counts
- Recent orders with status
- Open tickets and latest forum topics
- Analytics charts (7/30/90 day revenue, orders, users)

## Store Management

### Products
- **Admin → Products**: List, create, edit, archive products
- Each product can have: name, description, price, compare price, images, category, stock, type
- **Product Commands**: Set RCON commands to execute on purchase (e.g., `give {player} diamond 64`)
- **Product Variables**: Add custom fields buyers must fill (e.g., Minecraft username)
- Products are soft-deleted (archived, not permanently removed)

### Categories
- **Admin → Store Categories**: Create category hierarchy (parent/child)
- Categories can have images and descriptions

### Orders
- **Admin → Orders**: Filter by status, view details, change status
- Statuses: PENDING → PROCESSING → COMPLETED / CANCELLED / REFUNDED

### Coupons
- **Admin → Coupons**: Create percentage or fixed discounts
- Set min purchase, max discount, usage limit, expiry

### Bulk Discounts
- Quantity-based: "Buy 3+ get 10% off"
- Per product or per category

## Content

### Blog
- **Admin → Articles**: Create with rich text editor, categories, tags, cover image
- **Admin → Blog Categories**: Inline create/edit/delete

### Announcements
- Site-wide banners with type (info/warning/success/error)
- Schedule with start/end dates

### Changelog
- Version history entries with type badges

### Custom Pages
- Create pages at `/page/your-slug`
- HTML content editor

### Slider
- Homepage carousel images with titles and links

### Popups
- Welcome modals with image, link, scheduling

## Community

### Forum
- **Admin → Forum Topics**: Pin, lock, delete topics
- **Admin → Forum Categories**: Create with icons and colors

### Suggestions
- Users submit ideas, community votes
- Admin changes status: open → under review → accepted/rejected

### Vote Sites
- Add voting links with credit rewards
- Users claim rewards (24h cooldown)

### Wheel of Fortune
- Configure prizes: credits, coupons, nothing
- Set probability weights and colors

### Leaderboard
- Auto-generated: top buyers, voters, forum contributors

## Support

### Tickets
- **Admin → Tickets**: View, reply, change status/priority
- Departments for routing

### Help Center
- **Admin → Help Center**: Articles and categories

## Users

### User Management
- **Admin → Users**: List, search, click to edit
- Change role via dropdown (instant save)

### Roles & Permissions
- **Admin → Roles**: Create roles with permissions
- Permission categories: admin, store, blog, support, forum

### Ban System
- Ban/unban from user detail page
- Banned users cannot log in

## Settings

### Appearance
- Theme selection + ZIP upload
- **Color Customization**: Live color picker for all theme colors

### Navbar / Footer / Hero
- Edit navigation links, footer content, hero banner settings

### Widgets
- Toggle sidebar widgets on/off, reorder

### Custom CSS
- Inject custom styles site-wide

### Discord
- Configure webhook URLs per event type
- Test button for each webhook

### Payments
- Stripe keys and webhook secret

### Email
- Resend API key, sender address, template customization

### RCON
- Game server connection settings

### Security
- Turnstile CAPTCHA keys
- Email verification toggle

### Community Goals
- Set monthly revenue target

### Analytics
- Google Analytics tracking ID

## Tools

### Export/Import
- Export products, orders, users as CSV
- Import products from CSV

### API Keys
- Create keys for external integrations
- Keys support permission scoping

### Activity Log
- Track admin actions (user changes, orders, etc.)

### Webhook Logs
- Discord webhook delivery history

### Scheduled Tasks
- Set up cron: `POST /api/v1/admin/cron` with API key
- Auto-expires coupons, closes old tickets, cancels stale orders
