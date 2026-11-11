// オプション：小口現金出納帳／預金出納帳（共通部品）
//   紙の出納帳風の表（入金額／年月日／摘要／勘定科目／出金額／残高）。最終行が入力行で、Enterで次の項目→登録。
//   小口現金：行ごとの「挿入・特殊行・編集・削除」（確認メモ #206／#207／#209）、集計（確認→集計済みロック）、AI自動仕訳インポート、
//             翌年度の予備月 4〜6月（#205）、小口の設定（#210）、金銭残高金種別表（#212）
//   預金出納：銀行CSVインポート・インポート一括削除
//   共通：会計連動・印刷（集計内訳表／仕訳伝票／出納帳）・区分の切替（画面の中に「＋出納帳追加」。#211／#215）
//   集計：上から順に、どこまで集計するかを選ぶ（飛び飛びには選べない。#208）。集計済みの期間より前の日付の明細は登録・訂正できない
//   集計 ― 確認：会計連動へ送るときの伝票日付を指定できる（明細の日付を伝票日付とする／伝票年月日／月末日。確認メモ #164）
//   消費税を使う設定（消費税の処理方式が「通常モード」以外）のときは、明細に「消費税コード」「税額」の列を出す（#216）

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { AssistField } from './AssistField';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { FISCAL_MONTHS, inPeriod, lastDayOf, parseMD, periodLabel as periodText, type Period } from '../lib/period';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { LABEL, NUM, ReportShell, TD, TH } from './ReportShell';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { useAssist } from '../hooks/useAssist';
import { addVoucher } from '../store/journalStore';
import { useSession } from '../store/session';
import { accountFlat } from '../data';
import type { MonthFilter } from '../types';

export type CashbookKind = 'petty' | 'bank';
const yen = (n: number) => n.toLocaleString('ja-JP');

interface Row {
  id: number;
  month: string;
  day: string;
  tekiyo: string;
  account: string;
  code: string;
  inAmt: number;
  outAmt: number;
  special?: '小計行' | '改ページ' | '締切線' | '摘要行';
  aggregated?: boolean;
  imported?: boolean;
  /** 会計連動で仕訳伝票を作成済み */
  linked?: boolean;
  /** 集計時に指定した伝票日付（'M/D'）。未指定のときは明細の日付で仕訳伝票を作る */
  slipDate?: string;
  /** AI自動仕訳からの取込：会計確認（承認）待ち／承認済み */
  ai?: 'pending' | 'approved';
  /** AI推定の信頼度（%） */
  aiConf?: number;
  /** 翌年度の予備月（4〜6月）の明細（確認メモ #205） */
  ny?: boolean;
  /** 消費税コード（確認メモ #216）。未設定のときは勘定科目から既定を決める */
  tax?: string;
}
const CODE: Record<string, string> = { 手数料: '2340', 修繕費: '2290', '賃借料（事業）': '2520', '普通預金（保育園）': '5013', 福利厚生費: '2210', 消耗器具備品費: '2500', 通信運搬費: '2300', 給食費: '2410', 保育材料費: '2460', '水道光熱費（事業）': '2480', 委託費収益: '6110' };
let seq = 100;
const R = (month: string, day: string, tekiyo: string, account: string, inAmt: number, outAmt: number, extra: Partial<Row> = {}): Row => ({ id: seq++, month, day, tekiyo, account, code: CODE[account] ?? '', inAmt, outAmt, ...extra });

const PETTY_SEED: Row[] = [
  R('8', '1', '振込手数料', '手数料', 0, 660),
  R('8', '19', '金種手数料', '手数料', 0, 440),
  R('8', '24', '自転車修理代', '修繕費', 0, 8140),
  R('8', '25', '清掃代', '賃借料（事業）', 0, 4950),
  R('8', '29', '普通預金より', '普通預金（保育園）', 50000, 0),
  R('8', '29', '検便代', '福利厚生費', 0, 6930),
  R('8', '29', 'インク代', '消耗器具備品費', 0, 4864),
  R('8', '30', 'FAX代', '通信運搬費', 0, 6303),
];
const BANK_SEED: Row[] = [
  R('8', '5', '払い出し－当座へ', '当座預金（保育園）', 0, 500000),
  R('8', '5', '電話料金', '通信運搬費', 0, 8936),
  R('8', '19', '委託費－８月分', '委託費収益', 2732430, 0),
  R('8', '19', '職員俸給', '職員俸給', 0, 1502512),
];
const BANK_ACCOUNTS = ['普通預金（本部）', '普通預金（保育園）', '当座預金（保育園）', '定期預金'];
/** 預金出納：はじめから出納帳のある預金科目（残りは「区分の切替」の「＋出納帳追加」で追加する。確認メモ #215） */
const BANK_BOOKS_SEED = ['普通預金（保育園）', '普通預金（本部）'];
/** 小口現金の区分（拠点・担当ごとに出納帳を分ける）。refill 以降は「小口の設定」の項目（確認メモ #210。項目は叩き台） */
interface PettyBook { name: string; staff: string; place: string; refill: string; fixed: number; warn: number }
const PETTY_PLACES = ['001 本部', '002 保育事業', '003 子育て支援'];
const PETTY_BOOKS: PettyBook[] = [
  { name: '小口現金（保育園）', staff: '経理担当', place: '002 保育事業', refill: '普通預金（保育園）', fixed: 50000, warn: 10000 },
  { name: '小口現金（本部）', staff: '事務長', place: '001 本部', refill: '普通預金（本部）', fixed: 50000, warn: 10000 },
  { name: '小口現金（給食室）', staff: '栄養士', place: '002 保育事業', refill: '普通預金（保育園）', fixed: 30000, warn: 5000 },
  { name: '小口現金（子育て支援）', staff: '支援員', place: '003 子育て支援', refill: '普通預金（保育園）', fixed: 30000, warn: 5000 },
];
/** 消費税コード（各種設定「税区分」のコードに合わせる。確認メモ #216） */
const TAX_CODES: { code: string; name: string; rate: number }[] = [
  { code: '10', name: '課税売上 10%', rate: 10 },
  { code: '11', name: '課税仕入 10%', rate: 10 },
  { code: '08', name: '軽減税率 8%', rate: 8 },
  { code: '20', name: '非課税', rate: 0 },
  { code: '30', name: '不課税', rate: 0 },
  { code: '40', name: '免税', rate: 0 },
  { code: '99', name: '課税区分不明', rate: 0 },
];
/** 勘定科目から決める消費税コードの既定（サンプル。本番は勘定科目マスタの税区分を使う） */
function defaultTax(account: string, isIn: boolean): string {
  if (!account) return '';
  if (/預金|現金|俸給|給与|手当|法定福利/.test(account)) return '30';
  if (/給食/.test(account)) return '08';
  if (isIn) return /収益|収入/.test(account) ? '20' : '10';
  return '11';
}
const taxCodeOf = (r: Pick<Row, 'account' | 'inAmt' | 'tax'>) => r.tax ?? defaultTax(r.account, r.inAmt > 0);
const taxName = (code: string) => TAX_CODES.find((t) => t.code === code)?.name ?? '';
/** 税額（内税）：金額 × 税率 ÷（100 ＋ 税率）の切り捨て */
const taxAmtOf = (code: string, amount: number) => { const rate = TAX_CODES.find((t) => t.code === code)?.rate ?? 0; return rate ? Math.floor((amount * rate) / (100 + rate)) : 0; };
/** 年の表示（令和8年度：4〜12月は令和8年、1〜3月と翌年度の予備月は令和9年） */
const eraOf = (r: { month: string; ny?: boolean }) => (r.ny || ['1', '2', '3'].includes(r.month) ? 9 : 8);
/** 日付の並び順（年度内の月の順。翌年度の予備月は年度の後ろ） */
const dateOrd = (month: string, day: string, ny?: boolean) => (ny ? 1000 : 0) + Math.max(0, FISCAL_MONTHS.indexOf(month)) * 40 + (Number(day) || 0);
const ordOf = (r: { month: string; day: string; ny?: boolean }) => dateOrd(r.month, r.day, r.ny);
/** 金銭残高金種別表の金種（確認メモ #212） */
const DENOMS: ['紙幣' | '硬貨', number][] = [['紙幣', 10000], ['紙幣', 5000], ['紙幣', 2000], ['紙幣', 1000], ['硬貨', 500], ['硬貨', 100], ['硬貨', 50], ['硬貨', 10], ['硬貨', 5], ['硬貨', 1]];
/** 日付（令和の年/月/日）ごとの金種別の枚数。サンプルは出納帳のサンプルの残高に合わせた作例 */
const DENOM_SEED: Record<string, Record<number, number>> = {
  '8/8/25': { 10000: 1, 1000: 2, 100: 3, 10: 2, 5: 1, 1: 2 },
  '8/8/30': { 10000: 3, 5000: 1, 1000: 8, 500: 1, 100: 6, 50: 1, 10: 8 },
};
/** 出納帳で選べる勘定科目（勘定科目マスタ＋出納帳サンプルで使用中の科目） */
const CASHBOOK_ACCOUNTS = Array.from(new Set([...accountFlat(), ...Object.keys(CODE)]));
/** AI自動仕訳の推定ルール（摘要のキーワード → 勘定科目）。本番では AI 自動仕訳システムの判定結果を受け取る */
const AI_RULES: [RegExp, string][] = [
  [/手数料|振込/, '手数料'], [/修理|修繕/, '修繕費'], [/清掃|リース|賃借/, '賃借料（事業）'], [/検便|健診|福利/, '福利厚生費'],
  [/インク|文具|備品|コピー用紙|電池/, '消耗器具備品費'], [/FAX|ファックス|切手|郵便|宅急便|送料|電話/, '通信運搬費'], [/給食|食材|牛乳|野菜|パン/, '給食費'],
  [/画用紙|折り紙|絵本|教材|保育材料|おもちゃ/, '保育材料費'], [/電気|ガス|水道/, '水道光熱費（事業）'], [/預金より|引出|補充|入金/, '普通預金（保育園）'],
];
interface AiLine { id: number; month: string; day: string; tekiyo: string; amount: number; dir: '入金' | '出金'; account: string; conf: number; on: boolean }
function suggestAccount(tekiyo: string, dir: '入金' | '出金'): { account: string; conf: number } {
  for (const [re, acc] of AI_RULES) if (re.test(tekiyo)) return { account: acc, conf: 82 + ((tekiyo.length * 7) % 16) };
  return { account: dir === '入金' ? '普通預金（保育園）' : '消耗器具備品費', conf: 48 + ((tekiyo.length * 5) % 12) };
}
/** CSV（日付,摘要,金額[,入金/出金]）または JSON（[{date,tekiyo|description,amount,dir?}]）を取込行に変換 */
function parseAiFile(text: string, name: string): AiLine[] {
  let aiSeq = 1;
  const mk = (dateStr: string, tekiyo: string, amount: number, dirIn?: string): AiLine | null => {
    const m = String(dateStr).match(/(\d{1,2})\D+(\d{1,2})\D*$/);
    if (!m || !tekiyo || !amount) return null;
    const dir: AiLine['dir'] = dirIn === '入金' || dirIn === 'in' || (dirIn == null && amount < 0) ? '入金' : '出金';
    const sug = suggestAccount(tekiyo, dir);
    return { id: aiSeq++, month: String(Number(m[1])), day: String(Number(m[2])), tekiyo: tekiyo.trim(), amount: Math.abs(amount), dir, ...sug, on: true };
  };
  const out: AiLine[] = [];
  if (/\.json$/i.test(name)) {
    const arr = JSON.parse(text) as Record<string, unknown>[];
    (Array.isArray(arr) ? arr : []).forEach((o) => { const l = mk(String(o.date ?? o.日付 ?? ''), String(o.tekiyo ?? o.description ?? o.摘要 ?? ''), Number(o.amount ?? o.金額 ?? 0), (o.dir ?? o.区分) as string | undefined); if (l) out.push(l); });
    return out;
  }
  text.replace(/^\ufeff/, '').split(/\r?\n/).forEach((line) => {
    const cols = line.split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3 || /日付|date/i.test(cols[0])) return;
    const l = mk(cols[0], cols[1], Number(cols[2].replace(/[^0-9.-]/g, '')), cols[3]);
    if (l) out.push(l);
  });
  return out;
}
const AI_SAMPLE_CSV = `日付,摘要,金額,区分
2026/8/21,切手代,840,出金
2026/8/22,画用紙・折り紙,2560,出金
2026/8/26,牛乳（給食）,1980,出金
2026/8/27,ドアノブ修理,6600,出金
2026/8/28,普通預金より補充,30000,入金
2026/8/29,乾電池,1100,出金`;

