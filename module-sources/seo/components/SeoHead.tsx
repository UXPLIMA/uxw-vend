"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function SeoHead() {
    const pathname = usePathname();
    const [seo, setSeo] = useState<Record<string, string | boolean | null> | null>(null);

    useEffect(() => {
        const cleanPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, "/") || "/";
        fetch(`/api/v1/seo/lookup?path=${encodeURIComponent(cleanPath)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setSeo(d))
            .catch(() => {});
    }, [pathname]);

    useEffect(() => {
        if (!seo) return;
        if (seo.metaTitle) document.title = seo.metaTitle as string;
        const setMeta = (name: string, content: string) => {
            let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
            if (!el) { el = document.createElement("meta"); if (name.startsWith("og:")) el.setAttribute("property", name); else el.setAttribute("name", name); document.head.appendChild(el); }
            el.setAttribute("content", content);
        };
        if (seo.metaDescription) setMeta("description", seo.metaDescription as string);
        if (seo.ogTitle) setMeta("og:title", seo.ogTitle as string);
        if (seo.ogDescription) setMeta("og:description", seo.ogDescription as string);
        if (seo.ogImage) setMeta("og:image", seo.ogImage as string);
        if (seo.noIndex || seo.noFollow) { const p: string[] = []; if (seo.noIndex) p.push("noindex"); if (seo.noFollow) p.push("nofollow"); setMeta("robots", p.join(", ")); }
        if (seo.canonical) { let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement; if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); } link.href = seo.canonical as string; }
    }, [seo]);

    return null;
}
