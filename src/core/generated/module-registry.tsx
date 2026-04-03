import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
  'blog:pages/page.tsx': dynamic(() => import('@/modules/blog/pages/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/[slug]/page.tsx': dynamic(() => import('@/modules/blog/pages/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/new/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/articles/[id]/edit/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/articles/[id]/edit/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'blog:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/blog/pages/admin/categories/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/page.tsx': dynamic(() => import('@/modules/forum/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/topic/[id]/page.tsx': dynamic(() => import('@/modules/forum/pages/public/topic/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/public/new/page.tsx': dynamic(() => import('@/modules/forum/pages/public/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'forum:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/forum/pages/admin/categories/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/page.tsx': dynamic(() => import('@/modules/store/pages/public/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/cart/page.tsx': dynamic(() => import('@/modules/store/pages/public/cart/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/product/[id]/page.tsx': dynamic(() => import('@/modules/store/pages/public/product/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/public/order-success/page.tsx': dynamic(() => import('@/modules/store/pages/public/order-success/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/new/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/products/[id]/edit/page.tsx': dynamic(() => import('@/modules/store/pages/admin/products/[id]/edit/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/categories/page.tsx': dynamic(() => import('@/modules/store/pages/admin/categories/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/orders/page.tsx': dynamic(() => import('@/modules/store/pages/admin/orders/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/orders/[id]/page.tsx': dynamic(() => import('@/modules/store/pages/admin/orders/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'store:pages/admin/coupons/page.tsx': dynamic(() => import('@/modules/store/pages/admin/coupons/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/tickets/page.tsx': dynamic(() => import('@/modules/support/pages/public/tickets/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/tickets/new/page.tsx': dynamic(() => import('@/modules/support/pages/public/tickets/new/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/tickets/[id]/page.tsx': dynamic(() => import('@/modules/support/pages/public/tickets/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/help/page.tsx': dynamic(() => import('@/modules/support/pages/public/help/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/help/[slug]/page.tsx': dynamic(() => import('@/modules/support/pages/public/help/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/public/help/category/[slug]/page.tsx': dynamic(() => import('@/modules/support/pages/public/help/category/[slug]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/admin/tickets/page.tsx': dynamic(() => import('@/modules/support/pages/admin/tickets/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/admin/tickets/[id]/page.tsx': dynamic(() => import('@/modules/support/pages/admin/tickets/[id]/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
  'support:pages/admin/help/page.tsx': dynamic(() => import('@/modules/support/pages/admin/help/page').then(mod => mod.default || mod), { loading: () => <PageLoader /> }),
};

export const ModuleRoutes = [
  {
    "path": "/blog",
    "key": "blog:pages/page.tsx",
    "module": "blog"
  },
  {
    "path": "/blog/[slug]",
    "key": "blog:pages/[slug]/page.tsx",
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
    "path": "/forum",
    "key": "forum:pages/public/page.tsx",
    "module": "forum"
  },
  {
    "path": "/forum/topic/[id]",
    "key": "forum:pages/public/topic/[id]/page.tsx",
    "module": "forum"
  },
  {
    "path": "/forum/new",
    "key": "forum:pages/public/new/page.tsx",
    "module": "forum"
  },
  {
    "path": "/admin/forum/categories",
    "key": "forum:pages/admin/categories/page.tsx",
    "module": "forum",
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
    "path": "/store/product/[id]",
    "key": "store:pages/public/product/[id]/page.tsx",
    "module": "store"
  },
  {
    "path": "/store/order-success",
    "key": "store:pages/public/order-success/page.tsx",
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
  }
];

export const ModuleApiRoutes = [
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
  }
];

export const ModuleApiRegistry: Record<string, () => Promise<any>> = {
  'blog:api:/blog/articles': () => import('@/modules/blog/api/articles/route'),
  'blog:api:/blog/articles/[id]': () => import('@/modules/blog/api/articles/[id]/route'),
  'blog:api:/blog/categories': () => import('@/modules/blog/api/categories/route'),
  'blog:api:/blog/categories/[id]': () => import('@/modules/blog/api/categories/[id]/route'),
  'blog:api:/blog/comments': () => import('@/modules/blog/api/comments/route'),
  'blog:api:/blog/comments/[id]': () => import('@/modules/blog/api/comments/[id]/route'),
  'forum:api:/forum/categories': () => import('@/modules/forum/api/categories/route'),
  'forum:api:/forum/topics': () => import('@/modules/forum/api/topics/route'),
  'forum:api:/forum/topics/[id]': () => import('@/modules/forum/api/topics/[id]/route'),
  'forum:api:/forum/posts/[id]': () => import('@/modules/forum/api/posts/[id]/route'),
  'forum:api:/forum/topics/[id]/like': () => import('@/modules/forum/api/topics/[id]/like/route'),
  'forum:api:/forum/posts/[id]/like': () => import('@/modules/forum/api/posts/[id]/like/route'),
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
  'support:api:/tickets': () => import('@/modules/support/api/tickets/route'),
  'support:api:/tickets/departments': () => import('@/modules/support/api/tickets/departments/route'),
  'support:api:/tickets/[id]': () => import('@/modules/support/api/tickets/[id]/route'),
  'support:api:/help/articles': () => import('@/modules/support/api/help/articles/route'),
  'support:api:/help/categories': () => import('@/modules/support/api/help/categories/route'),
};

