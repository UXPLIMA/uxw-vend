/**
 * A credit history that reads `credits.typeAdmin_grant`.
 *
 * The ledger stores a machine word for what happened - `admin_grant`,
 * `credit_purchase`, `transfer_in` - and the tab turns that into a key by
 * capitalising the first letter. Four of those keys were in the catalogue.
 * Seven kinds of row are written. So a member looking at where their credits
 * came from saw the key itself for most of them, in a screen that is entirely
 * about explaining a balance.
 *
 * Nothing caught it: the strings are not unused (the tab asks for them), the
 * catalogues agree with each other (both are missing the same four), and the
 * lookup does not throw. It only shows up in front of a reader.
 *
 * So the two lists are checked against each other here: every kind of row the
 * code writes has a name in both languages.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { creditTypeKey, labelKeyFor } from "@/modules/credits/lib/ledger-types";

const ROOT = process.cwd();

/** Every `type: "..."` written to the credit ledger, found in the tree. */
function typesWritten(): string[] {
    const found = new Set<string>();
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "node_modules") walk(full);
            } else if (entry.name.endsWith(".ts")) {
                const source = fs.readFileSync(full, "utf8");
                // A row is written by the wallet and asked for by everybody
                // else, so both shapes count: the `creditTransaction` write
                // itself, and the request that carries the word to it.
                for (const anchor of ["creditTransaction", '"credit.change"', "moveCredits"]) {
                    for (const block of source.split(anchor).slice(1)) {
                        const head = block.slice(0, 600);
                        for (const match of head.matchAll(/\btype:\s*"([a-z_]+)"/g)) found.add(match[1]);
                    }
                }
            }
        }
    };
    walk(path.join(ROOT, "module-sources"));
    return [...found].sort();
}

const catalogue = JSON.parse(
    fs.readFileSync(path.join(ROOT, "module-sources", "credits", "module.json"), "utf8"),
) as { translations: Record<string, Record<string, Record<string, unknown>>> };

describe("the words a credit history is written in", () => {
    it("finds the kinds of row the code writes", () => {
        // A guard on the test: a broken scan would pass by finding none.
        expect(typesWritten().length).toBeGreaterThanOrEqual(5);
    });

    it("names every one of them, in both languages", () => {
        const missing: string[] = [];
        for (const type of typesWritten()) {
            const key = creditTypeKey(type);
            for (const locale of ["en", "tr"]) {
                if (!(key in (catalogue.translations[locale]?.credits ?? {}))) {
                    missing.push(`${locale}: ${key} (for ${type})`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});

describe("a kind of row nobody planned for", () => {
    it("is named by the screen rather than shown as a key", () => {
        // The award door takes a reason from whoever calls it, so a module
        // added next year writes a word this catalogue has never seen. The
        // scan above cannot find it - it is a variable, not a literal - so
        // the screen has to cope rather than print `credits.typeForum_post`
        // at a member.
        const known = catalogue.translations.en.credits as Record<string, unknown>;
        expect(labelKeyFor("forum_post", (key) => key in known)).toBe("typeUnknown");
        expect(labelKeyFor("cashback", (key) => key in known)).toBe("typeCashback");
    });
});

describe("turning a stored word into a key", () => {
    it("is the same rule the screen uses", () => {
        expect(creditTypeKey("admin_grant")).toBe("typeAdmin_grant");
        expect(creditTypeKey("transfer_in")).toBe("typeTransfer_in");
        expect(creditTypeKey("purchase")).toBe("typePurchase");
    });

    it("does not fall over on a word nobody planned for", () => {
        // A module added next year writes its own kind. The history should
        // still draw a row rather than throwing on the way past.
        expect(creditTypeKey("")).toBe("typeUnknown");
    });
});
