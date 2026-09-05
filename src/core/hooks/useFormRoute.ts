"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/core/lib/i18n/navigation";

/**
 * A create or edit form is a place, so it has an address.
 *
 * Admin list screens used to unfold their form as a card above the rows:
 * `const [showForm, setShowForm] = useState(false)`. On a screen with two
 * hundred coupons that pushes the row you came to edit off the bottom, the
 * browser's back button does not close it, and the half-filled form cannot be
 * reloaded, linked or reopened where you left it, because nothing about it is
 * in the URL.
 *
 * Core's own screens got real route segments - `/admin/roles/new`,
 * `/admin/roles/<id>/edit`. A module screen gets the same behaviour from a
 * query parameter on the path it already has, because a module's field
 * definitions, submit handler and validation live in that one page file;
 * a child route would need all of it copied into two more files per module.
 * What the path segment was for - the address changes, back works, and the
 * form owns the screen - is what this gives.
 *
 * The caller renders the form and returns early when `showForm` is true.
 */
export function useFormRoute() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const param = searchParams?.get("form") ?? null;
    const editingId = param && param !== "new" ? param : null;

    const openForm = useCallback(
        (id?: string | null) => router.push(`${pathname}?form=${id ?? "new"}`),
        [router, pathname],
    );
    const closeForm = useCallback(() => router.push(pathname), [router, pathname]);

    return {
        /** True while the form owns the screen. */
        showForm: param !== null,
        /**
         * The raw `?form=` value. A screen with two different forms on it -
         * one per tab - names them (`?form=article`, `?form=category`) rather
         * than using `new` twice.
         */
        formParam: param,
        /** The row being edited, or null when the form is a create form. */
        editingId,
        /** Href for a link that opens the form, for an anchor rather than a handler. */
        formHref: (id?: string | null) => `${pathname}?form=${id ?? "new"}`,
        openForm,
        closeForm,
    };
}
