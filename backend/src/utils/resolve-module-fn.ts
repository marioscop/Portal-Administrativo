type ModuleLike = { default?: unknown } | Record<string, unknown>;

export function resolveModuleFn<T>(
  named: T,
  mod: ModuleLike,
  name: string,
): T {
  if (typeof named === 'function') return named;
  const ns = (mod as { default?: ModuleLike }).default ?? mod;
  const candidates: unknown[] = [];
  if (ns && typeof ns === 'object') {
    candidates.push((ns as Record<string, unknown>)[name]);
  }
  if (mod && typeof mod === 'object' && mod !== ns) {
    candidates.push((mod as Record<string, unknown>)[name]);
  }
  if ((mod as { default?: ModuleLike }).default && typeof (mod as { default: ModuleLike }).default === 'object') {
    const md = (mod as { default: Record<string, unknown> }).default;
    if (md !== ns) candidates.push(md[name]);
  }
  for (const v of candidates) {
    if (typeof v === 'function') return v as unknown as T;
  }
  return named;
}

export function toErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message && e.message.trim().length > 0) {
    return e.message;
  }
  return fallback;
}
