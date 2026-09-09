import { safeRoleCss } from "@/core/lib/role-css";

/**
 * A member's name, wearing the style their role was given.
 *
 * The declarations an operator wrote go into a rule this component writes, so
 * they are checked here as well as when they were saved. Both, not either: a
 * row edited straight in the database, or written before the check tightened,
 * still has to render safely, and this is the only place that decides how.
 *
 * A rule rather than an inline style because that is what an operator wrote -
 * a gradient with `background-clip`, an animation with a keyframe name - and
 * none of it survives being flattened into a style attribute. The rule is
 * scoped to a class nothing else uses, so the worst a declaration can do is
 * to the name it is on.
 */
export function RoleName({
    name,
    role,
    className = "",
}: {
    name: string;
    role: { id: string; displayName?: string | null; color?: string | null; nameCss?: string | null } | null;
    className?: string;
}) {
    if (!role) return <span className={className}>{name}</span>;

    const css = safeRoleCss(role.nameCss ?? "");
    // A class an operator cannot choose: the id is ours, so two roles cannot
    // collide and nothing else on the page can be reached from here.
    const scope = `uxw-role-${role.id}`;

    return (
        <>
            {css && (
                <style
                    // The string has been through `safeRoleCss`, which refuses a
                    // brace, an angle bracket, an at-rule and every function
                    // that fetches or runs anything.
                    dangerouslySetInnerHTML={{ __html: `.${scope}{${css}}` }}
                />
            )}
            <span
                className={`${scope} ${className}`.trim()}
                style={!css && role.color ? { color: role.color } : undefined}
            >
                {name}
            </span>
        </>
    );
}
