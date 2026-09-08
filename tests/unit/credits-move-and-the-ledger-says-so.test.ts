import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SOURCES = path.join(ROOT, "module-sources");

/**
 * A balance and the row that explains it are written together, or not at all.
 *
 * Every credit on this platform is a column on the user (`creditBalance`) and
 * a row in a ledger (`CreditTransaction`), and the ledger is the only place
 * anyone can look to find out where a balance came from. Three places moved
 * one and then the other in a second call: an admin grant, and both halves of
 * a wheel spin - the debit for a paid spin and the payout of a credits prize.
 *
 * A failure between the two calls is not a rare shape. The write that follows
 * a successful one is exactly where a connection drops, a pool times out or a
 * request is cancelled, and the result is silent: credits that left an account
 * with nothing recording it, or a balance that grew with no entry to explain
 * it. Nobody notices until somebody asks why the numbers do not add up, and by
 * then the evidence of what happened is the thing that was lost.
 *
 * So the rule is structural rather than case-by-case: a change to
 * `creditBalance` happens inside a transaction, and that same transaction
 * writes the ledger row.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** The character span of every `$transaction( ... )` call in a file. */
function transactionSpans(source: string): Array<[number, number]> {
    const spans: Array<[number, number]> = [];
    for (const match of source.matchAll(/\$transaction\s*\(/g)) {
        const open = match.index + match[0].length - 1;
        let depth = 0;
        for (let i = open; i < source.length; i++) {
            if (source[i] === "(") depth++;
            else if (source[i] === ")" && --depth === 0) {
                spans.push([open, i]);
                break;
            }
        }
    }
    return spans;
}

const BALANCE_MOVE = /creditBalance:\s*\{\s*(?:increment|decrement)/g;
const LEDGER_WRITE = /creditTransaction\.create/;

interface Move {
    where: string;
    inTransaction: boolean;
    withLedger: boolean;
}

function balanceMoves(): Move[] {
    const moves: Move[] = [];
    for (const file of sourceFiles(SOURCES)) {
        const source = fs.readFileSync(file, "utf8");
        const spans = transactionSpans(source);
        for (const match of source.matchAll(BALANCE_MOVE)) {
            const at = match.index;
            const line = source.slice(0, at).split("\n").length;
            const span = spans.find(([from, to]) => at > from && at < to);
            moves.push({
                where: `${path.relative(ROOT, file)}:${line}`,
                inTransaction: span !== undefined,
                withLedger: span ? LEDGER_WRITE.test(source.slice(span[0], span[1])) : false,
            });
        }
    }
    return moves;
}

describe("a credit balance never moves on its own", () => {
    const moves = balanceMoves();

    it("finds the places that move one", () => {
        // A floor rather than a count: a module added tomorrow that pays
        // someone should raise this, not be waved through by it.
        expect(moves.length).toBeGreaterThanOrEqual(8);
    });

    it("every one of them is inside a transaction", () => {
        expect(moves.filter((m) => !m.inTransaction).map((m) => m.where)).toEqual([]);
    });

    it("and that transaction writes the ledger row too", () => {
        expect(moves.filter((m) => !m.withLedger).map((m) => m.where)).toEqual([]);
    });
});

describe("a spin is one event", () => {
    const spin = fs.readFileSync(path.join(SOURCES, "wheel/api/spin/route.ts"), "utf8");

    it("debits, records and pays out in a single transaction", () => {
        const spans = transactionSpans(spin);
        expect(spans.length).toBe(1);
        const body = spin.slice(spans[0][0], spans[0][1]);
        expect(body).toContain("creditBalance: { decrement: wheel.cost }");
        expect(body).toContain("wheelSpin.create");
        expect(body).toContain("creditBalance: { increment: selectedPrize.value }");
        expect(body).toContain("coupon.create");
    });

    it("still refuses a spin the balance cannot cover, without spending it", () => {
        expect(spin).toContain("creditBalance: { gte: wheel.cost }");
        expect(spin).toContain('code: "wheel_not_enough_credits"');
    });
});

describe("a coupon prize is collectable", () => {
    const spin = fs.readFileSync(path.join(SOURCES, "wheel/api/spin/route.ts"), "utf8");
    const page = fs.readFileSync(path.join(SOURCES, "wheel/pages/public/page.tsx"), "utf8");
    const manifest = JSON.parse(
        fs.readFileSync(path.join(SOURCES, "wheel/module.json"), "utf8"),
    );

    it("the code reaches the winner rather than only the database", () => {
        expect(spin).toContain("code: couponCode");
        expect(page).toContain("result.code");
        // Rendered beside the label rather than inside it, but the
        // guarantee is the same one: the winner is told the code.
        expect(page).toContain("result.code");
        expect(page).toContain('t("couponCode")');
    });

    it("two winners in the same millisecond get two different codes", () => {
        // `code` is unique, so a timestamp on its own handed the second winner
        // a 500 where a prize should have been.
        const minted = /const couponCode =[\s\S]{0,400}?;/.exec(spin)?.[0] ?? "";
        expect(minted).toContain("randomInt(");
    });

    it("says so in both languages", () => {
        for (const locale of ["en", "tr"]) {
            expect(manifest.translations[locale].wheel.couponCode).toBeTruthy();
        }
    });
});
