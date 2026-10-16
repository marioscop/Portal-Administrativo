#!/usr/bin/env python3
"""juridico-xlsm-to-json.py — Converte planilha XLSM/XLSX juridico em JSON stdout (array de objs).
Uso: python3 juridico-xlsm-to-json.py "<path.xlsm>" [--password SENHA] [--sheet NOME_OU_INDICE]
Suporta colunas por PT-BR / nomes exatos HTML modelo ou camelCase (origem, data_evento, ...).
Saída JSON compacta UTF-8 via stdout. Erro detalhado via stderr + exit != 0.
"""
from __future__ import annotations
import sys, os, json, argparse, io, pathlib

PARSER_IMPORT__EXPECTED_COLUMNS_PT = [
    ("Origem", "origem"),
    ("Data", "data_evento"),
    ("Data Evento", "data_evento"),
    ("Data do Evento", "data_evento"),
    ("Autor(es)", "autores"),
    ("Autores", "autores"),
    ("Autor", "autores"),
    ("Réu(s)", "reus"),
    ("Reus", "reus"),
    ("Reu(s)", "reus"),
    ("Réu", "reus"),
    ("Contrato Sicoob", "contrato_sicoob"),
    ("Contrato", "contrato_sicoob"),
    ("Nº Processo", "numero_processo"),
    ("Nº Processo (ajuizamento)", "numero_processo"),
    ("Numero Processo", "numero_processo"),
    ("Processo", "numero_processo"),
    ("Status", "status"),
    ("Natureza", "natureza"),
    ("Valor", "valor"),
    ("Valor (R$)", "valor"),
    ("Custas", "custas_honorarios"),
    ("Custas / Honorários", "custas_honorarios"),
    ("Custas / Honorários (R$)", "custas_honorarios"),
    ("Custas e Honorários", "custas_honorarios"),
    ("Observações", "observacoes"),
    ("Observacao", "observacoes"),
    ("Obs", "observacoes"),
]


def decrypt_if_needed(src: pathlib.Path, password: str | None) -> io.BytesIO | None:
    """Retorna BytesIO descriptografado (se for CDFV2 encrypted) ou None se não criptografado."""
    raw = src.read_bytes()
    # Assinatura MS-CFB: D0 CF 11 E0
    if raw[:4] == b"\xd0\xcf\x11\xe0":
        # Detecta DataSpaces/DRM (Microsoft RMS/MIP): streams [0x05]DataSpaces/DRMEncryptedDataSpace
        try:
            import olefile
            if olefile.isOleFile(raw):
                ole = olefile.OleFileIO(io.BytesIO(raw))
                has_drm = any(
                    (len(s) >= 2 and s[0] == "DataSpaces") or
                    (len(s) == 1 and s[0] == "EncryptedPackage" and ole.get_size(s) > 100000)
                    for s in ole.listdir()
                )
                try: ole.close()
                except: pass
                if has_drm:
                    print(
                        "ERRO: XLSM criptografado com DRM/Microsoft Information Protection (RMS DataSpaces). "
                        "Este formato usa chaves assimétricas de domínio e NÃO é descriptografável com senha de usuário. "
                        "Soluções: (1) abra no Excel autenticado com a conta Juriscred e salve como .xlsx sem proteção; "
                        "(2) exporte a planilha para CSV (dados); (3) forneça o arquivo .xlsx sem criptografia.",
                        file=sys.stderr,
                    )
                    sys.exit(9)
        except Exception as _e:
            pass
        try:
            import msoffcrypto
        except Exception as e:
            print(f"ERRO: arquivo CDFV2 mas msoffcrypto-tool não importado: {e}", file=sys.stderr)
            sys.exit(4)
        bio = io.BytesIO(raw)
        try:
            of = msoffcrypto.OfficeFile(bio)
        except Exception as e:
            print(
                f"ERRO: CDFV2 mas msoffcrypto não reconheceu como Office (DRM?). Detalhe: {e}. "
                "Abra no Excel autenticado e salve como .xlsx sem proteção.",
                file=sys.stderr,
            )
            sys.exit(10)
        if of.is_encrypted():
            if password is None:
                print("ERRO: XLSM criptografado com senha de usuário. Forneça --password SENHA.", file=sys.stderr)
                sys.exit(5)
            of.load_key(password=password)
            out = io.BytesIO()
            try:
                of.decrypt(out)
            except Exception as e:
                print(f"ERRO: descriptografia falhou (senha incorreta): {e}", file=sys.stderr)
                sys.exit(6)
            out.seek(0)
            return out
        else:
            # CDFV2 mas não criptografado; openpyxl lê xlsm diretamente
            return None
    return None


