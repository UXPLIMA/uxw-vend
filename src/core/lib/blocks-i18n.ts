import type { Config } from "@measured/puck";
import type { Translator } from "./auth-error-message";

/**
 * The page builder's inspector, in the operator's language.
 *
 * Puck renders a field's `label`, a select option's `label` and a category's
 * `title` exactly as the config carries them, and a config is a plain object
 * built outside React - so there is nowhere in it to call a translator. The
 * core block library answers that by making every one of those strings a key
 * in the `admin` catalogue; this walks the merged config and swaps each key
 * the catalogue knows for its translation.
 *
 * A label the catalogue does not know is left exactly as it was written. That
 * is what keeps this safe to run over module-contributed blocks, whose labels
 * were never keys: a module opts in by putting the key in its own `admin`
 * namespace, and a module that has not done so reads the same as before.
 *
 * Only the editor needs this. `admin` is not among the namespaces a public
 * page is given, so on the rendering path every `has` is false and the config
 * comes back untouched - which is also why the caller passes `mode`.
 */
export function localizeBlockConfig(config: Config, t: Translator): Config {
    const components: Record<string, unknown> = {};
    for (const [name, component] of Object.entries(config.components ?? {})) {
        components[name] = localizeComponent(component as Record<string, unknown>, t);
    }

    const categories: Record<string, unknown> = {};
    for (const [name, category] of Object.entries(config.categories ?? {})) {
        const source = category as Record<string, unknown>;
        categories[name] = typeof source.title === "string"
            ? { ...source, title: translate(source.title, t) }
            : source;
    }

    return {
        ...config,
        components,
        categories: Object.keys(categories).length > 0 ? categories : config.categories,
    } as Config;
}

/** The catalogue's wording for a key it knows, or the string as written. */
function translate(text: string, t: Translator): string {
    if (t.has(text)) return t(text);
    // A category a module invented has a key nobody wrote a translation for,
    // and a raw `blocks_cat_community` in the palette is worse than the word
    // it was built from. The merger names them, so the shape is known.
    const category = /^blocks_cat_(.+)$/.exec(text);
    if (category) return category[1].charAt(0).toUpperCase() + category[1].slice(1);
    return text;
}

/**
 * A component's own label and its fields. `defaultProps` and `render` are
 * left alone on purpose: those are the block's content and its markup, not
 * anything the inspector labels.
 */
function localizeComponent(component: Record<string, unknown>, t: Translator): Record<string, unknown> {
    const out = { ...component };
    if (typeof component.label === "string") out.label = translate(component.label, t);
    if (component.fields && typeof component.fields === "object") {
        out.fields = localizeFields(component.fields as Record<string, unknown>, t);
    }
    return out;
}

function localizeFields(fields: Record<string, unknown>, t: Translator): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(fields)) {
        out[name] = localizeField(field, t);
    }
    return out;
}

/** One field: its label, the labels of its options, and any nested fields. */
function localizeField(field: unknown, t: Translator): unknown {
    if (!field || typeof field !== "object") return field;
    const source = field as Record<string, unknown>;
    const out: Record<string, unknown> = { ...source };

    if (typeof source.label === "string") out.label = translate(source.label, t);

    if (Array.isArray(source.options)) {
        out.options = source.options.map((option) => {
            if (!option || typeof option !== "object") return option;
            const entry = option as Record<string, unknown>;
            return typeof entry.label === "string"
                ? { ...entry, label: translate(entry.label, t) }
                : entry;
        });
    }

    // An array or object field carries the fields of what it holds.
    for (const nested of ["arrayFields", "objectFields"] as const) {
        const group = source[nested];
        if (group && typeof group === "object") {
            out[nested] = localizeFields(group as Record<string, unknown>, t);
        }
    }

    return out;
}
