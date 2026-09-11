/**
 * Where an operator's payment and integration credentials live.
 *
 * Every gateway and every integration is configured the same way: an admin
 * pastes a key into a settings form, the form PATCHes `/api/v1/settings`, and
 * the value lands in the `Setting` table. It landed there in the clear. A
 * PayTR merchant salt, a Stripe secret key, a PayPal client secret, an iyzico
 * secret key and eleven more sat in a JSON column as the operator typed them.
 *
 * That is three separate exposures, not one. Anything that can read a row can
 * take payments as the operator: a SQL injection anywhere in the app, a
 * database backup on a laptop, a support engineer with read access, a restored
 * dump on a staging box. `GET /api/v1/settings` then handed the same values
 * back to the browser on every settings screen, so they were in a JSON
 * response and in a DOM node too - a password input hides a value from a
 * shoulder, not from an extension. And because the form posts back everything
 * it loaded, the plaintext made a second trip on every save.
 *
 * The encryption itself already existed - `secret-storage.ts`, AES-256-GCM,
 * version tagged - and exactly one caller used it. What was missing was a
 * boundary: somewhere that knows which keys are credentials, so that sealing
 * them is not fifteen modules each remembering to.
 *
 * Core cannot hold that list. Naming `paytr_merchant_key` in core is core
 * naming a module, which is the one thing core may never do. So a module
 * declares its own credentials in its manifest and core reads the aggregate,
 * the same way it already reads settings declarations and CSP origins.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
    sealValue,
    openValue,
    settingsForStorage,
    settingsFromStorage,
    withoutSecrets,
} from "@/core/lib/secret-settings";
import { isEncrypted } from "@/core/lib/secret-storage";

// A fixed key so the ciphertext in this file is reproducible, and so the test
// never depends on whichever fallback the dev key derivation picks.
beforeAll(() => {
    process.env.SECRET_ENCRYPTION_KEY = "a".repeat(64);
});

const DECLARED = new Set(["gateway_secret_key", "gateway_webhook_secret"]);

describe("sealing one value", () => {
    it("turns a credential into something the database cannot read", () => {
        const sealed = sealValue("sk_live_1234567890");
        expect(sealed).not.toBe("sk_live_1234567890");
        expect(String(sealed)).not.toContain("sk_live");
        expect(isEncrypted(String(sealed))).toBe(true);
    });

    it("gives the same credential a different ciphertext every time", () => {
        // A repeated ciphertext tells a reader of the column that two
        // installs, or two keys, are the same value without decrypting either.
        expect(sealValue("same")).not.toBe(sealValue("same"));
    });

    it("comes back exactly as it went in", () => {
        for (const secret of ["sk_live_1", "", "  padded  ", "ünïcode-ş", "a".repeat(4000)]) {
            expect(openValue(sealValue(secret))).toBe(secret);
        }
    });

    it("refuses a value that is not a string, because a credential is one", () => {
        // Setting.value is a JSON column, so a caller can put anything in it.
        // Sealing a number would store a ciphertext that reads back as a
        // string and silently change the type a module receives.
        for (const wrong of [12, true, null, undefined, { a: 1 }, ["x"]]) {
            expect(() => sealValue(wrong as unknown as string)).toThrow();
        }
    });
});

describe("opening one value", () => {
    it("returns a row written before any of this existed", () => {
        // Every install that already has credentials has them in the clear.
        // Refusing those would take every configured gateway offline on
        // deploy, which is a worse outage than the exposure being fixed.
        expect(openValue("sk_live_legacy_plaintext")).toBe("sk_live_legacy_plaintext");
    });

    it("passes a non-string through untouched", () => {
        expect(openValue(null)).toBe(null);
        expect(openValue(42)).toBe(42);
    });
});

describe("a settings map on its way into the database", () => {
    it("seals every declared credential and leaves everything else alone", () => {
        const stored = settingsForStorage(
            {
                gateway_merchant_id: "123456",
                gateway_secret_key: "sk_live_abc",
                gateway_webhook_secret: "whsec_abc",
                site_name: "Blysis",
            },
            DECLARED,
        );

        expect(stored.gateway_merchant_id).toBe("123456");
        expect(stored.site_name).toBe("Blysis");
        expect(isEncrypted(String(stored.gateway_secret_key))).toBe(true);
        expect(isEncrypted(String(stored.gateway_webhook_secret))).toBe(true);
    });

    it("stores an emptied credential as empty rather than as encrypted nothing", () => {
        // Clearing is how an operator removes a gateway's keys. An empty
        // string sealed would read back as a configured credential of zero
        // length, and the module would try to sign with it.
        const stored = settingsForStorage({ gateway_secret_key: "" }, DECLARED);
        expect(stored.gateway_secret_key).toBe("");
    });

    it("does not seal a value that is already sealed", () => {
        const once = settingsForStorage({ gateway_secret_key: "sk" }, DECLARED);
        const twice = settingsForStorage(once, DECLARED);
        expect(twice.gateway_secret_key).toBe(once.gateway_secret_key);
        expect(openValue(twice.gateway_secret_key)).toBe("sk");
    });
});

describe("a settings map on its way out of the database", () => {
    it("gives a module back what the operator typed", () => {
        const stored = settingsForStorage(
            { gateway_secret_key: "sk_live_abc", gateway_merchant_id: "123456" },
            DECLARED,
        );
        expect(settingsFromStorage(stored, DECLARED)).toEqual({
            gateway_secret_key: "sk_live_abc",
            gateway_merchant_id: "123456",
        });
    });

    it("reads a legacy row and an encrypted row from the same map", () => {
        const mixed = {
            gateway_secret_key: sealValue("new"),
            gateway_webhook_secret: "old_plaintext",
        };
        expect(settingsFromStorage(mixed, DECLARED)).toEqual({
            gateway_secret_key: "new",
            gateway_webhook_secret: "old_plaintext",
        });
    });

    it("reports rather than throws when a value will not decrypt", () => {
        // A rotated SECRET_ENCRYPTION_KEY makes every stored credential
        // undecryptable. A module must see "not configured" and refuse the
        // payment, not take the checkout page down with an exception.
        const corrupt = { gateway_secret_key: "v1:00:00:00" };
        expect(settingsFromStorage(corrupt, DECLARED)).toEqual({ gateway_secret_key: null });
    });
});

describe("a settings map on its way to a browser", () => {
    it("carries no credential at all", () => {
        const { settings } = withoutSecrets(
            {
                gateway_merchant_id: "123456",
                gateway_secret_key: sealValue("sk_live_abc"),
                site_name: "Blysis",
            },
            DECLARED,
        );
        expect(settings).toEqual({ gateway_merchant_id: "123456", site_name: "Blysis" });
        expect(JSON.stringify(settings)).not.toContain("sk_live");
        expect(JSON.stringify(settings)).not.toContain("v1:");
    });

    it("says which credentials are set, so a screen can show it", () => {
        const { secretsConfigured } = withoutSecrets(
            {
                gateway_secret_key: sealValue("sk_live_abc"),
                gateway_webhook_secret: "",
            },
            DECLARED,
        );
        expect(secretsConfigured).toEqual(["gateway_secret_key"]);
    });

    it("counts a credential nobody has stored as not configured", () => {
        const { secretsConfigured } = withoutSecrets({ site_name: "Blysis" }, DECLARED);
        expect(secretsConfigured).toEqual([]);
    });
});

/**
 * An install with nowhere safe to put a credential says so.
 *
 * `SECRET_ENCRYPTION_KEY` was documented as "production recommended" back when
 * one module used it for one RCON password. Every gateway on the site depends
 * on it now, so an operator who upgrades without setting it cannot save a
 * payment key at all - and the way they find out must not be a blank 500 under
 * a form that says "could not save", because the fix is one environment
 * variable and nothing on the screen would ever mention it.
 *
 * Reading is the other half and behaves the opposite way on purpose: a row
 * written before any of this is plaintext and needs no key, so an install that
 * has not set one keeps serving its existing configuration rather than losing
 * every gateway the moment this ships.
 */
