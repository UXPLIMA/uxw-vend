/**
 * uxwVend module SDK - admin scaffolds.
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

// Settings page for a module that contributes a sign-in provider. There is
// nothing to save: Auth.js reads its credentials from the environment at
// startup, so what an admin needs is which variables to set and the redirect
// URL to register - not a form that would appear to work and change nothing.
export { AuthProviderSetup } from "@/core/components/admin/AuthProviderSetup";
export type { AuthProviderSetupProps } from "@/core/components/admin/AuthProviderSetup";
