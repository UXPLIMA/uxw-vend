"use client";

import { useState } from "react";
import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe, DollarSign, Mail, Facebook, Instagram, Twitter, Youtube, ChevronDown } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { localeNames, locales, type Locale } from "@/core/lib/i18n/config";
import { useCurrency, currencies, type CurrencyCode } from "@/core/lib/currency/context";

// Custom Dropdown Component for Footer
function CustomDropdown({
    options,
    value,
    onChange,
    formatLabel
}: {
    options: readonly string[] | string[];
    value: string;
    onChange: (value: string) => void;
    formatLabel?: (value: string) => string;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm min-w-[100px]"
            >
                <span className="flex-1 text-left">{formatLabel ? formatLabel(value) : value}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 w-full bg-gray-800 border border-white/10 rounded shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option}
                                onClick={() => { onChange(option); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${value === option ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                            >
                                {formatLabel ? formatLabel(option) : option}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export function Footer() {
    const t = useTranslations('footer');
    const commonT = useTranslations('common');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const { currency, setCurrency } = useCurrency();

    const handleLocaleChange = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale });
    };

    return (
        <footer className="bg-gray-900 text-white mt-12">
            <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-white font-bold text-lg">{serverConfig.name}</span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                            {serverConfig.description}
                        </p>
                        <div className="flex gap-3">
                            <Link href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-blue-600 flex items-center justify-center transition-colors">
                                <Facebook className="w-4 h-4" />
                            </Link>
                            <Link href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-pink-600 flex items-center justify-center transition-colors">
                                <Instagram className="w-4 h-4" />
                            </Link>
                            <Link href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-sky-500 flex items-center justify-center transition-colors">
                                <Twitter className="w-4 h-4" />
                            </Link>
                            <Link href="#" className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition-colors">
                                <Youtube className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">{t('quickLinks')}</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/" className="text-gray-400 hover:text-white transition-colors">{commonT('home')}</Link></li>
                            <li><Link href="/store" className="text-gray-400 hover:text-white transition-colors">{commonT('store')}</Link></li>
                            <li><Link href="/support" className="text-gray-400 hover:text-white transition-colors">{commonT('support')}</Link></li>
                            <li><Link href="/faq" className="text-gray-400 hover:text-white transition-colors">{t('faq')}</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">{t('legal')}</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/terms" className="text-gray-400 hover:text-white transition-colors">{t('termsOfService')}</Link></li>
                            <li><Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">{t('privacyPolicy')}</Link></li>
                            <li><Link href="/refund" className="text-gray-400 hover:text-white transition-colors">{t('refundPolicy')}</Link></li>
                            <li><Link href="/rules" className="text-gray-400 hover:text-white transition-colors">{t('serverRules')}</Link></li>
                        </ul>
                    </div>

                    {/* Settings */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">{commonT('settings')}</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <CustomDropdown
                                    options={locales}
                                    value={locale}
                                    onChange={handleLocaleChange}
                                    formatLabel={(l) => localeNames[l as Locale]}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                <CustomDropdown
                                    options={currencies.map(c => c.code)}
                                    value={currency}
                                    onChange={(val) => setCurrency(val as CurrencyCode)}
                                    formatLabel={(code) => {
                                        const c = currencies.find(cur => cur.code === code);
                                        return c ? `${c.code} (${c.symbol})` : code;
                                    }}
                                />
                            </div>
                        </div>

                        <div className="mt-6">
                            <p className="text-gray-400 text-sm flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                {serverConfig.email}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-gray-500 text-sm">
                            © 2026 {serverConfig.name}. {t('allRightsReserved')}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{t('builtWith')}</span>
                            <span className="text-red-400">♥</span>
                            <span>{t('by')}</span>
                            <Link href="#" className="text-blue-400 font-medium hover:text-blue-300">uxwVend Team</Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
