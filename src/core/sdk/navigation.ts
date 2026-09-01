/**
 * uxwVend module SDK — locale-aware navigation.
 *
 * These are the next-intl wrappers, not the bare `next/link` and
 * `next/navigation` primitives: they carry the active locale prefix, so a
 * module that uses `next/link` directly will drop users out of their language.
 */
export { Link, useRouter, redirect, usePathname } from "@/core/lib/i18n/navigation";
