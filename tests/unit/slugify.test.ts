import { describe, it, expect } from "vitest";
import { slugify } from "@/core/lib/utils";

describe("slugify", () => {
    it("converts spaces to hyphens", () => {
        expect(slugify("hello world")).toBe("hello-world");
    });

    it("lowercases", () => {
        expect(slugify("HELLO WORLD")).toBe("hello-world");
    });

    it("transliterates Turkish characters", () => {
        expect(slugify("güncellemeler")).toBe("guncellemeler");
        expect(slugify("Türkçe İçerik")).toBe("turkce-icerik");
        expect(slugify("Şeker Çikolata")).toBe("seker-cikolata");
        expect(slugify("ığüşçö")).toBe("igusco");
    });

    it("transliterates European diacritics via NFD", () => {
        expect(slugify("café")).toBe("cafe");
        expect(slugify("piñata")).toBe("pinata");
        expect(slugify("naïve résumé")).toBe("naive-resume");
    });

    it("strips special characters", () => {
        expect(slugify("hello! @world#")).toBe("hello-world");
    });

    it("collapses multiple hyphens", () => {
        expect(slugify("foo  ---  bar")).toBe("foo-bar");
    });

    it("trims leading/trailing hyphens", () => {
        expect(slugify("  hello  ")).toBe("hello");
        expect(slugify("---hello---")).toBe("hello");
    });

    it("handles empty string", () => {
        expect(slugify("")).toBe("");
    });

    it("preserves underscores (word chars)", () => {
        expect(slugify("foo_bar")).toBe("foo_bar");
    });

    it("handles mixed-case Turkish I", () => {
        // Turkish dotted İ → i (not "i" with combining)
        expect(slugify("İstanbul")).toBe("istanbul");
    });
});
