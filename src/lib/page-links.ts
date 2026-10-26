/* Pure helpers shared by server (link tracking) and client (live preview). */
const KEY = /\b([A-Z][A-Z0-9]{1,9})-(\d+)\b/g;
const WIKI = /\[\[([^\]\n]{1,200})\]\]/g;
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g;

/** Applies `fn` to prose only; fenced and inline code are left untouched. */
function mapProse(src: string, fn: (prose: string) => string): string {
  return src
    .split(CODE)
    .map((seg, i) => (i % 2 === 1 ? seg : fn(seg)))
    .join("");
}

/** Issue keys (bare or `[[KEY-1]]`) and `[[Page title]]` references found in prose. */
export function extractRefs(content: string) {
  const keys = new Set<string>();
  const titles = new Set<string>();
  mapProse(content, (prose) => {
    for (const m of prose.matchAll(WIKI)) {
      const inner = m[1].trim();
      if (/^[A-Z][A-Z0-9]{1,9}-\d+$/.test(inner)) keys.add(inner);
      else titles.add(inner);
    }
    for (const m of prose.matchAll(KEY)) keys.add(`${m[1]}-${m[2]}`);
    return prose;
  });
  return { keys: [...keys], titles: [...titles] };
}

/** What references point to; plain objects so it can cross the server/client boundary. */
export type Resolved = {
  issues: Record<string, { id: string; seq: number; identifier: string; title: string }>;
  /** keyed by lowercase title */
  pages: Record<string, { id: string; title: string; identifier: string }>;
};

const attr = (s: string) => s.replace(/["()\n]/g, "'");

/** Rewrites references into Markdown links for rendering. Unresolved `[[x]]` stay visibly marked. */
export function linkify(content: string, res: Resolved): string {
  return mapProse(content, (prose) =>
    prose
      .replace(WIKI, (_m, inner: string) => {
        const t = inner.trim();
        const iss = res.issues[t];
        if (iss) return `[${t}](/${iss.identifier}/issues/${iss.seq} "${attr(iss.title)}")`;
        const pg = res.pages[t.toLowerCase()];
        if (pg) return `[${pg.title}](/${pg.identifier}/pages/${pg.id})`;
        return `[${t}](# "Página sin crear")`;
      })
      // bare keys, skipping anything already inside a markdown link
      .replace(/(\[[^\]]*\]\([^)]*\)|\[[^\]]*\])|\b([A-Z][A-Z0-9]{1,9})-(\d+)\b/g, (m, skip: string | undefined, ident: string, seq: string) => {
        if (skip) return m;
        const iss = res.issues[`${ident}-${seq}`];
        return iss ? `[${m}](/${iss.identifier}/issues/${iss.seq} "${attr(iss.title)}")` : m;
      }),
  );
}
