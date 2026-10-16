"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModuleFn = resolveModuleFn;
exports.toErrorMessage = toErrorMessage;
function resolveModuleFn(named, mod, name) {
    if (typeof named === 'function')
        return named;
    const ns = mod.default ?? mod;
    const candidates = [];
    if (ns && typeof ns === 'object') {
        candidates.push(ns[name]);
    }
    if (mod && typeof mod === 'object' && mod !== ns) {
        candidates.push(mod[name]);
    }
    if (mod.default && typeof mod.default === 'object') {
        const md = mod.default;
        if (md !== ns)
            candidates.push(md[name]);
    }
    for (const v of candidates) {
        if (typeof v === 'function')
            return v;
    }
    return named;
}
function toErrorMessage(e, fallback) {
    if (e instanceof Error && e.message && e.message.trim().length > 0) {
        return e.message;
    }
    return fallback;
}
//# sourceMappingURL=resolve-module-fn.js.map