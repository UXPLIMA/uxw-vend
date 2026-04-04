"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import NProgress from "nprogress";

export function ProgressBar() {
    const pathname = usePathname();

    useEffect(() => {
        NProgress.done();
    }, [pathname]);

    useEffect(() => {
        const handleStart = () => NProgress.start();

        // Intercept link clicks for page transitions
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (anchor && anchor.href && !anchor.target && !anchor.href.startsWith("#")) {
                const url = new URL(anchor.href, window.location.origin);
                if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
                    handleStart();
                }
            }
        };

        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, []);

    return (
        <style>{`
            #nprogress { pointer-events: none; }
            #nprogress .bar { background: var(--color-primary); position: fixed; z-index: 9999; top: 0; left: 0; width: 100%; height: 2px; }
            #nprogress .peg { display: block; position: absolute; right: 0; width: 100px; height: 100%; box-shadow: 0 0 10px var(--color-primary), 0 0 5px var(--color-primary); opacity: 1; transform: rotate(3deg) translate(0px, -4px); }
        `}</style>
    );
}
