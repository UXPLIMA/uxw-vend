"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useModalDialog } from "@/core/hooks/useModalDialog";
import { NavIcon } from "@/core/components/ui/NavIcon";
import { SiteName } from "@/core/components/ui/site-name";
import { Slot } from "@/core/components/Slot";

/**
 * The whole of the navigation, on a phone.
 *
 * What stood here was a fixed bar across the bottom holding five slots: Home,
 * the first three enabled module links in registry order, and Profile. With
 * forty-four module screens installed, that is five ways in and thirty-nine
 * pages with none, and which three modules won a slot was decided by the order
 * a generated registry happened to list them in. The rest of the site was
 * reachable only by scrolling to the footer, which listed nine of them.
 *
 * A panel has no slots to run out of, so the arithmetic goes away: the list
 * here is the list the bar builds, unfolded. The bar's "More" group is a
 * placeholder pointing at "#" - a tap that does nothing - so its children are
 * drawn as links of their own under its name.
 */

export interface MobileNavLink {
    label: string;
    href: string;
    icon?: string;
    children?: { label: string; href: string; icon?: string }[];
}

const ROW = "flex items-center gap-3 px-4 py-3 rounded-lg text-base text-foreground hover:bg-muted transition-colors";

export function MobileMenu({ links, children }: { links: MobileNavLink[]; children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const t = useTranslations("nav");
    const pathname = usePathname();

    // Closing on the address rather than on each control: the account block is
    // passed in, so its links are not ours to attach a handler to, and a panel
    // still standing over the page it just navigated to is the same bug
    // whichever link did it.
    useEffect(() => { setOpen(false); }, [pathname]);

    // The panel covers the page and closes on the scrim, so it owes a keyboard
    // user the same exit every other dialog here owes.
    const panelRef = useModalDialog<HTMLDivElement>(open, () => setOpen(false));

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t("menu")}
                aria-expanded={open}
                className="sm:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
                <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            {open && (
                <>
                    <div
                        className="sm:hidden fixed inset-0 z-[60] bg-black/50"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t("menu")}
                        className="sm:hidden fixed inset-y-0 left-0 z-[61] w-[85%] max-w-sm bg-card border-r border-border shadow-xl flex flex-col animate-fade-in"
                    >
                        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
                            <SiteName className="font-semibold text-foreground" />
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label={t("close")}
                                className="p-2 -mr-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" aria-hidden="true" />
                            </button>
                        </div>

                        <nav aria-label={t("mobile")} className="flex-1 overflow-y-auto p-2">
                            <Slot name="mobile.nav" />
                            {links.map((link) =>
                                link.children && link.children.length > 0 ? (
                                    <div key={link.label} className="mt-4 first:mt-0">
                                        <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            {link.label}
                                        </p>
                                        {link.children.map((child) => (
                                            <Link key={child.href} href={child.href} className={ROW}>
                                                <NavIcon name={child.icon} className="w-5 h-5 shrink-0" />
                                                {child.label}
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <Link key={link.href} href={link.href} className={ROW}>
                                        <NavIcon name={link.icon} className="w-5 h-5 shrink-0" />
                                        {link.label}
                                    </Link>
                                ),
                            )}
                        </nav>

                        {/* Whatever the bar draws for an account, drawn once more
                            where a phone can reach it without a second control. */}
                        {children && (
                            <div className="border-t border-border p-2 shrink-0">
                                {children}
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
