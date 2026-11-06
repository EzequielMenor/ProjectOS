// UNEXECUTED: the Vitest runner was unavailable (worker spawn EAGAIN) when this file was written.
import { describe, expect, it } from "vitest";
import { PROJECT_STATUSES, type ProjectStatus } from "@/db/schema";
import {
  DEFAULT_PORTFOLIO_QUERY,
  LIFECYCLE_FILTERS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  filterProjects,
  isDefaultPortfolioQuery,
  parsePortfolioQuery,
  statusLabel,
  type PortfolioProject,
  type PortfolioQuery,
} from "@/lib/project-status";

const project = (identifier: string, status: ProjectStatus | null, extra: Partial<PortfolioProject> = {}): PortfolioProject => ({
  identifier,
  name: `Proyecto ${identifier}`,
  description: "",
  status,
  archived: false,
  ...extra,
});

const PORTFOLIO = [
  project("PLAN", "planned"),
  project("ACT", "active", { name: "Facturación", description: "Objetivo: cobrar a tiempo" }),
  project("PAU", "paused"),
  project("DONE", "completed"),
  project("CANC", "cancelled"),
  project("OLD", null),
  project("ARCH", "active", { archived: true }),
  project("ARCD", "completed", { archived: true }),
  project("ARCU", null, { archived: true }),
];

const ids = (query: Partial<PortfolioQuery>, projects = PORTFOLIO) =>
  filterProjects(projects, { ...DEFAULT_PORTFOLIO_QUERY, ...query }).map((p) => p.identifier);

describe("project status labels", () => {
  it("covers every stored status, in lifecycle order, plus the unclassified label", () => {
    expect([...PROJECT_STATUS_ORDER]).toEqual([...PROJECT_STATUSES]);
    expect(PROJECT_STATUS_ORDER.map((s) => PROJECT_STATUS_LABELS[s])).toEqual(["Planificado", "En marcha", "Pausado", "Terminado", "Cancelado"]);
    expect(statusLabel(null)).toBe("Sin clasificar");
    expect(LIFECYCLE_FILTERS.map((f) => f.value)).toEqual(["all", ...PROJECT_STATUSES, "unclassified"]);
  });
});

describe("parsePortfolioQuery", () => {
  it("defaults to the tracked view with no search and any lifecycle", () => {
    expect(parsePortfolioQuery({})).toEqual({ q: "", status: "all", view: "tracked" });
    expect(isDefaultPortfolioQuery(parsePortfolioQuery({}))).toBe(true);
  });

  it("reads valid values and trims the search", () => {
    expect(parsePortfolioQuery({ q: "  cobrar  ", status: "paused", view: "archived" })).toEqual({ q: "cobrar", status: "paused", view: "archived" });
    expect(parsePortfolioQuery({ status: "unclassified", view: "all" })).toEqual({ q: "", status: "unclassified", view: "all" });
    expect(isDefaultPortfolioQuery(parsePortfolioQuery({ view: "all" }))).toBe(false);
  });

  it("uses the first of repeated params and ignores unknown values and params", () => {
    expect(parsePortfolioQuery({ status: ["completed", "active"], view: ["all", "archived"], q: ["a", "b"] })).toEqual({ q: "a", status: "completed", view: "all" });
    expect(parsePortfolioQuery({ status: "bogus", view: "everything", other: "x", q: undefined })).toEqual(DEFAULT_PORTFOLIO_QUERY);
    expect(parsePortfolioQuery({ status: [], view: [] })).toEqual(DEFAULT_PORTFOLIO_QUERY);
  });

  it("caps very long searches", () => {
    expect(parsePortfolioQuery({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("filterProjects visibility and lifecycle", () => {
  it("default view keeps unarchived planned, active, paused and unclassified, hiding finished, cancelled and archived", () => {
    expect(ids({})).toEqual(["PLAN", "ACT", "PAU", "OLD"]);
  });

  it("an explicit lifecycle in the tracked view shows finished and cancelled projects without archived ones", () => {
    expect(ids({ status: "completed" })).toEqual(["DONE"]);
    expect(ids({ status: "cancelled" })).toEqual(["CANC"]);
    expect(ids({ status: "active" })).toEqual(["ACT"]);
    expect(ids({ status: "unclassified" })).toEqual(["OLD"]);
  });

  it("all view includes archived and every lifecycle, including unclassified", () => {
    expect(ids({ view: "all" })).toEqual(PORTFOLIO.map((p) => p.identifier));
    expect(ids({ view: "all", status: "completed" })).toEqual(["DONE", "ARCD"]);
    expect(ids({ view: "all", status: "unclassified" })).toEqual(["OLD", "ARCU"]);
  });

  it("archived view shows only archived projects, whatever their lifecycle, and combines with a lifecycle", () => {
    expect(ids({ view: "archived" })).toEqual(["ARCH", "ARCD", "ARCU"]);
    expect(ids({ view: "archived", status: "active" })).toEqual(["ARCH"]);
    expect(ids({ view: "archived", status: "unclassified" })).toEqual(["ARCU"]);
    expect(ids({ view: "archived", status: "paused" })).toEqual([]);
  });

  it("returns nothing for an empty portfolio and does not mutate its input", () => {
    expect(ids({ view: "all" }, [])).toEqual([]);
    const copy = structuredClone(PORTFOLIO);
    filterProjects(PORTFOLIO, { q: "x", status: "active", view: "all" });
    expect(PORTFOLIO).toEqual(copy);
  });
});

describe("filterProjects search", () => {
  it("matches name, identifier and objective ignoring case and accents", () => {
    expect(ids({ q: "FACTURACION" })).toEqual(["ACT"]);
    expect(ids({ q: "act" })).toEqual(["ACT"]);
    expect(ids({ q: "cobrar a TIEMPO" })).toEqual(["ACT"]);
    expect(ids({ q: "proyecto pau" })).toEqual(["PAU"]);
  });

  it("returns no match for unknown text and combines with the other filters", () => {
    expect(ids({ q: "no existe" })).toEqual([]);
    expect(ids({ q: "proyecto", status: "completed" })).toEqual(["DONE"]);
    expect(ids({ q: "proyecto", view: "archived" })).toEqual(["ARCH", "ARCD", "ARCU"]);
    expect(ids({ q: "done" })).toEqual([]);
  });
});
