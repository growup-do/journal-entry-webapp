// オプション：小口現金出納帳／預金出納帳（共通部品）
//   紙の出納帳風の表（入金額／年月日／摘要／勘定科目／出金額／残高）。最終行が入力行で、Enterで次の項目→登録。
//   小口現金：特殊行の挿入・集計（確認→集計済みロック）・AI自動仕訳インポート
//   預金出納：新規出納帳（預金科目の選択）・銀行CSVインポート・インポート一括削除・預金残高（通帳残高との差額）
//   共通：会計連動・印刷（集計内訳表／仕訳伝票／出納帳）・区分の切替

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { AssistField } from './AssistField';
import { ExportDialog, type ExportSpec } from './ExportDialog';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { LABEL, NUM, ReportShell, TD, TH } from './ReportShell';
import { useAssist } from '../hooks/useAssist';
import { addVoucher } from '../store/journalStore';
import { accountFlat } from '../data';
import type { MonthFilter } from '../types';

export type CashbookKind = 'petty' | 'bank';
const OPTION = '#b45309';
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
  /** AI自動仕訳からの取込：会計確認（承認）待ち／承認済み */
  ai?: 'pending' | 'approved';
  /** AI推定の信頼度（%） */
  aiConf?: number;
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
/** 小口現金の区分（拠点・担当ごとに出納帳を分ける） */
const PETTY_BOOKS = [
  { name: '小口現金（保育園）', staff: '経理担当', place: '002 保育事業' },
  { name: '小口現金（本部）', staff: '事務長', place: '001 本部' },
  { name: '小口現金（給食室）', staff: '栄養士', place: '002 保育事業' },
  { name: '小口現金（子育て支援）', staff: '支援員', place: '003 子育て支援' },
];
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
  const [book, setBook] = useState(isPetty ? PETTY_BOOKS[0].name : '普通預金（保育園）');
  const [pettyOpen, setPettyOpen] = useState(false);
  const [pettyPick, setPettyPick] = useState(PETTY_BOOKS[0].name);
  const [linkOpen, setLinkOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLines, setAiLines] = useState<AiLine[]>([]);
  const [aiFileName, setAiFileName] = useState('');
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null);
  const aiFile = useRef<HTMLInputElement>(null);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(isPetty ? PETTY_SEED : BANK_SEED);
  const [opening] = useState(isPetty ? 26517 : 9630000);
  const [month, setMonth] = useState<MonthFilter>('8');
  const [entry, setEntry] = useState({ inAmt: '', month: '8', day: '', tekiyo: '', account: '', outAmt: '' });
  const [specialOpen, setSpecialOpen] = useState(false);
  const [specialOpts, setSpecialOpts] = useState({ date: false, balance: false });
  const [aggOpen, setAggOpen] = useState(false);
  const [aggSel, setAggSel] = useState<Set<number>>(new Set());
  const [aggConfirm, setAggConfirm] = useState(false);
  const [aggLink, setAggLink] = useState(false);
  const [bankBalanceOpen, setBankBalanceOpen] = useState(false);
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [bankInput, setBankInput] = useState('');
  const [csvOpen, setCsvOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
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
  const view = withBal.filter((r) => month == null || r.month === month);
  const lastBal = withBal.length ? withBal[withBal.length - 1].bal : opening;
  const monthIn = view.reduce((a, r) => a + r.inAmt, 0);
  const monthOut = view.reduce((a, r) => a + r.outAmt, 0);

  const add = () => {
    const inAmt = parseInt(entry.inAmt.replace(/[^0-9]/g, ''), 10) || 0;
    const outAmt = parseInt(entry.outAmt.replace(/[^0-9]/g, ''), 10) || 0;
    if (!entry.day) return toast.show('日を入力してください');
    if (!entry.account) return toast.show('勘定科目を選択してください');
    if (!inAmt && !outAmt) return toast.show('入金額または出金額を入力してください');
    setRows((rs) => [...rs, R(entry.month || '8', entry.day, entry.tekiyo, entry.account, inAmt, outAmt)]);
    setEntry({ inAmt: '', month: entry.month, day: '', tekiyo: '', account: '', outAmt: '' });
    focusId('cb-in');
  };
  const insertSpecial = (kind: Row['special']) => {
    setRows((rs) => [...rs, { ...R(entry.month || '8', '', kind === '摘要行' ? '（摘要行）' : '', '', 0, 0), special: kind }]);
    setSpecialOpen(false);
    toast.show(`${kind}を挿入しました`);
  };
  const aggregable = withBal.filter((r) => !r.special && !r.aggregated);
  const aggRange = aggregable.filter((r) => aggSel.has(r.id));
  const aggBal = aggRange.length ? withBal.find((r) => r.id === aggRange[aggRange.length - 1].id)!.bal : lastBal;
  const runAggregate = () => {
    setRows((rs) => rs.map((r) => (aggSel.has(r.id) ? { ...r, aggregated: true } : r)));
    setAggConfirm(false);
    setAggOpen(false);
    toast.show(`${aggSel.size} 件を集計しました${aggLink ? '（会計連動フォルダへ送信）' : ''}`);
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
  const lockedMsg = () => toast.show('集計済みの明細は訂正・削除できません（F10：集計取消 を実行してください）');

  // ---- 会計連動：集計済み（未連動）の明細を仕訳伝票にする ----
  const cashAccount = isPetty ? '小口現金' : book; // 出納帳の相手科目
  const journalOf = (r: Row) => ({
    date: `${r.month}/${r.day}`,
    kari: r.inAmt ? cashAccount : r.account,
    kashi: r.inAmt ? r.account : cashAccount,
    tekiyo: r.tekiyo,
    amount: r.inAmt || r.outAmt,
  });
  const linkTargets = withBal.filter((r) => !r.special && r.aggregated && !r.linked);
  const openLink = () => {
    if (linkTargets.length === 0) return toast.show('会計連動できる明細がありません（先に「集計」を実行してください）');
    setLinkOpen(true);
  };
  const runLink = () => {
    const service = isPetty ? PETTY_BOOKS.find((b) => b.name === book)?.place ?? '002 保育事業' : '002 保育事業';
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
    setPrintOpen(false);
    const period = month == null ? '令和8年度（全月）' : `令和8年 ${month}月`;
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
      setExportSpec({ kind: 'print', title: `仕訳伝票（${title}）`, meta, header: ['日付', '借方科目', '貸方科目', '摘要', '金額', '会計連動'], rows: agg.map((r) => { const j = journalOf(r); return [`令和8年 ${j.date.replace('/', '月')}日`, j.kari, j.kashi, j.tekiyo, j.amount, r.linked ? '連動済' : '未連動']; }) });
      return;
    }
    const body = view.filter((r) => r.special !== '改ページ' && r.special !== '締切線');
    setExportSpec({ kind: 'print', title, meta: `${meta}　前月繰越 ${yen(opening)}`, header: ['入金額', '年月日', '摘要', '勘定科目', '出金額', '残高'], rows: [[0, '', '前月繰越', '', 0, opening], ...body.map((r): (string | number)[] => (r.special === '小計行' ? [monthIn, '', '小計', '', monthOut, r.bal] : [r.inAmt, r.special ? '' : `令和8年 ${r.month}月 ${r.day}日`, r.tekiyo, r.account, r.outAmt, r.special ? '' : r.bal]))] });
  };


  const cell: CSSProperties = { ...TD, padding: '6px 10px', borderRight: '1px solid #eef2f5' };
  const numCell: CSSProperties = { ...NUM, padding: '6px 10px', borderRight: '1px solid #eef2f5' };
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
  const btn = (primary?: boolean): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const badge = <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: OPTION, borderRadius: 5, padding: '2px 6px', verticalAlign: 'middle', marginLeft: 6 }}>オプション</span>;

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={title}
      badge={badge}
      org={`チャイルド保育園　${book}`}
      subtitle={isPetty ? '小口現金の入出金を出納帳形式で記帳し、集計して会計へ連動します。' : '預金口座ごとの入出金を出納帳形式で記帳。銀行CSVの取込と通帳残高の照合ができます。'}
      tools={[
        { label: '会計連動', onClick: openLink },
        { label: '印刷', onClick: () => setPrintOpen(true) },
        { label: isPetty ? '小口区分の切替' : '区分の切替', onClick: () => { if (isPetty) { setPettyPick(book); setPettyOpen(true); } else setNewBookOpen(true); } },
        ...(isPetty
          ? [{ label: '特殊行', onClick: () => setSpecialOpen(true) }, { label: '集計', onClick: () => setAggOpen(true), primary: true }]
          : [{ label: '預金残高', onClick: () => { setBankInput(bankBalance != null ? String(bankBalance) : ''); setBankBalanceOpen(true); } }, { label: '集計', onClick: () => setAggOpen(true), primary: true }]),
      ]}
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={LABEL}>会計月</span>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isPetty ? (
              <>
                <button type="button" className="btn-outline" onClick={() => { setAiLines([]); setAiFileName(''); setAiOpen(true); }} style={btn()}>AI自動仕訳 インポート</button>
                <button type="button" className="btn-outline" onClick={() => setAiConfirmOpen(true)} style={{ ...btn(), position: 'relative' }}>
                  AI自動仕訳 会計確認
                  {aiPending.length > 0 && <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#c0392b', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{aiPending.length}</span>}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-outline" onClick={() => setCsvOpen(true)} style={btn()}>銀行CSV インポート</button>
                <button type="button" className="btn-outline" onClick={() => setBulkOpen(true)} style={btn()}>インポート一括削除</button>
                <button type="button" className="btn-outline" onClick={() => setNewBookOpen(true)} style={btn()}>新規出納帳</button>
              </>
            )}
          </div>
        </div>
      }
    >
      <ToastView msg={toast.msg} />

      {/* 残高サマリー */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 22px', borderBottom: '1px solid #eef2f5', fontSize: 12.5, color: '#5b6773', flexWrap: 'wrap' }}>
        <span>前月繰越 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(opening)}</b></span>
        <span>当月入金 <b style={{ color: '#2c5f9e', fontVariantNumeric: 'tabular-nums' }}>{yen(monthIn)}</b></span>
        <span>当月出金 <b style={{ color: '#b0426a', fontVariantNumeric: 'tabular-nums' }}>{yen(monthOut)}</b></span>
        <span>現在残高 <b style={{ color: '#22303c', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{yen(lastBal)}</b></span>
        {!isPetty && bankBalance != null && (
          <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 10, background: bankBalance === lastBal ? '#eaf5ef' : '#fdeee9', color: bankBalance === lastBal ? '#1f7a52' : '#c0392b', fontWeight: 700 }}>
            通帳残高 {yen(bankBalance)}　差額 {yen(bankBalance - lastBal)}
          </span>
        )}
        <span style={{ marginLeft: isPetty || bankBalance == null ? 'auto' : 0, color: '#9aa5b1' }}>黄色＝集計済み（訂正不可）／青＝{isPetty ? 'AI取込（承認済）／紫＝AI取込（承認待ち）' : 'CSV取込'}</span>
      </div>

      {/* 出納帳 */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'right', width: 120 }}>入金額</th>
              <th style={{ ...TH, width: 150 }}>年月日</th>
              <th style={TH}>摘要</th>
              <th style={{ ...TH, width: 220 }}>勘定科目</th>
              <th style={{ ...TH, textAlign: 'right', width: 120 }}>出金額</th>
              <th style={{ ...TH, textAlign: 'right', width: 130 }}>残高</th>
              <th style={{ ...TH, width: 70 }} />
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f8fafc' }}>
              <td style={cell} /><td style={cell} /><td style={{ ...cell, color: '#7a8794', fontWeight: 700 }}>前月繰越</td><td style={cell} /><td style={cell} /><td style={{ ...numCell, fontWeight: 700 }}>{yen(opening)}</td><td style={TD} />
            </tr>
            {view.map((r) => {
              if (r.special === '締切線') return <tr key={r.id}><td colSpan={7} style={{ padding: 0, borderBottom: '3px double #22303c' }} /></tr>;
              if (r.special === '改ページ') return <tr key={r.id}><td colSpan={7} style={{ padding: '3px 10px', fontSize: 10.5, color: '#9aa5b1', textAlign: 'center', background: 'repeating-linear-gradient(90deg,#e6ecf1 0 6px,transparent 6px 12px) center/100% 1px no-repeat' }}>— 改ページ —</td></tr>;
              if (r.special === '小計行') return <tr key={r.id} style={{ background: '#f3f6f9' }}><td style={numCell}>{yen(monthIn)}</td><td style={cell} /><td style={{ ...cell, fontWeight: 700 }}>小計</td><td style={cell} /><td style={numCell}>{yen(monthOut)}</td><td style={{ ...numCell, fontWeight: 700 }}>{yen(r.bal)}</td><td style={TD} /></tr>;
              const bg = r.aggregated ? '#fff8c4' : r.ai === 'pending' ? '#f3e8ff' : r.imported ? '#eaf2fb' : 'transparent';
              return (
                <tr key={r.id} style={{ background: bg }}>
                  <td style={{ ...numCell, color: '#2c5f9e' }}>{r.inAmt ? yen(r.inAmt) : ''}</td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{r.special === '摘要行' ? '' : `令和8年 ${r.month}月 ${r.day}日`}</td>
                  <td style={cell}>{r.tekiyo}</td>
                  <td style={cell}>
                    {r.code && <span style={{ color: '#9aa5b1', fontSize: 11, marginRight: 6 }}>{r.code}</span>}{r.account}
                    {r.ai === 'pending' && <span title={`AI推定（信頼度 ${r.aiConf ?? '-'}%）承認待ち`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#6b3fb5', background: '#efe6fb', borderRadius: 5, padding: '1px 5px' }}>AI {r.aiConf}%</span>}
                    {r.linked && <span title="会計連動済み（仕訳伝票を作成済み）" style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#1f7a52', background: '#eaf5ef', borderRadius: 5, padding: '1px 5px' }}>連動済</span>}
                  </td>
                  <td style={{ ...numCell, color: '#b0426a' }}>{r.outAmt ? yen(r.outAmt) : ''}</td>
                  <td style={{ ...numCell, fontWeight: 700 }}>{r.special ? '' : yen(r.bal)}</td>
                  <td style={{ ...TD, padding: '4px 8px', textAlign: 'right' }}>
                    <button type="button" className="btn-outline" onClick={() => (r.aggregated ? lockedMsg() : setRows((rs) => rs.filter((x) => x.id !== r.id)))} title="行の削除" style={{ padding: '3px 8px', border: '1px solid #d3dbe3', borderRadius: 6, background: '#fff', color: r.aggregated ? '#c3ccd4' : '#c0392b', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>削除</button>
                  </td>
                </tr>
              );
            })}
            {/* 入力行 */}
            <tr style={{ background: '#fbfcfd', borderTop: `2px solid ${accent}` }}>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-in" className="field-input ring" value={entry.inAmt} onChange={(e) => setEntry({ ...entry, inAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => focusId('cb-day'))} inputMode="numeric" placeholder="入金" style={{ ...inp, textAlign: 'right' }} /></td>
              <td style={{ ...cell, padding: '8px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#5b6773' }}>
                  <span>令和8</span>
                  <input className="field-input" value={entry.month} onChange={(e) => setEntry({ ...entry, month: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} inputMode="numeric" style={{ ...inp, width: 34, padding: '6px 2px', textAlign: 'center' }} />
                  <input id="cb-day" className="field-input" value={entry.day} onChange={(e) => setEntry({ ...entry, day: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} onKeyDown={onEnter(() => focusId('cb-tekiyo'))} inputMode="numeric" placeholder="日" style={{ ...inp, width: 34, padding: '6px 2px', textAlign: 'center' }} />
                </div>
              </td>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-tekiyo" className="field-input ring" value={entry.tekiyo} onChange={(e) => setEntry({ ...entry, tekiyo: e.target.value })} onKeyDown={onEnter(() => focusId('cb-acc'))} placeholder="摘要" autoComplete="off" style={inp} /></td>
              <td style={{ ...cell, padding: '8px 8px' }}>
                <AssistField buttonId="cb-acc" value={entry.account} placeholder="勘定科目検索" open={assist.isOpen('acc')} onOpen={() => assist.open('acc', 'account')} accent={accent} accentRgb={accentRgb} buttonStyle={fieldBtn} panelStyle={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }} groups={assist.groups} query={assist.query} empty={assist.empty} onInput={assist.setQuery} onPick={(v) => { setEntry((en) => ({ ...en, account: v })); assist.close(); focusId('cb-out'); }} />
              </td>
              <td style={{ ...cell, padding: '8px 8px' }}><input id="cb-out" className="field-input ring" value={entry.outAmt} onChange={(e) => setEntry({ ...entry, outAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(add)} inputMode="numeric" placeholder="出金" style={{ ...inp, textAlign: 'right' }} /></td>
              <td style={{ ...numCell, color: '#9aa5b1', fontSize: 11 }}>自動計算</td>
              <td style={{ ...TD, padding: '8px 8px' }}><button type="button" className="submit-btn" onClick={add} style={{ ...btn(true), padding: '7px 12px', fontSize: 12 }}>登録</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- 特殊行の挿入 ---- */}
      <Modal open={specialOpen} onClose={() => setSpecialOpen(false)} width={420} title="特殊行の挿入">
        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 13.5, marginBottom: 14 }}>カーソル位置へ挿入する特殊行を選択して下さい</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['小計行', '改ページ', '締切線'] as const).map((k) => <button key={k} type="button" className="btn-outline" onClick={() => insertSpecial(k)} style={btn()}>{k}</button>)}
          </div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" className="btn-outline" onClick={() => insertSpecial('摘要行')} style={btn()}>摘要行</button>
            <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={specialOpts.date} onChange={() => setSpecialOpts({ ...specialOpts, date: !specialOpts.date })} />年月日欄を表示</label>
            <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={specialOpts.balance} onChange={() => setSpecialOpts({ ...specialOpts, balance: !specialOpts.balance })} />残高欄を表示</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" onClick={() => setSpecialOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 集計：明細選択 ---- */}
      <Modal open={aggOpen && !aggConfirm} onClose={() => setAggOpen(false)} width={860} title="集計">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 13.5, marginBottom: 10 }}>集計する明細を選択してください。<span style={{ fontSize: 12, color: '#7a8794', marginLeft: 8 }}>（選択 {aggSel.size} 件）</span></div>
          <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 36 }} /><th style={{ ...TH, textAlign: 'right' }}>入金額</th><th style={TH}>年月日</th><th style={TH}>摘要</th><th style={TH}>勘定科目</th><th style={{ ...TH, textAlign: 'right' }}>出金額</th><th style={{ ...TH, textAlign: 'right' }}>残高</th></tr></thead>
              <tbody>
                {aggregable.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>集計できる明細がありません。</td></tr>}
                {aggregable.map((r) => {
                  const on = aggSel.has(r.id);
                  return (
                    <tr key={r.id} onClick={() => setAggSel((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} style={{ background: on ? '#fff8c4' : 'transparent', cursor: 'pointer' }}>
                      <td style={TD}><input type="checkbox" checked={on} readOnly /></td>
                      <td style={NUM}>{r.inAmt ? yen(r.inAmt) : ''}</td><td style={TD}>{r.month}/{r.day}</td><td style={TD}>{r.tekiyo}</td><td style={TD}>{r.account}</td><td style={NUM}>{r.outAmt ? yen(r.outAmt) : ''}</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(r.bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn-outline" onClick={() => setAggSel(new Set(aggregable.map((r) => r.id)))} style={btn()}>すべて選択</button>
            <button type="button" className="submit-btn" disabled={aggSel.size === 0} onClick={() => setAggConfirm(true)} style={{ ...btn(true), opacity: aggSel.size ? 1 : 0.5 }}>OK</button>
            <button type="button" onClick={() => setAggOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 集計：確認 ---- */}
      <Modal open={aggConfirm} onClose={() => setAggConfirm(false)} width={620} title="集計 ― 確認">
        <div style={{ padding: '18px 22px 20px', fontSize: 13.5, lineHeight: 1.7 }}>
          <div>選択された明細は…</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 14px', margin: '8px 0 12px', background: '#fbfcfd' }}>
            {aggRange.length > 0 && (
              <>
                <div>令和8年 {aggRange[0].month}月{aggRange[0].day}日　{aggRange[0].account}　{yen(aggRange[0].inAmt || aggRange[0].outAmt)}円 〜</div>
                <div style={{ textAlign: 'right' }}>令和8年 {aggRange[aggRange.length - 1].month}月{aggRange[aggRange.length - 1].day}日　{aggRange[aggRange.length - 1].account}　{yen(aggRange[aggRange.length - 1].inAmt || aggRange[aggRange.length - 1].outAmt)}円 迄</div>
              </>
            )}
          </div>
          <div style={{ fontWeight: 700 }}>この時点での残高は　<span style={{ fontSize: 16 }}>{yen(aggBal)}円</span>になります。</div>
          <div style={{ marginTop: 8 }}>集計を開始してもよろしいですか？</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={aggLink} onChange={() => setAggLink(!aggLink)} />集計したら会計連動フォルダへこの伝票情報を送る</label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={runAggregate} style={btn(true)}>OK</button>
            <button type="button" onClick={() => setAggConfirm(false)} style={btn()}>キャンセル</button>
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#f3f6f9', borderRadius: 10, fontSize: 12, color: '#48565f' }}>
            集計された明細に対しては以下の操作が出来なくなります。<br />①日付・金額・科目・摘要など、明細内容の訂正　②前期繰越の金額訂正　③行の挿入　④行の削除<br />※一度集計した明細に対して修正を行う場合は『F10：集計取消』を実行してから行ってください。
          </div>
        </div>
      </Modal>

      {/* ---- 印刷メニュー ---- */}
      <Modal open={printOpen} onClose={() => setPrintOpen(false)} width={360} title="印刷および印刷プレビュー">
        <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['集計内訳表', '仕訳伝票', isPetty ? '小口現金出納帳' : '預金出納帳'].map((l) => (
            <button key={l} type="button" className="menu-sub" onClick={() => openPrint(l)} style={{ textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </Modal>

      {/* ---- 預金出納：新規出納帳 ---- */}
      <Modal open={newBookOpen} onClose={() => setNewBookOpen(false)} width={420} title="新規出納帳">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 8 }}>勘定科目（預金）</div>
          {BANK_ACCOUNTS.map((a) => (
            <label key={a} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 4px', fontSize: 13.5, cursor: 'pointer' }}><input type="radio" name="book" checked={book === a} onChange={() => setBook(a)} />{a}</label>
          ))}
          <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 10, lineHeight: 1.6 }}>※ 使用しないとして設定されている科目は選択できません。ご使用になられる場合は、使用科目へ設定を変更してください。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={() => { setNewBookOpen(false); toast.show(`${book} の出納帳を開きました`); }} style={btn(true)}>OK</button>
            <button type="button" onClick={() => setNewBookOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 預金出納：預金残高 ---- */}
      <Modal open={bankBalanceOpen} onClose={() => setBankBalanceOpen(false)} width={420} title="預金残高">
        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 13.5, marginBottom: 12 }}>通帳の預金残高を入力して下さい</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>残高</span>
            <input className="field-input ring" value={bankInput} onChange={(e) => setBankInput(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" autoFocus onKeyDown={onEnter(() => { setBankBalance(parseInt(bankInput, 10) || 0); setBankBalanceOpen(false); })} style={{ ...inp, flex: 1, textAlign: 'right', fontSize: 15, fontWeight: 700 }} />
            <span style={{ fontSize: 13 }}>円</span>
            <button type="button" className="submit-btn" onClick={() => { setBankBalance(parseInt(bankInput, 10) || 0); setBankBalanceOpen(false); }} style={btn(true)}>決定</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><button type="button" onClick={() => setBankBalanceOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 預金出納：銀行CSV取込 ---- */}
      <Modal open={csvOpen} onClose={() => setCsvOpen(false)} width={560} title="CSVファイルの取り込み">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>システム年度：令和8年（2026年）　対象口座：{book}</div>
          <div onClick={importCsv} style={{ border: '3px dashed #e0b400', background: '#fff9c4', borderRadius: 12, padding: '46px 20px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#22303c' }}>CSVファイルをドロップしてください。</div>
            <div style={{ fontSize: 12, color: '#7a8794', marginTop: 6 }}>（プロトタイプ：クリックするとサンプル3件を取り込みます）</div>
            <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); importCsv(); }} style={{ ...btn(), marginTop: 18 }}>CSVファイルを指定する</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><button type="button" onClick={() => setCsvOpen(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>

      {/* ---- 預金出納：インポート一括削除 ---- */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} width={560} title="インポート伝票一括削除">
        <div style={{ padding: '14px 22px 20px' }}>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 160, maxHeight: 260, overflow: 'auto' }}>
            <div style={{ padding: '8px 12px', background: '#f6f8fa', fontSize: 11, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>コメント（取込単位）</div>
            {rows.some((r) => r.imported) ? (
              <div onDoubleClick={(e) => { if (e.shiftKey) bulkDelete(); else toast.show('[Shift] キーを押しながらダブルクリックしてください'); }} title="Shift + ダブルクリックで一括削除" style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer' }}>
                銀行CSV取込　{rows.filter((r) => r.imported).length} 件　（{book}）
              </div>
            ) : (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>インポートされた伝票はありません。</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12, fontSize: 12.5, color: '#48565f', lineHeight: 1.7 }}>
            <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: '#e8f0fb', color: '#2c5f9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>i</span>
            <span>一括削除は大変危険な操作です。この為削除をするには、[Shift]キーを押しながら、コメント行をダブルクリックすると一括削除を継続する様になっております。</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><button type="button" onClick={() => setBulkOpen(false)} style={btn()}>閉じる</button></div>
        </div>
      </Modal>

      {/* ---- 小口現金：区分の切替 ---- */}
      <Modal open={pettyOpen} onClose={() => setPettyOpen(false)} width={480} title="小口区分の切替">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>開く小口現金の区分（担当）を選択してください。区分ごとに出納帳・繰越残高を分けて管理します。</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
            {PETTY_BOOKS.map((b) => (
              <label key={b.name} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13.5, cursor: 'pointer', background: pettyPick === b.name ? '#fff8c4' : '#fff' }}>
                <input type="radio" name="petty-book" checked={pettyPick === b.name} onChange={() => setPettyPick(b.name)} />
                <span style={{ flex: 1, fontWeight: 600 }}>{b.name}{b.name === book && <span style={{ marginLeft: 8, fontSize: 10.5, color: '#1f7a52', fontWeight: 700 }}>表示中</span>}</span>
                <span style={{ fontSize: 12, color: '#7a8794' }}>担当：{b.staff}</span>
                <span style={{ fontSize: 11, color: '#9aa5b1' }}>{b.place}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={() => { setBook(pettyPick); setPettyOpen(false); toast.show(`${pettyPick} の出納帳に切り替えました`); }} style={btn(true)}>OK</button>
            <button type="button" onClick={() => setPettyOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- 会計連動：確認 ---- */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} width={860} title="会計連動 ― 作成する仕訳伝票の確認">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>集計済みの明細 <b>{linkTargets.length} 件</b> を、次の仕訳伝票として会計システムへ送ります。相手科目は <b>{cashAccount}</b> です。</div>
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>日付</th><th style={TH}>借方科目</th><th style={TH}>貸方科目</th><th style={TH}>摘要</th><th style={{ ...TH, textAlign: 'right' }}>金額</th></tr></thead>
              <tbody>
                {linkTargets.map((r) => { const j = journalOf(r); return (
                  <tr key={r.id}><td style={{ ...TD, whiteSpace: 'nowrap' }}>令和8年 {r.month}月{r.day}日</td><td style={TD}>{j.kari}</td><td style={TD}>{j.kashi}</td><td style={TD}>{j.tekiyo}</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(j.amount)}</td></tr>
                ); })}
                <tr style={{ background: '#f6f8fa' }}><td colSpan={4} style={{ ...TD, fontWeight: 700, textAlign: 'right' }}>合計</td><td style={{ ...NUM, fontWeight: 700 }}>{yen(linkTargets.reduce((a, r) => a + (r.inAmt || r.outAmt), 0))}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, padding: '10px 14px', background: '#f3f6f9', borderRadius: 10, fontSize: 12, color: '#48565f', lineHeight: 1.7 }}>伝票は「伝票」区分・証憑なしで登録され、仕訳一覧・勘定元帳に反映されます。連動済みの明細は二重に送られません。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" onClick={runLink} style={btn(true)}>OK（{linkTargets.length} 件を送る）</button>
            <button type="button" onClick={() => setLinkOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- AI自動仕訳 インポート ---- */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} width={900} title="AI自動仕訳システムからのインポート">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>対象：{book}　　AI自動仕訳システムが出力した明細ファイル（CSV：日付,摘要,金額[,入金/出金]　または JSON）を読み込み、推定科目を確認してから取り込みます。</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={aiFile} type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => onAiFile(e.target.files?.[0])} style={{ display: 'none' }} />
            <button type="button" className="btn-outline" onClick={() => { if (aiFile.current) { aiFile.current.value = ''; aiFile.current.click(); } }} style={btn()}>ファイルを選択（.csv／.json）</button>
            <button type="button" className="btn-outline" onClick={() => loadAiText(AI_SAMPLE_CSV, 'sample_ai_journal.csv')} style={btn()}>サンプルを読み込む</button>
            {aiFileName && <span style={{ fontSize: 12.5, color: '#48565f' }}>読込：<b>{aiFileName}</b>（{aiLines.length} 件）</span>}
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
                        <span style={{ display: 'inline-block', minWidth: 46, padding: '2px 6px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, background: l.conf >= 80 ? '#eaf5ef' : l.conf >= 60 ? '#fff1b8' : '#fdeee9', color: l.conf >= 80 ? '#1f7a52' : l.conf >= 60 ? '#8a6d00' : '#c0392b' }}>{l.conf}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: 12, border: '2px dashed #cfd8e0', borderRadius: 12, padding: '36px 20px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>ファイルを選択するか「サンプルを読み込む」を押すと、ここに明細のプレビューが表示されます。</div>
          )}
          <div style={{ marginTop: 10, fontSize: 11.5, color: '#7a8794', lineHeight: 1.7 }}>信頼度が低い行は推定科目を選び直せます。取り込んだ明細は「承認待ち」となり、「AI自動仕訳 会計確認」で承認すると通常の明細として集計できます。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" className="submit-btn" disabled={aiLines.filter((l) => l.on).length === 0} onClick={importAi} style={{ ...btn(true), opacity: aiLines.some((l) => l.on) ? 1 : 0.5 }}>取り込む（{aiLines.filter((l) => l.on).length} 件）</button>
            <button type="button" onClick={() => setAiOpen(false)} style={btn()}>キャンセル</button>
          </div>
        </div>
      </Modal>

      {/* ---- AI自動仕訳 会計確認 ---- */}
      <Modal open={aiConfirmOpen} onClose={() => setAiConfirmOpen(false)} width={900} title="AI自動仕訳 会計確認 ― 承認待ちの明細">
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', marginBottom: 10 }}>AI自動仕訳から取り込んだ明細の科目・金額を確認し、承認または差戻しを行います。承認した明細は出納帳の通常明細として集計・会計連動の対象になります。</div>
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
                      <button type="button" className="submit-btn" onClick={() => approveAi(r.id)} style={{ ...btn(true), padding: '5px 10px', fontSize: 12, marginRight: 4 }}>承認</button>
                      <button type="button" className="btn-outline" onClick={() => returnAi(r.id)} style={{ ...btn(), padding: '5px 10px', fontSize: 12, color: '#c0392b' }}>差戻し</button>
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

      <ExportDialog spec={exportSpec} onClose={() => setExportSpec(null)} accent={accent} />
    </ReportShell>
  );
}
