/* eslint-disable */
import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
  'analytics:pages/admin/settings/analytics/page.tsx': dynamic(() => import('@/modules/analytics/pages/admin/settings/analytics/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'announcements:pages/admin/page.tsx': dynamic(() => import('@/modules/announcements/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/page.tsx': dynamic(() => import('@/modules/blog/pages/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/[...params]/page.tsx': dynamic(() => import('@/modules/blog/pages/[...params]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/new/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/new/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/[id]/edit/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/[id]/edit/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/categories/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'changelog:pages/public/page.tsx': dynamic(() => import('@/modules/changelog/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'changelog:pages/admin/page.tsx': dynamic(() => import('@/modules/changelog/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-forms:pages/public/[slug]/page.tsx': dynamic(() => import('@/modules/custom-forms/pages/public/[slug]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-forms:pages/admin/page.tsx': dynamic(() => import('@/modules/custom-forms/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-forms:pages/admin/submissions/page.tsx': dynamic(() => import('@/modules/custom-forms/pages/admin/submissions/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-pages:pages/public/[slug]/page.tsx': dynamic(() => import('@/modules/custom-pages/pages/public/[slug]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-pages:pages/admin/page.tsx': dynamic(() => import('@/modules/custom-pages/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'data-tools:pages/admin/page.tsx': dynamic(() => import('@/modules/data-tools/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'discord-auth:pages/admin/settings/discord-auth/page.tsx': dynamic(() => import('@/modules/discord-auth/pages/admin/settings/discord-auth/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'discord-integration:pages/admin/page.tsx': dynamic(() => import('@/modules/discord-integration/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'downloads:pages/public/page.tsx': dynamic(() => import('@/modules/downloads/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'downloads:pages/admin/page.tsx': dynamic(() => import('@/modules/downloads/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'email-system:pages/admin/page.tsx': dynamic(() => import('@/modules/email-system/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/page.tsx': dynamic(() => import('@/modules/forum/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/topic/[...params]/page.tsx': dynamic(() => import('@/modules/forum/pages/public/topic/[...params]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/new/page.tsx': dynamic(() => import('@/modules/forum/pages/public/new/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/admin/topics/page.tsx': dynamic(() => import('@/modules/forum/pages/admin/topics/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/forum/pages/admin/categories/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'google-auth:pages/admin/settings/google-auth/page.tsx': dynamic(() => import('@/modules/google-auth/pages/admin/settings/google-auth/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'help-center:pages/public/help/page.tsx': dynamic(() => import('@/modules/help-center/pages/public/help/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'help-center:pages/public/help/[slug]/page.tsx': dynamic(() => import('@/modules/help-center/pages/public/help/[slug]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'help-center:pages/public/help/category/[slug]/page.tsx': dynamic(() => import('@/modules/help-center/pages/public/help/category/[slug]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'help-center:pages/admin/help/page.tsx': dynamic(() => import('@/modules/help-center/pages/admin/help/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'leaderboard:pages/public/page.tsx': dynamic(() => import('@/modules/leaderboard/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'paypal-gateway:pages/admin/page.tsx': dynamic(() => import('@/modules/paypal-gateway/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'player-profiles:pages/public/[username]/page.tsx': dynamic(() => import('@/modules/player-profiles/pages/public/[username]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'popups:pages/admin/page.tsx': dynamic(() => import('@/modules/popups/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'punishments:pages/public/page.tsx': dynamic(() => import('@/modules/punishments/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'referral:pages/public/page.tsx': dynamic(() => import('@/modules/referral/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'referral:pages/admin/page.tsx': dynamic(() => import('@/modules/referral/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'resend-provider:pages/admin/settings/resend/page.tsx': dynamic(() => import('@/modules/resend-provider/pages/admin/settings/resend/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'security:pages/admin/page.tsx': dynamic(() => import('@/modules/security/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'seo:pages/admin/page.tsx': dynamic(() => import('@/modules/seo/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'seo:pages/admin/pages/page.tsx': dynamic(() => import('@/modules/seo/pages/admin/pages/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'servers:pages/admin/page.tsx': dynamic(() => import('@/modules/servers/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'servers:pages/admin/settings/rcon/page.tsx': dynamic(() => import('@/modules/servers/pages/admin/settings/rcon/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'slider:pages/admin/page.tsx': dynamic(() => import('@/modules/slider/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'staff:pages/public/page.tsx': dynamic(() => import('@/modules/staff/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'staff:pages/admin/applications/page.tsx': dynamic(() => import('@/modules/staff/pages/admin/applications/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'staff:pages/admin/members/page.tsx': dynamic(() => import('@/modules/staff/pages/admin/members/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/page.tsx': dynamic(() => import('@/modules/store/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/cart/page.tsx': dynamic(() => import('@/modules/store/pages/public/cart/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/product/[...params]/page.tsx': dynamic(() => import('@/modules/store/pages/public/product/[...params]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/order-success/page.tsx': dynamic(() => import('@/modules/store/pages/public/order-success/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/vip/page.tsx': dynamic(() => import('@/modules/store/pages/public/vip/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/new/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/new/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/[id]/edit/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/[id]/edit/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/store/pages/admin/categories/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/orders/page.tsx': dynamic(() => import('@/modules/store/pages/admin/orders/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/orders/[id]/page.tsx': dynamic(() => import('@/modules/store/pages/admin/orders/[id]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/coupons/page.tsx': dynamic(() => import('@/modules/store/pages/admin/coupons/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/settings/goals/page.tsx': dynamic(() => import('@/modules/store/pages/admin/settings/goals/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/settings/payments/page.tsx': dynamic(() => import('@/modules/store/pages/admin/settings/payments/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/bulk-discounts/page.tsx': dynamic(() => import('@/modules/store/pages/admin/bulk-discounts/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/creator-codes/page.tsx': dynamic(() => import('@/modules/store/pages/admin/creator-codes/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/gift-codes/page.tsx': dynamic(() => import('@/modules/store/pages/admin/gift-codes/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'stripe-gateway:pages/admin/page.tsx': dynamic(() => import('@/modules/stripe-gateway/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'suggestions:pages/public/page.tsx': dynamic(() => import('@/modules/suggestions/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'tickets:pages/public/tickets/page.tsx': dynamic(() => import('@/modules/tickets/pages/public/tickets/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'tickets:pages/public/tickets/new/page.tsx': dynamic(() => import('@/modules/tickets/pages/public/tickets/new/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'tickets:pages/public/tickets/[id]/page.tsx': dynamic(() => import('@/modules/tickets/pages/public/tickets/[id]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'tickets:pages/admin/tickets/page.tsx': dynamic(() => import('@/modules/tickets/pages/admin/tickets/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'tickets:pages/admin/tickets/[id]/page.tsx': dynamic(() => import('@/modules/tickets/pages/admin/tickets/[id]/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'tickets:pages/admin/tickets/departments/page.tsx': dynamic(() => import('@/modules/tickets/pages/admin/tickets/departments/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'vote:pages/public/page.tsx': dynamic(() => import('@/modules/vote/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'vote:pages/admin/sites/page.tsx': dynamic(() => import('@/modules/vote/pages/admin/sites/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'webhook-logs:pages/admin/page.tsx': dynamic(() => import('@/modules/webhook-logs/pages/admin/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'wheel:pages/public/page.tsx': dynamic(() => import('@/modules/wheel/pages/public/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
  'wheel:pages/admin/prizes/page.tsx': dynamic(() => import('@/modules/wheel/pages/admin/prizes/page').then((mod: any) => mod.default || mod), { loading: () => <PageLoader /> }),
};

export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
  {
    "path": "/admin/analytics",
    "key": "analytics:pages/admin/settings/analytics/page.tsx",
    "module": "analytics",
    "isAdmin": true
  },
  {
    "path": "/admin/announcements",
    "key": "announcements:pages/admin/page.tsx",
    "module": "announcements",
    "isAdmin": true
  },
  {
    "path": "/blog",
    "key": "blog:pages/page.tsx",
    "module": "blog"
  },
  {
    "path": "/blog/[...params]",
    "key": "blog:pages/[...params]/page.tsx",
    "module": "blog"
  },
  {
    "path": "/admin/blog/articles",
    "key": "blog:pages/admin/articles/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/admin/blog/articles/new",
    "key": "blog:pages/admin/articles/new/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/admin/blog/articles/[id]/edit",
    "key": "blog:pages/admin/articles/[id]/edit/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/admin/blog/categories",
    "key": "blog:pages/admin/categories/page.tsx",
    "module": "blog",
    "isAdmin": true
  },
  {
    "path": "/changelog",
    "key": "changelog:pages/public/page.tsx",
    "module": "changelog"
  },
  {
    "path": "/admin/changelog",
    "key": "changelog:pages/admin/page.tsx",
    "module": "changelog",
    "isAdmin": true
  },
  {
    "path": "/form/[slug]",
    "key": "custom-forms:pages/public/[slug]/page.tsx",
    "module": "custom-forms"
  },
  {
    "path": "/admin/forms",
    "key": "custom-forms:pages/admin/page.tsx",
    "module": "custom-forms",
    "isAdmin": true
  },
  {
    "path": "/admin/form-submissions",
    "key": "custom-forms:pages/admin/submissions/page.tsx",
    "module": "custom-forms",
    "isAdmin": true
  },
  {
    "path": "/page/[slug]",
    "key": "custom-pages:pages/public/[slug]/page.tsx",
    "module": "custom-pages"
  },
  {
    "path": "/admin/custom-pages",
    "key": "custom-pages:pages/admin/page.tsx",
    "module": "custom-pages",
    "isAdmin": true
  },
  {
    "path": "/admin/export",
    "key": "data-tools:pages/admin/page.tsx",
    "module": "data-tools",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/discord-auth",
    "key": "discord-auth:pages/admin/settings/discord-auth/page.tsx",
    "module": "discord-auth",
    "isAdmin": true
  },
  {
    "path": "/admin/discord",
    "key": "discord-integration:pages/admin/page.tsx",
    "module": "discord-integration",
    "isAdmin": true
  },
  {
    "path": "/downloads",
    "key": "downloads:pages/public/page.tsx",
    "module": "downloads"
  },
  {
    "path": "/admin/downloads",
    "key": "downloads:pages/admin/page.tsx",
    "module": "downloads",
    "isAdmin": true
  },
  {
    "path": "/admin/email",
    "key": "email-system:pages/admin/page.tsx",
    "module": "email-system",
    "isAdmin": true
  },
  {
    "path": "/forum",
    "key": "forum:pages/public/page.tsx",
    "module": "forum"
  },
  {
    "path": "/forum/topic/[...params]",
    "key": "forum:pages/public/topic/[...params]/page.tsx",
    "module": "forum"
  },
  {
    "path": "/forum/new",
    "key": "forum:pages/public/new/page.tsx",
    "module": "forum"
  },
  {
    "path": "/admin/forum/topics",
    "key": "forum:pages/admin/topics/page.tsx",
    "module": "forum",
    "isAdmin": true
  },
  {
    "path": "/admin/forum/categories",
    "key": "forum:pages/admin/categories/page.tsx",
    "module": "forum",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/google-auth",
    "key": "google-auth:pages/admin/settings/google-auth/page.tsx",
    "module": "google-auth",
    "isAdmin": true
  },
  {
    "path": "/help",
    "key": "help-center:pages/public/help/page.tsx",
    "module": "help-center"
  },
  {
    "path": "/help/[slug]",
    "key": "help-center:pages/public/help/[slug]/page.tsx",
    "module": "help-center"
  },
  {
    "path": "/help/category/[slug]",
    "key": "help-center:pages/public/help/category/[slug]/page.tsx",
    "module": "help-center"
  },
  {
    "path": "/admin/help",
    "key": "help-center:pages/admin/help/page.tsx",
    "module": "help-center",
    "isAdmin": true
  },
  {
    "path": "/leaderboard",
    "key": "leaderboard:pages/public/page.tsx",
    "module": "leaderboard"
  },
  {
    "path": "/admin/settings/paypal",
    "key": "paypal-gateway:pages/admin/page.tsx",
    "module": "paypal-gateway",
    "isAdmin": true
  },
  {
    "path": "/player/[username]",
    "key": "player-profiles:pages/public/[username]/page.tsx",
    "module": "player-profiles"
  },
  {
    "path": "/admin/popups",
    "key": "popups:pages/admin/page.tsx",
    "module": "popups",
    "isAdmin": true
  },
  {
    "path": "/punishments",
    "key": "punishments:pages/public/page.tsx",
    "module": "punishments"
  },
  {
    "path": "/referral",
    "key": "referral:pages/public/page.tsx",
    "module": "referral"
  },
  {
    "path": "/admin/referral",
    "key": "referral:pages/admin/page.tsx",
    "module": "referral",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/resend",
    "key": "resend-provider:pages/admin/settings/resend/page.tsx",
    "module": "resend-provider",
    "isAdmin": true
  },
  {
    "path": "/admin/security",
    "key": "security:pages/admin/page.tsx",
    "module": "security",
    "isAdmin": true
  },
  {
    "path": "/admin/seo",
    "key": "seo:pages/admin/page.tsx",
    "module": "seo",
    "isAdmin": true
  },
  {
    "path": "/admin/seo/pages",
    "key": "seo:pages/admin/pages/page.tsx",
    "module": "seo",
    "isAdmin": true
  },
  {
    "path": "/admin/servers",
    "key": "servers:pages/admin/page.tsx",
    "module": "servers",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/rcon",
    "key": "servers:pages/admin/settings/rcon/page.tsx",
    "module": "servers",
    "isAdmin": true
  },
  {
    "path": "/admin/slider",
    "key": "slider:pages/admin/page.tsx",
    "module": "slider",
    "isAdmin": true
  },
  {
    "path": "/staff",
    "key": "staff:pages/public/page.tsx",
    "module": "staff"
  },
  {
    "path": "/admin/staff-applications",
    "key": "staff:pages/admin/applications/page.tsx",
    "module": "staff",
    "isAdmin": true
  },
  {
    "path": "/admin/staff-members",
    "key": "staff:pages/admin/members/page.tsx",
    "module": "staff",
    "isAdmin": true
  },
  {
    "path": "/store",
    "key": "store:pages/public/page.tsx",
    "module": "store"
  },
  {
    "path": "/store/cart",
    "key": "store:pages/public/cart/page.tsx",
    "module": "store"
  },
  {
    "path": "/store/product/[...params]",
    "key": "store:pages/public/product/[...params]/page.tsx",
    "module": "store"
  },
  {
    "path": "/store/order-success",
    "key": "store:pages/public/order-success/page.tsx",
    "module": "store"
  },
  {
    "path": "/store/vip",
    "key": "store:pages/public/vip/page.tsx",
    "module": "store"
  },
  {
    "path": "/admin/store/products",
    "key": "store:pages/admin/products/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/store/products/new",
    "key": "store:pages/admin/products/new/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/store/products/[id]/edit",
    "key": "store:pages/admin/products/[id]/edit/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/store/categories",
    "key": "store:pages/admin/categories/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/store/orders",
    "key": "store:pages/admin/orders/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/store/orders/[id]",
    "key": "store:pages/admin/orders/[id]/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/store/coupons",
    "key": "store:pages/admin/coupons/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/goals",
    "key": "store:pages/admin/settings/goals/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/payments",
    "key": "store:pages/admin/settings/payments/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/bulk-discounts",
    "key": "store:pages/admin/bulk-discounts/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/creator-codes",
    "key": "store:pages/admin/creator-codes/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/gift-codes",
    "key": "store:pages/admin/gift-codes/page.tsx",
    "module": "store",
    "isAdmin": true
  },
  {
    "path": "/admin/settings/stripe",
    "key": "stripe-gateway:pages/admin/page.tsx",
    "module": "stripe-gateway",
    "isAdmin": true
  },
  {
    "path": "/suggestions",
    "key": "suggestions:pages/public/page.tsx",
    "module": "suggestions"
  },
  {
    "path": "/support",
    "key": "tickets:pages/public/tickets/page.tsx",
    "module": "tickets"
  },
  {
    "path": "/support/new",
    "key": "tickets:pages/public/tickets/new/page.tsx",
    "module": "tickets"
  },
  {
    "path": "/support/[id]",
    "key": "tickets:pages/public/tickets/[id]/page.tsx",
    "module": "tickets"
  },
  {
    "path": "/admin/tickets",
    "key": "tickets:pages/admin/tickets/page.tsx",
    "module": "tickets",
    "isAdmin": true
  },
  {
    "path": "/admin/tickets/[id]",
    "key": "tickets:pages/admin/tickets/[id]/page.tsx",
    "module": "tickets",
    "isAdmin": true
  },
  {
    "path": "/admin/tickets/departments",
    "key": "tickets:pages/admin/tickets/departments/page.tsx",
    "module": "tickets",
    "isAdmin": true
  },
  {
    "path": "/vote",
    "key": "vote:pages/public/page.tsx",
    "module": "vote"
  },
  {
    "path": "/admin/vote-sites",
    "key": "vote:pages/admin/sites/page.tsx",
    "module": "vote",
    "isAdmin": true
  },
  {
    "path": "/admin/webhook-logs",
    "key": "webhook-logs:pages/admin/page.tsx",
    "module": "webhook-logs",
    "isAdmin": true
  },
  {
    "path": "/wheel",
    "key": "wheel:pages/public/page.tsx",
    "module": "wheel"
  },
  {
    "path": "/admin/wheel-prizes",
    "key": "wheel:pages/admin/prizes/page.tsx",
    "module": "wheel",
    "isAdmin": true
  }
];

export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = [
  {
    "path": "/announcements",
    "key": "announcements:api:/announcements",
    "module": "announcements",
    "method": "ALL"
  },
  {
    "path": "/announcements/[id]",
    "key": "announcements:api:/announcements/[id]",
    "module": "announcements",
    "method": "ALL"
  },
  {
    "path": "/blog/articles",
    "key": "blog:api:/blog/articles",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/articles/[id]",
    "key": "blog:api:/blog/articles/[id]",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/categories",
    "key": "blog:api:/blog/categories",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/categories/[id]",
    "key": "blog:api:/blog/categories/[id]",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/comments",
    "key": "blog:api:/blog/comments",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/comments/[id]",
    "key": "blog:api:/blog/comments/[id]",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/blog/stats",
    "key": "blog:api:/blog/stats",
    "module": "blog",
    "method": "ALL"
  },
  {
    "path": "/changelog",
    "key": "changelog:api:/changelog",
    "module": "changelog",
    "method": "ALL"
  },
  {
    "path": "/changelog/[id]",
    "key": "changelog:api:/changelog/[id]",
    "module": "changelog",
    "method": "ALL"
  },
  {
    "path": "/credits",
    "key": "credits:api:/credits",
    "module": "credits",
    "method": "ALL"
  },
  {
    "path": "/credits/purchase",
    "key": "credits:api:/credits/purchase",
    "module": "credits",
    "method": "ALL"
  },
  {
    "path": "/forms",
    "key": "custom-forms:api:/forms",
    "module": "custom-forms",
    "method": "ALL"
  },
  {
    "path": "/forms/[slug]",
    "key": "custom-forms:api:/forms/[slug]",
    "module": "custom-forms",
    "method": "ALL"
  },
  {
    "path": "/forms/submissions",
    "key": "custom-forms:api:/forms/submissions",
    "module": "custom-forms",
    "method": "ALL"
  },
  {
    "path": "/custom-pages",
    "key": "custom-pages:api:/custom-pages",
    "module": "custom-pages",
    "method": "ALL"
  },
  {
    "path": "/custom-pages/[slug]",
    "key": "custom-pages:api:/custom-pages/[slug]",
    "module": "custom-pages",
    "method": "ALL"
  },
  {
    "path": "/admin/export",
    "key": "data-tools:api:/admin/export",
    "module": "data-tools",
    "method": "ALL"
  },
  {
    "path": "/admin/import",
    "key": "data-tools:api:/admin/import",
    "module": "data-tools",
    "method": "ALL"
  },
  {
    "path": "/downloads",
    "key": "downloads:api:/downloads",
    "module": "downloads",
    "method": "ALL"
  },
  {
    "path": "/downloads/[id]",
    "key": "downloads:api:/downloads/[id]",
    "module": "downloads",
    "method": "ALL"
  },
  {
    "path": "/forum/categories",
    "key": "forum:api:/forum/categories",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/forum/topics",
    "key": "forum:api:/forum/topics",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/forum/topics/[id]",
    "key": "forum:api:/forum/topics/[id]",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/forum/posts/[id]",
    "key": "forum:api:/forum/posts/[id]",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/forum/topics/[id]/like",
    "key": "forum:api:/forum/topics/[id]/like",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/forum/posts/[id]/like",
    "key": "forum:api:/forum/posts/[id]/like",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/forum/stats",
    "key": "forum:api:/forum/stats",
    "module": "forum",
    "method": "ALL"
  },
  {
    "path": "/help/articles",
    "key": "help-center:api:/help/articles",
    "module": "help-center",
    "method": "ALL"
  },
  {
    "path": "/help/articles/[slug]",
    "key": "help-center:api:/help/articles/[slug]",
    "module": "help-center",
    "method": "ALL"
  },
  {
    "path": "/help/categories",
    "key": "help-center:api:/help/categories",
    "module": "help-center",
    "method": "ALL"
  },
  {
    "path": "/leaderboard",
    "key": "leaderboard:api:/leaderboard",
    "module": "leaderboard",
    "method": "ALL"
  },
  {
    "path": "/notifications",
    "key": "notifications:api:/notifications",
    "module": "notifications",
    "method": "ALL"
  },
  {
    "path": "/players/[username]",
    "key": "player-profiles:api:/players/[username]",
    "module": "player-profiles",
    "method": "ALL"
  },
  {
    "path": "/linked-accounts",
    "key": "player-profiles:api:/linked-accounts",
    "module": "player-profiles",
    "method": "ALL"
  },
  {
    "path": "/players/linked-accounts",
    "key": "player-profiles:api:/players/linked-accounts",
    "module": "player-profiles",
    "method": "ALL"
  },
  {
    "path": "/popups",
    "key": "popups:api:/popups",
    "module": "popups",
    "method": "ALL"
  },
  {
    "path": "/popups/[id]",
    "key": "popups:api:/popups/[id]",
    "module": "popups",
    "method": "ALL"
  },
  {
    "path": "/punishments",
    "key": "punishments:api:/punishments",
    "module": "punishments",
    "method": "ALL"
  },
  {
    "path": "/punishments/[id]",
    "key": "punishments:api:/punishments/[id]",
    "module": "punishments",
    "method": "ALL"
  },
  {
    "path": "/referral",
    "key": "referral:api:/referral",
    "module": "referral",
    "method": "ALL"
  },
  {
    "path": "/referral/stats",
    "key": "referral:api:/referral/stats",
    "module": "referral",
    "method": "ALL"
  },
  {
    "path": "/seo/pages",
    "key": "seo:api:/seo/pages",
    "module": "seo",
    "method": "ALL"
  },
  {
    "path": "/seo/pages/[id]",
    "key": "seo:api:/seo/pages/[id]",
    "module": "seo",
    "method": "ALL"
  },
  {
    "path": "/seo/settings",
    "key": "seo:api:/seo/settings",
    "module": "seo",
    "method": "ALL"
  },
  {
    "path": "/seo/lookup",
    "key": "seo:api:/seo/lookup",
    "module": "seo",
    "method": "ALL"
  },
  {
    "path": "/servers",
    "key": "servers:api:/servers",
    "module": "servers",
    "method": "ALL"
  },
  {
    "path": "/server-status",
    "key": "servers:api:/server-status",
    "module": "servers",
    "method": "ALL"
  },
  {
    "path": "/rcon",
    "key": "servers:api:/rcon",
    "module": "servers",
    "method": "ALL"
  },
  {
    "path": "/servers/[id]",
    "key": "servers:api:/servers/[id]",
    "module": "servers",
    "method": "ALL"
  },
  {
    "path": "/servers/status",
    "key": "servers:api:/servers/status",
    "module": "servers",
    "method": "ALL"
  },
  {
    "path": "/servers/rcon",
    "key": "servers:api:/servers/rcon",
    "module": "servers",
    "method": "ALL"
  },
  {
    "path": "/slider",
    "key": "slider:api:/slider",
    "module": "slider",
    "method": "ALL"
  },
  {
    "path": "/staff",
    "key": "staff:api:/staff",
    "module": "staff",
    "method": "ALL"
  },
  {
    "path": "/staff-applications",
    "key": "staff:api:/staff-applications",
    "module": "staff",
    "method": "ALL"
  },
  {
    "path": "/staff-applications/[id]",
    "key": "staff:api:/staff-applications/[id]",
    "module": "staff",
    "method": "ALL"
  },
  {
    "path": "/staff/[id]",
    "key": "staff:api:/staff/[id]",
    "module": "staff",
    "method": "ALL"
  },
  {
    "path": "/staff/applications",
    "key": "staff:api:/staff/applications",
    "module": "staff",
    "method": "ALL"
  },
  {
    "path": "/staff/applications/[id]",
    "key": "staff:api:/staff/applications/[id]",
    "module": "staff",
    "method": "ALL"
  },
  {
    "path": "/store/cart",
    "key": "store:api:/store/cart",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/checkout",
    "key": "store:api:/store/checkout",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/categories",
    "key": "store:api:/store/categories",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/categories/[id]",
    "key": "store:api:/store/categories/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/products",
    "key": "store:api:/store/products",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/products/[id]",
    "key": "store:api:/store/products/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/orders",
    "key": "store:api:/store/orders",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/orders/[id]",
    "key": "store:api:/store/orders/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/coupons",
    "key": "store:api:/store/coupons",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/coupons/[id]",
    "key": "store:api:/store/coupons/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/coupons/validate",
    "key": "store:api:/store/coupons/validate",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/stats",
    "key": "store:api:/store/stats",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/gift-codes",
    "key": "store:api:/gift-codes",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/gift-codes/redeem",
    "key": "store:api:/gift-codes/redeem",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/creator-codes",
    "key": "store:api:/creator-codes",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/bulk-discounts",
    "key": "store:api:/bulk-discounts",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/chest",
    "key": "store:api:/chest",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/product-commands",
    "key": "store:api:/product-commands",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/product-variables",
    "key": "store:api:/product-variables",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/widget-stats",
    "key": "store:api:/widget-stats",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/webhooks/stripe",
    "key": "store:api:/webhooks/stripe",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/chest/[id]",
    "key": "store:api:/chest/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/creator-codes/[id]",
    "key": "store:api:/creator-codes/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/gift-codes/[id]",
    "key": "store:api:/gift-codes/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/community-goal",
    "key": "store:api:/community-goal",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/product-variables",
    "key": "store:api:/store/product-variables",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/widget-stats",
    "key": "store:api:/store/widget-stats",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/chest",
    "key": "store:api:/store/chest",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/chest/[id]",
    "key": "store:api:/store/chest/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/product-commands",
    "key": "store:api:/store/product-commands",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/bulk-discounts",
    "key": "store:api:/store/bulk-discounts",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/creator-codes",
    "key": "store:api:/store/creator-codes",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/creator-codes/[id]",
    "key": "store:api:/store/creator-codes/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/creator-codes/validate",
    "key": "store:api:/store/creator-codes/validate",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/gift-codes",
    "key": "store:api:/store/gift-codes",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/gift-codes/[id]",
    "key": "store:api:/store/gift-codes/[id]",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/gift-codes/redeem",
    "key": "store:api:/store/gift-codes/redeem",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/webhooks/stripe",
    "key": "store:api:/store/webhooks/stripe",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/community-goal",
    "key": "store:api:/store/community-goal",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/checkout/paypal",
    "key": "store:api:/store/checkout/paypal",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/checkout/paypal/capture",
    "key": "store:api:/store/checkout/paypal/capture",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/store/credits/buy",
    "key": "store:api:/store/credits/buy",
    "module": "store",
    "method": "ALL"
  },
  {
    "path": "/suggestions",
    "key": "suggestions:api:/suggestions",
    "module": "suggestions",
    "method": "ALL"
  },
  {
    "path": "/suggestions/[id]/vote",
    "key": "suggestions:api:/suggestions/[id]/vote",
    "module": "suggestions",
    "method": "ALL"
  },
  {
    "path": "/suggestions/[id]",
    "key": "suggestions:api:/suggestions/[id]",
    "module": "suggestions",
    "method": "ALL"
  },
  {
    "path": "/tickets",
    "key": "tickets:api:/tickets",
    "module": "tickets",
    "method": "ALL"
  },
  {
    "path": "/tickets/departments",
    "key": "tickets:api:/tickets/departments",
    "module": "tickets",
    "method": "ALL"
  },
  {
    "path": "/tickets/departments/[id]",
    "key": "tickets:api:/tickets/departments/[id]",
    "module": "tickets",
    "method": "ALL"
  },
  {
    "path": "/tickets/[id]",
    "key": "tickets:api:/tickets/[id]",
    "module": "tickets",
    "method": "ALL"
  },
  {
    "path": "/support/stats",
    "key": "tickets:api:/support/stats",
    "module": "tickets",
    "method": "ALL"
  },
  {
    "path": "/tickets/stats",
    "key": "tickets:api:/tickets/stats",
    "module": "tickets",
    "method": "ALL"
  },
  {
    "path": "/auth/two-factor/setup",
    "key": "two-factor-auth:api:/auth/two-factor/setup",
    "module": "two-factor-auth",
    "method": "ALL"
  },
  {
    "path": "/auth/two-factor/verify",
    "key": "two-factor-auth:api:/auth/two-factor/verify",
    "module": "two-factor-auth",
    "method": "ALL"
  },
  {
    "path": "/auth/two-factor/disable",
    "key": "two-factor-auth:api:/auth/two-factor/disable",
    "module": "two-factor-auth",
    "method": "ALL"
  },
  {
    "path": "/auth/verify",
    "key": "two-factor-auth:api:/auth/verify",
    "module": "two-factor-auth",
    "method": "ALL"
  },
  {
    "path": "/auth/setup",
    "key": "two-factor-auth:api:/auth/setup",
    "module": "two-factor-auth",
    "method": "ALL"
  },
  {
    "path": "/auth/disable",
    "key": "two-factor-auth:api:/auth/disable",
    "module": "two-factor-auth",
    "method": "ALL"
  },
  {
    "path": "/vote/sites",
    "key": "vote:api:/vote/sites",
    "module": "vote",
    "method": "ALL"
  },
  {
    "path": "/vote/claim",
    "key": "vote:api:/vote/claim",
    "module": "vote",
    "method": "ALL"
  },
  {
    "path": "/webhook-logs",
    "key": "webhook-logs:api:/webhook-logs",
    "module": "webhook-logs",
    "method": "ALL"
  },
  {
    "path": "/wheel/prizes",
    "key": "wheel:api:/wheel/prizes",
    "module": "wheel",
    "method": "ALL"
  },
  {
    "path": "/wheel/prizes/[id]",
    "key": "wheel:api:/wheel/prizes/[id]",
    "module": "wheel",
    "method": "ALL"
  },
  {
    "path": "/wheel/spin",
    "key": "wheel:api:/wheel/spin",
    "module": "wheel",
    "method": "ALL"
  }
];

export const ModuleApiRegistry: Record<string, () => Promise<any>> = {
  'announcements:api:/announcements': () => import('@/modules/announcements/api/route'),
  'announcements:api:/announcements/[id]': () => import('@/modules/announcements/api/[id]/route'),
  'blog:api:/blog/articles': () => import('@/modules/blog/api/articles/route'),
  'blog:api:/blog/articles/[id]': () => import('@/modules/blog/api/articles/[id]/route'),
  'blog:api:/blog/categories': () => import('@/modules/blog/api/categories/route'),
  'blog:api:/blog/categories/[id]': () => import('@/modules/blog/api/categories/[id]/route'),
  'blog:api:/blog/comments': () => import('@/modules/blog/api/comments/route'),
  'blog:api:/blog/comments/[id]': () => import('@/modules/blog/api/comments/[id]/route'),
  'blog:api:/blog/stats': () => import('@/modules/blog/api/stats/route'),
  'changelog:api:/changelog': () => import('@/modules/changelog/api/route'),
  'changelog:api:/changelog/[id]': () => import('@/modules/changelog/api/[id]/route'),
  'credits:api:/credits': () => import('@/modules/credits/api/credits/route'),
  'credits:api:/credits/purchase': () => import('@/modules/credits/api/credits/purchase/route'),
  'custom-forms:api:/forms': () => import('@/modules/custom-forms/api/route'),
  'custom-forms:api:/forms/[slug]': () => import('@/modules/custom-forms/api/[slug]/route'),
  'custom-forms:api:/forms/submissions': () => import('@/modules/custom-forms/api/submissions/route'),
  'custom-pages:api:/custom-pages': () => import('@/modules/custom-pages/api/route'),
  'custom-pages:api:/custom-pages/[slug]': () => import('@/modules/custom-pages/api/[slug]/route'),
  'data-tools:api:/admin/export': () => import('@/modules/data-tools/api/export/route'),
  'data-tools:api:/admin/import': () => import('@/modules/data-tools/api/import/route'),
  'downloads:api:/downloads': () => import('@/modules/downloads/api/route'),
  'downloads:api:/downloads/[id]': () => import('@/modules/downloads/api/[id]/route'),
  'forum:api:/forum/categories': () => import('@/modules/forum/api/categories/route'),
  'forum:api:/forum/topics': () => import('@/modules/forum/api/topics/route'),
  'forum:api:/forum/topics/[id]': () => import('@/modules/forum/api/topics/[id]/route'),
  'forum:api:/forum/posts/[id]': () => import('@/modules/forum/api/posts/[id]/route'),
  'forum:api:/forum/topics/[id]/like': () => import('@/modules/forum/api/topics/[id]/like/route'),
  'forum:api:/forum/posts/[id]/like': () => import('@/modules/forum/api/posts/[id]/like/route'),
  'forum:api:/forum/stats': () => import('@/modules/forum/api/stats/route'),
  'help-center:api:/help/articles': () => import('@/modules/help-center/api/help/articles/route'),
  'help-center:api:/help/articles/[slug]': () => import('@/modules/help-center/api/help/articles/[slug]/route'),
  'help-center:api:/help/categories': () => import('@/modules/help-center/api/help/categories/route'),
  'leaderboard:api:/leaderboard': () => import('@/modules/leaderboard/api/route'),
  'notifications:api:/notifications': () => import('@/modules/notifications/api/route'),
  'player-profiles:api:/players/[username]': () => import('@/modules/player-profiles/api/[username]/route'),
  'player-profiles:api:/linked-accounts': () => import('@/modules/player-profiles/api/linked-accounts/route'),
  'player-profiles:api:/players/linked-accounts': () => import('@/modules/player-profiles/api/linked-accounts/route'),
  'popups:api:/popups': () => import('@/modules/popups/api/route'),
  'popups:api:/popups/[id]': () => import('@/modules/popups/api/[id]/route'),
  'punishments:api:/punishments': () => import('@/modules/punishments/api/route'),
  'punishments:api:/punishments/[id]': () => import('@/modules/punishments/api/[id]/route'),
  'referral:api:/referral': () => import('@/modules/referral/api/route'),
  'referral:api:/referral/stats': () => import('@/modules/referral/api/stats/route'),
  'seo:api:/seo/pages': () => import('@/modules/seo/api/pages/route'),
  'seo:api:/seo/pages/[id]': () => import('@/modules/seo/api/pages/[id]/route'),
  'seo:api:/seo/settings': () => import('@/modules/seo/api/settings/route'),
  'seo:api:/seo/lookup': () => import('@/modules/seo/api/lookup/route'),
  'servers:api:/servers': () => import('@/modules/servers/api/route'),
  'servers:api:/server-status': () => import('@/modules/servers/api/status/route'),
  'servers:api:/rcon': () => import('@/modules/servers/api/rcon/route'),
  'servers:api:/servers/[id]': () => import('@/modules/servers/api/[id]/route'),
  'servers:api:/servers/status': () => import('@/modules/servers/api/status/route'),
  'servers:api:/servers/rcon': () => import('@/modules/servers/api/rcon/route'),
  'slider:api:/slider': () => import('@/modules/slider/api/route'),
  'staff:api:/staff': () => import('@/modules/staff/api/route'),
  'staff:api:/staff-applications': () => import('@/modules/staff/api/applications/route'),
  'staff:api:/staff-applications/[id]': () => import('@/modules/staff/api/applications/[id]/route'),
  'staff:api:/staff/[id]': () => import('@/modules/staff/api/[id]/route'),
  'staff:api:/staff/applications': () => import('@/modules/staff/api/applications/route'),
  'staff:api:/staff/applications/[id]': () => import('@/modules/staff/api/applications/[id]/route'),
  'store:api:/store/cart': () => import('@/modules/store/api/cart/route'),
  'store:api:/store/checkout': () => import('@/modules/store/api/checkout/route'),
  'store:api:/store/categories': () => import('@/modules/store/api/categories/route'),
  'store:api:/store/categories/[id]': () => import('@/modules/store/api/categories/[id]/route'),
  'store:api:/store/products': () => import('@/modules/store/api/products/route'),
  'store:api:/store/products/[id]': () => import('@/modules/store/api/products/[id]/route'),
  'store:api:/store/orders': () => import('@/modules/store/api/orders/route'),
  'store:api:/store/orders/[id]': () => import('@/modules/store/api/orders/[id]/route'),
  'store:api:/store/coupons': () => import('@/modules/store/api/coupons/route'),
  'store:api:/store/coupons/[id]': () => import('@/modules/store/api/coupons/[id]/route'),
  'store:api:/store/coupons/validate': () => import('@/modules/store/api/coupons/validate/route'),
  'store:api:/store/stats': () => import('@/modules/store/api/stats/route'),
  'store:api:/gift-codes': () => import('@/modules/store/api/gift-codes/route'),
  'store:api:/gift-codes/redeem': () => import('@/modules/store/api/gift-codes/redeem/route'),
  'store:api:/creator-codes': () => import('@/modules/store/api/creator-codes/route'),
  'store:api:/bulk-discounts': () => import('@/modules/store/api/bulk-discounts/route'),
  'store:api:/chest': () => import('@/modules/store/api/chest/route'),
  'store:api:/product-commands': () => import('@/modules/store/api/product-commands/route'),
  'store:api:/product-variables': () => import('@/modules/store/api/product-variables/route'),
  'store:api:/widget-stats': () => import('@/modules/store/api/widget-stats/route'),
  'store:api:/webhooks/stripe': () => import('@/modules/store/api/webhooks/stripe/route'),
  'store:api:/chest/[id]': () => import('@/modules/store/api/chest/[id]/route'),
  'store:api:/creator-codes/[id]': () => import('@/modules/store/api/creator-codes/[id]/route'),
  'store:api:/gift-codes/[id]': () => import('@/modules/store/api/gift-codes/[id]/route'),
  'store:api:/community-goal': () => import('@/modules/store/api/community-goal/route'),
  'store:api:/store/product-variables': () => import('@/modules/store/api/product-variables/route'),
  'store:api:/store/widget-stats': () => import('@/modules/store/api/widget-stats/route'),
  'store:api:/store/chest': () => import('@/modules/store/api/chest/route'),
  'store:api:/store/chest/[id]': () => import('@/modules/store/api/chest/[id]/route'),
  'store:api:/store/product-commands': () => import('@/modules/store/api/product-commands/route'),
  'store:api:/store/bulk-discounts': () => import('@/modules/store/api/bulk-discounts/route'),
  'store:api:/store/creator-codes': () => import('@/modules/store/api/creator-codes/route'),
  'store:api:/store/creator-codes/[id]': () => import('@/modules/store/api/creator-codes/[id]/route'),
  'store:api:/store/creator-codes/validate': () => import('@/modules/store/api/creator-codes/validate/route'),
  'store:api:/store/gift-codes': () => import('@/modules/store/api/gift-codes/route'),
  'store:api:/store/gift-codes/[id]': () => import('@/modules/store/api/gift-codes/[id]/route'),
  'store:api:/store/gift-codes/redeem': () => import('@/modules/store/api/gift-codes/redeem/route'),
  'store:api:/store/webhooks/stripe': () => import('@/modules/store/api/webhooks/stripe/route'),
  'store:api:/store/community-goal': () => import('@/modules/store/api/community-goal/route'),
  'store:api:/store/checkout/paypal': () => import('@/modules/store/api/checkout/paypal/route'),
  'store:api:/store/checkout/paypal/capture': () => import('@/modules/store/api/checkout/paypal/capture/route'),
  'store:api:/store/credits/buy': () => import('@/modules/store/api/credits/buy/route'),
  'suggestions:api:/suggestions': () => import('@/modules/suggestions/api/route'),
  'suggestions:api:/suggestions/[id]/vote': () => import('@/modules/suggestions/api/[id]/vote/route'),
  'suggestions:api:/suggestions/[id]': () => import('@/modules/suggestions/api/[id]/route'),
  'tickets:api:/tickets': () => import('@/modules/tickets/api/tickets/route'),
  'tickets:api:/tickets/departments': () => import('@/modules/tickets/api/tickets/departments/route'),
  'tickets:api:/tickets/departments/[id]': () => import('@/modules/tickets/api/tickets/departments/[id]/route'),
  'tickets:api:/tickets/[id]': () => import('@/modules/tickets/api/tickets/[id]/route'),
  'tickets:api:/support/stats': () => import('@/modules/tickets/api/stats/route'),
  'tickets:api:/tickets/stats': () => import('@/modules/tickets/api/stats/route'),
  'two-factor-auth:api:/auth/two-factor/setup': () => import('@/modules/two-factor-auth/api/setup/route'),
  'two-factor-auth:api:/auth/two-factor/verify': () => import('@/modules/two-factor-auth/api/verify/route'),
  'two-factor-auth:api:/auth/two-factor/disable': () => import('@/modules/two-factor-auth/api/disable/route'),
  'two-factor-auth:api:/auth/verify': () => import('@/modules/two-factor-auth/api/verify/route'),
  'two-factor-auth:api:/auth/setup': () => import('@/modules/two-factor-auth/api/setup/route'),
  'two-factor-auth:api:/auth/disable': () => import('@/modules/two-factor-auth/api/disable/route'),
  'vote:api:/vote/sites': () => import('@/modules/vote/api/sites/route'),
  'vote:api:/vote/claim': () => import('@/modules/vote/api/claim/route'),
  'webhook-logs:api:/webhook-logs': () => import('@/modules/webhook-logs/api/route'),
  'wheel:api:/wheel/prizes': () => import('@/modules/wheel/api/prizes/route'),
  'wheel:api:/wheel/prizes/[id]': () => import('@/modules/wheel/api/prizes/[id]/route'),
  'wheel:api:/wheel/spin': () => import('@/modules/wheel/api/spin/route'),
};



// Widget component registry
export const WidgetComponentRegistry: Record<string, any> = {
  'SliderWidget': dynamic(() => import('@/modules/slider/widgets/slider-widget').then((mod: any) => mod.SliderWidget || mod.default || mod), { loading: () => null }),
  'DiscordWidget': dynamic(() => import('@/modules/discord-widget/widgets/discord-widget').then((mod: any) => mod.DiscordWidget || mod.default || mod), { loading: () => null }),
};

// Homepage section component registry
export const HomepageSectionRegistry: Record<string, any> = {
  'BlogNewsSection': dynamic(() => import('@/modules/blog/components/BlogNewsSection').then((mod: any) => mod.BlogNewsSection || mod.default || mod), { loading: () => null }),
};

export const ModuleHomepageSections: { id: string; type: string; component: string; order: number; module: string }[] = [
  {
    "id": "BlogNewsSection",
    "type": "content",
    "component": "components/BlogNewsSection",
    "order": 10,
    "module": "blog"
  }
];

// Layout component registry (rendered on every page)
export const LayoutComponentRegistry: Record<string, any> = {
  'GoogleAnalytics': dynamic(() => import('@/modules/analytics/components/GoogleAnalytics').then((mod: any) => mod.GoogleAnalytics || mod.default || mod), { loading: () => null }),
  'AnnouncementBanner': dynamic(() => import('@/modules/announcements/components/AnnouncementBanner').then((mod: any) => mod.AnnouncementBanner || mod.default || mod), { loading: () => null }),
  'CookieConsent': dynamic(() => import('@/modules/cookie-consent/components/CookieConsent').then((mod: any) => mod.CookieConsent || mod.default || mod), { loading: () => null }),
  'CurrencyProvider': dynamic(() => import('@/modules/currency/lib/context').then((mod: any) => mod.CurrencyProvider || mod.default || mod), { loading: () => null }),
  'PopupModal': dynamic(() => import('@/modules/popups/components/PopupModal').then((mod: any) => mod.PopupModal || mod.default || mod), { loading: () => null }),
  'SeoHead': dynamic(() => import('@/modules/seo/components/SeoHead').then((mod: any) => mod.SeoHead || mod.default || mod), { loading: () => null }),
  'LivePurchaseToast': dynamic(() => import('@/modules/store/components/LivePurchaseToast').then((mod: any) => mod.LivePurchaseToast || mod.default || mod), { loading: () => null }),
};

export const ModuleLayoutComponents: { id: string; component: string; module: string; include?: string[]; exclude?: string[] }[] = [
  {
    "id": "GoogleAnalytics",
    "component": "components/GoogleAnalytics",
    "module": "analytics"
  },
  {
    "id": "AnnouncementBanner",
    "component": "components/AnnouncementBanner",
    "exclude": [
      "/admin/*"
    ],
    "module": "announcements"
  },
  {
    "id": "CookieConsent",
    "component": "components/CookieConsent",
    "exclude": [
      "/admin/*"
    ],
    "module": "cookie-consent"
  },
  {
    "id": "CurrencyProvider",
    "component": "lib/context",
    "module": "currency"
  },
  {
    "id": "PopupModal",
    "component": "components/PopupModal",
    "exclude": [
      "/admin/*"
    ],
    "module": "popups"
  },
  {
    "id": "SeoHead",
    "component": "components/SeoHead.tsx",
    "module": "seo"
  },
  {
    "id": "LivePurchaseToast",
    "component": "components/LivePurchaseToast",
    "module": "store"
  }
];

// Navbar component registry (rendered in navbar right side)
export const NavbarComponentRegistry: Record<string, any> = {
  'NotificationBell': dynamic(() => import('@/modules/notifications/components/NotificationBell').then((mod: any) => mod.NotificationBell || mod.default || mod), { loading: () => null }),
  'CartIcon': dynamic(() => import('@/modules/store/components/CartIcon').then((mod: any) => mod.CartIcon || mod.default || mod), { loading: () => null }),
};

export const ModuleNavbarComponents: { id: string; component: string; order: number; module: string }[] = [
  {
    "id": "NotificationBell",
    "component": "components/NotificationBell",
    "order": 10,
    "module": "notifications"
  },
  {
    "id": "CartIcon",
    "component": "components/CartIcon",
    "order": 20,
    "module": "store"
  }
];

export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = [
  {
    "id": "SliderWidget",
    "component": "widgets/slider-widget",
    "defaultOrder": -10,
    "defaultVisible": true,
    "module": "slider"
  },
  {
    "id": "DiscordWidget",
    "component": "widgets/discord-widget",
    "defaultOrder": 0,
    "defaultVisible": true,
    "module": "discord-widget"
  }
];

export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = [];

export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = [];

export const ModuleDashboardCards: { id: string; label: string; icon: string; href: string; color: string; statKey: string; module: string }[] = [
  {
    "id": "articles",
    "label": "Articles",
    "icon": "FileText",
    "href": "/admin/blog/articles",
    "color": "text-indigo-600",
    "statKey": "articles",
    "module": "blog"
  },
  {
    "id": "topics",
    "label": "Topics",
    "icon": "MessageSquare",
    "href": "/admin/forum/categories",
    "color": "text-teal-600",
    "statKey": "topics",
    "module": "forum"
  },
  {
    "id": "revenue",
    "label": "Revenue",
    "icon": "DollarSign",
    "href": "/admin/store/orders",
    "color": "text-green-600",
    "statKey": "revenue",
    "module": "store"
  },
  {
    "id": "orders",
    "label": "Orders",
    "icon": "ShoppingCart",
    "href": "/admin/store/orders",
    "color": "text-blue-600",
    "statKey": "orders",
    "module": "store"
  },
  {
    "id": "products",
    "label": "Products",
    "icon": "Package",
    "href": "/admin/store/products",
    "color": "text-purple-600",
    "statKey": "products",
    "module": "store"
  },
  {
    "id": "tickets",
    "label": "Tickets",
    "icon": "Ticket",
    "href": "/admin/tickets",
    "color": "text-red-600",
    "statKey": "tickets",
    "module": "tickets"
  }
];

// Profile tab component registry
export const ProfileTabRegistry: Record<string, any> = {
  'ProfileOrdersTab': dynamic(() => import('@/modules/store/components/ProfileOrdersTab').then((mod: any) => mod.ProfileOrdersTab || mod.default || mod), { loading: () => null }),
  'ProfileChestTab': dynamic(() => import('@/modules/store/components/ProfileChestTab').then((mod: any) => mod.ProfileChestTab || mod.default || mod), { loading: () => null }),
  'referrals': dynamic(() => import('@/modules/referral/components/ReferralTab').then((mod: any) => mod.referrals || mod.default || mod), { loading: () => null }),
  'ProfileSecurityTab': dynamic(() => import('@/modules/two-factor-auth/components/ProfileSecurityTab').then((mod: any) => mod.ProfileSecurityTab || mod.default || mod), { loading: () => null }),
};

export const ModuleProfileTabs: { id: string; label: string; component: string; order: number; module: string }[] = [
  {
    "id": "ProfileOrdersTab",
    "label": "Orders",
    "component": "components/ProfileOrdersTab",
    "order": 10,
    "module": "store"
  },
  {
    "id": "ProfileChestTab",
    "label": "Chest",
    "component": "components/ProfileChestTab",
    "order": 20,
    "module": "store"
  },
  {
    "id": "referrals",
    "label": "Referrals",
    "component": "components/ReferralTab.tsx",
    "order": 40,
    "module": "referral"
  },
  {
    "id": "ProfileSecurityTab",
    "label": "Security",
    "component": "components/ProfileSecurityTab",
    "order": 50,
    "module": "two-factor-auth"
  }
];

export const ModuleOauthButtons: { id: string; provider: string; label: string; color: string; svgIcon: string; module: string }[] = [
  {
    "id": "discord-login",
    "provider": "discord",
    "label": "Discord",
    "color": "#5865F2",
    "svgIcon": "M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z",
    "module": "discord-auth"
  },
  {
    "id": "google-login",
    "provider": "google",
    "label": "Google",
    "color": "#4285F4",
    "svgIcon": "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z|M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z|M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z|M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
    "module": "google-auth"
  }
];

export const ModuleSettingsCards: { title: string; description: string; href: string; icon: string; color: string; module: string }[] = [
  {
    "title": "Analytics",
    "description": "Google Analytics tracking.",
    "href": "/analytics",
    "icon": "BarChart",
    "color": "text-green-500",
    "module": "analytics"
  },
  {
    "title": "Discord OAuth",
    "description": "Discord application credentials.",
    "href": "/settings/discord-auth",
    "icon": "MessageSquare",
    "color": "text-indigo-500",
    "module": "discord-auth"
  },
  {
    "title": "Discord",
    "description": "Discord webhook notifications.",
    "href": "/discord",
    "icon": "MessageSquare",
    "color": "text-indigo-500",
    "module": "discord-integration"
  },
  {
    "title": "Google OAuth",
    "description": "Google application credentials.",
    "href": "/settings/google-auth",
    "icon": "Globe",
    "color": "text-red-500",
    "module": "google-auth"
  },
  {
    "title": "PayPal",
    "description": "PayPal API credentials.",
    "href": "/settings/paypal",
    "icon": "DollarSign",
    "color": "text-blue-500",
    "module": "paypal-gateway"
  },
  {
    "title": "Resend",
    "description": "Resend API key configuration.",
    "href": "/settings/resend",
    "icon": "Mail",
    "color": "text-cyan-500",
    "module": "resend-provider"
  },
  {
    "title": "Security",
    "description": "CAPTCHA, login protection, and security settings.",
    "href": "/security",
    "icon": "Shield",
    "color": "text-red-500",
    "module": "security"
  },
  {
    "title": "SEO Settings",
    "description": "Configure default meta tags and social sharing",
    "href": "/seo",
    "icon": "Search",
    "color": "text-teal-500",
    "module": "seo"
  },
  {
    "title": "RCON",
    "description": "Game server RCON settings.",
    "href": "/settings/rcon",
    "icon": "Server",
    "color": "text-orange-500",
    "module": "servers"
  },
  {
    "title": "Payments",
    "description": "Stripe and PayPal configuration.",
    "href": "/settings/payments",
    "icon": "DollarSign",
    "color": "text-emerald-500",
    "module": "store"
  },
  {
    "title": "Stripe",
    "description": "Stripe API keys and webhook configuration.",
    "href": "/settings/stripe",
    "icon": "CreditCard",
    "color": "text-purple-500",
    "module": "stripe-gateway"
  }
];
