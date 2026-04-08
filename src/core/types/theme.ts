
export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    card: string;
    cardForeground: string;
    destructive: string;
    success: string;
    warning: string;
}

export interface ThemeFonts {
    heading: string;
    body: string;
    mono: string;
}

/**
 * Declarative description of a user-editable theme property.
 * The customizer admin page renders a form based on these entries,
 * with a control type appropriate to each property.
 */
export interface ThemeProperty {
    /** Dot-path key into the ThemeConfig, e.g. "colors.primary" or "radius" */
    key: string;
    /** Display label for the admin form */
    label: string;
    /** Control type */
    type: "color" | "text" | "number" | "slider" | "select" | "font";
    /** Group name — properties with the same group are shown together */
    group?: string;
    /** Used by slider/number */
    min?: number;
    max?: number;
    step?: number;
    /** Unit suffix for display (e.g. "px", "rem") */
    unit?: string;
    /** Used by select */
    options?: { value: string; label: string }[];
    /** User-facing help text */
    description?: string;
}

export interface ThemeConfig {
    id: string;
    name: string;
    description?: string;
    author?: string;
    version?: string;
    type: 'light' | 'dark';

    /**
     * Parent theme id. Child themes inherit colors/fonts/radius/schema/etc.
     * from the parent and override only what they explicitly define.
     * Resolved at registry build time.
     */
    extends?: string;

    colors: ThemeColors;
    fonts: ThemeFonts;
    radius: string;

    /**
     * Custom CSS to inject globally when this theme is active.
     * Allows for advanced styling overrides beyond standard tokens.
     */
    css?: string;

    /**
     * Declarative schema of user-editable properties.
     * If present, the customizer admin page will render a form from this schema.
     * If absent, the theme is considered "locked" (only code-level changes).
     */
    schema?: ThemeProperty[];
}

/**
 * User overrides of theme properties (stored in Setting key "theme_overrides").
 * Shape: { [themeId]: { [propertyKey]: value } }
 * Example: { "flat": { "colors.primary": "#ff0000", "radius": "0.25rem" } }
 */
export type ThemeOverrides = Record<string, Record<string, string>>;

export interface ThemeComponents {
    // Map component names to React Components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: React.ComponentType<any> | undefined;
}

export interface Theme {
    config: ThemeConfig;
    components: ThemeComponents;
}
