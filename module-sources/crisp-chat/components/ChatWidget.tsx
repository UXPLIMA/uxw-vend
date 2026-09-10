"use client";

import { useEffect, useState } from "react";
import { CRISP_SCRIPT } from "../lib/embed";

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
 *
 * The site id is assigned to a property rather than written into an inline
 * script. Both would work; only one of them stays safe if the value ever
 * stops being checked, and a `<script>` whose text is built from a setting is
 * the shape this platform refuses everywhere else.
 */
const CONSENT_KEY = "cookie_consent";
const ACCEPTED = "accepted";

/** What the widget reads itself out of, as the provider documents it. */
interface CrispWindow extends Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
}

export default function ChatWidget() {
    const [allowed, setAllowed] = useState(false);
    const [websiteId, setWebsiteId] = useState<string | null>(null);

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
        fetch("/api/v1/crisp-chat/config")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                // Null when the setting is not an id the provider issues; the
                // server is where that is decided, see lib/embed.ts.
                if (!cancelled && typeof data?.websiteId === "string") setWebsiteId(data.websiteId);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [allowed]);

    useEffect(() => {
        if (!allowed || !websiteId) return;
        if (document.getElementById("crisp-embed")) return;

        const holder = window as CrispWindow;
        holder.$crisp = holder.$crisp ?? [];
        holder.CRISP_WEBSITE_ID = websiteId;

        const script = document.createElement("script");
        script.id = "crisp-embed";
        script.async = true;
        // A constant, not a setting: see lib/embed.ts for why the address is
        // never something an operator can name.
        script.src = CRISP_SCRIPT;
        script.crossOrigin = "anonymous";
        document.body.appendChild(script);
    }, [allowed, websiteId]);

    return null;
}
