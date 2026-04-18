import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import { validateZipEntries } from "@/core/lib/module-zip-validator";

function makeZip(files: Array<{ name: string; content: string | Buffer; symlink?: boolean }>): AdmZip.IZipEntry[] {
    const zip = new AdmZip();
    for (const f of files) {
        const buf = typeof f.content === "string" ? Buffer.from(f.content) : f.content;
        zip.addFile(f.name, buf);
        if (f.symlink) {
            const entries = zip.getEntries();
            const entry = entries[entries.length - 1];
            // Set external file attributes to symlink (0o120000) shifted to upper 16 bits
            entry.attr = (0o120000 << 16) >>> 0;
        }
    }
    return zip.getEntries();
}

describe("validateZipEntries", () => {
    it("accepts a clean manifest archive", () => {
        const entries = makeZip([
            { name: "module.json", content: "{}" },
            { name: "pages/page.tsx", content: "export default () => null;" },
        ]);
        expect(validateZipEntries(entries).ok).toBe(true);
    });

    it("rejects empty archive", () => {
        const result = validateZipEntries([]);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/empty/i);
    });

    it("rejects path traversal entries", () => {
        const zip = new AdmZip();
        zip.addFile("placeholder.ts", Buffer.from(""));
        const entries = zip.getEntries();
        // adm-zip normalizes ".." when adding; force it post-hoc to cover the
        // defensive branch in our validator.
        entries[0].entryName = "../evil.ts";
        const result = validateZipEntries(entries);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/traversal/i);
    });

    it("rejects absolute paths", () => {
        const zip = new AdmZip();
        zip.addFile("placeholder.ts", Buffer.from(""));
        const entries = zip.getEntries();
        entries[0].entryName = "/etc/passwd";
        const result = validateZipEntries(entries);
        expect(result.ok).toBe(false);
    });

    it("rejects dotenv files", () => {
        const entries = makeZip([
            { name: "module.json", content: "{}" },
            { name: ".env", content: "SECRET=x" },
        ]);
        const result = validateZipEntries(entries);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/forbidden/i);
    });

    it("rejects disallowed file types", () => {
        const entries = makeZip([
            { name: "module.json", content: "{}" },
            { name: "evil.sh", content: "#!/bin/sh\nrm -rf /" },
        ]);
        const result = validateZipEntries(entries);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/disallowed/i);
    });

    it("rejects node_modules directories", () => {
        const entries = makeZip([
            { name: "module.json", content: "{}" },
            { name: "node_modules/foo/index.js", content: "" },
        ]);
        const result = validateZipEntries(entries);
        expect(result.ok).toBe(false);
    });

    it("rejects symlink entries", () => {
        const entries = makeZip([
            { name: "module.json", content: "{}" },
            { name: "link.ts", content: "../../etc/passwd", symlink: true },
        ]);
        const result = validateZipEntries(entries);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/symlink/i);
    });

    it("allows common asset types", () => {
        const entries = makeZip([
            { name: "module.json", content: "{}" },
            { name: "icon.svg", content: "<svg/>" },
            { name: "image.png", content: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
            { name: "styles.css", content: "body {}" },
        ]);
        expect(validateZipEntries(entries).ok).toBe(true);
    });
});
