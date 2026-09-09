/**
 * What this version ships for one string, whoever ships it.
 *
 * Core reads its catalogue off disk; a module carries its own inside the
 * manifest it was installed from. The translation editor asks the same
 * question of both - what did this say before anybody edited it? - so the
 * difference is settled here rather than at every call site.
 *
 * Core names no module in doing so: the id arrives as data, from a row.
 */

import { moduleLoader } from "@/core/lib/module-loader";
import { isUnsafeKey } from "@/core/lib/safe-object";
import { messageAt, shippedMessages } from "./shipped-messages";

/** The id the `Translation` table gives rows that are not a module's. */
const CORE_MODULE = "core";

/** A namespace holding one string rather than a tree writes it under this. */
const ROOT_KEY = "_root";

function namespaceOf(
    catalogue: Record<string, unknown> | undefined,
    namespace: string,
): unknown {
    if (!catalogue || isUnsafeKey(namespace)) return undefined;
    return Object.prototype.hasOwnProperty.call(catalogue, namespace) ? catalogue[namespace] : undefined;
}

export function shippedValue(
    moduleId: string,
    locale: string,
    namespace: string,
    key: string,
): string | null {
    const catalogue = moduleId === CORE_MODULE
        ? (shippedMessages(locale) as Record<string, unknown>)
        : (moduleLoader.getModule(moduleId)?.manifest.translations?.[locale] as Record<string, unknown> | undefined);

    const found = namespaceOf(catalogue, namespace);
    if (typeof found === "string") return key === ROOT_KEY ? found : null;
    if (typeof found !== "object" || found === null) return null;
    return messageAt(found as Record<string, unknown>, key);
}
