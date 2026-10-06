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
        { id: 'hoiku', code: '002', name: '保育事業', kind: 'サービス区分', entry: true, use: true, color: '#eaf5ef', category: '保育事業', startYear: '令和6年度', children: [] },
        // 子育て支援は小サービス区分を持つ親区分（集計・参照用）の例。伝票は末端の入力区分で登録する
        { id: 'kosodate', code: '003', name: '子育て支援', kind: 'サービス区分', entry: true, use: true, color: '#fdeef3', category: '子育て支援', startYear: '令和6年度', children: [
          { id: 'ichiji', code: '004', name: '一時預かり', kind: '小サービス区分', entry: true, use: true, color: '#fff7e6', category: '子育て支援', startYear: '令和7年度' },
        ] },
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
  /** 帳票・繰入金・注意書き（動作環境 4.2.2） */
  budgetInternalOffset: boolean; onePageRow: boolean; termFromStart: boolean; hideCorpName: boolean;
  transferWatch: '収入で監視' | '支払いで監視';
  /** 依頼書 2.6／5.5.1：動作環境の残り項目（全区分共通：フリガナ検索の無効化・帳票印刷の速度重視／区分ごと：負数の表記位置・バックアップ先・画面背景・金額フォントの自動調整） */
  noFurigana: boolean; printSpeed: boolean;
  negativePos: '前' | '後'; backupDest: 'クラウド（標準）' | 'フォルダ指定' | 'Dropbox'; backupFolder: string;
  bgMode: '色' | '画像'; bgColor: string; bgColorRight: string; autoAmountFont: boolean;
  /** 補正予算額の入力方式（依頼書 5.5.5：切替は「予算額の設定」画面内で行う。区分ごと） */
  supplementMode: '補正額' | '補正後予算額';
  /** 付箋の色の意味（全区分共通）。付箋ボタンのツールチップ・検索条件・印刷の絞り込みに表示する */
  fusenNames: Record<'赤' | '青' | '黄' | '緑', string>;
  /** 充実残額発生の可能性の通知（全区分共通。依頼書 2.5「充実残額発生の可能性確認設定」）：伝票入力画面の上部に案内を出す */
  sufficiencyNotice: boolean;
}
export const DEFAULT_ENV: EnvSettings = {
  confirmGeneral: true, confirmIncome: true, confirmExpense: true,
  autoComplete: true, autoCompleteAdd: true, specialPopup: true,
  budgetCheck: true, budgetThreshold: 90, oneSideInternal: false, searchTotal: true,
  thousandsSep: 'カンマ', negativeSign: '△', negativeColor: '赤', zeroCut: true,
  colorReports: true, lineColor: '#c8d3de', shadeColor: '#eef2f6',
  wideInitial: '仕訳日記帳', wideMonth: '最新月', ledger1Init: '普通預金（保育園）', ledger2Init: '', order: '日付順',
  eraGannen: true, trialCalc: '費目行に表記されている計算方式で計算する', reserveOutput: '予備費を標準方式で印字', noteOnExcel: true,
  budgetInternalOffset: true, onePageRow: false, termFromStart: false, hideCorpName: false, transferWatch: '収入で監視',
  noFurigana: false, printSpeed: false,
  negativePos: '前', backupDest: 'クラウド（標準）', backupFolder: '', bgMode: '色', bgColor: '#f3f6f9', bgColorRight: '#eef5fb', autoAmountFont: true,
  supplementMode: '補正額',
  fusenNames: { 赤: '要確認（内容に疑問）', 青: '保留・問い合わせ中', 黄: '決算時に見直す', 緑: '確認済み' },
  sufficiencyNotice: true,
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
  /** ページ番号の開始番号 */
  pageStart: number;
  /** 備考・摘要（依頼書 3.2）：単位ごとに保持する（法人の決算書／拠点の決算書／サービス区分の資金収支計算書）。1つには統合しない */
  unitRemarks: Record<string, string>;
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
  pageStart: 1, unitRemarks: {},
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
  ledgerTarget: { account: string; month: string; /** 呼び出し元の画面（戻り導線に使う。例 '月次試算'） */ from?: string } | null;
  /** 同額・不一致検索の「伝票表示」から日記帳へ（不一致が見つかった日・呼び出し元を引き継ぐ） */
  journalTarget: { month: string; day: number; from: string } | null;
  /** 決算チェック設定（項目番号→有効） */
  auditEnabled: Record<number, boolean>;
  /** 法人情報（部門情報の変更）：データ開始年月日（西暦8桁）・法人税納税の有無 */
  corpStartDate: string;
  corpTax: string;
  /** 利用者の権限（依頼書 2.1-7）。参照のみ＝伝票の入力・訂正・削除・入換ができない */
  role: '入力可' | '参照のみ';
  /** 別売オプションの導入状況（依頼書 5.1.4）。未導入は導入案内として表示 */
  options: Record<string, boolean>;
  /** 起動直後（区分選択後）に表示する画面（依頼書 5.2.2） */
  startScreen: 'ホーム' | '伝票入力';
  /** ホーム（ダッシュボード）に表示するメニュー。利用者が「表示させるメニューの編集」で切り替える */
  homeSections: Record<HomeSectionKey, boolean>;
  /** 消費税対応（法人単位。依頼書 2.4：振替伝票形式・振替単一形式に税区分・税額の欄を出す）。事業者 › 会計方針で切替 */
  taxEntry: boolean;
}

