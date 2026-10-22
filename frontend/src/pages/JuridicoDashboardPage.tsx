import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  Gavel, Home, LogOut, Settings, ChevronDown,
  FilterX, Download, SquarePlus, Pencil, Trash2, X, Save, Plus, Minus,
  Database, Users, Search, Bell, MailPlus, CheckCircle2, AlertTriangle,
  Timer, Hourglass, CalendarDays, Briefcase, BarChart3, Info,
  ShieldAlert, ShieldCheck, CircleDollarSign,
  Activity, Clock4, TrendingUp, TrendingDown, Target, Layers, FileSearch,
  Scale, AlertOctagon, BadgeAlert, BadgeCheck, PieChart,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
} from 'lucide-react';

const FIXED_ADMIN_EMAIL = 'mario.junior@sicoobjuriscred.com.br';
const BACKEND_PREFIX = '/api/juridico';
const GERENTE_PA_OPTIONS = ['PA-3348-00', 'PA-3348-01', 'PA-3348-03'] as const;

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo.'));
  reader.readAsDataURL(blob);
});

function brl(n: any): string {
  try {
    const v = typeof n === 'number' ? n : parseFloat(String(n ?? '0').replace(/\./g, '').replace(',', '.'));
    if (!isFinite(v)) return 'R$ 0,00';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return 'R$ 0,00';
  }
}

function monthLabel(m: number): string {
  return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] ?? String(m);
}

