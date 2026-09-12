/**
 * What this module tells an operator it has done.
 *
 * It creates a sales invoice in the accounting service and then wrote
 * `issued` against the order. An operator installed it because they are
 * obliged to issue invoices, and `issued` is the word that says the
 * obligation is met.
 *
 * It was not what happened. Turning that record into a legal e-document is a
 * second call, and the module did not make it: the provider's documentation
 * was not reachable when this was built, and guessing the shape of a call
 * that puts a document in somebody's tax filing is not something to do from
 * memory.
 *
 * It makes the call now, and the two fields still say two different things,
 * which is the part worth keeping. `status` is what this module did with the
 * sale. `legalDocument` is what the tax authority did with the document, and
 * only `approved` means the obligation is met - a document that was refused,
 * or that nobody asked for, is a task rather than a finished sale. Collapsing
 * the two into one reassuring word is what hid the gap in the first place.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    INVOICE_STATUSES,
    LEGAL_STATES,
    needsAttention,
    operatorSummary,
} from "@/modules/parasut-invoicing/lib/invoice-state";

const ROOT = process.cwd();
const MODULE = path.join(ROOT, "module-sources/parasut-invoicing");

describe("the states this module can write", () => {
    it("has no word among them that means a legal document exists", () => {
        expect([...INVOICE_STATUSES]).toEqual(["pending", "recorded", "failed"]);
        expect(INVOICE_STATUSES).not.toContain("issued");
    });

    it("has a state for every answer the authority can give", () => {
        expect([...LEGAL_STATES]).toEqual([
            "not_requested",
            "submitted",
            "waiting",
            "approved",
            "refused",
            "failed",
        ]);
    });
});

describe("what an operator is shown", () => {
    it("says a recorded sale is in the accounting service and no further", () => {
        const said = operatorSummary({ status: "recorded", legalDocument: "not_requested" });
        expect(said.recorded).toBe(true);
        expect(said.legallyIssued).toBe(false);
    });

    it("says a document is issued only when the authority approved it", () => {
        for (const status of INVOICE_STATUSES) {
            for (const legalDocument of LEGAL_STATES) {
                expect(operatorSummary({ status, legalDocument }).legallyIssued).toBe(
                    legalDocument === "approved",
                );
            }
        }
    });

    it("wants attention for a sale it could not record", () => {
        expect(needsAttention({ status: "failed", legalDocument: "not_requested" })).toBe(true);
    });

    it("wants attention for one that recorded and never asked for a document", () => {
        // This is the row that used to read `issued` and look finished.
        expect(needsAttention({ status: "recorded", legalDocument: "not_requested" })).toBe(true);
    });

    it("wants attention for a document the authority refused", () => {
        expect(needsAttention({ status: "recorded", legalDocument: "refused" })).toBe(true);
        expect(needsAttention({ status: "recorded", legalDocument: "failed" })).toBe(true);
    });

    it("wants nothing for one the authority is still thinking about, or approved", () => {
        // Nobody can do anything about a document in a queue, and an approved
        // one is the whole obligation met.
        expect(needsAttention({ status: "recorded", legalDocument: "waiting" })).toBe(false);
        expect(needsAttention({ status: "recorded", legalDocument: "submitted" })).toBe(false);
        expect(needsAttention({ status: "recorded", legalDocument: "approved" })).toBe(false);
    });

    it("wants nothing for one still in flight", () => {
        expect(needsAttention({ status: "pending", legalDocument: "not_requested" })).toBe(false);
    });
});

describe("the word is gone from the module, not just from this file", () => {
    const sources = (dir: string, out: string[] = []): string[] => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) sources(full, out);
            else if (/\.tsx?$/.test(entry.name)) out.push(full);
        }
        return out;
    };

    it("writes no status of that name anywhere", () => {
        const offenders: string[] = [];
        for (const file of sources(MODULE)) {
            const source = fs.readFileSync(file, "utf8");
            // `status: "issued"` and `status === "issued"` alike. The column
            // `issuedAt` is a timestamp and says nothing about a document.
            if (/status\s*[:=]=?\s*"issued"/.test(source)) {
                offenders.push(path.relative(ROOT, file));
            }
        }
        expect(offenders).toEqual([]);
    });

    it("ships the migration that moves the rows already written", () => {
        const migrations = path.join(MODULE, "migrations");
        expect(fs.existsSync(migrations)).toBe(true);
        const files = fs.readdirSync(migrations).filter((name) => name.endsWith(".sql"));
        expect(files.length).toBeGreaterThan(0);
        const text = files.map((name) => fs.readFileSync(path.join(migrations, name), "utf8")).join("\n");
        expect(text).toContain("recorded");
    });
});