const KEY = 'proto-session-v2'; // v2：区分ツリーの見直し（入力区分／親区分）に伴い保存形式を更新
/** ホーム（ダッシュボード）の表示メニュー */
export const HOME_SECTIONS = [
  { key: 'bank', label: '銀行の預金残高', note: '口座ごとの残高と前日比' },
  { key: 'checks', label: '調査・チェック', note: '仕訳数の問合せ／同額・不一致検索／決算チェック' },
  { key: 'favorites', label: 'よく使う操作（お気に入り）', note: '登録した画面をすぐに開くボタン' },
  { key: 'faq', label: 'よくある質問（FAQ）', note: '操作で迷ったときの質問と回答' },
  { key: 'notices', label: 'お知らせ', note: 'システム・法改正・保守の案内' },
  { key: 'banners', label: 'バナー', note: 'ご案内の画像' },
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number]['key'];
const DEFAULT_HOME_SECTIONS: Record<HomeSectionKey, boolean> = { bank: true, checks: true, favorites: true, faq: true, notices: true, banners: true };

const DEFAULT: Session = {
  division: '002 保育事業', divisionPath: ['社会福祉法人 チャイルド保育園', '社会福祉事業', 'チャイルド保育園', '保育事業'],
  fiscalYear: '令和8年度', currentYear: '令和8年度', tree: DEFAULT_TREE, merges: [{ name: '合算_001（保育園＋子育て支援）', members: ['002 保育事業', '003 子育て支援'] }],
  favorites: ['単一入力', '伝票入力', '仕訳一覧', '勘定元帳', '月次試算', '日次調査'],
  env: DEFAULT_ENV, input: DEFAULT_INPUT, print: DEFAULT_PRINT, templates: DEFAULT_TEMPLATES, allocations: DEFAULT_ALLOCATIONS, specialRates: DEFAULT_SPECIAL_RATES,
  ledgerTarget: null, journalTarget: null, auditEnabled: {}, corpStartDate: '20240401', corpTax: '非課税',
  role: '入力可', options: { 小口現金: true, 減価償却: true, 預金出納: true, 収入支出: true, 電子印: false }, startScreen: 'ホーム', homeSections: DEFAULT_HOME_SECTIONS, taxEntry: false,
};

let state: Session = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const saved = JSON.parse(raw) as Partial<Session>;
    return { ...DEFAULT, ...saved, env: { ...DEFAULT_ENV, ...(saved.env ?? {}) }, input: { ...DEFAULT_INPUT, ...(saved.input ?? {}) }, print: { ...DEFAULT_PRINT, ...(saved.print ?? {}) }, options: { ...DEFAULT.options, ...(saved.options ?? {}) }, homeSections: { ...DEFAULT_HOME_SECTIONS, ...(saved.homeSections ?? {}) }, ledgerTarget: null, journalTarget: null };
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
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, ledgerTarget: null, journalTarget: null })); } catch { /* ignore */ }
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

/* ---------- 起動区分の種類と権限（依頼書 2.1） ---------- */
/** 入力区分＝ツリー末端の伝票入力区分／親区分＝それらを集計する区分（法人・事業区分・拠点など）／合算区分＝任意の合算 */
export type StartKind = '入力区分' | '親区分' | '合算区分';
export function startKindOf(s: Session): StartKind {
  if (s.merges.some((m) => m.name === s.division)) return '合算区分';
  const hit = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node;
  if (!hit) return '入力区分';
  const hasEntryChild = (hit.children ?? []).some((c) => c.entry && c.use !== false);
  return hit.entry && !hasEntryChild ? '入力区分' : '親区分';
}
/** 伝票の入力・訂正・削除ができるか（参照のみ権限、親区分・合算区分での起動では不可） */
export const canEdit = (s: Session) => s.role === '入力可' && startKindOf(s) === '入力区分';
/** 参照のみ権限か（操作できないボタンは無効表示ではなく非表示にする。区分の都合で使えないときは無効表示＋理由） */
export const isViewOnly = (s: Session) => s.role !== '入力可';
/** 一覧の表示順入換ができるか（参照のみ権限・合算区分では不可） */
export const canReorder = (s: Session) => s.role === '入力可' && startKindOf(s) !== '合算区分';
/** 使えない理由（ツールチップ用）。使えるときは空文字 */
export const editBlockReason = (s: Session) => (s.role !== '入力可' ? '参照のみの権限のため操作できません' : startKindOf(s) === '合算区分' ? '合算区分で起動中のため操作できません（内訳の確認用）' : startKindOf(s) === '親区分' ? '親区分で起動中のため操作できません（伝票は入力区分で登録します）' : '');

/** 付箋の表示名：「赤（要確認）」のように色と意味を並べる。意味は環境設定の「付箋の色の意味」で変更できる */
export const fusenLabel = (f: string): string => (f ? `${f}（${getSession().env.fusenNames[f as '赤' | '青' | '黄' | '緑'] ?? ''}）` : 'なし');