def load_workbook(path_or_buf):
    try:
        import openpyxl
    except Exception as e:
        print(f"ERRO: openpyxl não disponível: {e}", file=sys.stderr)
        sys.exit(7)
    return openpyxl.load_workbook(path_or_buf, data_only=True, read_only=True, keep_vba=True)


def normalize_header(s: str | None) -> str:
    if s is None: return ""
    return " ".join(str(s).strip().split())


def map_headers(header_row: list):
    mapa: dict[int, str] = {}
    for idx, cel in enumerate(header_row):
        h = normalize_header(cel)
        if not h: continue
        encontrado = None
        for (rotulo_pt, chave) in PARSER_IMPORT__EXPECTED_COLUMNS_PT:
            if rotulo_pt.lower() == h.lower() or normalize_header(chave).lower() == h.lower():
                encontrado = chave
                break
        if encontrado is None:
            # fallback slugify
            slug = h.lower()\
                .replace("ã", "a").replace("õ", "o").replace("á", "a").replace("à", "a")\
                .replace("â", "a").replace("ê", "e").replace("é", "e").replace("í", "i")\
                .replace("ó", "o").replace("ô", "o").replace("ú", "u").replace("ç", "c")\
                .replace("(", "").replace(")", "").replace("/", "").replace("  ", " ").strip()\
                .replace(" ", "_").replace("nº", "numero").replace("°", "")
            encontrado = slug
        mapa[idx] = encontrado
    return mapa


def sheet_to_rows(wb, sheet_ref):
    if isinstance(sheet_ref, int):
        ws = wb.worksheets[sheet_ref]
    else:
        ws = wb[sheet_ref]
    rows_iter = ws.iter_rows(values_only=True)
    header = None
    out = []
    for row in rows_iter:
        if row is None: continue
        cells = list(row)
        if all((c is None or str(c).strip() == "") for c in cells):
            continue
        if header is None:
            header = cells
            mapa = map_headers(header)
            continue
        obj: dict = {}
        for idx, val in enumerate(cells):
            chave = mapa.get(idx)
            if chave is None: continue
            if val is None: continue
            if hasattr(val, "isoformat"):
                obj[chave] = val.date().isoformat() if hasattr(val, "date") else val.isoformat()
            else:
                obj[chave] = val
        if obj: out.append(obj)
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--password", default=None)
    ap.add_argument("--sheet", default=None, help="Nome ou índice (0-based) da sheet. Padrão=primeira.")
    args = ap.parse_args(argv)
    src = pathlib.Path(args.path)
    if not src.exists():
        print(f"ERRO: arquivo não existe: {src}", file=sys.stderr)
        return 2
    decrypted = decrypt_if_needed(src, args.password)
    try:
        if decrypted is not None:
            wb = load_workbook(decrypted)
        else:
            wb = load_workbook(str(src))
    except Exception as e:
        print(f"ERRO: openpyxl.load_workbook falhou: {e}", file=sys.stderr)
        return 3
    try:
        sheet_ref = 0
        if args.sheet is not None:
            try: sheet_ref = int(args.sheet)
            except: sheet_ref = args.sheet
        rows = sheet_to_rows(wb, sheet_ref)
    finally:
        try: wb.close()
        except: pass
    out = {
        "arquivo": str(src),
        "sheets": [ws.title for ws in wb.worksheets] if decrypted is None else None,
        "total_linhas": len(rows),
        "colunas_detectadas": sorted({k for r in rows for k in r.keys()}),
        "linhas": rows,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
