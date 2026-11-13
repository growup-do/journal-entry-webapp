// 画面の骨組み（フォーム型）
// 左にメニュー列（折りたたみ可）＋ 本文列（上部に薄いアプリバー〔区分・年度／調査・印刷／各種設定／ユーザー〕、中央に各画面、下にフッター）。
// 伝票入力の参照パネル・試算表などの元帳パネルは本文の右に重ねて表示する（本文を押し出さない）。1600×768 の画面で使う人が多いための構成（11/10）。
// アクセント = 緑 #1f7a52。
//   伝票入力（仕訳伝票形式）：借方・貸方の科目は伝票につき1組、その下に 摘要・取引先・金額 の行を複数入力する（依頼書 5.3.1）。
//   科目・取引先・摘要は入力欄の中で候補を絞り込み（5.3.5）、登録できない仕訳と確認して続行できる警告を科目の直下に表示（5.3.2）。
//   機能ボタンは性質ごとにまとめて常に表示し、Alt＋英字のショートカットで操作する（5.3.6）。

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DivisionPicker } from './DivisionPicker';
import { FiscalYearBanner } from './FiscalYearPage';
import { AttachedStatementModal, BudgetGraphModal, BudgetHintLive, EntryConfirmModal, EntryDivisionField, SpecialAmountModal, TorihikiBadge, useEntryTools } from './EntryExtras';
import { ComboField, ENTRY_MONTH_HELP, EntryMonthNote, EntryStyles, isIme, FieldLabel, FundAccountLine, PAPER, PaperBox, PaperDate, PaperStyles, PaperTitle, parseEntryDate, useEntryYear, ENTRY_DATE_RANGE, ENTRY_YEAR_HELP, INTERNAL_SIDES, autoInternalSide, isSpecialParent, specialChildrenOf, type InternalSide, fieldMessage, fieldState, fmtNum, focusId, hasError, isDepreciationAccount, judgeEntry, needsPartner, onEnter, scopeStyle, setPartner, toNum, watchedStatement, type FundMode, type FusenColor, FusenTab, VoucherMarks } from './EntryCommon';
import { WIDE_TAB_SPACE, WIDE_WIDTH, WidePanel, usePanelPush, usePanelPushing, useWidePanel } from './WidePanel';
import { Menu as ClassicMenu } from './classic/ClassicMenu';
import { VersionBadge } from './VersionBadge';
import { useLayoutMode } from '../store/layout';
import { ToastView, useToast } from './Toast';
import { judgeTorihiki, metaOf } from '../lib/accounts';
import { TAX_OPTS, taxAmountOf, taxDefaultOf } from '../lib/transferTax';
import { addVoucher, getVouchers, updateVoucher, useVouchers } from '../store/journalStore';
import { setSession, specialRatesOf, useSession } from '../store/session';
import { canEnterVoucher, useEntryDivision } from '../lib/entryDivision';
import { HeaderTools } from './HeaderTools';
import { UserMenu } from './UserMenu';
import { NoticeBell } from './NoticeBell';
import { SettingsMenu } from './SettingsMenu';
import { SideNav, useSideNav } from './SideNav';
import { renderPage } from './pages';
import { Footer } from './Footer';

const GREEN = '#1f7a52';
const GREEN_RGB = '31,122,82';
const BLUE = '#2c5f9e';
const PINK = '#b0426a';

const dateInput: CSSProperties = {
  width: 44,
  padding: '8px 4px',
  textAlign: 'center',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#22303c',
};

interface Props {
  /** 表示中のメニュー項目（例 '伝票入力'） */
  page: string;
  onNavigate: (label: string) => void;
  onLogout: () => void;
}

