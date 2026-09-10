// アプリ全体で共有する軽い状態（区分・年度・お気に入り・各種設定・テンプレート）。
// localStorage に保存し、useSession() で購読する。本番ではサーバー側のユーザー設定に置き換える想定。

import { useSyncExternalStore } from 'react';

/* ---------- 区分（事業区分 › 拠点区分 › サービス区分 › 小サービス区分） ---------- */
export interface DivisionNode {
  id: string;
  code: string;
  name: string;
  kind: '法人' | '事業区分' | '拠点区分' | 'サービス区分' | '小サービス区分' | '合算';
  /** 伝票入力区分（先頭に3桁コードのある区分）か */
  entry?: boolean;
  use?: boolean;
  color?: string;
  category?: string; // 事業種別
  startYear?: string;
  children?: DivisionNode[];
}

export const DEFAULT_TREE: DivisionNode = {
  id: 'corp', code: '', name: '社会福祉法人 チャイルド保育園', kind: '法人', children: [
    { id: 'shafuku', code: '', name: '社会福祉事業', kind: '事業区分', children: [
      { id: 'honbu', code: '001', name: '本部', kind: '拠点区分', entry: true, use: true, color: '#e8f0fb', category: '法人本部', startYear: '令和6年度', children: [] },
      { id: 'hoikuen', code: '', name: 'チャイルド保育園', kind: '拠点区分', children: [
        { id: 'hoiku', code: '002', name: '保育事業', kind: 'サービス区分', entry: true, use: true, color: '#eaf5ef', category: '保育事業', startYear: '令和6年度', children: [
          { id: 'ichiji', code: '004', name: '一時預かり', kind: '小サービス区分', entry: true, use: true, color: '#fff7e6', category: '保育事業', startYear: '令和7年度' },
        ] },
        { id: 'kosodate', code: '003', name: '子育て支援', kind: 'サービス区分', entry: true, use: true, color: '#fdeef3', category: '子育て支援', startYear: '令和6年度' },
        { id: 'chiiki', code: '005', name: '地域支援', kind: 'サービス区分', entry: true, use: false, color: '#f1f4f6', category: '地域支援', startYear: '令和8年度' },
      ] },
    ] },
    { id: 'koeki', code: '', name: '公益事業', kind: '事業区分', children: [] },
  ],
};

/* ---------- 設定 ---------- */
export interface EnvSettings {
  confirmGeneral: boolean; confirmIncome: boolean; confirmExpense: boolean;
  autoComplete: boolean; autoCompleteAdd: boolean; specialPopup: boolean;
  budgetCheck: boolean; budgetThreshold: number; oneSideInternal: boolean; searchTotal: boolean;
  thousandsSep: '点線' | 'カンマ' | 'なし'; negativeSign: '-' | '△' | '▲'; negativeColor: '黒' | '赤'; zeroCut: boolean;
  colorReports: boolean; lineColor: string; shadeColor: string;
  wideInitial: string; wideMonth: string; ledger1Init: string; ledger2Init: string; order: '日付順' | '入力順';
  eraGannen: boolean; trialCalc: string; reserveOutput: string; noteOnExcel: boolean;
}
export const DEFAULT_ENV: EnvSettings = {
  confirmGeneral: true, confirmIncome: true, confirmExpense: true,
  autoComplete: true, autoCompleteAdd: true, specialPopup: true,
  budgetCheck: true, budgetThreshold: 90, oneSideInternal: false, searchTotal: true,
  thousandsSep: 'カンマ', negativeSign: '△', negativeColor: '赤', zeroCut: true,
  colorReports: true, lineColor: '#c8d3de', shadeColor: '#eef2f6',
  wideInitial: '仕訳日記帳', wideMonth: '最新月', ledger1Init: '普通預金（保育園）', ledger2Init: '', order: '日付順',
  eraGannen: true, trialCalc: '費目行に表記されている計算方式で計算する', reserveOutput: '予備費を標準方式で印字', noteOnExcel: true,
};

export interface InputSettings {
  voucherNo: '自動' | '手入力'; shohyo: boolean; cheque: boolean; tekiyoCode: boolean; gyoshaCode: boolean; spare1: boolean; spare2: boolean; keepLast: boolean; font: '大き目' | '小さ目';
}
export const DEFAULT_INPUT: InputSettings = { voucherNo: '自動', shohyo: true, cheque: false, tekiyoCode: true, gyoshaCode: true, spare1: false, spare2: false, keepLast: true, font: '大き目' };

