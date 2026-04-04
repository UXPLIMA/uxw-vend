import dynamic from 'next/dynamic';
import { PageLoader } from '@/core/components/ui/page-loader';

export const ModuleRegistry: Record<string, any> = {
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
};

export const ModuleRoutes: { path: string; key: string; module: string; isAdmin?: boolean }[] = [
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
  }
];

export const ModuleApiRoutes: { path: string; key: string; module: string; method?: string }[] = [
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
  }
];

export const ModuleApiRegistry: Record<string, () => Promise<any>> = {
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
};


export const ModuleWidgets: { id: string; component: string; module: string; defaultOrder: number; defaultVisible: boolean }[] = [];

export const ModuleNavLinks: { label: string; href: string; icon?: string; position?: number; module: string }[] = [];

export const ModuleFooterLinks: { label: string; href: string; section?: string; module: string }[] = [];
