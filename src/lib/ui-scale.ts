/** Root font size in px; every rem-based size in the UI scales with it. Stored in a cookie so the server can render it. */
export const UI_SIZES = [14, 16, 18, 20, 22, 24] as const;
export const DEFAULT_UI_SIZE = 18;
export const UI_SIZE_COOKIE = "pos-ui-size";

export function parseUiSize(value: string | undefined): number {
  const n = Number(value);
  return (UI_SIZES as readonly number[]).includes(n) ? n : DEFAULT_UI_SIZE;
}

/** Fired on `window` whenever the size changes, so every control showing it stays in sync. */
export const UI_SIZE_EVENT = "projectos:ui-size";

/** Client only: applies the size now, remembers it in the cookie the server reads, and tells the other controls. */
export function setUiSize(n: number) {
  document.documentElement.style.fontSize = `${n}px`;
  document.cookie = `${UI_SIZE_COOKIE}=${n}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(UI_SIZE_EVENT, { detail: n }));
}

export function currentUiSize(): number {
  const n = parseFloat(document.documentElement.style.fontSize || getComputedStyle(document.documentElement).fontSize);
  return parseUiSize(String(n));
}

/** One step bigger or smaller, clamped to the available sizes. */
export function stepUiSize(from: number, dir: 1 | -1): number {
  const i = (UI_SIZES as readonly number[]).indexOf(from);
  return UI_SIZES[Math.min(UI_SIZES.length - 1, Math.max(0, i + dir))];
}
