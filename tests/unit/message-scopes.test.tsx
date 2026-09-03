import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { withoutAdminNamespaces, ADMIN_ONLY_NAMESPACES } from "@/core/lib/i18n/message-scopes";

const MESSAGES = {
    common: { home: "Home" },
    admin: { crud_create: "Create" },
    store: { title: "Store" },
};

describe("withoutAdminNamespaces", () => {
    it("drops the admin namespace and keeps the rest", () => {
        expect(withoutAdminNamespaces(MESSAGES)).toEqual({
            common: { home: "Home" },
            store: { title: "Store" },
        });
    });

    it("does not mutate the catalogue it was given", () => {
        withoutAdminNamespaces(MESSAGES);
        expect(MESSAGES.admin).toEqual({ crud_create: "Create" });
    });

    it("survives a catalogue that has no admin namespace", () => {
        expect(withoutAdminNamespaces({ common: { home: "Home" } })).toEqual({ common: { home: "Home" } });
    });

    it("names only namespaces that exist in the catalogue", () => {
        for (const namespace of ADMIN_ONLY_NAMESPACES) {
            expect(Object.keys(MESSAGES)).toContain(namespace);
        }
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
            <NextIntlClientProvider locale="en" messages={withoutAdminNamespaces(MESSAGES)}>
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
            <NextIntlClientProvider locale="en" messages={withoutAdminNamespaces(MESSAGES)} onError={onError}>
                <AdminKey />
            </NextIntlClientProvider>,
        );
        expect(screen.getByTestId("v").textContent).not.toBe("Create");
        expect(onError).toHaveBeenCalled();
    });
});