function onEnter(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
    e.preventDefault();
    fn();
  };
}
const focusId = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);

interface Props {
  kind: CashbookKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
}

export function CashbookPage({ kind, variant, accent, accentRgb }: Props) {
  const isPetty = kind === 'petty';
  const title = isPetty ? '小口現金出納帳' : '預金出納帳';
  /** 消費税を使う設定（消費税の処理方式が「通常モード」以外）のときは「消費税コード」「税額」の列を出す（確認メモ #216） */
  const { taxEntry } = useSession();
  const [book, setBook] = useState(isPetty ? PETTY_BOOKS[0].name : '普通預金（保育園）');
  /** 出納帳の一覧（「区分の切替」の中の「＋出納帳追加」で増やせる。確認メモ #211／#215） */
  const [pettyBooks, setPettyBooks] = useState<PettyBook[]>(PETTY_BOOKS);
  const [bankBooks, setBankBooks] = useState<string[]>(BANK_BOOKS_SEED);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchPick, setSwitchPick] = useState(book);
  /** 「＋出納帳追加」の入力欄（null＝閉じている）。預金出納では name に預金科目を入れる */
  const [addBook, setAddBook] = useState<{ name: string; staff: string; place: string } | null>(null);
  /** 小口の設定（確認メモ #210） */
  const [setting, setSetting] = useState<{ name: string; staff: string; place: string; refill: string; fixed: string; warn: string } | null>(null);
  /** 行の挿入・編集（確認メモ #206／#207）。noteOnly＝摘要行（摘要だけ直す） */
  const [rowForm, setRowForm] = useState<{ mode: 'insert' | 'edit'; targetId: number; noteOnly: boolean; ny: boolean; month: string; day: string; tekiyo: string; account: string; inAmt: string; outAmt: string; tax: string } | null>(null);
  /** 削除などの確認（「はい」を押したときだけ実行する） */
  const [confirm, setConfirm] = useState<{ title: string; body: string; ok: string; onOk: () => void } | null>(null);
  /** 金銭残高金種別表（確認メモ #212）：日付ごとの枚数、開いている日付、入力中の枚数 */
  const [denomOpen, setDenomOpen] = useState(false);
  const [denomSheets, setDenomSheets] = useState<Record<string, Record<number, number>>>(DENOM_SEED);
  const [denomDate, setDenomDate] = useState({ era: '8', month: '8', day: '30' });
  const [denomForm, setDenomForm] = useState<Record<number, string>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLines, setAiLines] = useState<AiLine[]>([]);
  const [aiFileName, setAiFileName] = useState('');
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null);
  const aiFile = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>(isPetty ? PETTY_SEED : BANK_SEED);
  const [opening] = useState(isPetty ? 26517 : 9630000);
  const [month, setMonth] = useState<MonthFilter>('8');
  /** 集計期間の範囲（月の範囲・日付の範囲。確認メモ #57／#58） */
  const [range, setRange] = useState<Period | null>(null);
  const [entry, setEntry] = useState({ inAmt: '', month: '8', day: '', tekiyo: '', account: '', outAmt: '', tax: '' });
  /** 特殊行を挿入する位置（選択した行の id。その行の上に挿入する。確認メモ #209）。null＝閉じている */
  const [specialTarget, setSpecialTarget] = useState<number | null>(null);
  const [specialOpts, setSpecialOpts] = useState({ date: false, balance: false });
  const [aggOpen, setAggOpen] = useState(false);
  const [aggSel, setAggSel] = useState<Set<number>>(new Set());
  const [aggConfirm, setAggConfirm] = useState(false);
  const [aggLink, setAggLink] = useState(false);
  /** 集計 ― 確認：会計連動へ送る伝票の日付（確認メモ #164）。明細の日付を使うか、伝票年月日を指定する（「月末日」で日を月の末日にする） */
  const [aggUseRowDate, setAggUseRowDate] = useState(false);
  const [aggDate, setAggDate] = useState({ month: '8', day: '' });
  const [aggMonthEnd, setAggMonthEnd] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const assist = useAssist();
  const toast = useToast();

  // 残高計算（月フィルタ前の全行で通算）
  const withBal = useMemo(() => {
    let bal = opening;
    return rows.map((r) => {
      if (!r.special) bal += r.inAmt - r.outAmt;
      return { ...r, bal };
    });
  }, [rows, opening]);
  // 翌年度の予備月（4〜6月。月タブの「決」の後ろに置く。確認メモ #205）：月の選択値は '翌4'／'翌5'／'翌6'
  const nyMonth = !range && typeof month === 'string' && month.startsWith('翌') ? month.slice(1) : null;
  const view = withBal.filter((r) => (range ? !r.ny && inPeriod(`${r.month}/${r.day}`, range) : month == null ? true : nyMonth ? !!r.ny && r.month === nyMonth : !r.ny && r.month === month));
  const lastBal = withBal.length ? withBal[withBal.length - 1].bal : opening;
  const monthIn = view.reduce((a, r) => a + r.inAmt, 0);
  const monthOut = view.reduce((a, r) => a + r.outAmt, 0);
  /** 月タブを選ぶ。入力行の月も合わせる */
  const selectMonth = (m: MonthFilter) => { setMonth(m); if (m && m !== '決') setEntry((en) => ({ ...en, month: m })); };
  const selectNy = (m: string) => { setRange(null); setMonth(`翌${m}`); setEntry((en) => ({ ...en, month: m })); };

  // ---- 集計済みの範囲（確認メモ #206〜#208）：集計済みの行より前には挿入できず、集計済みの期間より前の日付では登録・訂正できない ----
  const lastAggIdx = rows.reduce((a, r, i) => (r.aggregated ? i : a), -1);
  const aggLast = rows.reduce<Row | null>((a, r) => (r.aggregated && (!a || ordOf(r) > ordOf(a)) ? r : a), null);
  const beforeAgg = (m: string, d: string, ny?: boolean) => !!aggLast && dateOrd(m, d, ny) < ordOf(aggLast);
  const aggLockMsg = () => toast.show(`集計済みの期間（令和${aggLast ? eraOf(aggLast) : 8}年 ${aggLast?.month}月${aggLast?.day}日まで）より前の日付の明細は、登録・訂正できません`);
  const canInsertAt = (id: number) => rows.findIndex((r) => r.id === id) > lastAggIdx;
  const insertLockMsg = () => toast.show('集計済みの明細より前には、行を挿入できません');
  const lockedMsg = () => toast.show('集計済みの明細は訂正・削除できません（「集計取消」を実行してください）');
  const num = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;

  const add = () => {
    const inAmt = num(entry.inAmt);
    const outAmt = num(entry.outAmt);
    const m = nyMonth ?? (entry.month || '8');
    if (!entry.day) return toast.show('日を入力してください');
    if (!parseMD(`${m}/${entry.day}`)) return toast.show('日付を正しく入力してください');
    if (!entry.account) return toast.show('勘定科目を選択してください');
    if (!inAmt && !outAmt) return toast.show('入金額または出金額を入力してください');
    if (beforeAgg(m, entry.day, !!nyMonth)) return aggLockMsg();
    setRows((rs) => [...rs, R(m, entry.day, entry.tekiyo, entry.account, inAmt, outAmt, { ...(nyMonth ? { ny: true } : {}), ...(entry.tax ? { tax: entry.tax } : {}) })]);
    setEntry({ inAmt: '', month: entry.month, day: '', tekiyo: '', account: '', outAmt: '', tax: '' });
    focusId('cb-in');
  };

  // ---- 行の挿入・編集・削除、特殊行の挿入（行の右のボタンから。確認メモ #206／#207／#209） ----
  const openInsert = (r: Row) => {
    if (!canInsertAt(r.id)) return insertLockMsg();
    setRowForm({ mode: 'insert', targetId: r.id, noteOnly: false, ny: !!r.ny, month: r.month, day: r.day, tekiyo: '', account: '', inAmt: '', outAmt: '', tax: '' });
    focusId('re-day');
  };
  const openEdit = (r: Row) => {
    if (r.aggregated) return lockedMsg();
    if (r.special && !canInsertAt(r.id)) return lockedMsg();
    setRowForm({ mode: 'edit', targetId: r.id, noteOnly: r.special === '摘要行', ny: !!r.ny, month: r.month, day: r.day, tekiyo: r.tekiyo, account: r.account, inAmt: r.inAmt ? String(r.inAmt) : '', outAmt: r.outAmt ? String(r.outAmt) : '', tax: r.tax ?? '' });
    focusId(r.special === '摘要行' ? 're-tekiyo' : 're-day');
  };
  const saveRowForm = () => {
    const f = rowForm;
    if (!f) return;
    if (f.noteOnly) {
      setRows((rs) => rs.map((x) => (x.id === f.targetId ? { ...x, tekiyo: f.tekiyo } : x)));
      setRowForm(null);
      return toast.show('摘要行を訂正しました');
    }
    const inAmt = num(f.inAmt);
    const outAmt = num(f.outAmt);
    if (!parseMD(`${f.month}/${f.day}`)) return toast.show('日付を正しく入力してください');
    if (f.ny && !['4', '5', '6'].includes(f.month)) return toast.show('翌年度の予備月は 4〜6月です');
    if (!f.account) return toast.show('勘定科目を選択してください');
    if (!inAmt && !outAmt) return toast.show('入金額または出金額を入力してください');
    if (beforeAgg(f.month, f.day, f.ny)) return aggLockMsg();
    const extra: Partial<Row> = { ...(f.ny ? { ny: true } : {}), ...(f.tax ? { tax: f.tax } : {}) };
    if (f.mode === 'insert') {
      setRows((rs) => { const i = rs.findIndex((x) => x.id === f.targetId); return i < 0 ? rs : [...rs.slice(0, i), R(f.month, f.day, f.tekiyo, f.account, inAmt, outAmt, extra), ...rs.slice(i)]; });
    } else {
      setRows((rs) => rs.map((x) => (x.id === f.targetId ? { ...x, month: f.month, day: f.day, tekiyo: f.tekiyo, account: f.account, code: CODE[f.account] ?? '', inAmt, outAmt, tax: f.tax || undefined } : x)));
    }
    setRowForm(null);
    toast.show(f.mode === 'insert' ? '行を挿入しました' : '明細を訂正しました');
  };
  const askDelete = (r: Row) => {
    if (r.aggregated) return lockedMsg();
    if (r.special && !canInsertAt(r.id)) return lockedMsg();
    const what = r.special ? (r.special === '摘要行' ? `摘要行「${r.tekiyo}」` : r.special) : `${r.month}月${r.day}日「${r.tekiyo}」（${yen(r.inAmt || r.outAmt)}円）`;
    setConfirm({ title: '行の削除', body: `${what} を削除します。よろしいですか？`, ok: '削除する', onOk: () => { setRows((rs) => rs.filter((x) => x.id !== r.id)); toast.show('行を削除しました'); } });
  };
  const openSpecial = (r: Row) => { if (!canInsertAt(r.id)) return insertLockMsg(); setSpecialTarget(r.id); };
  const specialRow = rows.find((r) => r.id === specialTarget);
  /** 特殊行は、選択した行の上に挿入する */
  const insertSpecial = (kind: Row['special']) => {
    const t = specialRow;
    if (!t) return;
    setRows((rs) => { const i = rs.findIndex((x) => x.id === t.id); return i < 0 ? rs : [...rs.slice(0, i), { ...R(t.month, '', kind === '摘要行' ? '（摘要行）' : '', '', 0, 0, t.ny ? { ny: true } : {}), special: kind }, ...rs.slice(i)]; });
    setSpecialTarget(null);
    toast.show(`${kind}を挿入しました`);
  };

  // ---- 区分の切替と「＋出納帳追加」（確認メモ #211／#215）、小口の設定（#210） ----
  const bankCandidates = BANK_ACCOUNTS.filter((a) => !bankBooks.includes(a));
  const openSwitch = () => { setSwitchPick(book); setAddBook(null); setSwitchOpen(true); };
  const commitAddBook = () => {
    if (!addBook) return;
    const name = addBook.name.trim();
    if (!name) return toast.show(isPetty ? '出納帳の名称を入力してください' : '預金科目を選択してください');
    if ((isPetty ? pettyBooks.map((b) => b.name) : bankBooks).includes(name)) return toast.show('同じ名称の出納帳がすでにあります');
    if (isPetty) setPettyBooks((bs) => [...bs, { name, staff: addBook.staff.trim() || '未設定', place: addBook.place, refill: '普通預金（保育園）', fixed: 50000, warn: 10000 }]);
    else setBankBooks((bs) => [...bs, name]);
    setSwitchPick(name);
    setAddBook(null);
    toast.show(`${name} を追加しました。「OK」でこの出納帳に切り替えます`);
  };
  const curPetty = pettyBooks.find((b) => b.name === book);
  const openSetting = () => { if (curPetty) setSetting({ name: curPetty.name, staff: curPetty.staff, place: curPetty.place, refill: curPetty.refill, fixed: String(curPetty.fixed), warn: String(curPetty.warn) }); };
  const saveSetting = () => {
    if (!setting) return;
    const name = setting.name.trim();
    if (!name) return toast.show('出納帳の名称を入力してください');
    if (name !== book && pettyBooks.some((b) => b.name === name)) return toast.show('同じ名称の出納帳がすでにあります');
    setPettyBooks((bs) => bs.map((b) => (b.name === book ? { name, staff: setting.staff.trim(), place: setting.place, refill: setting.refill, fixed: num(setting.fixed), warn: num(setting.warn) } : b)));
    setBook(name);
    setSetting(null);
    toast.show('小口の設定を登録しました');
  };

  // ---- 金銭残高金種別表（確認メモ #212）：日付ごとに紙幣・硬貨の枚数を登録し、帳簿残高と照らす ----
  const denomKey = (d: { era: string; month: string; day: string }) => `${d.era}/${d.month}/${d.day}`;
  const isDenomNy = (d: { era: string; month: string }) => d.era === '9' && ['4', '5', '6'].includes(d.month);
  const toDenomForm = (s: Record<number, number>): Record<number, string> => { const f: Record<number, string> = {}; DENOMS.forEach(([, v]) => { if (s[v]) f[v] = String(s[v]); }); return f; };
  /** 日付を変える。登録済みの日付なら、その枚数を読み込む（未登録の日付なら、いまの入力を残す） */
  /** 日付の切り替え：登録済みの日付ならその枚数を表示。登録済みの表から未登録の日付へ移ったら枚数を空にする（別の日の枚数をそのまま登録しないため）。未登録のまま日付を直したときは入力中の枚数を残す */
  const changeDenomDate = (d: typeof denomDate) => {
    const s = denomSheets[denomKey(d)];
    const from = denomSheets[denomKey(denomDate)];
    setDenomDate(d);
    if (s) setDenomForm(toDenomForm(s));
    else if (from) setDenomForm({});
  };
  const openDenom = () => { const s = denomSheets[denomKey(denomDate)]; setDenomForm(s ? toDenomForm(s) : {}); setDenomOpen(true); };
  const denomCount = (v: number) => parseInt(denomForm[v] ?? '', 10) || 0;
  const denomTotal = DENOMS.reduce((a, [, v]) => a + v * denomCount(v), 0);
  const denomPieces = DENOMS.reduce((a, [, v]) => a + denomCount(v), 0);
  /** 令和8年は 4〜12月、令和9年は 1〜3月と翌年度の予備月 4〜6月 */
  const denomValid = !!parseMD(`${denomDate.month}/${denomDate.day}`) && (denomDate.era === '8' ? !['1', '2', '3'].includes(denomDate.month) : ['1', '2', '3', '4', '5', '6'].includes(denomDate.month));
  /** その日付までの帳簿残高 */
  const denomBook = opening + rows.reduce((a, r) => (!r.special && ordOf(r) <= dateOrd(denomDate.month, denomDate.day, isDenomNy(denomDate)) ? a + r.inAmt - r.outAmt : a), 0);
  const denomSaved = !!denomSheets[denomKey(denomDate)];
  const denomDateText = `令和${denomDate.era}年 ${denomDate.month}月${denomDate.day}日`;
  const denomList = Object.keys(denomSheets)
    .map((k) => { const [era, m, d] = k.split('/'); return { key: k, era, month: m, day: d, total: DENOMS.reduce((a, [, v]) => a + v * (denomSheets[k][v] ?? 0), 0) }; })
    .sort((a, b) => dateOrd(a.month, a.day, isDenomNy(a)) - dateOrd(b.month, b.day, isDenomNy(b)));
  const saveDenom = () => {
    if (!denomValid) return toast.show('日付を正しく入力してください（令和8年4月〜令和9年3月、または翌年度の予備月の令和9年4〜6月）');
    const sheet: Record<number, number> = {};
    DENOMS.forEach(([, v]) => { const n = denomCount(v); if (n) sheet[v] = n; });
    setDenomSheets((ss) => ({ ...ss, [denomKey(denomDate)]: sheet }));
    toast.show(`${denomDateText} の金種別表を登録しました`);
  };
  const printDenom = () => {
    if (!denomValid) return toast.show('日付を正しく入力してください');
    setExportSpec({ kind: 'print', title: '金銭残高金種別表', meta: `${book}　${denomDateText}`, header: ['区分', '金種', '枚数', '金額'], rows: [...DENOMS.map(([k, v]): (string | number)[] => [k, `${yen(v)}円`, denomCount(v), v * denomCount(v)]), ['', '合計', denomPieces, denomTotal], ['', '帳簿残高', '', denomBook], ['', '差額（実際の残高 − 帳簿残高）', '', denomTotal - denomBook]] });
  };
  const deleteDenom = () => setConfirm({ title: '金種別表の削除', body: `${denomDateText} の金種別表を削除します。よろしいですか？`, ok: '削除する', onOk: () => { setDenomSheets((ss) => { const n = { ...ss }; delete n[denomKey(denomDate)]; return n; }); setDenomForm({}); toast.show('金種別表を削除しました'); } });

  /** 集計のチェック：上から順に、押した行までを選ぶ（飛び飛びには選べない。確認メモ #208）。選択の最後の行をもう一度押すと、その行を外す */
  const pickAgg = (id: number) => {
    const idx = aggregable.findIndex((r) => r.id === id);
    setAggSel((s) => new Set(aggregable.slice(0, s.size === idx + 1 && s.has(id) ? idx : idx + 1).map((r) => r.id)));
  };
  const aggregable = withBal.filter((r) => !r.special && !r.aggregated);
  const aggRange = aggregable.filter((r) => aggSel.has(r.id));
  const aggBal = aggRange.length ? withBal.find((r) => r.id === aggRange[aggRange.length - 1].id)!.bal : lastBal;
  /** 集計 ― 確認を開く。伝票年月日の初期値は、選択した範囲の最後の明細の日付 */
  const openAggConfirm = () => {
    const last = aggRange[aggRange.length - 1];
    if (last) setAggDate({ month: last.month, day: last.day });
    setAggMonthEnd(false);
    setAggUseRowDate(false);
    setAggConfirm(true);
  };
  /** 伝票年月日を使うのは、会計連動フォルダへ送る場合で「明細の日付を伝票日付とする」を外しているとき */
  const slipActive = aggLink && !aggUseRowDate;
  const slipDay = aggMonthEnd ? String(lastDayOf(aggDate.month)) : aggDate.day;
  const slipDate = parseMD(`${aggDate.month}/${slipDay}`);
  const runAggregate = () => {
    if (slipActive && !slipDate) return toast.show('伝票年月日の日を正しく入力してください');
    const sd = slipActive && slipDate ? slipDate : undefined;
    setRows((rs) => rs.map((r) => (aggSel.has(r.id) ? { ...r, aggregated: true, slipDate: sd } : r)));
    setAggConfirm(false);
    setAggOpen(false);
    toast.show(`${aggSel.size} 件を集計しました${aggLink ? `（会計連動フォルダへ送信。伝票日付：${sd ? `${sd.replace('/', '月')}日` : '明細の日付'}）` : ''}`);
    setAggSel(new Set());
  };
  const importCsv = () => {
    const imp: Row[] = [
      R('8', '20', '（CSV）ﾌﾘｺﾐ ｼｸﾞﾏﾘｰｽ', '賃借料（事業）', 0, 18216, { imported: true }),
      R('8', '25', '（CSV）ﾌﾘｺﾐ NTT', '通信運搬費', 0, 8936, { imported: true }),
      R('8', '28', '（CSV）ｲﾀｸﾋ ｼﾔｸｼｮ', '委託費収益', 662400, 0, { imported: true }),
    ];
    setRows((rs) => [...rs, ...imp]);
    setCsvOpen(false);
    toast.show(`CSVから ${imp.length} 件を取り込みました（勘定科目は摘要から自動判定・要確認）`);
  };
  const bulkDelete = () => {
    const n = rows.filter((r) => r.imported).length;
    setRows((rs) => rs.filter((r) => !r.imported));
    setBulkOpen(false);
    toast.show(`インポート伝票 ${n} 件を一括削除しました`);
  };

  // ---- 会計連動：集計済み（未連動）の明細を仕訳伝票にする。翌年度の予備月の明細は、翌年度の伝票になるため対象にしない ----
  const cashAccount = isPetty ? '小口現金' : book; // 出納帳の相手科目
  const journalOf = (r: Row) => ({
    date: r.slipDate ?? `${r.month}/${r.day}`,
    kari: r.inAmt ? cashAccount : r.account,
    kashi: r.inAmt ? r.account : cashAccount,
    tekiyo: r.tekiyo,
    amount: r.inAmt || r.outAmt,
  });
  const linkTargets = withBal.filter((r) => !r.special && r.aggregated && !r.linked && !r.ny);
  const linkNyHold = withBal.filter((r) => !r.special && r.aggregated && !r.linked && r.ny).length;
  const openLink = () => {
    if (linkTargets.length === 0) return toast.show('会計連動できる明細がありません（先に「集計」を実行してください）');
    setLinkOpen(true);
  };
  const runLink = () => {
    const service = isPetty ? curPetty?.place ?? '002 保育事業' : '002 保育事業';
    linkTargets.forEach((r) => addVoucher({ kind: '伝票', ...journalOf(r), service, shohyo: false }));
    setRows((rs) => rs.map((r) => (linkTargets.some((t) => t.id === r.id) ? { ...r, linked: true } : r)));
    setLinkOpen(false);
    toast.show(`${linkTargets.length} 件の仕訳伝票を作成しました（仕訳一覧・元帳に反映）`);
  };

  // ---- AI自動仕訳 インポート ----
  const loadAiText = (text: string, name: string) => {
    try {
      const lines = parseAiFile(text, name);
      if (lines.length === 0) return toast.show('取り込める明細がありません（日付・摘要・金額の列を確認してください）');
      setAiLines(lines);
      setAiFileName(name);
    } catch {
      toast.show('ファイルを読み込めませんでした（CSV または JSON 形式）');
    }
  };
  const onAiFile = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => loadAiText(String(rd.result), f.name);
    rd.readAsText(f);
  };
  const importAi = () => {
    const sel = aiLines.filter((l) => l.on);
    if (sel.length === 0) return toast.show('取り込む明細を選択してください');
    setRows((rs) => [...rs, ...sel.map((l) => R(l.month, l.day, l.tekiyo, l.account, l.dir === '入金' ? l.amount : 0, l.dir === '出金' ? l.amount : 0, { imported: true, ai: 'pending', aiConf: l.conf }))]);
    setAiOpen(false);
    setAiLines([]);
    toast.show(`AI自動仕訳から ${sel.length} 件を取り込みました。「AI自動仕訳 会計確認」で承認してください`);
  };
  const aiPending = withBal.filter((r) => r.ai === 'pending');
  const approveAi = (id: number) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ai: 'approved' } : r))); };
  const returnAi = (id: number) => { setRows((rs) => rs.filter((r) => r.id !== id)); toast.show('差戻しました（AI自動仕訳システムへ再判定を依頼）'); };
  const approveAllAi = () => { const n = aiPending.length; setRows((rs) => rs.map((r) => (r.ai === 'pending' ? { ...r, ai: 'approved' } : r))); toast.show(`${n} 件を承認しました`); };

  // ---- 印刷（集計内訳表／仕訳伝票／出納帳） ----
  const openPrint = (label: string) => {
    const period = range ? periodText(range) : month == null ? '令和8年度（全月）' : nyMonth ? `令和9年 ${nyMonth}月（翌年度の予備月）` : month === '決' ? '令和8年度 決算月' : `令和${eraOf({ month })}年 ${month}月`;
    const meta = `${book}　${period}`;
    if (label === '集計内訳表') {
      const agg = view.filter((r) => !r.special && r.aggregated);
      if (agg.length === 0) return toast.show('集計済みの明細がありません（先に「集計」を実行してください）');
      const byAcc = new Map<string, { n: number; inAmt: number; outAmt: number }>();
      agg.forEach((r) => { const c = byAcc.get(r.account) ?? { n: 0, inAmt: 0, outAmt: 0 }; c.n++; c.inAmt += r.inAmt; c.outAmt += r.outAmt; byAcc.set(r.account, c); });
      const rowsOut: (string | number)[][] = Array.from(byAcc.entries()).map(([acc, c]) => [CODE[acc] ?? '', acc, c.n, c.inAmt, c.outAmt]);
      rowsOut.push(['', '合計', agg.length, agg.reduce((a, r) => a + r.inAmt, 0), agg.reduce((a, r) => a + r.outAmt, 0)]);
      setExportSpec({ kind: 'print', title: `集計内訳表（${title}）`, meta, header: ['科目コード', '勘定科目', '件数', '入金額', '出金額'], rows: rowsOut });
      return;
    }
    if (label === '仕訳伝票') {
      const agg = view.filter((r) => !r.special && r.aggregated);
      if (agg.length === 0) return toast.show('集計済みの明細がありません（先に「集計」を実行してください）');
      setExportSpec({ kind: 'print', title: `仕訳伝票（${title}）`, meta, header: ['日付', '借方科目', '貸方科目', '摘要', '金額', '会計連動'], rows: agg.map((r) => { const j = journalOf(r); return [`令和${eraOf({ month: j.date.split('/')[0], ny: r.ny })}年 ${j.date.replace('/', '月')}日`, j.kari, j.kashi, j.tekiyo, j.amount, r.linked ? '連動済' : '未連動']; }) });
      return;
    }
    const body = view.filter((r) => r.special !== '改ページ' && r.special !== '締切線');
    // 消費税を使う設定のときは、勘定科目の後ろに「消費税コード」「税額」の列を足す（確認メモ #216）
    const tx = (a: (string | number)[], b: (string | number)[]) => (taxEntry ? [...a.slice(0, 4), ...b, ...a.slice(4)] : a);
    setExportSpec({ kind: 'print', title, meta: `${meta}　前月繰越 ${yen(opening)}`, header: tx(['入金額', '年月日', '摘要', '勘定科目', '出金額', '残高'], ['消費税コード', '税額']) as string[], rows: [tx([0, '', '前月繰越', '', 0, opening], ['', '']), ...body.map((r): (string | number)[] => (r.special === '小計行' ? tx([monthIn, '', '小計', '', monthOut, r.bal], ['', '']) : tx([r.inAmt, r.special ? '' : dateText(r), r.tekiyo, r.account, r.outAmt, r.special ? '' : r.bal], r.special ? ['', ''] : [`${taxCodeOf(r)} ${taxName(taxCodeOf(r))}`, taxAmtOf(taxCodeOf(r), r.inAmt || r.outAmt)])))] });
  };
  const dateText = (r: { month: string; day: string; ny?: boolean }) => `令和${eraOf(r)}年 ${r.month}月 ${r.day}日`;


  const cell: CSSProperties = { ...TD, padding: '6px 10px', borderRight: '1px solid #eef2f5' };
  const numCell: CSSProperties = { ...NUM, padding: '6px 10px', borderRight: '1px solid #eef2f5' };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  const btn = (primary?: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  // 旧「オプション」バッジ：標準機能になったため表示しない（確認メモ #56）
  const badge = null;
  /** 表の列数（消費税を使う設定のときは「消費税コード」「税額」の 2 列が増える） */
  const cols = 7 + (taxEntry ? 2 : 0);
  const taxCells = () => (taxEntry ? <><td style={cell} /><td style={cell} /></> : null);
  /** 入力行の消費税コード（選んでいなければ、勘定科目と入出金から自動で決める） */
  const entryTax = entry.tax || (entry.account ? defaultTax(entry.account, num(entry.inAmt) > 0) : '');
  const rowBtn = (label: string, onClick: () => void, o: { off?: boolean; danger?: boolean; title: string }) => (
    <button type="button" className="btn-outline" onClick={onClick} title={o.title} style={{ padding: '3px 7px', border: '1px solid #d3dbe3', borderRadius: 6, background: '#fff', color: o.off ? '#c3ccd4' : o.danger ? '#c0392b' : '#3d4a57', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );
  /** 行の右の操作（確認メモ #206／#207／#209）。小口現金：挿入・特殊行・編集・削除。預金出納：削除。
   *  集計済みの行と、それより前の位置では使えない（押すと理由を表示する） */
  const rowOps = (r: Row) => {
    const canIns = canInsertAt(r.id);
    const locked = !!r.aggregated || (!!r.special && !canIns);
    const line = !!r.special && r.special !== '摘要行'; // 小計行・改ページ・締切線は削除だけ
    return (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        {isPetty && !line && rowBtn('挿入', () => openInsert(r), { off: !canIns, title: canIns ? 'この行の上に明細を 1 行挿入します' : '集計済みの明細より前には、行を挿入できません' })}
        {isPetty && !line && rowBtn('特殊行', () => openSpecial(r), { off: !canIns, title: canIns ? 'この行の上に特殊行（小計行・改ページ・締切線・摘要行）を挿入します' : '集計済みの明細より前には、行を挿入できません' })}
        {isPetty && !line && rowBtn('編集', () => openEdit(r), { off: locked, title: locked ? '集計済みの明細は訂正できません' : 'この行を訂正します' })}
        {rowBtn('削除', () => askDelete(r), { off: locked, danger: true, title: locked ? '集計済みの明細は削除できません' : '行の削除' })}
      </div>
    );
  };

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      badge={badge}
      org={`チャイルド保育園　${book}`}
      subtitle={isPetty ? '小口現金の入出金を出納帳形式で記帳し、集計して会計へ連動します。' : '預金口座ごとの入出金を出納帳形式で記帳し、集計して会計へ連動します。銀行CSVの取込ができます。'}
      extraTools={<ScreenPrintMenu accent={accent} actions={[
        { label: '印刷および印刷プレビュー', items: ['集計内訳表', '仕訳伝票', isPetty ? '小口現金出納帳' : '預金出納帳'].map((l) => ({ name: l, onClick: () => openPrint(l) })) },
        ...(isPetty ? [{ label: '残高の確認', items: [{ name: '金銭残高金種別表', note: '日付ごとに紙幣・硬貨の枚数を入力', onClick: openDenom }] }] : []),
      ]} />}
      tools={[
        { label: '会計連動', onClick: openLink },
        { label: isPetty ? '小口区分の切替' : '区分の切替', onClick: openSwitch },
        ...(isPetty ? [{ label: '小口の設定', onClick: openSetting, title: 'この出納帳の名称・担当者・定額・残高の下限などを設定します' }] : []),
        { label: '集計', onClick: () => setAggOpen(true), primary: true },
      ]}
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={LABEL}>会計月</span>
          <FiscalMonthTabs
            current={month}
            accent={accent}
            onSelect={selectMonth}
            withAll
            range={range}
            onRange={setRange}
            after={isPetty ? (
              <span title="翌年度（令和9年度）の 4〜6月。年度をまたいで明細を入力できます" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4, padding: '2px 6px 2px 8px', border: '1px dashed #b98a2e', borderRadius: 8, background: '#fffaf0' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6516' }}>翌年度</span>
                {['4', '5', '6'].map((m) => {
                  const on = nyMonth === m;
                  return (
                    <button key={m} type="button" className="chip" onClick={() => selectNy(m)} aria-label={`翌年度 ${m}月`} title={`翌年度（令和9年）${m}月の予備月`} style={{ minWidth: 34, height: 26, padding: '0 10px', borderRadius: 6, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? '#b98a2e' : '#fff', color: on ? '#fff' : '#8a6516', border: '1px solid ' + (on ? '#b98a2e' : '#e0c98f') }}>{m}</button>
                  );
                })}
              </span>
            ) : undefined}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isPetty ? (
              <>
                <button type="button" className="btn-outline" onClick={() => { setAiLines([]); setAiFileName(''); setAiOpen(true); }} style={btn()}>AI自動仕訳 インポート</button>
                <button type="button" className="btn-outline" onClick={() => setAiConfirmOpen(true)} style={{ ...btn(), position: 'relative' }}>
                  AI自動仕訳 会計確認
                  {aiPending.length > 0 && <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#c0392b', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{aiPending.length}</span>}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-outline" onClick={() => setCsvOpen(true)} style={btn()}>銀行CSV インポート</button>
                <button type="button" className="btn-outline" onClick={() => setBulkOpen(true)} style={btn()}>インポート一括削除</button>
              </>
            )}
          </div>
        </div>
      }
    >
      <ToastView msg={toast.msg} />

      {/* 残高サマリー */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 22px', borderBottom: '1px solid #eef2f5', fontSize: 14, color: '#5b6773', flexWrap: 'wrap' }}>
        <span>前月繰越 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(opening)}</b></span>
        <span>当月入金 <b style={{ color: '#2c5f9e', fontVariantNumeric: 'tabular-nums' }}>{yen(monthIn)}</b></span>
        <span>当月出金 <b style={{ color: '#b0426a', fontVariantNumeric: 'tabular-nums' }}>{yen(monthOut)}</b></span>
        <span>現在残高 <b style={{ color: '#22303c', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{yen(lastBal)}</b></span>
        {isPetty && curPetty && lastBal < curPetty.warn && (
          <span title="「小口の設定」の「残高の下限」を下回っています" style={{ padding: '2px 10px', borderRadius: 10, background: '#fdeee9', color: '#c0392b', fontWeight: 700 }}>残高が下限（{yen(curPetty.warn)}円）を下回っています。{curPetty.refill} から補充してください</span>
        )}
        {nyMonth && <span style={{ padding: '2px 10px', borderRadius: 10, background: '#fffaf0', border: '1px dashed #b98a2e', color: '#8a6516', fontWeight: 700 }}>翌年度（令和9年）{nyMonth}月の予備月を表示中</span>}
        <span style={{ marginLeft: 'auto', color: '#9aa5b1' }}>黄色＝集計済み（訂正不可）／青＝{isPetty ? 'AI取込（承認済）／紫＝AI取込（承認待ち）' : 'CSV取込'}</span>
      </div>

      {/* 出納帳 */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'right', width: taxEntry ? 100 : 120 }}>入金額</th>
              <th style={{ ...TH, width: 160 }}>年月日</th>
              <th style={TH}>摘要</th>
              <th style={{ ...TH, width: taxEntry ? 190 : 220 }}>勘定科目</th>
              {taxEntry && <th style={{ ...TH, width: 138 }}>消費税コード</th>}
              {taxEntry && <th style={{ ...TH, textAlign: 'right', width: 78 }}>税額</th>}
              <th style={{ ...TH, textAlign: 'right', width: taxEntry ? 100 : 120 }}>出金額</th>
              <th style={{ ...TH, textAlign: 'right', width: taxEntry ? 112 : 130 }}>残高</th>
              <th style={{ ...TH, width: isPetty ? 204 : 70 }} />
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f8fafc' }}>
              <td style={cell} /><td style={cell} /><td style={{ ...cell, color: '#7a8794', fontWeight: 700 }}>前月繰越</td><td style={cell} />{taxCells()}<td style={cell} /><td style={{ ...numCell, fontWeight: 700 }}>{yen(opening)}</td><td style={TD} />
            </tr>
            {view.map((r) => {
              if (r.special === '締切線') return <tr key={r.id}><td colSpan={cols - 1} style={{ padding: 0 }}><div style={{ borderBottom: '3px double #22303c' }} /></td><td style={{ padding: '2px 8px' }}>{rowOps(r)}</td></tr>;
              if (r.special === '改ページ') return <tr key={r.id}><td colSpan={cols - 1} style={{ padding: '3px 10px', fontSize: 12, color: '#9aa5b1', textAlign: 'center', background: 'repeating-linear-gradient(90deg,#e6ecf1 0 6px,transparent 6px 12px) center/100% 1px no-repeat' }}>— 改ページ —</td><td style={{ padding: '2px 8px' }}>{rowOps(r)}</td></tr>;
              if (r.special === '小計行') return <tr key={r.id} style={{ background: '#f3f6f9' }}><td style={numCell}>{yen(monthIn)}</td><td style={cell} /><td style={{ ...cell, fontWeight: 700 }}>小計</td><td style={cell} />{taxCells()}<td style={numCell}>{yen(monthOut)}</td><td style={{ ...numCell, fontWeight: 700 }}>{yen(r.bal)}</td><td style={{ ...TD, padding: '4px 8px' }}>{rowOps(r)}</td></tr>;
              const bg = r.aggregated ? '#fff8c4' : r.ai === 'pending' ? '#f3e8ff' : r.imported ? '#eaf2fb' : 'transparent';
              const tc = taxCodeOf(r);
              return (
                <tr key={r.id} style={{ background: bg }}>
                  <td style={{ ...numCell, color: '#2c5f9e' }}>{r.inAmt ? yen(r.inAmt) : ''}</td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {r.special === '摘要行' ? '' : dateText(r)}
                    {r.ny && !r.special && <span title="翌年度（令和9年度）の予備月の明細" style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: '#8a6516', background: '#fdf1d4', borderRadius: 5, padding: '1px 5px' }}>翌年度</span>}
                  </td>
                  <td style={cell}>{r.tekiyo}</td>
                  <td style={cell}>
                    {r.code && <span style={{ color: '#9aa5b1', fontSize: 12, marginRight: 6 }}>{r.code}</span>}{r.account}
                    {r.ai === 'pending' && <span title={`AI推定（信頼度 ${r.aiConf ?? '-'}%）承認待ち`} style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: '#6b3fb5', background: '#efe6fb', borderRadius: 5, padding: '1px 5px' }}>AI {r.aiConf}%</span>}
                    {r.linked && <span title="会計連動済み（仕訳伝票を作成済み）" style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: '#1f7a52', background: '#eaf5ef', borderRadius: 5, padding: '1px 5px' }}>連動済</span>}
                  </td>
                  {taxEntry && (r.special ? taxCells() : (
                    <>
                      <td style={{ ...cell, padding: '4px 6px' }}>
                        {r.aggregated
                          ? <span style={{ fontSize: 14 }}><span style={{ color: '#9aa5b1', fontSize: 12, marginRight: 4 }}>{tc}</span>{taxName(tc)}</span>
                          : <select aria-label="消費税コード" value={tc} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, tax: e.target.value } : x)))} style={{ ...inp, padding: '4px 4px', fontSize: 14 }}>{TAX_CODES.map((t) => <option key={t.code} value={t.code}>{t.code} {t.name}</option>)}</select>}
                      </td>
                      <td style={numCell}>{yen(taxAmtOf(tc, r.inAmt || r.outAmt))}</td>
                    </>
                  ))}
                  <td style={{ ...numCell, color: '#b0426a' }}>{r.outAmt ? yen(r.outAmt) : ''}</td>
                  <td style={{ ...numCell, fontWeight: 700 }}>{r.special ? '' : yen(r.bal)}</td>
                  <td style={{ ...TD, padding: '4px 8px' }}>{rowOps(r)}</td>
                </tr>
              );
            })}
            {/* 入力行 */}
            <tr style={{ background: '#fbfcfd', borderTop: `2px solid ${accent}` }}>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-in" className="field-input ring" value={entry.inAmt} onChange={(e) => setEntry({ ...entry, inAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId('cb-day'))} inputMode="numeric" placeholder="入金" style={{ ...inp, textAlign: 'right' }} /></td>
              <td style={{ ...cell, padding: '8px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: nyMonth ? '#8a6516' : '#5b6773', whiteSpace: 'nowrap' }}>
                  <span title={nyMonth ? '翌年度の予備月（令和9年）の明細として登録します' : undefined}>令和{nyMonth ? 9 : eraOf({ month: entry.month })}</span>
                  <input className="field-input" aria-label="月" value={nyMonth ?? entry.month} readOnly={!!nyMonth} onChange={(e) => setEntry({ ...entry, month: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} inputMode="numeric" title={nyMonth ? '翌年度の予備月を表示中は、月を変えられません（月のボタンで切り替えます）' : undefined} style={{ ...inp, width: 34, padding: '6px 2px', textAlign: 'center', background: nyMonth ? '#fffaf0' : '#fff' }} />
                  <input id="cb-day" className="field-input" aria-label="日" value={entry.day} onChange={(e) => setEntry({ ...entry, day: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('cb-tekiyo'))} inputMode="numeric" placeholder="日" style={{ ...inp, width: 34, padding: '6px 2px', textAlign: 'center' }} />
                </div>
              </td>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-tekiyo" className="field-input ring" value={entry.tekiyo} onChange={(e) => setEntry({ ...entry, tekiyo: e.target.value })} onKeyDown={onEnter(() => focusId('cb-acc'))} placeholder="摘要" autoComplete="off" style={inp} /></td>
              <td style={{ ...cell, padding: '8px 8px' }}>
                <AssistField buttonId="cb-acc" value={entry.account} placeholder="勘定科目検索" open={assist.isOpen('acc')} onOpen={() => assist.open('acc', 'account')} accent={accent} accentRgb={accentRgb} buttonStyle={fieldBtn} panelStyle={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }} groups={assist.groups} query={assist.query} empty={assist.empty} onInput={assist.setQuery} onPick={(v) => { setEntry((en) => ({ ...en, account: v })); assist.close(); focusId('cb-out'); }} />
              </td>
              {taxEntry && (
                <>
                  <td style={{ ...cell, padding: '8px 6px' }}>
                    <select aria-label="消費税コード（入力行）" value={entryTax} onChange={(e) => setEntry({ ...entry, tax: e.target.value })} title="勘定科目から自動で決まります。変える場合だけ選びます" style={{ ...inp, padding: '6px 4px' }}>
                      <option value="">（科目から自動）</option>
                      {TAX_CODES.map((t) => <option key={t.code} value={t.code}>{t.code} {t.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...numCell, color: '#5b6773' }}>{entryTax ? yen(taxAmtOf(entryTax, num(entry.inAmt) || num(entry.outAmt))) : ''}</td>
                </>
              )}
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-out" className="field-input ring" value={entry.outAmt} onChange={(e) => setEntry({ ...entry, outAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(add)} inputMode="numeric" placeholder="出金" style={{ ...inp, textAlign: 'right' }} /></td>
              <td style={{ ...numCell, color: '#9aa5b1', fontSize: 12 }}>自動計算</td>
              <td style={{ ...TD, padding: '8px 8px', textAlign: 'right' }}><button type="button" className="submit-btn" onClick={add} style={{ ...btn(true), padding: '7px 12px', fontSize: 14 }}>登録</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- 特殊行の挿入（行の右の「特殊行」から。選択した行の上に挿入する。確認メモ #209） ---- */}
      <Modal open={specialTarget != null} onClose={() => setSpecialTarget(null)} width={440} title="特殊行の挿入">
        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>選択した行の上へ挿入する特殊行を選択してください</div>
          {specialRow && <div style={{ fontSize: 14, color: '#5b6773', background: '#f6f8fa', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>選択した行：{specialRow.special ? `${specialRow.special}${specialRow.tekiyo ? `「${specialRow.tekiyo}」` : ''}` : `${dateText(specialRow)}　${specialRow.tekiyo}　${yen(specialRow.inAmt || specialRow.outAmt)}円`}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['小計行', '改ページ', '締切線'] as const).map((k) => <button key={k} type="button" className="btn-outline" onClick={() => insertSpecial(k)} style={btn()}>{k}</button>)}
          </div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" className="btn-outline" onClick={() => insertSpecial('摘要行')} style={btn()}>摘要行</button>
            <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={specialOpts.date} onChange={() => setSpecialOpts({ ...specialOpts, date: !specialOpts.date })} />年月日欄を表示</label>
            <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={specialOpts.balance} onChange={() => setSpecialOpts({ ...specialOpts, balance: !specialOpts.balance })} />残高欄を表示</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" onClick={() => setSpecialTarget(null)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 集計：明細選択 ---- */}
      <Modal open={aggOpen && !aggConfirm} onClose={() => setAggOpen(false)} width={860} title="集計">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>上から順に、どこまで集計するかを選びます。集計する最後の行を押してください（その行より上の明細がすべて選ばれます）。<span style={{ fontSize: 14, color: '#7a8794', marginLeft: 8 }}>（選択 {aggSel.size} 件）</span></div>
          <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 36 }} /><th style={{ ...TH, textAlign: 'right' }}>入金額</th><th style={TH}>年月日</th><th style={TH}>摘要</th><th style={TH}>勘定科目</th><th style={{ ...TH, textAlign: 'right' }}>出金額</th><th style={{ ...TH, textAlign: 'right' }}>残高</th></tr></thead>
              <tbody>
                {aggregable.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>集計できる明細がありません。</td></tr>}
                {aggregable.map((r) => {
                  const on = aggSel.has(r.id);
                  return (
                    <tr key={r.id} onClick={() => pickAgg(r.id)} title="この行までを集計の対象にします（最後の行をもう一度押すと、その行を外します）" style={{ background: on ? '#fff8c4' : 'transparent', cursor: 'pointer' }}>
                      <td style={TD}><input type="checkbox" checked={on} readOnly aria-label={`${r.month}月${r.day}日 ${r.tekiyo} までを集計する`} /></td>
                      <td style={NUM}>{r.inAmt ? yen(r.inAmt) : ''}</td><td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.month}/{r.day}{r.ny && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: '#8a6516', background: '#fdf1d4', borderRadius: 5, padding: '1px 5px' }}>翌年度</span>}</td><td style={TD}>{r.tekiyo}</td><td style={TD}>{r.account}</td><td style={NUM}>{r.outAmt ? yen(r.outAmt) : ''}</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(r.bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn-outline" onClick={() => setAggSel(new Set(aggregable.map((r) => r.id)))} style={btn()}>すべて選択</button>
            <button type="button" className="btn-outline" onClick={() => setAggSel(new Set())} style={btn()}>選択を外す</button>
            <span data-tip={aggSel.size === 0 ? '集計する明細にチェックを入れると押せます' : undefined} style={{ display: 'inline-flex' }}><button type="button" className="submit-btn" disabled={aggSel.size === 0} onClick={openAggConfirm} style={{ ...btn(true), opacity: aggSel.size ? 1 : 0.5 }}>OK</button></span>
            <button type="button" onClick={() => setAggOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 集計：確認 ---- */}
      <Modal open={aggConfirm} onClose={() => setAggConfirm(false)} width={620} title="集計 ― 確認">
        <div style={{ padding: '18px 22px 20px', fontSize: 14, lineHeight: 1.7 }}>
          <div>選択された明細は…</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 14px', margin: '8px 0 12px', background: '#fbfcfd' }}>
            {aggRange.length > 0 && (
              <>
                <div>令和{eraOf(aggRange[0])}年 {aggRange[0].month}月{aggRange[0].day}日　{aggRange[0].account}　{yen(aggRange[0].inAmt || aggRange[0].outAmt)}円 〜</div>
                <div style={{ textAlign: 'right' }}>令和{eraOf(aggRange[aggRange.length - 1])}年 {aggRange[aggRange.length - 1].month}月{aggRange[aggRange.length - 1].day}日{aggRange[aggRange.length - 1].account}　{yen(aggRange[aggRange.length - 1].inAmt || aggRange[aggRange.length - 1].outAmt)}円 迄</div>
              </>
            )}
          </div>
          <div style={{ fontWeight: 700 }}>この時点での残高は　<span style={{ fontSize: 16 }}>{yen(aggBal)}円</span>になります。</div>
          <div style={{ marginTop: 8 }}>集計を開始してもよろしいですか？</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 14 }}><input type="checkbox" checked={aggLink} onChange={() => setAggLink(!aggLink)} />集計したら会計連動フォルダへこの伝票情報を送る</label>
          {/* 伝票日付の指定（確認メモ #164）：会計連動フォルダへ送るときだけ指定できる */}
          <div style={{ display: 'grid', gap: 6, margin: '6px 0 0 22px', fontSize: 14 }} data-agg-slip-date>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: aggLink ? 1 : 0.5 }}><input type="checkbox" checked={aggUseRowDate} disabled={!aggLink} onChange={() => setAggUseRowDate(!aggUseRowDate)} />明細の日付を伝票日付とする</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', opacity: slipActive ? 1 : 0.5 }}>
              <span>伝票年月日：</span>
              <span>令和{['1', '2', '3'].includes(aggDate.month) ? 9 : 8}年</span>
              <select aria-label="伝票年月日の月" value={aggDate.month} disabled={!slipActive} onChange={(e) => setAggDate({ ...aggDate, month: e.target.value })} style={{ ...inp, width: 64, padding: '4px 6px' }}>{FISCAL_MONTHS.filter((m) => m !== '決').map((m) => <option key={m}>{m}</option>)}</select><span>月</span>
              <input aria-label="伝票年月日の日" inputMode="numeric" value={slipDay} disabled={!slipActive || aggMonthEnd} maxLength={2} onChange={(e) => setAggDate({ ...aggDate, day: e.target.value })} style={{ ...inp, width: 52, padding: '4px 6px', textAlign: 'right', background: !slipActive || aggMonthEnd ? '#f3f6f9' : '#fff' }} /><span>日</span>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 10 }}><input type="checkbox" checked={aggMonthEnd} disabled={!slipActive} onChange={() => setAggMonthEnd(!aggMonthEnd)} />月末日</label>
            </div>
            <div style={{ fontSize: 12, color: '#7a8794' }}>「月末日」にチェックすると、伝票の日付をその月の末日にします。「明細の日付を伝票日付とする」にチェックすると、明細ごとの日付で伝票を作ります。</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={runAggregate} style={btn(true)}>OK</button>
            <button type="button" onClick={() => setAggConfirm(false)} style={btn()}>キャンセル</button>
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#f3f6f9', borderRadius: 10, fontSize: 14, color: '#48565f' }}>
            集計された明細に対しては以下の操作が出来なくなります。<br />①日付・金額・科目・摘要など、明細内容の訂正　②前期繰越の金額訂正　③行の挿入　④行の削除<br />※一度集計した明細に対して修正を行う場合は『集計取消』を実行してから行ってください。
          </div>
        </div>
      </Modal>

      {/* ---- 預金出納：銀行CSV取込 ---- */}
      <Modal open={csvOpen} onClose={() => setCsvOpen(false)} width={560} title="CSVファイルの取り込み">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ fontSize: 14, color: '#5b6773', marginBottom: 10 }}>システム年度：令和8年（2026年）　対象口座：{book}</div>
          <div onClick={importCsv} style={{ border: '3px dashed #e0b400', background: '#fff9c4', borderRadius: 12, padding: '46px 20px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22303c' }}>CSVファイルをドロップしてください。</div>
            <div style={{ fontSize: 14, color: '#7a8794', marginTop: 6 }}>（プロトタイプ：クリックするとサンプル3件を取り込みます）</div>
            <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); importCsv(); }} style={{ ...btn(), marginTop: 18 }}>CSVファイルを指定する</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><button type="button" onClick={() => setCsvOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 預金出納：インポート一括削除 ---- */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} width={560} title="インポート伝票一括削除">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 160, maxHeight: 260, overflow: 'auto' }}>
            <div style={{ padding: '8px 12px', background: '#f6f8fa', fontSize: 12, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>コメント（取込単位）</div>
            {rows.some((r) => r.imported) ? (
              <div onDoubleClick={(e) => { if (e.shiftKey) bulkDelete(); else toast.show('[Shift] キーを押しながらダブルクリックしてください'); }} title="Shift + ダブルクリックで一括削除" style={{ padding: '10px 12px', fontSize: 14, cursor: 'pointer' }}>
                銀行CSV取込　{rows.filter((r) => r.imported).length} 件　（{book}）
              </div>
            ) : (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>インポートされた伝票はありません。</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12, fontSize: 14, color: '#48565f', lineHeight: 1.7 }}>
            <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>i</span>
            <span>一括削除は大変危険な操作です。この為削除をするには、[Shift]キーを押しながら、コメント行をダブルクリックすると一括削除を継続する様になっております。</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><button type="button" onClick={() => setBulkOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>

      {/* ---- 区分の切替（小口現金・預金出納の共通）。出納帳の追加は、この画面の中の「＋出納帳追加」で行う（確認メモ #211／#215） ---- */}
      <Modal open={switchOpen} onClose={() => setSwitchOpen(false)} width={520} title={isPetty ? '小口区分の切替' : '区分の切替'}>
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 14, color: '#5b6773', marginBottom: 10 }}>{isPetty ? '開く小口現金の区分（担当）を選択してください。区分ごとに出納帳・繰越残高を分けて管理します。' : '開く預金出納帳（預金科目）を選択してください。預金科目ごとに出納帳・繰越残高を分けて管理します。'}</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 260 }}>
            {(isPetty ? pettyBooks : bankBooks.map((n) => ({ name: n, staff: '', place: '' }))).map((b) => (
              <label key={b.name} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 14, cursor: 'pointer', background: switchPick === b.name ? '#fff8c4' : '#fff' }}>
                <input type="radio" name="cashbook-switch" checked={switchPick === b.name} onChange={() => setSwitchPick(b.name)} />
                <span style={{ flex: 1, fontWeight: 600 }}>{b.name}{b.name === book && <span style={{ marginLeft: 8, fontSize: 12, color: '#1f7a52', fontWeight: 700 }}>表示中</span>}</span>
                {isPetty && <span style={{ fontSize: 14, color: '#7a8794' }}>担当：{b.staff}</span>}
                {isPetty && <span style={{ fontSize: 12, color: '#9aa5b1' }}>{b.place}</span>}
              </label>
            ))}
          </div>
          {addBook == null ? (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn-outline" onClick={() => { setAddBook(isPetty ? { name: '', staff: '', place: PETTY_PLACES[1] } : { name: bankCandidates[0] ?? '', staff: '', place: '' }); focusId('ab-name'); }} style={{ ...btn(), color: accent, borderColor: accent }}>＋出納帳追加</button>
            </div>
          ) : (
            <div data-add-book style={{ marginTop: 10, border: `1px solid ${accent}`, borderRadius: 10, padding: '12px 14px', background: '#fbfcfd' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>出納帳の追加</div>
              {isPetty ? (
                <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: '8px 10px', alignItems: 'center', fontSize: 14 }}>
                  <label htmlFor="ab-name">名称</label>
                  <input id="ab-name" className="field-input ring" value={addBook.name} onChange={(e) => setAddBook({ ...addBook, name: e.target.value })} onKeyDown={onEnter(() => focusId('ab-staff'))} placeholder="例：小口現金（分園）" autoComplete="off" style={inp} />
                  <label htmlFor="ab-staff">担当者</label>
                  <input id="ab-staff" className="field-input ring" value={addBook.staff} onChange={(e) => setAddBook({ ...addBook, staff: e.target.value })} onKeyDown={onEnter(() => focusId('ab-place'))} autoComplete="off" style={inp} />
                  <label htmlFor="ab-place">区分</label>
                  <select id="ab-place" value={addBook.place} onChange={(e) => setAddBook({ ...addBook, place: e.target.value })} style={inp}>{PETTY_PLACES.map((p) => <option key={p}>{p}</option>)}</select>
                </div>
              ) : bankCandidates.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: '8px 10px', alignItems: 'center', fontSize: 14 }}>
                  <label htmlFor="ab-name">預金科目</label>
                  <select id="ab-name" value={addBook.name} onChange={(e) => setAddBook({ ...addBook, name: e.target.value })} style={inp}>{bankCandidates.map((a) => <option key={a}>{a}</option>)}</select>
                  <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#7a8794', lineHeight: 1.6 }}>※ 使用しないとして設定されている科目は選択できません。ご使用になられる場合は、使用科目へ設定を変更してください。</div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#7a8794' }}>追加できる預金科目はありません（すべての預金科目に出納帳があります）。</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                {(isPetty || bankCandidates.length > 0) && <button type="button" className="submit-btn" onClick={commitAddBook} style={{ ...btn(true), padding: '6px 14px' }}>追加</button>}
                <button type="button" onClick={() => setAddBook(null)} style={{ ...btn(), padding: '6px 14px' }}>追加をやめる</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={() => { setBook(switchPick); setSwitchOpen(false); setAddBook(null); toast.show(`${switchPick} の出納帳に切り替えました`); }} style={btn(true)}>OK</button>
            <button type="button" onClick={() => { setSwitchOpen(false); setAddBook(null); }} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 会計連動：確認 ---- */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} width={860} title="会計連動 ― 作成する仕訳伝票の確認">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>集計済みの明細 <b>{linkTargets.length} 件</b> を、次の仕訳伝票として会計システムへ送ります。相手科目は <b>{cashAccount}</b> です。</div>
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>日付</th><th style={TH}>借方科目</th><th style={TH}>貸方科目</th><th style={TH}>摘要</th><th style={{ ...TH, textAlign: 'right' }}>金額</th></tr></thead>
              <tbody>
                {linkTargets.map((r) => { const j = journalOf(r); return (
                  <tr key={r.id}><td style={{ ...TD, whiteSpace: 'nowrap' }}>令和{eraOf({ month: j.date.split('/')[0] })}年 {j.date.replace('/', '月')}日</td><td style={TD}>{j.kari}</td><td style={TD}>{j.kashi}</td><td style={TD}>{j.tekiyo}</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(j.amount)}</td></tr>
                ); })}
                <tr style={{ background: '#f6f8fa' }}><td colSpan={4} style={{ ...TD, fontWeight: 700, textAlign: 'right' }}>合計</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(linkTargets.reduce((a, r) => a + (r.inAmt || r.outAmt), 0))}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, padding: '10px 14px', background: '#f3f6f9', borderRadius: 10, fontSize: 14, color: '#48565f', lineHeight: 1.7 }}>伝票は「伝票」区分・証憑なしで登録され、仕訳一覧・勘定元帳に反映されます。連動済みの明細は二重に送られません。</div>
          {linkNyHold > 0 && <div data-link-ny style={{ marginTop: 8, padding: '8px 14px', background: '#fffaf0', border: '1px dashed #b98a2e', borderRadius: 10, fontSize: 14, color: '#7a5a14', lineHeight: 1.7 }}>翌年度の予備月（令和9年 4〜6月）の明細 {linkNyHold} 件は、翌年度の伝票になるため、ここでは送りません。</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={runLink} style={btn(true)}>OK（{linkTargets.length} 件を送る）</button>
            <button type="button" onClick={() => setLinkOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- AI自動仕訳 インポート ---- */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} width={900} title="AI自動仕訳システムからのインポート">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 14, color: '#5b6773', marginBottom: 10 }}>対象：{book}　　AI自動仕訳システムが出力した明細ファイル（CSV：日付,摘要,金額[,入金/出金]　または JSON）を読み込み、推定科目を確認してから取り込みます。</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={aiFile} type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => onAiFile(e.target.files?.[0])} style={{ display: 'none' }} />
            <button type="button" className="btn-outline" onClick={() => { if (aiFile.current) { aiFile.current.value = ''; aiFile.current.click(); } }} style={btn()}>ファイルを選択（.csv／.json）</button>
            <button type="button" className="btn-outline" onClick={() => loadAiText(AI_SAMPLE_CSV, 'sample_ai_journal.csv')} style={btn()}>サンプルを読み込む</button>
            {aiFileName && <span style={{ fontSize: 14, color: '#48565f' }}>読込：<b>{aiFileName}</b>（{aiLines.length} 件）</span>}
          </div>
          {aiLines.length > 0 ? (
            <div style={{ marginTop: 12, maxHeight: 360, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 36 }}><input type="checkbox" checked={aiLines.every((l) => l.on)} onChange={(e) => setAiLines(aiLines.map((l) => ({ ...l, on: e.target.checked })))} /></th><th style={TH}>日付</th><th style={TH}>摘要</th><th style={{ ...TH, textAlign: 'right' }}>金額</th><th style={TH}>入出金</th><th style={TH}>推定科目</th><th style={{ ...TH, textAlign: 'right' }}>信頼度</th></tr></thead>
                <tbody>
                  {aiLines.map((l) => (
                    <tr key={l.id} style={{ opacity: l.on ? 1 : 0.45 }}>
                      <td style={TD}><input type="checkbox" checked={l.on} onChange={() => setAiLines(aiLines.map((x) => (x.id === l.id ? { ...x, on: !x.on } : x)))} /></td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{l.month}/{l.day}</td>
                      <td style={TD}>{l.tekiyo}</td>
                      <td style={{ ...NUM, fontWeight: 700 }}>{yen(l.amount)}</td>
                      <td style={TD}><span style={{ color: l.dir === '入金' ? '#2c5f9e' : '#b0426a', fontWeight: 700 }}>{l.dir}</span></td>
                      <td style={TD}>
                        <select value={l.account} onChange={(e) => setAiLines(aiLines.map((x) => (x.id === l.id ? { ...x, account: e.target.value, conf: 100 } : x)))} style={{ ...inp, width: 200 }}>
                          {(CASHBOOK_ACCOUNTS.includes(l.account) ? CASHBOOK_ACCOUNTS : [l.account, ...CASHBOOK_ACCOUNTS]).map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      <td style={NUM}>
                        <span style={{ display: 'inline-block', minWidth: 46, padding: '2px 6px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: l.conf >= 80 ? '#eaf5ef' : l.conf >= 60 ? '#fff1b8' : '#fdeee9', color: l.conf >= 80 ? '#1f7a52' : l.conf >= 60 ? '#8a6d00' : '#c0392b' }}>{l.conf}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: 12, border: '2px dashed #cfd8e0', borderRadius: 12, padding: '36px 20px', textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>ファイルを選択するか「サンプルを読み込む」を押すと、ここに明細のプレビューが表示されます。</div>
          )}
          <div style={{ marginTop: 10, fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>信頼度が低い行は推定科目を選び直せます。取り込んだ明細は「承認待ち」となり、「AI自動仕訳 会計確認」で承認すると通常の明細として集計できます。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <span data-tip={aiLines.some((l) => l.on) ? undefined : '取り込む行にチェックを入れると押せます'} style={{ display: 'inline-flex' }}><button type="button" className="submit-btn" disabled={aiLines.filter((l) => l.on).length === 0} onClick={importAi} style={{ ...btn(true), opacity: aiLines.some((l) => l.on) ? 1 : 0.5 }}>取り込む（{aiLines.filter((l) => l.on).length} 件）</button></span>
            <button type="button" onClick={() => setAiOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- AI自動仕訳 会計確認 ---- */}
      <Modal open={aiConfirmOpen} onClose={() => setAiConfirmOpen(false)} width={900} title="AI自動仕訳 会計確認 ― 承認待ちの明細">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 14, color: '#5b6773', marginBottom: 10 }}>AI自動仕訳から取り込んだ明細の科目・金額を確認し、承認または差戻しを行います。承認した明細は出納帳の通常明細として集計・会計連動の対象になります。</div>
          <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>日付</th><th style={TH}>摘要</th><th style={TH}>勘定科目（AI推定）</th><th style={{ ...TH, textAlign: 'right' }}>入金</th><th style={{ ...TH, textAlign: 'right' }}>出金</th><th style={{ ...TH, textAlign: 'right' }}>信頼度</th><th style={{ ...TH, width: 150 }} /></tr></thead>
              <tbody>
                {aiPending.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>承認待ちの明細はありません。</td></tr>}
                {aiPending.map((r) => (
                  <tr key={r.id} style={{ background: '#fdfaff' }}>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>令和8年 {r.month}月{r.day}日</td>
                    <td style={TD}>{r.tekiyo}</td>
                    <td style={TD}>
                      <select value={r.account} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, account: e.target.value, code: CODE[e.target.value] ?? '', aiConf: 100 } : x)))} style={{ ...inp, width: 200 }}>
                        {(CASHBOOK_ACCOUNTS.includes(r.account) ? CASHBOOK_ACCOUNTS : [r.account, ...CASHBOOK_ACCOUNTS]).map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td style={{ ...NUM, color: '#2c5f9e' }}>{r.inAmt ? yen(r.inAmt) : ''}</td>
                    <td style={{ ...NUM, color: '#b0426a' }}>{r.outAmt ? yen(r.outAmt) : ''}</td>
                    <td style={NUM}><span style={{ fontWeight: 800, color: (r.aiConf ?? 0) >= 80 ? '#1f7a52' : (r.aiConf ?? 0) >= 60 ? '#8a6d00' : '#c0392b' }}>{r.aiConf}%</span></td>
                    <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="submit-btn" onClick={() => approveAi(r.id)} style={{ ...btn(true), padding: '5px 10px', fontSize: 14, marginRight: 4 }}>承認</button>
                      <button type="button" className="btn-outline" onClick={() => returnAi(r.id)} style={{ ...btn(), padding: '5px 10px', fontSize: 14, color: '#c0392b' }}>差戻し</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            {aiPending.length > 0 && <button type="button" className="btn-outline" onClick={approveAllAi} style={{ ...btn(), marginRight: 'auto' }}>すべて承認（{aiPending.length} 件）</button>}
            <button type="button" onClick={() => setAiConfirmOpen(false)} style={btn()}>閉じる</button>
          </div>
        </div>
      </Modal>

      {/* ---- 明細の挿入・編集（行の右の「挿入」「編集」から。確認メモ #206／#207） ---- */}
      <Modal open={rowForm != null} onClose={() => setRowForm(null)} width={560} title={rowForm?.mode === 'insert' ? '明細の挿入（選択した行の上）' : rowForm?.noteOnly ? '摘要行の編集' : '明細の編集'}>
        {rowForm && (() => { const f = rowForm; const set = (p: Partial<typeof f>) => setRowForm({ ...f, ...p }); const fTax = f.tax || (f.account ? defaultTax(f.account, num(f.inAmt) > 0) : ''); return (
          <div data-row-form style={{ padding: '14px 22px 18px' }}>
            <div style={{ fontSize: 14, color: '#5b6773', marginBottom: 12, lineHeight: 1.7 }}>{f.mode === 'insert' ? '選択した行の上に、明細を 1 行挿入します。' : '明細の内容を訂正します。'}集計済みの期間より前の日付には登録できません。</div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '10px 12px', alignItems: 'center', fontSize: 14 }}>
              {!f.noteOnly && <>
                <label htmlFor="re-day">年月日</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#5b6773', whiteSpace: 'nowrap' }}>令和{f.ny ? 9 : eraOf({ month: f.month })}年</span>
                  <select aria-label="月" value={f.month} onChange={(e) => set({ month: e.target.value })} style={{ ...inp, width: 64 }}>{(f.ny ? ['4', '5', '6'] : FISCAL_MONTHS).map((m) => <option key={m}>{m}</option>)}</select>
                  <span>月</span>
                  <input id="re-day" className="field-input ring" aria-label="日" value={f.day} onChange={(e) => set({ day: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('re-tekiyo'))} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 56, textAlign: 'center' }} />
                  <span>日</span>
                  {f.ny && <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fffaf0', color: '#8a6414', border: '1px dashed #b98a2e', whiteSpace: 'nowrap' }}>翌年度の予備月</span>}
                </div>
              </>}
              <label htmlFor="re-tekiyo">摘要</label>
              <input id="re-tekiyo" className="field-input ring" value={f.tekiyo} onChange={(e) => set({ tekiyo: e.target.value })} onKeyDown={onEnter(() => (f.noteOnly ? saveRowForm() : focusId('re-acc')))} autoComplete="off" style={inp} />
              {!f.noteOnly && <>
                <label htmlFor="re-acc">勘定科目</label>
                <select id="re-acc" value={f.account} onChange={(e) => set({ account: e.target.value })} onKeyDown={onEnter(() => focusId('re-in'))} style={inp}>
                  <option value="">（選択してください）</option>
                  {(f.account && !CASHBOOK_ACCOUNTS.includes(f.account) ? [f.account, ...CASHBOOK_ACCOUNTS] : CASHBOOK_ACCOUNTS).map((a) => <option key={a} value={a}>{CODE[a] ? `${CODE[a]} ` : ''}{a}</option>)}
                </select>
                <label htmlFor="re-in">入金額</label>
                <input id="re-in" className="field-input ring" value={f.inAmt} onChange={(e) => set({ inAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId('re-out'))} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 180, textAlign: 'right' }} />
                <label htmlFor="re-out">出金額</label>
                <input id="re-out" className="field-input ring" value={f.outAmt} onChange={(e) => set({ outAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(saveRowForm)} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 180, textAlign: 'right' }} />
                {taxEntry && <>
                  <label htmlFor="re-tax">消費税コード</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <select id="re-tax" value={fTax} onChange={(e) => set({ tax: e.target.value })} style={{ ...inp, width: 220 }}>
                      <option value="">（勘定科目から自動）</option>
                      {TAX_CODES.map((t) => <option key={t.code} value={t.code}>{t.code} {t.name}</option>)}
                    </select>
                    <span style={{ color: '#5b6773', whiteSpace: 'nowrap' }}>税額 <b>{yen(taxAmtOf(fTax, num(f.inAmt) || num(f.outAmt)))}</b> 円（内税・自動計算）</span>
                  </div>
                </>}
              </>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="submit-btn" onClick={saveRowForm} style={btn(true)}>登録</button>
              <button type="button" onClick={() => setRowForm(null)} style={btn()}>キャンセル</button>
            </div>
          </div>
        ); })()}
      </Modal>

      {/* ---- 小口の設定（確認メモ #210）。項目は叩き台（現行の画面の資料が届いたら合わせる） ---- */}
      <Modal open={setting != null} onClose={() => setSetting(null)} width={540} title="小口の設定">
        {setting && (
          <div data-petty-setting style={{ padding: '14px 22px 18px' }}>
            <div style={{ fontSize: 14, color: '#5b6773', marginBottom: 12, lineHeight: 1.7 }}>表示中の小口現金出納帳（{book}）の設定です。</div>
            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: '10px 12px', alignItems: 'center', fontSize: 14 }}>
              <label htmlFor="ps-name">出納帳の名称</label>
              <input id="ps-name" className="field-input ring" value={setting.name} onChange={(e) => setSetting({ ...setting, name: e.target.value })} onKeyDown={onEnter(() => focusId('ps-staff'))} autoComplete="off" style={inp} />
              <label htmlFor="ps-staff">担当者</label>
              <input id="ps-staff" className="field-input ring" value={setting.staff} onChange={(e) => setSetting({ ...setting, staff: e.target.value })} onKeyDown={onEnter(() => focusId('ps-place'))} autoComplete="off" style={inp} />
              <label htmlFor="ps-place">区分</label>
              <select id="ps-place" value={setting.place} onChange={(e) => setSetting({ ...setting, place: e.target.value })} style={inp}>{PETTY_PLACES.map((p) => <option key={p}>{p}</option>)}</select>
              <label htmlFor="ps-refill">補充元の預金科目</label>
              <select id="ps-refill" value={setting.refill} onChange={(e) => setSetting({ ...setting, refill: e.target.value })} style={inp}>{BANK_ACCOUNTS.map((a) => <option key={a}>{a}</option>)}</select>
              <label htmlFor="ps-fixed">定額（補充後の金額）</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input id="ps-fixed" className="field-input ring" value={setting.fixed} onChange={(e) => setSetting({ ...setting, fixed: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId('ps-warn'))} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 160, textAlign: 'right' }} /><span>円</span></div>
              <label htmlFor="ps-warn">残高の下限</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input id="ps-warn" className="field-input ring" value={setting.warn} onChange={(e) => setSetting({ ...setting, warn: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(saveSetting)} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 160, textAlign: 'right' }} /><span>円（下回ると画面に注意を表示）</span></div>
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f3f6f9', borderRadius: 10, fontSize: 12, color: '#5b6773', lineHeight: 1.7 }}>※ この画面の項目は仮の案です。現行システムの「小口の設定」の内容を確認のうえ、合わせます。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="submit-btn" onClick={saveSetting} style={btn(true)}>登録</button>
              <button type="button" onClick={() => setSetting(null)} style={btn()}>キャンセル</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- 金銭残高金種別表（確認メモ #212）：日付ごとに紙幣・硬貨の枚数を入力し、帳簿残高と照らす ---- */}
      <Modal open={denomOpen} onClose={() => setDenomOpen(false)} width={820} title="金銭残高金種別表">
        <div data-denom style={{ padding: '14px 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
            <span style={{ fontWeight: 700 }}>{book}</span>
            <span style={{ color: '#7a8794', marginLeft: 8 }}>日付</span>
            <select aria-label="年" value={denomDate.era} onChange={(e) => changeDenomDate({ ...denomDate, era: e.target.value })} style={{ ...inp, width: 110 }}><option value="8">令和8年</option><option value="9">令和9年</option></select>
            <input className="field-input ring" aria-label="月" value={denomDate.month} onChange={(e) => changeDenomDate({ ...denomDate, month: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 50, textAlign: 'center' }} /><span>月</span>
            <input className="field-input ring" aria-label="日" value={denomDate.day} onChange={(e) => changeDenomDate({ ...denomDate, day: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('dn-10000'))} inputMode="numeric" autoComplete="off" style={{ ...inp, width: 50, textAlign: 'center' }} /><span>日</span>
            {denomValid && isDenomNy(denomDate) && <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fffaf0', color: '#8a6414', border: '1px dashed #b98a2e' }}>翌年度の予備月</span>}
            {denomValid ? <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: denomSaved ? '#eaf5ef' : '#f1f4f6', color: denomSaved ? '#1f7a52' : '#7a8794' }}>{denomSaved ? '登録済み' : '未登録'}</span> : <span style={{ fontSize: 12, color: '#c0392b' }}>日付を正しく入力してください</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#7a8794' }}>
            <span>登録済みの日付：</span>
            {denomList.length === 0 && <span>まだありません</span>}
            {denomList.map((d) => { const on = d.key === denomKey(denomDate); return (
              <button key={d.key} type="button" className="chip" onClick={() => changeDenomDate({ era: d.era, month: d.month, day: d.day })} title={`令和${d.era}年 ${d.month}月${d.day}日の金種別表を開く`} style={{ padding: '3px 10px', borderRadius: 14, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? accent : '#d3dbe3') }}>{d.era === '9' ? '令和9年 ' : ''}{d.month}/{d.day}　{yen(d.total)}円</button>
            ); })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginTop: 12, alignItems: 'start' }}>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 60 }}>区分</th><th style={{ ...TH, textAlign: 'right' }}>金種</th><th style={{ ...TH, width: 110, textAlign: 'right' }}>枚数</th><th style={{ ...TH, textAlign: 'right' }}>金額</th></tr></thead>
                <tbody>
                  {DENOMS.map(([k, v], i) => (
                    <tr key={v} style={{ background: k === '紙幣' ? '#fff' : '#fbfcfd' }}>
                      <td style={{ ...TD, padding: '4px 10px', color: '#7a8794' }}>{k}</td>
                      <td style={{ ...NUM, padding: '4px 10px', fontWeight: 700 }}>{yen(v)}円</td>
                      <td style={{ ...NUM, padding: '3px 8px' }}><input id={`dn-${v}`} className="field-input ring" aria-label={`${yen(v)}円の枚数`} value={denomForm[v] ?? ''} onChange={(e) => setDenomForm({ ...denomForm, [v]: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) })} onKeyDown={onEnter(() => (i < DENOMS.length - 1 ? focusId(`dn-${DENOMS[i + 1][1]}`) : saveDenom()))} inputMode="numeric" autoComplete="off" placeholder="0" style={{ ...inp, padding: '4px 8px', width: 84, textAlign: 'right' }} /></td>
                      <td style={{ ...NUM, padding: '4px 10px' }}>{denomCount(v) ? yen(v * denomCount(v)) : ''}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f6f8fa' }}><td colSpan={2} style={{ ...TD, padding: '6px 10px', fontWeight: 700, textAlign: 'right' }}>合計</td><td style={{ ...NUM, padding: '6px 10px', fontWeight: 700 }}>{yen(denomPieces)} 枚</td><td style={{ ...NUM, padding: '6px 10px', fontWeight: 800 }}>{yen(denomTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 10px', fontSize: 14, alignItems: 'baseline' }}>
                <span style={{ color: '#5b6773' }}>実際の残高（金種の合計）</span><b style={{ textAlign: 'right', fontSize: 16 }}>{yen(denomTotal)} 円</b>
                <span style={{ color: '#5b6773' }}>帳簿残高（{denomValid ? `${denomDate.month}月${denomDate.day}日まで` : '―'}）</span><b style={{ textAlign: 'right', fontSize: 16 }}>{denomValid ? `${yen(denomBook)} 円` : '―'}</b>
                <span style={{ color: '#5b6773', borderTop: '1px solid #eef2f5', paddingTop: 8 }}>差額</span>
                <b data-denom-diff style={{ textAlign: 'right', fontSize: 16, borderTop: '1px solid #eef2f5', paddingTop: 8, color: !denomValid ? '#7a8794' : denomTotal === denomBook ? '#1f7a52' : '#c0392b' }}>{denomValid ? `${yen(denomTotal - denomBook)} 円` : '―'}</b>
              </div>
              {denomValid && <div style={{ padding: '8px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: denomTotal === denomBook ? '#eaf5ef' : '#fdeee9', color: denomTotal === denomBook ? '#1f7a52' : '#c0392b' }}>{denomTotal === denomBook ? '帳簿残高と一致しています' : `帳簿残高と一致していません（${denomTotal > denomBook ? '実際の残高が多い' : '実際の残高が少ない'}）`}</div>}
              <div style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>枚数を入力して「登録」を押すと、この日付の金種別表として保存します。Enter で次の金種へ進みます。帳簿残高は、この日付までの明細から計算しています。</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            {denomSaved && <button type="button" className="btn-outline" onClick={deleteDenom} style={{ ...btn(), color: '#c0392b', marginRight: 'auto' }}>この日付の表を削除</button>}
            <button type="button" className="submit-btn" onClick={saveDenom} style={btn(true)}>登録</button>
            <button type="button" className="btn-outline" onClick={printDenom} style={btn()}>印刷</button>
            <button type="button" onClick={() => setDenomOpen(false)} style={btn()}>閉じる</button>
          </div>
        </div>
      </Modal>

      <ExportDialog spec={exportSpec} onClose={() => setExportSpec(null)} accent={accent} />

      {/* ---- 確認（削除など）。ほかのモーダルの上に重ねる ---- */}
      <Modal open={confirm != null} onClose={() => setConfirm(null)} width={440} title={confirm?.title ?? '確認'}>
        <div data-confirm style={{ padding: '16px 22px 18px' }}>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>{confirm?.body}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => { const c = confirm; setConfirm(null); c?.onOk(); }} style={{ ...btn(), background: '#c0392b', color: '#fff', border: 'none' }}>{confirm?.ok ?? '削除する'}</button>
            <button type="button" onClick={() => setConfirm(null)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>
    </ReportShell>
  );
}
