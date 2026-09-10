import { roleScope, safeRoleCss } from "@/core/lib/role-css";

/**
 * The pill beside a member's name, wearing what their role was given.
 *
 * `RoleName` styles the name; this styles the thing next to it, and they are
 * separate because operators use them for opposite jobs. A name is made to
 * stand out in a list of names, and a badge is made to say what somebody is -
 * an operator who wants a quiet grey pill beside a gold name has to be able to
 * write both.
 *
 * The declarations go through the same check as the name's, here as well as
 * when they were saved. Both, not either: a row edited straight in the
 * database, or written before the check tightened, still has to render safely,
 * and the render site is the only place that decides how.
 *
 * Without any CSS it falls back to what every screen used to draw by hand: the
 * role's colour as text on a wash of itself. That is the reason this component
 * can replace those screens rather than sit beside them.
 */
export function RoleBadge({
    role,
    className = "",
}: {
    role: { id: string; name?: string | null; displayName?: string | null; color?: string | null; badgeCss?: string | null } | null;
    className?: string;
}) {
    if (!role) return null;

    const label = role.displayName || role.name || "";
    if (label === "") return null;

    const css = safeRoleCss(role.badgeCss ?? "");
    // A class an operator cannot choose, and one that cannot close the rule
    // it opens however the id was made. See `roleScope`.
    const scope = roleScope("badge", role.id);
    const shape = `text-xs px-2 py-0.5 rounded inline-block ${className}`.trim();

    if (css) {
        return (
            <>
                <style
                    // Through `safeRoleCss`, which refuses a brace, an angle
                    // bracket, an at-rule and every function that fetches or
                    // runs anything.
                    dangerouslySetInnerHTML={{ __html: `.${scope}{${css}}` }}
                />
                <span className={`${scope} ${shape}`}>{label}</span>
            </>
        );
    }

    const colour = role.color || "#6366f1";
    return (
        <span
            className={shape}
            // What every screen drew by hand before this component existed.
            style={{ backgroundColor: `${colour}20`, color: colour }}
        >
            {label}
        </span>
    );
}
