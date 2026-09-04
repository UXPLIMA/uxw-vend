import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * A one-shot item has to be claimed with one conditional write.
 *
 * The chest route read the row, saw `isRedeemed: false`, ran the RCON
 * delivery, and only then marked the row redeemed. Two requests that arrived
 * together both passed the read and both delivered: the player received the
 * item twice, for free. The gift-code route beside it has always claimed with
 * `updateMany({ where: { id, isRedeemed: false } })` and checked the count,
 * which is the shape that cannot be raced.
 */
const STORE = path.join(ROOT, "module-sources/store/api");

/** Files that flip a redemption flag, whatever they call the model. */
function redeemingRoutes(): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name === "route.ts" && /isRedeemed:\s*true/.test(fs.readFileSync(full, "utf8"))) {
                out.push(full);
            }
        }
    };
    walk(STORE);
    return out;
}

describe("one-shot redemption", () => {
    it("finds the routes that redeem something", () => {
        const routes = redeemingRoutes().map((f) => path.relative(ROOT, f));
        expect(routes).toContain("module-sources/store/api/chest/[id]/route.ts");
        expect(routes).toContain("module-sources/store/api/gift-codes/redeem/route.ts");
    });

    it("every one of them claims with a conditional write and checks it landed", () => {
        for (const file of redeemingRoutes()) {
            const source = fs.readFileSync(file, "utf8");
            const where = path.relative(ROOT, file);
            // The claim: an updateMany guarded on the row still being unredeemed.
            expect(source, `${where} must claim with updateMany`).toMatch(/updateMany\(/);
            expect(source, `${where} must guard the claim on isRedeemed: false`)
                .toMatch(/isRedeemed:\s*false/);
            // And it has to look at whether the claim won.
            expect(source, `${where} must check the claim landed`).toMatch(/\.count === 0/);
        }
    });

    it("the chest claims the item before it delivers it", () => {
        const source = fs.readFileSync(path.join(STORE, "chest/[id]/route.ts"), "utf8");
        const claim = source.indexOf("isRedeemed: true, redeemedAt");
        const deliver = source.indexOf("await deliverProduct(");
        expect(claim).toBeGreaterThan(-1);
        expect(deliver).toBeGreaterThan(-1);
        expect(claim, "the claim must come before the delivery").toBeLessThan(deliver);
    });
});
