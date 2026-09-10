/**
 * The one thing an operator pastes, and why it is refused unless it is right.
 *
 * The other chat module this site ships puts its ids into the path of a script
 * URL, so an unchecked one is a script-src injection outright. This provider
 * works the other way round: the script URL is fixed and the site is named by
 * a value the page hands the widget. That looks safer and is only safer while
 * the value stays a value.
 *
 * Two reasons to refuse anything that is not the shape the provider issues.
 *
 * The one that bites today is quiet. An operator pastes what they were given -
 * an email, a dashboard URL, the whole embed snippet - and a value that is not
 * an id makes the widget do nothing at all. No error, no bubble, no way to
 * tell it apart from a provider outage, and the operator finds out when a
 * customer says nobody answered.
 *
 * The one that would bite later is not quiet at all. The obvious way to hand a
 * value to a widget is to write it into an inline script, and the moment
 * somebody does that an unchecked value is arbitrary JavaScript on every page
 * of the site. Refusing here closes that door before it is opened, which is
 * cheaper than remembering not to open it.
 */
import { describe, it, expect } from "vitest";
import { safeWebsiteId, CRISP_SCRIPT } from "@/modules/crisp-chat/lib/embed";

describe("what the provider issues", () => {
    it("takes the identifier it actually hands out", () => {
        expect(safeWebsiteId("8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"))
            .toBe("8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b");
    });

    it("takes one an operator pasted with spaces around it", () => {
        expect(safeWebsiteId("  8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b \n"))
            .toBe("8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b");
    });

    it("reads it whatever case it was written in", () => {
        expect(safeWebsiteId("8E4F1A2B-3C4D-4E5F-8A9B-0C1D2E3F4A5B"))
            .toBe("8E4F1A2B-3C4D-4E5F-8A9B-0C1D2E3F4A5B");
    });
});

describe("what it does not", () => {
    it("refuses nothing at all", () => {
        expect(safeWebsiteId("")).toBeNull();
        expect(safeWebsiteId("   ")).toBeNull();
    });

    it("refuses the things an operator pastes by mistake", () => {
        for (const wrong of [
            "me@example.com",
            "https://app.crisp.chat/website/8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b/",
            "CRISP_WEBSITE_ID=8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
            "8e4f1a2b3c4d4e5f8a9b0c1d2e3f4a5b",
            "8e4f1a2b-3c4d-4e5f-8a9b",
        ]) {
            expect(safeWebsiteId(wrong), wrong).toBeNull();
        }
    });

    it("refuses anything that could end a string or start a statement", () => {
        for (const wrong of [
            '8e4f1a2b";alert(1);//',
            "8e4f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';x=1;'",
            "</script><script>alert(1)</script>",
            "8e4f1a2b\n-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
        ]) {
            expect(safeWebsiteId(wrong), wrong).toBeNull();
        }
    });
});

describe("where the script comes from", () => {
    it("is a fixed address, never one a setting names", () => {
        expect(CRISP_SCRIPT).toBe("https://client.crisp.chat/l.js");
    });

    it("is on the origin the manifest asks the policy to allow", async () => {
        const fs = await import("node:fs");
        const manifest = JSON.parse(
            fs.readFileSync("module-sources/crisp-chat/module.json", "utf8"),
        ) as { csp?: { "script-src"?: string[] } };
        const origin = new URL(CRISP_SCRIPT).origin;
        expect(manifest.csp?.["script-src"] ?? []).toContain(origin);
    });
});
