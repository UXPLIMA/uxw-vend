import { createNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './config';

const navigation = createNavigation({
    locales,
    defaultLocale,
});

export const { Link, usePathname, useRouter, getPathname } = navigation;

/**
 * `redirect` needs its own annotated binding.
 *
 * TypeScript only treats a call as terminating control flow when the callee
 * is a name with an explicit type annotation. A destructured `const { redirect
 * } = navigation` is inferred, so every `if (!session) redirect(...)` left
 * `session` possibly null on the next line even though the call returns
 * `never`. Naming the type here restores the narrowing at every call site.
 *
 * Unlike `next/navigation`'s, this one takes the locale: `redirect({ href,
 * locale })`. That is the point of using it - a bare `/auth/login` is rewritten
 * to the default locale, which drops a Turkish visitor onto an English page.
 */
export const redirect: typeof navigation.redirect = navigation.redirect;
