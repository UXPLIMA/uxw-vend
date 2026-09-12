// @vitest-environment node
import { describe, expect, it } from "vitest";
import { refusalMessage } from "../../../module-sources/parasut-invoicing/lib/refusal";

/**
 * What an operator is told when the accounting service says no.
 *
 * The service answers a refusal in the shape every JSON:API endpoint of it
 * uses: `errors`, each with a `title` and a `detail`. The `detail` is the
 * sentence somebody can act on - the tax number is not valid, this contact
 * already exists - and the module was showing the first 300 characters of the
 * raw body instead, braces and all.
 *
 * It matters here more than in most places. A refused invoice is discovered
 * after the money moved, by an operator who has to fix the sale and try
 * again, and "422: {\"errors\":[{\"title\":\"Unprocessable..." tells them
 * nothing about which field to look at.
 */
describe("a refusal says what to fix", () => {
    it("reads the sentence the service put in `detail`", () => {
        const body = JSON.stringify({
            errors: [{ title: "Unprocessable Entity", detail: "Vergi numarası geçersiz" }],
        });
        expect(refusalMessage(422, body)).toContain("Vergi numarası geçersiz");
    });

    it("joins them when the service refuses for more than one reason", () => {
        const body = JSON.stringify({
            errors: [
                { title: "a", detail: "Tax office is required" },
                { title: "b", detail: "Contact already exists" },
            ],
        });
        const said = refusalMessage(422, body);
        expect(said).toContain("Tax office is required");
        expect(said).toContain("Contact already exists");
    });

    it("falls back to the title when there is no detail", () => {
        expect(refusalMessage(403, JSON.stringify({ errors: [{ title: "Forbidden" }] }))).toContain("Forbidden");
    });

    it("keeps the status when the body is not the documented shape", () => {
        expect(refusalMessage(500, "<html>gateway</html>")).toContain("500");
        expect(refusalMessage(500, "")).toContain("500");
    });

    it("says nothing enormous, whatever arrives", () => {
        const huge = JSON.stringify({ errors: [{ detail: "x".repeat(5000) }] });
        expect(refusalMessage(422, huge).length).toBeLessThan(400);
    });
});