export interface PrintCommon {
  depth: string; lineGap: string; gapSize: string; perPage: number; twoLineNames: boolean; autoFontHeader: boolean;
  items: Record<string, boolean>; offsetX: number; offsetY: number;
  widthName: number; widthAmount: number; fontHeader: string; fontName: string; fontAmount: string;
  stamps: string[]; footnotes: Record<string, string>;
}
export const PRINT_ITEMS: [string, string][] = [
  ['zero', '0データを印刷しない'], ['shade', '費目行を網掛け、太字にする'], ['bold', '費目下を太線にする'], ['stamp', '捺印欄を印刷する'], ['corp', '法人名を印刷する'],
  ['hline', '項目・科目毎に横線を印刷する'], ['note', '（注）予備費の充当額等を印刷する'], ['autofont', '科目名のフォントサイズを自動調整する'], ['page', 'ページ番号を印刷する'], ['date', '印刷時の日付を印刷する'],
  ['bottom', '常に最下行の下に横線を印刷する'], ['top', '常に最上行の上に横線を印刷する'], ['head2', '2ページ目以降も項目名を印刷する'], ['remarkfont', '資金収支計算書 備考のフォントサイズを自動調整する'], ['special', '事業活動明細書 特別増減の部を印刷する'],
];
export const DEFAULT_PRINT: PrintCommon = {
  depth: '細々区分まで印刷', lineGap: '上・下空き', gapSize: '2mm', perPage: 6, twoLineNames: false, autoFontHeader: true,
  items: Object.fromEntries(PRINT_ITEMS.map(([k]) => [k, ['zero', 'shade', 'corp', 'autofont', 'page', 'date'].includes(k)])),
  offsetX: 0, offsetY: 0, widthName: 60, widthAmount: 28, fontHeader: 'Noto Sans JP 11pt', fontName: 'Noto Sans JP 9pt', fontAmount: 'Noto Sans JP 9pt',
  stamps: ['理事長', '園長', '事務長', ''], footnotes: {},
};

/* ---------- 定型仕訳・自動按分 ---------- */
export interface TemplateLine { kari: string; kashi: string; tekiyo: string; amount: string; gyosha?: string }
export interface JournalTemplate { id: string; name: string; form: '単一式' | '伝票式' | '振替伝票式' | '振替単一式'; lines: TemplateLine[] }
export interface AllocationLine { division: string; kari: string; kashi: string; tekiyo: string; rate: number; mode: '％' | '分数' | '残り'; }
export interface AllocationTemplate { id: string; name: string; form: '単一式' | '伝票式'; rounding: '切り捨て' | '四捨五入' | '切り上げ'; lines: AllocationLine[] }

export const DEFAULT_TEMPLATES: JournalTemplate[] = [
  { id: 't1', name: '電話料金', form: '単一式', lines: [{ kari: '通信運搬費', kashi: '普通預金（保育園）', tekiyo: '電話料金', amount: '', gyosha: 'ＮＴＴ東日本' }] },
  { id: 't2', name: '給与支給（月次）', form: '振替伝票式', lines: [{ kari: '職員俸給', kashi: '普通預金（保育園）', tekiyo: '職員俸給', amount: '' }, { kari: '特殊業務手当', kashi: '普通預金（保育園）', tekiyo: '特殊業務手当', amount: '' }, { kari: '通勤手当', kashi: '普通預金（保育園）', tekiyo: '通勤手当', amount: '' }] },
  { id: 't3', name: '副食費 保護者より', form: '単一式', lines: [{ kari: '現金（収入）', kashi: 'その他の利用料収益', tekiyo: '副食費ー保護者より', amount: '4500', gyosha: '保護者' }] },
  { id: 't4', name: 'コピー機リース', form: '単一式', lines: [{ kari: '賃借料（事業）', kashi: '普通預金（保育園）', tekiyo: 'コピー機リース代', amount: '10995', gyosha: '中央リース' }] },
];
export const DEFAULT_ALLOCATIONS: AllocationTemplate[] = [
  { id: 'a1', name: '水道代（事務費／事業費）', form: '単一式', rounding: '切り捨て', lines: [{ division: '001 本部', kari: '水道光熱費（事務）', kashi: '普通預金（保育園）', tekiyo: '水道代', rate: 30, mode: '％' }, { division: '002 保育事業', kari: '水道光熱費（事業）', kashi: '普通預金（保育園）', tekiyo: '水道代', rate: 70, mode: '残り' }] },
  { id: 'a2', name: 'ガス代（本部／保育園／一時預かり）', form: '単一式', rounding: '四捨五入', lines: [{ division: '001 本部', kari: '水道光熱費（事務）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', rate: 10, mode: '％' }, { division: '002 保育事業', kari: '水道光熱費（事業）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', rate: 80, mode: '％' }, { division: '004 一時預かり', kari: '水道光熱費（事業）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', rate: 10, mode: '残り' }] },
];
/** 特殊金額入力の按分率（集合区分で起動したときの区分別配分） */
export const DEFAULT_SPECIAL_RATES: { division: string; rate: number }[] = [{ division: '001 本部', rate: 20 }, { division: '002 保育事業', rate: 60 }, { division: '003 子育て支援', rate: 10 }, { division: '004 一時預かり', rate: 10 }];

