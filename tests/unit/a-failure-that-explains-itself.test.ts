import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The step that explains a failure can run when the failure happens.
 *
 * The Docker job ends with `Dump logs on failure` and `Tear down`, and both
 * call `docker compose`, which cannot start without the `.env` the job writes
 * for the stack. That file was written after buildx and after the image build,
 * so a failure in either left both steps erroring on
 *
 *     required variable POSTGRES_PASSWORD is missing a value
 *
 * instead of saying anything about what actually went wrong. It happened on
 * 2026-09-07: the real failure was a 500 from the daemon while buildx pulled
 * its image, and the run reported the missing password twice and the daemon
 * error once, in that order.
 *
 * Writing the file first costs nothing - it depends on nothing but the
 * checkout - and it is the difference between a run that explains itself and
 * one that has to be read backwards.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW = ".github/workflows/build-and-test.yml";

/**
 * Comments, gone, before anything is matched. A step's prose lives in the
 * block above it and belongs to the previous step as far as a split on `- ` is
 * concerned - so the comment written to explain this very gate made the gate
 * accuse `actions/checkout` of running `docker compose`. Third time this shape
 * has caught me out.
 */
function withoutComments(source: string): string {
    return source.replace(/^\s*#.*$/gm, "");
}

/** The job's steps, in order, as `name` (or `uses`) plus the shell it runs. */
function dockerJobSteps(): { label: string; body: string }[] {
    const source = withoutComments(fs.readFileSync(path.join(ROOT, WORKFLOW), "utf8"));
    const start = source.indexOf("Docker image + module lifecycle smoke test");
    expect(start, "the Docker job should still be there").toBeGreaterThan(-1);
    const rest = source.slice(start);
    const nextJob = rest.search(/^ {2}[a-z][\w-]*:$/m);
    const job = nextJob === -1 ? rest : rest.slice(0, nextJob);

    const steps: { label: string; body: string }[] = [];
    const parts = job.split(/\n {6}- /).slice(1);
    for (const part of parts) {
        const name = /name: (.+)/.exec(part)?.[1] ?? /uses: (.+)/.exec(part)?.[1] ?? "(unnamed)";
        steps.push({ label: name.trim(), body: part });
    }
    return steps;
}

describe("the docker smoke test", () => {
    const steps = dockerJobSteps();

    it("has the steps this gate is about", () => {
        const labels = steps.map((s) => s.label);
        expect(labels).toContain("Write .env for the stack");
        expect(labels.some((l) => /Dump logs/.test(l))).toBe(true);
    });

    it("writes the stack's env before anything that could fail without it", () => {
        const envAt = steps.findIndex((s) => s.label === "Write .env for the stack");
        const composers = steps
            .map((s, i) => ({ ...s, i }))
            .filter((s) => /docker compose/.test(s.body) || /docker\/build-push-action|setup-buildx/.test(s.body));

        const tooEarly = composers.filter((s) => s.i < envAt).map((s) => s.label);
        expect(
            tooEarly,
            "a step that fails before the env file exists takes the log dump and the teardown down with it",
        ).toEqual([]);
    });
});
