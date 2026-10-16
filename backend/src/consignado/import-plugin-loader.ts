import type {
  ConsignadoImportPlugin,
  ConsignadoImportPluginContext,
  ConsignadoImportPluginParseResult,
} from './plugins/import-plugin.interface';
import RecursoMpgoPlugin from './plugins/recurso_mpgo.plugin';
import RecursoTjgoPlugin from './plugins/recurso_tjgo.plugin';

const BUILTIN_PLUGINS: Array<ConsignadoImportPlugin> = [RecursoMpgoPlugin, RecursoTjgoPlugin];
const byIdCache = new Map<string, ConsignadoImportPlugin | null>();

function getBuiltin(pluginId: string): ConsignadoImportPlugin | null {
  if (byIdCache.has(pluginId)) return byIdCache.get(pluginId) ?? null;
  for (const p of BUILTIN_PLUGINS) {
    if (String(p.pluginId ?? '').toLowerCase() === String(pluginId ?? '').toLowerCase()) {
      byIdCache.set(pluginId, p);
      return p;
    }
  }
  byIdCache.set(pluginId, null);
  return null;
}

export function resolveImportPluginByOptions(
  profileOptions: Record<string, unknown> | null | undefined,
  kindLower: string,
  fileName: string,
): ConsignadoImportPlugin | null {
  const opts = (profileOptions ?? {}) as Record<string, unknown>;
  const explicit = typeof opts.pluginId === 'string' && opts.pluginId.trim() ? opts.pluginId.trim() : null;
  if (explicit) return getBuiltin(explicit);
  for (const p of BUILTIN_PLUGINS) {
    try {
      if (typeof p.matches === 'function' && p.matches(kindLower, fileName, opts)) {
        return p;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function runImportPlugin(
  plugin: ConsignadoImportPlugin,
  buffer: Buffer,
  ctx: ConsignadoImportPluginContext,
): Promise<ConsignadoImportPluginParseResult> {
  const res = await plugin.parse(buffer, ctx);
  const rows =
    typeof plugin.normalizeRow === 'function' && Array.isArray(res?.rows)
      ? res.rows.map((r) => plugin!.normalizeRow!(r))
      : res?.rows ?? [];
  return {
    headers: Array.isArray(res?.headers) ? res.headers : [],
    rows,
    extractedCompetenciaMmAaaa: res?.extractedCompetenciaMmAaaa ?? null,
    topHeaderLines: Array.isArray(res?.topHeaderLines) ? res.topHeaderLines : [],
    skipAliases: Boolean(res?.skipAliases),
    skipWhitelist: Boolean(res?.skipWhitelist),
    overrideCompetenciaFileNameFallbacks: Boolean(res?.overrideCompetenciaFileNameFallbacks),
  };
}

export function pluginConfigFromOptions(
  profileOptions: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const opts = (profileOptions ?? {}) as Record<string, unknown>;
  const raw = opts.pluginConfig;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export const ImportPluginLoader = {
  resolveImportPluginByOptions,
  runImportPlugin,
  pluginConfigFromOptions,
  BUILTIN_PLUGINS,
};

export default ImportPluginLoader;
