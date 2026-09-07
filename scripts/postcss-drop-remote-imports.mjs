/**
 * Drop `@import` rules that name an absolute http(s) URL.
 *
 * `@measured/puck`'s stylesheet opens with
 * `@import "https://rsms.me/inter/inter.css"`, and that stylesheet reaches
 * public pages through the module that renders a built page. So every first
 * visit fetched a stranger's stylesheet and three font files from it, on top
 * of the copies of Inter this app already self hosts through `next/font`.
 *
 * The fonts were the visible cost. The remote copy registers under the same
 * family name, arrives after paint and is about ten percent wider than the
 * fallback, which was enough to push the navigation onto a second row: 0.05
 * to 0.12 of layout shift on nine public pages against a 0.1 budget.
 *
 * A stylesheet this app ships does not fetch another one at runtime. Anything
 * a page needs is served from here, where it can be preloaded, versioned and
 * measured. Removing the rule leaves the rest of the dependency's CSS exactly
 * as it was.
 */
const plugin = () => ({
    postcssPlugin: "drop-remote-imports",
    AtRule: {
        import: (rule) => {
            if (/^\s*(?:url\(\s*)?["']?https?:\/\//i.test(rule.params)) rule.remove();
        },
    },
});

plugin.postcss = true;

export default plugin;
