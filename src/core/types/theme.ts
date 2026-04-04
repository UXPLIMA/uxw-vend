
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

export interface ThemeConfig {
    id: string;
    name: string;
    description?: string;
    author?: string;
    version?: string;
    type: 'light' | 'dark';

    colors: ThemeColors;
    fonts: ThemeFonts;
    radius: string;

    /**
     * Custom CSS to inject globally when this theme is active.
     * Allows for advanced styling overrides beyond standard tokens.
     */
    css?: string;
}

export interface ThemeComponents {
    // Map component names to React Components
    [key: string]: React.ComponentType<any> | undefined;
}

export interface Theme {
    config: ThemeConfig;
    components: ThemeComponents;
}