function _pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function _todayBr(): string {
  const d = new Date();
  return `${_pad2(d.getDate())}/${_pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function _applyDateMask(v: string): string {
  const digits = String(v ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

interface JuridicoDateInputProps {
  label: string;
  value: string;
  onChange: (valorFormatadoDdMmYyyy: string) => void;
  onAfterChange?: (novoValorDdMmYyyy: string) => void;
  placeholder?: string;
}
const _NOMES_MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const _DIAS_SEMANA_PTBR = ['D','S','T','Q','Q','S','S'];
const _JURIDICO_DATE_INP: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '10px 42px 10px 13px',
  borderRadius: 10,
  border: '1.5px solid rgba(0,54,65,0.12)',
  background: '#FFFFFF',
  color: '#003641',
  fontSize: 14,
  outline: 'none',
  fontFamily: "'JetBrains Mono','Fira Code',ui-monospace,monospace",
  letterSpacing: 0.06,
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
};
const JuridicoDateInput: React.FC<JuridicoDateInputProps> = ({ label, value, onChange, onAfterChange, placeholder = 'dd/mm/aaaa' }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mesVisual, setMesVisual] = useState<Date>(() => {
    const d = _parsePtBrDate(value);
    return d ?? new Date();
  });
  const [hoverBtn, setHoverBtn] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = _parsePtBrDate(value);
    if (d) setMesVisual(d);
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);
  const ano = mesVisual.getFullYear();
  const mesIdx = mesVisual.getMonth();
  const primeiroDiaMes = new Date(ano, mesIdx, 1);
  const ultimoDiaMes = new Date(ano, mesIdx + 1, 0);
  const diasNoMes = ultimoDiaMes.getDate();
  const dowPrimeiro = (primeiroDiaMes.getDay() + 0) % 7;
  const ultimoDiaMesAnterior = new Date(ano, mesIdx, 0).getDate();
  const cells: Array<{ dia: number; mes: number; ano: number; fora: boolean }> = [];
  for (let i = dowPrimeiro - 1; i >= 0; i--) {
    const d = ultimoDiaMesAnterior - i;
    const mesAnt = mesIdx === 0 ? 11 : mesIdx - 1;
    const anoAnt = mesIdx === 0 ? ano - 1 : ano;
    cells.push({ dia: d, mes: mesAnt, ano: anoAnt, fora: true });
  }
  for (let d = 1; d <= diasNoMes; d++) cells.push({ dia: d, mes: mesIdx, ano, fora: false });
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const idx = cells.length - (dowPrimeiro + diasNoMes);
    const d = idx + 1;
    const mesProx = mesIdx === 11 ? 0 : mesIdx + 1;
    const anoProx = mesIdx === 11 ? ano + 1 : ano;
    cells.push({ dia: d, mes: mesProx, ano: anoProx, fora: true });
    if (cells.length >= 42) break;
  }
  const sel = _parsePtBrDate(value);
  const hojeDate = new Date();
  const hojeD = hojeDate.getDate(), hojeM = hojeDate.getMonth(), hojeA = hojeDate.getFullYear();
  const mudarMes = (delta: number) => setMesVisual(new Date(ano, mesIdx + delta, 1));
  const mudarAno = (delta: number) => setMesVisual(new Date(ano + delta, mesIdx, 1));
  const selecionarDia = (c: { dia: number; mes: number; ano: number }) => {
    const br = _applyDateMask(`${_pad2(c.dia)}/${_pad2(c.mes + 1)}/${c.ano}`);
    onChange(br);
    onAfterChange?.(br);
    setOpen(false);
  };
  const _btnNavStyle = (active: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 7,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(0,54,65,0.10)',
    background: active ? 'rgba(0,174,157,0.10)' : '#FFFFFF',
    color: '#003641', cursor: 'pointer', padding: 0, lineHeight: 0,
  });
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={{
        fontSize: 11, letterSpacing: 0.06, fontWeight: 750,
        color: '#003641', opacity: 0.72, marginBottom: 4, display: 'block',
        textTransform: 'uppercase',
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="numeric" maxLength={10} placeholder={placeholder}
          style={_JURIDICO_DATE_INP}
          value={value ?? ''}
          onChange={e => {
            const masc = _applyDateMask(e.target.value);
            onChange(masc);
          }}
          onBlur={() => {
            if (value) onAfterChange?.(value);
          }}
        />
        <button
          type="button" title="Abrir calendário"
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setHoverBtn(true)}
          onMouseLeave={() => setHoverBtn(false)}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 30, height: 30, borderRadius: 8,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: hoverBtn ? 'rgba(0,174,157,0.15)' : 'rgba(0,174,157,0.08)',
            border: '1px solid rgba(0,174,157,0.22)',
            color: '#0B8077', cursor: 'pointer', padding: 0, lineHeight: 0,
            transition: 'background 140ms ease',
          }}>
          <CalendarDays size={15} strokeWidth={2.1} />
        </button>
      </div>
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 300,
            padding: 14,
            borderRadius: 14,
            background: '#FFFFFF',
            border: '1.5px solid rgba(0,54,65,0.10)',
            boxShadow: '0 18px 46px rgba(0,54,65,0.18), 0 4px 12px rgba(0,174,157,0.08)',
            zIndex: 999,
            userSelect: 'none',
          }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
            marginBottom: 12,
          }}>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              <button type="button" onClick={() => mudarAno(-1)} style={_btnNavStyle(false)} title="Ano anterior">
                <ChevronsLeft size={15} strokeWidth={2.2} />
              </button>
              <button type="button" onClick={() => mudarMes(-1)} style={_btnNavStyle(false)} title="Mês anterior">
                <ChevronLeft size={15} strokeWidth={2.2} />
              </button>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, letterSpacing: 0.04,
              color: '#003641', textAlign: 'center', flex: 1,
            }}>
              {_NOMES_MESES_FULL[mesIdx]} {ano}
            </div>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              <button type="button" onClick={() => mudarMes(1)} style={_btnNavStyle(false)} title="Próximo mês">
                <ChevronRight size={15} strokeWidth={2.2} />
              </button>
              <button type="button" onClick={() => mudarAno(1)} style={_btnNavStyle(false)} title="Próximo ano">
                <ChevronsRight size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
            gap: 2, marginBottom: 6,
          }}>
            {_DIAS_SEMANA_PTBR.map((d, i) => (
              <div key={`dw-${i}`} style={{
                textAlign: 'center',
                fontSize: 10.5, fontWeight: 800, letterSpacing: 0.06,
                color: i === 0 || i === 6 ? '#D64340' : '#003641',
                opacity: 0.62,
                padding: '4px 0',
              }}>{d}</div>
            ))}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
            gap: 2, marginBottom: 10,
          }}>
            {cells.map((c, i) => {
              const isHoje = !c.fora && c.dia === hojeD && c.mes === hojeM && c.ano === hojeA;
              const isSel = !!sel && sel.getFullYear() === c.ano && sel.getMonth() === c.mes && sel.getDate() === c.dia;
              const isFimSemana = new Date(c.ano, c.mes, c.dia).getDay() % 6 === 0;
              return (
                <button
                  key={`dc-${i}-${c.dia}-${c.mes}-${c.ano}`}
                  type="button"
                  onClick={() => selecionarDia(c)}
                  style={{
                    aspectRatio: '1 / 1',
                    border: isSel
                      ? '1.5px solid #003641'
                      : isHoje
                        ? '1.5px solid #00AE9D'
                        : '1px solid transparent',
                    borderRadius: 9,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12.5,
                    fontWeight: isSel ? 800 : isHoje ? 750 : 550,
                    fontFamily: "'JetBrains Mono','Fira Code',ui-monospace,monospace",
                    background: isSel
                      ? 'linear-gradient(135deg,#003641,#004B5A)'
                      : isHoje
                        ? 'rgba(0,174,157,0.10)'
                        : 'transparent',
                    color: isSel
                      ? '#FFFFFF'
                      : c.fora
                        ? (isFimSemana ? 'rgba(214,67,64,0.35)' : 'rgba(0,54,65,0.32)')
                        : (isFimSemana ? '#D64340' : '#003641'),
                    cursor: 'pointer', padding: 0, lineHeight: 0,
                    transition: 'background 120ms ease, transform 120ms ease',
                  }}
                  onMouseEnter={(e: any) => {
                    if (!isSel) e.currentTarget.style.background = 'rgba(0,174,157,0.10)';
                  }}
                  onMouseLeave={(e: any) => {
                    if (!isSel) e.currentTarget.style.background = isHoje ? 'rgba(0,174,157,0.10)' : 'transparent';
                  }}
                >{c.dia}</button>
              );
            })}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            paddingTop: 8, borderTop: '1px solid rgba(0,54,65,0.08)',
          }}>
            <button
              type="button"
              onClick={() => { onChange(''); onAfterChange?.(''); setOpen(false); }}
              style={{
                padding: '6px 12px', borderRadius: 8,
                border: '1px solid rgba(214,67,64,0.22)',
                background: 'rgba(240,82,101,0.06)',
                color: '#D64340', fontSize: 11.5, fontWeight: 750, letterSpacing: 0.04,
                cursor: 'pointer',
              }}>Limpar</button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                const br = _applyDateMask(`${_pad2(d.getDate())}/${_pad2(d.getMonth() + 1)}/${d.getFullYear()}`);
                onChange(br); onAfterChange?.(br); setOpen(false);
              }}
              style={{
                padding: '6px 12px', borderRadius: 8,
                border: '1px solid rgba(0,174,157,0.28)',
                background: 'rgba(0,174,157,0.10)',
                color: '#0B8077', fontSize: 11.5, fontWeight: 800, letterSpacing: 0.04,
                cursor: 'pointer',
              }}>Hoje</button>
          </div>
        </div>
      )}
    </div>
  );
};

const JURISCRED_CNPJ = '09.552.111/0001-85';
function _autoFillJuriscredCnpjOnNome(formCur: any, parte: 'autor' | 'reu', index: number, nextNome: string): any {
  const nomeKey = `${parte}_${index}_nome`;
  const docKey = `${parte}_${index}_cpf_cnpj`;
  const raw = String(nextNome ?? '').trim();
  const normalizedNome = /^juriscred\s*celg$/i.test(raw) ? 'JURISCRED' : nextNome;
  const next = { ...formCur, [nomeKey]: normalizedNome };
  const normalizedRaw = String(normalizedNome ?? '').trim();
  if (normalizedRaw && normalizedRaw.toUpperCase() === 'JURISCRED') {
    next[docKey] = JURISCRED_CNPJ;
  }
  return next;
}
function _parsePtBrDate(v: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (
    d.getFullYear() !== Number(m[3]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[1])
  ) return null;
  return d;
}
function _addCalendarDaysPtBr(dateBr: string, dias: number): string {
  const d = _parsePtBrDate(dateBr);
  if (!d || !Number.isFinite(dias) || dias < 0) return '';
  d.setDate(d.getDate() + dias);
  return `${_pad2(d.getDate())}/${_pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function _autoCalcDataLimiteAjuizamento(formCur: any, prazoAjuizamentoDias: number): any {
  const dataEvento = String((formCur as any).data_evento ?? '').trim();
  const dataDist = String((formCur as any).data_distribuicao_ajuizamento ?? '').trim();
  const baseData = dataEvento || dataDist;
  if (!baseData) return formCur;
  const dataLim = _addCalendarDaysPtBr(baseData, Math.max(0, Math.floor(prazoAjuizamentoDias || 0)));
  if (!dataLim) return formCur;
  if (String((formCur as any).data_limite_ajuizamento ?? '').trim() === dataLim) return formCur;
  return { ...formCur, data_limite_ajuizamento: dataLim };
}
function _dateBrToIso(v: string): string {
  const m = String(v ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function _dateIsoToBr(v: string): string {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

interface JuridicoRow {
  id: string | number;
  origem?: string;
  data?: string;
  autor?: string;
  reu?: string;
  contrato?: string;
  processo?: string;
  status?: string;
  natureza?: string;
  valor?: number;
  custas?: number;
  [k: string]: any;
}

interface KpiTrend {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  good?: boolean;
  variant?: 'hi' | 'al' | 'gold' | 'navy' | 'def' | 'gray';
}

type TipoAcoesColumnKey = 'origem' | 'autor' | 'reu' | 'contrato' | 'processo' | 'status' | 'natureza' | 'valor';
type TipoAcoesColumnWidths = Record<TipoAcoesColumnKey, number>;

const DEFAULT_TIPO_ACOES_COLUMN_WIDTHS: TipoAcoesColumnWidths = {
  origem: 148,
  autor: 128,
  reu: 248,
  contrato: 126,
  processo: 192,
  status: 168,
  natureza: 162,
  valor: 118,
};

const MIN_TIPO_ACOES_COLUMN_WIDTHS: TipoAcoesColumnWidths = {
  origem: 120,
  autor: 110,
  reu: 140,
  contrato: 110,
  processo: 160,
  status: 140,
  natureza: 142,
  valor: 100,
};

const TIPO_ACOES_DEFAULT_WIDTH_TOTAL = Object.values(DEFAULT_TIPO_ACOES_COLUMN_WIDTHS)
  .reduce((sum, width) => sum + width, 0);

function normalizeTipoAcoesColumnWidths(raw: any): TipoAcoesColumnWidths {
  const src = raw && typeof raw === 'object' ? raw : {};
  const clamp = (key: TipoAcoesColumnKey) => {
    const n = Math.round(Number(src[key]));
    if (!Number.isFinite(n)) return DEFAULT_TIPO_ACOES_COLUMN_WIDTHS[key];
    return Math.max(MIN_TIPO_ACOES_COLUMN_WIDTHS[key], Math.min(420, n));
  };
  return {
    origem: clamp('origem'),
    autor: clamp('autor'),
    reu: clamp('reu'),
    contrato: clamp('contrato'),
    processo: clamp('processo'),
    status: clamp('status'),
    natureza: clamp('natureza'),
    valor: clamp('valor'),
  };
}

function mapApiRowToGridRow(r: any): JuridicoRow {
  const coalesceNome = (chaves: string[]): string => {
    for (const c of chaves) {
      const v = r?.[c];
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return '';
  };
  const getConcatAutores = (): string => {
    const concat = (r?.autores ?? '');
    if (concat) return String(concat);
    const partes: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const n = r?.[`autor_${i}_nome`];
      if (n != null && String(n).trim() !== '') partes.push(String(n));
    }
    return partes.join('; ');
  };
  const getConcatReus = (): string => {
    const concat = (r?.reus ?? '');
    if (concat) return String(concat);
    const partes: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const n = r?.[`reu_${i}_nome`];
      if (n != null && String(n).trim() !== '') partes.push(String(n));
    }
    return partes.join('; ');
  };
  const valorNum = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const concatAutores = getConcatAutores();
  const concatReus = getConcatReus();
  const out: JuridicoRow = {
    ...(r as any),
    autor: concatAutores || coalesceNome(['autor_1_nome', 'autor']),
    reu: concatReus || coalesceNome(['reus', 'reu_1_nome', 'reu']),
    contrato: coalesceNome(['numero_contrato_sicoob', 'contrato_sicoob', 'contrato']),
    processo: coalesceNome(['numero_processo_ajuizamento', 'numero_processo', 'processo']),
    data: coalesceNome([
      'data_distribuicao_ajuizamento', 'data_evento', 'data_recebimento_cobranca_extrajudicial',
      'data_protocolizacao_cartorio_extrajudicial', 'created_at', 'data',
    ]),
    status: coalesceNome(['status', 'status_ultimo_andamento_ajuizamento', 'status_extrajudicial']),
    natureza: coalesceNome(['natureza']),
    valor: valorNum(r?.valor_dado_causa_ajuizamento ?? r?.valor ?? r?.valor_estimado_perda_ajuizamento ?? 0),
    custas: valorNum(
      (r?.custas_honorarios ?? 0)
      + (r?.custas_processuais_extrajudiciais ?? 0)
      + (r?.honorarios_realizados ?? 0)
    ),
  };
  if (!out.autor) out.autor = concatAutores;
  if (!out.reu) out.reu = concatReus;
  return out;
}

const JuridicoDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentView = useMemo<'home'|'dashboard-executivo'|'configuracoes-automacao'|'configuracoes-acessos'>(() => {
    const p = location.pathname.toLowerCase();
    if (p.endsWith('/automacao') || p.endsWith('/automacao/')) return 'configuracoes-automacao';
    if (p.endsWith('/acessos') || p.endsWith('/acessos/')) return 'configuracoes-acessos';
    if (p.endsWith('/executivo') || p.endsWith('/executivo/')) return 'dashboard-executivo';
    const hv = (window.location.hash || '#home').replace(/^#/, '') || 'home';
    if (hv === 'configuracoes-automacao') return 'configuracoes-automacao';
    if (hv === 'configuracoes-acessos') return 'configuracoes-acessos';
    if (hv === 'dashboard-executivo') return 'dashboard-executivo';
    return 'home';
  }, [location.pathname]);

  const showSettingsNav = currentView !== 'home' && currentView !== 'dashboard-executivo';

  const [rows, setRows] = useState<JuridicoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState<string>('');
  const [mes, setMes] = useState<string>('');
  const [chartHoverMonth, setChartHoverMonth] = useState<number | null>(null);
  const [chartLegendHover, setChartLegendHover] = useState<'passivo' | 'ativo' | 'acordos' | 'mm3' | null>(null);
  const juridicoChartRef = useRef<ReactECharts | null>(null);
  const [origem, setOrigem] = useState<string>('');
  const [nome, setNome] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [natureza, setNatureza] = useState<string>('');
  const [lacunasFiltro, setLacunasFiltro] = useState<string[]>([]);
  const [showCamposBranco, setShowCamposBranco] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const clearChartSeriesHover = useCallback(() => {
    setChartHoverMonth(null);
    const chart = juridicoChartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    try {
      chart.dispatchAction({ type: 'hideTip' });
      chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' } as any);
      chart.dispatchAction({ type: 'downplay' } as any);
    } catch {
      // Ignore transient chart teardown timing during rerenders.
    }
  }, []);

  const clearChartInteractionState = useCallback(() => {
    setChartHoverMonth(null);
    setChartLegendHover(null);
  }, []);

  /* CAMPOS LACUNAS (mesmos do Score Saúde — manter coerência operacional ↔ executivo) */
  const LACUNA_CAMPOS: { key: string; label: string; weight: number; check: (r: JuridicoRow) => boolean; cor: string }[] = [
    { key: 'gerente',   label: 'Gerente Responsável',     weight: 1.2, cor: '#D64340', check: r => !(r.gerente !== null && r.gerente !== undefined && String(r.gerente).trim().length > 0) },
    { key: 'pa_env',    label: 'Nº PA Enviados',          weight: 0.8, cor: '#D64340', check: r => !(r.numero_pa_enviados_ajuizamento !== null && r.numero_pa_enviados_ajuizamento !== undefined && String(r.numero_pa_enviados_ajuizamento).trim().length > 0) },
    { key: 'natureza',  label: 'Natureza (Ativo/Passivo)', weight: 2.5, cor: '#FB8C00', check: r => !(r.natureza !== null && r.natureza !== undefined && String(r.natureza).trim().length > 0) },
    { key: 'tipo_acao', label: 'Tipo Ação (ajuizamento)', weight: 2.0, cor: '#FB8C00', check: r => !(r.tipo_acao_ajuizamento !== null && r.tipo_acao_ajuizamento !== undefined && String(r.tipo_acao_ajuizamento).trim().length > 0) },
    { key: 'contrato',  label: 'Nº Contrato Sicoob',      weight: 1.0, cor: '#FB8C00', check: r => {
      const ok = (r.numero_contrato_sicoob !== null && r.numero_contrato_sicoob !== undefined && String(r.numero_contrato_sicoob).trim().length > 0)
              || (r.contrato_sicoob !== null && r.contrato_sicoob !== undefined && String(r.contrato_sicoob).trim().length > 0)
              || (r.contrato !== null && r.contrato !== undefined && String(r.contrato).trim().length > 0);
      return !ok;
    } },
    { key: 'valor',     label: 'Valor da Causa',          weight: 1.8, cor: '#FB8C00', check: r => {
      const asNum = (v: any) => { const n = Number(v); return isFinite(n) ? n : 0; };
      const ok = asNum(r.valor) > 0 || asNum(r.valor_dado_causa_ajuizamento) > 0;
      return !ok;
    } },
    { key: 'status',    label: 'Status Processual',       weight: 2.5, cor: '#FB8C00', check: r => !(r.status !== null && r.status !== undefined && String(r.status).trim().length > 0) },
    { key: 'proc_aju',  label: 'Nº Processo',             weight: 1.6, cor: '#FB8C00', check: r => {
      const ok = (r.numero_processo_ajuizamento !== null && r.numero_processo_ajuizamento !== undefined && String(r.numero_processo_ajuizamento).trim().length > 0)
              || (r.numero_processo !== null && r.numero_processo !== undefined && String(r.numero_processo).trim().length > 0)
              || (r.processo !== null && r.processo !== undefined && String(r.processo).trim().length > 0);
      return !ok;
    } },
    { key: 'data_dist', label: 'Data Distribuição',       weight: 1.4, cor: '#FB8C00', check: r => {
      const ok = (r.data_distribuicao_ajuizamento !== null && r.data_distribuicao_ajuizamento !== undefined && String(r.data_distribuicao_ajuizamento).trim().length > 0)
              || (r.data_evento !== null && r.data_evento !== undefined && String(r.data_evento).trim().length > 0)
              || (r.data !== null && r.data !== undefined && String(r.data).trim().length > 0);
      return !ok;
    } },
    { key: 'autor',     label: 'Autor(es)',               weight: 1.2, cor: '#00AE9D', check: r => {
      const ok = (r.autor_1_nome !== null && r.autor_1_nome !== undefined && String(r.autor_1_nome).trim().length > 0)
              || (r.autores !== null && r.autores !== undefined && String(r.autores).trim().length > 0)
              || (r.autor !== null && r.autor !== undefined && String(r.autor).trim().length > 0);
      return !ok;
    } },
    { key: 'reu',       label: 'Réu(s)',                  weight: 1.2, cor: '#00AE9D', check: r => {
      const ok = (r.reu_1_nome !== null && r.reu_1_nome !== undefined && String(r.reu_1_nome).trim().length > 0)
              || (r.reus !== null && r.reus !== undefined && String(r.reus).trim().length > 0)
              || (r.reu !== null && r.reu !== undefined && String(r.reu).trim().length > 0);
      return !ok;
    } },
  ];

  /* =========================================================
   * DASHBOARD EXECUTIVO: Cálculos em memória (base rows pura)
   * ========================================================= */
  const execStats = useMemo(() => {
    type R = JuridicoRow;
    const T = rows.length;
    const asNum = (v: any) => { const n = Number(v); return isFinite(n) ? n : 0; };
    const nonEmpty = (v: any) => v !== null && v !== undefined && String(v).trim().length > 0;

    // KPIs financeiros / gerais
    const total = T;
    const valorTotal = rows.reduce((s, r) => s + asNum(r.valor), 0);
    const ticketMedio = T > 0 ? valorTotal / T : 0;
    const totalCustasHonorarios = rows.reduce((s, r) => s + asNum(r.custas_honorarios) + asNum(r.honorarios_realizados), 0);
    const totalHonorariosRealizados = rows.reduce((s, r) => s + asNum(r.honorarios_realizados), 0);
    const totalCustasProcExtraj = rows.reduce((s, r) => s + asNum(r.custas_processuais_extrajudiciais), 0);
    const valorDadoCausaTotal = rows.reduce((s, r) => s + asNum(r.valor_dado_causa_ajuizamento), 0);
    const perdaEstimadaTotal = rows.reduce((s, r) => s + asNum(r.valor_estimado_perda_ajuizamento), 0);

    // Esperança matemática: probabilidade * valor (se ambos existirem)
    let espGanho = 0, espPerda = 0, cntEsp = 0;
    for (const r of rows) {
      const pg = asNum(r.probabilidade_ganho_ajuizamento);
      const pp = asNum(r.probabilidade_perda_ajuizamento);
      const v = asNum(r.valor_dado_causa_ajuizamento) || asNum(r.valor);
      if (v > 0) {
        if (pg > 0) { espGanho += pg * v; cntEsp++; }
        if (pp > 0) espPerda += pp * v;
      }
    }
    const probGanhoAvg = rows.length ? rows.reduce((s, r) => s + asNum(r.probabilidade_ganho_ajuizamento), 0) / rows.length : 0;
    const probPerdaAvg = rows.length ? rows.reduce((s, r) => s + asNum(r.probabilidade_perda_ajuizamento), 0) / rows.length : 0;

    /* -------- SAUDE DA BASE: 12 campos-chave -------- */
    const healthFields: { key: string; label: string; weight: number; check: (r: R) => boolean }[] = [
      { key: 'natureza',  label: 'Natureza (Ativo/Passivo)', weight: 2.5, check: r => nonEmpty(r.natureza) },
      { key: 'status',    label: 'Status Processual',       weight: 2.5, check: r => nonEmpty(r.status) },
      { key: 'tipo_acao', label: 'Tipo Ação (ajuizamento)', weight: 2.0, check: r => nonEmpty(r.tipo_acao_ajuizamento) },
      { key: 'valor',     label: 'Valor da Causa',          weight: 1.8, check: r => asNum(r.valor) > 0 || asNum(r.valor_dado_causa_ajuizamento) > 0 },
      { key: 'proc_aju',  label: 'Nº Processo Ajuizamento', weight: 1.6, check: r => nonEmpty(r.numero_processo_ajuizamento) || nonEmpty(r.numero_processo) },
      { key: 'data_dist', label: 'Data Distribuição',       weight: 1.4, check: r => nonEmpty(r.data_distribuicao_ajuizamento) || nonEmpty(r.data_evento) },
      { key: 'gerente',   label: 'Gerente Responsável',     weight: 1.2, check: r => nonEmpty(r.gerente) },
      { key: 'autor',     label: 'Autor(es) Nome(s)',       weight: 1.2, check: r => nonEmpty(r.autor_1_nome) || nonEmpty(r.autores) },
      { key: 'reu',       label: 'Réu(s) Nome(s)',          weight: 1.2, check: r => nonEmpty(r.reu_1_nome) || nonEmpty(r.reus) },
      { key: 'contrato',  label: 'Nº Contrato Sicoob',      weight: 1.0, check: r => nonEmpty(r.numero_contrato_sicoob) || nonEmpty(r.contrato_sicoob) },
      { key: 'pa',        label: 'Nº PA Enviados',          weight: 0.8, check: r => nonEmpty(r.numero_pa_enviados_ajuizamento) },
    ];
    const W_TOTAL = healthFields.reduce((s, f) => s + f.weight, 0);
    let scorePonderado = 0;
    const healthPerField = healthFields.map(f => {
      let c = 0; for (const r of rows) if (f.check(r)) c++;
      const pct = T ? c / T : 0;
      scorePonderado += (f.weight / W_TOTAL) * pct;
      return { key: f.key, label: f.label, weight: f.weight, filled: c, missing: T - c, pct };
    });
    const scorePct = scorePonderado * 100;

    /* -------- CLASSIFICAÇÃO DO SCORE -------- */
    let scoreBand: 'critico' | 'ruim' | 'medio' | 'bom' | 'excelente' = 'excelente';
    let scoreBandColor = '#7DB61C';
    let scoreBandBg = 'rgba(125,182,28,0.12)';
    let scoreBandLabel = 'Excelente';
    if (scorePct < 33)      { scoreBand='critico';  scoreBandColor='#D64340'; scoreBandBg='rgba(214,67,64,0.14)'; scoreBandLabel='Crítico'; }
    else if (scorePct < 66) { scoreBand='medio';    scoreBandColor='#FB8C00'; scoreBandBg='rgba(251,140,0,0.12)'; scoreBandLabel='Mediano'; }
    else if (scorePct < 88) { scoreBand='bom';      scoreBandColor='#00AE9D'; scoreBandBg='rgba(0,174,157,0.12)'; scoreBandLabel='Bom'; }

    /* -------- PRAZOS: regras 15 dias (Extraj. protocolo) e 45 dias (Ajuizamento) -------- */
    const todayJd = Math.floor((Date.now()/86400000) + 2440587.5);
    const diasDesde = (iso: any) => {
      if (!iso || !String(iso).length) return -1;
      const s = String(iso).slice(0,19).replace('T',' ').replace(/\//g,'-');
      const d = new Date(s.replace(/-/g,'/'));
      if (!isFinite(+d)) return -1;
      const dJd = Math.floor((+d/86400000) + 2440587.5);
      return todayJd - dJd;
    };
    const extrajRows = rows.filter(r => String(r.origem||'').toLowerCase() === 'extrajudicial');
    const naoExtrajRows = rows.filter(r => String(r.origem||'').toLowerCase() !== 'extrajudicial');
    const prazos = {
      protocoloExtrajudicial: {
        prazoDias: 15,
        total: extrajRows.length,
        semProtocolo: extrajRows.filter(r => !nonEmpty(r.numero_protocolo_cartorio_extrajudicial)).length,
        semDataLimite: extrajRows.filter(r => !nonEmpty(r.data_limite_protocolar_extrajudicial) && nonEmpty(r.status_extrajudicial)).length,
        atrasadosAindaSem: extrajRows.filter(r => {
          if (nonEmpty(r.numero_protocolo_cartorio_extrajudicial)) return false;
          const d = diasDesde(r.data_evento); return d > 15;
        }).length,
        diasMedioSem: Math.round(extrajRows.filter(r => !nonEmpty(r.numero_protocolo_cartorio_extrajudicial)).reduce((s,r)=> s + Math.max(0, diasDesde(r.data_evento||'')),0) / Math.max(1, extrajRows.filter(r => !nonEmpty(r.numero_protocolo_cartorio_extrajudicial)).length)),
      },
      ajuizamento: {
        prazoDias: 45,
        total: naoExtrajRows.length,
        semProcesso: naoExtrajRows.filter(r => !nonEmpty(r.numero_processo_ajuizamento) && !nonEmpty(r.numero_processo)).length,
        semDistribuicao: naoExtrajRows.filter(r => nonEmpty(r.numero_processo_ajuizamento) && !nonEmpty(r.data_distribuicao_ajuizamento)).length,
        atrasadosAindaSem: naoExtrajRows.filter(r => {
          if (nonEmpty(r.numero_processo_ajuizamento) || nonEmpty(r.numero_processo)) return false;
          const d = diasDesde(r.data_evento); return d > 45;
        }).length,
        diasMedioSem: Math.round(naoExtrajRows.filter(r => !nonEmpty(r.numero_processo_ajuizamento) && !nonEmpty(r.numero_processo)).reduce((s,r)=> s + Math.max(0, diasDesde(r.data_evento||'')),0) / Math.max(1, naoExtrajRows.filter(r => !nonEmpty(r.numero_processo_ajuizamento) && !nonEmpty(r.numero_processo)).length)),
      },
    };

    /* -------- AGREGADOS PARA GRÁFICOS -------- */
    const cnt = <K extends string>(m: Record<K, {n:number; v:number}>, k: K, v: number) => {
      if (!m[k]) m[k] = { n:0, v:0 };
      m[k].n++; m[k].v += asNum(v);
    };
    const aggNatureza: Record<string,{n:number;v:number}> = {};
    for (const r of rows) {
      let k = (r.natureza||'').trim() || 'Sem Natureza';
      if (!['Ativo','Passivo'].includes(k)) {
        if (String(r.origem||'').toLowerCase() === 'extrajudicial') k = 'Extrajudicial';
        else k = 'Sem Natureza';
      }
      cnt(aggNatureza, k as any, (r.valor||0) as any);
    }
    const aggOrigem: Record<string,{n:number;v:number}> = {};
    for (const r of rows) cnt(aggOrigem, (String(r.origem||'').trim() || '(Sem origem)') as any, (r.valor||0) as any);

    // Status: top 11 + Outros
    const aggStatus: Record<string,{n:number;v:number}> = {};
    for (const r of rows) {
      const s = String(r.status||'').trim();
      const k = s || '(Sem status)';
      cnt(aggStatus, k as any, (r.valor||0) as any);
    }
    const statusSorted = Object.entries(aggStatus).sort((a,b)=>b[1].n-a[1].n);
    const statusTop = statusSorted.slice(0, 10);
    const statusOutrosN = statusSorted.slice(10).reduce((s,x)=> s+x[1].n, 0);
    const statusOutrosV = statusSorted.slice(10).reduce((s,x)=> s+x[1].v, 0);

    // Tipo Ação top 10
    const aggTipoAcao: Record<string,{n:number;v:number}> = {};
    for (const r of rows) {
      const k = String(r.tipo_acao_ajuizamento||'').trim() || '(Sem tipo ação)';
      cnt(aggTipoAcao, k as any, (r.valor||0) as any);
    }
    const tipoAcaoSorted = Object.entries(aggTipoAcao).sort((a,b)=>b[1].n-a[1].n).slice(0, 10);

    // Gerentes top 8
    const aggGerente: Record<string,{n:number;v:number}> = {};
    for (const r of rows) {
      const k = String(r.gerente||'').trim() || '(Não atribuído)';
      cnt(aggGerente, k as any, (r.valor||0) as any);
    }
    const gerenteSorted = Object.entries(aggGerente).sort((a,b)=>b[1].n-a[1].n).slice(0, 8);

    // Expectativa Risco x Retorno (4 quadrantes por processo)
    let baixaProb_bxValor = 0, altaProb_bxValor = 0, baixaProb_axValor = 0, altaProb_axValor = 0;
    const medianaValor = (() => {
      const vals = rows.map(r => asNum(r.valor) || asNum(r.valor_dado_causa_ajuizamento)).filter(n=>n>0).sort((a,b)=>a-b);
      return vals.length ? vals[Math.floor(vals.length/2)] : 100000;
    })();
    for (const r of rows) {
      const pg = asNum(r.probabilidade_ganho_ajuizamento);
      const v = asNum(r.valor) || asNum(r.valor_dado_causa_ajuizamento);
      if (pg === 0 && v === 0) continue;
      const prob = pg > 0 ? pg : 0.5;
      const val = v > 0 ? v : medianaValor;
      const p = prob >= 0.5 ? 'a' : 'b';
      const x = val >= medianaValor ? 'a' : 'b';
      if (p==='b' && x==='b') baixaProb_bxValor++;
      else if (p==='a' && x==='b') altaProb_bxValor++;
      else if (p==='b' && x==='a') baixaProb_axValor++;
      else altaProb_axValor++;
    }
    const q4d = { baixaProb_bxValor, altaProb_bxValor, baixaProb_axValor, altaProb_axValor };
    const q4dSum = q4d.baixaProb_bxValor+q4d.altaProb_bxValor+q4d.baixaProb_axValor+q4d.altaProb_axValor;

    // Top 8 lacunas (campos % de faltantes) ordenados por peso * (1-pct)
    const gapsRanked = [...healthPerField].sort((a,b) => (b.weight*(1-b.pct)) - (a.weight*(1-a.pct))).slice(0, 8);

    return {
      total, valorTotal, ticketMedio, totalCustasHonorarios, totalHonorariosRealizados, totalCustasProcExtraj,
      valorDadoCausaTotal, perdaEstimadaTotal, espGanho, espPerda, cntEsp, probGanhoAvg, probPerdaAvg,
      healthPerField, scorePct, scoreBand, scoreBandColor, scoreBandBg, scoreBandLabel,
      prazos, aggNatureza, aggOrigem, statusTop, statusOutrosN, statusOutrosV, tipoAcaoSorted,
      gerenteSorted, q4d, q4dSum, gapsRanked, medianaValor,
    };
  }, [rows]);

  // Formatação BR reutilizável (fora do memo para não re-instanciar)
  const fmtBr = useCallback((n: number, d=0) => {
    if (!isFinite(n)) return '-';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return (n/1_000_000).toLocaleString('pt-BR', {maximumFractionDigits: d===0?2:d}) + ' Mi';
    if (abs >= 1_000)     return (n/1_000).toLocaleString('pt-BR', {maximumFractionDigits: d===0?1:d}) + ' mil';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: d });
  }, []);
  const fmtInt = useCallback((n: number) => Math.round(n).toLocaleString('pt-BR'), []);
  const fmtMoney = useCallback((n: number) => {
    if (!isFinite(n)) return 'R$ -';
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 750,
    color: 'rgba(0,54,65,0.72)',
    letterSpacing: 0.03,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingLeft: 2,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 13px',
    borderRadius: 10,
    border: '1.5px solid rgba(0, 54, 65, 0.12)',
    background: '#FFFFFF',
    color: '#003641',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
    fontFamily: 'Fira Sans, system-ui, -apple-system, sans-serif',
    lineHeight: 1.4,
  };
  const inputReadOnlyStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(0, 174, 157, 0.04) 0%, rgba(125, 182, 28, 0.05) 100%)',
    borderColor: 'rgba(0, 174, 157, 0.25)',
    color: 'rgba(0, 54, 65, 0.88)',
    cursor: 'default',
  };

  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [tipoAcoesColumnWidths, setTipoAcoesColumnWidths] = useState<TipoAcoesColumnWidths>(DEFAULT_TIPO_ACOES_COLUMN_WIDTHS);
  const [tipoAcoesColumnWidthsCustomized, setTipoAcoesColumnWidthsCustomized] = useState(false);
  const [jurIsAdmin, setJurIsAdmin] = useState(false);
  const [jurSettingsLocked, setJurSettingsLocked] = useState(true);
  const [kpis, setKpis] = useState<KpiTrend[]>([]);
  const [chartData, setChartData] = useState<{ mes: number; ativo: number; passivo: number; acordos: number }[]>([]);
  const [anosOptions, setAnosOptions] = useState<string[]>([]);
  const [origensOptions, setOrigensOptions] = useState<string[]>([]);
  const [, setStatusesOptions] = useState<string[]>([]);
  const [statusesDistinctDb, setStatusesDistinctDb] = useState<string[]>([]);
  const [gerentesDistinctDb, setGerentesDistinctDb] = useState<string[]>([]);
  const [gerentesCadastro, setGerentesCadastro] = useState<Array<{ nome: string; pa: string }>>([]);
  const [gerenteAddOpen, setGerenteAddOpen] = useState(false);
  const [gerenteNewNome, setGerenteNewNome] = useState('');
  const [gerenteNewPa, setGerenteNewPa] = useState('');
  const [gerenteAddSaving, setGerenteAddSaving] = useState(false);
  const [dlgSaving, setDlgSaving] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgEdit, setDlgEdit] = useState<JuridicoRow | null>(null);
  const [form, setForm] = useState<Partial<JuridicoRow>>({});
  const [formAutoresCount, setFormAutoresCount] = useState<number>(1);
  const [formReusCount, setFormReusCount] = useState<number>(1);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);
  const [acessosLista, setAcessosLista] = useState<{ email: string; role: string }[]>([]);
  const [novoAcesso, setNovoAcesso] = useState('');
  const [notifEscritorio, setNotifEscritorio] = useState<string[]>([]);
  const [notifCobranca, setNotifCobranca] = useState<string[]>([]);
  const [novoNotifEscritorio, setNovoNotifEscritorio] = useState('');
  const [novoNotifCobranca, setNovoNotifCobranca] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [statusShowAdd, setStatusShowAdd] = useState(false);
  const [statusNewAddTmp, setStatusNewAddTmp] = useState('');
  const [prazoProtocoloExtraj, setPrazoProtocoloExtraj] = useState<number>(15);
  const [prazoAjuizamento, setPrazoAjuizamento] = useState<number>(45);
  const [prazosSaving, setPrazosSaving] = useState(false);
  const [acordoDlgOpen, setAcordoDlgOpen] = useState(false);
  const [acordoExists, setAcordoExists] = useState<any>(null);
  const [acordoForm, setAcordoForm] = useState<any>({
    devedor: '',
    numero_processo_ou_extrajudicial: '',
    titulos_objeto_cobranca: '',
    total_parcelas: '',
    valor_parcela: '',
    numero_parcela: '',
    forma_pagamento: '',
    confirmacao_pagamento: '',
    observacoes: '',
  });
  const [acordoSaving, setAcordoSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; title: string; msg?: string } | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [jurCurrentEmail, setJurCurrentEmail] = useState<string>('');
  const [iconAnimKey, setIconAnimKey] = useState<number>(0);
  const [iconAnimId, setIconAnimId] = useState<number>(0);
  const [iconTextShow, setIconTextShow] = useState<boolean>(false);
  const [iconTextAnimId, setIconTextAnimId] = useState<number>(0);
  const [iconTextKey, setIconTextKey] = useState<number>(0);
  const [iconTextPos, setIconTextPos] = useState<'front'|'back'>('front');
  const origemFormAtual = String(form.origem ?? '').trim();
  const showAjuizamentoSection = origemFormAtual === 'Cooperativa Autora' || origemFormAtual === 'Cooperativa Ré';
  const showExtrajudicialSection = origemFormAtual === 'Extrajudicial';
  const tipoAcoesColumnWidthsRef = useRef<TipoAcoesColumnWidths>(DEFAULT_TIPO_ACOES_COLUMN_WIDTHS);
  const ac = useRef<AbortController | null>(null);
  const nomeDebounce = useRef<number | null>(null);

  void iconTextAnimId;

  useEffect(() => {
    // sync fallback — se acessos sempre fechar dlg quando trocar tela
    setDlgOpen(false);
  }, [currentView]);

  useEffect(() => {
    const em = String(sessionStorage.getItem('consignado_user_email') || '').trim().toLowerCase();
    const nm = String(sessionStorage.getItem('consignado_user_name') || '').trim() || em.split('@')[0] || 'Usuário';
    setUserEmail(em);
    setJurCurrentEmail(em);
    setUserName(nm);
    let cancelled = false;
    let objectUrl: string | null = null;

    const tryGrantAndSetRole = async () => {
      let sessionRole = String(sessionStorage.getItem('juridico_user_role') || '').trim().toLowerCase() as string | null;
      try {
        if (em) {
          const res = await fetch(`${BACKEND_PREFIX}/access/me?email=${encodeURIComponent(em)}`);
          if (res.ok) {
            const json = await res.json();
            if (json && typeof json === 'object') {
              const role = String(json.role || '').trim().toLowerCase() || null;
              if (role) sessionRole = role;
              if (!cancelled && typeof sessionStorage !== 'undefined') {
                try { sessionStorage.setItem('juridico_user_role', role || ''); } catch {}
              }
            }
          }
        }
      } catch { /* ignore network errors */ }
      const isFixed = em === FIXED_ADMIN_EMAIL.toLowerCase();
      const isAdmin = isFixed || sessionRole === 'admin';
      const hasRole = isFixed || sessionRole === 'admin' || sessionRole === 'usuario';
      if (!cancelled) {
        setJurIsAdmin(isAdmin);
        setJurSettingsLocked(!hasRole ? true : !isAdmin);
      }
    };

    const tryLoadPhoto = async () => {
      try {
        const msalInstance = (window as any).__msalInstance as
          | {
              getActiveAccount: () => { name?: string; username?: string } | null;
              getAllAccounts: () => Array<{ name?: string; username?: string }>;
              setActiveAccount: (acc: any) => void;
              acquireTokenSilent: (req: any) => Promise<{ accessToken: string }>;
            }
          | undefined;
        if (!msalInstance) return;
        const accounts = msalInstance.getAllAccounts();
        if (!msalInstance.getActiveAccount() && accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
        }
        const active = msalInstance.getActiveAccount();
        const t = await msalInstance.acquireTokenSilent({
          scopes: ['User.Read'],
          account: active,
        });
        const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: { Authorization: `Bearer ${t.accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setCurrentUserPhoto(url);
      } catch {
        /* ignore */
      }
    };

    void tryGrantAndSetRole();
    void tryLoadPhoto();

    return () => {
      cancelled = true;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    tipoAcoesColumnWidthsRef.current = tipoAcoesColumnWidths;
  }, [tipoAcoesColumnWidths]);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    const loadTipoAcoesColumnWidths = async () => {
      try {
        const res = await fetch(`${BACKEND_PREFIX}/config/tipo-acoes-colunas?requestedBy=${encodeURIComponent(userEmail)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data === 'object') {
          setTipoAcoesColumnWidths(normalizeTipoAcoesColumnWidths(data.widths));
          setTipoAcoesColumnWidthsCustomized(Boolean(data.customized));
        }
      } catch {
        /* ignore */
      }
    };
    void loadTipoAcoesColumnWidths();
    return () => { cancelled = true; };
  }, [userEmail]);

  const persistTipoAcoesColumnWidths = useCallback(async (widths: TipoAcoesColumnWidths) => {
    if (!userEmail) return;
    try {
      const res = await fetch(`${BACKEND_PREFIX}/config/tipo-acoes-colunas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedByEmail: userEmail,
          widths,
        }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') {
        setTipoAcoesColumnWidths(normalizeTipoAcoesColumnWidths(data.widths));
        setTipoAcoesColumnWidthsCustomized(Boolean(data.customized));
      }
    } catch {
      /* ignore */
    }
  }, [userEmail]);

  const resetTipoAcoesColumnWidths = useCallback(async () => {
    setTipoAcoesColumnWidths({ ...DEFAULT_TIPO_ACOES_COLUMN_WIDTHS });
    setTipoAcoesColumnWidthsCustomized(false);
    tipoAcoesColumnWidthsRef.current = { ...DEFAULT_TIPO_ACOES_COLUMN_WIDTHS };
    if (!userEmail) return;
    try {
      const res = await fetch(`${BACKEND_PREFIX}/config/tipo-acoes-colunas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedByEmail: userEmail,
          reset: true,
        }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') {
        setTipoAcoesColumnWidths(normalizeTipoAcoesColumnWidths(data.widths));
        setTipoAcoesColumnWidthsCustomized(Boolean(data.customized));
      }
    } catch {
      /* ignore */
    }
  }, [userEmail]);

  const startTipoAcoesColumnResize = useCallback((key: TipoAcoesColumnKey, ev: React.MouseEvent<HTMLSpanElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX;
    const th = ev.currentTarget.closest('th');
    const startWidth = Math.round(th?.getBoundingClientRect().width || tipoAcoesColumnWidthsRef.current[key]);
    setTipoAcoesColumnWidthsCustomized(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (moveEv: MouseEvent) => {
      const delta = moveEv.clientX - startX;
      setTipoAcoesColumnWidths((prev) => ({
        ...prev,
        [key]: Math.max(MIN_TIPO_ACOES_COLUMN_WIDTHS[key], Math.min(420, Math.round(startWidth + delta))),
      }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      void persistTipoAcoesColumnWidths(tipoAcoesColumnWidthsRef.current);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [persistTipoAcoesColumnWidths]);

  const tipoAcoesTableMinWidth = useMemo(
    () => (
      tipoAcoesColumnWidths.origem
      + tipoAcoesColumnWidths.autor
      + tipoAcoesColumnWidths.reu
      + tipoAcoesColumnWidths.contrato
      + tipoAcoesColumnWidths.processo
      + tipoAcoesColumnWidths.status
      + tipoAcoesColumnWidths.natureza
      + tipoAcoesColumnWidths.valor
      + 52
    ),
    [tipoAcoesColumnWidths],
  );

  const getTipoAcoesColumnCssWidth = useCallback((key: TipoAcoesColumnKey): number | string => {
    if (tipoAcoesColumnWidthsCustomized) return tipoAcoesColumnWidths[key];
    const pct = (DEFAULT_TIPO_ACOES_COLUMN_WIDTHS[key] / TIPO_ACOES_DEFAULT_WIDTH_TOTAL) * 100;
    return `max(${pct.toFixed(4)}%, ${MIN_TIPO_ACOES_COLUMN_WIDTHS[key]}px)`;
  }, [tipoAcoesColumnWidths, tipoAcoesColumnWidthsCustomized]);

  const loadDashboard = () => loadDashboardWithFilters(nome, ano, mes, origem, status, natureza);

  const loadDashboardWithFilters = async (pNome: string, pAno: string, pMes: string, pOrigem: string, pStatus: string, pNatureza: string) => {
    // #region debug-point fe-load-dashboard
    const __dbg = async (level: string, ev: string, payload: any) => {
      try {
        const u = (window as any).__TRAE_DEBUG_URL__ as string | undefined;
        const s = (window as any).__TRAE_DEBUG_SESSION__ as string | undefined;
        if (!u) return;
        const body: any = {
          ts: Date.now(),
          session: s || 'juridico-dashboard-vazio',
          level, ev,
          url: typeof window !== 'undefined' ? window.location.href : '',
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          payload: typeof payload === 'string' ? { message: payload } : payload,
        };
        const x = new XMLHttpRequest();
        x.open('POST', u, true);
        x.setRequestHeader('Content-Type', 'application/json');
        if (s) x.setRequestHeader('x-trae-debug-session', s);
        x.send(JSON.stringify(body));
      } catch { /* ignore */ }
    };
    // #endregion

    if (ac.current) {
      void __dbg('info', 'fe.load.abort-prev', {});
      ac.current.abort();
    }
    const ctrl = new AbortController();
    ac.current = ctrl;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pAno) params.set('ano', pAno);
      if (pMes) params.set('mes', pMes);
      if (pOrigem) params.set('origem', pOrigem);
      if (pNome) params.set('nome', pNome);
      if (pStatus) params.set('status', pStatus);
      if (pNatureza) params.set('natureza', pNatureza);
      const qs = params.toString();
      void __dbg('info', 'fe.load.start', {
        query: qs, ano: pAno, mes: pMes, origem: pOrigem, nome: pNome, status: pStatus, natureza: pNatureza,
        url: `${BACKEND_PREFIX}/dashboard?${qs}`,
      });
      const t0 = Date.now();
      const res = await fetch(`${BACKEND_PREFIX}/dashboard?${qs}`, { signal: ctrl.signal });
      void __dbg('info', 'fe.load.res', {
        status: res.status,
        ok: res.ok,
        statusText: res.statusText,
        type: res.type,
        url: res.url,
        contentLength: res.headers.get('content-length'),
        elapsed_ms: Date.now() - t0,
      });
      if (!res.ok) {
        const txb = await (async () => { try { return await res.text(); } catch { return ''; } })();
        void __dbg('error', 'fe.load.bad_status', { status: res.status, body_preview: (txb || '').slice(0, 400) });
        throw new Error('Falha ao carregar dashboard jurídico (HTTP ' + res.status + ').');
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch (je) {
        const txb = await (async () => { try { return await res.text(); } catch { return ''; } })();
        void __dbg('error', 'fe.load.invalid_json', { parse_err: String(je), body_preview: (txb || '').slice(0, 400) });
        throw je;
      }
      void __dbg('info', 'fe.load.data_shape', {
        rows_is_array: Array.isArray(data.rows),
        rows_len: Array.isArray(data.rows) ? data.rows.length : 0,
        kpis_is_array: Array.isArray(data.kpis),
        kpis_len: Array.isArray(data.kpis) ? data.kpis.length : 0,
        kpis_is_obj: (typeof data.kpis === 'object' && data.kpis && !Array.isArray(data.kpis)) ? Object.keys(data.kpis) : [],
        chart_is_array: Array.isArray(data.chart),
        chart_len: Array.isArray(data.chart) ? data.chart.length : 0,
        anos_len: Array.isArray(data.anos) ? data.anos.length : 0,
        origens_len: Array.isArray(data.origens) ? data.origens.length : 0,
        total: typeof data.total === 'number' ? data.total : null,
        row0_keys: Array.isArray(data.rows) && data.rows[0] ? Object.keys(data.rows[0]) : [],
        row0_sample: Array.isArray(data.rows) && data.rows[0] ? data.rows[0] : null,
      });
      const rowsArrRaw: any[] = Array.isArray(data.rows) ? (data.rows as any[]) : [];
      const rowsArr: JuridicoRow[] = rowsArrRaw.map(mapApiRowToGridRow);
      setRows(rowsArr);
      let kArr: KpiTrend[] = [];
      if (Array.isArray(data.kpis)) {
        kArr = data.kpis as KpiTrend[];
      } else if (typeof data.kpis === 'object' && data.kpis) {
        const refLabels: Array<[string, string, any, any]> = [
          ['solicitacoes', 'Solicitações enviadas ao jurídico', 'def', 'total_registros'],
          ['total_valor_passivo', 'Total valor Passivo', 'def', null],
          ['total_valor_ativo', 'Total valor Ativo', 'def', null],
          ['total_valor_extinta', 'Total valor Extinta', 'def', null],
          ['processos_extintos', 'Processos extintos', 'def', null],
          ['processos_ajuizados', 'Processos ajuizados', 'gray', null],
        ];
        const trendsByKey = new Map<string, any>();
        if (Array.isArray(data.kpis.trends)) {
          for (const t of data.kpis.trends) {
            if (t && typeof t.key) trendsByKey.set(String(t.key), t);
          }
        }
        const fmtMoney = (v: any) => {
          const n = Number(v);
          if (Number.isNaN(n) || !isFinite(n)) return String(v ?? '-');
          return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };
        kArr = refLabels.map(([objKey, label, variant, trendKeyAlt]) => {
          const trendKey = trendKeyAlt ?? objKey;
          const raw = (data.kpis as any)[objKey];
          const deltaTrend = trendsByKey.get(String(trendKey)) ?? null;
          const isCurrency = String(objKey).includes('valor') || String(objKey).includes('custas');
          return {
            label,
            value: isCurrency ? fmtMoney(raw) : String(raw ?? '-'),
            variant,
            deltaPct: deltaTrend && typeof deltaTrend.pct === 'number' ? Number(deltaTrend.pct) : null,
            good: deltaTrend && typeof (deltaTrend as any).good === 'boolean' ? Boolean((deltaTrend as any).good) : undefined,
          };
        });
      }
      setKpis(kArr);
      const chartRaw = Array.isArray(data.chart) ? data.chart : (Array.isArray(data.grafico) ? data.grafico : []);
      setChartData(chartRaw.map((c: any, i: number) => ({
        mes: typeof c?.mes_idx === 'number' ? c.mes_idx : (i + 1),
        ativo: Number(c?.ativo) ?? 0,
        passivo: Number(c?.passivo) ?? 0,
        acordos: Number(c?.acordos) ?? 0,
        label: c?.mes_ano ?? c?.mes ?? String(i + 1),
      })));
      setAnosOptions(Array.isArray(data.anos) ? data.anos : []);
      setOrigensOptions(Array.isArray(data.origens) ? data.origens : []);
      setStatusesOptions(Array.isArray(data.statusesOptions) ? data.statusesOptions : []);
      try {
        const respSt = await fetch(`${BACKEND_PREFIX}/options/distinct-statuses`, { signal: ctrl.signal });
        if (respSt.ok) {
          const stData = await respSt.json();
          const list: string[] = Array.isArray(stData?.options) ? stData.options : [];
          const merged = Array.from(new Set([...(Array.isArray(data.statusesOptions) ? data.statusesOptions : []), ...list]));
          merged.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
          setStatusesDistinctDb(merged);
        }
      } catch (_eSt) { /* no-op */ }
      try {
        const respGe = await fetch(`${BACKEND_PREFIX}/options/distinct-gerentes`, { signal: ctrl.signal });
        if (respGe.ok) {
          const geData = await respGe.json();
          const list: string[] = Array.isArray(geData?.options) ? geData.options : [];
          list.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
          setGerentesDistinctDb(list);
        }
      } catch (_eGe) { /* no-op */ }
      try {
        const respGc = await fetch(`${BACKEND_PREFIX}/options/cadastro-gerentes`, { signal: ctrl.signal });
        if (respGc.ok) {
          const gcData = await respGc.json();
          const arrGc = Array.isArray(gcData?.options) ? gcData.options : [];
          setGerentesCadastro(
            arrGc
              .map((g: any) => ({ nome: String(g?.nome ?? '').trim(), pa: String(g?.pa ?? '').trim() }))
              .filter((g: any) => g.nome),
          );
        }
      } catch (_eGc) { /* no-op */ }
      setTotalRegistros(typeof data.total === 'number' ? data.total : (rowsArr.length ?? 0));
      void __dbg('info', 'fe.load.state_applied', {
        rows_len: rowsArr.length,
        anos_len: Array.isArray(data.anos) ? data.anos.length : 0,
        origens_len: Array.isArray(data.origens) ? data.origens.length : 0,
      });
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        void __dbg('error', 'fe.load.err', {
          name: e?.name ?? 'Error',
          message: e?.message ?? String(e),
          stack: typeof e?.stack === 'string' ? String(e.stack).slice(0, 1200) : null,
        });
        console.warn(e);
      } else {
        void __dbg('info', 'fe.load.aborted', {});
      }
    } finally {
      setLoading(false);
      void __dbg('info', 'fe.load.finally', { loading: false });
    }
  };

  useEffect(() => { loadDashboard(); }, [ano, mes, origem, nome, status, natureza]);

  useEffect(() => {
    if (jurIsAdmin) {
      const by = jurCurrentEmail || FIXED_ADMIN_EMAIL;
      fetch(`${BACKEND_PREFIX}/access/emails?requestedBy=${encodeURIComponent(by)}`)
        .then(r => r.ok ? r.json() : [])
        .then(arr => setAcessosLista(Array.isArray(arr?.entries) ? arr.entries : Array.isArray(arr) ? arr : []))
        .catch(() => {});
      fetch(`${BACKEND_PREFIX}/config/notificacoes?requestedBy=${encodeURIComponent(by)}`)
        .then(r => r.ok ? r.json() : { escritorioJuridico: [], cobranca: [] })
        .then((d: any) => {
          const esc = Array.isArray(d?.escritorioJuridico) ? d.escritorioJuridico.map((e: unknown) => String(e || '').trim().toLowerCase()).filter(Boolean) : [];
          const cob = Array.isArray(d?.cobranca) ? d.cobranca.map((e: unknown) => String(e || '').trim().toLowerCase()).filter(Boolean) : [];
          setNotifEscritorio(esc);
          setNotifCobranca(cob);
        })
        .catch(() => {});
      fetch(`${BACKEND_PREFIX}/config/regras-prazos?requestedBy=${encodeURIComponent(by)}`)
        .then(r => r.ok ? r.json() : { prazoProtocoloExtrajudicialDias: 15, prazoAjuizamentoDias: 45 })
        .then((d: any) => {
          setPrazoProtocoloExtraj(Number.isFinite(d?.prazoProtocoloExtrajudicialDias) ? Math.max(0, Math.floor(d.prazoProtocoloExtrajudicialDias)) : 15);
          setPrazoAjuizamento(Number.isFinite(d?.prazoAjuizamentoDias) ? Math.max(0, Math.floor(d.prazoAjuizamentoDias)) : 45);
        })
        .catch(() => {});
    }
  }, [jurIsAdmin, jurCurrentEmail]);

  const handleLimpar = () => {
    setAno(''); setMes(''); setOrigem(''); setNome(''); setStatus(''); setNatureza(''); setLacunasFiltro([]);
  };

  const lacunasCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of LACUNA_CAMPOS) out[f.key] = rows.filter(r => f.check(r)).length;
    return out;
  }, [rows, LACUNA_CAMPOS]);

  /* ========== FILTRO PRINCIPAL: AND tradicionais + OR lacunas selecionadas ========== */
  const filtered = useMemo(() => {
    const anoS = ano.trim();
    const mesS = mes.trim();
    const origemS = origem.trim();
    const nomeS = nome.trim().toLowerCase();
    const statusS = status.trim();
    const natS = natureza.trim();

    return rows.filter(r => {
      /* -------- AND: filtros tradicionais -------- */
      if (origemS && String(r.origem || '').trim() !== origemS) return false;
      if (statusS && String(r.status || '').trim() !== statusS) return false;
      if (natS && String(r.natureza || '').trim() !== natS) return false;
      if (nomeS) {
        const hay = [
          r.autores, r.reus, r.autor, r.reu,
          r.autor_1_nome, r.autor_2_nome, r.autor_3_nome, r.autor_4_nome, r.autor_5_nome,
          r.reu_1_nome, r.reu_2_nome, r.reu_3_nome, r.reu_4_nome, r.reu_5_nome,
        ].map(v => String(v || '').toLowerCase()).join(' | ');
        if (!hay.includes(nomeS)) return false;
      }
      if (anoS || mesS) {
        const dCandidates = [r.data_evento, r.data_distribuicao_ajuizamento, r.created_at, r.data_limite_ajuizamento, r.data];
        let matched = false;
        for (const raw of dCandidates) {
          if (!raw) continue;
          const s = String(raw).trim();
          const m = s.match(/(\d{4})[-/](\d{1,2})[-/]/) || s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
          if (!m) continue;
          let y: string, mm: string;
          if (m[3] && m[1].length <= 2) { y = m[3]; mm = m[2]; }
          else { y = m[1]; mm = m[2]; }
          if (anoS && y !== anoS) continue;
          if (mesS && String(Number(mm)) !== String(Number(mesS))) continue;
          matched = true; break;
        }
        if (!matched) return false;
      }

      /* -------- OR: ao menos UM dos campos lacuna selecionados está em branco -------- */
      if (lacunasFiltro.length > 0) {
        let ok = false;
        for (const k of lacunasFiltro) {
          const f = LACUNA_CAMPOS.find(x => x.key === k);
          if (!f) continue;
          if (f.check(r)) { ok = true; break; }
        }
        if (!ok) return false;
      }
      return true;
    });
  }, [rows, ano, mes, origem, nome, status, natureza, lacunasFiltro, LACUNA_CAMPOS]);

  const autoSizeTipoAcoesColumn = useCallback((key: TipoAcoesColumnKey) => {
    const measureCanvas = document.createElement('canvas');
    const ctx = measureCanvas.getContext('2d');
    if (!ctx) return;

    const headerLabels: Record<TipoAcoesColumnKey, string> = {
      origem: 'Origem',
      autor: 'Autor(es)',
      reu: 'Réu(s)',
      contrato: 'Contrato Sicoob',
      processo: 'Nº Processo',
      status: 'Status',
      natureza: 'Natureza',
      valor: 'Valor',
    };

    const sampleValues: Record<TipoAcoesColumnKey, string[]> = {
      origem: filtered.map((r) => String(r.origem || '-')),
      autor: filtered.map((r) => String(r.autor || '-')),
      reu: filtered.map((r) => String(r.reu || '-')),
      contrato: filtered.map((r) => String(r.contrato || '-')),
      processo: filtered.map((r) => String(r.processo || '-')),
      status: filtered.map((r) => String(r.status || '-')),
      natureza: filtered.map((r) => String(r.natureza || '-')),
      valor: filtered.map((r) => brl(r.valor)),
    };

    const headerFont = `${thStyle.fontWeight || 800} ${thStyle.fontSize || 12}px Fira Sans, system-ui, -apple-system, sans-serif`;
    const bodyFontByKey: Record<TipoAcoesColumnKey, string> = {
      origem: `${tdStyle.fontSize || 13.2}px Fira Sans, system-ui, -apple-system, sans-serif`,
      autor: `${tdStyle.fontSize || 13.2}px Fira Sans, system-ui, -apple-system, sans-serif`,
      reu: `${tdStyle.fontSize || 13.2}px Fira Sans, system-ui, -apple-system, sans-serif`,
      contrato: `${tdStyle.fontSize || 13.2}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
      processo: `${tdStyle.fontSize || 13.2}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
      status: `${tdStyle.fontSize || 13.2}px Fira Sans, system-ui, -apple-system, sans-serif`,
      natureza: `700 11px Fira Sans, system-ui, -apple-system, sans-serif`,
      valor: `${tdStyle.fontSize || 13.2}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
    };

    ctx.font = headerFont;
    let maxWidth = Math.ceil(ctx.measureText(headerLabels[key]).width);

    ctx.font = bodyFontByKey[key];
    for (const value of sampleValues[key]) {
      maxWidth = Math.max(maxWidth, Math.ceil(ctx.measureText(value).width));
    }

    const paddingExtra = key === 'natureza' ? 42 : key === 'valor' ? 28 : 24;
    const nextWidth = Math.max(MIN_TIPO_ACOES_COLUMN_WIDTHS[key], Math.min(420, maxWidth + paddingExtra));

    setTipoAcoesColumnWidthsCustomized(true);
    setTipoAcoesColumnWidths((prev) => ({
      ...prev,
      [key]: nextWidth,
    }));
    const nextWidths = {
      ...tipoAcoesColumnWidthsRef.current,
      [key]: nextWidth,
    };
    tipoAcoesColumnWidthsRef.current = nextWidths;
    void persistTipoAcoesColumnWidths(nextWidths);
  }, [filtered, persistTipoAcoesColumnWidths]);

  const renderTipoAcoesResizeHandle = useCallback((key: TipoAcoesColumnKey) => (
    <span
      role="presentation"
      onMouseDown={(ev) => startTipoAcoesColumnResize(key, ev)}
      onDoubleClick={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        autoSizeTipoAcoesColumn(key);
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: -6,
        width: 12,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title="Arraste para ajustar a coluna ou dê duplo clique para autoajustar"
    >
      <span style={{
        width: 2,
        height: 18,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.96)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.14)',
        opacity: 0.95,
      }} />
    </span>
  ), [autoSizeTipoAcoesColumn, startTipoAcoesColumnResize]);

  const handleExportXlsx = async () => {
    try {
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      workbook.creator = 'Portal Administrativo';
      workbook.company = 'Sicoob Juriscred';
      workbook.created = new Date();
      workbook.modified = new Date();

      const sheet = workbook.addWorksheet('Tipo de ações', {
        views: [{ state: 'frozen', ySplit: 6 }],
      });

      sheet.properties.defaultRowHeight = 21;
      sheet.getColumn(1).width = 16;
      sheet.getColumn(2).width = 18;
      sheet.getRow(1).height = 30;
      sheet.getRow(2).height = 24;
      sheet.getRow(3).height = 20;
      sheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      };
      const xlsxHeaderBg = 'FF003641';
      const paintRange = (fromRow: number, toRow: number, fromCol: number, toCol: number, argb: string) => {
        for (let row = fromRow; row <= toRow; row++) {
          for (let col = fromCol; col <= toCol; col++) {
            sheet.getCell(row, col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb },
            };
          }
        }
      };
      paintRange(1, 3, 1, 9, xlsxHeaderBg);
      paintRange(4, 5, 1, 9, xlsxHeaderBg);
      const exportadoPor = (userName || userEmail || 'Usuário não identificado').trim();
      const exportadoEm = new Date().toLocaleString('pt-BR');

      const filtrosAtivos = [
        ano ? `Ano: ${ano}` : null,
        mes ? `Mês: ${monthLabel(parseInt(mes, 10))}` : null,
        origem ? `Origem: ${origem}` : null,
        nome ? `Consulta: ${nome}` : null,
        status ? `Status: ${status}` : null,
        natureza ? `Natureza: ${natureza}` : null,
        lacunasFiltro.length ? `Lacunas: ${lacunasFiltro.join(', ')}` : null,
      ].filter(Boolean).join(' | ') || 'Sem filtros adicionais';

      try {
        const logoRes = await fetch('/assets/sicoob-juriscred.png', { cache: 'no-cache' });
        if (logoRes.ok) {
          const logoBase64 = await blobToDataUrl(await logoRes.blob());
          const logoId = workbook.addImage({ base64: logoBase64, extension: 'png' });
          sheet.addImage(logoId, {
            tl: { col: 0.18, row: 0.08 },
            ext: { width: 196, height: 52 },
          });
        }
      } catch {
        /* segue sem logo se o asset não puder ser lido */
      }

      sheet.mergeCells('D1:I1');
      sheet.getCell('D1').value = 'Módulo Jurídico - Tipo de ações';
      sheet.getCell('D1').font = { name: 'Fira Sans', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      sheet.getCell('D1').alignment = { vertical: 'middle', horizontal: 'left' };

      sheet.mergeCells('D2:I2');
      sheet.getCell('D2').value = 'Exportação XLSX conforme os filtros aplicados na tela';
      sheet.getCell('D2').font = { name: 'Fira Sans', size: 11, color: { argb: 'FFD8ECE8' } };
      sheet.getCell('D2').alignment = { vertical: 'middle', horizontal: 'left' };

      sheet.mergeCells('D3:I3');
      sheet.getCell('D3').value = `Exportado por: ${exportadoPor} | Data/Hora: ${exportadoEm}`;
      sheet.getCell('D3').font = { name: 'Fira Sans', size: 10.5, color: { argb: 'FFB8D7D1' } };
      sheet.getCell('D3').alignment = { vertical: 'middle', horizontal: 'left' };

      sheet.mergeCells('A4:I4');
      sheet.getCell('A4').value = `Filtros: ${filtrosAtivos}`;
      sheet.getCell('A4').font = { name: 'Fira Sans', size: 10.5, color: { argb: 'FFFFFFFF' } };
      sheet.getCell('A4').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      sheet.mergeCells('A5:I5');
      sheet.getCell('A5').value = `Total exportado: ${filtered.length} registro${filtered.length === 1 ? '' : 's'}`;
      sheet.getCell('A5').font = { name: 'Fira Sans', size: 10.5, bold: true, color: { argb: 'FF96CB3A' } };
      sheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'left' };

      const headerRowIndex = 6;
      const columns = [
        { header: 'Origem', key: 'origem', width: 22 },
        { header: 'Data', key: 'data', width: 14 },
        { header: 'Autor(es)', key: 'autor', width: 30 },
        { header: 'Réu(s)', key: 'reu', width: 30 },
        { header: 'Contrato Sicoob', key: 'contrato', width: 18 },
        { header: 'Nº Processo', key: 'processo', width: 22 },
        { header: 'Status', key: 'status', width: 28 },
        { header: 'Natureza', key: 'natureza', width: 14 },
        { header: 'Valor', key: 'valor', width: 16 },
      ] as const;

      columns.forEach((col, index) => {
        const cell = sheet.getCell(headerRowIndex, index + 1);
        cell.value = col.header;
        cell.font = { name: 'Fira Sans', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: xlsxHeaderBg },
        };
        cell.alignment = { vertical: 'middle', horizontal: index >= 8 ? 'right' : 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0A4A57' } },
          bottom: { style: 'thin', color: { argb: 'FF0A4A57' } },
          left: { style: 'thin', color: { argb: 'FF0A4A57' } },
          right: { style: 'thin', color: { argb: 'FF0A4A57' } },
        };
        sheet.getColumn(index + 1).width = col.width;
      });

      filtered.forEach((r, idx) => {
        const rowIndex = headerRowIndex + 1 + idx;
        const row = sheet.getRow(rowIndex);
        row.values = [
          r.origem ?? '',
          r.data ?? '',
          r.autor ?? '',
          r.reu ?? '',
          r.contrato ?? '',
          r.processo ?? '',
          r.status ?? '',
          r.natureza ?? '',
          Number(r.valor ?? 0),
        ];
        row.eachCell((cell, colNumber) => {
          cell.font = {
            name: colNumber >= 9 ? 'Fira Code' : 'Fira Sans',
            size: 10.5,
            color: { argb: 'FF003641' },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber >= 9 ? 'right' : 'left',
            wrapText: colNumber === 3 || colNumber === 4 || colNumber === 7,
          };
          cell.border = {
            bottom: { style: 'thin', color: { argb: '1A003641' } },
          };
          if (idx % 2 === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '0A00AE9D' },
            };
          }
        });
        row.getCell(9).numFmt = '"R$" #,##0.00';
      });

      sheet.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex, column: columns.length },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob(
        [buffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processos-juridico-${ano || 'todos'}-${mes || 'todos'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ kind: 'ok', title: 'XLSX exportado', msg: `${filtered.length} registro${filtered.length === 1 ? '' : 's'} exportado${filtered.length === 1 ? '' : 's'} com sucesso.` });
      setTimeout(() => setToast(null), 2600);
    } catch (e: any) {
      console.error(e);
      setToast({ kind: 'err', title: 'Falha ao exportar XLSX', msg: e?.message || 'Não foi possível gerar o arquivo.' });
      setTimeout(() => setToast(null), 3600);
    }
  };

  const handleNovo = () => {
    if (jurSettingsLocked) return;
    setDlgEdit(null);
    const defaultOrigem = origensOptions.includes('Enviado ao Jurídico')
      ? 'Enviado ao Jurídico'
      : (origensOptions[0] || 'Enviado ao Jurídico');
    const emptyForm: Partial<JuridicoRow> = {
      origem: defaultOrigem,
      data: _todayBr(),
      autor: '', reu: '', contrato: '', processo: '',
      status: '', natureza: 'Ativo', valor: 0, custas: 0,
      data_evento: '',
      autores: '', reus: '',
      contrato_sicoob: '', numero_contrato_sicoob: '',
      numero_processo: '', numero_processo_ajuizamento: '',
      observacoes: '',
      valor_dado_causa_ajuizamento: 0,
      data_distribuicao_ajuizamento: '',
      probabilidade_ganho_ajuizamento: 0,
      probabilidade_perda_ajuizamento: 0,
      valor_estimado_perda_ajuizamento: 0,
      tipo_acao_ajuizamento: '',
      origem_processo_1grau_ajuizamento: '',
      processos_vinculados_ajuizamento: '',
      status_ultimo_andamento_ajuizamento: '',
      data_ultimo_andamento_ajuizamento: '',
      data_recebimento_cobranca_extrajudicial: '',
      status_extrajudicial: '',
      matricula_extrajudicial: '',
      numero_protocolo_cartorio_extrajudicial: '',
      cartorio_extrajudicial: '',
      data_protocolizacao_cartorio_extrajudicial: '',
      data_ultima_etapa_extrajudicial: '',
      observacoes_extrajudicial: '',
      data_limite_protocolar_extrajudicial: '',
      autor_1_nome: '', autor_1_cpf_cnpj: '',
      autor_2_nome: '', autor_2_cpf_cnpj: '',
      autor_3_nome: '', autor_3_cpf_cnpj: '',
      autor_4_nome: '', autor_4_cpf_cnpj: '',
      autor_5_nome: '', autor_5_cpf_cnpj: '',
      autor_6_nome: '', autor_6_cpf_cnpj: '',
      reu_1_nome: '', reu_1_cpf_cnpj: '',
      reu_2_nome: '', reu_2_cpf_cnpj: '',
      reu_3_nome: '', reu_3_cpf_cnpj: '',
      reu_4_nome: '', reu_4_cpf_cnpj: '',
      reu_5_nome: '', reu_5_cpf_cnpj: '',
      reu_6_nome: '', reu_6_cpf_cnpj: '',
      honorarios_realizados: 0,
      custas_processuais_extrajudiciais: 0,
      numero_pa_enviados_ajuizamento: '',
      gerente: '',
      serasa_enviados_juridico: '',
      data_prescricao_3anos_enviados_ajuizamento: '',
      data_prescricao_5anos_enviados_ajuizamento: '',
      data_limite_ajuizamento: '',
      origem_importacao: '',
    };
    setForm(emptyForm);
    setFormAutoresCount(1);
    setFormReusCount(1);
    setAcordoExists(null);
    setAcordoForm({
      devedor: '',
      numero_processo_ou_extrajudicial: '',
      titulos_objeto_cobranca: '',
      total_parcelas: '',
      valor_parcela: '',
      numero_parcela: '',
      forma_pagamento: '',
      confirmacao_pagamento: '',
      observacoes: '',
    });
    setDlgOpen(true);
  };

  const handleEditar = (r: JuridicoRow) => {
    if (jurSettingsLocked) return;
    const base: Partial<JuridicoRow> = { ...r };
    const displayFrom = (candidates: string[]) => {
      for (const c of candidates) {
        const raw = (base as any)[c];
        if (raw != null && String(raw).trim() !== '') {
          const br = _dateIsoToBr(String(raw));
          if (br) return br;
          return String(raw).trim();
        }
      }
      return '';
    };
    base.data = displayFrom(['data_evento','data_distribuicao_ajuizamento','data_recebimento_cobranca_extrajudicial']);
    if (!base.data) base.data = _todayBr();
    base.numero_contrato_sicoob = String(base.numero_contrato_sicoob ?? base.contrato_sicoob ?? r.contrato ?? '').trim();
    base.contrato = base.numero_contrato_sicoob;
    base.numero_processo_ajuizamento = String(base.numero_processo_ajuizamento ?? base.numero_processo ?? r.processo ?? '').trim();
    base.processo = base.numero_processo_ajuizamento;

    let autoresCount = 1;
    for (let i = 6; i >= 2; i--) {
      if (String(base[`autor_${i}_nome`] ?? base[`autor_${i}_cpf_cnpj`] ?? '').trim()) { autoresCount = i; break; }
    }
    let reusCount = 1;
    for (let i = 6; i >= 2; i--) {
      if (String(base[`reu_${i}_nome`] ?? base[`reu_${i}_cpf_cnpj`] ?? '').trim()) { reusCount = i; break; }
    }
    if (!base.autor_1_nome && String(base.autor ?? '').trim()) base.autor_1_nome = String(base.autor).trim();
    if (!base.reu_1_nome && String(base.reu ?? '').trim()) base.reu_1_nome = String(base.reu).trim();

    const toText = (v: any) => v == null ? '' : String(v);
    const toBr = (c:string) => _dateIsoToBr(String((base as any)[c] ?? ''));
    const toNum = (c: string) => {
      const v = (base as any)[c];
      if (v == null || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const next: any = {
      ...base,
      valor_dado_causa_ajuizamento: toNum('valor_dado_causa_ajuizamento'),
      probabilidade_ganho_ajuizamento: toNum('probabilidade_ganho_ajuizamento'),
      probabilidade_perda_ajuizamento: toNum('probabilidade_perda_ajuizamento'),
      valor_estimado_perda_ajuizamento: toNum('valor_estimado_perda_ajuizamento'),
      honorarios_realizados: toNum('honorarios_realizados'),
      custas_processuais_extrajudiciais: toNum('custas_processuais_extrajudiciais'),
      custas_honorarios: toNum('custas_honorarios'),
      valor: toNum('valor'),
      // Campos de data (BR dd/mm/aaaa p/ exibição)
      data_evento: toBr('data_evento'),
      data_distribuicao_ajuizamento: toBr('data_distribuicao_ajuizamento'),
      data_ultimo_andamento_ajuizamento: toBr('data_ultimo_andamento_ajuizamento'),
      data_recebimento_cobranca_extrajudicial: toBr('data_recebimento_cobranca_extrajudicial'),
      data_protocolizacao_cartorio_extrajudicial: toBr('data_protocolizacao_cartorio_extrajudicial'),
      data_ultima_etapa_extrajudicial: toBr('data_ultima_etapa_extrajudicial'),
      data_limite_protocolar_extrajudicial: toBr('data_limite_protocolar_extrajudicial'),
      data_prescricao_3anos_enviados_ajuizamento: toBr('data_prescricao_3anos_enviados_ajuizamento'),
      data_prescricao_5anos_enviados_ajuizamento: toBr('data_prescricao_5anos_enviados_ajuizamento'),
      data_limite_ajuizamento: toBr('data_limite_ajuizamento'),
      // Campos TEXT puxados da linha
      tipo_acao_ajuizamento: toText(base.tipo_acao_ajuizamento),
      origem_processo_1grau_ajuizamento: toText(base.origem_processo_1grau_ajuizamento),
      processos_vinculados_ajuizamento: toText(base.processos_vinculados_ajuizamento),
      status_ultimo_andamento_ajuizamento: toText(base.status ?? base.status_ultimo_andamento_ajuizamento ?? base.status_extrajudicial),
      status_extrajudicial: toText(base.status ?? base.status_extrajudicial ?? base.status_ultimo_andamento_ajuizamento),
      matricula_extrajudicial: toText(base.matricula_extrajudicial),
      numero_protocolo_cartorio_extrajudicial: toText(base.numero_protocolo_cartorio_extrajudicial),
      cartorio_extrajudicial: toText(base.cartorio_extrajudicial),
      observacoes_extrajudicial: toText(base.observacoes_extrajudicial),
      numero_pa_enviados_ajuizamento: toText(base.numero_pa_enviados_ajuizamento),
      gerente: toText(base.gerente),
      serasa_enviados_juridico: toText(base.serasa_enviados_juridico),
      origem_importacao: toText(base.origem_importacao),
      observacoes: toText(base.observacoes),
      status: toText(base.status ?? base.status_ultimo_andamento_ajuizamento ?? base.status_extrajudicial),
      natureza: toText(base.natureza) || 'Ativo',
    };
    setDlgEdit(r);
    const autoPrazoForm = !String(next.data_limite_ajuizamento ?? '').trim()
      ? _autoCalcDataLimiteAjuizamento(next, prazoAjuizamento)
      : next;
    setForm(autoPrazoForm);
    setFormAutoresCount(autoresCount);
    setFormReusCount(reusCount);
    setAcordoExists(null);
    setAcordoForm({
      devedor: '',
      numero_processo_ou_extrajudicial: '',
      titulos_objeto_cobranca: '',
      total_parcelas: '',
      valor_parcela: '',
      numero_parcela: '',
      forma_pagamento: '',
      confirmacao_pagamento: '',
      observacoes: '',
    });
    setDlgOpen(true);
    if (r.id) {
      fetch(`${BACKEND_PREFIX}/acordos/${r.id}`)
        .then(res => res.json())
        .then(ac => {
          if (ac && typeof ac === 'object' && (ac.id || ac.processo_id != null)) {
            setAcordoExists(ac);
            setAcordoForm({
              devedor: String(ac.devedor ?? ''),
              numero_processo_ou_extrajudicial: String(ac.numero_processo_ou_extrajudicial ?? ''),
              titulos_objeto_cobranca: String(ac.titulos_objeto_cobranca ?? ''),
              total_parcelas: ac.total_parcelas != null ? String(ac.total_parcelas) : '',
              valor_parcela: ac.valor_parcela != null ? String(ac.valor_parcela) : '',
              numero_parcela: ac.numero_parcela != null ? String(ac.numero_parcela) : '',
              forma_pagamento: String(ac.forma_pagamento ?? ''),
              confirmacao_pagamento: String(ac.confirmacao_pagamento ?? ''),
              observacoes: String(ac.observacoes ?? ''),
            });
          }
        })
        .catch(() => {});
    }
  };

  const handleSalvar = async () => {
    if (dlgSaving) return;
    const autores = Array.from({ length: 6 }, (_, i) => ({
      nome: String(form[`autor_${i + 1}_nome`] ?? '').trim(),
      cpf: String(form[`autor_${i + 1}_cpf_cnpj`] ?? '').trim(),
    }));
    const reus = Array.from({ length: 6 }, (_, i) => ({
      nome: String(form[`reu_${i + 1}_nome`] ?? '').trim(),
      cpf: String(form[`reu_${i + 1}_cpf_cnpj`] ?? '').trim(),
    }));
    const autoresTexto = autores.map(a => a.nome).filter(Boolean);
    const reusTexto = reus.map(a => a.nome).filter(Boolean);
    if (autoresTexto.length === 0 && reusTexto.length === 0) {
      alert('Informe ao menos Autor 1 ou Réu 1.');
      return;
    }
    const dataBr = String(form.data ?? '').trim();
    const dataIso = _dateBrToIso(dataBr);
    if (dataBr && !dataIso) {
      alert('Data inválida. Use o formato dd/mm/aaaa.');
      return;
    }
    const DATE_FIELDS = [
      'data_distribuicao_ajuizamento',
      'data_ultimo_andamento_ajuizamento',
      'data_recebimento_cobranca_extrajudicial',
      'data_protocolizacao_cartorio_extrajudicial',
      'data_ultima_etapa_extrajudicial',
      'data_limite_protocolar_extrajudicial',
      'data_prescricao_3anos_enviados_ajuizamento',
      'data_prescricao_5anos_enviados_ajuizamento',
      'data_limite_ajuizamento',
    ] as const;
    const NUM_FIELDS = [
      'valor_dado_causa_ajuizamento',
      'probabilidade_ganho_ajuizamento',
      'probabilidade_perda_ajuizamento',
      'valor_estimado_perda_ajuizamento',
      'honorarios_realizados',
      'custas_processuais_extrajudiciais',
      'custas_honorarios',
      'valor',
      'custas',
    ] as const;
    const body: any = { ...form };
    // Campos data: dd/mm/aaaa → ISO aaaa-mm-dd
    for (const c of DATE_FIELDS) {
      const raw = String((form as any)[c] ?? '').trim();
      if (!raw) { body[c] = undefined; continue; }
      const iso = _dateBrToIso(raw);
      if (!iso) { alert(`Data inválida em ${String(c).replace(/_/g,' ')}: ${raw}. Use dd/mm/aaaa.`); return; }
      body[c] = iso;
    }
    // Campos number: limpar "" → 0
    for (const c of NUM_FIELDS) {
      const raw = (form as any)[c];
      if (raw == null || raw === '') { body[c] = 0; continue; }
      const n = Number(raw);
      body[c] = Number.isFinite(n) ? n : 0;
    }
    // Autor/Réu N: nome/cpf 1..6
    for (let n = 1; n <= 6; n++) {
      body[`autor_${n}_nome`] = (form as any)[`autor_${n}_nome`] || '';
      body[`autor_${n}_cpf_cnpj`] = (form as any)[`autor_${n}_cpf_cnpj`] || '';
      body[`reu_${n}_nome`] = (form as any)[`reu_${n}_nome`] || '';
      body[`reu_${n}_cpf_cnpj`] = (form as any)[`reu_${n}_cpf_cnpj`] || '';
    }
    // Backward compat texto consolidado + colunas legado
    body.autor = autoresTexto.join('; ');
    body.reu = reusTexto.join('; ');
    body.autores = autoresTexto.join('; ');
    body.reus = reusTexto.join('; ');
    body.status = String(body.status ?? '').trim();
    body.status_ultimo_andamento_ajuizamento = body.status || undefined;
    body.status_extrajudicial = body.status || undefined;
    body.contrato_sicoob = String(body.numero_contrato_sicoob ?? body.contrato_sicoob ?? '').trim() || undefined;
    body.numero_contrato_sicoob = body.contrato_sicoob;
    body.numero_processo = String(body.numero_processo_ajuizamento ?? body.numero_processo ?? '').trim() || undefined;
    body.numero_processo_ajuizamento = body.numero_processo;
    body.data = dataIso || undefined;
    body.data_evento = dataIso || undefined;
    body.requestedByEmail = jurCurrentEmail || FIXED_ADMIN_EMAIL;

    try {
      setDlgSaving(true);
      const id = dlgEdit?.id;
      const url = id
        ? `${BACKEND_PREFIX}/processos/${encodeURIComponent(String(id))}`
        : `${BACKEND_PREFIX}/processos`;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text() || 'Sem permissão.');
      const saved = await res.json().catch(() => null);
      if (saved && typeof saved === 'object') {
        const savedRow = mapApiRowToGridRow(saved);
        setRows((prev) => {
          const exists = prev.some((r) => String(r.id) === String(savedRow.id));
          if (exists) return prev.map((r) => (String(r.id) === String(savedRow.id) ? { ...r, ...savedRow } : r));
          return [savedRow, ...prev];
        });
        if (!dlgEdit?.id) setTotalRegistros((prev) => prev + 1);
      }
      setDlgOpen(false);
      await loadDashboard();
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar.');
    } finally {
      setDlgSaving(false);
    }
  };

  const handleAbrirAcordo = () => {
    const origemAtual = String(form?.origem ?? dlgEdit?.origem ?? '').trim();
    if (origemAtual === 'Enviado ao Jurídico') {
      setToast({ kind: 'err', title: 'Origem não permitida', msg: 'Acordos não podem ser registrados para processos com Origem "Enviado ao Jurídico".' });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    if (acordoExists) {
      setAcordoDlgOpen(true);
      return;
    }
    if (!dlgEdit?.id) {
      setToast({ kind: 'err', title: 'Salve primeiro', msg: 'Salve o registro antes de cadastrar um acordo.' });
      setTimeout(() => setToast(null), 3200);
      return;
    }
    setAcordoForm({
      devedor: acordoForm.devedor,
      numero_processo_ou_extrajudicial: acordoForm.numero_processo_ou_extrajudicial,
      titulos_objeto_cobranca: acordoForm.titulos_objeto_cobranca,
      total_parcelas: acordoForm.total_parcelas,
      valor_parcela: acordoForm.valor_parcela,
      numero_parcela: acordoForm.numero_parcela,
      forma_pagamento: acordoForm.forma_pagamento,
      confirmacao_pagamento: acordoForm.confirmacao_pagamento,
      observacoes: acordoForm.observacoes,
    });
    setAcordoDlgOpen(true);
  };

  const handleSalvarAcordo = async () => {
    const pid = Number(dlgEdit?.id || 0);
    if (!pid) {
      setToast({ kind: 'err', title: 'Salve primeiro', msg: 'Salve o registro antes de cadastrar um acordo.' });
      setTimeout(() => setToast(null), 3200);
      return;
    }
    setAcordoSaving(true);
    try {
      const payload = {
        processo_id: pid,
        devedor: String(acordoForm.devedor || '').trim() || null,
        numero_processo_ou_extrajudicial: String(acordoForm.numero_processo_ou_extrajudicial || '').trim() || null,
        titulos_objeto_cobranca: String(acordoForm.titulos_objeto_cobranca || '').trim() || null,
        total_parcelas: acordoForm.total_parcelas === '' ? 0 : Number(acordoForm.total_parcelas) || 0,
        valor_parcela: acordoForm.valor_parcela === '' ? 0 : Number(String(acordoForm.valor_parcela).replace(/[R$\s.]/g, '').replace(',', '.')) || 0,
        numero_parcela: acordoForm.numero_parcela === '' ? 0 : Number(acordoForm.numero_parcela) || 0,
        forma_pagamento: String(acordoForm.forma_pagamento || '').trim() || null,
        confirmacao_pagamento: String(acordoForm.confirmacao_pagamento || '').trim() || null,
        observacoes: String(acordoForm.observacoes || '').trim() || null,
        requestedByEmail: jurCurrentEmail,
      };
      const url = acordoExists?.id ? `${BACKEND_PREFIX}/acordos/${acordoExists.id}` : `${BACKEND_PREFIX}/acordos`;
      const res = await fetch(url, {
        method: acordoExists?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = 'Tente novamente.';
        try { const t = await res.text(); if (t && t.trim()) msg = t; } catch {}
        if (res.status === 403 || res.status === 401) msg = 'Sem permissão — contate o administrador.';
        throw new Error(msg);
      }
      const saved = await res.json();
      if (saved && typeof saved === 'object') {
        setAcordoExists(saved);
        setAcordoForm({
          devedor: String(saved.devedor ?? ''),
          numero_processo_ou_extrajudicial: String(saved.numero_processo_ou_extrajudicial ?? ''),
          titulos_objeto_cobranca: String(saved.titulos_objeto_cobranca ?? ''),
          total_parcelas: saved.total_parcelas != null ? String(saved.total_parcelas) : '',
          valor_parcela: saved.valor_parcela != null ? String(saved.valor_parcela) : '',
          numero_parcela: saved.numero_parcela != null ? String(saved.numero_parcela) : '',
          forma_pagamento: String(saved.forma_pagamento ?? ''),
          confirmacao_pagamento: String(saved.confirmacao_pagamento ?? ''),
          observacoes: String(saved.observacoes ?? ''),
        });
      }
      setAcordoDlgOpen(false);
      setToast({ kind: 'ok', title: 'Acordo salvo', msg: 'Dados do acordo foram gravados com sucesso.' });
      setTimeout(() => setToast(null), 3200);
      void loadDashboard();
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao salvar acordo', msg: e?.message || 'Tente novamente.' });
      setTimeout(() => setToast(null), 4200);
    } finally {
      setAcordoSaving(false);
    }
  };

  const handleAddAcesso = async () => {
    if (!jurIsAdmin) return;
    const em = String(novoAcesso || '').trim().toLowerCase();
    if (!em) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setToast({ kind: 'err', title: 'E-mail inválido', msg: 'Informe um endereço de e-mail válido.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    if (!em.endsWith('@sicoobjuriscred.com.br')) {
      setToast({
        kind: 'err',
        title: 'Domínio não permitido',
        msg: 'Apenas colaboradores com e-mail @sicoobjuriscred.com.br podem ter acesso.',
      });
      setTimeout(() => setToast(null), 4200);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_PREFIX}/access/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, role: 'usuario', requestedByEmail: jurCurrentEmail }),
      });
      if (!res.ok) {
        let msg = 'Tente novamente em alguns segundos.';
        try { const t = await res.text(); if (t && t.trim()) msg = t; } catch {}
        if (res.status === 403 || res.status === 401) msg = 'Sem permissão — contate o administrador.';
        throw new Error(msg);
      }
      setNovoAcesso('');
      const arr = await fetch(`${BACKEND_PREFIX}/access/emails`).then(r => r.ok ? r.json() : []);
      setAcessosLista(Array.isArray(arr?.entries) ? arr.entries : Array.isArray(arr) ? arr : []);
      setToast({ kind: 'ok', title: 'Acesso adicionado', msg: `${em} agora tem acesso como usuário.` });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao adicionar', msg: e?.message || 'Tente novamente.' });
      setTimeout(() => setToast(null), 4200);
    }
  };

  const isFixedAdminNow = () => (jurCurrentEmail || '').trim().toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase();

  const handleTrocarPerfil = async (email: string, newRole: 'usuario' | 'admin') => {
    if (!jurIsAdmin) return;
    if (email.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase()) {
      setToast({ kind: 'err', title: 'Não pode ser alterado', msg: 'Administrador fixo sempre permanece admin.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    if (newRole === 'admin' && !isFixedAdminNow()) {
      setToast({ kind: 'err', title: 'Sem permissão', msg: `Apenas ${FIXED_ADMIN_EMAIL} pode conceder perfil admin.` });
      setTimeout(() => setToast(null), 4200);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_PREFIX}/access/emails/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, requestedByEmail: jurCurrentEmail || FIXED_ADMIN_EMAIL }),
      });
      if (!res.ok) {
        let msg = 'Tente novamente.';
        try { const t = await res.text(); if (t && t.trim()) msg = t; } catch {}
        if (res.status === 403 || res.status === 401) msg = 'Sem permissão — contate o administrador fixo.';
        throw new Error(msg);
      }
      const arr = await fetch(`${BACKEND_PREFIX}/access/emails`).then(r => r.ok ? r.json() : []);
      setAcessosLista(Array.isArray(arr?.entries) ? arr.entries : Array.isArray(arr) ? arr : []);
      setToast({
        kind: 'ok',
        title: 'Perfil atualizado',
        msg: `${email} agora é ${newRole === 'admin' ? 'Administrador' : 'Usuário'}.`,
      });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao atualizar perfil', msg: e?.message || 'Tente novamente.' });
      setTimeout(() => setToast(null), 4200);
    }
  };

  const handleDelAcesso = async (em: string) => {
    if (!jurIsAdmin) return;
    if (em.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase()) {
      setToast({ kind: 'err', title: 'Não pode ser removido', msg: 'Administrador fixo não pode ser removido.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_PREFIX}/access/emails/${encodeURIComponent(em)}?requestedBy=${encodeURIComponent(jurCurrentEmail || FIXED_ADMIN_EMAIL)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha');
      const arr = await fetch(`${BACKEND_PREFIX}/access/emails`).then(r => r.ok ? r.json() : []);
      setAcessosLista(Array.isArray(arr?.entries) ? arr.entries : Array.isArray(arr) ? arr : []);
      setToast({ kind: 'ok', title: 'Acesso removido', msg: `${em} não tem mais permissão de acesso.` });
      setTimeout(() => setToast(null), 3500);
    } catch {
      setToast({ kind: 'err', title: 'Erro ao remover', msg: 'Tente novamente em alguns segundos.' });
      setTimeout(() => setToast(null), 3500);
    }
  };

  const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim().toLowerCase());

  const handleAddNotifEscritorio = () => {
    const raw = String(novoNotifEscritorio || '').trim().toLowerCase();
    const emails = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const validos = emails.filter(emailValid);
    if (!validos.length) {
      if (raw) {
        setToast({ kind: 'err', title: 'Nenhum e-mail válido', msg: 'Informe ao menos um e-mail válido.' });
        setTimeout(() => setToast(null), 3000);
      }
      return;
    }
    const dup = new Set(notifEscritorio);
    const next = [...notifEscritorio, ...validos.filter(e => !dup.has(e))];
    setNotifEscritorio(next);
    setNovoNotifEscritorio('');
  };
  const handleDelNotifEscritorio = (em: string) => {
    setNotifEscritorio(list => list.filter(e => e !== em));
  };

  const handleAddNotifCobranca = () => {
    const raw = String(novoNotifCobranca || '').trim().toLowerCase();
    const emails = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const validos = emails.filter(emailValid);
    if (!validos.length) {
      if (raw) {
        setToast({ kind: 'err', title: 'Nenhum e-mail válido', msg: 'Informe ao menos um e-mail válido.' });
        setTimeout(() => setToast(null), 3000);
      }
      return;
    }
    const dup = new Set(notifCobranca);
    const next = [...notifCobranca, ...validos.filter(e => !dup.has(e))];
    setNotifCobranca(next);
    setNovoNotifCobranca('');
  };
  const handleDelNotifCobranca = (em: string) => {
    setNotifCobranca(list => list.filter(e => e !== em));
  };

  const handleSalvarNotificacoes = async () => {
    if (!jurIsAdmin) return;
    if (jurSettingsLocked) {
      setToast({ kind: 'err', title: 'Configurações bloqueadas', msg: 'Somente administradores podem alterar.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    try {
      setNotifSaving(true);
      const res = await fetch(`${BACKEND_PREFIX}/config/notificacoes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escritorioJuridico: notifEscritorio,
          cobranca: notifCobranca,
          requestedByEmail: jurCurrentEmail || FIXED_ADMIN_EMAIL,
        }),
      });
      if (!res.ok) {
        let txt = 'Falha ao salvar notificações.';
        try { const err = await res.text(); if (err && err.trim()) txt = err; } catch {}
        if (res.status === 403 || res.status === 401) txt = 'Sem permissão — entre em contato com um administrador.';
        throw new Error(txt);
      }
      const saved = await res.json().catch(() => null);
      if (saved) {
        setNotifEscritorio(Array.isArray(saved.escritorioJuridico) ? saved.escritorioJuridico : []);
        setNotifCobranca(Array.isArray(saved.cobranca) ? saved.cobranca : []);
      }
      setToast({ kind: 'ok', title: 'Salvo com sucesso', msg: 'Destinatários de notificações atualizados.' });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao salvar', msg: e?.message || 'Tente novamente em alguns segundos.' });
      setTimeout(() => setToast(null), 4200);
    } finally {
      setNotifSaving(false);
    }
  };

  const addStatusOption = async (raw: string) => {
    const name = String(raw ?? '').trim();
    if (name.length < 2) {
      setToast({ kind: 'err', title: 'Status inválido', msg: 'Digite pelo menos 2 caracteres.' });
      setTimeout(() => setToast(null), 3300);
      return;
    }
    if (!jurIsAdmin) {
      setToast({ kind: 'err', title: 'Sem permissão', msg: 'Somente administradores podem cadastrar status.' });
      setTimeout(() => setToast(null), 3300);
      return;
    }
    if (jurSettingsLocked) {
      setToast({ kind: 'err', title: 'Configurações bloqueadas', msg: 'Desbloqueie as configurações antes de cadastrar.' });
      setTimeout(() => setToast(null), 3300);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_PREFIX}/config/options/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'statuses', value: name, requestedByEmail: userEmail || undefined }),
      });
      if (!res.ok) {
        let txt = 'Falha ao cadastrar status.';
        try { const err = await res.text(); if (err && err.trim()) txt = err; } catch {}
        if (res.status === 403 || res.status === 401) txt = 'Sem permissão — entre em contato com um administrador.';
        throw new Error(txt);
      }
      const saved = await res.json().catch(() => null);
      const arrSaved: string[] = Array.isArray(saved?.entries) ? saved.entries : Array.isArray(saved) ? saved : [];
      setStatusesOptions(arrSaved);
      setStatusesDistinctDb(prev => {
        const merged = Array.from(new Set([...arrSaved, ...prev]));
        merged.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        return merged;
      });
      setForm(prev => {
        const curStatus = String((prev as any)?.status ?? '').trim();
        if (!curStatus) return { ...prev, status: name };
        return prev;
      });
      setToast({ kind: 'ok', title: 'Status cadastrado', msg: `"${name}" adicionado com sucesso.` });
      setTimeout(() => setToast(null), 3300);
      void loadDashboard();
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao cadastrar', msg: e?.message || 'Tente novamente em alguns segundos.' });
      setTimeout(() => setToast(null), 4200);
    }
  };

  const addGerenteCadastro = async (nomeRaw: string, paRaw: string) => {
    const nome = String(nomeRaw ?? '').trim();
    const pa = String(paRaw ?? '').trim();
    if (nome.length < 2) {
      setToast({ kind: 'err', title: 'Gerente inválido', msg: 'Digite o nome do gerente (mínimo 2 caracteres).' });
      setTimeout(() => setToast(null), 3300);
      return false;
    }
    if (!jurIsAdmin) {
      setToast({ kind: 'err', title: 'Sem permissão', msg: 'Somente administradores podem cadastrar gerentes.' });
      setTimeout(() => setToast(null), 3300);
      return false;
    }
    try {
      setGerenteAddSaving(true);
      const res = await fetch(`${BACKEND_PREFIX}/config/gerentes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, pa, requestedByEmail: userEmail || undefined }),
      });
      if (!res.ok) {
        let txt = 'Falha ao cadastrar gerente.';
        try { const err = await res.text(); if (err && err.trim()) txt = err; } catch {}
        if (res.status === 403 || res.status === 401) txt = 'Sem permissão — entre em contato com um administrador.';
        throw new Error(txt);
      }
      const saved = await res.json().catch(() => null);
      const arrSaved = Array.isArray(saved?.entries) ? saved.entries : [];
      const list = arrSaved
        .map((g: any) => ({ nome: String(g?.nome ?? '').trim(), pa: String(g?.pa ?? '').trim() }))
        .filter((g: any) => g.nome);
      setGerentesCadastro(list);
      setGerentesDistinctDb(prev => {
        const merged = Array.from(new Set([...list.map((g: any) => g.nome), ...prev]));
        merged.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
        return merged;
      });
      setForm(prev => {
        const next: any = { ...prev, gerente: nome };
        if (pa) next.numero_pa_enviados_ajuizamento = pa;
        return next;
      });
      setToast({ kind: 'ok', title: 'Gerente cadastrado', msg: `"${nome}"${pa ? ` — PA ${pa}` : ''} adicionado com sucesso.` });
      setTimeout(() => setToast(null), 3300);
      return true;
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao cadastrar', msg: e?.message || 'Tente novamente em alguns segundos.' });
      setTimeout(() => setToast(null), 4200);
      return false;
    } finally {
      setGerenteAddSaving(false);
    }
  };

  const handleSalvarRegrasPrazos = async () => {
    if (!jurIsAdmin) return;
    if (jurSettingsLocked) {
      setToast({ kind: 'err', title: 'Configurações bloqueadas', msg: 'Somente administradores podem alterar.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    const p1 = Number.isFinite(prazoProtocoloExtraj) ? Math.max(0, Math.floor(prazoProtocoloExtraj)) : 15;
    const p2 = Number.isFinite(prazoAjuizamento) ? Math.max(0, Math.floor(prazoAjuizamento)) : 45;
    try {
      setPrazosSaving(true);
      const res = await fetch(`${BACKEND_PREFIX}/config/regras-prazos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prazoProtocoloExtrajudicialDias: p1,
          prazoAjuizamentoDias: p2,
          requestedByEmail: jurCurrentEmail || FIXED_ADMIN_EMAIL,
        }),
      });
      if (!res.ok) {
        let txt = 'Falha ao salvar regras de prazos.';
        try { const err = await res.text(); if (err && err.trim()) txt = err; } catch {}
        if (res.status === 403 || res.status === 401) txt = 'Sem permissão — entre em contato com um administrador.';
        throw new Error(txt);
      }
      const saved = await res.json().catch(() => null);
      if (saved) {
        setPrazoProtocoloExtraj(Number.isFinite(saved?.prazoProtocoloExtrajudicialDias) ? Math.max(0, Math.floor(saved.prazoProtocoloExtrajudicialDias)) : p1);
        setPrazoAjuizamento(Number.isFinite(saved?.prazoAjuizamentoDias) ? Math.max(0, Math.floor(saved.prazoAjuizamentoDias)) : p2);
      }
      setToast({ kind: 'ok', title: 'Salvo com sucesso', msg: 'Regras de prazos atualizadas.' });
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast({ kind: 'err', title: 'Erro ao salvar', msg: e?.message || 'Tente novamente em alguns segundos.' });
      setTimeout(() => setToast(null), 4200);
    } finally {
      setPrazosSaving(false);
    }
  };

  const mesesLabels = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => monthLabel(i + 1)), []);

  const iconAnimOptions = useMemo(() => [
    { name: 'pulse-scale', dur: 1200 },
    { name: 'wiggle-x', dur: 1500 },
    { name: 'shake-fine', dur: 900 },
    { name: 'swing-rotate', dur: 1400 },
    { name: 'pop-3d', dur: 1100 },
    { name: 'bounce-soft', dur: 1300 },
    { name: 'spin-mini', dur: 1600 },
    { name: 'rubber-band', dur: 1250 },
    { name: 'jello', dur: 1450 },
    { name: 'tada', dur: 1550 },
    { name: 'float-y', dur: 1800 },
    { name: 'squash-x', dur: 1000 },
    { name: 'flash-color', dur: 1350 },
    { name: 'heartbeat', dur: 1500 },
    { name: 'orbit-tilt', dur: 1700 },
    /* === NOVAS 15 ANIMAÇÕES MODERNAS === */
    { name: 'neon-strobe', dur: 1400 },
    { name: 'hue-orbit', dur: 2200 },
    { name: 'shockwave', dur: 1500 },
    { name: 'crt-scanline', dur: 1600 },
    { name: 'lightning', dur: 950 },
    { name: 'roll-3d', dur: 1350 },
    { name: 'skew-wave', dur: 1450 },
    { name: 'flip-card-3d', dur: 1250 },
    { name: 'neon-breath', dur: 2400 },
    { name: 'morph-blob', dur: 1700 },
    { name: 'ripple-morph', dur: 1850 },
    { name: 'glitch-rgb', dur: 1050 },
    { name: 'tilt-focus', dur: 1550 },
    { name: 'squash-stretch', dur: 1150 },
    { name: 'zoom-flicker', dur: 1300 },
  ], []);

  const iconTextAnimOptions = useMemo(() => [
    { name: 'simple-fade', dur: 450, keep: 2500 },
  ], []);

  useEffect(() => {
    let t1 = 0;
    let t2 = 0;
    let tTxt = 0;
    let tTxtHide = 0;
    const maybeShowText = () => {
      // ~48% de chance de mostrar o texto a cada gatilho
      if (Math.random() < 0.48) {
        const t = iconTextAnimOptions[Math.floor(Math.random() * iconTextAnimOptions.length)];
        setIconTextAnimId(iconTextAnimOptions.indexOf(t));
        const posPool: Array<'front'|'back'> = ['front','back'];
        setIconTextPos(posPool[Math.floor(Math.random() * posPool.length)]);
        setIconTextKey(k => k + 1);
        setIconTextShow(true);
        window.clearTimeout(tTxtHide);
        tTxtHide = window.setTimeout(() => setIconTextShow(false), t.dur + t.keep);
      }
    };
    const swapAnim = () => {
      setIconAnimId(Math.floor(Math.random() * iconAnimOptions.length));
      setIconAnimKey(k => k + 1);
      maybeShowText();
      const next = 2200 + Math.floor(Math.random() * 5200);
      t1 = window.setTimeout(swapAnim, next);
    };
    t1 = window.setTimeout(swapAnim, 900);
    // texto ocasional independente das trocas de animação do ícone
    const textLoop = () => {
      const wait = 7000 + Math.floor(Math.random() * 11000);
      tTxt = window.setTimeout(() => {
        maybeShowText();
        textLoop();
      }, wait);
    };
    textLoop();
    t2 = window.setInterval(() => { setIconAnimKey(k => k + 0.00001); }, 30000);
    return () => {
      window.clearTimeout(t1);
      window.clearInterval(t2);
      window.clearTimeout(tTxt);
      window.clearTimeout(tTxtHide);
    };
  }, [iconAnimOptions, iconTextAnimOptions]);

  const activeIconAnim = iconAnimOptions[iconAnimId] ?? iconAnimOptions[0];

  const chartOption = useMemo(() => {
    const ativoArr = Array.from({ length: 12 }, (_, i) =>
      chartData.find(d => d.mes === i + 1)?.ativo ?? 0);
    const passivoArr = Array.from({ length: 12 }, (_, i) =>
      chartData.find(d => d.mes === i + 1)?.passivo ?? 0);
    const acordosArr = Array.from({ length: 12 }, (_, i) =>
      chartData.find(d => d.mes === i + 1)?.acordos ?? 0);
    const mesSel = mes ? parseInt(mes, 10) : null;
    const activeMonth = chartHoverMonth ?? mesSel;
    const allSeriesValues = [...ativoArr, ...passivoArr, ...acordosArr]
      .map((v) => Number(v) || 0)
      .filter((v) => v > 0);
    const sortedSeriesValues = [...allSeriesValues].sort((a, b) => b - a);
    const maxVal = sortedSeriesValues[0] ?? 0;

    const calcNiceStep = (value: number) => {
      if (!Number.isFinite(value) || value <= 0) return 1;
      const magnitude = 10 ** Math.floor(Math.log10(value));
      const normalized = value / magnitude;
      if (normalized <= 1) return magnitude;
      if (normalized <= 2) return 2 * magnitude;
      if (normalized <= 5) return 5 * magnitude;
      return 10 * magnitude;
    };

    const calcAxisInterval = (value: number, approxTicks = 5) => {
      const base = Math.max(value / Math.max(approxTicks, 1), 1);
      return calcNiceStep(base);
    };

    const calcAxisMax = (value: number, approxTicks = 5) => {
      const interval = calcAxisInterval(value, approxTicks);
      return Math.max(interval, Math.ceil(Math.max(value, 1) / interval) * interval);
    };

    const formatAxisMoney = (v: number) => {
      if (v === 0) return '0';
      const abs = Math.abs(v);
      if (abs >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
      if (abs >= 1000) return `${Math.round(v / 1000)}k`;
      return `${Math.round(v)}`;
    };

      const useAxisBreak = false;
    const AXIS_BREAK_LOW_MAX = useAxisBreak
      ? calcAxisMax(Math.max(maxVal * 0.06, 350000), 4)
      : 0;
    const AXIS_BREAK_HIGH_MIN = useAxisBreak
      ? Math.max(AXIS_BREAK_LOW_MAX + calcAxisInterval(AXIS_BREAK_LOW_MAX, 4), Math.floor((maxVal * 0.72) / 100000) * 100000)
      : 0;
    const AXIS_BREAK_HIGH_MAX = useAxisBreak
      ? calcAxisMax(maxVal * 1.02, 4)
      : 0;
    const upperBandMax = useAxisBreak ? Math.max(AXIS_BREAK_HIGH_MAX - AXIS_BREAK_HIGH_MIN, 0) : 0;
    const singleAxisTickCount = maxVal >= 10000000 ? 6 : 5;
    const singleAxisBaseMax = maxVal > 0 ? maxVal * (maxVal >= 10000000 ? 1.05 : 1.08) : 1000000;
    const singleAxisInterval = calcAxisInterval(singleAxisBaseMax, singleAxisTickCount);
    const singleAxisMax = Math.max(
      singleAxisInterval * singleAxisTickCount,
      Math.ceil(Math.max(singleAxisBaseMax, 1) / singleAxisInterval) * singleAxisInterval,
    );

    const formatCompactMoney = (v: number) => {
      if (v <= 0) return '';
      const abs = Math.abs(v);
      if (abs >= 1000000) {
        return 'R$ ' + (v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'M';
      } else if (abs >= 1000) {
        return 'R$ ' + Math.round(v / 1000).toLocaleString('pt-BR') + 'k';
      }
      return brl(v);
    };

    const formatVariacaoPct = (passivo: number, ativo: number) => {
      if (!(passivo > 0) || !(ativo >= 0)) return null;
      const pct = ((ativo - passivo) / passivo) * 100;
      const sign = pct > 0 ? '+' : '';
      return {
        pct,
        label: `${sign}${Math.round(pct).toLocaleString('pt-BR')}%`,
        direction: pct >= 0 ? 'up' : 'down',
      } as const;
    };
      const movingAverageAtivoArr = ativoArr.map((_value, index, arr) => {
        const start = Math.max(0, index - 2);
        const window = arr.slice(start, index + 1).map((v) => Number(v) || 0);
        const total = window.reduce((sum, item) => sum + item, 0);
        return window.length ? total / window.length : 0;
      });

    const labelFromValue = (v: number, mode: 'lower' | 'upper') => {
      const base: any = {
        show: v > 0,
        rotate: 90,
        position: mode === 'upper' ? 'inside' : 'top',
        distance: mode === 'upper' ? 0 : 4,
        formatter: () => formatCompactMoney(v),
        fontSize: 10.5,
        fontFamily: "'Fira Sans', sans-serif",
        fontWeight: 700,
        align: mode === 'upper' ? 'center' : 'left',
        verticalAlign: mode === 'upper' ? 'middle' : 'middle',
      };
      const cardStyle = {
        color: '#003641',
        backgroundColor: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255,255,255,0.96)' },
            { offset: 1, color: 'rgba(239,252,251,0.99)' },
          ],
        },
        borderColor: 'rgba(0, 174, 157, 0.35)',
        borderWidth: 1,
        borderRadius: [4, 6, 6, 4],
        padding: [4, 6, 4, 7],
        extraCssText: `border-left: 3px solid; border-image: linear-gradient(180deg, #33C5B8 0%, #00AE9D 100%) 1; box-shadow: 0 3px 8px rgba(0,54,65,0.09);`,
      };
      if (mode === 'upper') {
        return {
          ...base,
          ...cardStyle,
          offset: [0, 0],
        };
      }
      return {
        ...base,
        ...cardStyle,
      };
    };

    const buildBarStyle = (
      kind: 'passivo' | 'ativo' | 'acordos',
      index: number,
      borderRadius: number[],
    ) => {
      const selected = activeMonth === index + 1;
        const legendMatched = !chartLegendHover || chartLegendHover === kind;
      const palette = kind === 'passivo'
        ? {
            top: selected ? '#3A7A88' : '#1D5A68',
            mid: selected ? '#2C6672' : '#114856',
            bottom: selected ? '#214D57' : '#003641',
            border: selected ? 'rgba(129, 191, 205, 0.92)' : 'rgba(132, 199, 214, 0.54)',
            glow: selected ? 'rgba(42, 98, 112, 0.34)' : 'rgba(0, 54, 65, 0.20)',
          }
        : kind === 'ativo'
          ? {
                top: selected ? '#A9D94D' : '#8BC22A',
              mid: selected ? '#A9D94D' : '#8BC22A',
              bottom: selected ? '#8CC62B' : '#7DB61C',
              border: selected ? 'rgba(237, 255, 181, 0.96)' : 'rgba(230, 255, 169, 0.58)',
              glow: selected ? 'rgba(150, 203, 58, 0.34)' : 'rgba(125, 182, 28, 0.22)',
            }
          : {
              top: selected ? '#FFD28D' : '#FFC068',
              mid: selected ? '#FFBE61' : '#FFA62B',
              bottom: selected ? '#FFA739' : '#FB8C00',
              border: selected ? 'rgba(255, 236, 188, 0.96)' : 'rgba(255, 221, 170, 0.56)',
              glow: selected ? 'rgba(255, 183, 77, 0.30)' : 'rgba(251, 140, 0, 0.18)',
            };
      return {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: palette.top },
            { offset: 0.38, color: palette.mid },
            { offset: 1, color: palette.bottom },
          ],
        },
          opacity: (activeMonth && activeMonth !== index + 1 ? 0.42 : 1) * (legendMatched ? 1 : 0.16),
        borderRadius,
        borderWidth: 1,
        borderColor: palette.border,
          shadowBlur: legendMatched ? (selected ? 14 : 9) : 0,
        shadowColor: palette.glow,
        shadowOffsetY: 3,
      };
    };
    const hiddenBarStyle = {
      opacity: 0,
      borderWidth: 0,
      shadowBlur: 0,
      shadowOffsetY: 0,
      color: 'rgba(0,0,0,0)',
    };
    const variacaoPorMes = Array.from({ length: 12 }, (_, i) => formatVariacaoPct(passivoArr[i] ?? 0, ativoArr[i] ?? 0));
    const formatMonthAxisLabel = (index: number) => {
      const mesLabel = mesesLabels[index] ?? '';
      const variacao = variacaoPorMes[index];
      if (!variacao) return `{mes|${mesLabel}}`;
      const richKey = variacao.direction === 'down' ? 'varDown' : 'varUp';
      const arrow = variacao.direction === 'down' ? '▼' : '▲';
      return `{mes|${mesLabel}}\n{${richKey}|${arrow} ${variacao.label}}`;
    };

    const buildSingleAxisBarData = (
      values: number[],
        kind: 'passivo' | 'ativo' | 'acordos',
    ) => values.map((v, i) => ({
      value: v,
      rawValue: v,
        itemStyle: buildBarStyle(kind, i, [8, 8, 3, 3]),
      label: labelFromValue(v, 'lower'),
    }));
      const buildMovingAverageData = (clampMax?: number) => movingAverageAtivoArr.map((value, index) => ({
        value: clampMax && value > clampMax ? clampMax : value,
        rawValue: value,
        symbolSize: activeMonth === index + 1 ? 9 : 7,
        itemStyle: {
          color: '#00AE9D',
          borderColor: '#F7FFFE',
          borderWidth: 1.4,
          opacity: (activeMonth && activeMonth !== index + 1 ? 0.48 : 1) * (!chartLegendHover || chartLegendHover === 'mm3' ? 1 : 0.14),
          shadowBlur: !chartLegendHover || chartLegendHover === 'mm3' ? (activeMonth === index + 1 ? 10 : 6) : 0,
          shadowColor: 'rgba(0, 174, 157, 0.28)',
        },
      }));

    const chartGrid = useAxisBreak
      ? [
          { left: 46, right: 20, top: 36, height: 70 },
          { left: 46, right: 20, top: 106, bottom: 62 },
        ]
      : { left: 46, right: 20, top: 34, bottom: 60 };

    const chartXAxis = useAxisBreak
      ? [
          {
            type: 'category',
            gridIndex: 0,
            data: mesesLabels,
            axisLabel: { show: false },
            axisTick: { show: false },
            axisLine: { show: false },
          },
          {
            type: 'category',
            gridIndex: 1,
            data: mesesLabels,
            axisLabel: {
              interval: 0,
              rotate: 0,
              margin: 12,
              formatter: (_value: string, index: number) => formatMonthAxisLabel(index),
              rich: {
                mes: { color: '#003641', fontSize: 11, fontWeight: 700, lineHeight: 14 },
                varUp: {
                  color: '#5E8A18',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: 18,
                  backgroundColor: 'rgba(232, 246, 236, 0.98)',
                  borderColor: 'rgba(143, 191, 70, 0.28)',
                  borderWidth: 1,
                  borderRadius: 9,
                  padding: [2, 6, 2, 6],
                },
                varDown: {
                  color: '#B64141',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: 18,
                  backgroundColor: 'rgba(252, 239, 239, 0.98)',
                  borderColor: 'rgba(226, 85, 85, 0.22)',
                  borderWidth: 1,
                  borderRadius: 9,
                  padding: [2, 6, 2, 6],
                },
              },
            },
            axisTick: { alignWithLabel: true },
            axisLine: { lineStyle: { color: 'rgba(0,54,65,0.35)' } },
          },
        ]
      : {
          type: 'category',
          data: mesesLabels,
          axisLabel: {
            interval: 0,
            rotate: 0,
            margin: 12,
            formatter: (_value: string, index: number) => formatMonthAxisLabel(index),
            rich: {
              mes: { color: '#003641', fontSize: 11, fontWeight: 700, lineHeight: 14 },
              varUp: {
                color: '#5E8A18',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 18,
                backgroundColor: 'rgba(232, 246, 236, 0.98)',
                borderColor: 'rgba(143, 191, 70, 0.28)',
                borderWidth: 1,
                borderRadius: 9,
                padding: [2, 6, 2, 6],
              },
              varDown: {
                color: '#B64141',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 18,
                backgroundColor: 'rgba(252, 239, 239, 0.98)',
                borderColor: 'rgba(226, 85, 85, 0.22)',
                borderWidth: 1,
                borderRadius: 9,
                padding: [2, 6, 2, 6],
              },
            },
          },
          axisTick: { alignWithLabel: true },
          axisLine: { lineStyle: { color: 'rgba(0,54,65,0.35)' } },
        };

    const chartYAxis = useAxisBreak
      ? [
          {
            type: 'value',
            gridIndex: 0,
            min: 0,
            max: upperBandMax,
            interval: calcAxisInterval(upperBandMax || 1, 4),
            axisLabel: {
              showMaxLabel: false,
              color: '#003641', fontSize: 11, fontWeight: 600,
              formatter: (v: number) => formatAxisMoney(AXIS_BREAK_HIGH_MIN + v),
            },
            splitLine: { lineStyle: { color: 'rgba(125, 182, 28, 0.18)', type: 'dashed' } },
          },
          {
            type: 'value',
            gridIndex: 1,
            min: 0,
            max: AXIS_BREAK_LOW_MAX,
            interval: calcAxisInterval(AXIS_BREAK_LOW_MAX || 1, 4),
            axisLabel: {
              showMaxLabel: false,
              color: '#003641', fontSize: 11, fontWeight: 600,
              formatter: (v: number) => formatAxisMoney(v),
            },
            splitLine: { lineStyle: { color: 'rgba(125, 182, 28, 0.18)', type: 'dashed' } },
          },
        ]
        : [
            {
              type: 'value',
              min: 0,
              max: singleAxisMax,
              interval: singleAxisInterval,
              splitNumber: singleAxisTickCount,
              axisLabel: {
                showMaxLabel: false,
                color: '#003641', fontSize: 11, fontWeight: 600,
                formatter: (v: number) => formatAxisMoney(v),
              },
              splitLine: { lineStyle: { color: 'rgba(125, 182, 28, 0.18)', type: 'dashed' } },
          },
          ];

    const chartSeries = useAxisBreak
      ? [
          {
            name: 'Passivo', type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
              legendHoverLink: false,
            color: '#003641',
            clip: false,
            barWidth: 30,
            barMinHeight: 0,
            data: passivoArr.map((v, i) => {
              const upperValue = v >= AXIS_BREAK_HIGH_MIN ? Math.min(v, AXIS_BREAK_HIGH_MAX) - AXIS_BREAK_HIGH_MIN : 0;
              return ({
              value: upperValue,
              rawValue: v,
              itemStyle: upperValue > 0 ? buildBarStyle('passivo', i, [8, 8, 0, 0]) : hiddenBarStyle,
              label: v >= AXIS_BREAK_HIGH_MIN ? labelFromValue(v, 'upper') : { show: false },
            })}),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Ativo', type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
              legendHoverLink: false,
            color: '#7DB61C',
            clip: false,
            barWidth: 30,
            barMinHeight: 0,
            data: ativoArr.map((v, i) => {
              const upperValue = v >= AXIS_BREAK_HIGH_MIN ? Math.min(v, AXIS_BREAK_HIGH_MAX) - AXIS_BREAK_HIGH_MIN : 0;
              return ({
              value: upperValue,
              rawValue: v,
              itemStyle: upperValue > 0 ? buildBarStyle('ativo', i, [8, 8, 0, 0]) : hiddenBarStyle,
              label: v >= AXIS_BREAK_HIGH_MIN ? labelFromValue(v, 'upper') : { show: false },
            })}),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Acordos', type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
              legendHoverLink: false,
            color: '#FB8C00',
            clip: false,
            barWidth: 30,
            barMinHeight: 0,
            data: acordosArr.map((v, i) => {
              const upperValue = v >= AXIS_BREAK_HIGH_MIN ? Math.min(v, AXIS_BREAK_HIGH_MAX) - AXIS_BREAK_HIGH_MIN : 0;
              return ({
              value: upperValue,
              rawValue: v,
              itemStyle: upperValue > 0 ? buildBarStyle('acordos', i, [8, 8, 0, 0]) : hiddenBarStyle,
              label: v >= AXIS_BREAK_HIGH_MIN ? labelFromValue(v, 'upper') : { show: false },
            })}),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Passivo', type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
              legendHoverLink: false,
            color: '#003641',
            clip: false,
            barWidth: 30,
            barMinHeight: 10,
            data: passivoArr.map((v, i) => ({
              value: Math.min(v, AXIS_BREAK_LOW_MAX),
              rawValue: v,
              itemStyle: buildBarStyle('passivo', i, v >= AXIS_BREAK_HIGH_MIN ? [0, 0, 0, 0] : [8, 8, 3, 3]),
              label: v >= AXIS_BREAK_HIGH_MIN ? { show: false } : labelFromValue(v, 'lower'),
            })),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Ativo', type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
              legendHoverLink: false,
            color: '#7DB61C',
            clip: false,
            barWidth: 30,
            barMinHeight: 10,
            data: ativoArr.map((v, i) => ({
              value: Math.min(v, AXIS_BREAK_LOW_MAX),
              rawValue: v,
              itemStyle: buildBarStyle('ativo', i, v >= AXIS_BREAK_HIGH_MIN ? [0, 0, 0, 0] : [8, 8, 3, 3]),
              label: v >= AXIS_BREAK_HIGH_MIN ? { show: false } : labelFromValue(v, 'lower'),
            })),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Acordos', type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
              legendHoverLink: false,
            color: '#FB8C00',
            clip: false,
            barWidth: 30,
            barMinHeight: 10,
            data: acordosArr.map((v, i) => ({
              value: Math.min(v, AXIS_BREAK_LOW_MAX),
              rawValue: v,
              itemStyle: buildBarStyle('acordos', i, v >= AXIS_BREAK_HIGH_MIN ? [0, 0, 0, 0] : [8, 8, 3, 3]),
              label: v >= AXIS_BREAK_HIGH_MIN ? { show: false } : labelFromValue(v, 'lower'),
            })),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
            {
              name: 'MM3 Ativo', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
                legendHoverLink: false,
              smooth: 0.28,
              symbol: 'circle',
              showSymbol: true,
              connectNulls: true,
              z: 20,
              data: buildMovingAverageData(AXIS_BREAK_LOW_MAX),
              lineStyle: {
                color: '#00AE9D',
                width: 2.6,
                type: 'dashed',
                  opacity: !chartLegendHover || chartLegendHover === 'mm3' ? 1 : 0.14,
                shadowBlur: 8,
                shadowColor: 'rgba(0, 174, 157, 0.18)',
              },
              itemStyle: {
                color: '#00AE9D',
                borderColor: '#F7FFFE',
                borderWidth: 1.4,
              },
              emphasis: { focus: 'series' },
            },
        ]
      : [
          {
            name: 'Passivo', type: 'bar',
              legendHoverLink: false,
            color: '#003641',
            clip: false,
            barWidth: 34,
            barMinHeight: 10,
            data: buildSingleAxisBarData(passivoArr, 'passivo'),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Ativo', type: 'bar',
              legendHoverLink: false,
            color: '#7DB61C',
            clip: false,
            barWidth: 34,
            barMinHeight: 10,
            data: buildSingleAxisBarData(ativoArr, 'ativo'),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
          {
            name: 'Acordos', type: 'bar',
              legendHoverLink: false,
            color: '#FB8C00',
            clip: false,
            barWidth: 34,
            barMinHeight: 10,
            data: buildSingleAxisBarData(acordosArr, 'acordos'),
            labelLayout: { hideOverlap: false },
            emphasis: { focus: 'series', itemStyle: { shadowBlur: 18, shadowOffsetY: 4 } },
          },
            {
              name: 'MM3 Ativo', type: 'line', yAxisIndex: 0,
                legendHoverLink: false,
              smooth: 0.28,
              symbol: 'circle',
              showSymbol: true,
              connectNulls: true,
              z: 20,
              data: buildMovingAverageData(),
              lineStyle: {
                color: '#00AE9D',
                width: 2.6,
                type: 'dashed',
                  opacity: !chartLegendHover || chartLegendHover === 'mm3' ? 1 : 0.14,
                shadowBlur: 8,
                shadowColor: 'rgba(0, 174, 157, 0.18)',
              },
              itemStyle: {
                color: '#00AE9D',
                borderColor: '#F7FFFE',
                borderWidth: 1.4,
              },
              emphasis: { focus: 'series' },
            },
        ];

    return {
      animationDuration: 240,
      grid: chartGrid,
        legend: [
          {
              show: false, top: 4, right: 6,
            legendHoverLink: false,
            textStyle: { color: '#003641', fontSize: 12, fontWeight: 650 },
            data: ['Passivo', 'Ativo', 'Acordos'],
            icon: 'roundRect',
            itemWidth: 14, itemHeight: 10,
            itemGap: 16,
          },
          {
              show: false, top: 28, right: 6,
            legendHoverLink: false,
            textStyle: { color: '#003641', fontSize: 11.5, fontWeight: 600 },
            data: [{ name: 'MM3 Ativo', icon: 'roundRect' }],
            formatter: (name: string) => (name === 'MM3 Ativo' ? 'Média Móvel 3 meses' : name),
            itemWidth: 14, itemHeight: 10,
            itemGap: 16,
          },
        ],
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const rows = Array.isArray(params) ? params : [params];
          const axisValue = rows.find((p: any) => p?.axisValueLabel)?.axisValueLabel ?? '';
          const byName = new Map<string, { color: string; value: number }>();
          for (const row of rows) {
            const name = String(row?.seriesName ?? '').trim();
            if (!name) continue;
            const rawValue = Number(row?.data?.rawValue ?? row?.data?.value ?? 0);
            const color = typeof row?.color === 'string'
              ? row.color
                : (name === 'Passivo'
                  ? '#003641'
                  : name === 'Ativo'
                    ? '#7DB61C'
                    : name === 'Acordos'
                      ? '#FB8C00'
                      : '#00AE9D');
            const prev = byName.get(name);
            if (!prev || rawValue > prev.value) byName.set(name, { color, value: rawValue });
          }
            const lines = ['Passivo', 'Ativo', 'Acordos', 'MM3 Ativo']
            .filter((name) => byName.has(name))
            .map((name) => {
              const item = byName.get(name)!;
                const label = name === 'MM3 Ativo' ? 'Média Móvel 3 meses' : name;
                return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <span style="width:10px;height:10px;border-radius:3px;background:${item.color};display:inline-block;"></span>
                  <span style="font-weight:700;min-width:56px;">${label}</span>
                <span>${brl(item.value)}</span>
              </div>`;
            })
            .join('');
          return `<div style="font-weight:800;margin-bottom:2px;">${axisValue}</div>${lines}`;
        },
        backgroundColor: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255,255,255,0.985)' },
            { offset: 1, color: 'rgba(241,252,251,0.985)' },
          ],
        },
        borderColor: 'rgba(0, 174, 157, 0.40)',
        borderWidth: 1,
        padding: [10, 13, 11, 14],
        textStyle: { color: '#003641', fontSize: 12, fontWeight: 700, fontFamily: "'Fira Sans', sans-serif" },
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,174,157,0.10)' } },
        extraCssText: `border-radius: 10px 12px 12px 10px; border-left: 4px solid; border-image: linear-gradient(180deg, #33C5B8 0%, #00AE9D 100%) 1; box-shadow: 0 10px 24px rgba(0,54,65,0.13), 0 2px 6px rgba(0,54,65,0.08);`,
      },
      axisPointer: useAxisBreak ? { link: [{ xAxisIndex: [0, 1] }] } : undefined,
      xAxis: chartXAxis,
      yAxis: chartYAxis,
      graphic: [],
      barGap: '0%',
      barCategoryGap: '30%',
      series: chartSeries,
    };
  }, [chartData, mesesLabels, ano, mes, origem, nome, status, natureza, lacunasFiltro, chartHoverMonth, chartLegendHover]);

  const juridicoChartEvents = useMemo(() => ({
    mousemove: (event: any) => {
      const dataIndex = Number(event?.dataIndex);
      if (Number.isFinite(dataIndex) && dataIndex >= 0) {
        setChartHoverMonth(Math.max(1, Math.min(12, dataIndex + 1)));
        return;
      }
      clearChartSeriesHover();
    },
    updateAxisPointer: (event: any) => {
      const info = Array.isArray(event?.axesInfo) ? event.axesInfo[0] : null;
      if (!info) {
        clearChartSeriesHover();
        return;
      }
      const rawValue = info.value ?? info.axisValue ?? null;
      if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        setChartHoverMonth(Math.max(1, Math.min(12, rawValue + 1)));
        return;
      }
      const monthIndex = mesesLabels.findIndex((label) => label === String(rawValue ?? '').trim());
      setChartHoverMonth(monthIndex >= 0 ? monthIndex + 1 : null);
    },
    mouseout: clearChartSeriesHover,
    globalout: clearChartSeriesHover,
  }), [clearChartSeriesHover, mesesLabels]);

  useEffect(() => {
    const chart = juridicoChartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    const dom = chart.getDom?.();
    const zr = chart.getZr?.();
    if (!dom || !zr) return;

    const clearHover = () => clearChartSeriesHover();
    const clearHoverFromZr = (event?: any) => {
      if (!event?.target) clearChartSeriesHover();
    };

    dom.addEventListener('mouseleave', clearHover);
    dom.addEventListener('pointerleave', clearHover);
    zr.on('globalout', clearHover);
    zr.on('mouseout', clearHoverFromZr);

    return () => {
      dom.removeEventListener('mouseleave', clearHover);
      dom.removeEventListener('pointerleave', clearHover);
      zr.off('globalout', clearHover);
      zr.off('mouseout', clearHoverFromZr);
    };
  }, [chartOption, clearChartSeriesHover]);

  const chipsAplicados = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {ano && <span className="chip" style={chipStyle}>Ano: {ano}</span>}
      {mes && <span className="chip" style={chipStyle}>Mês: {monthLabel(parseInt(mes, 10))}</span>}
      {origem && <span className="chip" style={chipStyle}>Origem: {origem}</span>}
      {nome && <span className="chip" style={chipStyle}>Consulta: {nome}</span>}
    </div>
  );

  const iconBtnBase: React.CSSProperties = {
    width: 32, height: 32, minWidth: 32,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, border: 0, padding: 0, margin: 0, lineHeight: 0,
    background: 'transparent', cursor: 'pointer',
  };

  const headerAvatarInit = userName?.trim()
    ? userName.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div id="juridico-root" style={{
      minHeight: '100vh',
      background: [
        'radial-gradient(1100px 500px at 90% -10%, rgba(0,174,157,0.12), transparent 60%)',
        'radial-gradient(900px 500px at -10% 0%, rgba(125,182,28,0.12), transparent 60%)',
        'linear-gradient(180deg, #F6FAF9 0%, #EEF5F3 45%, #F3F7F6 100%)',
      ].join(','),
      color: '#003641',
      fontFamily: "'Fira Sans', 'Segoe UI', Arial, sans-serif",
      '--trust-navy': '#003641',
      '--trust-teal': '#00AE9D',
      '--trust-green': '#7DB61C',
      '--trust-green+1': '#96CB3A',
      '--trust-green-1': '#6A9F16',
      '--ln-navy': 'rgba(0, 54, 65, 0.14)',
      '--card-navy': 'rgba(255,255,255,0.72)',
      '--shadow-lg-navy': '0 16px 36px rgba(0, 54, 65, 0.10)',
      '--tx': '#003641',
      '--a': '#00AE9D',
      '--b': '#003641',
      '--c': '#7DB61C',
      '--ok': '#7DB61C',
      '--trend-up': '#7DB61C',
      '--trend-down': '#0B8077',
      '--warn': '#003641',
      '--neg': '#003641',
    } as React.CSSProperties}>
      <style>{`
        #juridico-root * { box-sizing: border-box; }
        #juridico-root input, #juridico-root select, #juridico-root textarea {
          font-family: "Fira Sans", "Segoe UI", Arial, sans-serif;
          font-size: 14px; color: #003641;
        }
        #juridico-root table th, #juridico-root table td { font-family: "Fira Sans", "Segoe UI", Arial, sans-serif; }
        #juridico-root .mono { font-family: "Fira Code", ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
        #juridico-root .interactive:hover { filter: brightness(1.05) saturate(1.08); }
        #juridico-root .interactive:active { transform: translateY(1px); }
        #juridico-root .interactive { transition: all 120ms ease-out; }
        #juridico-root .chip {
          background: rgba(0, 54, 65, 0.96);
          color: #FFFFFF;
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 12px;
          letter-spacing: 0.02em;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(0, 174, 157, 0.45);
        }
        #juridico-root .trendChip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 650; letter-spacing: 0.02em;
        }
        #juridico-root .trendGood { background: rgba(150,203,58,0.18); color: #6A9F16; border: 1px solid rgba(125,182,28,0.35); }
        #juridico-root .trendBad  { background: rgba(0,174,157,0.14); color: #0B8077; border: 1px solid rgba(0,174,157,0.40); }
        #juridico-root .trendFlat { background: rgba(0,54,65,0.10); color: #003641; border: 1px solid rgba(0,54,65,0.25); }
        #juridico-root .natureza-dot-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 10px;
          height: 10px;
          flex: 0 0 10px;
          overflow: visible;
        }
        #juridico-root .natureza-dot-core {
          position: relative;
          z-index: 2;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.10);
        }
        #juridico-root .natureza-dot-wave {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1.5px solid rgba(125,182,28,0.38);
          transform: translate(-50%, -50%) scale(0.72);
          opacity: 0;
          pointer-events: none;
        }
        #juridico-root .natureza-dot-wrap.is-ativo .natureza-dot-core {
          animation: natureza-ativo-pulse 1.9s ease-in-out infinite;
          box-shadow: 0 0 0 0 rgba(125,182,28,0.0);
        }
        #juridico-root .natureza-dot-wrap.is-ativo .natureza-dot-wave.wave-1 {
          animation: natureza-ativo-wave 1.9s ease-out infinite;
        }
        #juridico-root .natureza-dot-wrap.is-ativo .natureza-dot-wave.wave-2 {
          animation: natureza-ativo-wave 1.9s ease-out 0.95s infinite;
        }
        @keyframes natureza-ativo-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(125,182,28,0.0);
            filter: brightness(1);
          }
          35% {
            transform: scale(1.18);
            box-shadow: 0 0 10px rgba(125,182,28,0.40);
            filter: brightness(1.08);
          }
          55% {
            transform: scale(0.96);
            box-shadow: 0 0 4px rgba(125,182,28,0.18);
            filter: brightness(1);
          }
        }
        @keyframes natureza-ativo-wave {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.72);
          }
          18% {
            opacity: 0.42;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(2.45);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          #juridico-root .natureza-dot-wrap.is-ativo .natureza-dot-core,
          #juridico-root .natureza-dot-wrap.is-ativo .natureza-dot-wave {
            animation: none !important;
          }
        }
        #juridico-root .cornerBar {
          position: absolute; top: 0; bottom: 0; left: 0; width: 4px;
          border-radius: 10px 0 0 10px;
        }
        #juridico-root aside .filter-wrap label {
          font-size: 11px; color: rgba(255,255,255,0.82); opacity: 0.95;
          text-transform: uppercase; letter-spacing: 0.08em;
          font-weight: 650; display: block; margin-bottom: 6px;
        }
        #juridico-root aside .filter-wrap .field,
        #juridico-root aside .filter-wrap input,
        #juridico-root aside .filter-wrap select {
          width: 100%;
          padding: 10px 12px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.08);
          box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset;
          outline: none;
          color: #FFFFFF;
        }
        #juridico-root aside .filter-wrap input::placeholder { color: rgba(255,255,255,0.45); }
        #juridico-root aside .filter-wrap option { background: #003641; color: #FFFFFF; }
        #juridico-root aside .filter-wrap input:focus,
        #juridico-root aside .filter-wrap select:focus {
          border-color: rgba(125,182,28,0.65);
          box-shadow: 0 0 0 3px rgba(125,182,28,0.18);
        }

        /* === ANIMAÇÕES ALEATÓRIAS DO ÍCONE JURÍDICO (SIDEBAR) === */
        @keyframes jicon-pulse-scale {
          0%   { transform: scale(1); filter: drop-shadow(0 0 0 rgba(125,182,28,0.0)); }
          30%  { transform: scale(1.22); filter: drop-shadow(0 0 12px rgba(125,182,28,0.65)); }
          55%  { transform: scale(0.92); filter: drop-shadow(0 0 4px rgba(125,182,28,0.35)); }
          80%  { transform: scale(1.08); filter: drop-shadow(0 0 8px rgba(125,182,28,0.45)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(125,182,28,0.0)); }
        }
        @keyframes jicon-wiggle-x {
          0%,100% { transform: translateX(0) rotate(0deg); }
          10% { transform: translateX(-5px) rotate(-8deg); }
          22% { transform: translateX(5px) rotate(8deg); }
          34% { transform: translateX(-4px) rotate(-6deg); }
          46% { transform: translateX(4px) rotate(6deg); }
          58% { transform: translateX(-3px) rotate(-4deg); }
          70% { transform: translateX(3px) rotate(4deg); }
          82% { transform: translateX(-2px) rotate(-2deg); }
          94% { transform: translateX(2px) rotate(2deg); }
        }
        @keyframes jicon-shake-fine {
          0%,100% { transform: translate(0,0) rotate(0); }
          8%  { transform: translate(-1px, 1px) rotate(-1.5deg); }
          16% { transform: translate(1px, -1px) rotate(1.5deg); }
          24% { transform: translate(-1px, -1px) rotate(-1deg); }
          32% { transform: translate(1px, 1px) rotate(1deg); }
          40% { transform: translate(-1px, 0)   rotate(-0.8deg); }
          48% { transform: translate(1px, 0)    rotate(0.8deg); }
          56% { transform: translate(0, -1px)   rotate(0.5deg); }
          64% { transform: translate(0, 1px)    rotate(-0.5deg); }
          72% { transform: translate(-1px, 1px) rotate(-0.4deg); }
          80% { transform: translate(1px, -1px) rotate(0.4deg); }
          88% { transform: translate(-1px, 0)   rotate(0); }
        }
        @keyframes jicon-swing-rotate {
          0%   { transform: rotate(0); }
          20%  { transform: rotate(-22deg); }
          38%  { transform: rotate(18deg); }
          54%  { transform: rotate(-14deg); }
          68%  { transform: rotate(10deg); }
          80%  { transform: rotate(-6deg); }
          90%  { transform: rotate(3deg); }
          100% { transform: rotate(0); }
        }
        @keyframes jicon-pop-3d {
          0%   { transform: scale(1) rotateY(0) rotateX(0); }
          25%  { transform: scale(1.10) rotateY(-18deg) rotateX(6deg); filter: drop-shadow(2px 4px 0 rgba(0,54,65,0.22)); }
          50%  { transform: scale(1.18) rotateY(18deg) rotateX(-6deg); filter: drop-shadow(-2px 4px 0 rgba(0,54,65,0.22)); }
          75%  { transform: scale(1.06) rotateY(-8deg) rotateX(3deg); }
          100% { transform: scale(1) rotateY(0) rotateX(0); }
        }
        @keyframes jicon-bounce-soft {
          0%   { transform: translateY(0); }
          15%  { transform: translateY(-10px); }
          30%  { transform: translateY(0); }
          45%  { transform: translateY(-5px); }
          58%  { transform: translateY(0); }
          70%  { transform: translateY(-2.5px); }
          82%  { transform: translateY(0); }
          92%  { transform: translateY(-1px); }
          100% { transform: translateY(0); }
        }
        @keyframes jicon-spin-mini {
          0%   { transform: rotate(0deg) scale(1); }
          22%  { transform: rotate(95deg) scale(1.12); }
          44%  { transform: rotate(175deg) scale(0.95); }
          66%  { transform: rotate(250deg) scale(1.08); }
          88%  { transform: rotate(330deg) scale(0.98); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes jicon-rubber-band {
          0%   { transform: scale(1, 1); }
          25%  { transform: scale(1.28, 0.78); }
          45%  { transform: scale(0.82, 1.22); }
          62%  { transform: scale(1.16, 0.88); }
          78%  { transform: scale(0.92, 1.10); }
          90%  { transform: scale(1.06, 0.96); }
          100% { transform: scale(1, 1); }
        }
        @keyframes jicon-jello {
          0%,100% { transform: skew(0deg, 0deg) scale(1); }
          12%  { transform: skew(-6deg, 4deg) scale(1.02); }
          24%  { transform: skew(5deg, -5deg) scale(0.98); }
          36%  { transform: skew(-4deg, 3deg) scale(1.03); }
          48%  { transform: skew(3deg, -3deg) scale(0.99); }
          60%  { transform: skew(-2deg, 2deg) scale(1.02); }
          72%  { transform: skew(1.5deg, -1.5deg); }
          84%  { transform: skew(-1deg, 1deg); }
          94%  { transform: skew(0.5deg, -0.5deg); }
        }
        @keyframes jicon-tada {
          0%   { transform: scale(1) rotate(0); }
          12%  { transform: scale(0.88) rotate(-4deg); }
          22%  { transform: scale(1.18) rotate(6deg); filter: drop-shadow(0 0 10px rgba(125,182,28,0.55)); }
          32%  { transform: scale(1.18) rotate(-6deg); }
          42%  { transform: scale(1.18) rotate(5deg); }
          52%  { transform: scale(1.18) rotate(-4deg); }
          62%  { transform: scale(1.12) rotate(3deg); }
          72%  { transform: scale(1.06) rotate(-2deg); }
          82%  { transform: scale(1.03) rotate(1deg); filter: drop-shadow(0 0 6px rgba(125,182,28,0.35)); }
          100% { transform: scale(1) rotate(0); }
        }
        @keyframes jicon-float-y {
          0%   { transform: translateY(0); filter: drop-shadow(0 0 0 rgba(0,54,65,0.0)); }
          25%  { transform: translateY(-7px); filter: drop-shadow(0 8px 6px rgba(0,54,65,0.28)); }
          50%  { transform: translateY(-3px); filter: drop-shadow(0 4px 4px rgba(0,54,65,0.20)); }
          75%  { transform: translateY(-8px); filter: drop-shadow(0 10px 8px rgba(0,54,65,0.32)); }
          100% { transform: translateY(0); filter: drop-shadow(0 0 0 rgba(0,54,65,0.0)); }
        }
        @keyframes jicon-squash-x {
          0%,100% { transform: scaleX(1); }
          18%  { transform: scaleX(0.68); }
          34%  { transform: scaleX(1.30); }
          48%  { transform: scaleX(0.80); }
          62%  { transform: scaleX(1.16); }
          76%  { transform: scaleX(0.92); }
          90%  { transform: scaleX(1.06); }
        }
        @keyframes jicon-flash-color {
          0%   { filter: drop-shadow(0 0 0 rgba(125,182,28,0)) hue-rotate(0); }
          15%  { filter: drop-shadow(0 0 12px rgba(0,174,157,0.75)) hue-rotate(-60deg) brightness(1.2); }
          30%  { filter: drop-shadow(0 0 18px rgba(125,182,28,0.9))  hue-rotate(0deg)    brightness(1.35); }
          45%  { filter: drop-shadow(0 0 14px rgba(0,174,157,0.7))  hue-rotate(-35deg) brightness(1.2); }
          60%  { filter: drop-shadow(0 0 20px rgba(150,203,58,0.95)) hue-rotate(15deg)  brightness(1.4); }
          75%  { filter: drop-shadow(0 0 10px rgba(125,182,28,0.7))  hue-rotate(0deg)   brightness(1.15); }
          100% { filter: drop-shadow(0 0 0 rgba(125,182,28,0)) hue-rotate(0) brightness(1); }
        }
        @keyframes jicon-heartbeat {
          0%   { transform: scale(1); }
          10%  { transform: scale(1.08); }
          20%  { transform: scale(0.94); }
          30%  { transform: scale(1.22); }
          40%  { transform: scale(0.92); }
          50%  { transform: scale(1.18); }
          60%  { transform: scale(0.96); }
          70%  { transform: scale(1.12); }
          80%  { transform: scale(0.98); }
          90%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes jicon-orbit-tilt {
          0%   { transform: perspective(400px) rotateX(0) rotateY(0); }
          25%  { transform: perspective(400px) rotateX(-12deg) rotateY(-20deg); filter: drop-shadow(-3px 3px 2px rgba(0,54,65,0.25)); }
          50%  { transform: perspective(400px) rotateX(8deg)  rotateY(22deg);  filter: drop-shadow(3px 3px 2px rgba(0,54,65,0.25)); }
          75%  { transform: perspective(400px) rotateX(-6deg) rotateY(-10deg); filter: drop-shadow(-2px 2px 1px rgba(0,54,65,0.18)); }
          100% { transform: perspective(400px) rotateX(0)    rotateY(0); }
        }
        /* ======= NOVAS 15 ANIMAÇÕES MODERNAS DO ÍCONE ======= */
        @keyframes jicon-neon-strobe {
          0%,100% { filter: drop-shadow(0 0 0 rgba(125,182,28,0.1)); transform: scale(1); }
          14%  { filter: drop-shadow(0 0 12px #7DB61C) drop-shadow(0 0 26px #96CB3A); transform: scale(1.1); }
          22%  { filter: drop-shadow(0 0 0 rgba(255,255,255,0.1)); transform: scale(0.94); }
          30%  { filter: drop-shadow(0 0 18px #00AE9D) drop-shadow(0 0 30px #33C5B8); transform: scale(1.14); }
          38%  { filter: drop-shadow(0 0 0 rgba(125,182,28,0.1)); transform: scale(0.96); }
          46%  { filter: drop-shadow(0 0 14px #FFFFFF) drop-shadow(0 0 28px #B6E16A); transform: scale(1.12); }
          54%  { filter: drop-shadow(0 0 0 rgba(125,182,28,0.08)); transform: scale(0.98); }
          62%  { filter: drop-shadow(0 0 20px #96CB3A) drop-shadow(0 0 36px #7DB61C); transform: scale(1.1); }
          70%  { filter: drop-shadow(0 0 0 rgba(125,182,28,0.08)); transform: scale(1); }
          78%  { filter: drop-shadow(0 0 16px #00AE9D) drop-shadow(0 0 32px #33C5B8); transform: scale(1.06); }
          86%  { filter: drop-shadow(0 0 0 rgba(125,182,28,0.08)); }
        }
        @keyframes jicon-hue-orbit {
          0%   { filter: hue-rotate(0deg)   drop-shadow(0 0 6px  rgba(125,182,28,0.55)); transform: scale(1) rotate(0deg); }
          20%  { filter: hue-rotate(60deg)  drop-shadow(0 0 10px rgba(150,203,58,0.7));  transform: scale(1.08) rotate(5deg); }
          40%  { filter: hue-rotate(140deg) drop-shadow(0 0 14px rgba(0,174,157,0.75));  transform: scale(1.12) rotate(-4deg); }
          60%  { filter: hue-rotate(220deg) drop-shadow(0 0 16px rgba(51,197,184,0.8));  transform: scale(1.08) rotate(3deg); }
          80%  { filter: hue-rotate(300deg) drop-shadow(0 0 12px rgba(182,225,106,0.75)); transform: scale(1.04) rotate(-2deg); }
          100% { filter: hue-rotate(360deg) drop-shadow(0 0 6px  rgba(125,182,28,0.55)); transform: scale(1) rotate(0deg); }
        }
        @keyframes jicon-shockwave {
          0%   { transform: scale(0.6); filter: drop-shadow(0 0 0 rgba(125,182,28,0)); box-shadow: 0 0 0 0 rgba(125,182,28,0.6); }
          20%  { transform: scale(1.2); filter: drop-shadow(0 0 16px rgba(125,182,28,0.95)); box-shadow: 0 0 0 8px rgba(125,182,28,0.0); }
          40%  { transform: scale(0.96); filter: drop-shadow(0 0 4px rgba(125,182,28,0.45)); box-shadow: 0 0 0 0 rgba(150,203,58,0.6); }
          60%  { transform: scale(1.14); filter: drop-shadow(0 0 18px rgba(150,203,58,0.95)); box-shadow: 0 0 0 10px rgba(150,203,58,0); }
          80%  { transform: scale(0.98); filter: drop-shadow(0 0 4px rgba(125,182,28,0.45)); box-shadow: 0 0 0 0 rgba(0,174,157,0.5); }
          92%  { transform: scale(1.06); filter: drop-shadow(0 0 10px rgba(0,174,157,0.75)); box-shadow: 0 0 0 6px rgba(0,174,157,0); }
          100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(0,54,65,0.18)); }
        }
        @keyframes jicon-crt-scanline {
          0%   { transform: translateY(0) scale(1); filter: brightness(1) contrast(1); }
          14%  { transform: translateY(-2px) scale(1.01); filter: brightness(1.8) contrast(1.2) drop-shadow(0 -4px 0 rgba(125,182,28,0.35)); }
          28%  { transform: translateY(3px)  scale(1); filter: brightness(0.7) contrast(1.3) drop-shadow(0 3px 0 rgba(255,255,255,0.2)); }
          42%  { transform: translateY(-1px) scale(1.02); filter: brightness(1.6) contrast(1.15); }
          56%  { transform: translateY(2px)  scale(0.99); filter: brightness(0.85) contrast(1.4) drop-shadow(0 -2px 0 rgba(150,203,58,0.4)); }
          70%  { transform: translateY(-3px) scale(1.01); filter: brightness(1.9) contrast(1.1); }
          84%  { transform: translateY(1px)  scale(1); filter: brightness(0.95) contrast(1.25) drop-shadow(0 2px 0 rgba(255,255,255,0.25)); }
          100% { transform: translateY(0)    scale(1); filter: brightness(1) contrast(1); }
        }
        @keyframes jicon-lightning {
          0%,8%,20%,32%,44%,56%,68%,80%,92%,100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          2%   { opacity: 1; transform: scale(1.16); filter: drop-shadow(0 0 18px #FFFFFF) drop-shadow(0 0 40px #B6E16A) brightness(1.9); }
          14%  { opacity: 1; transform: scale(1.14); filter: drop-shadow(0 0 16px #FFFFFF) drop-shadow(0 0 38px #96CB3A) brightness(1.85); }
          24%  { opacity: 1; transform: scale(1.18); filter: drop-shadow(0 0 22px #FFFFFF) drop-shadow(0 0 44px #7DB61C) brightness(2); }
          36%  { opacity: 1; transform: scale(1.12); filter: drop-shadow(0 0 14px #FFFFFF) drop-shadow(0 0 32px #33C5B8) brightness(1.8); }
          48%  { opacity: 1; transform: scale(1.16); filter: drop-shadow(0 0 20px #FFFFFF) drop-shadow(0 0 42px #00AE9D) brightness(1.9); }
          60%  { opacity: 1; transform: scale(1.18); filter: drop-shadow(0 0 24px #FFFFFF) drop-shadow(0 0 48px #B6E16A) brightness(2); }
          72%  { opacity: 1; transform: scale(1.14); filter: drop-shadow(0 0 18px #FFFFFF) drop-shadow(0 0 38px #96CB3A) brightness(1.85); }
          84%  { opacity: 1; transform: scale(1.16); filter: drop-shadow(0 0 20px #FFFFFF) drop-shadow(0 0 42px #7DB61C) brightness(1.95); }
        }
        @keyframes jicon-roll-3d {
          0%   { transform: perspective(500px) rotateX(0deg)    scale(1); }
          25%  { transform: perspective(500px) rotateX(90deg)   scale(1.14); filter: drop-shadow(0 -8px 8px rgba(125,182,28,0.4)); }
          50%  { transform: perspective(500px) rotateX(180deg)  scale(1); }
          65%  { transform: perspective(500px) rotateX(270deg)  scale(1.12); filter: drop-shadow(0 8px 8px rgba(0,174,157,0.4)); }
          85%  { transform: perspective(500px) rotateX(340deg)  scale(1.04); }
          100% { transform: perspective(500px) rotateX(360deg)  scale(1); }
        }
        @keyframes jicon-skew-wave {
          0%,100% { transform: skewX(0deg) skewY(0deg) translate(0,0); }
          14%  { transform: skewX(10deg) skewY(3deg)  translate(-3px,-2px); filter: drop-shadow(2px 2px 2px rgba(0,54,65,0.2)); }
          28%  { transform: skewX(-8deg) skewY(-4deg) translate(3px,2px);  filter: drop-shadow(-2px 2px 2px rgba(125,182,28,0.25)); }
          42%  { transform: skewX(6deg)  skewY(5deg)  translate(-2px,3px); filter: drop-shadow(2px -2px 2px rgba(0,174,157,0.25)); }
          56%  { transform: skewX(-5deg) skewY(-3deg) translate(2px,-3px); filter: drop-shadow(-2px -2px 2px rgba(150,203,58,0.25)); }
          70%  { transform: skewX(4deg)  skewY(2deg)  translate(-1px,1px); }
          84%  { transform: skewX(-2deg) skewY(-1deg) translate(1px,-1px); }
        }
        @keyframes jicon-flip-card-3d {
          0%   { transform: perspective(600px) rotateY(0deg); }
          24%  { transform: perspective(600px) rotateY(90deg) scale(1.1); filter: drop-shadow(4px 0 6px rgba(0,54,65,0.3)); }
          44%  { transform: perspective(600px) rotateY(180deg) scale(1); filter: drop-shadow(0 0 12px rgba(255,255,255,0.4)); }
          64%  { transform: perspective(600px) rotateY(270deg) scale(1.1); filter: drop-shadow(-4px 0 6px rgba(150,203,58,0.3)); }
          84%  { transform: perspective(600px) rotateY(340deg) scale(1.04); }
          100% { transform: perspective(600px) rotateY(360deg) scale(1); }
        }
        @keyframes jicon-neon-breath {
          0%,100% {
            filter: drop-shadow(0 0 4px rgba(125,182,28,0.35));
            transform: scale(0.98);
          }
          30% {
            filter: drop-shadow(0 0 14px rgba(125,182,28,0.9)) drop-shadow(0 0 28px rgba(150,203,58,0.7)) drop-shadow(0 0 52px rgba(182,225,106,0.4));
            transform: scale(1.08);
          }
          55% {
            filter: drop-shadow(0 0 20px rgba(150,203,58,1)) drop-shadow(0 0 40px rgba(182,225,106,0.85)) drop-shadow(0 0 70px rgba(255,255,255,0.3));
            transform: scale(1.14);
          }
          80% {
            filter: drop-shadow(0 0 12px rgba(125,182,28,0.85)) drop-shadow(0 0 26px rgba(150,203,58,0.6));
            transform: scale(1.06);
          }
        }
        @keyframes jicon-morph-blob {
          0%,100% { border-radius: 12px; transform: scale(1) rotate(0); }
          18%  { border-radius: 48% 22% 38% 60% / 55% 33% 62% 40%; transform: scale(1.05) rotate(6deg); }
          36%  { border-radius: 20% 55% 62% 36% / 40% 60% 30% 58%; transform: scale(1.1) rotate(-8deg); filter: drop-shadow(3px 2px 2px rgba(0,54,65,0.25)); }
          54%  { border-radius: 58% 40% 22% 60% / 60% 30% 65% 35%; transform: scale(1.08) rotate(10deg); filter: drop-shadow(-2px 3px 2px rgba(125,182,28,0.25)); }
          72%  { border-radius: 28% 60% 48% 28% / 34% 55% 35% 64%; transform: scale(1.04) rotate(-4deg); }
          88%  { border-radius: 18px; transform: scale(1.01) rotate(1deg); }
        }
        @keyframes jicon-ripple-morph {
          0%   { transform: scale(0.2); filter: blur(6px) drop-shadow(0 0 0 rgba(125,182,28,0)); border-radius: 50%; }
          18%  { transform: scale(1.2); filter: blur(0)   drop-shadow(0 0 12px rgba(125,182,28,0.7)); border-radius: 12px; }
          34%  { transform: scale(0.96); filter: blur(0.2px); border-radius: 35% 25% 42% 30% / 30% 40% 25% 50%; }
          48%  { transform: scale(1.12); filter: drop-shadow(0 0 16px rgba(150,203,58,0.8)); border-radius: 12px; }
          62%  { transform: scale(1); filter: blur(0.1px); border-radius: 45% 18% 40% 32% / 28% 45% 30% 45%; }
          76%  { transform: scale(1.08); filter: drop-shadow(0 0 10px rgba(0,174,157,0.65)); border-radius: 12px; }
          90%  { transform: scale(1); filter: drop-shadow(0 0 3px rgba(0,54,65,0.2)); border-radius: 12px; }
          100% { transform: scale(1); border-radius: 12px; }
        }
        @keyframes jicon-glitch-rgb {
          0%,100% { transform: translate(0); filter: drop-shadow(0 0 0 rgba(125,182,28,0.0)); clip-path: inset(0 0 0 0); opacity: 1; }
          8%   { transform: translate(-3px,-1px); filter: drop-shadow(3px 0 0 #F05265) drop-shadow(-3px 0 0 #00AE9D) hue-rotate(-8deg); clip-path: inset(15% 0 68% 0); opacity: 0.98; }
          16%  { transform: translate(3px,1px);  filter: drop-shadow(-3px 0 0 #F05265) drop-shadow(3px 0 0 #00AE9D) hue-rotate(8deg);  clip-path: inset(42% 0 22% 0); opacity: 0.98; }
          24%  { transform: translate(-2px,2px); filter: drop-shadow(2px 0 0 #7DB61C) drop-shadow(-2px 0 0 #96CB3A); clip-path: inset(68% 0 8% 0); opacity: 0.99; }
          32%  { transform: translate(2px,-2px); filter: drop-shadow(-2px 0 0 #F05265) drop-shadow(2px 0 0 #00AE9D) hue-rotate(5deg); clip-path: inset(8% 0 75% 0); opacity: 0.98; }
          40%  { transform: translate(-1px,1px); filter: drop-shadow(1.5px 0 0 #33C5B8); clip-path: inset(55% 0 25% 0); opacity: 1; }
          52%  { transform: translate(1px,-1px); filter: drop-shadow(-1.5px 0 0 #F05265) hue-rotate(-4deg); clip-path: inset(28% 0 45% 0); opacity: 0.99; }
          66%  { transform: translate(-2px,0); filter: drop-shadow(2.5px 0 0 #96CB3A); clip-path: inset(72% 0 6% 0); opacity: 0.99; }
          80%  { transform: translate(2px,0);  filter: drop-shadow(-2.5px 0 0 #00AE9D) hue-rotate(3deg); clip-path: inset(35% 0 40% 0); opacity: 1; }
        }
        @keyframes jicon-tilt-focus {
          0%,100% { transform: perspective(600px) rotateX(0) rotateY(0) scale(1); }
          12%  { transform: perspective(600px) rotateX(18deg) rotateY(-22deg) scale(1.12); filter: drop-shadow(-4px 6px 6px rgba(0,54,65,0.32)); }
          28%  { transform: perspective(600px) rotateX(-16deg) rotateY(24deg) scale(1.08); filter: drop-shadow(4px -4px 4px rgba(125,182,28,0.3)); }
          44%  { transform: perspective(600px) rotateX(22deg) rotateY(18deg) scale(1.16); filter: drop-shadow(0 8px 8px rgba(150,203,58,0.35)); }
          60%  { transform: perspective(600px) rotateX(-20deg) rotateY(-24deg) scale(1.06); filter: drop-shadow(0 -6px 6px rgba(0,174,157,0.32)); }
          76%  { transform: perspective(600px) rotateX(10deg) rotateY(12deg) scale(1.1); filter: drop-shadow(3px 3px 4px rgba(0,54,65,0.25)); }
          88%  { transform: perspective(600px) rotateX(-6deg) rotateY(-10deg) scale(1.04); }
        }
        @keyframes jicon-squash-stretch {
          0%,100% { transform: scaleX(1) scaleY(1); }
          12%  { transform: scaleX(1.42) scaleY(0.62); filter: drop-shadow(0 3px 2px rgba(0,54,65,0.28)); }
          24%  { transform: scaleX(0.78) scaleY(1.36); filter: drop-shadow(0 -4px 2px rgba(125,182,28,0.3)); }
          36%  { transform: scaleX(1.28) scaleY(0.76); filter: drop-shadow(0 3px 2px rgba(0,54,65,0.25)); }
          48%  { transform: scaleX(0.86) scaleY(1.22); filter: drop-shadow(0 -3px 2px rgba(150,203,58,0.28)); }
          60%  { transform: scaleX(1.18) scaleY(0.88); }
          72%  { transform: scaleX(0.94) scaleY(1.1); }
          84%  { transform: scaleX(1.06) scaleY(0.96); }
        }
        @keyframes jicon-zoom-flicker {
          0%,100% { transform: scale(1); opacity: 1; filter: blur(0); }
          9%   { transform: scale(1.5); opacity: 0.98; filter: blur(0.4px) drop-shadow(0 0 18px rgba(150,203,58,0.9)); }
          14%  { transform: scale(0.6); opacity: 0.5; filter: blur(2px); }
          20%  { transform: scale(1.3); opacity: 0.96; filter: blur(0.2px); }
          26%  { transform: scale(1); opacity: 1; filter: blur(0); }
          34%  { transform: scale(1.4); opacity: 0.98; filter: blur(0.3px) drop-shadow(0 0 16px rgba(0,174,157,0.8)); }
          40%  { transform: scale(0.72); opacity: 0.6; filter: blur(1.2px); }
          48%  { transform: scale(1.2); opacity: 0.98; filter: blur(0.1px); }
          56%  { transform: scale(1); opacity: 1; }
          64%  { transform: scale(1.5); opacity: 0.95; filter: blur(0.5px) drop-shadow(0 0 20px rgba(255,255,255,0.6)); }
          70%  { transform: scale(0.6); opacity: 0.4; filter: blur(2px); }
          78%  { transform: scale(1.22); opacity: 0.97; filter: blur(0.2px); }
          86%  { transform: scale(1); opacity: 1; filter: blur(0); }
        }
        #juridico-root .j-icon-wrap {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          perspective: 500px;
          transform-style: preserve-3d;
          will-change: transform, filter;
        }
        @keyframes jicon-glow-rm { to { opacity: 0; transform: scale(0.6); } }

        /* === TEXTO "Jurídico" SIMPLES em 3 posições (frente/atrás/baixo) — SEM efeitos visuais === */
        #juridico-root .j-text-pop {
          pointer-events: none;
          z-index: 12;
          font-family: 'Fira Sans', 'Segoe UI', Arial, sans-serif;
          font-weight: 650;
          letter-spacing: 0.01em;
          color: #FFFFFF;
          font-size: 14px;
          line-height: 1;
          white-space: nowrap;
          will-change: opacity;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          max-width: none !important;
          overflow: visible !important;
          animation: jt-simple-fade 450ms ease-out both;
        }
        #juridico-root .j-simple-wrap {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        #juridico-root .j-simple-row {
          display: inline-flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 0;
          width: 100%;
        }
        #juridico-root .j-text-pop.pos-bottom {
          display: block;
          text-align: center;
          width: 100%;
          margin-top: 10px;
          order: 3;
        }
        #juridico-root .j-text-pop.pos-front {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          margin-left: 10px;
          order: 2;
          z-index: 14;
          color: #FFFFFF;
          font-weight: 700;
        }
        #juridico-root .j-text-pop.pos-back {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          margin-right: 10px;
          order: 0;
          z-index: 8;
          color: rgba(255,255,255,0.80);
          font-weight: 600;
          opacity: 0.85;
        }
        @keyframes jt-simple-fade {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'linear-gradient(180deg, #003641 0%, #003039 100%)',
        color: '#FFFFFF',
        padding: '6px 0.5cm',
        borderBottom: '1px solid rgba(0,174,157,0.30)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
      }}>
        <div className="header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 2px',
          minHeight: 52,
        }}>
          <div className="header-left" style={{
            display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
          }}>
            <img
              src="/assets/sicoob-juriscred.png"
              alt="Sicoob Juriscred"
              style={{
                height: 32, width: 'auto', display: 'block',
                flexShrink: 0,
                filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.18))',
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/assets/sicoob-juriscred_Logo Verde.png';
              }}
            />
            <div style={{
              width: 1, height: 30, alignSelf: 'stretch',
              background: 'rgba(255,255,255,0.18)',
              margin: '0 2px',
              flexShrink: 0,
            }} />
            <div className="page-icon" style={{
              width: 30, height: 30, borderRadius: 0,
              display: 'grid', placeItems: 'center',
              flex: '0 0 auto', lineHeight: 0,
              background: 'transparent',
              boxShadow: 'none',
            }}>
              <Gavel size={22} color="#7DB61C" strokeWidth={2.15} />
            </div>
            <div className="title-wrap" style={{ display: 'grid', gap: 0, minWidth: 0 }}>
              <h1 style={{
                margin: 0, fontSize: '1rem', letterSpacing: '0.015em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontWeight: 800, color: '#FFFFFF', lineHeight: 1.05,
              }}>
                Jurídico
              </h1>
              <p style={{
                margin: 0, fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.62)',
                fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                lineHeight: 1.05,
              }}>
                Portal Administrativo
              </p>
              <p className="dev-credit" style={{
                margin: 0,
                fontSize: '0.58rem',
                color: 'rgba(255,255,255,0.50)',
                fontWeight: 650,
                fontStyle: 'italic',
                letterSpacing: '0.005em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.1,
              }}>
                Desenvolvido por: Departamento de Tecnologia da Informação - Juriscred
              </p>
            </div>
          </div>

          <div className="header-actions" style={{
            display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}>
                {currentUserPhoto ? (
                  <img
                    src={currentUserPhoto}
                    alt="Foto"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontWeight: 900, fontSize: 11, opacity: 0.85 }}>
                    {headerAvatarInit.slice(0, 2)}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.015em', whiteSpace: 'nowrap' }}>
                {(userName?.trim() || 'Usuário') + (String(userName || '').toUpperCase().includes('SICOOB JURISCRED') || String(userName || '').includes('|') ? '' : ' | SICOOB JURISCRED')}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                <button
                  type="button"
                  onClick={() => (window.location.href = '/')}
                  aria-label="Home"
                  title="Home do Portal"
                  style={{
                    width: 24, height: 24,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 9, border: 0, background: 'transparent', color: 'inherit',
                    cursor: 'pointer', opacity: 0.9,
                    padding: 0, margin: 0, lineHeight: 0,
                  }}
                >
                  <Home size={16} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const msal = (window as any).__msalInstance as
                      | { logoutRedirect: (opts?: any) => Promise<void> }
                      | undefined;
                    try {
                      sessionStorage.removeItem('consignado_user_email');
                      sessionStorage.removeItem('consignado_user_role');
                      sessionStorage.removeItem('juridico_user_role');
                      sessionStorage.removeItem('auth_redirect_url');
                      if (msal?.logoutRedirect) {
                        await msal.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
                        return;
                      }
                    } catch {
                      void 0;
                    }
                    window.location.href = '/';
                  }}
                  aria-label="Sair"
                  title="Sair"
                  style={{
                    width: 24, height: 24,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 9, border: 0, background: 'transparent', color: 'inherit',
                    cursor: 'pointer', opacity: 0.9,
                    padding: 0, margin: 0, lineHeight: 0,
                  }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 0.5cm 28px', display: 'grid',
        gridTemplateColumns: '260px 1fr', gap: 14,
        maxWidth: 'calc(100vw - 1cm)', margin: '0 auto' }}>
        {/* SIDEBAR */}
        <aside style={{
          background: 'linear-gradient(180deg, #003641 0%, #003039 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(0,174,157,0.28)',
          borderRadius: 14, padding: 14,
          alignSelf: 'start',
          position: 'sticky', top: 74,
          boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
          isolation: 'isolate',
          contain: 'layout paint',
          overflow: 'visible',
        }}>
          <div className="j-simple-wrap" style={{ padding: '10px 8px', marginBottom: 12, width: '100%' }}>
            <div className="j-simple-row">
              {iconTextShow && iconTextPos === 'back' ? (
                <span
                  key={`t-${iconTextKey}`}
                  className="j-text-pop pos-back"
                  style={{
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 800,
                    color: '#FFFFFF',
                  }}>
                  Jurídico
                </span>
              ) : null}
              <div
                key={`i-${iconAnimKey}`}
                className="j-icon-wrap"
                style={{
                  order: 1,
                  animation: `jicon-${activeIconAnim.name} ${activeIconAnim.dur}ms ease-in-out both`,
                  animationIterationCount: 1,
                }}>
                <Gavel size={28} color="#7DB61C" strokeWidth={2.15} />
              </div>
              {iconTextShow && iconTextPos === 'front' ? (
                <span
                  key={`t-${iconTextKey}`}
                  className="j-text-pop pos-front"
                  style={{
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 800,
                    color: '#FFFFFF',
                  }}>
                  Jurídico
                </span>
              ) : null}
          </div>
          </div>

          {/* ============ SHEET TABS (ABAS ESTILO NAVEGADOR / TABS) ============ */}
          <div role="tablist" aria-label="Visões do Módulo Jurídico" style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            alignItems: 'end',
            marginBottom: 0,
            paddingTop: 4,
            paddingLeft: 0,
            paddingRight: 0,
            paddingBottom: 0,
            borderRadius: 0,
            background: 'transparent',
            border: 0,
            borderBottom: '2px solid rgba(255,255,255,0.18)',
            position: 'relative',
            zIndex: 2,
          }}>
            {/* === ABA OPERACIONAL (TEAL / VERDE) === */}
            <button type="button" role="tab"
              aria-selected={currentView === 'home' || showSettingsNav}
              onClick={() => navigate('/juridico')}
              className="interactive"
              title="Visão Operacional • Dashboard diário Jurídico"
              style={{
                gridColumn: 1,
                position: 'relative',
                top: 0,
                marginRight: -1,
                cursor: 'pointer',
                color: '#FFFFFF',
                border: '1px solid transparent',
                borderBottom: 0,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                padding: '11px 10px 9px',
                background: (currentView === 'home' || showSettingsNav)
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)'
                  : 'transparent',
                boxShadow: (currentView === 'home' || showSettingsNav)
                  ? 'inset 0 1px 0 rgba(255,255,255,0.10)'
                  : 'none',
                borderColor: (currentView === 'home' || showSettingsNav) ? 'rgba(0,174,157,0.88)' : 'transparent',
                transition: 'transform 140ms cubic-bezier(.22,.9,.28,1.1), box-shadow 180ms ease, background 180ms ease, border-color 180ms ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
                overflow: 'visible',
                zIndex: (currentView === 'home' || showSettingsNav) ? 4 : 1,
                transform: (currentView === 'home' || showSettingsNav) ? 'translateY(-2px) scale(1.005)' : 'translateY(0) scale(1)',
              }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Briefcase size={16} color={(currentView === 'home' || showSettingsNav) ? '#00AE9D' : 'rgba(255,255,255,0.58)'} strokeWidth={2.05} />
              </div>
              <div style={{
                fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase',
                fontWeight: 850, lineHeight: 1.05,
                color: (currentView === 'home' || showSettingsNav) ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
              }}>Operacional</div>
              {(currentView === 'home' || showSettingsNav) ? (
                <span aria-hidden="true" style={{
                  position: 'absolute',
                  left: 8, right: 8, top: -2,
                  height: 3, borderRadius: 999,
                  background: 'linear-gradient(90deg, rgba(0,174,157,0.0) 0%, #00AE9D 35%, #7DB61C 65%, rgba(125,182,28,0.0) 100%)',
                  boxShadow: '0 0 14px rgba(125,182,28,0.60), 0 0 7px rgba(0,174,157,0.55)',
                }} />
              ) : null}
            </button>

            {/* === ABA EXECUTIVO (LARANJA / VERMELHO) === */}
            <button type="button" role="tab"
              aria-selected={currentView === 'dashboard-executivo'}
              onClick={() => navigate('/juridico/executivo')}
              className="interactive"
              title="Visão Executiva • Dashboard Gerencial Jurídico"
              style={{
                gridColumn: 2,
                position: 'relative',
                top: 0,
                marginLeft: -1,
                cursor: 'pointer',
                color: '#FFFFFF',
                border: '1px solid transparent',
                borderBottom: 0,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                padding: '11px 10px 9px',
                background: currentView === 'dashboard-executivo'
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)'
                  : 'transparent',
                boxShadow: currentView === 'dashboard-executivo'
                  ? 'inset 0 1px 0 rgba(255,255,255,0.10)'
                  : 'none',
                borderColor: currentView === 'dashboard-executivo' ? 'rgba(251,140,0,0.90)' : 'transparent',
                transition: 'transform 140ms cubic-bezier(.22,.9,.28,1.1), box-shadow 180ms ease, background 180ms ease, border-color 180ms ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
                overflow: 'visible',
                zIndex: currentView === 'dashboard-executivo' ? 4 : 1,
                transform: currentView === 'dashboard-executivo' ? 'translateY(-2px) scale(1.005)' : 'translateY(0) scale(1)',
              }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <BarChart3 size={16} color={currentView === 'dashboard-executivo' ? '#FB8C00' : 'rgba(255,255,255,0.68)'} strokeWidth={2.05} />
              </div>
              <div style={{
                fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase',
                fontWeight: 850, lineHeight: 1.05,
                color: currentView === 'dashboard-executivo' ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
              }}>Executivo</div>
              {currentView === 'dashboard-executivo' ? (
                <span aria-hidden="true" style={{
                  position: 'absolute',
                  left: 8, right: 8, top: -2,
                  height: 3, borderRadius: 999,
                  background: 'linear-gradient(90deg, rgba(251,140,0,0.0) 0%, #FB8C00 35%, #D64340 65%, rgba(214,67,64,0.0) 100%)',
                  boxShadow: '0 0 14px rgba(251,140,0,0.60), 0 0 7px rgba(214,67,64,0.45)',
                }} />
              ) : null}
            </button>
          </div>

          {/* === FILTROS (MOVIDOS PARA O SIDEBAR) === */}
          <div style={{
            marginBottom: 12, padding: 10,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            position: 'relative',
            zIndex: 50,
            isolation: 'isolate',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              marginBottom: 8,
            }}>
              <div style={{
                fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                fontWeight: 800, opacity: 0.85, color: '#FFFFFF',
              }}>Filtros da consulta</div>
              <button type="button" className="interactive"
                onClick={handleLimpar}
                title="Limpar todos os filtros"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 8, border: 0,
                  background: 'linear-gradient(135deg, rgba(125,182,28,0.30) 0%, rgba(0,174,157,0.18) 100%)',
                  color: '#FFFFFF', cursor: 'pointer', padding: 0,
                }}>
                <FilterX size={14} strokeWidth={2.1} />
              </button>
            </div>
            <div className="filter-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div>
                <label>Ano</label>
                <select value={ano} onChange={e => setAno(e.target.value)}>
                  <option value="">Todos</option>
                  {anosOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label>Mês</label>
                <select value={mes} onChange={e => setMes(e.target.value)}>
                  <option value="">Todos</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                    <option key={m} value={String(m)}>{monthLabel(m)}</option>)}
                </select>
              </div>
              <div>
                <label>Origem</label>
                <select value={origem} onChange={e => setOrigem(e.target.value)}>
                  <option value="">Todas</option>
                  {origensOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="Sem status">Sem status</option>
                  {(statusesDistinctDb.length
                    ? statusesDistinctDb
                    : [
                        'Intimação efetivada', 'Certidão expedida', 'Autos conclusos para decisão',
                        'Mandado expedido', 'Petição citação', 'Petição penhora', 'Autos conclusos',
                        'Publicação diário', 'Petição', 'Citação expedida', 'Petição custas',
                        'Petição busca de endereços', 'Petição sistemas', 'Petição de custas',
                        'Petição busca endereços', 'Petição arresto', 'Ofício expedido',
                        'Decisão determinação', 'Citação efetivada', 'Extinto', 'Quitado', 'Baixado', 'Arquivado',
                      ]
                  ).map((s: string) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Consulta nome</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} strokeWidth={2.05}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.65, color: '#FFFFFF' }} />
                  <input value={nome} onChange={e => {
                    const next = e.target.value;
                    if (nomeDebounce.current) {
                      window.clearTimeout(nomeDebounce.current);
                      nomeDebounce.current = null;
                    }
                    setNome(next);
                    nomeDebounce.current = window.setTimeout(() => {
                      loadDashboardWithFilters(next, ano, mes, origem, status, natureza);
                    }, 350);
                  }}
                    placeholder="Autor ou réu" style={{ paddingLeft: 30 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '10px 4px' }} />
          <div style={{
            fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontWeight: 700, opacity: 0.78, padding: '4px 6px', color: '#FFFFFF',
          }}>Natureza</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 2, marginBottom: 6 }}>
            {([
              ['Ativo', 'Ativo'],
              ['Passivo', 'Passivo'],
            ] as const).map(([val, label]) => (
              <button type="button" key={'nat-' + val} className="interactive"
                onClick={() => { setNatureza(natureza === val ? '' : val); }}
                title={label}
                style={{
                  textAlign: 'center',
                  padding: '8px 10px',
                  borderRadius: 14,
                  border: natureza === val
                    ? '1px solid ' + (val === 'Ativo'
                        ? 'rgba(0,174,157,0.75)'
                        : 'rgba(240,82,101,0.75)')
                    : '1px solid rgba(255,255,255,0.14)',
                  cursor: 'pointer',
                  background: natureza === val
                    ? (val === 'Ativo'
                        ? 'linear-gradient(135deg, rgba(0,174,157,0.28) 0%, rgba(0,54,65,0.20) 100%)'
                        : 'linear-gradient(135deg, rgba(240,82,101,0.28) 0%, rgba(0,54,65,0.20) 100%)')
                    : 'rgba(255,255,255,0.05)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  lineHeight: 1.1,
                  fontWeight: natureza === val ? 750 : 600,
                  letterSpacing: natureza === val ? '0.01em' : '0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: natureza === val
                    ? (val === 'Ativo'
                        ? '0 8px 22px rgba(0,174,157,0.22)'
                        : '0 8px 22px rgba(240,82,101,0.22)')
                    : 'none',
                }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                  background: natureza === val ? 'rgba(255,255,255,0.98)' : (
                    val === 'Ativo' ? '#00AE9D' : '#F05265'
                  ),
                  boxShadow: natureza === val ? ('0 0 0 2px ' + (
                    val === 'Ativo' ? 'rgba(0,174,157,0.35)'
                      : 'rgba(240,82,101,0.35)'
                  )) : 'none',
                }} />
                <span style={{
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '10px 4px' }} />
          <div style={{
            fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontWeight: 700, opacity: 0.78, padding: '4px 6px', color: '#FFFFFF',
          }}>Atalhos Rápidos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 7, marginTop: 2, marginBottom: 6 }}>
            {origensOptions.map(orig => (
              <button type="button" key={orig} className="interactive"
                onClick={() => { setOrigem(origem === orig ? '' : orig); }}
                title={orig}
                style={{
                  textAlign: 'left',
                  padding: '8px 11px',
                  borderRadius: 14,
                  border: origem === orig
                    ? '1px solid rgba(125,182,28,0.70)'
                    : '1px solid rgba(255,255,255,0.14)',
                  cursor: 'pointer',
                  background: origem === orig
                    ? 'linear-gradient(135deg, rgba(125,182,28,0.30) 0%, rgba(0,174,157,0.22) 100%)'
                    : 'rgba(255,255,255,0.05)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  lineHeight: 1.1,
                  fontWeight: origem === orig ? 750 : 600,
                  letterSpacing: origem === orig ? '0.01em' : '0',
                  display: 'flex', alignItems: 'center', gap: 9,
                  boxShadow: origem === orig ? '0 8px 22px rgba(125,182,28,0.20)' : 'none',
                }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                  background: origem === orig ? 'rgba(255,255,255,0.98)' : '#7DB61C',
                  boxShadow: origem === orig ? '0 0 0 2px rgba(125,182,28,0.35)' : 'none',
                }} />
                <span style={{
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {orig}
                </span>
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '10px 4px' }} />
          <div className="interactive"
            onClick={() => setShowCamposBranco(v => !v)}
            title={showCamposBranco ? 'Recolher seção Campos em Branco' : 'Expandir seção Campos em Branco'}
            style={{
              fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontWeight: 700, opacity: 0.78, padding: '4px 6px', color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              cursor: 'pointer', borderRadius: 10, userSelect: 'none',
            }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <BadgeAlert size={12} strokeWidth={2.1} color="#FF9FAB" />
              Campos em Branco
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {lacunasFiltro.length > 0 ? (
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 999,
                  background: 'rgba(251,140,0,0.22)', color: '#FFC987', border: '1px solid rgba(251,140,0,0.45)',
                  fontWeight: 750, letterSpacing: 0,
                }}>
                  {lacunasFiltro.length} ativo{lacunasFiltro.length === 1 ? '' : 's'}
                </span>
              ) : null}
              <span style={{ padding: 2, borderRadius: 5 }}>
                <ChevronDown size={13} strokeWidth={2.1} color="#FFFFFF"
                  style={{
                    transform: showCamposBranco ? 'rotate(180deg)' : 'none',
                    transition: 'transform 120ms ease-out',
                    opacity: 0.9,
                  }} />
              </span>
            </span>
          </div>
          {showCamposBranco && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr', gap: 6,
              marginTop: 2, marginBottom: 6,
            }}>
            {LACUNA_CAMPOS.map(f => {
              const ativo = lacunasFiltro.includes(f.key);
              const faltam = lacunasCounts[f.key] ?? 0;
              return (
                <button type="button" key={'lac-' + f.key} className="interactive"
                  onClick={() => {
                    setLacunasFiltro(prev =>
                      prev.includes(f.key) ? prev.filter(k => k !== f.key) : [...prev, f.key]
                    );
                  }}
                  title={`${f.label} · ${faltam} registro${faltam === 1 ? '' : 's'} com o campo em branco`}
                  style={{
                    textAlign: 'left',
                    padding: '7px 9px',
                    borderRadius: 14,
                    border: ativo
                      ? `1.5px solid ${f.cor}CC`
                      : '1px solid rgba(255,255,255,0.14)',
                    cursor: 'pointer',
                    background: ativo
                      ? `linear-gradient(135deg, ${f.cor}33 0%, rgba(0,54,65,0.22) 100%)`
                      : 'rgba(255,255,255,0.05)',
                    color: '#FFFFFF',
                    fontSize: 11.5,
                    lineHeight: 1.12,
                    fontWeight: ativo ? 750 : 600,
                    letterSpacing: ativo ? '0.01em' : '0',
                    display: 'flex', alignItems: 'center', gap: 8,
                    boxShadow: ativo
                      ? `0 8px 22px ${f.cor}33, inset 0 1px 0 rgba(255,255,255,0.12)`
                      : 'none',
                    transition: 'transform 120ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease',
                    transform: ativo ? 'translateY(-1px)' : 'translateY(0)',
                  }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                    background: ativo ? 'rgba(255,255,255,0.98)' : f.cor,
                    boxShadow: ativo ? (`0 0 0 2px ${f.cor}77`) : 'none',
                  }} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.label}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 9.5, color: 'rgba(255,255,255,0.62)', letterSpacing: 0, fontWeight: 600,
                    }}>
                      <span style={{ color: ativo ? f.cor : 'rgba(255,255,255,0.55)', fontWeight: 780 }}>
                        {faltam} em branco
                      </span>
                      <span style={{ opacity: 0.65 }}>·</span>
                      <span>W {f.weight.toFixed(1)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          )}

          {jurIsAdmin && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '10px 4px' }} />

              <SidebarItem icon={<Settings size={15} strokeWidth={2.05} />}
                label="Configurações" active={showSettingsNav}
                locked={jurSettingsLocked}
                onClick={() => {
                  if (jurSettingsLocked) return;
                  setShowSettings(v => !v);
                  if (!showSettings) navigate('/juridico/automacao');
                }}
                chevron={showSettings}
                onChevron={(e) => {
                  e?.stopPropagation?.();
                  if (jurSettingsLocked) return;
                  setShowSettings(v => !v);
                }}
              />
              {showSettings && (
                <div style={{ marginLeft: 18, marginTop: 4 }}>
                  <SidebarItem small icon={<Database size={13} strokeWidth={2.05} />}
                    label="Automação" active={currentView === 'configuracoes-automacao'}
                    locked={jurSettingsLocked}
                    onClick={() => {
                      if (jurSettingsLocked) return;
                      navigate('/juridico/automacao');
                    }} />
                  <SidebarItem small icon={<Users size={13} strokeWidth={2.05} />}
                    label="Acessos" active={currentView === 'configuracoes-acessos'}
                    locked={jurSettingsLocked}
                    onClick={() => {
                      if (jurSettingsLocked) return;
                      navigate('/juridico/acessos');
                    }} />
                </div>
              )}
            </>
          )}
        </aside>

        {/* MAIN */}
        <main style={{ minWidth: 0 }}>
          {loading && (
            <div style={{ padding: 18, textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
              Carregando módulo Jurídico...
            </div>
          )}

          {currentView === 'dashboard-executivo' ? (
            <JuridicoExecDashboard
              rows={rows} loading={loading}
              stats={execStats}
              fmtBr={fmtBr} fmtInt={fmtInt} fmtMoney={fmtMoney}
              onBack={() => navigate('/juridico')} />
          ) : currentView === 'configuracoes-automacao' ? (
            <>
              <ConfiguracoesHeader title="Configurações • Automação" onBack={() => navigate('/juridico')} onHome={() => navigate('/juridico')} />
              <Sec title="Notificações">
                <div
                  style={{ ...card, padding: 14, marginBottom: 14 }}
                  onMouseLeave={() => {
                    setChartHoverMonth(null);
                    setChartLegendHover(null);
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 14, paddingBottom: 12,
                    borderBottom: '1px solid rgba(0, 174, 157, 0.18)',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(0, 174, 157, 0.18) 0%, rgba(125, 182, 28, 0.22) 100%)',
                      color: '#003641',
                    }}>
                      <Bell size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, letterSpacing: 0.08,
                        textTransform: 'uppercase', color: '#003641',
                      }}>Destinatários de notificações</div>
                      <div style={{ fontSize: 12, opacity: 0.72, marginTop: 3 }}>
                        Configure os e-mails que receberão alertas automáticos do módulo Jurídico.
                      </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <button className="interactive"
                      onClick={handleSalvarNotificacoes}
                      disabled={notifSaving || jurSettingsLocked || !jurIsAdmin}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '10px 18px', borderRadius: 11,
                        background: jurSettingsLocked || !jurIsAdmin
                          ? 'rgba(148,163,184,0.55)'
                          : 'linear-gradient(135deg, #33C5B8 0%, #00AE9D 55%, #0B8077 100%)',
                        color: '#FFFFFF', fontWeight: 750, fontSize: 13,
                        boxShadow: jurSettingsLocked || !jurIsAdmin ? 'none' : '0 8px 22px rgba(0, 174, 157, 0.30)',
                        cursor: notifSaving || jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'pointer',
                        border: '1px solid rgba(0, 54, 65, 0.35)',
                        opacity: jurSettingsLocked || !jurIsAdmin ? 0.6 : 1,
                      }}>
                      <Save size={14} strokeWidth={2.15} />
                      {notifSaving ? 'Salvando…' : 'Salvar notificações'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                    <div style={{
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid rgba(0, 174, 157, 0.22)',
                      background: 'linear-gradient(135deg, rgba(0, 174, 157, 0.05) 0%, rgba(0, 54, 65, 0.04) 100%)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 11.5, letterSpacing: 0.12, textTransform: 'uppercase',
                        fontWeight: 800, color: '#003641', marginBottom: 10,
                      }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: 'linear-gradient(180deg, #33C5B8, #00AE9D)',
                        }} />
                        Notificações Escritório Jurídico
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <input
                          style={{
                            padding: '9px 11px', borderRadius: 10,
                            border: '1px solid rgba(0,54,65,0.18)',
                            background: '#FFFFFF', flex: '1 1 240px',
                            color: '#003641',
                          }}
                          placeholder="Digite o e-mail (vários separados por , ou ;)"
                          value={novoNotifEscritorio}
                          onChange={e => setNovoNotifEscritorio(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddNotifEscritorio(); }}
                          disabled={jurSettingsLocked || !jurIsAdmin}
                        />
                        <button className="interactive"
                          onClick={handleAddNotifEscritorio}
                          disabled={jurSettingsLocked || !jurIsAdmin}
                          title="Adicionar"
                          style={{
                            width: 38, height: 38, borderRadius: 10,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(0, 174, 157, 0.45)',
                            background: 'rgba(0, 174, 157, 0.10)',
                            color: '#0B8077', cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'pointer',
                            opacity: jurSettingsLocked || !jurIsAdmin ? 0.55 : 1,
                          }}>
                          <MailPlus size={16} strokeWidth={2.2} />
                        </button>
                      </div>
                      <div style={{
                        display: 'flex', gap: 8, flexWrap: 'wrap',
                        padding: 10,
                        borderRadius: 12,
                        minHeight: 48,
                        background: notifEscritorio.length ? 'transparent' : 'rgba(0,54,65,0.03)',
                      }}>
                        {notifEscritorio.length === 0 && (
                          <div style={{ fontSize: 12, opacity: 0.5 }}>Nenhum e-mail cadastrado.</div>
                        )}
                        {notifEscritorio.map(em => (
                          <span key={em} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 7,
                            padding: '6px 10px', borderRadius: 14,
                            background: 'linear-gradient(135deg, rgba(51, 197, 184, 0.18) 0%, rgba(0, 174, 157, 0.22) 100%)',
                            color: '#003641',
                            fontSize: 12.5, fontWeight: 650,
                            border: '1px solid rgba(0, 174, 157, 0.30)',
                          }}>
                            <span>{em}</span>
                            <button className="interactive"
                              onClick={() => handleDelNotifEscritorio(em)}
                              disabled={jurSettingsLocked || !jurIsAdmin}
                              title="Remover"
                              style={{
                                width: 18, height: 18, borderRadius: '50%',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0, lineHeight: 0,
                                background: 'rgba(0,54,65,0.10)',
                                color: '#003641', cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'pointer',
                                border: 'none',
                              }}>
                              <X size={11} strokeWidth={2.5} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid rgba(125, 182, 28, 0.28)',
                      background: 'linear-gradient(135deg, rgba(125, 182, 28, 0.07) 0%, rgba(0, 54, 65, 0.04) 100%)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 11.5, letterSpacing: 0.12, textTransform: 'uppercase',
                        fontWeight: 800, color: '#003641', marginBottom: 10,
                      }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: 'linear-gradient(180deg, #96CB3A, #7DB61C)',
                        }} />
                        Cobrança
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <input
                          style={{
                            padding: '9px 11px', borderRadius: 10,
                            border: '1px solid rgba(0,54,65,0.18)',
                            background: '#FFFFFF', flex: '1 1 240px',
                            color: '#003641',
                          }}
                          placeholder="Digite o e-mail (vários separados por , ou ;)"
                          value={novoNotifCobranca}
                          onChange={e => setNovoNotifCobranca(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddNotifCobranca(); }}
                          disabled={jurSettingsLocked || !jurIsAdmin}
                        />
                        <button className="interactive"
                          onClick={handleAddNotifCobranca}
                          disabled={jurSettingsLocked || !jurIsAdmin}
                          title="Adicionar"
                          style={{
                            width: 38, height: 38, borderRadius: 10,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(125, 182, 28, 0.45)',
                            background: 'rgba(125, 182, 28, 0.10)',
                            color: '#6A9F16', cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'pointer',
                            opacity: jurSettingsLocked || !jurIsAdmin ? 0.55 : 1,
                          }}>
                          <MailPlus size={16} strokeWidth={2.2} />
                        </button>
                      </div>
                      <div style={{
                        display: 'flex', gap: 8, flexWrap: 'wrap',
                        padding: 10,
                        borderRadius: 12,
                        minHeight: 48,
                        background: notifCobranca.length ? 'transparent' : 'rgba(0,54,65,0.03)',
                      }}>
                        {notifCobranca.length === 0 && (
                          <div style={{ fontSize: 12, opacity: 0.5 }}>Nenhum e-mail cadastrado.</div>
                        )}
                        {notifCobranca.map(em => (
                          <span key={em} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 7,
                            padding: '6px 10px', borderRadius: 14,
                            background: 'linear-gradient(135deg, rgba(150, 203, 58, 0.22) 0%, rgba(125, 182, 28, 0.26) 100%)',
                            color: '#003641',
                            fontSize: 12.5, fontWeight: 650,
                            border: '1px solid rgba(125, 182, 28, 0.34)',
                          }}>
                            <span>{em}</span>
                            <button className="interactive"
                              onClick={() => handleDelNotifCobranca(em)}
                              disabled={jurSettingsLocked || !jurIsAdmin}
                              title="Remover"
                              style={{
                                width: 18, height: 18, borderRadius: '50%',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0, lineHeight: 0,
                                background: 'rgba(0,54,65,0.10)',
                                color: '#003641', cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'pointer',
                                border: 'none',
                              }}>
                              <X size={11} strokeWidth={2.5} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div style={{
                    marginTop: 14, padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(51, 197, 184, 0.08)',
                    border: '1px dashed rgba(0, 174, 157, 0.35)',
                    fontSize: 12, color: '#003641', opacity: 0.82,
                  }}>
                    💡 Dica: é possível inserir vários e-mails de uma vez digitando-os separados por vírgula <b>,</b> ou ponto e vírgula <b>;</b> e pressionando Enter.
                  </div>
                </div>
              </Sec>

              <Sec title="Regras de Prazos">
                <div style={{ ...card, padding: 14 }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 14, padding: '8px 2px 12px 2px', borderBottom: '1px solid rgba(0,54,65,0.10)',
                    marginBottom: 14, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: 13, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(255,152,0,0.18) 0%, rgba(229,115,0,0.22) 100%)',
                        border: '1px solid rgba(229,115,0,0.32)', color: '#C25A00', flexShrink: 0,
                      }}>
                        <Timer size={22} strokeWidth={2.2} />
                      </div>
                      <div>
                        <div style={{
                          fontSize: 15, fontWeight: 800, color: '#003641', letterSpacing: 0.1,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          Regras de Prazos
                        </div>
                        <div style={{ fontSize: 12, color: '#546E7A', marginTop: 2, lineHeight: 1.6 }}>
                          Configure os prazos-limite em <b>dias corridos</b> contados da inclusão do processo (campo created_at da tabela processos).
                        </div>
                      </div>
                    </div>
                    <button className="interactive"
                      onClick={handleSalvarRegrasPrazos}
                      disabled={jurSettingsLocked || !jurIsAdmin || prazosSaving}
                      title={!jurIsAdmin ? 'Apenas administradores podem salvar' : prazosSaving ? 'Salvando...' : 'Salvar regras de prazos'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '11px 18px', borderRadius: 12,
                        background: jurSettingsLocked || !jurIsAdmin || prazosSaving
                          ? 'linear-gradient(135deg, #90A4AE 0%, #78909C 100%)'
                          : 'linear-gradient(135deg, #FFB74D 0%, #FB8C00 60%, #F57C00 100%)',
                        color: '#FFFFFF', fontWeight: 800, fontSize: 13.5, letterSpacing: 0.2,
                        boxShadow: jurSettingsLocked || !jurIsAdmin || prazosSaving
                          ? 'none'
                          : '0 9px 24px rgba(251, 140, 0, 0.30)',
                        cursor: jurSettingsLocked || !jurIsAdmin || prazosSaving ? 'not-allowed' : 'pointer',
                        border: '1px solid rgba(0, 54, 65, 0.35)',
                        opacity: jurSettingsLocked || !jurIsAdmin ? 0.85 : 1,
                      }}>
                      <Save size={15} strokeWidth={2.15} />
                      {prazosSaving ? 'Salvando...' : 'Salvar regras'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                    <div style={{
                      border: '1px solid rgba(255, 152, 0, 0.28)',
                      borderRadius: 13,
                      padding: 14,
                      background: 'linear-gradient(135deg, rgba(255, 183, 77, 0.10) 0%, rgba(255, 152, 0, 0.13) 100%)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10,
                      }}>
                        <div style={{
                          width: 11, height: 11, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FFCC80 0%, #FB8C00 100%)',
                          boxShadow: '0 0 0 4px rgba(255, 152, 0, 0.15)',
                        }} />
                        <div style={{
                          fontSize: 13, fontWeight: 850, color: '#003641', letterSpacing: 0.05,
                        }}>
                          Protocolo Cartório Extrajudicial
                        </div>
                        <Hourglass size={14} color="#E65100" strokeWidth={2.2} />
                      </div>
                      <div style={{
                        fontSize: 12, color: '#546E7A', lineHeight: 1.6, marginBottom: 12,
                      }}>
                        Prazo (dias corridos a partir de <b>created_at</b>) para que o processo tenha a coluna
                        <span style={{
                          marginLeft: 4, marginRight: 4, padding: '2px 6px',
                          background: '#FFFFFF', borderRadius: 6, border: '1px solid rgba(255, 152, 0, 0.35)',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5,
                        }}>numero_protocolo_cartorio_extrajudicial</span>
                        devidamente preenchida.
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="number" min={0} step={1}
                          style={{
                            width: 110, padding: '9px 12px', borderRadius: 10,
                            border: '1px solid rgba(255, 152, 0, 0.35)',
                            background: '#FFFFFF', color: '#003641',
                            fontSize: 15, fontWeight: 750, letterSpacing: 0.2, textAlign: 'right',
                            outline: 'none',
                            cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'text',
                            opacity: jurSettingsLocked || !jurIsAdmin ? 0.82 : 1,
                          }}
                          value={prazoProtocoloExtraj}
                          disabled={jurSettingsLocked || !jurIsAdmin}
                          onChange={e => {
                            const v = e.target.value === '' ? '' : Number(e.target.value);
                            if (v === '' || (Number.isFinite(v))) {
                              setPrazoProtocoloExtraj(v === '' ? 0 : Math.max(0, Math.floor(Number(v))));
                            }
                          }}
                        />
                        <div style={{ fontSize: 13, color: '#003641', fontWeight: 700 }}>
                          dias corridos
                        </div>
                        <div style={{
                          marginLeft: 'auto', fontSize: 11.5, color: '#E65100', fontWeight: 700,
                          padding: '5px 10px', borderRadius: 8, background: 'rgba(255, 152, 0, 0.13)',
                        }}>
                          <CalendarDays size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                          Padrão: 15 dias
                        </div>
                      </div>
                    </div>

                    <div style={{
                      border: '1px solid rgba(106, 27, 154, 0.26)',
                      borderRadius: 13,
                      padding: 14,
                      background: 'linear-gradient(135deg, rgba(179, 136, 255, 0.10) 0%, rgba(125, 60, 152, 0.14) 100%)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10,
                      }}>
                        <div style={{
                          width: 11, height: 11, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #BA68C8 0%, #7B1FA2 100%)',
                          boxShadow: '0 0 0 4px rgba(106, 27, 154, 0.15)',
                        }} />
                        <div style={{
                          fontSize: 13, fontWeight: 850, color: '#003641', letterSpacing: 0.05,
                        }}>
                          Processo de Ajuizamento
                        </div>
                        <Gavel size={14} color="#4A148C" strokeWidth={2.2} />
                      </div>
                      <div style={{
                        fontSize: 12, color: '#546E7A', lineHeight: 1.6, marginBottom: 12,
                      }}>
                        Prazo (dias corridos a partir de <b>created_at</b>) para que o processo tenha a coluna
                        <span style={{
                          marginLeft: 4, marginRight: 4, padding: '2px 6px',
                          background: '#FFFFFF', borderRadius: 6, border: '1px solid rgba(106, 27, 154, 0.35)',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5,
                        }}>numero_processo_ajuizamento</span>
                        devidamente preenchida.
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="number" min={0} step={1}
                          style={{
                            width: 110, padding: '9px 12px', borderRadius: 10,
                            border: '1px solid rgba(106, 27, 154, 0.35)',
                            background: '#FFFFFF', color: '#003641',
                            fontSize: 15, fontWeight: 750, letterSpacing: 0.2, textAlign: 'right',
                            outline: 'none',
                            cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'text',
                            opacity: jurSettingsLocked || !jurIsAdmin ? 0.82 : 1,
                          }}
                          value={prazoAjuizamento}
                          disabled={jurSettingsLocked || !jurIsAdmin}
                          onChange={e => {
                            const v = e.target.value === '' ? '' : Number(e.target.value);
                            if (v === '' || (Number.isFinite(v))) {
                              setPrazoAjuizamento(v === '' ? 0 : Math.max(0, Math.floor(Number(v))));
                            }
                          }}
                        />
                        <div style={{ fontSize: 13, color: '#003641', fontWeight: 700 }}>
                          dias corridos
                        </div>
                        <div style={{
                          marginLeft: 'auto', fontSize: 11.5, color: '#4A148C', fontWeight: 700,
                          padding: '5px 10px', borderRadius: 8, background: 'rgba(106, 27, 154, 0.13)',
                        }}>
                          <CalendarDays size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                          Padrão: 45 dias
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: 14, padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(255, 152, 0, 0.09)',
                    border: '1px dashed rgba(251, 140, 0, 0.40)',
                    fontSize: 12, color: '#003641', opacity: 0.88, lineHeight: 1.65,
                  }}>
                    <div style={{ fontWeight: 800, color: '#E65100', marginBottom: 3 }}>⏱️ Aplicação das regras</div>
                    <div>• Conta de <b>created_at</b> da tabela <b>processos</b> (data de inclusão do processo no sistema).</div>
                    <div>• Dias <b>corridos</b> (incluindo finais de semana e feriados).</div>
                    <div>• Utilizada para identificar processos que estão <b>atrasados</b> com protocolo extrajudicial ou ajuizamento.</div>
                  </div>
                </div>
              </Sec>
            </>
          ) : currentView === 'configuracoes-acessos' ? (
            <>
              <ConfiguracoesHeader title="Configurações • Acessos" onBack={() => navigate('/juridico')} onHome={() => navigate('/juridico')} />
              <Sec title="Acessos do Módulo Jurídico">
                <div style={{ ...card, padding: 14 }}>
                  <div style={{
                    padding: '11px 13px',
                    borderRadius: 12,
                    marginBottom: 12,
                    background: 'linear-gradient(135deg, rgba(51,197,184,0.10) 0%, rgba(0,174,157,0.12) 100%)',
                    border: '1px solid rgba(0,174,157,0.30)',
                  }}>
                    <div style={{ fontWeight: 800, color: '#003641', fontSize: 12.5, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Users size={15} strokeWidth={2.3} style={{ color: '#00897B' }} />
                      Regras de acesso ao Módulo Jurídico
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: '#003641', opacity: 0.92 }}>
                      • Qualquer colaborador com e-mail <b>@sicoobjuriscred.com.br</b> recebe automaticamente perfil <b style={{color:'#00695C'}}>Usuário</b> no primeiro acesso (não precisa ser cadastrado manualmente).
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: '#003641', opacity: 0.92, marginTop: 2 }}>
                      • O perfil <b style={{color:'#C25A00'}}>Administrador</b> só pode ser concedido ou revogado pelo administrador fixo:
                      <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 7, background: '#FFFFFF', border: '1px solid rgba(0,174,157,0.35)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: '#00695C' }}>
                        {FIXED_ADMIN_EMAIL}
                      </span>
                    </div>
                    {!isFixedAdminNow() && (
                      <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 5, color: '#E65100', fontWeight: 700 }}>
                        ⚠️ Você não é o administrador fixo. O campo "Perfil" permanecerá bloqueado para promoção/rebaixamento de admins.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                    <input style={{
                      padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(0,54,65,0.18)',
                      background: '#FFFFFF', flex: '1 1 260px', color: '#003641',
                    }} placeholder="E-mail colaborador @sicoobjuriscred.com.br"
                      value={novoAcesso} onChange={e => setNovoAcesso(e.target.value)} />
                    <button className="interactive"
                      onClick={handleAddAcesso}
                      style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '9px 16px', borderRadius: 11,
                        background: 'linear-gradient(135deg, #96CB3A 0%, #7DB61C 55%, #6A9F16 100%)',
                        color: '#FFFFFF', fontWeight: 750, fontSize: 13,
                        boxShadow: '0 8px 22px rgba(125,182,28,0.30)',
                        cursor: 'pointer', border: '1px solid rgba(0, 54, 65, 0.35)',
                      }}>
                      <Save size={14} strokeWidth={2.15} /> Adicionar (perfil Usuário)
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(0,54,65,0.10)' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>E-mail</th>
                          <th style={{ ...thStyle, width: 210 }}>Perfil</th>
                          <th style={{ ...thStyle, width: 60 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {acessosLista.length === 0 && (
                          <tr><td colSpan={3} style={{ padding: 18, textAlign: 'center', opacity: 0.7 }}>
                            Nenhum acesso configurado além do administrador fixo.
                          </td></tr>
                        )}
                        {acessosLista.map(a => {
                          const isFixed = a.email.toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase();
                          const selectDisabled = isFixed || !isFixedAdminNow();
                          return (
                          <tr key={a.email}>
                            <td style={tdStyle}>{a.email}</td>
                            <td style={tdStyle}>
                              <select
                                value={a.role === 'admin' ? 'admin' : 'usuario'}
                                disabled={selectDisabled}
                                title={
                                  isFixed
                                    ? 'Administrador fixo: perfil não pode ser alterado.'
                                    : !isFixedAdminNow()
                                      ? `Apenas o administrador fixo (${FIXED_ADMIN_EMAIL}) pode alterar perfis Admin ↔ Usuário.`
                                      : 'Alterar perfil'
                                }
                                onChange={async (ev) => {
                                  const v = ev.target.value === 'admin' ? 'admin' : 'usuario';
                                  await handleTrocarPerfil(a.email, v);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  borderRadius: 9,
                                  border: '1px solid ' + (a.role === 'admin'
                                    ? 'rgba(251, 140, 0, 0.45)'
                                    : 'rgba(0,174,157,0.35)'),
                                  background: a.role === 'admin'
                                    ? 'linear-gradient(135deg, rgba(255,183,77,0.12) 0%, rgba(251,140,0,0.16) 100%)'
                                    : 'linear-gradient(135deg, rgba(51,197,184,0.10) 0%, rgba(0,174,157,0.13) 100%)',
                                  color: '#003641',
                                  fontSize: 12.5,
                                  fontWeight: 750,
                                  letterSpacing: 0.05,
                                  cursor: selectDisabled ? 'not-allowed' : 'pointer',
                                  opacity: selectDisabled ? 0.88 : 1,
                                }}>
                                <option value="usuario">👤 Usuário</option>
                                <option value="admin">🛡️ Administrador</option>
                              </select>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <button className="interactive"
                                onClick={() => handleDelAcesso(a.email)}
                                disabled={isFixed}
                                title={isFixed ? 'Administrador fixo não pode ser removido.' : 'Remover acesso'}
                                style={{
                                  width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  padding: 0, lineHeight: 0, borderRadius: 8,
                                  border: '1px solid rgba(0,54,65,0.14)',
                                  background: isFixed ? 'rgba(0,54,65,0.04)' : 'transparent',
                                  color: isFixed ? 'rgba(0,54,65,0.40)' : '#003641',
                                  cursor: isFixed ? 'not-allowed' : 'pointer',
                                  opacity: isFixed ? 0.6 : 1,
                                }}>
                                <Trash2 size={13} strokeWidth={2.1} />
                              </button>
                            </td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Sec>
            </>
          ) : (
            <>
              {/* KPIs */}
              {(() => {
                const kSource = kpis.length ? kpis : emptyKpis;
                const groupA = kSource.slice(0, 1);
                const groupB = kSource.slice(1);
                const outerStyle: React.CSSProperties = {
                  padding: 10,
                  borderRadius: 14,
                  border: '1px solid rgba(0, 174, 157, 0.20)',
                  background: 'linear-gradient(135deg, rgba(0, 54, 65, 0.035) 0%, rgba(0, 174, 157, 0.04) 100%)',
                  marginBottom: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                };
                const groupTitleStyle: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 11, letterSpacing: 0.12, textTransform: 'uppercase',
                  fontWeight: 800, color: '#003641', opacity: 0.85,
                  marginBottom: 8, paddingLeft: 4,
                };
                const subGroupShell: React.CSSProperties = {
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(0, 174, 157, 0.18)',
                  background: 'rgba(255, 255, 255, 0.55)',
                };
                return (
                  <div style={outerStyle}>
                    <div style={{ ...subGroupShell, padding: '8px 14px', borderColor: 'rgba(51, 197, 184, 0.35)', maxWidth: 520, flexShrink: 0 }}>
                      <div style={{ ...groupTitleStyle, marginBottom: 6, paddingLeft: 2, fontSize: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'linear-gradient(180deg, #33C5B8, #00AE9D)' }} />
                        Operacional
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${groupA.length}, minmax(0, 1fr))`,
                        gap: 10,
                      }}>
                        {groupA.map((k, i) => <KpiCard key={'op-' + i} kpi={k} compact />)}
                      </div>
                    </div>
                    <div style={{ ...subGroupShell, borderColor: 'rgba(150, 203, 58, 0.45)' }}>
                      <div style={groupTitleStyle}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(180deg, #96CB3A, #7DB61C)' }} />
                        Financeiro & Processos
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${groupB.length}, minmax(0, 1fr))`,
                        gap: 10,
                      }}>
                        {groupB.map((k, i) => <KpiCard key={'fp-' + i} kpi={k} />)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {chipsAplicados}

              {/* GRÁFICO ATIVO × PASSIVO */}
              <div
                style={{ ...card, padding: 14, marginBottom: 14 }}
                onMouseLeave={clearChartInteractionState}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, gap: 10, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{
                      fontSize: 13, letterSpacing: 0.08, textTransform: 'uppercase',
                      fontWeight: 800, color: '#003641',
                    }}>Ativo × Passivo × Acordos ao longo do tempo</div>
                    <div style={{ opacity: 0.7, fontSize: 11.5, marginTop: 3 }}>
                      Valores totais por mês — {ano || 'Todos os anos'}
                    </div>
                  </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 14,
                      rowGap: 6,
                      flexWrap: 'wrap',
                      color: '#003641',
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}>
                      {[
                        { label: 'Passivo', color: '#003641', key: 'passivo' as const },
                        { label: 'Ativo', color: '#7DB61C', key: 'ativo' as const },
                        { label: 'Acordos', color: '#FB8C00', key: 'acordos' as const },
                        { label: 'Média Móvel 3 meses', color: '#00AE9D', key: 'mm3' as const },
                      ].map((item) => (
                        <span
                          key={item.label}
                          onMouseEnter={() => setChartLegendHover(item.key)}
                          onMouseLeave={() => setChartLegendHover(null)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            opacity: !chartLegendHover || chartLegendHover === item.key ? 1 : 0.48,
                            transition: 'opacity 120ms ease, transform 120ms ease, background 120ms ease',
                            transform: chartLegendHover === item.key ? 'translateY(-1px)' : 'none',
                            padding: '2px 4px',
                            borderRadius: 8,
                            background: chartLegendHover === item.key ? 'rgba(0, 174, 157, 0.08)' : 'transparent',
                          }}>
                          {item.key === 'mm3' ? (
                            <span style={{
                              width: 16,
                              height: 0,
                              borderTop: `3px dashed ${item.color}99`,
                              flexShrink: 0,
                              opacity: 0.72,
                            }} />
                          ) : (
                            <span style={{
                              width: 13,
                              height: 9,
                              borderRadius: 3,
                              background: item.color,
                              boxShadow: `0 0 0 1px ${item.color}22 inset`,
                              flexShrink: 0,
                            }} />
                          )}
                          <span>{item.label}</span>
                        </span>
                      ))}
                    </div>
                </div>
                <div onMouseLeave={clearChartSeriesHover}>
                  <ReactECharts
                      ref={juridicoChartRef}
                      option={chartOption}
                      onEvents={juridicoChartEvents}
                    notMerge={true} lazyUpdate={false}
                    style={{ height: 314, width: '100%' }}
                    opts={{ renderer: 'canvas' }} />
                </div>
              </div>

              {/* CONTAINER TIPO DE AÇÕES — COM OS 3 ÍCONES NO CANTO SUPERIOR DIREITO */}
              <div style={{ ...card, padding: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
                  marginBottom: 10,
                }}>
                  <div style={{
                    fontSize: 13, letterSpacing: 0.08, textTransform: 'uppercase',
                    fontWeight: 800, color: '#003641',
                  }}>
                    Tipo de ações{' '}
                    <span style={{ opacity: 0.55, fontWeight: 500 }}>
                      ({filtered.length} registro{filtered.length === 1 ? '' : 's'})
                      {filtered.length !== totalRegistros ? (
                        <span style={{ opacity: 0.65, marginLeft: 6 }}>
                          de {totalRegistros}
                        </span>
                      ) : null}
                    </span>
                  </div>

                  {/* 3 ÍCONES MOVIDOS PARA AQUI — CANTO SUPERIOR DIREITO */}
                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button" className="interactive"
                      onClick={() => { void handleExportXlsx(); }}
                      title="Exportar XLSX"
                      style={{ ...iconBtnBase, color: '#0B8077' }}>
                      <Download size={20} strokeWidth={2.05} />
                    </button>
                    <button
                      type="button"
                      className="interactive"
                      onClick={() => { void resetTipoAcoesColumnWidths(); }}
                      disabled={!tipoAcoesColumnWidthsCustomized}
                      title={tipoAcoesColumnWidthsCustomized ? 'Resetar larguras personalizadas' : 'Usando larguras padrão da página'}
                      style={{
                        ...iconBtnBase,
                        color: tipoAcoesColumnWidthsCustomized ? '#0B8077' : 'rgba(0,54,65,0.36)',
                        cursor: tipoAcoesColumnWidthsCustomized ? 'pointer' : 'not-allowed',
                        opacity: tipoAcoesColumnWidthsCustomized ? 1 : 0.75,
                      }}>
                      <FilterX size={18} strokeWidth={2.15} />
                    </button>
                    <button
                      type="button" className="interactive"
                      onClick={handleNovo}
                      disabled={jurSettingsLocked}
                      title={jurSettingsLocked
                        ? 'Apenas administradores do Jurídico podem criar registros.'
                        : 'Criar novo registro'}
                      style={{
                        ...iconBtnBase,
                        color: jurSettingsLocked ? 'rgba(106, 159, 22, 0.5)' : '#6A9F16',
                        cursor: jurSettingsLocked ? 'not-allowed' : 'pointer',
                        opacity: jurSettingsLocked ? 0.6 : 1,
                      }}>
                      <SquarePlus size={20} strokeWidth={2.05} />
                    </button>
                  </div>
                </div>

                {/* TABELA */}
                <div style={{
                  overflowX: 'auto', maxHeight: 540, overflowY: 'auto',
                  borderRadius: 12,
                  border: '1px solid rgba(0,54,65,0.10)',
                }}>
                  <table style={{
                    width: tipoAcoesColumnWidthsCustomized ? tipoAcoesTableMinWidth : '100%',
                    minWidth: tipoAcoesColumnWidthsCustomized ? tipoAcoesTableMinWidth : '100%',
                    borderCollapse: 'separate', borderSpacing: 0,
                    tableLayout: 'fixed',
                  }}>
                    <colgroup>
                      <col style={{ width: getTipoAcoesColumnCssWidth('origem') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('autor') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('reu') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('contrato') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('processo') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('status') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('natureza') }} />
                      <col style={{ width: getTipoAcoesColumnCssWidth('valor') }} />
                      <col style={{ width: 52 }} />
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                      <tr>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('origem'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Origem{renderTipoAcoesResizeHandle('origem')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('autor'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Autor(es){renderTipoAcoesResizeHandle('autor')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('reu'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Réu(s){renderTipoAcoesResizeHandle('reu')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('contrato'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Contrato Sicoob{renderTipoAcoesResizeHandle('contrato')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('processo'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Nº Processo{renderTipoAcoesResizeHandle('processo')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('status'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Status{renderTipoAcoesResizeHandle('status')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('natureza'), position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Natureza{renderTipoAcoesResizeHandle('natureza')}</div>
                        </th>
                        <th style={{ ...thStyle, width: getTipoAcoesColumnCssWidth('valor'), textAlign: 'right', position: 'sticky' }}>
                          <div style={{ position: 'relative' }}>Valor</div>
                        </th>
                        <th style={{ ...thStyle, width: 52, textAlign: 'right', paddingRight: 12 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0
                        ? (
                          <tr>
                            <td colSpan={9} style={{ padding: 22, textAlign: 'center', opacity: 0.7 }}>
                              {loading ? 'Carregando...' : 'Nenhum registro encontrado.'}
                            </td>
                          </tr>
                        )
                        : filtered.map((r, idx) => (
                          <tr key={String(r.id ?? idx)} style={{
                            background: idx % 2 ? 'rgba(0, 174, 157, 0.04)' : 'transparent',
                          }}>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('origem'),
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }} title={r.origem || ''}>
                              {r.origem || '-'}
                            </td>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('autor'),
                              overflow: 'hidden', textOverflow: 'ellipsis',
                            }} title={r.autor || ''}>
                              <span style={{
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden', lineHeight: 1.35,
                              }}>
                                {r.autor || '-'}
                              </span>
                            </td>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('reu'),
                              overflow: 'hidden', textOverflow: 'ellipsis',
                            }} title={r.reu || ''}>
                              <span style={{
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden', lineHeight: 1.35,
                              }}>
                                {r.reu || '-'}
                              </span>
                            </td>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('contrato'),
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                            }} className="mono" title={r.contrato || ''}>
                              {r.contrato || '-'}
                            </td>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('processo'),
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                            }} className="mono" title={r.processo || ''}>
                              {r.processo || '-'}
                            </td>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('status'),
                              overflow: 'hidden',
                            }} title={r.status || ''}>
                              <span style={{
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden', lineHeight: 1.35,
                              }}>
                                {r.status || '-'}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, width: getTipoAcoesColumnCssWidth('natureza'), textAlign: 'left' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-start',
                                padding: '3px 6px', borderRadius: 999,
                                fontSize: 10.25, fontWeight: 700,
                                border: '1px solid rgba(0,54,65,0.16)',
                                background: naturezaBg(r.natureza),
                                color: '#003641',
                                width: 'fit-content',
                                maxWidth: '100%',
                                minWidth: 0,
                              }}>
                                <span
                                  className={`natureza-dot-wrap${String(r.natureza || '').trim().toLowerCase() === 'ativo' ? ' is-ativo' : ''}`}
                                >
                                  <span
                                    className="natureza-dot-core"
                                    style={{ background: naturezaDot(r.natureza) }}
                                  />
                                  {String(r.natureza || '').trim().toLowerCase() === 'ativo' ? (
                                    <>
                                      <span className="natureza-dot-wave wave-1" />
                                      <span className="natureza-dot-wave wave-2" />
                                    </>
                                  ) : null}
                                </span>
                                <span style={{
                                  display: 'inline-block',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  minWidth: 0,
                                  maxWidth: '100%',
                                }}>
                                  {r.natureza || '-'}
                                </span>
                              </span>
                            </td>
                            <td style={{
                              ...tdStyle, width: getTipoAcoesColumnCssWidth('valor'),
                              textAlign: 'right', paddingRight: 12,
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                              whiteSpace: 'nowrap',
                            }} className="mono">
                              {brl(r.valor)}
                            </td>
                            <td style={{
                              ...tdStyle, width: 52, textAlign: 'right',
                              whiteSpace: 'nowrap', paddingRight: 12,
                            }}>
                              <button
                                type="button"
                                className="interactive"
                                onClick={() => handleEditar(r)}
                                disabled={jurSettingsLocked}
                                title={jurSettingsLocked ? 'Bloqueado — somente administradores podem editar.' : 'Editar'}
                                style={{
                                  width: 28, height: 28,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  padding: 0, lineHeight: 0, borderRadius: 8,
                                  border: '1px solid rgba(0,174,157,0.45)',
                                  background: jurSettingsLocked ? 'rgba(0,54,65,0.03)' : 'rgba(0,174,157,0.08)',
                                  color: jurSettingsLocked ? 'rgba(0,54,65,0.45)' : '#0B8077',
                                  cursor: jurSettingsLocked ? 'not-allowed' : 'pointer',
                                  opacity: jurSettingsLocked ? 0.7 : 1,
                                }}>
                                <Pencil size={13} strokeWidth={2.1} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* DIALOG CRUD */}
      {dlgOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          padding: '18px 16px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 'min(960px, 97vw)',
            maxHeight: '88vh',
            background: '#FFFFFF', color: '#003641',
            borderRadius: 18,
            border: '1px solid rgba(0, 174, 157, 0.45)',
            boxShadow: '0 36px 100px rgba(0,0,0,0.32), 0 10px 30px rgba(0,54,65,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px 12px',
              borderBottom: '1px solid rgba(0, 174, 157, 0.18)',
              background: 'linear-gradient(180deg, rgba(0, 174, 157, 0.06) 0%, rgba(255,255,255,0) 100%)',
              position: 'sticky', top: 0, zIndex: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 11,
                  background: 'linear-gradient(135deg, rgba(0, 174, 157, 0.18) 0%, rgba(125, 182, 28, 0.18) 100%)',
                  border: '1px solid rgba(0, 174, 157, 0.28)',
                }}>
                  {dlgEdit ? <Pencil size={16} strokeWidth={2.15} color="#0B8077" /> : <SquarePlus size={16} strokeWidth={2.15} color="#0B8077" />}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 850, letterSpacing: 0.01, lineHeight: 1.05 }}>
                    {dlgEdit ? 'Editar registro' : 'Novo registro'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(0,54,65,0.62)', marginTop: 2, letterSpacing: 0.01 }}>
                    Módulo Jurídico • {dlgEdit ? `Atualize os campos necessários abaixo.` : `Preencha os campos abaixo. Campos opcionais ficam em branco.`}
                  </div>
                </div>
              </div>
              <button onClick={() => setDlgOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, lineHeight: 0, border: 0,
                  background: 'rgba(0,54,65,0.06)', color: '#003641', cursor: 'pointer',
                  transition: 'transform 140ms ease, background 140ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,82,101,0.12)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,54,65,0.06)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                title="Fechar">
                <X size={16} strokeWidth={2.15} />
              </button>
            </div>

            <div style={{
              padding: '16px 20px 8px',
              overflowY: 'auto',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
              scrollbarGutter: 'stable',
            }}>
              <style>{`
                #juridico-root * { scrollbar-color: rgba(0, 174, 157, 0.60) rgba(0, 174, 157, 0.08); }
                #juridico-root *::-webkit-scrollbar { width: 10px; height: 10px; }
                #juridico-root *::-webkit-scrollbar-track { background: rgba(0, 174, 157, 0.06); border-radius: 999px; }
                #juridico-root *::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(0,174,157,0.65), rgba(125,182,28,0.55)); border-radius: 999px; border: 2px solid rgba(255,255,255,0.9); }
                #juridico-root *::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(11,128,119,0.85), rgba(106,159,22,0.75)); }
              `}</style>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={formLbl}>Origem</label>
                <select style={formInp} value={form.origem ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(prev => {
                      const next: typeof prev = { ...prev, origem: v };
                      if (v === 'Enviado ao Jurídico') {
                        next.data = _todayBr();
                      }
                      return next;
                    });
                  }}>
                  {origensOptions.length
                    ? origensOptions.map(o => <option key={o}>{o}</option>)
                    : ['Cooperativa Autora', 'Cooperativa Ré', 'Enviado ao Jurídico', 'Extrajudicial']
                      .map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <JuridicoDateInput
                  label="Data"
                  value={form.data ?? ''}
                  onChange={(d) => setForm({ ...form, data: d })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                  <label style={{ ...formLbl, marginBottom: 0 }}>Autor(es) (até 5)</label>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFormAutoresCount(Math.max(1, formAutoresCount - 1))}
                      disabled={formAutoresCount <= 1}
                      title="Remover último autor"
                      style={{
                        width: 26, height: 26, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, lineHeight: 0, border: '1px solid rgba(0,54,65,0.18)',
                        background: '#FFFFFF', color: '#003641', cursor: formAutoresCount <= 1 ? 'not-allowed' : 'pointer',
                        opacity: formAutoresCount <= 1 ? 0.5 : 1,
                      }}><Minus size={13} strokeWidth={2.2} /></button>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.06, color: '#003641', opacity: 0.75 }}>
                      {formAutoresCount} de 5
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormAutoresCount(Math.min(5, formAutoresCount + 1))}
                      disabled={formAutoresCount >= 5}
                      title="Adicionar autor"
                      style={{
                        width: 26, height: 26, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, lineHeight: 0, border: '1px solid rgba(125, 182, 28, 0.45)',
                        background: 'linear-gradient(135deg, #F0FDF9, #FFFFFF)', color: '#0B8077',
                        cursor: formAutoresCount >= 5 ? 'not-allowed' : 'pointer',
                        opacity: formAutoresCount >= 5 ? 0.5 : 1,
                      }}><Plus size={13} strokeWidth={2.2} /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Array.from({ length: formAutoresCount }, (_, i) => i + 1).map((n) => (
                    <div key={`autor-${n}`} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10.5, letterSpacing: 0.07, fontWeight: 800, color: '#003641', opacity: 0.7, marginBottom: 4, display: 'block' }}>Autor {n} • Nome</label>
                        <input style={formInp} placeholder="Nome completo"
                          value={(form as any)[`autor_${n}_nome`] ?? ''}
                          onChange={e => setForm(_autoFillJuriscredCnpjOnNome(form, 'autor', n, e.target.value))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10.5, letterSpacing: 0.07, fontWeight: 800, color: '#003641', opacity: 0.7, marginBottom: 4, display: 'block' }}>Autor {n} • CPF / CNPJ</label>
                        <input style={formInp} placeholder="000.000.000-00 ou 00.000.000/0001-00"
                          value={(form as any)[`autor_${n}_cpf_cnpj`] ?? ''}
                          onChange={e => setForm({ ...form, [`autor_${n}_cpf_cnpj`]: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                  <label style={{ ...formLbl, marginBottom: 0 }}>Réu(s) (até 5)</label>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFormReusCount(Math.max(1, formReusCount - 1))}
                      disabled={formReusCount <= 1}
                      title="Remover último réu"
                      style={{
                        width: 26, height: 26, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, lineHeight: 0, border: '1px solid rgba(0,54,65,0.18)',
                        background: '#FFFFFF', color: '#003641', cursor: formReusCount <= 1 ? 'not-allowed' : 'pointer',
                        opacity: formReusCount <= 1 ? 0.5 : 1,
                      }}><Minus size={13} strokeWidth={2.2} /></button>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.06, color: '#003641', opacity: 0.75 }}>
                      {formReusCount} de 5
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormReusCount(Math.min(5, formReusCount + 1))}
                      disabled={formReusCount >= 5}
                      title="Adicionar réu"
                      style={{
                        width: 26, height: 26, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, lineHeight: 0, border: '1px solid rgba(251, 140, 0, 0.45)',
                        background: 'linear-gradient(135deg, #FFF7ED, #FFFFFF)', color: '#C2410C',
                        cursor: formReusCount >= 5 ? 'not-allowed' : 'pointer',
                        opacity: formReusCount >= 5 ? 0.5 : 1,
                      }}><Plus size={13} strokeWidth={2.2} /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Array.from({ length: formReusCount }, (_, i) => i + 1).map((n) => (
                    <div key={`reu-${n}`} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10.5, letterSpacing: 0.07, fontWeight: 800, color: '#003641', opacity: 0.7, marginBottom: 4, display: 'block' }}>Réu {n} • Nome</label>
                        <input style={formInp} placeholder="Nome completo / Razão social"
                          value={(form as any)[`reu_${n}_nome`] ?? ''}
                          onChange={e => setForm(_autoFillJuriscredCnpjOnNome(form, 'reu', n, e.target.value))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10.5, letterSpacing: 0.07, fontWeight: 800, color: '#003641', opacity: 0.7, marginBottom: 4, display: 'block' }}>Réu {n} • CPF / CNPJ</label>
                        <input style={formInp} placeholder="000.000.000-00 ou 00.000.000/0001-00"
                          value={(form as any)[`reu_${n}_cpf_cnpj`] ?? ''}
                          onChange={e => setForm({ ...form, [`reu_${n}_cpf_cnpj`]: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={formLbl}>Contrato Sicoob</label>
                <input style={formInp}
                  value={(form as any).numero_contrato_sicoob ?? form.contrato ?? ''}
                  onChange={e => setForm({ ...form, contrato: e.target.value, numero_contrato_sicoob: e.target.value })} />
              </div>
              <div>
                <label style={formLbl}>Nº Processo (ajuizamento)</label>
                <input style={formInp}
                  value={(form as any).numero_processo_ajuizamento ?? form.processo ?? ''}
                  onChange={e => setForm({ ...form, processo: e.target.value, numero_processo_ajuizamento: e.target.value })} />
              </div>
              <div>
                <label style={formLbl}>Status</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select style={{ ...formInp, flex: '1 1 auto', minWidth: 0 }}
                    value={form.status ?? ''}
                    onChange={e => setForm({
                      ...form,
                      status: e.target.value,
                      status_ultimo_andamento_ajuizamento: e.target.value,
                      status_extrajudicial: e.target.value,
                    })}>
                    {(() => {
                      const arr = statusesDistinctDb.length ? statusesDistinctDb : ([
                        'Aguardando Cumprimento de Subsídio',
                        'Notificação Não Realizada',
                        'Procedimento Cancelado',
                        'Aguardando Prazo para Pagamento',
                        'Encaminhada para Ajuizamento',
                        'Em atraso',
                        'Extinto',
                      ] as string[]);
                      const selVal = String(form.status ?? '').trim();
                      const hasSel = selVal && !arr.includes(selVal);
                      const finalArr = hasSel ? [selVal, ...arr] : arr;
                      return finalArr.map((s: string) => <option key={s}>{s}</option>);
                    })()}
                  </select>
                  <button
                    type="button"
                    title={statusShowAdd ? 'Cadastrar novo status' : 'Novo status'}
                    className="interactive"
                    onClick={() => {
                      if (statusShowAdd) {
                        const raw = statusNewAddTmp;
                        if (String(raw ?? '').trim().length >= 2) {
                          addStatusOption(raw).finally(() => {
                            setStatusShowAdd(false);
                            setStatusNewAddTmp('');
                          });
                        } else {
                          setStatusShowAdd(false);
                          setStatusNewAddTmp('');
                        }
                      } else {
                        setStatusShowAdd(true);
                        setStatusNewAddTmp('');
                        setTimeout(() => {
                          const el = document.getElementById('jur-status-new-input') as HTMLInputElement | null;
                          el?.focus?.();
                        }, 30);
                      }
                    }}
                    style={{
                      ...iconBtnBase,
                      color: jurSettingsLocked || !jurIsAdmin
                        ? 'rgba(106, 159, 22, 0.5)'
                        : (statusShowAdd ? '#0B8077' : '#6A9F16'),
                      border: statusShowAdd
                        ? '1px solid rgba(11, 128, 119, 0.22)'
                        : '1px solid rgba(106, 159, 22, 0.18)',
                      background: statusShowAdd
                        ? 'rgba(0, 174, 157, 0.10)'
                        : 'rgba(125, 182, 28, 0.10)',
                      cursor: jurSettingsLocked || !jurIsAdmin ? 'not-allowed' : 'pointer',
                      opacity: jurSettingsLocked || !jurIsAdmin ? 0.55 : 1,
                      transition: 'transform 130ms ease, box-shadow 160ms ease, background 150ms ease, color 150ms ease',
                      flexShrink: 0,
                    }}>
                    <SquarePlus size={20} strokeWidth={2.05} />
                  </button>
                </div>
                {statusShowAdd && (
                  <div style={{ marginTop: 6 }}>
                    <input
                      id="jur-status-new-input"
                      style={formInp}
                      placeholder="Digite novo status + Enter (ou clique novamente no +)"
                      value={statusNewAddTmp}
                      onChange={e => setStatusNewAddTmp(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const raw = statusNewAddTmp;
                          if (String(raw ?? '').trim().length >= 2) {
                            addStatusOption(raw).finally(() => {
                              setStatusShowAdd(false);
                              setStatusNewAddTmp('');
                            });
                          }
                        } else if (e.key === 'Escape') {
                          setStatusShowAdd(false);
                          setStatusNewAddTmp('');
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={formLbl}>Natureza</label>
                <select style={formInp} value={form.natureza ?? 'Ativo'}
                  onChange={e => setForm({ ...form, natureza: e.target.value })}>
                  <option>Ativo</option>
                  <option>Passivo</option>
                  <option>Extinta</option>
                </select>
              </div>

              {showAjuizamentoSection && (
                <>
                  <div style={sectionHdr}><Database size={14} color="#00695C" /><span style={sectionLbl}>Ajuizamento (1º Grau)</span></div>

                  <div>
                    <label style={formLbl}>Nº PA (enviados ajuizamento)</label>
                    <input style={{ ...formInp, background: 'rgba(0,54,65,0.045)', cursor: 'default', color: 'rgba(0,54,65,0.85)' }}
                      readOnly
                      title="Preenchido automaticamente pelo gerente selecionado"
                      value={(form as any).numero_pa_enviados_ajuizamento ?? ''} />
                  </div>
                  <div>
                    <label style={formLbl}>Valor Dado Causa (R$)</label>
                    <input type="number" step="0.01" style={formInp}
                      value={(form as any).valor_dado_causa_ajuizamento ?? 0}
                      onChange={e => setForm({ ...form, valor_dado_causa_ajuizamento: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <JuridicoDateInput
                      label="Data Distribuição (ajuizamento)"
                      value={(form as any).data_distribuicao_ajuizamento ?? ''}
                      onChange={(d) => {
                        const after = { ...form, data_distribuicao_ajuizamento: d };
                        setForm(_autoCalcDataLimiteAjuizamento(after, prazoAjuizamento));
                      }}
                      onAfterChange={(d) => {
                        const after = { ...form, data_distribuicao_ajuizamento: d };
                        setForm(_autoCalcDataLimiteAjuizamento(after, prazoAjuizamento));
                      }}
                    />
                  </div>
                  <div>
                    <JuridicoDateInput
                      label="Data Limite Ajuizamento"
                      value={(form as any).data_limite_ajuizamento ?? ''}
                      onChange={(d) => setForm({ ...form, data_limite_ajuizamento: d })}
                    />
                  </div>
                  <div>
                    <label style={formLbl}>Tipo de Ação</label>
                    <input style={formInp} value={(form as any).tipo_acao_ajuizamento ?? ''}
                      onChange={e => setForm({ ...form, tipo_acao_ajuizamento: e.target.value })} />
                  </div>
                  <div>
                    <JuridicoDateInput
                      label="Data Último Andamento"
                      value={(form as any).data_ultimo_andamento_ajuizamento ?? ''}
                      onChange={(d) => setForm({ ...form, data_ultimo_andamento_ajuizamento: d })}
                    />
                  </div>
                </>
              )}

              {showExtrajudicialSection && (
                <>
                  <div style={sectionHdr}><Hourglass size={14} color="#C2410C" /><span style={sectionLbl}>Extrajudicial / Cartório</span></div>

                  <div>
                    <JuridicoDateInput
                      label="Data Recebimento (cobrança extrajudicial)"
                      value={(form as any).data_recebimento_cobranca_extrajudicial ?? ''}
                      onChange={(d) => setForm({ ...form, data_recebimento_cobranca_extrajudicial: d })}
                    />
                  </div>
                  <div>
                    <label style={formLbl}>Matrícula (extrajudicial)</label>
                    <input style={formInp} value={(form as any).matricula_extrajudicial ?? ''}
                      onChange={e => setForm({ ...form, matricula_extrajudicial: e.target.value })} />
                  </div>
                  <div>
                    <label style={formLbl}>Cartório (extrajudicial)</label>
                    <input style={formInp} value={(form as any).cartorio_extrajudicial ?? ''}
                      onChange={e => setForm({ ...form, cartorio_extrajudicial: e.target.value })} />
                  </div>
                  <div>
                    <label style={formLbl}>Nº Protocolo Cartório</label>
                    <input style={formInp} value={(form as any).numero_protocolo_cartorio_extrajudicial ?? ''}
                      onChange={e => setForm({ ...form, numero_protocolo_cartorio_extrajudicial: e.target.value })} />
                  </div>
                  <div>
                    <JuridicoDateInput
                      label="Data Protocolização Cartório"
                      value={(form as any).data_protocolizacao_cartorio_extrajudicial ?? ''}
                      onChange={(d) => setForm({ ...form, data_protocolizacao_cartorio_extrajudicial: d })}
                    />
                  </div>
                  <div>
                    <JuridicoDateInput
                      label="Data Limite p/ Protocolar"
                      value={(form as any).data_limite_protocolar_extrajudicial ?? ''}
                      onChange={(d) => setForm({ ...form, data_limite_protocolar_extrajudicial: d })}
                    />
                  </div>
                  <div>
                    <JuridicoDateInput
                      label="Data Última Etapa (extrajudicial)"
                      value={(form as any).data_ultima_etapa_extrajudicial ?? ''}
                      onChange={(d) => setForm({ ...form, data_ultima_etapa_extrajudicial: d })}
                    />
                  </div>
                </>
              )}

              <div style={sectionHdr}><Users size={14} color="#1565C0" /><span style={sectionLbl}>Rastreabilidade / Equipe</span></div>

              <div>
                <label style={formLbl}>Gerente</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    style={{ ...formInp, flex: '1 1 auto', minWidth: 0 }}
                    value={(form as any).gerente ?? ''}
                    onChange={e => {
                      const nome = e.target.value;
                      setForm(prev => {
                        const next: any = { ...prev, gerente: nome };
                        const match = gerentesCadastro.find(
                          g => g.nome.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0,
                        );
                        next.numero_pa_enviados_ajuizamento = match?.pa ?? '';
                        return next;
                      });
                    }}>
                    <option value="">Selecione</option>
                    {Array.from(new Set([...gerentesDistinctDb, ...gerentesCadastro.map(g => g.nome)]))
                      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
                      .map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <button type="button" className="interactive" title="Cadastrar novo gerente"
                    onClick={() => {
                      setGerenteNewNome(String((form as any).gerente ?? '').trim());
                      const paAtual = String((form as any).numero_pa_enviados_ajuizamento ?? '').trim();
                      setGerenteNewPa(GERENTE_PA_OPTIONS.includes(paAtual as typeof GERENTE_PA_OPTIONS[number]) ? paAtual : GERENTE_PA_OPTIONS[0]);
                      setGerenteAddOpen(true);
                    }}
                    style={{
                      ...iconBtnBase,
                      color: '#6A9F16',
                      border: '1px solid rgba(106, 159, 22, 0.18)',
                      background: 'rgba(125, 182, 28, 0.10)',
                      transition: 'transform 130ms ease, box-shadow 160ms ease, background 150ms ease, color 150ms ease',
                      flexShrink: 0,
                    }}>
                    <SquarePlus size={20} strokeWidth={2.05} />
                  </button>
                </div>
              </div>
              <div>
                <label style={formLbl}>Nº PA</label>
                <input style={{ ...formInp, background: 'rgba(0,54,65,0.045)', cursor: 'default', color: 'rgba(0,54,65,0.85)' }}
                  readOnly
                  title="Preenchido automaticamente pelo gerente selecionado"
                  value={(form as any).numero_pa_enviados_ajuizamento ?? ''} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={formLbl}>Observações Gerais</label>
                <textarea style={formTxt} rows={3}
                  value={form.observacoes ?? ''}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
            </div>

            <div style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
              padding: '14px 20px 18px',
              borderTop: '1px solid rgba(0, 174, 157, 0.16)',
              background: 'linear-gradient(0deg, rgba(0, 174, 157, 0.05) 0%, rgba(255,255,255,0) 100%)',
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}>
              <div style={{
                fontSize: 11.5, color: 'rgba(0,54,65,0.62)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Info size={13} strokeWidth={2} color="#00897B" style={{ flexShrink: 0 }} />
                Datas obrigatórias no formato dd/mm/aaaa. Campos vazios são salvos em branco (null).
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {(() => {
                  const origemBlock = String(form?.origem ?? dlgEdit?.origem ?? '').trim() === 'Enviado ao Jurídico';
                  return (
                    <button onClick={handleAbrirAcordo}
                      disabled={origemBlock}
                      className="interactive"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 12,
                        background: origemBlock
                          ? 'rgba(0,54,65,0.05)'
                          : acordoExists
                          ? 'rgba(251,140,0,0.06)'
                          : 'linear-gradient(135deg, #FFB74D 0%, #FB8C00 50%, #EF6C00 100%)',
                        color: origemBlock
                          ? 'rgba(0,54,65,0.40)'
                          : acordoExists
                          ? '#E65100'
                          : '#FFFFFF',
                        fontWeight: 800, fontSize: 13,
                        cursor: origemBlock ? 'not-allowed' : 'pointer',
                        boxShadow: origemBlock
                          ? 'inset 0 0 0 1.5px rgba(0,54,65,0.12)'
                          : acordoExists
                          ? 'inset 0 0 0 1.5px rgba(251,140,0,0.35)'
                          : '0 10px 26px rgba(251,140,0,0.30)',
                        border: origemBlock
                          ? '1.5px solid rgba(0,54,65,0.14)'
                          : acordoExists
                          ? '1.5px solid rgba(251,140,0,0.40)'
                          : '1px solid rgba(120, 50, 0, 0.30)',
                        opacity: origemBlock ? 0.92 : 1,
                        letterSpacing: 0.01,
                        transition: 'transform 150ms cubic-bezier(.22,.9,.28,1.1), box-shadow 180ms ease',
                      }}
                      title={origemBlock
                        ? 'Acordos não são permitidos para Origem "Enviado ao Jurídico"'
                        : acordoExists
                        ? 'Ver acordo cadastrado'
                        : 'Cadastrar acordo'}>
                      {origemBlock ? (
                        <>
                          <AlertOctagon size={15} strokeWidth={2.2} /> Acordo
                        </>
                      ) : acordoExists ? (
                        <>
                          <Info size={15} strokeWidth={2.2} /> Acordo
                        </>
                      ) : (
                        <>
                          <Scale size={15} strokeWidth={2.2} /> Acordo
                        </>
                      )}
                    </button>
                  );
                })()}
                <button onClick={() => setDlgOpen(false)}
                  className="interactive"
                  disabled={dlgSaving}
                  style={{
                    padding: '10px 18px', borderRadius: 12,
                    border: '1px solid rgba(0,54,65,0.16)',
                    background: '#FFFFFF', color: '#003641',
                    fontWeight: 750, fontSize: 13, cursor: dlgSaving ? 'not-allowed' : 'pointer',
                    opacity: dlgSaving ? 0.6 : 1,
                    transition: 'transform 150ms ease, box-shadow 180ms ease, background 150ms ease',
                  }}>Cancelar</button>
                <button onClick={handleSalvar}
                  className="interactive"
                  disabled={dlgSaving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 22px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #96CB3A 0%, #7DB61C 50%, #6A9F16 100%)',
                    color: '#FFFFFF', fontWeight: 850, fontSize: 13.2,
                    cursor: dlgSaving ? 'not-allowed' : 'pointer',
                    boxShadow: dlgSaving ? 'none' : '0 10px 26px rgba(125,182,28,0.32)',
                    opacity: dlgSaving ? 0.75 : 1,
                    border: '1px solid rgba(0, 54, 65, 0.32)',
                    letterSpacing: 0.01,
                    transition: 'transform 150ms cubic-bezier(.22,.9,.28,1.1), box-shadow 180ms ease',
                  }}>
                  <Save size={15} strokeWidth={2.2} /> {dlgSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gerenteAddOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 210,
            background: 'rgba(0, 20, 25, 0.45)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              width: 'min(560px, 96vw)',
              maxHeight: '92vh',
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 30px 80px rgba(0,54,65,0.28), 0 10px 26px rgba(0,54,65,0.18)',
              border: '1px solid rgba(0, 174, 157, 0.18)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 22px',
              borderBottom: '1px solid rgba(0,174,157,0.18)',
              background: 'linear-gradient(180deg, rgba(240,253,250,1) 0%, rgba(255,255,255,0) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(0,174,157,0.20) 0%, rgba(125,182,28,0.24) 100%)',
                  color: '#0B8077',
                }}>
                  <Users size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 16.5, fontWeight: 850, color: '#003641', lineHeight: 1.1 }}>
                    Novo Gerente
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,54,65,0.6)', marginTop: 2 }}>
                    Cadastre o gerente e o número do PA vinculado
                  </div>
                </div>
              </div>
              <button onClick={() => setGerenteAddOpen(false)}
                className="interactive"
                disabled={gerenteAddSaving}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(0,54,65,0.12)',
                  background: '#FFFFFF', cursor: gerenteAddSaving ? 'not-allowed' : 'pointer', color: '#003641',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  opacity: gerenteAddSaving ? 0.55 : 1,
                }}>
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>

            <div style={{
              overflowY: 'auto',
              padding: '20px 24px 16px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div>
                <label style={formLbl}>Gerente</label>
                <input
                  id="jur-gerente-new-nome"
                  style={formInp}
                  placeholder="Nome do gerente"
                  value={gerenteNewNome}
                  onChange={e => setGerenteNewNome(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addGerenteCadastro(gerenteNewNome, gerenteNewPa).then(ok => {
                        if (ok) { setGerenteAddOpen(false); setGerenteNewNome(''); setGerenteNewPa(''); }
                      });
                    } else if (e.key === 'Escape') {
                      setGerenteAddOpen(false);
                    }
                  }}
                />
              </div>
              <div>
                <label style={formLbl}>Nº PA</label>
                <select
                  style={{ ...formInp, ...inputReadOnlyStyle }}
                  title="Selecione um PA padronizado"
                  value={gerenteNewPa}
                  onChange={e => setGerenteNewPa(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addGerenteCadastro(gerenteNewNome, gerenteNewPa).then(ok => {
                        if (ok) { setGerenteAddOpen(false); setGerenteNewNome(''); setGerenteNewPa(''); }
                      });
                    } else if (e.key === 'Escape') {
                      setGerenteAddOpen(false);
                    }
                  }}
                >
                  {GERENTE_PA_OPTIONS.map((pa) => (
                    <option key={pa} value={pa}>{pa}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
              padding: '14px 22px 18px',
              borderTop: '1px solid rgba(0, 174, 157, 0.16)',
              background: 'linear-gradient(0deg, rgba(0, 174, 157, 0.05) 0%, rgba(255,255,255,0) 100%)',
            }}>
              <button type="button" className="interactive"
                onClick={() => setGerenteAddOpen(false)}
                disabled={gerenteAddSaving}
                style={{
                  padding: '10px 18px', borderRadius: 12,
                  border: '1px solid rgba(0,54,65,0.14)', background: '#FFFFFF',
                  color: '#003641', fontSize: 13.5, fontWeight: 750,
                  cursor: gerenteAddSaving ? 'not-allowed' : 'pointer',
                  opacity: gerenteAddSaving ? 0.6 : 1,
                }}>
                Cancelar
              </button>
              <button type="button" className="interactive"
                onClick={() => {
                  void addGerenteCadastro(gerenteNewNome, gerenteNewPa).then(ok => {
                    if (ok) { setGerenteAddOpen(false); setGerenteNewNome(''); setGerenteNewPa(''); }
                  });
                }}
                disabled={gerenteAddSaving}
                style={{
                  padding: '10px 20px', borderRadius: 12, border: 0,
                  background: 'linear-gradient(135deg, #0B8077 0%, #00AE9D 100%)',
                  color: '#FFFFFF', fontSize: 13.5, fontWeight: 800,
                  cursor: gerenteAddSaving ? 'not-allowed' : 'pointer',
                  boxShadow: gerenteAddSaving ? 'none' : '0 10px 24px rgba(0,174,157,0.28)',
                  opacity: gerenteAddSaving ? 0.7 : 1,
                }}>
                {gerenteAddSaving ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {acordoDlgOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0, 20, 25, 0.45)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              width: 'min(960px, 96vw)',
              maxHeight: '92vh',
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 30px 80px rgba(0,54,65,0.28), 0 10px 26px rgba(0,54,65,0.18)',
              border: '1px solid rgba(0, 174, 157, 0.18)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
            {/* Cabeçalho sticky */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 22px',
              borderBottom: '1px solid rgba(251,140,0,0.18)',
              background: 'linear-gradient(180deg, rgba(255,248,240,1) 0%, rgba(255,255,255,0) 100%)',
              position: 'sticky', top: 0, zIndex: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(255,183,77,0.22) 0%, rgba(251,140,0,0.28) 100%)',
                  color: '#E65100',
                }}>
                  {acordoExists ? <Info size={20} strokeWidth={2.2} /> : <Scale size={20} strokeWidth={2.2} />}
                </div>
                <div>
                  <div style={{ fontSize: 16.5, fontWeight: 850, color: '#003641', lineHeight: 1.1 }}>
                    {acordoExists ? 'Dados do Acordo' : 'Novo Acordo'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,54,65,0.6)', marginTop: 2 }}>
                    {acordoExists ? 'Informações cadastradas para este processo' : 'Preencha os campos abaixo para registrar o acordo'}
                  </div>
                </div>
              </div>
              <button onClick={() => setAcordoDlgOpen(false)}
                className="interactive"
                style={{
                  width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(0,54,65,0.12)',
                  background: '#FFFFFF', cursor: 'pointer', color: '#003641',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>

            {/* Corpo rolável */}
            <div style={{
              overflowY: 'auto',
              padding: '20px 24px 16px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              {/* Linha 1: DEVEDOR + Nº PROCESSO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>DEVEDOR</label>
                  <input
                    value={acordoForm.devedor}
                    onChange={e => setAcordoForm((s:any)=>({...s, devedor: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Nome do devedor"
                    style={{ ...inputStyle, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Nº DO PROCESSO OU EXTRAJUDICIAL</label>
                  <input
                    value={acordoForm.numero_processo_ou_extrajudicial}
                    onChange={e => setAcordoForm((s:any)=>({...s, numero_processo_ou_extrajudicial: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Ex: 5006647.14.2018.8.09.0051"
                    style={{ ...inputStyle, fontFamily: 'Fira Code, JetBrains Mono, monospace', fontSize: 13, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
              </div>

              {/* Linha 2: TÍTULOS (full width) */}
              <div>
                <label style={labelStyle}>TÍTULOS OBJETO DA COBRANÇA</label>
                <textarea
                  value={acordoForm.titulos_objeto_cobranca}
                  onChange={e => setAcordoForm((s:any)=>({...s, titulos_objeto_cobranca: e.target.value}))}
                  readOnly={Boolean(acordoExists)}
                  rows={2}
                  placeholder="Ex: CCB 1234 E CCB 78455"
                  style={{ ...inputStyle, minHeight: 64, resize: 'vertical', paddingTop: 10, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                />
              </div>

              {/* Linha 3: Total parcelas / Valor parcela / Nº parcela */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>TOTAL DE PARCELAS</label>
                  <input
                    type="number"
                    min={0}
                    value={acordoForm.total_parcelas}
                    onChange={e => setAcordoForm((s:any)=>({...s, total_parcelas: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Ex: 24"
                    style={{ ...inputStyle, fontFamily: 'Fira Code, JetBrains Mono, monospace', fontSize: 13, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>VALOR DA PARCELA</label>
                  <input
                    value={acordoForm.valor_parcela}
                    onChange={e => setAcordoForm((s:any)=>({...s, valor_parcela: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Ex: 1.000,00"
                    style={{ ...inputStyle, fontFamily: 'Fira Code, JetBrains Mono, monospace', fontSize: 13, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Nº DA PARCELA</label>
                  <input
                    type="number"
                    min={0}
                    value={acordoForm.numero_parcela}
                    onChange={e => setAcordoForm((s:any)=>({...s, numero_parcela: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Ex: 1"
                    style={{ ...inputStyle, fontFamily: 'Fira Code, JetBrains Mono, monospace', fontSize: 13, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
              </div>

              {/* Linha 4: Forma pagamento + Confirmação */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>FORMA DE PAGAMENTO</label>
                  <input
                    value={acordoForm.forma_pagamento}
                    onChange={e => setAcordoForm((s:any)=>({...s, forma_pagamento: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Ex: Pix, Boleto, Desconto em folha"
                    style={{ ...inputStyle, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>CONFIRMAÇÃO DO PAGAMENTO</label>
                  <input
                    value={acordoForm.confirmacao_pagamento}
                    onChange={e => setAcordoForm((s:any)=>({...s, confirmacao_pagamento: e.target.value}))}
                    readOnly={Boolean(acordoExists)}
                    placeholder="Ex: Confirmado / Pendente / Não"
                    style={{ ...inputStyle, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                  />
                </div>
              </div>

              {/* Linha 5: Observações full */}
              <div>
                <label style={labelStyle}>OBSERVAÇÕES</label>
                <textarea
                  value={acordoForm.observacoes}
                  onChange={e => setAcordoForm((s:any)=>({...s, observacoes: e.target.value}))}
                  readOnly={Boolean(acordoExists)}
                  rows={3}
                  placeholder="Observações adicionais sobre o acordo..."
                  style={{ ...inputStyle, minHeight: 82, resize: 'vertical', paddingTop: 10, ...(acordoExists ? inputReadOnlyStyle : {}) }}
                />
              </div>
            </div>

            {/* Rodapé sticky */}
            <div style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 22px 18px',
              borderTop: '1px solid rgba(251,140,0,0.18)',
              background: 'linear-gradient(0deg, rgba(255,248,240,1) 0%, rgba(255,255,255,0) 100%)',
              position: 'sticky', bottom: 0, zIndex: 3,
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}>
              <div style={{ fontSize: 11.5, color: 'rgba(0,54,65,0.62)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Info size={13} strokeWidth={2} color="#FB8C00" style={{ flexShrink: 0 }} />
                {acordoExists
                  ? 'Este acordo já foi registrado. Edição não permitida.'
                  : 'Após salvar, o acordo ficará registrado e não poderá ser editado.'}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAcordoDlgOpen(false)}
                  className="interactive"
                  style={{
                    padding: '10px 18px', borderRadius: 12,
                    border: '1px solid rgba(0,54,65,0.16)',
                    background: '#FFFFFF', color: '#003641',
                    fontWeight: 750, fontSize: 13, cursor: 'pointer',
                    transition: 'transform 150ms ease, box-shadow 180ms ease, background 150ms ease',
                  }}>{acordoExists ? 'Fechar' : 'Cancelar'}</button>
                {!acordoExists && (
                  <button onClick={handleSalvarAcordo}
                    disabled={acordoSaving}
                    className="interactive"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 22px', borderRadius: 12,
                      background: acordoSaving
                        ? 'linear-gradient(135deg, #FFCC80 0%, #FFB74D 50%, #FB8C00 100%)'
                        : 'linear-gradient(135deg, #FFB74D 0%, #FB8C00 50%, #EF6C00 100%)',
                      color: '#FFFFFF', fontWeight: 850, fontSize: 13.2,
                      cursor: acordoSaving ? 'wait' : 'pointer',
                      opacity: acordoSaving ? 0.85 : 1,
                      boxShadow: '0 10px 26px rgba(251,140,0,0.32)',
                      border: '1px solid rgba(120, 50, 0, 0.30)',
                      letterSpacing: 0.01,
                      transition: 'transform 150ms cubic-bezier(.22,.9,.28,1.1), box-shadow 180ms ease',
                    }}>
                    <Save size={15} strokeWidth={2.2} /> {acordoSaving ? 'Salvando...' : 'Salvar Acordo'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 22, right: 22, zIndex: 500,
          width: 'min(420px, 92vw)',
          background: toast.kind === 'ok'
            ? 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF9 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%)',
          border: toast.kind === 'ok'
            ? '1px solid rgba(125, 182, 28, 0.45)'
            : '1px solid rgba(240, 82, 101, 0.45)',
          borderRadius: 14,
          padding: '14px 16px 14px 14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 6px 18px rgba(0,54,65,0.12)',
          color: '#003641',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: toast.kind === 'ok'
              ? 'linear-gradient(135deg, rgba(150,203,58,0.22) 0%, rgba(125,182,28,0.30) 100%)'
              : 'linear-gradient(135deg, rgba(255,159,171,0.26) 0%, rgba(240,82,101,0.32) 100%)',
            color: toast.kind === 'ok' ? '#6A9F16' : '#B91C1C',
            marginTop: 1,
          }}>
            {toast.kind === 'ok'
              ? <CheckCircle2 size={19} strokeWidth={2.2} />
              : <AlertTriangle size={19} strokeWidth={2.2} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.01, lineHeight: 1.15 }}>
              {toast.title}
            </div>
            {toast.msg && (
              <div style={{ fontSize: 12.5, opacity: 0.82, marginTop: 4, lineHeight: 1.4 }}>
                {toast.msg}
              </div>
            )}
          </div>
          <button
            type="button"
            className="interactive"
            onClick={() => setToast(null)}
            title="Fechar"
            style={{
              width: 26, height: 26, flexShrink: 0, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, lineHeight: 0, border: 0,
              background: 'rgba(0,54,65,0.06)', color: '#003641', cursor: 'pointer',
              opacity: 0.75,
            }}>
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
};

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(0,54,65,0.14)',
  borderRadius: 14,
  backdropFilter: 'blur(16px) saturate(160%)',
  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
  boxShadow: '0 16px 36px rgba(0, 54, 65, 0.10)',
};

const chipStyle: React.CSSProperties = {
  background: 'rgba(0, 54, 65, 0.96)',
  color: '#FFFFFF',
  borderRadius: 999,
  padding: '5px 12px',
  fontSize: 12,
  letterSpacing: 0.02,
  display: 'inline-flex', alignItems: 'center', gap: 6,
  border: '1px solid rgba(0, 174, 157, 0.45)',
};

const thStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #0A4A57 0%, #003641 100%)',
  color: '#FFFFFF', textAlign: 'left', padding: '8px 8px',
  fontSize: 12, letterSpacing: 0.06, fontWeight: 800,
  textTransform: 'uppercase',
  position: 'sticky', top: 0, zIndex: 2,
  boxSizing: 'border-box',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: '1px solid rgba(0,54,65,0.10)',
  fontSize: 13.2,
  color: '#003641',
  verticalAlign: 'middle',
  boxSizing: 'border-box',
};

const formLbl: React.CSSProperties = {
  display: 'block', fontSize: 11, textTransform: 'uppercase',
  letterSpacing: 0.08, fontWeight: 700, opacity: 0.75,
  marginBottom: 5, color: '#003641',
};

const formInp: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  borderRadius: 10, border: '1px solid rgba(0,54,65,0.18)',
  background: '#FFFFFF', color: '#003641',
  fontSize: 13.5, outline: 'none',
};
const formTxt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', minHeight: 68, resize: 'vertical',
  borderRadius: 10, border: '1px solid rgba(0,54,65,0.18)',
  background: '#FFFFFF', color: '#003641',
  fontSize: 13.5, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
};
const sectionHdr: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex', alignItems: 'center', gap: 8,
  marginTop: 8, marginBottom: -2,
  padding: '6px 10px',
  borderRadius: 10,
  background: 'linear-gradient(90deg, rgba(0, 137, 123, 0.08), rgba(251, 140, 0, 0.04))',
  border: '1px solid rgba(0,137,123,0.12)',
};
const sectionLbl: React.CSSProperties = {
  fontSize: 12, letterSpacing: 0.08, fontWeight: 800,
  textTransform: 'uppercase', color: '#003641', opacity: 0.9,
};

function naturezaBg(n?: string): string {
  const x = (n || '').toLowerCase();
  if (x === 'ativo') return 'rgba(125,182,28,0.14)';
  if (x === 'passivo') return 'rgba(0,174,157,0.14)';
  if (x === 'extinta') return 'rgba(0,54,65,0.08)';
  return 'rgba(0,54,65,0.06)';
}

function naturezaDot(n?: string): string {
  const x = (n || '').toLowerCase();
  if (x === 'ativo') return '#7DB61C';
  if (x === 'passivo') return '#00AE9D';
  if (x === 'extinta') return '#003641';
  return '#003641';
}

const emptyKpis: KpiTrend[] = [
  { label: 'Solicitações enviadas ao jurídico', value: '-', variant: 'def' },
  { label: 'Total valor Passivo', value: '-', variant: 'def' },
  { label: 'Total valor Ativo', value: '-', variant: 'def' },
  { label: 'Total valor Extinta', value: '-', variant: 'def' },
  { label: 'Processos extintos', value: '-', variant: 'def' },
  { label: 'Processos ajuizados', value: '-', variant: 'gray' },
];

const KpiCard: React.FC<{ kpi: KpiTrend; compact?: boolean }> = ({ kpi, compact }) => {
  const variant = kpi.variant || 'def';
  const variantColorMap: Record<string, { hex: string; label: string; bgPill: string; borderPill: string }> = {
    hi:   { hex: '#7DB61C', label: 'Sucesso',   bgPill: 'rgba(125,182,28,0.10)',  borderPill: 'rgba(125,182,28,0.26)' },
    al:   { hex: '#F05265', label: 'Atenção',   bgPill: 'rgba(240,82,101,0.10)',  borderPill: 'rgba(240,82,101,0.28)' },
    gold: { hex: '#00AE9D', label: 'Destaque',  bgPill: 'rgba(0,174,157,0.10)',   borderPill: 'rgba(0,174,157,0.28)' },
    navy: { hex: '#003641', label: 'Referência',bgPill: 'rgba(0,54,65,0.10)',     borderPill: 'rgba(0,54,65,0.22)' },
    def:  { hex: '#00AE9D', label: 'Padrão',    bgPill: 'rgba(0,174,157,0.10)',   borderPill: 'rgba(0,174,157,0.28)' },
    gray: { hex: '#003641', label: 'Dado',      bgPill: 'rgba(75,85,99,0.10)',    borderPill: 'rgba(75,85,99,0.28)' },
  };
  const cardBgMap: Record<string, string> = {
    hi:   'linear-gradient(135deg, rgba(150,203,58,0.10) 0%, rgba(125,182,28,0.06) 100%), #FFFFFF',
    al:   'linear-gradient(135deg, rgba(255,159,171,0.12) 0%, rgba(240,82,101,0.08) 100%), #FFFFFF',
    gold: 'linear-gradient(135deg, rgba(150,203,58,0.08) 0%, rgba(0,174,157,0.08) 100%), #FFFFFF',
    navy: 'linear-gradient(135deg, rgba(20,94,109,0.06) 0%, rgba(0,54,65,0.06) 100%), #FFFFFF',
    def:  'linear-gradient(135deg, rgba(51,197,184,0.08) 0%, rgba(0,174,157,0.06) 100%), #FFFFFF',
    gray: 'linear-gradient(135deg, rgba(156,163,175,0.10) 0%, rgba(75,85,99,0.06) 100%), #FFFFFF',
  };
  const IconFor: Record<string, React.ReactNode> = {
    hi:   <CircleDollarSign size={12} strokeWidth={2.25} color={variantColorMap[variant].hex} />,
    al:   <ShieldAlert size={12} strokeWidth={2.25} color={variantColorMap[variant].hex} />,
    gold: <CircleDollarSign size={12} strokeWidth={2.25} color={variantColorMap[variant].hex} />,
    navy: <Database size={12} strokeWidth={2.25} color={variantColorMap[variant].hex} />,
    def:  <Database size={12} strokeWidth={2.25} color={variantColorMap[variant].hex} />,
    gray: <Layers size={12} strokeWidth={2.25} color={variantColorMap[variant].hex} />,
  };
  const decoSize = compact ? 44 : 60;
  const BigDecoFor: Record<string, React.ReactNode> = {
    hi:   <CircleDollarSign size={decoSize} color={variantColorMap[variant].hex} />,
    al:   <ShieldAlert size={decoSize} color={variantColorMap[variant].hex} />,
    gold: <CircleDollarSign size={decoSize} color={variantColorMap[variant].hex} />,
    navy: <Database size={decoSize} color={variantColorMap[variant].hex} />,
    def:  <Database size={decoSize} color={variantColorMap[variant].hex} />,
    gray: <Layers size={decoSize} color={variantColorMap[variant].hex} />,
  };
  const deco = BigDecoFor[variant];
  const vv = variantColorMap[variant];
  const hasDelta = typeof kpi.deltaPct === 'number';
  // Rodapé (trend pill) no MESMO estilo do ícone pill do topo dos cards Executivo
  let trendPill: {
    icon: React.ReactNode; bg: string; border: string; text: string; color: string;
  } | null = null;
  if (hasDelta) {
    const delta = kpi.deltaPct as number;
    if (delta > 0.5) {
      trendPill = {
        icon: <TrendingUp size={12} strokeWidth={2.25} color="#7DB61C" />,
        bg: 'rgba(125,182,28,0.10)',
        border: 'rgba(125,182,28,0.26)',
        color: '#6A9F16',
        text: `▲ ${delta.toFixed(1)}%`,
      };
    } else if (delta < -0.5) {
      trendPill = {
        icon: <TrendingDown size={12} strokeWidth={2.25} color="#F05265" />,
        bg: 'rgba(240,82,101,0.10)',
        border: 'rgba(240,82,101,0.28)',
        color: '#E11D48',
        text: `▼ ${Math.abs(delta).toFixed(1)}%`,
      };
    } else {
      trendPill = {
        icon: <Minus size={12} strokeWidth={2.25} color="#003641" />,
        bg: 'rgba(0,54,65,0.10)',
        border: 'rgba(0,54,65,0.22)',
        color: '#003641',
        text: `— ${delta.toFixed(1)}%`,
      };
    }
  }
  return (
    <div className="interactive" style={{
      ...card,
      // === ALTURA IGUAL para compact e normal (só HORIZONTAL mais estreito no compact ===
      padding: compact ? '13px 8px 14px' : '13px 11px 14px',
      position: 'relative',
      overflow: 'hidden',
      background: cardBgMap[variant] || card.background,
      minHeight: 120,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Decoração opaca canto (padrão Executivo) */}
      <div style={{ position: 'absolute', right: -14, top: -14, opacity: 0.14, pointerEvents: 'none' }}>{deco}</div>
      {/* Linha 1 (FIXA): ícone container + label UPPERCASE na MESMA LINHA (padrão Executivo) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 8, flex: '0 0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: vv.bgPill, border: `1px solid ${vv.borderPill}`, color: vv.hex, flexShrink: 0 }}>
          {IconFor[variant]}
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1.2, textTransform: 'uppercase', flex: '1 1 auto', overflow: 'hidden' }}>{kpi.label}</div>
      </div>
      {/* Linha 2 (FLEXÍVEL, valor centralizado — baseline alinhada com demais cards): */}
      <div style={{
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'center',
        marginTop: 6,
        fontSize: 18,
        fontWeight: 950,
        color: '#003641',
        letterSpacing: -0.8,
        lineHeight: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}>
        {kpi.value}
      </div>
      {/* Linha 3 (rodapé FIXO NO FIM do card, margin-top auto para alinhar chip sempre no bottom IGUAL para todos): */}
      {trendPill ? (
        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 9px',
            borderRadius: 8,
            background: trendPill.bg,
            border: `1px solid ${trendPill.border}`,
            color: trendPill.color,
            fontSize: 11.5,
            fontWeight: 750,
            letterSpacing: 0.02,
            lineHeight: 1,
          }}>
            {trendPill.icon}
            <span>{trendPill.text}</span>
          </span>
        </div>
      ) : (
        <div style={{ flex: '0 0 auto', height: 20 }} />
      )}
    </div>
  );
};

const SidebarItem: React.FC<{
  icon: React.ReactNode; label: string; active?: boolean;
  small?: boolean; locked?: boolean;
  onClick?: () => void;
  chevron?: boolean;
  onChevron?: (e: React.MouseEvent) => void;
}> = ({ icon, label, active, small, locked, onClick, chevron, onChevron }) => {
  return (
    <button type="button" className="interactive"
      onClick={onClick}
      disabled={locked}
      title={locked ? 'Bloqueado — apenas administradores.' : label}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
        padding: small ? '7px 10px' : '9px 10px',
        borderRadius: 10, border: 0, cursor: locked ? 'not-allowed' : 'pointer',
        background: active ? 'linear-gradient(135deg, rgba(125,182,28,0.30) 0%, rgba(0,174,157,0.22) 100%)'
                           : 'rgba(255,255,255,0.04)',
        color: locked ? 'rgba(255,255,255,0.45)' : '#FFFFFF',
        opacity: locked ? 0.75 : 1,
        fontSize: small ? 12.5 : 13.5, fontWeight: active ? 750 : 600,
        marginBottom: 3,
      }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: active ? '#FFFFFF' : (locked ? 'rgba(255,255,255,0.45)' : '#FFFFFF'),
        opacity: locked ? 0.7 : 0.92,
      }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {(chevron !== undefined) && (
        <span onClick={(e) => {
          e.stopPropagation();
          onChevron?.(e);
        }}
          style={{ display: 'inline-flex', cursor: locked ? 'not-allowed' : 'pointer',
            padding: 2, borderRadius: 5 }}>
          <ChevronDown size={13} strokeWidth={2.1} color="#FFFFFF"
            style={{ transform: chevron ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease-out', opacity: 0.9 }} />
        </span>
      )}
    </button>
  );
};

const ConfiguracoesHeader: React.FC<{ title: string; onBack: () => void; onHome: () => void }> = ({ title, onBack }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
    marginBottom: 10, padding: '12px 14px',
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(0,54,65,0.14)',
    borderRadius: 14,
  }}>
    <div style={{
      fontSize: 13, letterSpacing: 0.08, textTransform: 'uppercase',
      fontWeight: 800, color: '#003641',
    }}>{title}</div>
    <button onClick={onBack} className="interactive"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 10,
        border: '1px solid rgba(0,54,65,0.18)',
        background: '#FFFFFF', color: '#003641',
        fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
      }}>Voltar para o Dashboard</button>
  </div>
);

const Sec: React.FC<{ title: string; onClose?: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div style={{ ...card, padding: 14, marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10, gap: 10 }}>
      <div style={{ fontSize: 13, letterSpacing: 0.08, textTransform: 'uppercase',
        fontWeight: 800, color: '#003641' }}>{title}</div>
      {onClose && <button onClick={onClose}
        style={{
          width: 28, height: 28, borderRadius: 8,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 0, border: 0,
          background: 'rgba(0,54,65,0.06)', color: '#003641', cursor: 'pointer',
        }}><X size={15} strokeWidth={2.1} /></button>}
    </div>
    {children}
  </div>
);

/* =======================================================================
 * COMPONENTE: JuridicoExecDashboard
 * Visão GERENCIAL EXECUTIVA do módulo Jurídico.
 *  - KPIs (fileira superior, 6 grandes)
 *  - CARD "Saúde da Base" (gauge gigante + 12 campos-chave score %)
 *  - CARD "Lacunas e Atrasos" (2 regras prazo + 8 maiores faltas)
 *  - 4 GRÁFICOS SVG inline (Natureza, Origens, Status, Matriz Risco)
 * ======================================================================= */

type ExecFmtFn = (n: number, d?: number) => string;

const JuridicoExecDashboard: React.FC<{
  rows: any[];
  loading: boolean;
  stats: any;
  fmtBr: ExecFmtFn;
  fmtInt: (n: number) => string;
  fmtMoney: (n: number) => string;
  onBack: () => void;
}> = ({ rows: _rows, loading, stats, fmtBr, fmtInt, fmtMoney, onBack }) => {
  void _rows;
  const S = stats;
  const cardShell = {
    background: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid rgba(0,54,65,0.10)',
    boxShadow: '0 10px 26px rgba(0,54,65,0.07), 0 1px 0 rgba(255,255,255,0.65) inset',
  } as React.CSSProperties;
  const sectionTitle = (title: string, sub: string, icon: React.ReactNode, accent: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}1A`,
        border: `1px solid ${accent}55`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 850, letterSpacing: 0.01, color: '#003641', lineHeight: 1.15 }}>{title}</div>
        {sub ? <div style={{ fontSize: 11.5, color: 'rgba(0,54,65,0.58)', marginTop: 3, lineHeight: 1.3 }}>{sub}</div> : null}
      </div>
    </div>
  );

  return (
    <div style={{ minWidth: 0 }}>
      {/* ================= HEADER EXECUTIVO ================= */}
      <div style={{
        padding: '9px 14px',
        borderRadius: 16,
        marginBottom: 14,
        border: '1px solid rgba(0,54,65,0.10)',
        background: 'linear-gradient(135deg, rgba(251,140,0,0.10) 0%, rgba(214,67,64,0.07) 40%, rgba(0,174,157,0.08) 100%), radial-gradient(1000px 220px at 95% -20%, rgba(0,174,157,0.14), transparent 55%), #FFFFFF',
        boxShadow: '0 10px 28px rgba(251,140,0,0.10), 0 6px 18px rgba(0,54,65,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <button type="button" onClick={onBack} title="Voltar p/ Visão Operacional" className="interactive" style={{
            width: 32, height: 32, borderRadius: 10,
            border: '1px solid rgba(0,54,65,0.12)',
            background: '#FFFFFF',
            color: '#003641',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,54,65,0.05)',
          }}><Gavel size={16} color="#003641" strokeWidth={2.1} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 900, letterSpacing: 0.005, color: '#003641',
              lineHeight: 1.1,
            }}>
              Painel Executivo · Módulo Jurídico
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(150px,1fr)', gap: 8, alignItems: 'stretch' }}>
        <div style={{
          padding: '6px 11px', borderRadius: 12,
          background: S.scoreBandBg,
          border: `1px solid ${S.scoreBandColor}55`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.10em', color: S.scoreBandColor, textTransform: 'uppercase', marginBottom: 2 }}>Saúde da Base</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: S.scoreBandColor, lineHeight: 1, letterSpacing: -0.5 }}>{S.scorePct.toFixed(0)}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: S.scoreBandColor, opacity: 0.8 }}>/100 · {S.scoreBandLabel}</span>
          </div>
        </div>
      </div>
      </div>

      {loading ? (
        <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: 'rgba(0,54,65,0.5)' }}>Carregando o dashboard executivo…</div>
      ) : null}

      {/* ================= FILEIRA 1: 6 KPIs GRANDES ================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}>
        {/* KPI 1: Total Registros */}
        <div style={{ ...cardShell, padding: '13px 13px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -18, top: -14, opacity: 0.14 }}><Layers size={70} color="#00AE9D" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: 'rgba(0,174,157,0.10)', border: '1px solid rgba(0,174,157,0.22)', color: '#0F766E' }}>
              <Database size={12} strokeWidth={2.25} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1 }}>REGISTROS</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 950, color: '#003641', marginTop: 8, letterSpacing: -0.5, lineHeight: 1 }}>{fmtInt(S.total)}</div>
        </div>

        {/* KPI 2: Valor Total Bruto */}
        <div style={{ ...cardShell, padding: '13px 13px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -20, top: -16, opacity: 0.14 }}><CircleDollarSign size={72} color="#7DB61C" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: 'rgba(125,182,28,0.12)', border: '1px solid rgba(125,182,28,0.26)', color: '#365314' }}>
              <CircleDollarSign size={12} strokeWidth={2.25} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1 }}>VALOR CAUSAS</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 950, color: '#003641', marginTop: 8, letterSpacing: -0.4, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{fmtBr(S.valorTotal, 1)}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', marginTop: 4, fontWeight: 700 }}>{fmtMoney(S.valorTotal)}</div>
        </div>

        {/* KPI 3: Ticket Médio */}
        <div style={{ ...cardShell, padding: '13px 13px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -18, top: -14, opacity: 0.13 }}><Target size={70} color="#00AE9D" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: 'rgba(0,174,157,0.10)', border: '1px solid rgba(0,174,157,0.22)', color: '#0F766E' }}>
              <Target size={12} strokeWidth={2.25} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1 }}>TICKET MÉDIO</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 950, color: '#003641', marginTop: 8, letterSpacing: -0.5, lineHeight: 1 }}>{fmtBr(S.ticketMedio, 1)}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', marginTop: 4, fontWeight: 700 }}>{fmtMoney(S.ticketMedio)}</div>
        </div>

        {/* KPI 4: Esperança de Ganho (Prob x Valor) */}
        <div style={{ ...cardShell, padding: '13px 13px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -18, top: -14, opacity: 0.13 }}><TrendingUp size={70} color="#7DB61C" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: 'rgba(125,182,28,0.12)', border: '1px solid rgba(125,182,28,0.26)', color: '#365314' }}>
              <TrendingUp size={12} strokeWidth={2.25} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1 }}>ESPERANÇA GANHO</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 950, color: '#166534', marginTop: 8, letterSpacing: -0.4, lineHeight: 1.1 }}>{S.cntEsp ? fmtBr(S.espGanho, 1) : '—'}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', marginTop: 4, fontWeight: 700 }}>
            Prob. média <span style={{ color: '#166534', fontWeight: 850 }}>{(S.probGanhoAvg*100).toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 5: Esperança de Perda */}
        <div style={{ ...cardShell, padding: '13px 13px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -18, top: -14, opacity: 0.13 }}><TrendingDown size={70} color="#F97316" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.26)', color: '#9A3412' }}>
              <TrendingDown size={12} strokeWidth={2.25} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1 }}>RISCO ESTIMADO</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 950, color: '#C2410C', marginTop: 8, letterSpacing: -0.4, lineHeight: 1.1 }}>
            {S.cntEsp ? fmtBr(S.espPerda, 1) : fmtBr(S.perdaEstimadaTotal, 1)}
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', marginTop: 4, fontWeight: 700 }}>
            Prob. média <span style={{ color: '#C2410C', fontWeight: 850 }}>{(S.probPerdaAvg*100).toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 6: Honorários + Custas (Total gestão) */}
        <div style={{ ...cardShell, padding: '13px 13px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -18, top: -14, opacity: 0.13 }}><Scale size={70} color="#003641" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 8, background: 'rgba(0,54,65,0.08)', border: '1px solid rgba(0,54,65,0.18)', color: '#003641' }}>
              <Scale size={12} strokeWidth={2.25} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,54,65,0.68)', letterSpacing: 0.02, lineHeight: 1 }}>HONORÁRIOS & CUSTAS</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 950, color: '#003641', marginTop: 8, letterSpacing: -0.4, lineHeight: 1.1 }}>{fmtBr(S.totalCustasHonorarios + S.totalCustasProcExtraj, 1)}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', marginTop: 4, fontWeight: 700 }}>
            Realizados <span style={{ color: '#003641', fontWeight: 850 }}>{fmtMoney(S.totalHonorariosRealizados)}</span>
          </div>
        </div>
      </div>

      {/* ================= FILEIRA 2: SAÚDE DA BASE + LACUNAS/ATRASOS + CARTEIRA ================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr 1fr',
        gap: 12,
        marginBottom: 14,
      }}>
        {/* ============ CARD 2.1: SAÚDE DA BASE (gauge + 12 campos) ============ */}
        <div style={{ ...cardShell, padding: 16, position: 'relative', overflow: 'hidden' }}>
          {sectionTitle('Saúde da Base de Processos', 'Índice ponderado de completude cadastral · 12 campos-chave', <Activity size={18} strokeWidth={2.2}/>, S.scoreBandColor)}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {/* GAUGE ECharts OFICIAL (echarts-for-react) — type: gauge semicircular 180°, progress fill até % */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              {/* Wrapper com largura útil (alvo), as labels 0 · 100 ficarão COLOCADAS exatamente nas laterais deste wrapper */}
              <div style={{ position: 'relative', width: '72%', maxWidth: 540, height: 180 }}>
                {/* Badge MEDIANO (sobreposto, ACIMA do gauge) */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 9px', borderRadius: 999,
                    background: S.scoreBandBg,
                    border: `1px solid ${S.scoreBandColor}55`,
                  }}>
                    {S.scorePct >= 70 ? <ShieldCheck size={12} color={S.scoreBandColor} strokeWidth={2.3}/> :
                     S.scorePct >= 45 ? <AlertTriangle size={12} color={S.scoreBandColor} strokeWidth={2.3}/> :
                     <ShieldAlert size={12} color={S.scoreBandColor} strokeWidth={2.3}/>}
                    <span style={{ fontSize: 10, fontWeight: 900, color: S.scoreBandColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{S.scoreBandLabel}</span>
                  </div>
                </div>

                {/* Chart gauge: usamos TODO o width do wrapper (0 a 100%), height 134px (top 24 a bottom 158).
                    O ECharts gauge center Y=100% coloca as extremidades 180° / 0° EXATAMENTE na borda inferior.
                    Radius = 100% (width do box) faz arco tocar bordas left/right do box (x=0 ↔ label 0, x=width ↔ label 100). */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: 24, height: 134 }}>
                  <ReactECharts
                    option={{
                      series: [{
                        type: 'gauge',
                        startAngle: 180,
                        endAngle: 0,
                        min: 0,
                        max: 100,
                        // Raio com base na MENOR dimensão (menor entre width/2 e height).
                        // Para o diâmetro = width total do box (arco toque left/right exato):
                        // height = 134. width / 2 = 270 (no max 540). menor dim = height 134.
                        // radius 200% = 268 (maior que width/2). Então raio efetivo = width/2 (270).
                        // Diâmetro = 540 = width do box => extremidades tocam exatamente bordas 0 e 100%!
                        radius: '200%',
                        center: ['50%', '100%'],
                        progress: {
                          show: true,
                          width: 18,
                          roundCap: true,
                          itemStyle: {
                            color: {
                              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                              colorStops: [
                                { offset: 0,    color: '#D64340' },
                                { offset: 0.33, color: '#FB8C00' },
                                { offset: 0.66, color: '#00AE9D' },
                                { offset: 1,    color: '#7DB61C' },
                              ],
                            },
                          },
                        },
                        axisLine: {
                          roundCap: true,
                          lineStyle: {
                            width: 18,
                            color: [[1, 'rgba(0,54,65,0.10)']],
                          },
                        },
                        pointer: { show: false },
                        anchor: { show: false },
                        splitLine: { show: false },
                        axisTick: { show: false },
                        axisLabel: { show: false },
                        title: { show: false },
                        detail: {
                          valueAnimation: true,
                          offsetCenter: [0, '-44%'],
                          fontSize: 48,
                          fontWeight: 900,
                          color: S.scoreBandColor,
                          formatter: (v: number) => `${Math.round(v)}%`,
                        },
                        data: [{ value: S.scorePct }],
                      }],
                      animation: false,
                    }}
                    style={{ width: '100%', height: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                </div>

                {/* Labels EIXO 0 · 50 · 100 — ALINHADAS EXATAMENTE nas extremidades do arco (bottom = 24+134 = 158 do wrapper).
                    O centro do stroke de 18px do semicírculo cai em y = 158 (altura inferior). Portanto as labels posicionadas em bottom: 22 ficam ABAIXO do arco,
                    e left=0 / right=0 / X center = ficam EXATAMENTE sob os pontos inicial e final do eixo. */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 22,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(0,54,65,0.50)', lineHeight: 1 }}>0</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(0,54,65,0.50)', lineHeight: 1 }}>50</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(0,54,65,0.50)', lineHeight: 1 }}>100</div>
                </div>

                {/* Índice de Completude (ABAIXO do eixo 0-50-100, acima das mini-barras) */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(0,54,65,0.55)', fontWeight: 700 }}>
                    Índice de Completude
                  </div>
                </div>
              </div>
            </div>

            {/* 12 mini-barras de completude (2 colunas) — ABAIXO do gráfico */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {S.healthPerField.map((f: any) => {
                const p = Math.round(f.pct*100);
                let color = '#7DB61C';
                if (p < 30) color = '#D64340'; else if (p < 55) color = '#F97316'; else if (p < 80) color = '#FB8C00'; else if (p < 92) color = '#00AE9D';
                return (
                  <div key={f.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 11.2, fontWeight: 800, color: 'rgba(0,54,65,0.80)', lineHeight: 1.15, maxWidth: '75%' }}>{f.label}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 950, color, fontFamily: 'Fira Code, ui-monospace, SFMono-Regular, Menlo, monospace' }}>{p}%</span>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(0,54,65,0.48)' }}>{f.missing > 0 ? `-${fmtInt(f.missing)}` : '✓'}</span>
                      </div>
                    </div>
                    <div style={{
                      width: '100%', height: 6, borderRadius: 999,
                      background: 'rgba(0,54,65,0.08)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${p}%`, height: '100%',
                        background: `linear-gradient(90deg, ${color}CC, ${color})`,
                        borderRadius: 999,
                        boxShadow: `0 0 0 1px ${color}22 inset`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============ CARD 2.2: PRAZOS e ATRASOS (2 regras) ============ */}
        <div style={{ ...cardShell, padding: 16 }}>
          {sectionTitle('Prazos & Atrasos Regulamentares', 'Conforme Regras de Prazos definidas em Configurações • Automação', <Clock4 size={18} strokeWidth={2.2}/>, '#FB8C00')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              {
                key: 'ext',
                icon: <Hourglass size={16} strokeWidth={2.2}/>,
                titulo: 'Protocolo Extrajudicial',
                desc: `Prazo ${S.prazos.protocoloExtrajudicial.prazoDias} dias corridos após data_evento`,
                total: S.prazos.protocoloExtrajudicial.total,
                emDia: S.prazos.protocoloExtrajudicial.total - S.prazos.protocoloExtrajudicial.atrasadosAindaSem,
                atrasados: S.prazos.protocoloExtrajudicial.atrasadosAindaSem,
                semCampo1: S.prazos.protocoloExtrajudicial.semProtocolo, labelCampo1: 'Sem nº protocolo',
                semCampo2: S.prazos.protocoloExtrajudicial.semDataLimite, labelCampo2: 'Sem data limite',
                diasMedio: S.prazos.protocoloExtrajudicial.diasMedioSem,
              },
              {
                key: 'aju',
                icon: <Gavel size={16} strokeWidth={2.2}/>,
                titulo: 'Processo de Ajuizamento',
                desc: `Prazo ${S.prazos.ajuizamento.prazoDias} dias corridos após data_evento`,
                total: S.prazos.ajuizamento.total,
                emDia: S.prazos.ajuizamento.total - S.prazos.ajuizamento.atrasadosAindaSem,
                atrasados: S.prazos.ajuizamento.atrasadosAindaSem,
                semCampo1: S.prazos.ajuizamento.semProcesso, labelCampo1: 'Sem nº processo',
                semCampo2: S.prazos.ajuizamento.semDistribuicao, labelCampo2: 'Sem data distribuição',
                diasMedio: S.prazos.ajuizamento.diasMedioSem,
              },
            ].map((p) => {
              const pctAtraso = p.total ? Math.min(100, (p.atrasados/p.total)*100) : 0;
              let cor = '#7DB61C';
              if (pctAtraso > 0 || p.semCampo1 + p.semCampo2 > p.total*0.10) cor = pctAtraso > 4 || p.semCampo1 + p.semCampo2 > p.total*0.25 ? '#D64340' : '#FB8C00';
              return (
                <div key={p.key} style={{
                  border: `1px solid ${cor}33`,
                  borderRadius: 13,
                  padding: '12px 12px 13px',
                  background: `linear-gradient(180deg, ${cor}0F 0%, #FFFFFF 100%)`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <div style={{
                      padding: 7, borderRadius: 10,
                      background: '#FFFFFF',
                      border: `1px solid ${cor}55`,
                      color: cor,
                      boxShadow: `0 0 0 4px ${cor}11`,
                    }}>{p.icon}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#003641' }}>{p.titulo}</div>
                      <div style={{ fontSize: 11, color: 'rgba(0,54,65,0.58)', marginTop: 2 }}>{p.desc}</div>
                    </div>
                    {p.atrasados === 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: 'rgba(125,182,28,0.12)', border: '1px solid rgba(125,182,28,0.28)', color: '#166534', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                        <BadgeCheck size={12} strokeWidth={2.5}/> Em dia
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: 'rgba(214,67,64,0.12)', border: '1px solid rgba(214,67,64,0.28)', color: '#991B1B', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                        <BadgeAlert size={12} strokeWidth={2.5}/> Atenção
                      </span>
                    )}
                  </div>
                  {/* % barra */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `1fr ${p.total - p.emDia - p.atrasados > 0 ? 'minmax(0, 3fr)' : ''} ${p.atrasados ? 'minmax(0, 1fr)' : ''}`, gap: 2 }}>
                      <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg, rgba(125,182,28,0.85), #7DB61C)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }} title={`Em dia ${p.emDia}/${p.total}`}/>
                      {p.total - p.emDia - p.atrasados > 0 ? (
                        <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg, rgba(251,140,0,0.85), #FB8C00)' }} title={`Dentro do prazo mas sem ${p.labelCampo1}`}/>
                      ) : null}
                      {p.atrasados > 0 ? (
                        <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg, rgba(214,67,64,0.85), #D64340)' }} title={`Atrasados ${p.atrasados}`}/>
                      ) : null}
                    </div>
                    <div style={{ fontFamily: 'Fira Code, ui-monospace, monospace', fontSize: 12, fontWeight: 950, color: cor, whiteSpace: 'nowrap' }}>
                      {pctAtraso.toFixed(0)}% atraso
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 10 }}>
                    <div style={{
                      padding: '7px 8px 8px', borderRadius: 10,
                      background: '#FFFFFF', border: '1px solid rgba(0,54,65,0.08)',
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.10em', color: 'rgba(0,54,65,0.50)', textTransform: 'uppercase', marginBottom: 3 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: 950, color: '#003641', lineHeight: 1.05 }}>{fmtInt(p.total)}</div>
                    </div>
                    <div style={{
                      padding: '7px 8px 8px', borderRadius: 10,
                      background: '#FFFFFF', border: '1px solid rgba(251,140,0,0.22)',
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.10em', color: '#C2410C', textTransform: 'uppercase', marginBottom: 3 }}>{p.labelCampo1}</div>
                      <div style={{ fontSize: 16, fontWeight: 950, color: '#C2410C', lineHeight: 1.05 }}>{fmtInt(p.semCampo1)}</div>
                    </div>
                    <div style={{
                      padding: '7px 8px 8px', borderRadius: 10,
                      background: '#FFFFFF', border: `1px solid ${cor}33`,
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.10em', color: cor, textTransform: 'uppercase', marginBottom: 3 }}>Dias médio aberto</div>
                      <div style={{ fontSize: 16, fontWeight: 950, color: cor, lineHeight: 1.05 }}>{p.diasMedio}d</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ CARD 2.3: LACUNAS (maiores faltas rankeadas) ============ */}
        <div style={{ ...cardShell, padding: 16 }}>
          {sectionTitle('Maiores Lacunas de Cadastro', 'Rankeado por impacto (peso do campo × quantidade de faltas)', <FileSearch size={18} strokeWidth={2.2}/>, '#D64340')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {S.gapsRanked.map((g: any, idx: number) => {
              const faltaPct = (1 - g.pct) * 100;
              const impacto = g.weight * faltaPct; // usado para ranking
              const maxImpacto = 3 * 100; // peso máximo 3 * 100% falta
              const impactBars = Math.min(100, Math.round((impacto/maxImpacto)*100));
              let cor = '#7DB61C';
              if (faltaPct > 40) cor = '#D64340'; else if (faltaPct > 22) cor = '#F97316'; else if (faltaPct > 10) cor = '#FB8C00'; else if (faltaPct > 3) cor = '#00AE9D';
              return (
                <div key={g.key} style={{
                  padding: '9px 10px 10px', borderRadius: 11,
                  background: `linear-gradient(180deg, ${cor}0A 0%, #FFFFFF 100%)`,
                  border: `1px solid ${cor}22`,
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto',
                  gap: 9,
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 9,
                    background: '#FFFFFF', border: `1px solid ${cor}33`,
                    color: cor,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 950,
                    boxShadow: `inset 0 0 0 1px ${cor}11, 0 3px 8px ${cor}11`,
                  }}>{idx+1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 900, color: '#003641' }}>{g.label}</div>
                      <span style={{ fontSize: 9.5, fontWeight: 900, color: 'rgba(0,54,65,0.48)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>w={g.weight.toFixed(1)}</span>
                    </div>
                    <div style={{
                      width: '100%', height: 6, borderRadius: 999,
                      background: 'rgba(0,54,65,0.08)', marginTop: 7, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${impactBars}%`, height: '100%',
                        background: `linear-gradient(90deg, ${cor}99, ${cor})`,
                        borderRadius: 999,
                      }}/>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                      <AlertOctagon size={12} color={cor} strokeWidth={2.3}/>
                      <span style={{ fontSize: 14, fontWeight: 950, color: cor, fontFamily: 'Fira Code, ui-monospace, monospace' }}>
                        {faltaPct.toFixed(faltaPct >= 10 ? 0 : 1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', marginTop: 3, fontWeight: 700 }}>
                      {fmtInt(g.missing)} registros · {fmtInt(g.filled)} ok
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= FILEIRA 3: 4 GRÁFICOS SVG ================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1.1fr 1.05fr',
        gap: 12,
      }}>
        {/* ==== GRÁFICO 3.1: DONUT NATUREZA (Ativo/Passivo/Sem/Extraj.) ==== */}
        <div style={{ ...cardShell, padding: 16 }}>
          {sectionTitle('Carteira por Natureza', 'Volume e valor por classificação estratégica', <PieChart size={17} strokeWidth={2.2}/>, '#00AE9D')}
          {(() => {
            const palette: Record<string,string> = { 'Ativo':'#7DB61C','Passivo':'#003641','Sem Natureza':'#FB8C00','Extrajudicial':'#64D8CE' };
            const items = Object.entries(S.aggNatureza as Record<string,{n:number,v:number}>)
              .map(([k,v]) => ({k, n: v.n, v: v.v, color: palette[k] ?? '#94A3B8'}));
            const totalN = items.reduce((s,x)=>s+x.n, 0) || 1;
            const cx=105, cy=105, rOuter=78, rInner=46;
            const donutPaths: string[] = [];
            let acc = -Math.PI/2; // começa topo
            for (const it of items) {
              const frac = it.n/totalN;
              const start = acc, end = acc + frac * 2*Math.PI;
              acc = end;
              if (frac >= 0.999) {
                donutPaths.push(
                  `<circle cx='${cx}' cy='${cy}' r='${rOuter}' fill='none' stroke='${it.color}' stroke-width='${rOuter-rInner}'/>`
                );
                continue;
              }
              const x1o = cx + rOuter*Math.cos(start), y1o = cy + rOuter*Math.sin(start);
              const x2o = cx + rOuter*Math.cos(end),   y2o = cy + rOuter*Math.sin(end);
              const x1i = cx + rInner*Math.cos(end),   y1i = cy + rInner*Math.sin(end);
              const x2i = cx + rInner*Math.cos(start), y2i = cy + rInner*Math.sin(start);
              const large = frac > 0.5 ? 1 : 0;
              donutPaths.push(
                `<path d='M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${large} 0 ${x2i} ${y2i} Z' fill='${it.color}' stroke='#FFFFFF' stroke-width='1.2'/>`
              );
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <svg viewBox="0 0 210 210" width="100%" height="100%" dangerouslySetInnerHTML={{ __html: donutPaths.join('') }}/>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 9.5, color: 'rgba(0,54,65,0.55)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Total</div>
                    <div style={{ fontSize: 26, fontWeight: 950, color: '#003641', lineHeight: 1.1, letterSpacing: -0.5 }}>{fmtInt(totalN)}</div>
                    <div style={{ fontSize: 10.5, color: 'rgba(0,54,65,0.55)', fontWeight: 800 }}>processos</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {items.map(it => {
                    const pct = (it.n/totalN)*100;
                    return (
                      <div key={it.k} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, display: 'inline-block' }}/>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 850, color: '#003641' }}>{it.k}</div>
                          <div style={{ width: '100%', height: 4, background: 'rgba(0,54,65,0.07)', borderRadius: 999, marginTop: 4 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: it.color, borderRadius: 999 }}/>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 950, color: '#003641', fontFamily: 'Fira Code, ui-monospace, monospace' }}>{fmtInt(it.n)} · {pct.toFixed(0)}%</div>
                          <div style={{ fontSize: 10, color: 'rgba(0,54,65,0.55)', fontWeight: 800 }}>{fmtBr(it.v,1)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ==== GRÁFICO 3.2: BARRAS ORIGENS (count + valor empilhado?) NÃO: barras horizontais DUPLAS (n | valor) ==== */}
        <div style={{ ...cardShell, padding: 16 }}>
          {sectionTitle('Distribuição por Origem', 'Volume processual e valor por origem do caso', <Layers size={17} strokeWidth={2.2}/>, '#7DB61C')}
          {(() => {
            const items = Object.entries(S.aggOrigem as Record<string,{n:number,v:number}>)
              .sort((a,b)=> b[1].n - a[1].n)
              .slice(0, 8)
              .map(([k,v]) => ({ k, n: v.n, v: v.v }));
            const maxN = Math.max(1, ...items.map(i=>i.n));
            const maxV = Math.max(1, ...items.map(i=>i.v));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8.5 }}>
                {items.map((it, idx) => {
                  const pctN = (it.n/maxN)*100;
                  const pctV = (it.v/maxV)*100;
                  return (
                    <div key={it.k}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 900, color: '#003641',
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                        }}>
                          <span style={{
                            fontFamily: 'Fira Code, monospace', fontSize: 10, fontWeight: 900,
                            padding: '1px 6px', borderRadius: 6,
                            color: '#00AE9D',
                            background: 'rgba(0,174,157,0.08)',
                            border: '1px solid rgba(0,174,157,0.18)',
                          }}>#{idx+1}</span>
                          <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 260,
                          }}>{it.k}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 900, fontFamily: 'Fira Code, monospace', color: 'rgba(0,54,65,0.55)' }}>
                          {fmtInt(it.n)} reg · {fmtBr(it.v, 1)}
                        </div>
                      </div>
                      {/* BARRA DUPLO-CAMADA: traseira = valor, frente = qtd */}
                      <div style={{ position: 'relative', width: '100%', height: 14 }}>
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(90deg, rgba(0,174,157,0.16), rgba(100,216,206,0.18))',
                          width: `${pctV}%`, borderRadius: 6,
                        }}/>
                        <div style={{
                          position: 'absolute', left: 0, top: 3,
                          height: 8, width: `${pctN}%`,
                          background: 'linear-gradient(90deg, rgba(0,54,65,0.85), #00AE9D 72%, #7DB61C)',
                          borderRadius: 999,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 6px rgba(0,174,157,0.22)',
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ==== GRÁFICO 3.3: STATUS (top 10 stacked horizontais) ==== */}
        <div style={{ ...cardShell, padding: 16 }}>
          {sectionTitle('Top 10 Situações Processuais', 'Status mais frequentes no momento', <BadgeCheck size={17} strokeWidth={2.2}/>, '#003641')}
          {(() => {
            const items = [
              ...S.statusTop.map(([k,v]: [string, any]) => ({ k, n: v.n, v: v.v })),
              ...(S.statusOutrosN > 0 ? [{ k: 'Outros (' + fmtInt(S.statusOutrosN) + ')', n: S.statusOutrosN, v: S.statusOutrosV }] : []),
            ];
            const maxN = Math.max(1, ...items.map(i=>i.n));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((it, idx) => {
                  const pct = (it.n/maxN)*100;
                  const pal = idx === 0 ? '#003641' : idx === 1 ? '#00AE9D' : idx === 2 ? '#7DB61C' : idx === 3 ? '#FB8C00' : idx === 4 ? '#D64340' : idx < 7 ? '#64D8CE' : '#A3A3A3';
                  return (
                    <div key={it.k+idx}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{
                          fontSize: 11.5, fontWeight: 900, color: '#003641',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 280, marginRight: 8,
                        }}>{it.k}</div>
                        <div style={{ fontSize: 11, fontWeight: 950, color: pal, fontFamily: 'Fira Code, ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                          {fmtInt(it.n)} · {fmtBr(it.v, 1)}
                        </div>
                      </div>
                      <div style={{
                        width: '100%', height: 8, borderRadius: 999,
                        background: 'rgba(0,54,65,0.06)', overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 999,
                          background: `linear-gradient(90deg, ${pal}99, ${pal})`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35)`,
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ==== GRÁFICO 3.4: MATRIZ RISCO 2x2 (Probabilidade x Impacto/Valor) ==== */}
        <div style={{ ...cardShell, padding: 16 }}>
          {sectionTitle('Matriz Risco · Probabilidade × Valor', 'Quadrantes por processo com dados de risco', <Target size={17} strokeWidth={2.2}/>, '#F97316')}
          {(() => {
            const { baixaProb_bxValor: A, altaProb_bxValor: B, baixaProb_axValor: C, altaProb_axValor: D } = S.q4d as any;
            const totalQ = S.q4dSum || 1;
            const labelA = 'Monitorar',   labelB = 'Mitigar',   labelC = 'Investir oportunidade',  labelD = 'Priorizar';
            const quad = [
              { k: 'C', x: 0, y: 0, n: C, lbl: labelC, lblCurto: 'OPORTUNIDADE', bg: 'rgba(125,182,28,0.10)', border: 'rgba(125,182,28,0.30)', txt: '#365314', bar: '#7DB61C' },
              { k: 'D', x: 1, y: 0, n: D, lbl: labelD, lblCurto: 'ALTO RISCO',     bg: 'rgba(214,67,64,0.12)', border: 'rgba(214,67,64,0.35)',  txt: '#991B1B', bar: '#D64340' },
              { k: 'A', x: 0, y: 1, n: A, lbl: labelA, lblCurto: 'MONITORAR',      bg: 'rgba(0,174,157,0.10)', border: 'rgba(0,174,157,0.28)',   txt: '#0F766E', bar: '#00AE9D' },
              { k: 'B', x: 1, y: 1, n: B, lbl: labelB, lblCurto: 'ATENÇÃO',        bg: 'rgba(251,140,0,0.12)', border: 'rgba(251,140,0,0.32)',  txt: '#9A3412', bar: '#FB8C00' },
            ];
            return (
              <div>
                {/* eixos labels */}
                <div style={{
                  position: 'relative',
                  paddingLeft: 18, paddingTop: 4,
                }}>
                  <div style={{
                    position: 'absolute', left: -4, top: '35%', transform: 'rotate(-90deg) translateX(-30%) translateY(-50%)', transformOrigin: '0 0',
                    fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'rgba(0,54,65,0.55)',
                    width: 120, textAlign: 'center',
                  }}>Prob. Perda</div>
                  <div style={{
                    position: 'absolute', right: 0, top: -2,
                    fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'rgba(0,54,65,0.55)',
                  }}>Valor da Causa →</div>
                  <div style={{ position: 'absolute', left: 18, bottom: -16, fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,54,65,0.45)' }}>BAIXO</div>
                  <div style={{ position: 'absolute', right: 0, bottom: -16, fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,54,65,0.45)' }}>ALTO</div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 7,
                    aspectRatio: '1.05',
                  }}>
                    {quad.map(q => {
                      const pct = (q.n/totalQ)*100;
                      return (
                        <div key={q.k} style={{
                          background: q.bg, border: `1px solid ${q.border}`,
                          borderRadius: 12,
                          padding: '9px 9px 10px',
                          display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'space-between',
                          position: 'relative', overflow: 'hidden',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{
                              fontSize: 9.5, fontWeight: 950, letterSpacing: '0.13em', textTransform: 'uppercase',
                              padding: '2px 7px', borderRadius: 999,
                              background: '#FFFFFF', border: `1px solid ${q.border}`, color: q.txt,
                            }}>{q.lblCurto}</span>
                            <span style={{
                              fontFamily: 'Fira Code, monospace', fontSize: 10, fontWeight: 950, color: q.txt,
                              padding: '1px 5px', borderRadius: 6, background: `#FFFFFFAA`,
                              border: `1px solid ${q.border}`,
                            }}>Q{q.k}</span>
                          </div>
                          <div>
                            <div style={{
                              fontSize: 26, fontWeight: 950, lineHeight: 1.05, letterSpacing: -0.5,
                              color: q.txt, fontFamily: 'Fira Code, ui-monospace, monospace',
                            }}>{fmtInt(q.n)}</div>
                            <div style={{ fontSize: 10.5, color: q.txt, opacity: 0.85, marginTop: 2, fontWeight: 800 }}>{q.lbl} · {pct.toFixed(0)}%</div>
                          </div>
                          <div style={{ width: '100%', height: 5, borderRadius: 999, background: `#FFFFFFCC`, overflow: 'hidden', border: `1px solid ${q.border}` }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: q.bar }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 22, padding: '9px 11px 10px', borderRadius: 11, background: 'rgba(0,54,65,0.04)', border: '1px solid rgba(0,54,65,0.08)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Info size={15} color="rgba(0,54,65,0.55)" strokeWidth={2.1}/>
                  <div style={{ fontSize: 10.8, color: 'rgba(0,54,65,0.70)', lineHeight: 1.5 }}>
                    Eixo valor = mediana <b>{fmtMoney(S.medianaValor)}</b>. Eixo prob = <b>50%</b> (processos sem probabilidade informada assumem mediana para a classificação).
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default JuridicoDashboardPage;
