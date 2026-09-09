"use client";

import { useEffect, useState } from "react";

/**
 * Somebody else's chat widget, on every page, once the visitor has agreed.
 *
 * The script sets cookies in the visitor's browser the moment it runs, which
 * is the whole thing a consent banner exists to prevent. So nothing is
 * appended until the banner has been answered with a yes, and the answer is
 * read from the one key the banner writes. The modules cannot import each
 * other - they are separate packages a site installs one at a time - so a
 * gate holds the copies of that key together.
 *
 * It also listens, because a visitor who accepts should get the widget
 * without reloading the page they are already reading.
 */
const CONSENT_KEY = "cookie_consent";
const ACCEPTED = "accepted";

export default function ChatWidget() {
    const [allowed, setAllowed] = useState(false);
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        const check = () => setAllowed(localStorage.getItem(CONSENT_KEY) === ACCEPTED);
        check();
        // The banner writes to local storage; another tab's answer arrives as
        // a storage event, and this tab's own as the banner re-rendering.
        window.addEventListener("storage", check);
        const timer = window.setInterval(check, 2000);
        return () => {
            window.removeEventListener("storage", check);
            window.clearInterval(timer);
        };
    }, []);

    // Asked for only once consent is given: a site with no chat set up should
    // not make a request per visitor to find that out.
    useEffect(() => {
        if (!allowed) return;
        let cancelled = false;
        fetch("/api/v1/tawkto-chat/config")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                // Null when either id is not one the provider issues; the
                // server is where that is decided, see lib/embed.ts.
                if (!cancelled && typeof data?.src === "string") setSrc(data.src);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [allowed]);

    useEffect(() => {
        if (!allowed || !src) return;
        if (document.getElementById("tawkto-embed")) return;

        const script = document.createElement("script");
        script.id = "tawkto-embed";
        script.async = true;
        script.src = src;
        script.charset = "UTF-8";
        script.crossOrigin = "anonymous";
        document.body.appendChild(script);
    }, [allowed, src]);

    return null;
}
