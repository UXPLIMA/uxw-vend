/**
 * Sorting the analytics panels a module offered into tabs it named.
 *
 * The screen was one scroll of every chart every installed module returned, in
 * whatever order the fetches came back. With a shop, a forum, a credit ledger
 * and a support desk installed that is a wall, and the report an operator
 * opened it for is somewhere in the middle of it.
 *
 * The tabs are the module's to name. "By payment method" and "By category" are
 * a shop's words and core does not know a shop exists, so a module declares
 * the groups it fills and tags each panel with one. Core writes exactly one
 * heading - the first tab, which holds everything - and that is the only one
 * it is entitled to.
 *
 * Which makes the invariant here the thing worth having a file for. A filter
 * is one typo away from being a shredder: a panel tagged with a group nobody
 * declared, or a module that spells its own group differently in two places,
 * has to stay reachable. Everything is in the first tab, always, and a group
 * a module names but never fills gets no tab at all.
 */

/** Core's own tab, and the only heading core writes on this screen. */
export const ALL_TAB = "all";

export interface TabDeclaration {
    id: string;
    label: string;
    labelKey?: string;
    /** Lower comes first. Untouched declarations keep the order they arrived. */
    order?: number;
}

/** What a chart or a ranking has to carry to be sorted. */
export interface Grouped {
    group?: string | null;
}

export interface AnalyticsTab<C extends Grouped, R extends Grouped> {
    id: string;
    /** Null on the everything tab, whose heading is core's. */
    label: string | null;
    labelKey: string | null;
    charts: C[];
    rankings: R[];
}

export function analyticsTabs<C extends Grouped, R extends Grouped>(
    declared: readonly TabDeclaration[],
    charts: readonly C[],
    rankings: readonly R[],
): AnalyticsTab<C, R>[] {
    const everything: AnalyticsTab<C, R> = {
        id: ALL_TAB,
        label: null,
        labelKey: null,
        charts: [...charts],
        rankings: [...rankings],
    };

    // First naming wins, and no module takes core's tab off it. The declared
    // position is carried beside the tab rather than on it, so a rank is not
    // something a caller can read off the answer and start depending on.
    const byId = new Map<string, AnalyticsTab<C, R>>();
    const rank = new Map<string, number>();
    declared.forEach((tab, at) => {
        const id = typeof tab.id === "string" ? tab.id.trim() : "";
        if (id === "" || id === ALL_TAB || byId.has(id)) return;
        byId.set(id, {
            id,
            label: tab.label,
            labelKey: tab.labelKey ?? null,
            charts: [],
            rankings: [],
        });
        rank.set(id, tab.order ?? at);
    });

    for (const chart of charts) {
        const tab = chart.group ? byId.get(chart.group) : undefined;
        tab?.charts.push(chart);
    }
    for (const item of rankings) {
        const tab = item.group ? byId.get(item.group) : undefined;
        tab?.rankings.push(item);
    }

    // A group a module named but never filled gets no tab: an empty tab is a
    // promise of a report that is not there.
    const filled = [...byId.values()]
        .filter((tab) => tab.charts.length > 0 || tab.rankings.length > 0)
        .sort((a, b) => (rank.get(a.id) as number) - (rank.get(b.id) as number));

    return [everything, ...filled];
}
