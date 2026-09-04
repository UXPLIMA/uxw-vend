import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { useModalDialog } from "@/core/hooks/useModalDialog";

/**
 * `aria-modal="true"` tells assistive technology that the rest of the page is
 * inert. Nothing in the DOM makes that true. Without a focus trap Tab walks
 * out of the dialog into the page behind the overlay, which is still fully
 * interactive and, to a sighted keyboard user, hidden under a black scrim;
 * without focus restoration, closing the dialog drops focus on the body so the
 * next Tab starts again from the top of the page. Eleven of the product's
 * twelve dialogs shipped the markup without either behaviour.
 *
 * jsdom does not move focus on a Tab key event, which is exactly what makes
 * these assertions meaningful: every focus change below is one the hook made
 * deliberately after calling preventDefault. A Tab in the middle of the dialog
 * is the browser's to handle and the hook leaves it alone, so there is nothing
 * to assert there.
 */

function Harness({
    onClose,
    trapFocus,
}: {
    onClose?: () => void;
    trapFocus?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const close = () => {
        setOpen(false);
        onClose?.();
    };
    const dialogRef = useModalDialog<HTMLDivElement>(open, close, { trapFocus });

    return (
        <div>
            <button onClick={() => setOpen(true)}>open</button>
            <button>behind</button>
            {open && (
                <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="test dialog">
                    <button>first</button>
                    <button>middle</button>
                    <button onClick={close}>last</button>
                </div>
            )}
        </div>
    );
}

/**
 * jsdom reports offsetParent as null for everything, which is how the hook
 * skips a control inside a collapsed section. Give the buttons one so the
 * filter does not empty the list.
 */
beforeEach(() => {
    cleanup();
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
        configurable: true,
        get() {
            return this.parentElement;
        },
    });
});

function open() {
    fireEvent.click(screen.getByText("open"));
}

function tab(shiftKey = false) {
    act(() => {
        fireEvent.keyDown(document, { key: "Tab", shiftKey });
    });
}

describe("useModalDialog", () => {
    it("moves focus into the dialog when it opens", () => {
        render(<Harness />);
        open();
        expect(document.activeElement).toBe(screen.getByText("first"));
    });

    it("wraps Tab at the last control back to the first", () => {
        render(<Harness />);
        open();
        screen.getByText("last").focus();
        tab();
        expect(document.activeElement).toBe(screen.getByText("first"));
    });

    it("wraps Shift+Tab at the first control back to the last", () => {
        render(<Harness />);
        open();
        tab(true);
        expect(document.activeElement).toBe(screen.getByText("last"));
    });

    it("leaves a Tab in the middle to the browser", () => {
        render(<Harness />);
        open();
        screen.getByText("middle").focus();
        tab();
        expect(document.activeElement).toBe(screen.getByText("middle"));
    });

    it("pulls focus back in when something behind the overlay has taken it", () => {
        render(<Harness />);
        open();
        screen.getByText("behind").focus();
        tab();
        expect(document.activeElement).toBe(screen.getByText("first"));
    });

    it("closes on Escape", () => {
        const onClose = vi.fn();
        render(<Harness onClose={onClose} />);
        open();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("gives focus back to the control that opened it", () => {
        render(<Harness />);
        const trigger = screen.getByText("open");
        trigger.focus();
        open();
        expect(document.activeElement).toBe(screen.getByText("first"));
        fireEvent.keyDown(document, { key: "Escape" });
        expect(document.activeElement).toBe(trigger);
    });

    it("does not trap when the caller asked for a plain popover, but still closes", () => {
        const onClose = vi.fn();
        render(<Harness onClose={onClose} trapFocus={false} />);
        open();
        screen.getByText("last").focus();
        tab();
        expect(document.activeElement).toBe(screen.getByText("last"));
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does nothing at all while the dialog is closed", () => {
        const onClose = vi.fn();
        render(<Harness onClose={onClose} />);
        const behind = screen.getByText("behind");
        behind.focus();
        fireEvent.keyDown(document, { key: "Escape" });
        tab();
        expect(onClose).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(behind);
    });
});
