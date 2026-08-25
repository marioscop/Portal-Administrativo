"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sql_js_1 = __importDefault(require("sql.js"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function parseMoneyToCents(s) {
    if (s === null || s === undefined)
        return null;
    const str = String(s).trim();
    if (!str)
        return null;
    const digitsOnly = str
        .replace(/\s/g, '')
        .replace('R$', '')
        .replace(/^-/, '')
        .replace(/\./g, '')
        .replace(',', '.');
    if (!digitsOnly)
        return null;
    if (!/^-?\d+(\.\d+)?$/.test(digitsOnly))
        return null;
    const num = Number(digitsOnly);
    if (!Number.isFinite(num))
        return null;
    return Math.round(num * 100);
}
(async () => {
    const SQL = await (0, sql_js_1.default)();
    const dbPath = path.resolve('/var/www/html/Portal-Administrativo/data/consignado.sqlite');
    const db = new SQL.Database(fs.readFileSync(dbPath));
    const rows = db.exec(`SELECT rowid, "Valor Parcela" as vp, COL_65 as col65
     FROM "Recurso TCM"
     WHERE Copetencia = '08/2026'
       AND "Desc Finalidade" = 'CREDITO CONSIGNADO'`);
    const toFix = [];
    const firstRows = rows[0];
    if (firstRows) {
        const cols = firstRows.columns;
        for (const vals of firstRows.values) {
            const obj = {};
            for (let i = 0; i < cols.length; i += 1) {
                obj[cols[i]] = vals[i];
            }
            const rowid = Number(obj.rowid);
            const vp = String(obj.vp ?? '').trim();
            const col65 = String(obj.col65 ?? '').trim();
            const vpLooksBad = /^[0-9]+$/.test(vp) ||
                /^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*[-\/_]\d{2,4}$/i.test(vp) ||
                /^[0-9]+$/.test(vp);
            const colMoney = parseMoneyToCents(col65);
            const vpMoney = parseMoneyToCents(vp);
            if (colMoney !== null && (vpMoney === null || vpLooksBad)) {
                toFix.push({ rowid, col65 });
            }
        }
    }
    db.run('BEGIN');
    for (const fix of toFix) {
        db.run(`UPDATE "Recurso TCM" SET "Valor Parcela" = ? WHERE rowid = ?;`, [fix.col65, fix.rowid]);
    }
    db.run('COMMIT');
    const data = db.export();
    const buf = Buffer.from(data);
    fs.writeFileSync(dbPath, buf);
    console.log(`fix_count=${toFix.length}`);
    console.log(JSON.stringify(toFix.slice(0, 5), null, 2));
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=fix_tcm_credito_consignado_col65.js.map