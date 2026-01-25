
"use client";

import { useTranslations } from "next-intl";

export default function RetroFooter() {
    return (
        <footer className="bg-black text-white p-12 mt-auto border-t-8 border-yellow-400">
            <div className="container mx-auto grid md:grid-cols-3 gap-8 text-center md:text-left font-mono">
                <div>
                    <h3 className="text-2xl font-bold text-yellow-400 mb-4 uppercase tracking-widest">RETRO_VEND</h3>
                    <p className="text-gray-400 text-sm">
                        EST. 2024. PIXEL PERFECT.
                    </p>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-4 uppercase border-b-2 border-white inline-block pb-1">LINKS</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li><a href="#" className="hover:text-yellow-400 hover:tracking-wide transition-all"> &gt; TERMS</a></li>
                        <li><a href="#" className="hover:text-yellow-400 hover:tracking-wide transition-all"> &gt; PRIVACY</a></li>
                        <li><a href="#" className="hover:text-yellow-400 hover:tracking-wide transition-all"> &gt; ABOUT</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-4 uppercase border-b-2 border-white inline-block pb-1">CONNECT</h4>
                    <p className="text-sm text-gray-400">
                        SERVER STATUS: <span className="text-green-400 animate-pulse">ONLINE</span>
                    </p>
                </div>
            </div>
            <div className="text-center mt-12 text-xs text-gray-600 font-bold tracking-widest">
                © 2024 UXW_VEND. ALL RIGHTS RESERVED.
            </div>
        </footer>
    );
}
