type ModuleLike = {
    default?: unknown;
} | Record<string, unknown>;
export declare function resolveModuleFn<T>(named: T, mod: ModuleLike, name: string): T;
export declare function toErrorMessage(e: unknown, fallback: string): string;
export {};
