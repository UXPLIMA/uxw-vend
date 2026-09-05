/**
 * uxwVend module SDK - shared UI primitives.
 *
 * Client components. These are the pieces that make a module's screens look
 * like the rest of the admin panel; a module that hand-rolls its own buttons
 * and cards drifts visually the first time core restyles.
 *
 * Deliberately one barrel rather than several: everything here is light. The
 * heaviest, `RichTextEditor`, already loads its editor through `next/dynamic`,
 * so importing `Button` does not drag it in.
 */
export { Button } from "@/core/components/ui/button";
export { Card, CardHeader, CardTitle, CardContent } from "@/core/components/ui/card";
export { Input } from "@/core/components/ui/input";
export { Label } from "@/core/components/ui/label";
export { Textarea } from "@/core/components/ui/textarea";
export {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/core/components/ui/select";
export { Skeleton } from "@/core/components/ui/skeleton";
export { useConfirm } from "@/core/components/ui/confirm-dialog";

/**
 * The site's currency and a formatter for it. A module that shows a price
 * must use this rather than its own `$`: the base comes from the setting the
 * payment gateways charge in, and the formatting follows the reader's locale.
 * A module that knows exchange rates calls `setDisplay({ code, rate })`.
 */
export { useSiteCurrency } from "@/core/components/currency/site-currency";
export type { SiteCurrency, DisplayCurrency } from "@/core/components/currency/site-currency";
export { RichTextEditor } from "@/core/components/ui/rich-text-editor";
export { FileUpload } from "@/core/components/ui/file-upload";
export { FooterDropdown } from "@/core/components/ui/footer-dropdown";

// The keyboard half of a dialog: Escape, a Tab trap, and focus handed back to
// whatever opened it. A module that draws its own `role="dialog"` needs this
// as much as core does, and there is one implementation of it.
export { useModalDialog, type ModalDialogOptions } from "@/core/hooks/useModalDialog";

// A module that builds a public page needs the same breadcrumb core uses.
// This sat in the tree unreachable from a module, so the store hand-rolled
// its own - and that copy was the one whose crumbs a keyboard could not reach.
export { Breadcrumb } from "@/core/components/ui/breadcrumb";

// A list screen has two ways to be empty: nothing was created yet, or the
// request never came back. Forty screens rendered the same "nothing here yet"
// for both, so a module that fetches its own content needs this panel as much
// as core does.
export { LoadFailed } from "@/core/components/ui/load-failed";

// The browser's `prompt()` renders in the browser's chrome, in the browser's
// language, and some contexts suppress it outright. Two admin screens asked
// for a reason that way. This is the same dialog `useConfirm` opens, with a
// field in it.
export { usePrompt, type PromptOptions } from "@/core/components/ui/confirm-dialog";

// Two formatters bound to the reader's locale. They were core-only, so eleven
// modules reached past the SDK for them and three others fell back to a bare
// `toLocaleDateString()`, which formats in the browser's language whatever the
// site is set to. The boundary check now catches that reach, so these have to
// be here.
export { useLocalDate } from "@/core/hooks/useLocalDate";
export { useRelativeTime } from "@/core/hooks/useRelativeTime";
