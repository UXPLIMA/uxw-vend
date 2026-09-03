/**
 * Invariants across every payment gateway in the catalog.
 *
 * A gateway is only reachable if three things agree: the id it announces in
 * `payment.providers`, the id it answers to in `payment.session`, and the
 * `paymentMethod` the checkout posts. Nothing at runtime notices when they
 * drift - the button simply does nothing, or worse, two gateways claim one id
 * and the store's dedupe silently drops one of them.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SOURCES = path.join(process.cwd(), "module-sources");

interface Gateway {
    id: string;
    manifest: {
        dependencies?: string[];
        hookListeners?: { hook: string; type: string; handler: string }[];
        hooksEmitted?: { hook: string; type: string }[];
    };
    providersSource: string;
    sessionSource: string;
}

function loadGateways(): Gateway[] {
    const gateways: Gateway[] = [];
    for (const id of fs.readdirSync(SOURCES)) {
        const manifestPath = path.join(SOURCES, id, "module.json");
        if (!fs.existsSync(manifestPath)) continue;
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Gateway["manifest"];
        const listeners = manifest.hookListeners ?? [];
        const providers = listeners.find((l) => l.hook === "payment.providers");
        if (!providers) continue;
        const session = listeners.find((l) => l.hook === "payment.session");
        gateways.push({
            id,
            manifest,
            providersSource: fs.readFileSync(path.join(SOURCES, id, providers.handler), "utf8"),
            sessionSource: session ? fs.readFileSync(path.join(SOURCES, id, session.handler), "utf8") : "",
        });
    }
    return gateways;
}

/** The provider ids a gateway adds to the list. */
function announcedIds(source: string): string[] {
    return Array.from(source.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)).map((match) => match[1]);
}

/** The ids a session handler answers to: `request.provider !== "x"`. */
function answeredIds(source: string): string[] {
    return Array.from(source.matchAll(/request\.provider\s*!==\s*"([a-z0-9-]+)"/g)).map((match) => match[1]);
}

const gateways = loadGateways();

describe("the payment gateway catalog", () => {
    it("has gateways to check", () => {
        // A guard on the test itself: a broken loader would otherwise make
        // every assertion below pass by iterating nothing.
        expect(gateways.length).toBeGreaterThanOrEqual(10);
    });

    it("gives every provider id to exactly one gateway", () => {
        const owners = new Map<string, string[]>();
        for (const gateway of gateways) {
            for (const id of announcedIds(gateway.providersSource)) {
                owners.set(id, [...(owners.get(id) ?? []), gateway.id]);
            }
        }
        const shared = Array.from(owners.entries()).filter(([, list]) => list.length > 1);
        // The store keeps the first answer and drops the rest, so a shared id
        // makes one gateway unreachable rather than failing loudly.
        expect(shared).toEqual([]);
    });

    it.each(gateways.map((g) => [g.id, g] as const))("%s answers to the id it announces", (_id, gateway) => {
        const announced = announcedIds(gateway.providersSource);
        expect(announced.length).toBeGreaterThan(0);
        for (const id of announced) {
            expect(answeredIds(gateway.sessionSource)).toContain(id);
        }
    });

    it.each(gateways.map((g) => [g.id, g] as const))("%s listens for a session to start", (_id, gateway) => {
        const hooks = (gateway.manifest.hookListeners ?? []).map((l) => l.hook);
        // Announcing a button and not answering the call behind it is the one
        // failure a buyer meets after they have already chosen how to pay.
        expect(hooks).toContain("payment.session");
    });

    it.each(gateways.map((g) => [g.id, g] as const))("%s depends on the store that publishes the contract", (_id, gateway) => {
        const deps = (gateway.manifest.dependencies ?? []).map((d) => d.split("@")[0]);
        expect(deps).toContain("store");
    });

    it.each(gateways.map((g) => [g.id, g] as const))("%s reports money it takes", (_id, gateway) => {
        const emitted = (gateway.manifest.hooksEmitted ?? []).map((h) => h.hook);
        // A gateway that never fires payment.settled can take money and never
        // tell the store, which is an order that stays pending forever.
        expect(emitted).toContain("payment.settled");
    });
});
