/**
 * The page numbers to draw, with `null` where a run is elided.
 *
 * Always the first and last page, always the current one and its neighbours,
 * and never an ellipsis standing in for a single page - "1 ... 3 4 5" wastes
 * the same width as "1 2 3 4 5" and tells the reader less.
 */
export function pageWindow(page: number, pages: number): (number | null)[] {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

    const window = new Set<number>([1, pages, page, page - 1, page + 1]);
    if (page <= 3) [2, 3, 4].forEach((n) => window.add(n));
    if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => window.add(n));

    const sorted = [...window].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    const out: (number | null)[] = [];
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = sorted[i] - sorted[i - 1];
            if (gap === 2) out.push(sorted[i] - 1);
            else if (gap > 2) out.push(null);
        }
        out.push(sorted[i]);
    }
    return out;
}