export function FormScreen({ page, onNavigate, onLogout }: Props) {
  const [topOffset, setTopOffset] = useState(52);
  const headerRef = useRef<HTMLDivElement>(null);
  const nav = useSideNav();
  const classic = useLayoutMode() === 'classic';
  // 参照パネルが本文を押し出している間は、左メニューを自動でたたむ（確認メモ #243）。その間にメニューのボタンで広げることもできる（保存した開閉の状態は変えない）
  const pushing = usePanelPushing();
  const [navOverride, setNavOverride] = useState<boolean | null>(null);
  useEffect(() => { if (!pushing) setNavOverride(null); }, [pushing]);
  const navCollapsed = pushing ? (navOverride ?? true) : nav.collapsed;
  const navToggle = pushing ? () => setNavOverride(!navCollapsed) : nav.toggle;

  // アプリバー（＋年度の帯）の高さを実測（折返しに追従）。右に重ねるパネルの上端に使う
  useLayoutEffect(() => {
    const measure = () => {
      const o = headerRef.current?.offsetHeight ?? 0;
      if (o) setTopOffset((prev) => (o !== prev ? o : prev));
    };
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, [classic]);

  const body = page === '伝票入力' ? (
    <VoucherEntry onNavigate={onNavigate} topOffset={topOffset} />
  ) : page === '単一入力' || page === '振替入力' || page === '振替単一' ? (
    <EntryWithPanel page={page} topOffset={topOffset} onNavigate={onNavigate}>{renderPage(page, 'form', GREEN, GREEN_RGB, onNavigate, onLogout)}</EntryWithPanel>
  ) : (
    renderPage(page, 'form', GREEN, GREEN_RGB, onNavigate, onLogout)
  );

  // 旧レイアウト（プロトタイプ確認用。11/10 より前の構成）：上部にアプリバー＋年度帯＋メニューバー。確認メモの位置を確かめるために残している
  if (classic) {
    return (
      <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', flexDirection: 'column' }}>
        <div ref={headerRef} data-app-top style={{ position: 'sticky', top: 0, zIndex: 100 }}>
          <header style={{ background: '#fff', borderBottom: '1px solid #dde4ea', minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 6, columnGap: 12, padding: '8px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto', maxWidth: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
                <button type="button" data-menu="ホーム（ロゴ）" onClick={() => onNavigate('ホーム')} title="ホームへ" style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: GREEN, color: '#fff', borderRadius: 8, fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 }}>会</span>
                  <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>会計基準システム</span>
                </button>
                <VersionBadge accent={GREEN} />
              </div>
              <span style={{ color: '#c3ccd4' }}>｜</span>
              <DivisionPicker accent={GREEN} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#68757f', flex: 'none', marginLeft: 'auto' }}>
              <HeaderTools accent={GREEN} page={page} onNavigate={onNavigate} />
              <SettingsMenu accent={GREEN} active={page} onNavigate={onNavigate} />
              <NoticeBell accent={GREEN} />
              <UserMenu accent={GREEN} soft="#eef4f0" onNavigate={onNavigate} />
            </div>
          </header>
          <FiscalYearBanner />
          <nav style={{ background: '#fff', borderBottom: '1px solid #eef2f5', padding: '3px 20px', display: 'flex', flexWrap: 'wrap', overflow: 'visible', alignItems: 'stretch', position: 'relative', zIndex: 99 }}>
            <ClassicMenu orientation="h" accent={GREEN} active={page} onSelect={onNavigate} />
          </nav>
        </div>
        {body}
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'stretch' }}>
      {/* 左：メニュー列（画面の高さに固定。折りたたみ可） */}
      <SideNav accent={GREEN} active={page} onSelect={onNavigate} collapsed={navCollapsed} onToggle={navToggle} />

      {/* 右：本文列 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* アプリバー＋年度帯：上部に固定（スクロールしない） */}
        <div ref={headerRef} data-app-top style={{ position: 'sticky', top: 0, zIndex: 100 }}>
          <header
            style={{
              background: '#fff',
              borderBottom: '1px solid #dde4ea',
              minHeight: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              // 幅が足りないときは、左側（区分・年度）と右側（調査・印刷／各種設定／ユーザー）を別の行に分ける（確認メモ #66）
              flexWrap: 'wrap',
              rowGap: 6,
              columnGap: 12,
              padding: '6px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto', maxWidth: '100%' }}>
              <DivisionPicker accent={GREEN} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#68757f', flex: 'none', marginLeft: 'auto' }}>
              <HeaderTools accent={GREEN} page={page} onNavigate={onNavigate} />
              <SettingsMenu accent={GREEN} active={page} onNavigate={onNavigate} />
              <NoticeBell accent={GREEN} />
              <UserMenu accent={GREEN} soft="#eef4f0" onNavigate={onNavigate} />
            </div>
          </header>
          <FiscalYearBanner />
        </div>

        {body}
        <Footer />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 伝票入力（仕訳伝票形式）本体                                          */
/*   ショートカット（Alt＋英字）を登録するため、この画面を表示しているときだけマウントする。 */
/* ------------------------------------------------------------------ */
/** 明細の行。入力予備１・２は行ごとに持つ（確認メモ #188）。tax＝行ごとの消費税コード（特殊摘要伝票のとき。空は科目からの既定。確認メモ #190） */
interface Row { id: number; tekiyo: string; gyosha: string; /** 数字のみ。先頭が '+' のときは特殊金額入力の入力途中 */ amount: string; spare1: string; spare2: string; tax: string }
/** 証憑・チェック・付箋は伝票1枚につき1つ（10/16 鈴木さん決定。確認メモ #47） */
interface VoucherFlags { check: boolean; fusen: FusenColor; shohyo: boolean }
const DEFAULT_FLAGS: VoucherFlags = { check: false, fusen: '', shohyo: true };
let rowSeq = 1;
const blankRow = (p?: Partial<Row>): Row => ({ id: rowSeq++, tekiyo: '', gyosha: '', amount: '', spare1: '', spare2: '', tax: '', ...p });
const rowBlank = (r: Row) => !r.tekiyo.trim() && !r.gyosha && !r.amount && !r.spare1.trim() && !r.spare2.trim();
/** 明細は、はじめから 6 行目まで入力できるようにしておく（確認メモ #155）。足りない分は空の行で補う */
const MIN_ROWS = 6;
const padRows = (list: Row[]): Row[] => (list.length >= MIN_ROWS ? list : [...list, ...Array.from({ length: MIN_ROWS - list.length }, () => blankRow())]);

const SUBMIT_ID = 'fe-submit';
const ENTER_ORDER = '月（年は月に合わせて自動で入ります。翌年度の予備月を入力するときだけ年の欄を直します）→ 日 →（伝票No）→ 借方科目 → 貸方科目 → 内部取引（なし／借方／貸方。←→ か Shift+Enter で切替）→（借方か貸方を選んだとき：相手区分）→ 1行目の摘要 → 取引先 →（入力予備１・２）→ 金額 → 次の行の摘要 …（最後の行の金額で Enter を押すと、新しい行を追加します）　入力が終わったら、何も入力していない行の摘要で Enter を押すと「登録する」へ移ります';
const FE_CSS = `
.fe-actions { background: #fff; }
/* 機能ボタンの下部固定は縦に十分な余裕がある画面だけ（低い画面では入力欄が隠れるため通常配置）。下端はプロトタイプの切替バー／メモボタンと重ならないよう余白を取る */
@media (min-height: 1000px) { .fe-actions { position: sticky; bottom: 0; z-index: 5; padding-bottom: 58px; box-shadow: 0 -8px 18px rgba(30,50,70,.07); } }
`;

function VoucherEntry({ onNavigate, topOffset }: { onNavigate: (label: string) => void; topOffset: number }) {
  const sess = useSession();
  const inp = sess.input;
  const toast = useToast();
  // 伝票No の採番は、予備月（翌年4〜6月）の伝票も含めて数える（確認メモ #184）
  const vouchers = useVouchers(true);
  const wide = useWidePanel('form-entry');
  // 入力区分：入力区分で起動中は固定。親区分で起動中は、配下の入力区分から選んで登録できる（確認メモ #182）
  const ed = useEntryDivision();
  const division = ed.division;
  const editable = canEnterVoucher(sess);

  // 日付：年は会計年度から自動、月・日は未入力で始める（入力は月から）
  const [month, setMonthV] = useState('');
  // 年：月を入れると自動で合う。翌年度の予備月（4〜6月）は年を直して入力する（確認メモ #184 の修正）
  const yr = useEntryYear();
  const [day, setDayV] = useState('');
  // 画面を開いたら「月」にカーソルを置く（ここから入力を始めることが分かるように）
  useEffect(() => { const t = window.setTimeout(() => document.getElementById('fe-month')?.focus(), 80); return () => window.clearTimeout(t); }, []);
  const [manualNo, setManualNo] = useState('');
  const [kari, setKari] = useState('');
  const [kashi, setKashi] = useState('');
  const [aite, setAite] = useState('');
  // 内部取引にする側（なし／借方／貸方。確認メモ #186）
  const [internalSide, setInternalSide] = useState<InternalSide>('');
  const [fundMode, setFundMode] = useState<FundMode>('自動資金');
  const [rows, setRowsRaw] = useState<Row[]>(() => padRows([]));
  /** 行を更新する。6 行に満たないときは空の行を補う（確認メモ #155） */
  const setRows = (u: Row[] | ((l: Row[]) => Row[])) => setRowsRaw((l) => padRows(typeof u === 'function' ? u(l) : u));
  const [flags, setFlagsState] = useState<VoucherFlags>(DEFAULT_FLAGS);
  const setFlags = (p: Partial<VoucherFlags>) => setFlagsState((f) => ({ ...f, ...p }));
  const [cur, setCur] = useState(0);
  const [cheque, setCheque] = useState('');
  // 消費税コード（貸借それぞれ。空は科目からの既定。確認メモ #190）
  const [kariTax, setKariTax] = useState('');
  const [kashiTax, setKashiTax] = useState('');
  const [err, setErr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [graphAcct, setGraphAcct] = useState<string | null>(null);
  const [special, setSpecial] = useState<{ row: number; total: number } | null>(null);
  const [stmt, setStmt] = useState<{ label: string; entry: { kari: string; kashi: string; tekiyo: string; amount: number } } | null>(null);
  const [hi, setHi] = useState<number[]>([]);

  // 入力内容が変わったら、登録時のメッセージを消す
  useEffect(() => { setErr(''); }, [yr.year, month, day, manualNo, kari, kashi, aite, internalSide, fundMode, rows]);

  const curIdx = Math.min(cur, rows.length - 1);
  const total = rows.reduce((s, r) => s + toNum(r.amount), 0);
  // 内部取引にする側（確認メモ #186）。内部取引科目（区分間繰入金など）を使っているときは、その側に固定する
  const autoSide = autoInternalSide(kari, kashi);
  const side: InternalSide = autoSide || internalSide;
  const partner = needsPartner({ kari, kashi, internalSide: side });
  // 特殊摘要伝票（確認メモ #189）：借方か貸方に特殊摘要科目（親）を選ぶと、摘要欄は子の一覧から選ぶ。貸借の両方を親にはできない
  const parentSide = isSpecialParent(kari) ? '借方' : isSpecialParent(kashi) ? '貸方' : '';
  const bothParent = isSpecialParent(kari) && isSpecialParent(kashi);
  const children = parentSide ? specialChildrenOf(parentSide === '借方' ? kari : kashi) : null;
  const isChild = (name: string) => !!children?.some((c) => c.value === name);
  // 消費税コード（確認メモ #190。各種設定の消費税で有効にしているとき）：通常の科目は資金科目の欄に、特殊摘要伝票は行ごとに入力する
  /** その側の資金科目の欄に消費税コードを出すか：資金科目を持つ科目（費用・収益）。強制資金のときは現金・預金以外の科目（貸借それぞれ） */
  const taxOnSide = (name: string) => {
    if (!sess.taxEntry || !name || isSpecialParent(name)) return false;
    const cls = metaOf(name)?.cls;
    return cls === '費用' || cls === '収益' || (fundMode === '強制資金' && cls !== '現預金');
  };
  const kariTaxOn = taxOnSide(kari), kashiTaxOn = taxOnSide(kashi);
  const kTax = kariTax || taxDefaultOf(kari), sTax = kashiTax || taxDefaultOf(kashi);
  const rowTaxOn = sess.taxEntry && !!children;
  const rowTaxOf = (r: Row) => r.tax || taxDefaultOf(r.tekiyo.trim());
  const issues = judgeEntry({ kari, kashi, amount: total, fundMode, internalSide: side, aite, division }, sess.env);
  const warns = issues.filter((i) => i.level === 'warn');
  const blocked = hasError(issues) || bothParent;
  const dirty = !!(kari || kashi || rows.some((r) => !rowBlank(r)));
  const nextSeq = vouchers.reduce((m, r) => Math.max(m, r.seq), 0) + 1;
  const manual = inp.voucherNo === '手入力';
  const budgetTh = sess.env.budgetCheck ? sess.env.budgetThreshold : 101;

  const patchRow = (i: number, p: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setNum2 = (set: (v: string) => void) => (raw: string) => set(raw.normalize('NFKC').replace(/[^0-9]/g, '').slice(0, 2));

  /* ---- 行の操作 ---- */
  const rowAdd = () => { if (!editable) return; setRows((list) => [...list, blankRow()]); setCur(rows.length); focusId(`fe-tek-${rows.length}`); };
  const rowInsert = () => { if (!editable) return; setRows((list) => [...list.slice(0, curIdx), blankRow(), ...list.slice(curIdx)]); setCur(curIdx); focusId(`fe-tek-${curIdx}`); };
  /** 行ごとのボタン用：i 行目の上に挿入／i 行目を削除 */
  const insertAt = (i: number) => { if (!editable) return; setRows((list) => [...list.slice(0, i), blankRow(), ...list.slice(i)]); setCur(i); focusId(`fe-tek-${i}`); };
  /** 行を削除する。6 行に満たなくなる分は、下に空の行を補う */
  const deleteAt = (i: number) => {
    if (!editable) return;
    const next = Math.min(i, Math.max(MIN_ROWS, rows.length - 1) - 1);
    setRows((list) => list.filter((_, j) => j !== i));
    setCur(next);
    focusId(`fe-tek-${next}`);
  };
  const rowDelete = () => deleteAt(curIdx);

  /* ---- Enter 送り ---- */
  const afterTekiyo = (i: number, v: string) => {
    const r = rows[i];
    // 何も入力していない行（その下の行もすべて空）の摘要で Enter → 入力が終わったとみなして「登録する」へ
    if (i > 0 && rowBlank({ ...r, tekiyo: v }) && rows.slice(i + 1).every(rowBlank)) { focusId(SUBMIT_ID); return; }
    focusId(`fe-gyo-${i}`);
  };
  /** 金額欄で Enter：特殊金額入力（＋金額）なら按分。それ以外は次の行へ進み、最後の行なら新しい行を追加する（確認メモ #154）。Shift+Enter：この行の下に1行挿入 */
  const afterAmount = (i: number) => {
    const r = rows[i];
    if (r.amount.startsWith('+')) { const n = toNum(r.amount); if (n > 0) setSpecial({ row: i, total: n }); return; }
    if (rowBlank(r)) { focusId(SUBMIT_ID); return; }
    if (toNum(r.amount) <= 0) { setErr(`${i + 1}行目の金額を入力してください。`); return; }
    if (i === rows.length - 1) { rowAddAfter(i); return; }
    setCur(i + 1);
    focusId(`fe-tek-${i + 1}`);
  };
  const rowAddAfter = (i: number) => { if (!editable) return; setRows((list) => [...list.slice(0, i + 1), blankRow(), ...list.slice(i + 1)]); setCur(i + 1); focusId(`fe-tek-${i + 1}`); };

  /* ---- 登録 ---- */
  const basicError = (): string => {
    const d = parseInt(day, 10);
    if (!parseEntryDate(yr.year, month).ok || !(d >= 1 && d <= 31)) return `伝票日付（年・月・日）を正しく入力してください。入力できるのは、${ENTRY_DATE_RANGE}です。`;
    if (manual && !manualNo.trim()) return '伝票Noを入力してください（入力の変更で自動採番に切り替えられます）。';
    if (!kari || !kashi) return '借方科目・貸方科目を入力してください。';
    if (bothParent) return '借方と貸方の両方を特殊摘要科目（親）にすることはできません。どちらかを通常の科目にしてください。';
    const plus = rows.findIndex((r) => r.amount.startsWith('+'));
    if (plus >= 0) return `${plus + 1}行目：特殊金額入力（＋）は、金額欄で Enter を押して確定してください。`;
    const noAmt = rows.findIndex((r) => !rowBlank(r) && toNum(r.amount) <= 0);
    if (noAmt >= 0) return `${noAmt + 1}行目の金額が未入力です。`;
    if (!rows.some((r) => toNum(r.amount) > 0)) return '金額を入力した行がありません。摘要・取引先・金額を1行以上入力してください。';
    if (children) { const ng = rows.findIndex((r) => toNum(r.amount) > 0 && !isChild(r.tekiyo.trim())); if (ng >= 0) return `${ng + 1}行目：摘要欄で特殊摘要科目（子）を選んでください。`; }
    return '';
  };
  /** 登録後・中止後の初期化。keepAccounts＝直前の借方・貸方科目を残す（入力の変更「登録後も直前の科目を残す」。確認メモ #47） */
  const reset = (keepAccounts = false) => {
    if (!keepAccounts) { setKari(''); setKashi(''); setKariTax(''); setKashiTax(''); }
    setAite(''); setInternalSide(''); setFundMode('自動資金');
    setRows([blankRow()]); setCur(0); setCheque(''); setManualNo(''); setFlagsState(DEFAULT_FLAGS);
  };
  const finalize = () => {
    const list = rows.filter((r) => toNum(r.amount) > 0);
    if (!list.length) return;
    // 決算月（月に 99）は 3月、翌年度の予備月（翌年の 4〜6月）は 4〜6月の日付として持ち、term で区別する（確認メモ #184）
    const em = parseEntryDate(yr.year, month);
    const date = `${em.month}/${parseInt(day, 10)}`;
    const seq = getVouchers().reduce((m, r) => Math.max(m, r.seq), 0) + 1;
    const no = manual && manualNo.trim() ? manualNo.trim() : `${em.month}-${seq}`;
    const ids = list.map((r) => {
      const amt = toNum(r.amount);
      // 特殊摘要伝票：親の側の科目は、その行で選んだ子の科目で登録する（確認メモ #189）
      const child = children ? r.tekiyo.trim() : '';
      const k = child && parentSide === '借方' ? child : kari, s = child && parentSide === '貸方' ? child : kashi;
      // 消費税コード（確認メモ #190）：通常の科目は伝票に 1 つ（貸借それぞれ）、特殊摘要科目の側は行ごと。税額は内税の自動計算
      const kt = parentSide === '借方' ? (rowTaxOn ? rowTaxOf(r) : undefined) : kariTaxOn ? kTax : undefined;
      const st = parentSide === '貸方' ? (rowTaxOn ? rowTaxOf(r) : undefined) : kashiTaxOn ? sTax : undefined;
      const vch = addVoucher({ kind: children ? '特摘' : '伝票', seq, no, date, kari: k, kashi: s, tekiyo: r.tekiyo.trim(), amount: amt, service: division, gyosha: r.gyosha || undefined, shohyo: inp.shohyo ? flags.shohyo : true, cheque: cheque.trim() || undefined, spare1: (inp.spare1 && r.spare1.trim()) || undefined, spare2: (inp.spare2 && r.spare2.trim()) || undefined, internal: partner || undefined, internalSide: side || undefined, kariTax: kt, kariTaxAmt: kt ? taxAmountOf(kt, amt) : undefined, kashiTax: st, kashiTaxAmt: st ? taxAmountOf(st, amt) : undefined, term: em.term });
      if (flags.check || flags.fusen) updateVoucher(vch.id, { check: flags.check, fusen: flags.fusen });
      if (partner) setPartner(vch.id, aite);
      return vch.id;
    });
    setHi(ids);
    const sum = list.reduce((s, r) => s + toNum(r.amount), 0);
    const w = watchedStatement(kari, kashi);
    const dep = isDepreciationAccount(kari) || isDepreciationAccount(kashi);
    if (w) setStmt({ label: w.label, entry: { kari, kashi, tekiyo: list[0].tekiyo, amount: sum } });
    reset(sess.input.keepLast);
    toast.show(`伝票No ${no}（${list.length} 行・合計 ${sum.toLocaleString('ja-JP')} 円）を登録しました${dep ? '。固定資産の登録は「減価償却」メニューで行ってください' : ''}`);
    // 科目を残す設定のときは、次の伝票の1行目（摘要）から続けて入力できるようにする
    focusId(sess.input.keepLast ? 'fe-tek-0' : 'fe-month');
  };
  const submit = (): void => {
    if (!editable) return;
    const be = basicError();
    if (be) { setErr(be); return; }
    if (blocked) { setErr('登録できない仕訳です。入力欄の下に表示しているエラーの内容を確認してください。'); focusId(issues.find((i) => i.level === 'error')?.field === 'aite' ? 'fe-aite' : issues.find((i) => i.level === 'error')?.field === 'kari' ? 'fe-kari' : 'fe-kashi'); return; }
    if (warns.length) { setConfirmOpen(true); return; }
    // 登録の前に「登録しますか？」と確認する（確認メモ #153）。警告の確認を経たときは、そちらで続行を選んでいるので重ねて聞かない
    tools.askRegister(finalize);
  };

  const tools = useEntryTools({
    format: '伝票入力',
    accent: GREEN,
    onNavigate,
    toast: toast.show,
    dirty,
    service: division,
    month,
    day,
    kari,
    kashi,
    lines: rows.map((r) => ({ kari, kashi, tekiyo: r.tekiyo, gyosha: r.gyosha || undefined, amount: String(toNum(r.amount) || '') })),
    multiRow: true,
    rowLabel: `${curIdx + 1}行目`,
    flags,
    onFlags: setFlags,
    fundMode,
    onFundMode: setFundMode,
    onSubmit: submit,
    onCancel: () => { reset(); focusId('fe-month'); },
    onRowAdd: rowAdd,
    onRowInsert: rowInsert,
    onRowDelete: rowDelete,
    internal: partner,
    internalSide: side,
    // 側を切り替えてもカーソルは動かさない（続けて ←→ で選び直せるように）。相手区分へは Enter で進む
    onInternalSide: (x) => { setInternalSide(x); if (!x) setAite(''); },
    internalLocked: !!autoSide,
    internalId: 'fe-internal',
    onInternalNext: () => focusId(partner ? 'fe-aite' : 'fe-tek-0'),
    blocked,
    onInternal: () => { if (autoSide) return; const next = INTERNAL_SIDES[(INTERNAL_SIDES.indexOf(side) + 1) % INTERNAL_SIDES.length]; setInternalSide(next); if (!next) setAite(''); focusId('fe-internal'); },
    onRegistered: setHi,
    year: yr.year,
    onPickDate: (m, d, y) => { setMonthV(m); setDayV(d); if (y) yr.set(y); },
    onOpenPanel: () => wide.setCollapsed(false),
    submitId: SUBMIT_ID,
    enterOrder: ENTER_ORDER,
  });

  // 参照パネルを開くと本文を左に押し出す：旧レイアウト（以前の動き）と、新レイアウトで画面の幅が 1600px 以上のとき（確認メモ #243）
  const pushOut = usePanelPush(wide, useLayoutMode() === 'classic');
  const smallInput: CSSProperties = { padding: '4px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit' };
  /** 明細の列：コード（行番号）｜摘要・取引先｜（入力予備１）｜（入力予備２）｜（消費税コード）｜金額｜行の操作（挿入・削除）。入力予備は入力の変更で有効にしたときだけ（行ごとに持つ。確認メモ #188）、消費税コードは特殊摘要伝票のときだけ（確認メモ #190） */
  const sp1 = inp.spare1, sp2 = inp.spare2;
  const extraCols = (sp1 ? 1 : 0) + (sp2 ? 1 : 0) + (rowTaxOn ? 1 : 0);
  const GRID = ['52px', 'minmax(0,1fr)', ...(sp1 ? ['96px'] : []), ...(sp2 ? ['96px'] : []), ...(rowTaxOn ? ['172px'] : []), extraCols ? '150px' : '170px', extraCols ? '116px' : '158px'].join(' ');
  const rowBtn: CSSProperties = { padding: '3px 7px', borderRadius: 6, border: '1px solid #cfd8e0', background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#5b6773' };
  const paperDate: CSSProperties = { ...dateInput, border: '1px solid transparent', borderRadius: 4, background: 'transparent' };
  const divisionName = division.replace(/^\d+\s*/, '');
  const filled = rows.filter((r) => !rowBlank(r)).length;

  return (
    <>
      {/* メイン（フォームカード） */}
      <main
        style={{
          flex: 1,
          padding: 28,
          // 右側は参照パネルの開閉タブと重ならないよう、タブの幅の分だけ空ける（パネル自体は本文に重ねて出すので、開いても本文は動かない）
          paddingRight: (pushOut ? WIDE_WIDTH : 0) + WIDE_TAB_SPACE,
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          justifyContent: 'center',
          transition: 'padding-right .28s ease',
          minWidth: 0,
        }}
      >
        <div
          className="ef-scope"
          style={{
            ...scopeStyle(GREEN),
            flex: '1 1 auto',
            minWidth: 0,
            maxWidth: 1280,
            background: '#fff',
            border: '1px solid #dde4ea',
            borderRadius: 16,
            boxShadow: '0 6px 26px rgba(30,50,70,.07)',
          }}
        >
          <EntryStyles />
          <PaperStyles />
          <style>{FE_CSS}</style>
          {/* 形式の切替（現在の形式を明示）。入力の変更・キーボード操作一覧は、下の入力補助に置く（確認メモ #156） */}
          <div style={{ borderRadius: '15px 15px 0 0', overflow: 'hidden' }}>{tools.topBar}</div>
          {tools.banner}

          <div style={{ padding: '18px 22px 8px', background: '#eef1ef', borderBottom: '1px solid #e2e8ee' }}>
            {/* 伝票用紙 */}
            <div className="pp-sheet" style={{ padding: '16px 20px 18px' }}>
              {/* 伝票に付けた付箋：用紙の右端に貼る（伝票1枚につき1つ） */}
              <FusenTab color={flags.fusen} offset={-10} top={64} />
              {/* 表題行：仕訳伝票／拠点区分／取引区分（自動判定）／定型仕訳 */}
              <PaperTitle
                title="仕訳伝票"
                division={`${divisionName} 拠点区分`}
                badge={<span style={{ fontSize: 12, fontWeight: 700, color: GREEN, whiteSpace: 'nowrap' }}>仕訳伝票形式（複数行）{children && <span data-special-voucher title="借方か貸方に特殊摘要科目（親）を選んでいます。摘要欄では、特殊摘要科目（子）を選びます" style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 10, background: '#fff3e0', color: '#b25e00', border: '1px solid #f3d6a8', fontSize: 12, fontWeight: 800 }}>特殊摘要伝票</span>}　<span style={{ color: '#7a8794', fontWeight: 500 }}>{sess.fiscalYear}</span></span>}
                right={tools.templateButton}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, borderLeft: `1px solid ${PAPER.lineSoft}` }}>
                  <span style={{ fontSize: 12, color: '#8895a3' }}>取引区分（科目から自動判定）</span>
                  <TorihikiBadge kari={kari} kashi={kashi} force={fundMode === '強制資金'} blocked={blocked} right={tools.fundSwitch} />
                </div>
              </PaperTitle>

              {/* 1段目：入力区分／年月日／伝票No */}
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                <PaperBox label="入力区分" grow>
                  <EntryDivisionField ctl={ed} id="fe-division" disabled={!editable} onCommit={() => focusId('fe-month')} />
                </PaperBox>
                <div className="ef-field" style={{ display: 'flex', alignItems: 'center' }}>
                  <PaperDate
                    label="伝票日付"
                    yearInput={<input id="fe-year" className="ef-input pp-input" aria-label="年" title={ENTRY_YEAR_HELP} disabled={!editable} value={yr.year} onChange={(e) => yr.edit(e.target.value)} onFocus={(e) => e.currentTarget.select()} onKeyDown={onEnter(() => focusId('fe-month'))} inputMode="numeric" autoComplete="off" style={paperDate} />}
                    note={<EntryMonthNote month={month} year={yr.year} />}
                    month={<input id="fe-month" className="ef-input pp-input" aria-label="月" title={ENTRY_MONTH_HELP} disabled={!editable} value={month} onChange={(e) => setNum2((v) => { setMonthV(v); yr.onMonth(v); })(e.target.value)} onFocus={(e) => e.currentTarget.select()} onKeyDown={onEnter(() => { if (parseEntryDate(yr.year, month).term === '決算' && !day) setDayV('31'); focusId('fe-day'); })} inputMode="numeric" autoComplete="off" style={paperDate} />}
                    day={<input id="fe-day" className="ef-input pp-input" aria-label="日" disabled={!editable} value={day} onChange={(e) => setNum2(setDayV)(e.target.value)} onFocus={(e) => e.currentTarget.select()} onKeyDown={onEnter(() => focusId(manual ? 'fe-no' : 'fe-kari'))} inputMode="numeric" autoComplete="off" style={paperDate} />}
                  />
                </div>
                <div className="ef-field" style={{ display: 'flex' }}>
                  <PaperBox label={<span>伝票<span className="pp-sub">No</span></span>} width={manual ? 190 : undefined}>
                    {manual ? (
                      <input id="fe-no" className="ef-input pp-input" disabled={!editable} value={manualNo} onChange={(e) => setManualNo(e.target.value)} onKeyDown={onEnter(() => focusId('fe-kari'))} placeholder="例 8-101" autoComplete="off" style={{ height: 34, width: '100%', padding: '0 8px', fontSize: 14 }} />
                    ) : (
                      <span className="pp-ro" style={{ whiteSpace: 'nowrap' }}>自動採番（<span className="pp-num" style={{ color: '#22303c', fontWeight: 700 }}>{parseEntryDate(yr.year, month).month || 8}-{nextSeq}</span>）</span>
                    )}
                  </PaperBox>
                </div>
              </div>

              {/* 2段目：借方（BS&PL）／貸方（BS&PL）と、その下の資金（CF） */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, marginBottom: 12 }}>
                {([
                  { side: '借方', id: 'fe-kari', color: BLUE, value: kari, other: kashi, set: (v: string) => { setKari(v); setKariTax(''); }, commit: () => focusId('fe-kashi'), state: fieldState(issues, 'kari', 'pair'), msg: fieldMessage(issues, 'kari'), taxOn: kariTaxOn, tax: kTax, setTax: setKariTax },
                  { side: '貸方', id: 'fe-kashi', color: PINK, value: kashi, other: kari, set: (v: string) => { setKashi(v); setKashiTax(''); }, commit: () => focusId('fe-internal'), state: bothParent ? 'error' as const : fieldState(issues, 'kashi', 'pair'), msg: bothParent ? '借方と貸方の両方を特殊摘要科目（親）にすることはできません' : fieldMessage(issues, 'kashi', 'pair'), taxOn: kashiTaxOn, tax: sTax, setTax: setKashiTax },
                ]).map((s) => (
                  <div key={s.id} className="pp-table ef-field" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="pp-row" style={{ gridTemplateColumns: '64px minmax(0,1fr)' }}>
                      <div className="pp-lab" style={{ color: s.color }}>
                        <span><FieldLabel color={s.color} style={{ fontSize: 14, marginBottom: 0, display: 'inline' }}>{s.side}科目</FieldLabel><span className="pp-sub">BS&amp;PL</span></span>
                      </div>
                      <div className="pp-cell" style={{ padding: '7px 8px' }}>
                        <ComboField id={s.id} kind="account" value={s.value} onChange={s.set} onCommit={s.commit} disabled={!editable} invalid={s.state} message={s.msg} placeholder={`${s.side}科目：コード・科目名・フリガナ`} fontSize={14.5} padY={10} listWidth={400} />
                      </div>
                    </div>
                    <div className="pp-row" style={{ gridTemplateColumns: '64px minmax(0,1fr)' }}>
                      <div className="pp-lab pp-band"><span>資金科目<span className="pp-sub">CF</span></span></div>
                      <div className="pp-cell pp-col pp-auto" style={{ padding: '2px 8px 7px' }}>
                        <FundAccountLine name={s.value} other={s.other} mode={fundMode} />
                        <BudgetHintLive account={s.value} threshold={budgetTh} onOpen={() => setGraphAcct(s.value)} />
                        {/* 消費税コード（確認メモ #190）：資金科目の欄に置く。強制資金で貸借の両方に資金科目があるときは、それぞれに出る */}
                        {s.taxOn && (
                          <label data-tax-side={s.side} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 12, minWidth: 0, flexWrap: 'wrap' }}>
                            <span style={{ flex: 'none', fontWeight: 700, color: '#8290a0' }}>消費税コード</span>
                            <select id={s.side === '借方' ? 'fe-tax-kari' : 'fe-tax-kashi'} className="ef-input" aria-label={`${s.side}の消費税コード`} disabled={!editable} value={s.tax} onChange={(e) => s.setTax(e.target.value)} style={{ padding: '3px 6px', border: '1px solid #cfd8e0', borderRadius: 7, background: '#fff', fontSize: 14, fontFamily: 'inherit' }}>{TAX_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                            {taxAmountOf(s.tax, total) > 0 && <span data-tax-amount title="内税として、金額から自動で計算した税額です" style={{ color: '#7a8794', whiteSpace: 'nowrap' }}>うち税額 {taxAmountOf(s.tax, total).toLocaleString('ja-JP')} 円</span>}
                          </label>
                        )}
                        {isSpecialParent(s.value) && <div data-special-parent style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: '#b25e00' }}>特殊摘要科目（親）：明細の摘要欄で、子の科目を選びます{sess.taxEntry ? '。消費税コードは行ごとに入力します' : ''}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 内部取引相手区分の枠と、伝票の印（Seq No・チェック・証憑・付箋）の枠を横並びに置く（別々の枠。10/16 鈴木さん指示） */}
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="ef-field" data-internal-area data-on={partner ? '1' : '0'} data-side={side || 'なし'} style={{ flex: '1 1 480px', display: 'grid', gridTemplateColumns: 'auto minmax(0,320px)', gap: 16, alignItems: 'center', padding: '10px 14px', border: '1px solid ' + (partner ? '#e0d6f3' : '#e2e8ee'), background: partner ? '#faf7ff' : '#f1f3f5', borderRadius: 12, transition: 'background .15s, border-color .15s' }}>
                <div style={{ alignSelf: 'center' }}>{tools.internalSwitch}</div>
                <div style={{ opacity: partner ? 1 : 0.5, transition: 'opacity .15s' }}>
                  <FieldLabel color={partner ? '#6b3fb5' : '#8895a3'}>内部取引相手区分{partner ? `（${side}が内部取引・必須）` : ''}</FieldLabel>
                  <ComboField id="fe-aite" title={!partner ? '左の「内部取引」で借方か貸方を選ぶと入力できます（内部取引科目を選ぶと、その側に自動で決まります）' : undefined} kind="service" value={aite} onChange={setAite} onCommit={() => focusId('fe-tek-0')} disabled={!editable || !partner} invalid={partner ? fieldState(issues, 'aite') : undefined} message={partner ? fieldMessage(issues, 'aite') : undefined} placeholder="コード・区分名・フリガナ" />
                </div>
              </div>
              <VoucherMarks variant="panel" seq={nextSeq} flags={flags} onChange={setFlags} disabled={!editable} viewOnly={tools.viewOnly} showShohyo={inp.shohyo} />
              </div>

              {/* 3段目：明細（コード｜摘要／取引先｜金額｜行の操作）。はじめから 6 行目まで入力できる（確認メモ #155） */}
              <div className="pp-table" style={{ gridTemplateColumns: '1fr' }}>
                <div className="pp-row" style={{ gridTemplateColumns: GRID }}>
                  <div className="pp-lab">コード<span className="pp-sub">行</span></div>
                  <div className="pp-lab" style={{ fontSize: 14 }}>{children ? '特殊摘要科目（子）／取引先' : '摘要／取引先'}</div>
                  {sp1 && <div className="pp-lab" title="入力予備１（行ごとに入力します）" style={{ fontSize: 14 }}>予備１</div>}
                  {sp2 && <div className="pp-lab" title="入力予備２（行ごとに入力します）" style={{ fontSize: 14 }}>予備２</div>}
                  {rowTaxOn && <div className="pp-lab" style={{ fontSize: 14 }}>消費税コード</div>}
                  <div className="pp-lab" style={{ fontSize: 14 }}>金額</div>
                  <div className="pp-lab"><span>行の操作<span className="pp-sub">挿入／削除</span></span></div>
                </div>
                {rows.map((r, i) => {
                  const on = i === curIdx;
                  const plus = r.amount.startsWith('+');
                  return (
                    <div key={r.id} className="pp-row" style={{ gridTemplateColumns: GRID }}>
                      <div className="pp-cell pp-center" style={{ padding: '4px 4px', background: on ? '#f7fbf9' : undefined }}>
                        <button type="button" tabIndex={-1} onClick={() => { setCur(i); focusId(`fe-tek-${i}`); }} title={`${i + 1}行目を行の操作の対象にする`} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', fontSize: 14, fontWeight: 700, color: on ? GREEN : '#9aa5b1' }}>
                          <span className="ef-rowno pp-num">{String(i + 1).padStart(2, '0')}</span>
                          <span className="ef-rownow" style={{ padding: '1px 5px', borderRadius: 7, background: GREEN, color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>入力中</span>
                        </button>
                      </div>
                      <div className="pp-cell" style={{ padding: '6px 8px', gap: 8, background: on ? '#f7fbf9' : undefined }}>
                        <div style={{ flex: '1.4 1 0', minWidth: 0 }}>
                          <ComboField id={`fe-tek-${i}`} kind="summary" freeText={!children} options={children ?? undefined} value={r.tekiyo} onChange={(v) => patchRow(i, { tekiyo: v })} onCommit={(v) => afterTekiyo(i, v)} onFocusField={() => setCur(i)} disabled={!editable} invalid={children && r.tekiyo.trim() && !isChild(r.tekiyo.trim()) ? 'error' : undefined} message={children && r.tekiyo.trim() && !isChild(r.tekiyo.trim()) ? '特殊摘要科目（子）から選んでください' : undefined} placeholder={children ? '特殊摘要科目（子）：コード・科目名・フリガナ' : inp.tekiyoCode ? '摘要（コード・フリガナでも検索）' : '摘要を入力'} padY={8} listWidth={360} />
                        </div>
                        <span aria-hidden style={{ flex: 'none', color: PAPER.lineSoft, fontSize: 16 }}>／</span>
                        <div style={{ flex: '1 1 0', minWidth: 0 }}>
                          <ComboField id={`fe-gyo-${i}`} kind="vendor" value={r.gyosha} onChange={(v) => patchRow(i, { gyosha: v })} onCommit={() => focusId(sp1 ? `fe-sp1-${i}` : sp2 ? `fe-sp2-${i}` : `fe-amt-${i}`)} onFocusField={() => setCur(i)} disabled={!editable} placeholder="取引先（任意）" padY={8} listWidth={300} />
                        </div>
                      </div>
                      {sp1 && <div className="pp-cell" style={{ padding: '6px 6px', background: on ? '#f7fbf9' : undefined }}><input id={`fe-sp1-${i}`} className="ef-input pp-input" aria-label={`${i + 1}行目の入力予備１`} disabled={!editable} value={r.spare1} onChange={(e) => patchRow(i, { spare1: e.target.value })} onFocus={() => setCur(i)} onKeyDown={onEnter(() => focusId(sp2 ? `fe-sp2-${i}` : `fe-amt-${i}`))} autoComplete="off" style={{ width: '100%', padding: '8px 6px', fontSize: 14 }} /></div>}
                      {sp2 && <div className="pp-cell" style={{ padding: '6px 6px', background: on ? '#f7fbf9' : undefined }}><input id={`fe-sp2-${i}`} className="ef-input pp-input" aria-label={`${i + 1}行目の入力予備２`} disabled={!editable} value={r.spare2} onChange={(e) => patchRow(i, { spare2: e.target.value })} onFocus={() => setCur(i)} onKeyDown={onEnter(() => focusId(`fe-amt-${i}`))} autoComplete="off" style={{ width: '100%', padding: '8px 6px', fontSize: 14 }} /></div>}
                      {rowTaxOn && (
                        <div className="pp-cell pp-col" style={{ padding: '5px 6px', gap: 2, justifyContent: 'center', background: on ? '#f7fbf9' : undefined }}>
                          <select id={`fe-tax-${i}`} className="ef-input pp-input" aria-label={`${i + 1}行目の消費税コード`} disabled={!editable} value={rowTaxOf(r)} onChange={(e) => patchRow(i, { tax: e.target.value })} onFocus={() => setCur(i)} style={{ width: '100%', padding: '6px 4px', fontSize: 14, fontFamily: 'inherit' }}>{TAX_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                          {taxAmountOf(rowTaxOf(r), toNum(r.amount)) > 0 && <span data-tax-amount title="内税として、金額から自動で計算した税額です" style={{ fontSize: 12, color: '#7a8794', textAlign: 'right' }}>うち税額 {taxAmountOf(rowTaxOf(r), toNum(r.amount)).toLocaleString('ja-JP')} 円</span>}
                        </div>
                      )}
                      <div className="pp-cell" style={{ padding: '6px 8px', background: on ? '#f7fbf9' : undefined }}>
                        <input
                          id={`fe-amt-${i}`}
                          className="ef-input pp-input"
                          aria-label={`${i + 1}行目の金額`}
                          disabled={!editable}
                          value={plus ? '＋' + fmtNum(r.amount) : fmtNum(r.amount)}
                          onChange={(e) => { const raw = e.target.value.normalize('NFKC'); const digits = raw.replace(/[^0-9]/g, '').slice(0, 12); patchRow(i, { amount: (/^\s*\+/.test(raw) ? '+' : '') + digits }); }}
                          onFocus={(e) => { setCur(i); e.currentTarget.select(); }}
                          onKeyDown={(e) => { if (e.key !== 'Enter' || isIme(e)) return; e.preventDefault(); if (e.shiftKey) rowAddAfter(i); else afterAmount(i); }}
                          title="Enter で次の行へ（最後の行では新しい行を追加）、Shift+Enter でこの行の下に1行挿入。先頭に「＋」を付けて金額を入力し Enter を押すと、特殊金額入力（区分別の按分）が開きます"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          style={{ width: '100%', padding: '8px 10px', textAlign: 'right', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderColor: plus ? '#6b3fb5' : 'transparent' }}
                        />
                      </div>
                      <div className="pp-cell pp-col" style={{ padding: '4px 6px', gap: 4, alignItems: 'center', justifyContent: 'center', background: on ? '#f7fbf9' : undefined }}>
                        {!tools.viewOnly && <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button type="button" className="ef-act" tabIndex={-1} disabled={!editable} onClick={() => insertAt(i)} title={editable ? `${i + 1}行目の上に1行挿入` : tools.reason} style={rowBtn}>挿入</button>
                          <button type="button" className="ef-act" tabIndex={-1} disabled={!editable} onClick={() => deleteAt(i)} title={editable ? `${i + 1}行目を削除` : tools.reason} style={{ ...rowBtn, color: '#c0392b', borderColor: '#f2c9c2' }}>削除</button>
                        </div>}
                      </div>
                    </div>
                  );
                })}
                {/* 行追加・行数 */}
                <div className="pp-row" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="pp-cell" style={{ padding: '6px 10px', fontSize: 12, color: '#8290a0' }}>
                    {!tools.viewOnly && <button type="button" className="ef-act" tabIndex={-1} disabled={!editable} onClick={rowAdd} title={editable ? '最後に1行追加します（最後の行の金額欄で Enter を押しても追加できます）' : tools.reason} style={{ padding: '4px 11px', borderRadius: 7, border: '1px dashed #b9c4cf', background: '#fff', color: '#48565f', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginRight: 10 }}>＋ 行追加</button>}
                    <span data-row-count>入力済み {filled} 行（全 {rows.length} 行）</span>
                    <span style={{ marginLeft: 12, color: '#9aa5b1' }}>金額欄で Enter：次の行へ（最後の行では行を追加）／入力が終わったら、空の行の摘要で Enter を押すと「登録する」へ移ります</span>
                  </div>
                </div>
                {/* 下段：小切手No（表示項目で有効なとき）｜合計。Seq No・チェック・証憑・付箋は上の内部取引の行に横並び */}
                <div className="pp-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 170px' }}>
                  <div className="pp-cell" style={{ padding: '6px 12px', background: PAPER.fill, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {inp.cheque && <><span className="pp-lab" style={{ fontSize: 14 }}>小切手No</span><label className="ef-field" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><input className="ef-input pp-input" disabled={!editable} value={cheque} onChange={(e) => setCheque(e.target.value)} placeholder="任意" style={{ ...smallInput, width: 140 }} /></label></>}
                  </div>
                  <div className="pp-cell" style={{ padding: 0 }}>
                    <div className="pp-foot" style={{ width: '100%' }}>
                      <span className="pp-lab" style={{ fontSize: 14 }}>合計</span>
                      <span className="pp-val pp-grow pp-num"><span className="pp-ro pp-ro-fill" style={{ justifyContent: 'flex-end', fontSize: 18, fontWeight: 800, color: '#22303c' }}><span style={{ fontSize: 14, color: '#8290a0', marginRight: 4 }}>¥</span>{total.toLocaleString('ja-JP')}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <div role="alert" style={{ flex: 1, minHeight: 20, color: '#c0392b', fontSize: 14, fontWeight: 600 }}>{err}</div>
              {tools.submitButton}
            </div>
          </div>

          {/* 機能ボタン（常に表示。入力補助／参照） */}
          <div className="fe-actions" style={{ padding: '10px 18px 14px', borderTop: '1px solid #e2e8ee', borderRadius: '0 0 15px 15px' }}>
            {tools.actionBar}
          </div>
        </div>
      </main>
      <ToastView msg={toast.msg} />
      {tools.dialogs}
      <EntryConfirmModal
        open={confirmOpen}
        kind={judgeTorihiki(kari, kashi, fundMode === '強制資金').kind}
        issues={warns}
        onClose={() => setConfirmOpen(false)}
        onProceed={(dont) => {
          if (dont) setSession({ env: { ...sess.env, ...(warns.some((w) => w.code === 'expense') ? { confirmExpense: false } : {}), ...(warns.some((w) => w.code === 'income') ? { confirmIncome: false } : {}) } });
          setConfirmOpen(false);
          finalize();
        }}
        accent={GREEN}
      />
      <BudgetGraphModal open={!!graphAcct} onClose={() => setGraphAcct(null)} account={graphAcct ?? ''} />
      <SpecialAmountModal
        key={special ? `${special.row}-${special.total}-${kari}-${kashi}` : 'none'}
        open={special != null}
        total={special?.total ?? 0}
        account={specialRatesOf(sess, kari).byAccount ? kari : kashi}
        onClose={() => { setSpecial(null); if (special) focusId(`fe-amt-${special.row}`); }}
        accent={GREEN}
        onOk={(parts) => {
          const at = special?.row ?? 0;
          const r = rows[at];
          setSpecial(null);
          if (!editable || !r) return;
          if (!kari || !kashi) { toast.show('先に借方・貸方の科目を選んでください'); focusId(kari ? 'fe-kashi' : 'fe-kari'); return; }
          const list = parts.filter((p) => p.amount > 0);
          const em = parseEntryDate(yr.year, month);
          const date = `${em.ok ? em.month : 8}/${parseInt(day, 10) || 1}`;
          const ids = list.map((p) => addVoucher({ kind: '伝票', date, kari, kashi, tekiyo: `${r.tekiyo.trim() || '特殊金額入力'}（${p.division.split(' ')[1] ?? p.division}）`, amount: p.amount, service: p.division, gyosha: r.gyosha || undefined, shohyo: inp.shohyo ? flags.shohyo : true, term: em.term }).id);
          setHi(ids);
          // 按分した行は登録済みになるので、入力中の伝票からは外す
          setRows((l) => l.filter((_, j) => j !== at));
          const next = Math.min(at, Math.max(MIN_ROWS, rows.length - 1) - 1);
          setCur(next);
          focusId(`fe-tek-${next}`);
          toast.show(`特殊金額入力：区分別に ${list.length} 枚の伝票を登録しました`);
        }}
      />
      <AttachedStatementModal open={!!stmt} statement={stmt?.label ?? ''} entry={stmt?.entry ?? null} onClose={() => setStmt(null)} onDone={(reg) => { toast.show(reg ? `${stmt?.label}に登録しました` : '明細書には登録しませんでした'); setStmt(null); }} accent={GREEN} />

      {/* 参照パネル（右端固定・折りたたみ。日記帳〔当年／前年〕／元帳１／元帳２／残高照合） */}
      <WidePanel accent={GREEN} layout="side" state={wide} top={topOffset} highlightIds={hi} returnTo="伝票入力" onNavigate={onNavigate} />
    </>
  );
}

/** 単一形式／振替伝票形式／振替単一形式：仕訳伝票形式と同じ右側の参照パネル（日記帳〔当年／前年〕／元帳１・２／残高照合）を付ける。
 *  パネルの状態（表示内容・開閉）は4形式で共有（storageKey 'form-entry'）。パネルは本文に重ねて出す（開閉タブの分だけ右を空ける） */
function EntryWithPanel({ page, topOffset, onNavigate, children }: { page: string; topOffset: number; onNavigate: (label: string) => void; children: ReactNode }) {
  const wide = useWidePanel('form-entry');
  const pushOut = usePanelPush(wide, useLayoutMode() === 'classic');
  return (
    <>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingRight: (pushOut ? WIDE_WIDTH : 0) + (WIDE_TAB_SPACE - 28), transition: 'padding-right .28s ease' }}>{children}</div>
      <WidePanel accent={GREEN} layout="side" state={wide} top={topOffset} returnTo={page} onNavigate={onNavigate} />
    </>
  );
}
