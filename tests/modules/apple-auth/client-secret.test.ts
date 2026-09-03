// @vitest-environment node
/**
 * Apple takes a token the site signs for itself instead of a client secret.
 * Signing it wrong fails at the token exchange with an error that says
 * nothing useful, so the shape is pinned down here: the header Apple requires,
 * the five claims it checks, a lifetime it will not reject, and a signature
 * the key actually verifies.
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
    mintClientSecret,
    normalisePrivateKey,
    MAX_LIFETIME_SECONDS,
} from "@/modules/apple-auth/lib/client-secret";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const input = {
    clientId: "com.example.web",
    teamId: "TEAM123456",
    keyId: "KEY1234567",
    privateKey: pem,
    now: 1_700_000_000,
};

function decode(token: string) {
    const [header, payload] = token.split(".");
    return {
        header: JSON.parse(Buffer.from(header, "base64url").toString()),
        payload: JSON.parse(Buffer.from(payload, "base64url").toString()),
    };
}

describe("mintClientSecret", () => {
    it("names the key in the header and signs with ES256", () => {
        expect(decode(mintClientSecret(input)).header).toEqual({
            alg: "ES256",
            kid: "KEY1234567",
            typ: "JWT",
        });
    });

    it("claims what Apple checks", () => {
        expect(decode(mintClientSecret(input)).payload).toEqual({
            iss: "TEAM123456",
            sub: "com.example.web",
            aud: "https://appleid.apple.com",
            iat: 1_700_000_000,
            exp: 1_700_000_000 + MAX_LIFETIME_SECONDS,
        });
    });

    // Apple rejects a token that outlives six months outright.
    it("never asks for more life than Apple allows", () => {
        const { payload } = decode(mintClientSecret({ ...input, lifetimeSeconds: 999_999_999 }));
        expect(payload.exp - payload.iat).toBe(MAX_LIFETIME_SECONDS);
    });

    it("produces a signature the key verifies, in JOSE encoding", () => {
        const token = mintClientSecret(input);
        const [header, payload, signature] = token.split(".");
        const raw = Buffer.from(signature, "base64url");
        // 64 bytes: r||s, not the DER wrapper OpenSSL defaults to.
        expect(raw).toHaveLength(64);
        expect(
            crypto.verify("sha256", Buffer.from(`${header}.${payload}`), {
                key: publicKey,
                dsaEncoding: "ieee-p1363",
            }, raw),
        ).toBe(true);
    });

    it("accepts a key pasted with escaped newlines", () => {
        const escaped = pem.replace(/\n/g, "\\n");
        expect(() => mintClientSecret({ ...input, privateKey: escaped })).not.toThrow();
    });

    it("accepts a key that arrived wrapped in quotes", () => {
        expect(() => mintClientSecret({ ...input, privateKey: `"${pem}"` })).not.toThrow();
    });
});

describe("normalisePrivateKey", () => {
    it("turns an escaped one-liner back into PEM", () => {
        const key = normalisePrivateKey("-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----");
        expect(key.split("\n")).toEqual([
            "-----BEGIN PRIVATE KEY-----",
            "abc",
            "-----END PRIVATE KEY-----",
        ]);
    });
});
