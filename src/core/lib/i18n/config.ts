// i18n Configuration
export const locales = ['en', 'tr', 'de', 'es', 'fr', 'ru', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
    en: 'English',
    tr: 'Türkçe',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    ru: 'Русский',
    pt: 'Português',
};

export const localeFlags: Record<Locale, string> = {
    en: '🇺🇸',
    tr: '🇹🇷',
    de: '🇩🇪',
    es: '🇪🇸',
    fr: '🇫🇷',
    ru: '🇷🇺',
    pt: '🇧🇷',
};