describe("an install with no encryption key", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    async function freshBoundary() {
        vi.resetModules();
        return import("@/core/lib/secret-settings");
    }

    it("refuses to store a credential, and names the variable that is missing", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("SECRET_ENCRYPTION_KEY", "");
        const { settingsForStorage } = await freshBoundary();
        expect(() => settingsForStorage({ gateway_secret_key: "sk_live" }, DECLARED))
            .toThrow(/SECRET_ENCRYPTION_KEY/);
    });

    it("still reads a row written before any of this existed", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("SECRET_ENCRYPTION_KEY", "");
        const { settingsFromStorage } = await freshBoundary();
        expect(settingsFromStorage({ gateway_secret_key: "sk_live_legacy" }, DECLARED))
            .toEqual({ gateway_secret_key: "sk_live_legacy" });
    });

    it("still keeps a credential out of a response", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("SECRET_ENCRYPTION_KEY", "");
        const { withoutSecrets } = await freshBoundary();
        const { settings, secretsConfigured } = withoutSecrets(
            { gateway_secret_key: "sk_live_legacy", site_name: "Blysis" },
            DECLARED,
        );
        expect(settings).toEqual({ site_name: "Blysis" });
        expect(secretsConfigured).toEqual(["gateway_secret_key"]);
    });
});
