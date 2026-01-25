
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { ShoppingCart, LogIn, UserPlus, Menu } from "lucide-react";

export default function RetroNavbar() {
    return (
        <nav className="border-b-4 border-black bg-white py-4 px-6 md:px-12 mb-8">
            <div className="container mx-auto flex items-center justify-between">
                {/* Retro Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-black"></div>
                    <span className="text-2xl font-bold font-mono tracking-tighter uppercase">RETRO_VEND</span>
                </div>

                {/* Retro Links */}
                <div className="hidden md:flex items-center gap-8 font-mono font-bold text-sm">
                    <Link href="/" className="hover:underline decoration-2 underline-offset-4">[HOME]</Link>
                    <Link href="/store" className="hover:underline decoration-2 underline-offset-4">[STORE]</Link>
                    <Link href="/blog" className="hover:underline decoration-2 underline-offset-4">[BLOG]</Link>
                    <Link href="/support" className="hover:underline decoration-2 underline-offset-4">[SUPPORT]</Link>
                </div>

                {/* Retro Actions */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all">
                        <ShoppingCart className="w-4 h-4" />
                    </Button>
                    <div className="h-6 w-0.5 bg-black mx-2 hidden md:block"></div>
                    <Link href="/auth/login">
                        <Button className="border-2 border-black bg-yellow-400 text-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-500 active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-mono font-bold">
                            LOGIN
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
