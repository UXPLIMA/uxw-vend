/**
 * uxwVend module SDK — shared UI primitives.
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
export { RichTextEditor } from "@/core/components/ui/rich-text-editor";
export { FileUpload } from "@/core/components/ui/file-upload";
export { FooterDropdown } from "@/core/components/ui/footer-dropdown";
