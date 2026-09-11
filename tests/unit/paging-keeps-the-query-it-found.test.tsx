/**
 * Paging keeps whatever else is in the address.
 *
 * The blog index, the blog admin list and the users screen each built their
 * page links by hand as `?page=2`, which replaced the query string instead of
 * adding to it. Filter the blog by a category, go to page two, and the filter
 * was gone: the reader got page two of everything and no sign that anything
 * had been dropped.
 *
 * One component builds the links now, from the query it was rendered under.
 * This is the guarantee that made it worth centralising, so it is tested
 * against the component rather than against each screen's markup.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import fs from "node:fs";
import path from "node:path";

const search = new URLSearchParams("category=news&tag=patch");

vi.mock("next/navigation", () => ({
    useSearchParams: () => search,
}));
vi.mock("@/core/lib/i18n/navigation", () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>{children}</a>
    ),
    usePathname: () => "/blog",
    useRouter: () => ({ push: vi.fn() }),
}));

const MESSAGES = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages-core/en.json"), "utf8"));

const { Pagination } = await import("@/core/components/ui/pagination");

function draw(page: number, pages: number) {
    return render(
        <NextIntlClientProvider locale="en" messages={MESSAGES}>
            <Pagination page={page} pages={pages} pageParam="page" />
        </NextIntlClientProvider>,
    );
}

/** The href of the control a reader would click to reach `label`. */
function hrefOf(label: RegExp | string): string | null {
    return screen.getByRole("link", { name: label }).getAttribute("href");
}

describe("a page link", () => {
    it("carries every other parameter it was rendered under", () => {
        draw(2, 9);
        const next = hrefOf(MESSAGES.common.nextPage);
        expect(next).toContain("category=news");
        expect(next).toContain("tag=patch");
        expect(next).toContain("page=3");
    });

    it("drops the page parameter for page one, because that is the bare address", () => {
        draw(2, 9);
        const previous = hrefOf(MESSAGES.common.previousPage);
        expect(previous).not.toContain("page=");
        expect(previous).toContain("category=news");
    });

    it("names the page a number goes to", () => {
        draw(2, 9);
        expect(hrefOf(/page 4 of 9/i)).toContain("page=4");
    });

    it("marks the page the reader is on, and does not link it to itself", () => {
        draw(2, 9);
        const current = screen.getByRole("button", { name: /page 2 of 9/i });
        expect(current.getAttribute("aria-current")).toBe("page");
    });
});
