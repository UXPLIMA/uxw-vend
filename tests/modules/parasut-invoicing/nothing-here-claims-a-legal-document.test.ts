/**
 * What this module tells an operator it has done.
 *
 * It creates a sales invoice in the accounting service and then wrote
 * `issued` against the order. An operator installed it because they are
 * obliged to issue invoices, and `issued` is the word that says the
 * obligation is met.
 *
 * It is not what happened. Turning that record into a legal e-document is a
 * second call the module does not make - the provider's documentation was not
 * reachable when this was built, and guessing the shape of a call that puts a
 * document in somebody's tax filing is not something to do from memory. So
 * the call is still missing, and that is a known gap.
 *
 * A known gap an operator can see is a task. A known gap dressed up as
 * `issued` is a shop that believes its invoicing is done, finds out at an
 * audit, and cannot tell which orders were affected because every row says
 * the same reassuring word.
 *
 * So nothing here claims a legal document. The row says what was actually
 * done - a sales invoice exists in the service - and says separately that the
 * e-document step has not been taken. When the second call lands, the second
 * field starts moving and nothing else has to change.
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

    it("says the e-document step has not been taken, because it has not", () => {
        expect([...LEGAL_STATES]).toEqual(["not_requested"]);
    });
});

describe("what an operator is shown", () => {
    it("says a recorded sale is in the accounting service and no further", () => {
        const said = operatorSummary({ status: "recorded", legalDocument: "not_requested" });
        expect(said.recorded).toBe(true);
        expect(said.legallyIssued).toBe(false);
    });

    it("never says a document was legally issued, whatever the row holds", () => {
        for (const status of INVOICE_STATUSES) {
            for (const legalDocument of LEGAL_STATES) {
                expect(operatorSummary({ status, legalDocument }).legallyIssued).toBe(false);
            }
        }
    });

    it("wants attention for a sale it could not record", () => {
        expect(needsAttention({ status: "failed", legalDocument: "not_requested" })).toBe(true);
    });

    it("wants attention for one that recorded, because the document is still owed", () => {
        // This is the row that used to read `issued` and look finished.
        expect(needsAttention({ status: "recorded", legalDocument: "not_requested" })).toBe(true);
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
