import { describe, it, expect } from "vitest";
import { identifierLookup } from "@/core/lib/login-identifier";

describe("identifierLookup", () => {
    it("treats a value containing @ as an email", () => {
        expect(identifierLookup("admin@example.com")).toEqual({ email: "admin@example.com" });
    });

    it("treats a value without @ as a username", () => {
        expect(identifierLookup("siracozmen")).toEqual({ username: "siracozmen" });
    });

    it("trims whitespace browsers and password managers leave behind", () => {
        expect(identifierLookup("  admin@example.com  ")).toEqual({ email: "admin@example.com" });
        expect(identifierLookup("\tsiracozmen\n")).toEqual({ username: "siracozmen" });
    });

    it("keeps case, because both columns are matched exactly", () => {
        expect(identifierLookup("Admin@Example.com")).toEqual({ email: "Admin@Example.com" });
        expect(identifierLookup("SiracOzmen")).toEqual({ username: "SiracOzmen" });
    });

    it("rejects anything that cannot identify an account", () => {
        expect(identifierLookup("")).toBeNull();
        expect(identifierLookup("   ")).toBeNull();
        expect(identifierLookup(undefined)).toBeNull();
        expect(identifierLookup(null)).toBeNull();
        expect(identifierLookup(42)).toBeNull();
        expect(identifierLookup({ email: "x@y.z" })).toBeNull();
    });

    it("accepts usernames made of the characters registration allows", () => {
        expect(identifierLookup("a_b-c9")).toEqual({ username: "a_b-c9" });
    });
});
