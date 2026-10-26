/* Read-only Plane REST client. Only GET requests are ever issued; the API key never leaves the
 * Authorization-less `X-API-Key` header and is not written to the snapshot. */
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION, type PlaneProjectSnapshot, type PlaneSnapshot } from "./plane";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export type FetchOptions = {
  apiKey: string;
  workspace: string;
  baseUrl?: string;
  /** Plane project identifiers (e.g. FICH); all projects when empty. */
  only?: string[];
  /** Minimum ms between requests. Plane allows 60/min. */
  minIntervalMs?: number;
  onProgress?: (msg: string) => void;
  fetchImpl?: typeof fetch;
};

export class PlaneClient {
  private last = 0;
  private base: string;
  private fetchImpl: typeof fetch;
  requests = 0;
  constructor(private o: FetchOptions) {
    this.base = (o.baseUrl ?? "https://api.plane.so").replace(/\/+$/, "");
    this.fetchImpl = o.fetchImpl ?? fetch;
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    for (let attempt = 0; ; attempt++) {
      const wait = (this.o.minIntervalMs ?? 1100) - (Date.now() - this.last);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      this.requests++;
      const res = await this.fetchImpl(url, { method: "GET", headers: { "X-API-Key": this.o.apiKey, Accept: "application/json" } });
      if (res.status === 429 && attempt < 5) {
        const header = Number(res.headers.get("retry-after"));
        const retry = Number.isFinite(header) && res.headers.get("retry-after") !== null ? header : 30;
        this.o.onProgress?.(`Límite de peticiones de Plane; esperando ${retry}s`);
        await new Promise((r) => setTimeout(r, retry * 1000));
        continue;
      }
      if (!res.ok) throw new PlaneHttpError(res.status, `${res.status} ${res.statusText} en ${url.pathname}`);
      return res.json();
    }
  }

  /** Follows Plane's cursor pagination (v1: next_page_results/next_cursor; v2: has_more/next_cursor) or a bare array. */
  async list(path: string, params: Record<string, string> = {}): Promise<{ items: Raw[]; total?: number }> {
    const items: Raw[] = [];
    let cursor: string | undefined;
    let total: number | undefined;
    for (let page = 0; page < 1000; page++) {
      const body = (await this.get(path, { per_page: "100", ...params, ...(cursor ? { cursor } : {}) })) as Raw | Raw[];
      if (Array.isArray(body)) return { items: items.concat(body), total: items.length + body.length };
      items.push(...((body.results ?? body.data ?? []) as Raw[]));
      total = body.total_results ?? body.total_count ?? total;
      const more = body.next_page_results ?? body.has_more ?? false;
      if (!more || !body.next_cursor) break;
      cursor = body.next_cursor;
    }
    return { items, total };
  }

  /** Like list() but a 404/403 yields an empty list plus a note (optional features may be disabled per project). */
  async listOptional(path: string, notes: string[], label: string, params: Record<string, string> = {}): Promise<Raw[]> {
    try {
      return (await this.list(path, params)).items;
    } catch (e) {
      if (e instanceof PlaneHttpError && (e.status === 404 || e.status === 403)) {
        notes.push(`${label}: no disponible (${e.status})`);
        return [];
      }
      throw e;
    }
  }

  async getOptional(path: string): Promise<Raw | null> {
    try {
      return (await this.get(path)) as Raw;
    } catch (e) {
      if (e instanceof PlaneHttpError && (e.status === 404 || e.status === 403)) return null;
      throw e;
    }
  }
}

export class PlaneHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const idsOf = (items: Raw[]) => items.map((x) => (typeof x === "string" ? x : (x.issue ?? x.issue_id ?? x.id) as string)).filter(Boolean);

export async function fetchPlaneSnapshot(o: FetchOptions): Promise<PlaneSnapshot> {
  const c = new PlaneClient(o);
  const say = o.onProgress ?? (() => {});
  const ws = `/api/v1/workspaces/${encodeURIComponent(o.workspace)}`;
  const projects = (await c.list(`${ws}/projects/`)).items;
  const only = o.only?.map((x) => x.toUpperCase());
  const out: PlaneProjectSnapshot[] = [];
  for (const p of projects) {
    if (only && !only.includes(String(p.identifier).toUpperCase())) continue;
    const base = `${ws}/projects/${p.id}`;
    const notes: string[] = [];
    say(`${p.identifier}: estados, etiquetas y work items`);
    const states = (await c.list(`${base}/states/`)).items;
    const labels = (await c.list(`${base}/labels/`)).items;
    const { items: issues, total } = await c.list(`${base}/work-items/`);
    say(`${p.identifier}: ${issues.length} work items; ciclos y módulos`);
    const cycles = [];
    for (const cy of await c.listOptional(`${base}/cycles/`, notes, "ciclos"))
      cycles.push({ cycle: cy, issueIds: idsOf(await c.listOptional(`${base}/cycles/${cy.id}/cycle-issues/`, notes, `ciclo ${cy.name}`)) });
    const modules = [];
    for (const m of await c.listOptional(`${base}/modules/`, notes, "módulos"))
      modules.push({ module: m, issueIds: idsOf(await c.listOptional(`${base}/modules/${m.id}/module-issues/`, notes, `módulo ${m.name}`)) });
    const comments: Record<string, Raw[]> = {};
    const links: Record<string, Raw[]> = {};
    const relations: Record<string, Raw> = {};
    let n = 0;
    for (const i of issues) {
      if (++n % 10 === 0) say(`${p.identifier}: comentarios/enlaces/relaciones ${n}/${issues.length}`);
      const cs = await c.listOptional(`${base}/work-items/${i.id}/comments/`, notes, "comentarios");
      if (cs.length) comments[i.id] = cs;
      const ls = await c.listOptional(`${base}/work-items/${i.id}/links/`, notes, "enlaces");
      if (ls.length) links[i.id] = ls;
      const r = await c.getOptional(`${base}/work-items/${i.id}/relations/`);
      if (r) relations[i.id] = r;
    }
    const pages = await c.listOptional(`${base}/pages/`, notes, "páginas");
    for (const note of new Set(notes)) say(`${p.identifier}: ${note}`);
    out.push({ project: p, states, labels, issues, cycles, modules, comments, links, relations, pages, expectedIssueCount: total });
  }
  say(`Listo: ${out.length} proyectos, ${c.requests} peticiones GET`);
  return { format: SNAPSHOT_FORMAT, version: SNAPSHOT_VERSION, fetchedAt: new Date().toISOString(), workspace: o.workspace, projects: out };
}
