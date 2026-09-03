import { describe, it, expect } from "vitest";
import { hostnameMatchesAllowlist } from "@/core/lib/url-safety";

/**
 * This function is the SSRF allowlist behind outgoing webhooks
 * (see webhook-channels.ts). Everything below is a bypass someone has actually
 * shipped against a naive `endsWith` check, so each case is a regression guard
 * rather than a restatement of the implementation.
 */
describe("hostnameMatchesAllowlist", () => {
    const allowed = ["discord.com", "hooks.slack.com"];

    it("accepts an exact match", () => {
        expect(hostnameMatchesAllowlist("discord.com", allowed)).toBe(true);
        expect(hostnameMatchesAllowlist("hooks.slack.com", allowed)).toBe(true);
    });

    it("accepts a true subdomain", () => {
        expect(hostnameMatchesAllowlist("canary.discord.com", allowed)).toBe(true);
        expect(hostnameMatchesAllowlist("a.b.c.discord.com", allowed)).toBe(true);
    });

    // The bypass the whole function exists to prevent: `endsWith("discord.com")`
    // is true for both of these.
    it("rejects a domain that merely ends with an allowed one", () => {
        expect(hostnameMatchesAllowlist("evildiscord.com", allowed)).toBe(false);
        expect(hostnameMatchesAllowlist("notdiscord.com", allowed)).toBe(false);
    });

    it("rejects an allowed domain used as a prefix of an attacker domain", () => {
        expect(hostnameMatchesAllowlist("discord.com.attacker.test", allowed)).toBe(false);
        expect(hostnameMatchesAllowlist("hooks.slack.com.evil.test", allowed)).toBe(false);
    });

    it("rejects a parent of an allowed domain", () => {
        // "slack.com" must not pass just because "hooks.slack.com" is allowed.
        expect(hostnameMatchesAllowlist("slack.com", allowed)).toBe(false);
        expect(hostnameMatchesAllowlist("com", allowed)).toBe(false);
    });

    it("is case-insensitive on both sides", () => {
        expect(hostnameMatchesAllowlist("DISCORD.COM", allowed)).toBe(true);
        expect(hostnameMatchesAllowlist("Canary.Discord.Com", allowed)).toBe(true);
        expect(hostnameMatchesAllowlist("discord.com", ["DISCORD.COM"])).toBe(true);
    });

    // A trailing dot is the fully-qualified form: "discord.com." resolves to the
    // same host, so rejecting it would be a false negative - and accepting it
    // without normalising would make "discord.com." miss an exact-match check.
    it("normalises a trailing root dot", () => {
        expect(hostnameMatchesAllowlist("discord.com.", allowed)).toBe(true);
        expect(hostnameMatchesAllowlist("canary.discord.com.", allowed)).toBe(true);
    });

    it("rejects everything when the allowlist is empty", () => {
        expect(hostnameMatchesAllowlist("discord.com", [])).toBe(false);
    });

    it("does not treat a leading dot in the hostname as a subdomain boundary", () => {
        expect(hostnameMatchesAllowlist(".discord.com", allowed)).toBe(true);
        expect(hostnameMatchesAllowlist("..discord.com", allowed)).toBe(true);
        // ...but an empty label before an unrelated domain is still not a match.
        expect(hostnameMatchesAllowlist(".evil.test", allowed)).toBe(false);
    });
});
