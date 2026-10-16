export interface ConsignadoImportPluginContext {
  fileName: string;
  folderPath?: string | null;
  profileOptions?: Record<string, unknown>;
  profilePluginConfig?: Record<string, unknown>;
  runProcess?: (
    cmd: string,
    args: string[],
    stdin: Buffer | null,
    opts?: { timeoutMs?: number },
  ) => Promise<{ stdout: Buffer; stderr: string; exitCode: number }>;
  cliPdfTextFallback?: (file: Buffer) => Promise<{ text: string } | null>;
  extractPdf?: (file: Buffer) => Promise<{ text?: string; pages?: unknown[] } | null>;
  __dbg?: {
    report: (id: string, location: string, message: string, data?: unknown) => void;
  };
}

export interface ConsignadoImportPluginParseResult {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  extractedCompetenciaMmAaaa?: string | null;
  topHeaderLines?: string[];
  skipAliases?: boolean;
  skipWhitelist?: boolean;
  overrideCompetenciaFileNameFallbacks?: boolean;
}

export interface ConsignadoImportPlugin {
  pluginId: string;
  pluginVersion: string;
  matches?(
    kindLower: string,
    fileName: string,
    profileOptions: Record<string, unknown>,
  ): boolean;
  parse(
    buffer: Buffer,
    ctx: ConsignadoImportPluginContext,
  ): Promise<ConsignadoImportPluginParseResult>;
  normalizeRow?(row: Record<string, unknown>): Record<string, unknown>;
}
