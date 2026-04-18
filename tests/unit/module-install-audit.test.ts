import { describe, it, expect } from "vitest";
import { manifestHash } from "@/core/lib/module-install-audit";

describe("manifestHash", () => {
    it("returns a stable 64-char hex digest", () => {
        const h = manifestHash({ id: "m", name: "M", version: "1.0.0" });
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is insensitive to key order", () => {
        const a = manifestHash({ id: "m", name: "M", version: "1.0.0" });
        const b = manifestHash({ version: "1.0.0", id: "m", name: "M" });
        expect(a).toBe(b);
    });

    it("changes when a value changes", () => {
        const a = manifestHash({ id: "m", name: "M", version: "1.0.0" });
        const b = manifestHash({ id: "m", name: "M", version: "1.0.1" });
        expect(a).not.toBe(b);
    });

    it("recurses into nested arrays and objects deterministically", () => {
        const a = manifestHash({
            id: "m",
            api: [{ path: "/a", handler: "x" }, { path: "/b", handler: "y" }],
        });
        const b = manifestHash({
            api: [{ handler: "x", path: "/a" }, { handler: "y", path: "/b" }],
            id: "m",
        });
        expect(a).toBe(b);
    });

    it("treats arrays as ordered (different order → different hash)", () => {
        const a = manifestHash({ api: [{ path: "/a" }, { path: "/b" }] });
        const b = manifestHash({ api: [{ path: "/b" }, { path: "/a" }] });
        expect(a).not.toBe(b);
    });
});