/* ---------- セッション本体 ---------- */
export interface Session {
  division: string;        // 表示中の伝票入力区分（例 '002 保育事業'）
  divisionPath: string[];  // パンくず（法人 › 事業区分 › 拠点区分 › サービス区分）
  fiscalYear: string;      // 例 '令和8年度'
  currentYear: string;     // 本来の当年度
  tree: DivisionNode;
  merges: { name: string; members: string[] }[];
  favorites: string[];
  env: EnvSettings;
  input: InputSettings;
  print: PrintCommon;
  templates: JournalTemplate[];
  allocations: AllocationTemplate[];
  specialRates: { division: string; rate: number }[];
  /** 推移・試算表からの元帳ドリルダウン */
  ledgerTarget: { account: string; month: string } | null;
  /** 決算チェック設定（項目番号→有効） */
  auditEnabled: Record<number, boolean>;
}

const KEY = 'proto-session-v1';
const DEFAULT: Session = {
  division: '002 保育事業', divisionPath: ['社会福祉法人 チャイルド保育園', '社会福祉事業', 'チャイルド保育園', '保育事業'],
  fiscalYear: '令和8年度', currentYear: '令和8年度', tree: DEFAULT_TREE, merges: [{ name: '合算_001（保育園＋子育て支援）', members: ['002 保育事業', '003 子育て支援'] }],
  favorites: ['単一入力', '伝票入力', '仕訳一覧', '勘定元帳', '月次試算', '日次調査'],
  env: DEFAULT_ENV, input: DEFAULT_INPUT, print: DEFAULT_PRINT, templates: DEFAULT_TEMPLATES, allocations: DEFAULT_ALLOCATIONS, specialRates: DEFAULT_SPECIAL_RATES,
  ledgerTarget: null, auditEnabled: {},
};

let state: Session = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const saved = JSON.parse(raw) as Partial<Session>;
    return { ...DEFAULT, ...saved, env: { ...DEFAULT_ENV, ...(saved.env ?? {}) }, input: { ...DEFAULT_INPUT, ...(saved.input ?? {}) }, print: { ...DEFAULT_PRINT, ...(saved.print ?? {}) }, ledgerTarget: null };
  } catch {
    return DEFAULT;
  }
})();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getSession() { return state; }
export function setSession(patch: Partial<Session> | ((s: Session) => Partial<Session>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, ledgerTarget: null })); } catch { /* ignore */ }
  emit();
}
export function resetSession() { state = DEFAULT; try { localStorage.removeItem(KEY); } catch { /* ignore */ } emit(); }
export function useSession(): Session {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

/** 区分ツリーを平坦化（伝票入力区分のみ／すべて） */
export function flattenDivisions(node: DivisionNode, path: string[] = []): { node: DivisionNode; path: string[] }[] {
  const here = [...path, node.name];
  const out: { node: DivisionNode; path: string[] }[] = [{ node, path: here }];
  (node.children ?? []).forEach((c) => out.push(...flattenDivisions(c, here)));
  return out;
}
export const divisionLabel = (n: DivisionNode) => (n.code ? `${n.code} ${n.name}` : n.name);
