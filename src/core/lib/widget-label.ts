/**
 * What a homepage widget is called.
 *
 * The widget settings screen built its own name by splitting the component's
 * id on its capitals: `FeaturedProductWidget` became "Featured Product
 * Widget". That is English in every locale, it repeats the word "widget" in a
 * list of widgets, and for a module whose ids are not written in English it
 * is not a name at all. A widget now declares `label` and `labelKey` the way
 * a dashboard card does, and the key is resolved in the `admin` namespace.
 *
 * A widget that predates the field still has to render something, so the id
 * split stays as the last fallback rather than the first choice.
 */

export interface LabelledWidget {
    id: string;
    label?: string;
    labelKey?: string;
}

/** The id, split on its capitals and stripped of a trailing "Widget". */
export function nameFromId(id: string): string {
    return id
        .replace(/([A-Z])/g, " $1")
        .replace(/\s*Widget$/, "")
        .trim();
}

/**
 * `translate` is a next-intl `t` and `has` its `t.has`, passed in so this
 * stays a pure function the tests can drive without a provider.
 */
export function widgetLabel(
    widget: LabelledWidget,
    has: (key: string) => boolean,
    translate: (key: string) => string,
): string {
    if (widget.labelKey && has(widget.labelKey)) return translate(widget.labelKey);
    if (widget.label && widget.label.trim()) return widget.label;
    return nameFromId(widget.id);
}
