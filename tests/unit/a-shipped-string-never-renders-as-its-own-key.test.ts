// @vitest-environment node
/**
 * A string this version ships renders as words, not as its own key.
 *
 * Core's strings live in `messages-core/*.json` and are copied into the
 * `Translation` table by a seeder that runs on every container boot. Between
 * those two facts is a window: a release that adds strings has them in the
 * file and not yet in the table, and every screen that uses one renders the
 * key. Measured on the update screen the day it was written - the page read
 * `admin.updates_title`, `admin.updates_description`, `admin.updates_installed`
 * to anyone who opened it, and the sidebar fell back to its hardcoded English
 * label. Nothing failed; it just looked broken.
 *
 * The table stays the source of truth for anything an operator edited, and for
 * modules. What changes is where the answer starts: the catalogue this version
 * shipped, with the table laid over the top. A row wins wherever there is one,
 * so a customised string is still the customised string, and a string nobody
 * has seeded yet is still a string.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let rows: { namespace: string; key: string; value: string; module: string; isCustom: boolean }[] = [];
let enabledModules: string[] = [];

vi.mock("@/core/lib/db", () => ({
    prisma: {
        translation: { findMany: async () => rows },
        moduleConfig: { findMany: async () => enabledModules.map((id) => ({ id })) },
    },
}));
vi.mock("@/core/lib/redis", () => ({
    cacheGet: async () => null,
    cacheSet: async () => undefined,
    cacheDel: async () => undefined,
}));

const { getMessages } = await import("@/core/lib/i18n/translation-service");

beforeEach(() => {
    rows = [];
    enabledModules = [];
});

describe("the messages a page is given", () => {
    it("carries a string the table has never heard of", async () => {
        // The exact shape of the bug: shipped in this version, not yet seeded.
        const messages = (await getMessages("en")) as Record<string, Record<string, string>>;
        expect(messages.admin?.updates_title).toBe("Updates");
        expect(messages.admin?.updates_title).not.toContain("admin.");
    });

    it("carries it in the other language too", async () => {
        const messages = (await getMessages("tr")) as Record<string, Record<string, string>>;
        expect(messages.admin?.updates_title).toBe("Güncellemeler");
    });

    it("lets the table win, because that is where an operator's edit lives", async () => {
        rows = [
            { namespace: "admin", key: "updates_title", value: "Sürümler", module: "core", isCustom: true },
        ];
        const messages = (await getMessages("tr")) as Record<string, Record<string, string>>;
        expect(messages.admin.updates_title).toBe("Sürümler");
    });

    it("keeps the strings around the overridden one", async () => {
        rows = [{ namespace: "admin", key: "updates_title", value: "Sürümler", module: "core", isCustom: true }];
        const messages = (await getMessages("tr")) as Record<string, Record<string, string>>;
        expect(messages.admin.updates_upToDate).toBe("Bu en yeni sürüm.");
    });

    it("still answers when the file for a locale is not there", async () => {
        // A locale nobody ships a catalogue for is the module system's
        // business, not a crash.
        const messages = await getMessages("de");
        expect(messages).toBeTypeOf("object");
    });
});
