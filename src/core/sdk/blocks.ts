/**
 * uxwVend module SDK - page-builder block configuration.
 *
 * Separate entry point because it pulls in `@measured/puck`, which is large
 * and client-side. Only a module that renders the page builder needs it.
 */
export { buildMergedBlockConfig } from "@/core/lib/blocks-merger";
export type { BlockConfigMode, BlockConfigOptions } from "@/core/lib/blocks-merger";
export { useMergedBlockConfig } from "@/core/lib/use-merged-block-config";
