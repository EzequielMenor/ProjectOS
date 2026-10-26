/** Root font size in px; every rem-based size in the UI scales with it. Stored in a cookie so the server can render it. */
export const UI_SIZES = [14, 16, 18, 20, 22, 24] as const;
export const DEFAULT_UI_SIZE = 18;
export const UI_SIZE_COOKIE = "pos-ui-size";

export function parseUiSize(value: string | undefined): number {
  const n = Number(value);
  return (UI_SIZES as readonly number[]).includes(n) ? n : DEFAULT_UI_SIZE;
}
