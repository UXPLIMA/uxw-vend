
"use client";

import { useTranslations } from "next-intl";

export default function RetroHeroBanner() {
    const t = useTranslations('hero');

    return (
        <div className="bg-black text-center py-16 border-b-8 border-yellow-400 bg-[url('/retro-pattern.png')]">
            <div className="container mx-auto px-4">
                <h1 className="text-6xl md:text-8xl font-black text-yellow-400 mb-6 drop-shadow-[6px_6px_0px_rgba(255,255,255,0.2)] tracking-tighter uppercase">
                    RETRO_CRAFT
                </h1>
                <p className="text-xl text-white font-mono mb-8 max-w-2xl mx-auto bg-black inline-block px-4 py-2 border-2 border-white">
                    &gt; {t('joinCommunity')} <span className="animate-pulse">_</span>
                </p>

                <div className="flex justify-center gap-4">
                    <button className="bg-blue-600 text-white font-bold py-3 px-8 border-4 border-white shadow-[4px_4px_0px_0px_#fff] hover:translate-y-1 hover:shadow-none transition-all font-mono">
                        PLAY NOW
                    </button>
                    <button className="bg-red-600 text-white font-bold py-3 px-8 border-4 border-white shadow-[4px_4px_0px_0px_#fff] hover:translate-y-1 hover:shadow-none transition-all font-mono">
                        STORE
                    </button>
                </div>
            </div>
        </div>
    );
}
