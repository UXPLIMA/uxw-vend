// i18n Configuration
export const locales = ['en', 'tr'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
    en: 'English',
    tr: 'Türkçe',
};

export const localeFlags: Record<Locale, string> = {
    en: '🇺🇸',
    tr: '🇹🇷',
};
