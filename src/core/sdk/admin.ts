/**
 * uxwVend module SDK — admin scaffolds.
 *
 * `AdminCrudPage` and `SettingsForm` render a complete list/create/edit screen
 * or a settings panel from a field description, so a module's admin route is
 * usually a manifest entry plus a few lines of configuration.
 *
 * Separate from `@/core/sdk/ui` so a public-facing module page never pulls the
 * admin scaffolds into its bundle.
 */
export { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";
export type { CrudField } from "@/core/components/admin/AdminCrudPage";
export { SettingsForm } from "@/core/components/admin/SettingsForm";
export type { SettingsField } from "@/core/components/admin/SettingsForm";
