export type QueryParams = Record<string, string | number | undefined | null>;

/**
 * Builds `path?query` from current params plus overrides, dropping empty
 * values. Filters and pagination live in the URL (docs/10-frontend-architecture.md
 * #40), so links need to change one param while keeping the rest.
 */
export function withParams(path: string, current: QueryParams, overrides: QueryParams = {}): string {
  const merged = { ...current, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
