import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { IconPicker } from "@/core/components/ui/icon-picker";
import messages from "../../messages-core/en.json";

const NAMES = ["bar-chart", "home", "shopping-bag", "star"];

function mount(props: Partial<React.ComponentProps<typeof IconPicker>> = {}) {
    const onChange = vi.fn();
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <IconPicker names={NAMES} onChange={onChange} {...props} />
        </NextIntlClientProvider>,
    );
    return { onChange };
}

function openDialog() {
    fireEvent.click(screen.getByRole("button", { name: /choose an icon|home|star/i }));
    return screen.getByRole("dialog");
}

describe("IconPicker", () => {
    it("shows the placeholder while nothing is chosen", () => {
        mount();
        expect(screen.getByText("Choose an icon")).toBeTruthy();
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows the chosen icon's name on the trigger", () => {
        mount({ value: "ShoppingBag" });
        expect(screen.getByText("shopping-bag")).toBeTruthy();
    });

    it("lists every icon when opened", () => {
        mount();
        const dialog = openDialog();
        for (const name of NAMES) {
            expect(within(dialog, name)).toBeTruthy();
        }
    });

    it("filters the list as the admin searches", () => {
        mount();
        openDialog();
        fireEvent.change(screen.getByLabelText("Search icons"), { target: { value: "sho" } });
        expect(screen.getByText("shopping-bag")).toBeTruthy();
        expect(screen.queryByText("bar-chart")).toBeNull();
    });

    it("reports how many of the matches are on screen", () => {
        mount();
        openDialog();
        expect(screen.getByText("Showing 4 of 4")).toBeTruthy();
    });

    it("says so when nothing matches", () => {
        mount();
        openDialog();
        fireEvent.change(screen.getByLabelText("Search icons"), { target: { value: "zzz" } });
        expect(screen.getByText("No icon matches that search.")).toBeTruthy();
        expect(screen.getByText("Showing 0 of 0")).toBeTruthy();
    });

    it("reports the picked icon and closes", () => {
        const { onChange } = mount();
        openDialog();
        fireEvent.click(screen.getByTitle("Shopping Bag"));
        expect(onChange).toHaveBeenCalledWith("shopping-bag");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes on Escape without picking anything", () => {
        const { onChange } = mount();
        openDialog();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("clears the value from the trigger row", () => {
        const { onChange } = mount({ value: "home" });
        fireEvent.click(screen.getByLabelText("Clear icon"));
        expect(onChange).toHaveBeenCalledWith("");
    });

    it("offers no clear button while the field is empty", () => {
        mount();
        expect(screen.queryByLabelText("Clear icon")).toBeNull();
    });
});

/** Finds a tile by its icon name inside the open dialog. */
function within(dialog: HTMLElement, name: string) {
    return Array.from(dialog.querySelectorAll("span")).find((el) => el.textContent === name);
}
