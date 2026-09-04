import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * Spending has to be one conditional write, not a read then a write.
 *
 * Checkout read the credit balance, compared it to the total, and decremented
 * inside a transaction. Two checkouts submitted together both read the same
 * balance, both passed the comparison, and both got their goods while the
 * balance went negative - a transaction does not stop that, because under read
 * committed both decrements simply apply. The paid wheel spin had the same
 * shape, and so did a capped coupon: two orders redeeming the last use of a
 * `usageLimit: 1` coupon both got the discount.
 *
 * The shape that cannot be raced is `updateMany` with the precondition in the
 * `where`, and a look at whether it changed anything.
 */
const SOURCES = [path.join(ROOT, "module-sources"), path.join(ROOT, "src/app"), path.join(ROOT, "src/core")];

function tsFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === "generated") continue;
                walk(full);
            } else if (/\.tsx?$/.test(entry.name)) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

/**
 * The call expression starting at `from`, read to its matching close paren so
 * a nested object or arrow function cannot end it early.
 */
function callAt(source: string, from: number): string {
    let depth = 0;
    let quote: string | null = null;
    for (let i = from; i < source.length; i++) {
        const c = source[i];
        if (quote) {
            if (c === "\\") { i++; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (depth === 0) return source.slice(from, i + 1); }
    }
    return source.slice(from);
}

/** Every `.update(`/`.updateMany(` call that decrements a credit balance. */
function creditDebits(source: string): { call: string; isConditional: boolean }[] {
    const found: { call: string; isConditional: boolean }[] = [];
    for (const match of source.matchAll(/\.(update|updateMany)\(/g)) {
        const call = callAt(source, (match.index ?? 0) + match[0].length - 1);
        if (!/creditBalance:\s*\{\s*decrement/.test(call)) continue;
        const conditional =
            match[1] === "updateMany" && /creditBalance:\s*\{\s*gte/.test(call);
        found.push({ call, isConditional: conditional });
    }
    return found;
}

describe("spending a credit balance", () => {
    it("finds the routes that spend credits", () => {
        const spenders = SOURCES.flatMap(tsFiles)
            .filter((f) => creditDebits(fs.readFileSync(f, "utf8")).length > 0)
            .map((f) => path.relative(ROOT, f));
        expect(spenders).toContain("module-sources/store/api/checkout/route.ts");
        expect(spenders).toContain("module-sources/wheel/api/spin/route.ts");
    });

    it("every debit is conditional on the balance covering it", () => {
        const offenders: string[] = [];
        for (const file of SOURCES.flatMap(tsFiles)) {
            for (const debit of creditDebits(fs.readFileSync(file, "utf8"))) {
                if (!debit.isConditional) offenders.push(path.relative(ROOT, file));
            }
        }
        expect(offenders).toEqual([]);
    });

    it("and the losing debit is answered, not ignored", () => {
        for (const name of ["module-sources/store/api/checkout/route.ts", "module-sources/wheel/api/spin/route.ts"]) {
            const source = fs.readFileSync(path.join(ROOT, name), "utf8");
            expect(source, `${name} must check whether the debit landed`).toMatch(/\.count === 0/);
        }
    });
});

describe("claiming a capped coupon", () => {
    it("increments the count conditionally wherever it is redeemed", () => {
        const offenders: string[] = [];
        for (const file of tsFiles(path.join(ROOT, "module-sources"))) {
            const source = fs.readFileSync(file, "utf8");
            for (const match of source.matchAll(/\.(update|updateMany)\(/g)) {
                const call = callAt(source, (match.index ?? 0) + match[0].length - 1);
                if (!/usageCount:\s*\{\s*increment/.test(call)) continue;
                // Creator codes count uses without capping them; only a call
                // that also carries a usageLimit precondition is a claim.
                if (!/usageLimit/.test(call) && !/usageCount:\s*\{\s*lt/.test(call)) continue;
                if (match[1] === "updateMany" && /usageCount:\s*\{\s*lt/.test(call)) continue;
                offenders.push(`${path.relative(ROOT, file)}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe("claiming a licence seat", () => {
    it("settles the seat count after the insert, not before it", () => {
        const source = fs.readFileSync(path.join(ROOT, "module-sources/license-keys/lib/licenses.ts"), "utf8");
        const insert = source.indexOf("licenseActivation.create(");
        const settle = source.indexOf("take: license.maxActivations");
        expect(insert).toBeGreaterThan(-1);
        expect(settle, "the seat count must be settled after the row exists").toBeGreaterThan(insert);
        expect(source).toContain("licenseActivation.delete(");
    });
});
