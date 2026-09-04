import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
    publicMessages,
    NON_PUBLIC_NAMESPACES,
    MODULE_ADMIN_KEY_PREFIX,
} from "@/core/lib/i18n/message-scopes";

const MESSAGES = {
    common: { home: "Home" },
    admin: { crud_create: "Create" },
    setup: { welcome_title: "Welcome" },
    store: { title: "Store", adm_products: "Products" },
};

describe("publicMessages", () => {
    it("drops the operator-only namespaces and keeps the rest", () => {
        expect(publicMessages(MESSAGES)).toEqual({
            common: { home: "Home" },
            store: { title: "Store" },
        });
    });

    it("drops a module's admin-prefixed keys from a namespace it keeps", () => {
        const scoped = publicMessages(MESSAGES) as { store: Record<string, unknown> };
        expect(scoped.store).toHaveProperty("title");
        expect(scoped.store).not.toHaveProperty("adm_products");
    });

    it("does not mutate the catalogue it was given", () => {
        publicMessages(MESSAGES);
        expect(MESSAGES.admin).toEqual({ crud_create: "Create" });
        expect(MESSAGES.store).toEqual({ title: "Store", adm_products: "Products" });
    });

    it("survives a catalogue that has none of them", () => {
        expect(publicMessages({ common: { home: "Home" } })).toEqual({ common: { home: "Home" } });
    });

    it("passes a non-object namespace through untouched", () => {
        expect(publicMessages({ locale: "en" })).toEqual({ locale: "en" });
    });

    it("names only namespaces that exist in the catalogue", () => {
        for (const namespace of NON_PUBLIC_NAMESPACES) {
            expect(Object.keys(MESSAGES)).toContain(namespace);
        }
    });
});

const ROOT = process.cwd();

/** Every .ts/.tsx file under a directory, admin screens excluded. */
function nonAdminSources(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === "admin" || entry.name === "(admin)") continue;
                walk(full);
                continue;
            }
            if (/\.tsx?$/.test(entry.name)) out.push(full);
        }
    };
    walk(dir);
    return out;
}

/**
 * The trim above is only safe while the `adm_` prefix really does mean "admin
 * screen only". A module that renders one of those keys on a public page would
 * ship a raw key path to a visitor, and nothing else in the build would notice.
 */
describe("the adm_ prefix means admin-only", () => {
    const referencesAdminKey = /['"`]adm_[a-zA-Z0-9_]/;

    it("is not referenced by any component outside an admin screen", () => {
        const offenders: string[] = [];
        for (const dir of [path.join(ROOT, "module-sources"), path.join(ROOT, "src")]) {
            for (const file of nonAdminSources(dir)) {
                if (referencesAdminKey.test(fs.readFileSync(file, "utf8"))) {
                    offenders.push(path.relative(ROOT, file));
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("is the prefix the scope filter strips", () => {
        expect(MODULE_ADMIN_KEY_PREFIX).toBe("adm_");
    });
});

/** The setup wizard is the only tree that renders the setup namespace. */
describe("the setup namespace", () => {
    it("is read only by the setup wizard", () => {
        const readers: string[] = [];
        for (const dir of [path.join(ROOT, "module-sources"), path.join(ROOT, "src")]) {
            for (const file of nonAdminSources(dir)) {
                if (/(?:use|get)Translations\(\s*['"]setup['"]/.test(fs.readFileSync(file, "utf8"))) {
                    readers.push(path.relative(ROOT, file).replace(/\\/g, "/"));
                }
            }
        }
        for (const reader of readers) expect(reader).toContain("(setup)/setup");
    });

    it("has a layout that re-provides the full catalogue to that tree", () => {
        const layout = fs.readFileSync(path.join(ROOT, "src/app/[locale]/(setup)/layout.tsx"), "utf8");
        expect(layout).toContain("NextIntlClientProvider");
        expect(layout).toContain("getMessages()");
    });
});

function AdminKey() {
    const t = useTranslations("admin");
    return <span data-testid="v">{t("crud_create")}</span>;
}

function PublicKey() {
    const t = useTranslations("common");
    return <span data-testid="p">{t("home")}</span>;
}

/**
 * The arrangement the layouts use: the locale layout provides the trimmed
 * catalogue, the admin layout nests a provider carrying the full one.
 * `IntlProvider` replaces messages rather than merging them, so the nested
 * provider has to carry everything - this is the test that says so.
 */
describe("nested providers", () => {
    it("resolves an admin key inside the admin tree", () => {
        render(
            <NextIntlClientProvider locale="en" messages={publicMessages(MESSAGES)}>
                <NextIntlClientProvider locale="en" messages={MESSAGES}>
                    <AdminKey />
                    <PublicKey />
                </NextIntlClientProvider>
            </NextIntlClientProvider>,
        );
        expect(screen.getByTestId("v").textContent).toBe("Create");
        expect(screen.getByTestId("p").textContent).toBe("Home");
    });

    it("does not resolve an admin key outside it", () => {
        const onError = vi.fn();
        render(
            <NextIntlClientProvider locale="en" messages={publicMessages(MESSAGES)} onError={onError}>
                <AdminKey />
            </NextIntlClientProvider>,
        );
        expect(screen.getByTestId("v").textContent).not.toBe("Create");
        expect(onError).toHaveBeenCalled();
    });
});
