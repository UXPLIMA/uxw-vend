/**
 * uxwVend module SDK — page composition.
 *
 * A module page that renders a full public screen needs the site chrome; a
 * module that contributes into a slot needs `Slot`. Both are stable contracts
 * — the theme system replaces what these render, so a module never needs to
 * know which theme is active.
 */
export { Navbar, Footer } from "@/core/components/layout";
export { default as StandardSidebarLayout } from "@/core/components/layout/SidebarLayout";
export { Slot } from "@/core/components/Slot";
