import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
  'announcements:pages/admin/page.tsx': dynamic(() => import('@/modules/announcements/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/page.tsx': dynamic(() => import('@/modules/blog/pages/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/[...params]/page.tsx': dynamic(() => import('@/modules/blog/pages/[...params]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/new/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/[id]/edit/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/[id]/edit/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/categories/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'changelog:pages/public/page.tsx': dynamic(() => import('@/modules/changelog/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'changelog:pages/admin/page.tsx': dynamic(() => import('@/modules/changelog/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-forms:pages/public/[slug]/page.tsx': dynamic(() => import('@/modules/custom-forms/pages/public/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-forms:pages/admin/page.tsx': dynamic(() => import('@/modules/custom-forms/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'custom-pages:pages/public/[slug]/page.tsx': dynamic(() => import('@/modules/custom-pages/pages/public/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'downloads:pages/public/page.tsx': dynamic(() => import('@/modules/downloads/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'downloads:pages/admin/page.tsx': dynamic(() => import('@/modules/downloads/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/page.tsx': dynamic(() => import('@/modules/forum/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/topic/[...params]/page.tsx': dynamic(() => import('@/modules/forum/pages/public/topic/[...params]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/new/page.tsx': dynamic(() => import('@/modules/forum/pages/public/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/admin/topics/page.tsx': dynamic(() => import('@/modules/forum/pages/admin/topics/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/forum/pages/admin/categories/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'leaderboard:pages/public/page.tsx': dynamic(() => import('@/modules/leaderboard/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'player-profiles:pages/public/[username]/page.tsx': dynamic(() => import('@/modules/player-profiles/pages/public/[username]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'popups:pages/admin/page.tsx': dynamic(() => import('@/modules/popups/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'punishments:pages/public/page.tsx': dynamic(() => import('@/modules/punishments/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'servers:pages/admin/page.tsx': dynamic(() => import('@/modules/servers/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'slider:pages/admin/page.tsx': dynamic(() => import('@/modules/slider/pages/admin/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'staff:pages/public/page.tsx': dynamic(() => import('@/modules/staff/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'staff:pages/admin/applications/page.tsx': dynamic(() => import('@/modules/staff/pages/admin/applications/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/page.tsx': dynamic(() => import('@/modules/store/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/cart/page.tsx': dynamic(() => import('@/modules/store/pages/public/cart/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/product/[...params]/page.tsx': dynamic(() => import('@/modules/store/pages/public/product/[...params]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/order-success/page.tsx': dynamic(() => import('@/modules/store/pages/public/order-success/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/vip/page.tsx': dynamic(() => import('@/modules/store/pages/public/vip/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/new/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/[id]/edit/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/[id]/edit/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/store/pages/admin/categories/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/orders/page.tsx': dynamic(() => import('@/modules/store/pages/admin/orders/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/orders/[id]/page.tsx': dynamic(() => import('@/modules/store/pages/admin/orders/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/coupons/page.tsx': dynamic(() => import('@/modules/store/pages/admin/coupons/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'suggestions:pages/public/page.tsx': dynamic(() => import('@/modules/suggestions/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/tickets/page.tsx': dynamic(() => import('@/modules/support/pages/public/tickets/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/tickets/new/page.tsx': dynamic(() => import('@/modules/support/pages/public/tickets/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/tickets/[id]/page.tsx': dynamic(() => import('@/modules/support/pages/public/tickets/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/help/page.tsx': dynamic(() => import('@/modules/support/pages/public/help/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/help/[slug]/page.tsx': dynamic(() => import('@/modules/support/pages/public/help/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/help/category/[slug]/page.tsx': dynamic(() => import('@/modules/support/pages/public/help/category/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/admin/tickets/page.tsx': dynamic(() => import('@/modules/support/pages/admin/tickets/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/admin/tickets/[id]/page.tsx': dynamic(() => import('@/modules/support/pages/admin/tickets/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/admin/help/page.tsx': dynamic(() => import('@/modules/support/pages/admin/help/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'vote:pages/public/page.tsx': dynamic(() => import('@/modules/vote/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'vote:pages/admin/sites/page.tsx': dynamic(() => import('@/modules/vote/pages/admin/sites/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'wheel:pages/public/page.tsx': dynamic(() => import('@/modules/wheel/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'wheel:pages/admin/prizes/page.tsx': dynamic(() => import('@/modules/wheel/pages/admin/prizes/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
};

export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
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
    "path": "/page/[slug]",
    "key": "custom-pages:pages/public/[slug]/page.tsx",
    "module": "custom-pages"
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
    "path": "/leaderboard",
    "key": "leaderboard:pages/public/page.tsx",
    "module": "leaderboard"
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
    "path": "/admin/servers",
    "key": "servers:pages/admin/page.tsx",
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
    "path": "/suggestions",
    "key": "suggestions:pages/public/page.tsx",
    "module": "suggestions"
  },
  {
    "path": "/support",
    "key": "support:pages/public/tickets/page.tsx",
    "module": "support"
  },
  {
    "path": "/support/new",
    "key": "support:pages/public/tickets/new/page.tsx",
    "module": "support"
  },
  {
    "path": "/support/[id]",
    "key": "support:pages/public/tickets/[id]/page.tsx",
    "module": "support"
  },
  {
    "path": "/help",
    "key": "support:pages/public/help/page.tsx",
    "module": "support"
  },
  {
    "path": "/help/[slug]",
    "key": "support:pages/public/help/[slug]/page.tsx",
    "module": "support"
  },
  {
    "path": "/help/category/[slug]",
    "key": "support:pages/public/help/category/[slug]/page.tsx",
    "module": "support"
  },
  {
    "path": "/admin/tickets",
    "key": "support:pages/admin/tickets/page.tsx",
    "module": "support",
    "isAdmin": true
  },
  {
    "path": "/admin/tickets/[id]",
    "key": "support:pages/admin/tickets/[id]/page.tsx",
    "module": "support",
    "isAdmin": true
  },
  {
    "path": "/admin/help",
    "key": "support:pages/admin/help/page.tsx",
    "module": "support",
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
    "path": "/changelog",
    "key": "changelog:api:/changelog",
    "module": "changelog",
    "method": "ALL"
  },
  {
    "path": "/forms",
    "key": "custom-forms:api:/forms",
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
    "path": "/downloads",
    "key": "downloads:api:/downloads",
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
    "path": "/leaderboard",
    "key": "leaderboard:api:/leaderboard",
    "module": "leaderboard",
    "method": "ALL"
  },
  {
    "path": "/players/[username]",
    "key": "player-profiles:api:/players/[username]",
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
    "path": "/punishments",
    "key": "punishments:api:/punishments",
    "module": "punishments",
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
    "path": "/suggestions",
    "key": "suggestions:api:/suggestions",
    "module": "suggestions",
    "method": "ALL"
  },
  {
    "path": "/tickets",
    "key": "support:api:/tickets",
    "module": "support",
    "method": "ALL"
  },
  {
    "path": "/tickets/departments",
    "key": "support:api:/tickets/departments",
    "module": "support",
    "method": "ALL"
  },
  {
    "path": "/tickets/[id]",
    "key": "support:api:/tickets/[id]",
    "module": "support",
    "method": "ALL"
  },
  {
    "path": "/help/articles",
    "key": "support:api:/help/articles",
    "module": "support",
    "method": "ALL"
  },
  {
    "path": "/help/categories",
    "key": "support:api:/help/categories",
    "module": "support",
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
    "path": "/wheel/prizes",
    "key": "wheel:api:/wheel/prizes",
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
  'blog:api:/blog/articles': () => import('@/modules/blog/api/articles/route'),
  'blog:api:/blog/articles/[id]': () => import('@/modules/blog/api/articles/[id]/route'),
  'blog:api:/blog/categories': () => import('@/modules/blog/api/categories/route'),
  'blog:api:/blog/categories/[id]': () => import('@/modules/blog/api/categories/[id]/route'),
  'blog:api:/blog/comments': () => import('@/modules/blog/api/comments/route'),
  'blog:api:/blog/comments/[id]': () => import('@/modules/blog/api/comments/[id]/route'),
  'changelog:api:/changelog': () => import('@/modules/changelog/api/route'),
  'custom-forms:api:/forms': () => import('@/modules/custom-forms/api/route'),
  'custom-pages:api:/custom-pages': () => import('@/modules/custom-pages/api/route'),
  'downloads:api:/downloads': () => import('@/modules/downloads/api/route'),
  'forum:api:/forum/categories': () => import('@/modules/forum/api/categories/route'),
  'forum:api:/forum/topics': () => import('@/modules/forum/api/topics/route'),
  'forum:api:/forum/topics/[id]': () => import('@/modules/forum/api/topics/[id]/route'),
  'forum:api:/forum/posts/[id]': () => import('@/modules/forum/api/posts/[id]/route'),
  'forum:api:/forum/topics/[id]/like': () => import('@/modules/forum/api/topics/[id]/like/route'),
  'forum:api:/forum/posts/[id]/like': () => import('@/modules/forum/api/posts/[id]/like/route'),
  'leaderboard:api:/leaderboard': () => import('@/modules/leaderboard/api/route'),
  'player-profiles:api:/players/[username]': () => import('@/modules/player-profiles/api/[username]/route'),
  'popups:api:/popups': () => import('@/modules/popups/api/route'),
  'punishments:api:/punishments': () => import('@/modules/punishments/api/route'),
  'servers:api:/servers': () => import('@/modules/servers/api/route'),
  'servers:api:/server-status': () => import('@/modules/servers/api/status/route'),
  'servers:api:/rcon': () => import('@/modules/servers/api/rcon/route'),
  'slider:api:/slider': () => import('@/modules/slider/api/route'),
  'staff:api:/staff': () => import('@/modules/staff/api/route'),
  'staff:api:/staff-applications': () => import('@/modules/staff/api/applications/route'),
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
  'suggestions:api:/suggestions': () => import('@/modules/suggestions/api/route'),
  'support:api:/tickets': () => import('@/modules/support/api/tickets/route'),
  'support:api:/tickets/departments': () => import('@/modules/support/api/tickets/departments/route'),
  'support:api:/tickets/[id]': () => import('@/modules/support/api/tickets/[id]/route'),
  'support:api:/help/articles': () => import('@/modules/support/api/help/articles/route'),
  'support:api:/help/categories': () => import('@/modules/support/api/help/categories/route'),
  'vote:api:/vote/sites': () => import('@/modules/vote/api/sites/route'),
  'vote:api:/vote/claim': () => import('@/modules/vote/api/claim/route'),
  'wheel:api:/wheel/prizes': () => import('@/modules/wheel/api/prizes/route'),
  'wheel:api:/wheel/spin': () => import('@/modules/wheel/api/spin/route'),
};


export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = [
  {
    "id": "DiscordWidget",
    "component": "@core/widgets/discord-widget",
    "defaultOrder": 0,
    "defaultVisible": true,
    "module": "discord-widget"
  }
];

export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = [];

export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = [];
