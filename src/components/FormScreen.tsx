// Screen 1: フォーム型（`仕訳伝票_フォーム型.dc.html`）
// アプリバー + 横スクロールナビ + 中央フォームカード（仕訳伝票形式＝複数行） + 右端固定・折りたたみの参照パネル。
// アクセント = 緑 #1f7a52。
//   伝票入力（仕訳伝票形式）：借方・貸方の科目は伝票につき1組、その下に 摘要・業者・金額 の行を複数入力する（依頼書 5.3.1）。
//   科目・業者・摘要は入力欄の中で候補を絞り込み（5.3.5）、登録できない仕訳と確認して続行できる警告を科目の直下に表示（5.3.2）。
//   機能ボタンは性質ごとにまとめて常に表示し、Alt＋英字のショートカットで操作する（5.3.6）。

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DivisionPicker } from './DivisionPicker';
import { FiscalYearBanner } from './FiscalYearPage';
import { AttachedStatementModal, BudgetGraphModal, BudgetHintLive, EntryConfirmModal, SpecialAmountModal, TorihikiBadge, useEntryTools } from './EntryExtras';
import { ComboField, EntryStyles, isIme, FieldLabel, FlagButtons, FundAccountLine, IssueList, fieldState, fmtNum, focusId, hasError, isDepreciationAccount, judgeEntry, needsPartner, onEnter, scopeStyle, setPartner, toNum, watchedStatement, type FundMode, type FusenColor } from './EntryCommon';
import { WIDE_WIDTH, WidePanel, useWidePanel } from './WidePanel';
import { ToastView, useToast } from './Toast';
import { judgeTorihiki } from '../lib/accounts';
import { addVoucher, getVouchers, updateVoucher, useVouchers } from '../store/journalStore';
import { canEdit, setSession, useSession, type JournalTemplate, type TemplateLine } from '../store/session';
import { HeaderTools, type JournalYear } from './HeaderTools';
import { UserMenu } from './UserMenu';
import { SettingsMenu } from './SettingsMenu';
import { VersionBadge } from './VersionBadge';
import { Menu } from './Menu';
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
  year: JournalYear;
  onYear: (y: JournalYear) => void;
  onLogout: () => void;
}

export function FormScreen({ page, onNavigate, year, onYear, onLogout }: Props) {
  const [topOffset, setTopOffset] = useState(102);
  const headerRef = useRef<HTMLDivElement>(null);

  // アプリバー＋ナビの合計高さを実測（ナビ折返しに追従）
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
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* アプリバー＋年度帯＋ナビ：まとめて上部に固定（スクロールしない） */}
      <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid #dde4ea',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 26px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
            <button type="button" data-menu="ホーム（ロゴ）" onClick={() => onNavigate('ホーム')} title="ホームへ" style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
              <span style={logoStyle(GREEN, 28, 15)}>会</span>
              <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap' }}>
                会計基準システム
              </span>
            </button>
            <VersionBadge accent={GREEN} />
          </div>
          <span style={{ color: '#c3ccd4' }}>｜</span>
          <DivisionPicker accent={GREEN} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: '#68757f', flex: 'none', marginLeft: 12 }}>
          <HeaderTools accent={GREEN} page={page} onNavigate={onNavigate} year={year} onYear={onYear} />
          <SettingsMenu accent={GREEN} active={page} onNavigate={onNavigate} />
          <UserMenu accent={GREEN} soft="#eef4f0" onNavigate={onNavigate} />
        </div>
      </header>
      <FiscalYearBanner />

      {/* ナビ（折返し・固定） */}
      <nav
        style={{
          background: '#fff',
          borderBottom: '1px solid #eef2f5',
          padding: '3px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'visible',
          alignItems: 'stretch',
          position: 'relative',
          zIndex: 99,
        }}
      >
        <Menu orientation="h" accent={GREEN} active={page} onSelect={onNavigate} />
      </nav>
      </div>

      {page === '伝票入力' ? (
        <VoucherEntry onNavigate={onNavigate} year={year} topOffset={topOffset} />
      ) : page === '単一入力' || page === '振替入力' || page === '振替単一' ? (
        <EntryWithPanel page={page} topOffset={topOffset}>{renderPage(page, 'form', GREEN, GREEN_RGB, onNavigate, year, onLogout)}</EntryWithPanel>
      ) : (
        renderPage(page, 'form', GREEN, GREEN_RGB, onNavigate, year, onLogout)
      )}
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 伝票入力（仕訳伝票形式）本体                                          */
/*   ショートカット（Alt＋英字）を登録するため、この画面を表示しているときだけマウントする。 */
/* ------------------------------------------------------------------ */
interface Row { id: number; tekiyo: string; gyosha: string; /** 数字のみ。先頭が '+' のときは特殊金額入力の入力途中 */ amount: string; check: boolean; fusen: FusenColor; shohyo: boolean }
let rowSeq = 1;
const blankRow = (p?: Partial<Row>): Row => ({ id: rowSeq++, tekiyo: '', gyosha: '', amount: '', check: false, fusen: '', shohyo: true, ...p });
const rowBlank = (r: Row) => !r.tekiyo.trim() && !r.gyosha && !r.amount;
type LineGroup = { kari: string; kashi: string; lines: TemplateLine[] };
/** 定型仕訳の行を、借方・貸方の科目が同じもの（＝伝票1枚分）ごとにまとめる */
function groupLines(lines: TemplateLine[]): LineGroup[] {
  const out: LineGroup[] = [];
  lines.forEach((l) => {
    const last = out[out.length - 1];
    if (last && last.kari === l.kari && last.kashi === l.kashi) last.lines.push(l);
    else out.push({ kari: l.kari, kashi: l.kashi, lines: [l] });
  });
  return out;
}

const SUBMIT_ID = 'fe-submit';
const ENTER_ORDER = '月 → 日 →（伝票No）→ 借方科目 → 貸方科目 →（内部取引相手区分）→ 1行目の摘要 → 業者 → 金額 → 次の行の摘要 …　何も入力していない最後の行の摘要で Enter を押すと「伝票登録」へ移ります';
const FE_CSS = `
.fe-actions { background: #fff; }
/* 機能ボタンの下部固定は縦に十分な余裕がある画面だけ（低い画面では入力欄が隠れるため通常配置）。下端はプロトタイプの切替バー／メモボタンと重ならないよう余白を取る */
@media (min-height: 1000px) { .fe-actions { position: sticky; bottom: 0; z-index: 5; padding-bottom: 58px; box-shadow: 0 -8px 18px rgba(30,50,70,.07); } }
`;

function VoucherEntry({ onNavigate, year, topOffset }: { onNavigate: (label: string) => void; year: JournalYear; topOffset: number }) {
  const sess = useSession();
  const inp = sess.input;
  const toast = useToast();
  const vouchers = useVouchers();
  const wide = useWidePanel('form-entry');
  const editable = canEdit(sess);

  const [month, setMonthV] = useState('8');
  const [day, setDayV] = useState('1');
  const [manualNo, setManualNo] = useState('');
  const [kari, setKari] = useState('');
  const [kashi, setKashi] = useState('');
  const [aite, setAite] = useState('');
  const [internal, setInternal] = useState(false);
  const [fundMode, setFundMode] = useState<FundMode>('自動資金');
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [cur, setCur] = useState(0);
  const [cheque, setCheque] = useState('');
  const [spare, setSpare] = useState(['', '']);
  const [err, setErr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [graphAcct, setGraphAcct] = useState<string | null>(null);
  const [special, setSpecial] = useState<{ row: number; total: number } | null>(null);
  const [stmt, setStmt] = useState<{ label: string; entry: { kari: string; kashi: string; tekiyo: string; amount: number } } | null>(null);
  const [queue, setQueue] = useState<LineGroup[]>([]);
  const [hi, setHi] = useState<number[]>([]);

  // 入力内容が変わったら、登録時のメッセージを消す
  useEffect(() => { setErr(''); }, [month, day, manualNo, kari, kashi, aite, internal, fundMode, rows]);
  // ヘッダーで「前年度」を選んだときは、参照パネルを前年度日記帳にする（戻したら日記帳へ）
  const prevYear = useRef(year);
  useEffect(() => {
    if (year === 'prev' && wide.view !== '前年度日記帳') wide.setView('前年度日記帳');
    else if (year !== 'prev' && prevYear.current === 'prev' && wide.view === '前年度日記帳') wide.setView('日記帳');
    prevYear.current = year;
  }, [year]);

  const curIdx = Math.min(cur, rows.length - 1);
  const curRow = rows[curIdx];
  const total = rows.reduce((s, r) => s + toNum(r.amount), 0);
  const partner = needsPartner({ kari, kashi, internal });
  const issues = judgeEntry({ kari, kashi, amount: total, fundMode, internal, aite, division: sess.division }, sess.env);
  const warns = issues.filter((i) => i.level === 'warn');
  const blocked = hasError(issues);
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
  const deleteAt = (i: number) => {
    if (!editable) return;
    if (rows.length === 1) { setRows([blankRow()]); setCur(0); focusId('fe-tek-0'); toast.show('1行目の入力内容を消しました'); return; }
    const next = Math.min(i, rows.length - 2);
    setRows((list) => list.filter((_, j) => j !== i));
    setCur(next);
    focusId(`fe-tek-${next}`);
  };
  const rowDelete = () => {
    if (!editable) return;
    if (rows.length === 1) { setRows([blankRow()]); setCur(0); focusId('fe-tek-0'); toast.show('1行目の入力内容を消しました'); return; }
    const next = Math.min(curIdx, rows.length - 2);
    setRows((list) => list.filter((_, j) => j !== curIdx));
    setCur(next);
    focusId(`fe-tek-${next}`);
  };

  /* ---- Enter 送り ---- */
  const afterTekiyo = (i: number, v: string) => {
    const r = rows[i];
    // 何も入力していない最後の行の摘要で Enter → 伝票登録へ
    if (i > 0 && i === rows.length - 1 && !v.trim() && !r.gyosha && !r.amount) { focusId(SUBMIT_ID); return; }
    focusId(`fe-gyo-${i}`);
  };
  /** 金額欄で Enter：特殊金額入力（＋金額）なら按分、それ以外は登録。Shift+Enter：この行の下に1行追加 */
  const afterAmount = (i: number) => {
    const r = rows[i];
    if (r.amount.startsWith('+')) { const n = toNum(r.amount); if (n > 0) setSpecial({ row: i, total: n }); return; }
    submit();
  };
  const rowAddAfter = (i: number) => { if (!editable) return; setRows((list) => [...list.slice(0, i + 1), blankRow(), ...list.slice(i + 1)]); setCur(i + 1); focusId(`fe-tek-${i + 1}`); };

  /* ---- 登録 ---- */
  const basicError = (): string => {
    const m = parseInt(month, 10), d = parseInt(day, 10);
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return '伝票日付（月・日）を正しく入力してください。';
    if (manual && !manualNo.trim()) return '伝票Noを入力してください（入力の変更で自動採番に切り替えられます）。';
    if (!kari || !kashi) return '借方科目・貸方科目を入力してください。';
    const plus = rows.findIndex((r) => r.amount.startsWith('+'));
    if (plus >= 0) return `${plus + 1}行目：特殊金額入力（＋）は、金額欄で Enter を押して確定してください。`;
    const noAmt = rows.findIndex((r) => !rowBlank(r) && toNum(r.amount) <= 0);
    if (noAmt >= 0) return `${noAmt + 1}行目の金額が未入力です。`;
    if (!rows.some((r) => toNum(r.amount) > 0)) return '金額を入力した行がありません。摘要・業者・金額を1行以上入力してください。';
    return '';
  };
  const applyGroup = (g: LineGroup) => {
    setKari(g.kari); setKashi(g.kashi);
    setRows(g.lines.map((l) => blankRow({ tekiyo: l.tekiyo, gyosha: l.gyosha ?? '', amount: String(l.amount ?? '').replace(/[^0-9]/g, '') })));
    setCur(0);
  };
  const reset = () => {
    setKari(''); setKashi(''); setAite(''); setInternal(false); setFundMode('自動資金');
    setRows([blankRow()]); setCur(0); setCheque(''); setSpare(['', '']); setManualNo('');
  };
  const finalize = () => {
    const list = rows.filter((r) => toNum(r.amount) > 0);
    if (!list.length) return;
    const date = `${parseInt(month, 10)}/${parseInt(day, 10)}`;
    const seq = getVouchers().reduce((m, r) => Math.max(m, r.seq), 0) + 1;
    const no = manual && manualNo.trim() ? manualNo.trim() : `${parseInt(month, 10)}-${seq}`;
    const ids = list.map((r) => {
      const vch = addVoucher({ kind: '伝票', seq, no, date, kari, kashi, tekiyo: r.tekiyo.trim(), amount: toNum(r.amount), service: sess.division, gyosha: r.gyosha || undefined, shohyo: inp.shohyo ? r.shohyo : true, cheque: cheque.trim() || undefined, spare1: spare[0].trim() || undefined, spare2: spare[1].trim() || undefined, internal: partner || undefined });
      if (r.check || r.fusen) updateVoucher(vch.id, { check: r.check, fusen: r.fusen });
      if (partner) setPartner(vch.id, aite);
      return vch.id;
    });
    setHi(ids);
    const sum = list.reduce((s, r) => s + toNum(r.amount), 0);
    const w = watchedStatement(kari, kashi);
    const dep = isDepreciationAccount(kari) || isDepreciationAccount(kashi);
    if (w) setStmt({ label: w.label, entry: { kari, kashi, tekiyo: list[0].tekiyo, amount: sum } });
    const [next, ...rest] = queue;
    reset();
    if (next) {
      applyGroup(next); setQueue(rest);
      toast.show(`伝票No ${no} を登録しました。定型仕訳の次の伝票（残り ${rest.length + 1} 枚）を呼び出しました`);
      focusId(SUBMIT_ID);
    } else {
      toast.show(`伝票No ${no}（${list.length} 行・合計 ${sum.toLocaleString('ja-JP')} 円）を登録しました${dep ? '。固定資産の登録は「減価償却」メニューで行ってください' : ''}`);
      focusId('fe-month');
    }
  };
  const submit = () => {
    if (!editable) return;
    const be = basicError();
    if (be) { setErr(be); return; }
    if (blocked) { setErr('登録できない仕訳です。科目の下に表示しているエラーの内容を確認してください。'); focusId(issues.find((i) => i.level === 'error')?.field === 'aite' ? 'fe-aite' : issues.find((i) => i.level === 'error')?.field === 'kari' ? 'fe-kari' : 'fe-kashi'); return; }
    if (warns.length) { setConfirmOpen(true); return; }
    finalize();
  };
  const confirmNow = () => {
    if (!editable) return;
    const be = basicError();
    if (be) { setErr(be); return; }
    finalize();
  };

  const tools = useEntryTools({
    format: '伝票入力',
    accent: GREEN,
    onNavigate,
    toast: toast.show,
    dirty,
    service: sess.division,
    month,
    day,
    kari,
    kashi,
    lines: rows.map((r) => ({ kari, kashi, tekiyo: r.tekiyo, gyosha: r.gyosha || undefined, amount: String(toNum(r.amount) || '') })),
    multiRow: true,
    rowLabel: `${curIdx + 1}行目`,
    flags: { check: curRow.check, fusen: curRow.fusen, shohyo: curRow.shohyo },
    onFlags: (p) => patchRow(curIdx, p),
    fundMode,
    onFundMode: setFundMode,
    onSubmit: submit,
    onCancel: () => { reset(); setQueue([]); focusId('fe-month'); },
    onRowAdd: rowAdd,
    onRowInsert: rowInsert,
    onRowDelete: rowDelete,
    internal,
    onInternal: () => { const on = !internal; setInternal(on); if (on) focusId('fe-aite'); else if (!needsPartner({ kari, kashi, internal: false })) setAite(''); },
    onLoadTemplate: (t: JournalTemplate, mode) => {
      const groups = groupLines(t.lines);
      if (!groups.length) { toast.show('この定型仕訳には行がありません'); return; }
      applyGroup(groups[0]); setQueue(groups.slice(1));
      toast.show(`${mode === '連続' ? '連続定型' : '定型仕訳'}「${t.name}」を呼び出しました${groups.length > 1 ? `（残り ${groups.length - 1} 枚は、登録後に順に呼び出します）` : ''}`);
      focusId('fe-amt-0');
    },
    onRegistered: setHi,
    onPickDate: (m, d) => { setMonthV(m); setDayV(d); },
    onOpenPanel: () => wide.setCollapsed(false),
    submitId: SUBMIT_ID,
    enterOrder: ENTER_ORDER,
  });

  const panelOpen = !wide.collapsed && !wide.narrow;
  const cellInput: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cfd8e0', borderRadius: 8, fontFamily: 'inherit', color: '#22303c', background: editable ? '#fff' : '#f5f7f9' };
  const smallInput: CSSProperties = { padding: '4px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit' };
  const GRID = '34px minmax(0,1.5fr) minmax(0,1fr) 132px 88px 70px';
  const rowBtn: CSSProperties = { padding: '3px 7px', borderRadius: 6, border: '1px solid #cfd8e0', background: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#5b6773' };

  return (
    <>
      {/* メイン（フォームカード） */}
      <main
        style={{
          flex: 1,
          padding: 28,
          paddingRight: panelOpen ? WIDE_WIDTH + 28 : 28,
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
          <style>{FE_CSS}</style>
          {/* 形式の切替（現在の形式を明示）＋ 入力の変更・キーボード操作一覧 */}
          <div style={{ borderRadius: '15px 15px 0 0', overflow: 'hidden' }}>{tools.topBar}</div>
          {tools.banner}

          <div style={{ padding: '20px 26px 8px' }}>
            {/* 見出し行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '2px solid #28323c', paddingBottom: 13, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '.03em' }}>
                  仕訳伝票
                  <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: GREEN, letterSpacing: 0, verticalAlign: 3 }}>仕訳伝票形式（複数行）</span>
                </div>
                <div style={{ color: '#5b6773', fontSize: 13, marginTop: 4 }}>{sess.division}　{sess.fiscalYear}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#8895a3', marginBottom: 7 }}>取引区分（科目から自動判定）</div>
                  <TorihikiBadge kari={kari} kashi={kashi} force={fundMode === '強制資金'} blocked={blocked} fundMode={fundMode} />
                </div>
                <div style={{ paddingTop: 2 }}>{tools.templateButton}</div>
              </div>
            </div>

            {/* メタ行：入力区分・伝票日付・伝票No */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1.5fr) minmax(0,1.1fr)', gap: 16, marginBottom: 16 }}>
              <div>
                <FieldLabel>入力区分（サービス区分）</FieldLabel>
                <div title="入力区分は、画面上部の区分の選択で切り替えます" style={{ display: 'flex', alignItems: 'center', height: 38, padding: '0 12px', background: '#f5f7f9', border: '1px solid #e2e8ee', borderRadius: 9, fontSize: 14, color: '#3d4a56', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sess.division}</div>
              </div>
              <div className="ef-field">
                <FieldLabel>伝票日付</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, fontSize: 14, color: '#5b6773' }}>
                  <span>令和8年</span>
                  <input id="fe-month" className="ef-input" aria-label="月" disabled={!editable} value={month} onChange={(e) => setNum2(setMonthV)(e.target.value)} onFocus={(e) => e.currentTarget.select()} onKeyDown={onEnter(() => focusId('fe-day'))} inputMode="numeric" autoComplete="off" style={dateInput} />
                  <span>月</span>
                  <input id="fe-day" className="ef-input" aria-label="日" disabled={!editable} value={day} onChange={(e) => setNum2(setDayV)(e.target.value)} onFocus={(e) => e.currentTarget.select()} onKeyDown={onEnter(() => focusId(manual ? 'fe-no' : 'fe-kari'))} inputMode="numeric" autoComplete="off" style={dateInput} />
                  <span>日</span>
                </div>
              </div>
              <div className="ef-field">
                <FieldLabel>伝票No</FieldLabel>
                {manual ? (
                  <input id="fe-no" className="ef-input" disabled={!editable} value={manualNo} onChange={(e) => setManualNo(e.target.value)} onKeyDown={onEnter(() => focusId('fe-kari'))} placeholder="例 8-101" autoComplete="off" style={{ height: 38, boxSizing: 'border-box', width: '100%', padding: '0 12px', border: '1px solid #cfd8e0', borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: 38, padding: '0 12px', background: '#f5f7f9', border: '1px solid #e2e8ee', borderRadius: 9, fontSize: 13.5, color: '#9aa5b1', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    自動採番（{parseInt(month, 10) || 8}-{nextSeq}）
                  </div>
                )}
              </div>
            </div>

            {/* 借方 / 貸方（伝票につき1組） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginBottom: 10 }}>
              <div className="ef-field" style={{ border: '1px solid #cfe0f2', borderRadius: 12, minWidth: 0 }}>
                <div style={boxHeader('#eaf2fb', BLUE)}>
                  <FieldLabel color={BLUE} style={{ fontSize: 13, marginBottom: 0 }}>借方科目</FieldLabel>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#87a6cc' }}>伝票につき1組</span>
                </div>
                <div style={{ padding: '12px 14px 10px' }}>
                  <ComboField id="fe-kari" kind="account" value={kari} onChange={setKari} onCommit={() => focusId('fe-kashi')} disabled={!editable} invalid={fieldState(issues, 'kari', 'pair')} placeholder="コード・科目名・フリガナ" fontSize={14.5} padY={10} listWidth={400} />
                  <FundAccountLine name={kari} other={kashi} mode={fundMode} />
                  <BudgetHintLive account={kari} threshold={budgetTh} onOpen={() => setGraphAcct(kari)} />
                </div>
              </div>
              <div className="ef-field" style={{ border: '1px solid #f2d0dc', borderRadius: 12, minWidth: 0 }}>
                <div style={boxHeader('#fdeef3', PINK)}>
                  <FieldLabel color={PINK} style={{ fontSize: 13, marginBottom: 0 }}>貸方科目</FieldLabel>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d18aa5' }}>伝票につき1組</span>
                </div>
                <div style={{ padding: '12px 14px 10px' }}>
                  <ComboField id="fe-kashi" kind="account" value={kashi} onChange={setKashi} onCommit={(v) => focusId(needsPartner({ kari, kashi: v, internal }) ? 'fe-aite' : 'fe-tek-0')} disabled={!editable} invalid={fieldState(issues, 'kashi', 'pair')} placeholder="コード・科目名・フリガナ" fontSize={14.5} padY={10} listWidth={400} />
                  <FundAccountLine name={kashi} other={kari} mode={fundMode} />
                  <BudgetHintLive account={kashi} threshold={budgetTh} onOpen={() => setGraphAcct(kashi)} />
                </div>
              </div>
            </div>

            {/* 内部取引相手区分（内部取引科目を使うとき・「内部取引」を指定したときだけ表示） */}
            {partner && (
              <div className="ef-field" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,320px) minmax(0,1fr)', gap: 14, alignItems: 'end', marginBottom: 10, padding: '10px 14px', border: '1px solid #e0d6f3', background: '#faf7ff', borderRadius: 12 }}>
                <div>
                  <FieldLabel color="#6b3fb5">内部取引相手区分（必須）</FieldLabel>
                  <ComboField id="fe-aite" kind="service" value={aite} onChange={setAite} onCommit={() => focusId('fe-tek-0')} disabled={!editable} invalid={fieldState(issues, 'aite')} placeholder="コード・区分名・フリガナ" />
                </div>
                <div style={{ fontSize: 11.5, color: '#6b5a8a', lineHeight: 1.7, paddingBottom: 4 }}>内部取引の相手先となる区分を指定します。入力中の区分（{sess.division}）とは別の区分を選んでください。</div>
              </div>
            )}

            {/* 登録できない仕訳（赤）／確認して登録できる警告（黄） */}
            {issues.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <IssueList issues={issues} onConfirm={editable ? confirmNow : undefined} confirmDisabled={basicError() || undefined} confirmId="fe-confirm" />
              </div>
            )}

            {/* 明細行：摘要・業者・金額（複数行） */}
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 12, marginTop: 6, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '8px 12px', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', borderRadius: '11px 11px 0 0', fontSize: 11, fontWeight: 700, color: '#8290a0' }}>
                <div style={{ textAlign: 'center' }}>行</div>
                <div>摘要</div>
                <div>業者</div>
                <div style={{ textAlign: 'right' }}>金額</div>
                <div style={{ textAlign: 'center' }}>{inp.shohyo ? '証憑・' : ''}チェック・付箋</div>
                <div style={{ textAlign: 'center' }}>行操作</div>
              </div>
              {rows.map((r, i) => {
                const on = i === curIdx;
                const plus = r.amount.startsWith('+');
                return (
                  <div key={r.id} className="ef-row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #f1f4f6', background: on ? '#f7fbf9' : 'transparent', boxShadow: on ? `inset 4px 0 0 ${GREEN}66` : 'none' }}>
                    <button type="button" tabIndex={-1} onClick={() => { setCur(i); focusId(`fe-tek-${i}`); }} title={`${i + 1}行目を行の操作の対象にする`} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', fontSize: 12, fontWeight: 700, color: on ? GREEN : '#9aa5b1' }}>
                      <span className="ef-rowno">{i + 1}</span>
                      <span className="ef-rownow" style={{ padding: '1px 5px', borderRadius: 7, background: GREEN, color: '#fff', fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>入力中</span>
                    </button>
                    <ComboField id={`fe-tek-${i}`} kind="summary" freeText value={r.tekiyo} onChange={(v) => patchRow(i, { tekiyo: v })} onCommit={(v) => afterTekiyo(i, v)} onFocusField={() => setCur(i)} disabled={!editable} placeholder={inp.tekiyoCode ? '摘要（コード・フリガナでも検索）' : '摘要を入力'} padY={8} listWidth={360} />
                    <ComboField id={`fe-gyo-${i}`} kind="vendor" value={r.gyosha} onChange={(v) => patchRow(i, { gyosha: v })} onCommit={() => focusId(`fe-amt-${i}`)} onFocusField={() => setCur(i)} disabled={!editable} placeholder="業者（任意）" padY={8} listWidth={300} />
                    <input
                      id={`fe-amt-${i}`}
                      className="ef-input"
                      aria-label={`${i + 1}行目の金額`}
                      disabled={!editable}
                      value={plus ? '＋' + fmtNum(r.amount) : fmtNum(r.amount)}
                      onChange={(e) => { const raw = e.target.value.normalize('NFKC'); const digits = raw.replace(/[^0-9]/g, '').slice(0, 12); patchRow(i, { amount: (/^\s*\+/.test(raw) ? '+' : '') + digits }); }}
                      onFocus={(e) => { setCur(i); e.currentTarget.select(); }}
                      onKeyDown={(e) => { if (e.key !== 'Enter' || isIme(e)) return; e.preventDefault(); if (e.shiftKey) rowAddAfter(i); else afterAmount(i); }}
                      title="Enter で登録、Shift+Enter でこの行の下に1行追加。先頭に「＋」を付けて金額を入力し Enter を押すと、特殊金額入力（区分別の按分）が開きます"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      style={{ ...cellInput, padding: '8px 10px', textAlign: 'right', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderColor: plus ? '#6b3fb5' : '#cfd8e0' }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <FlagButtons shohyo={r.shohyo} check={r.check} fusen={r.fusen} onChange={(p) => { setCur(i); patchRow(i, p); }} disabled={!editable} showShohyo={inp.shohyo} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button type="button" className="ef-act" tabIndex={-1} disabled={!editable} onClick={() => insertAt(i)} title={editable ? `${i + 1}行目の上に1行挿入` : tools.reason} style={rowBtn}>挿入</button>
                      <button type="button" className="ef-act" tabIndex={-1} disabled={!editable} onClick={() => deleteAt(i)} title={editable ? `${i + 1}行目を削除` : tools.reason} style={{ ...rowBtn, color: '#c0392b', borderColor: '#f2c9c2' }}>削除</button>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '9px 12px', background: '#fbfcfd', borderRadius: '0 0 11px 11px' }}>
                <div />
                <div style={{ fontSize: 11.5, color: '#8290a0' }}>
                  <button type="button" className="ef-act" tabIndex={-1} disabled={!editable} onClick={rowAdd} title={editable ? '最後に1行追加します（金額欄で Shift+Enter でも行を追加できます）' : tools.reason} style={{ padding: '4px 11px', borderRadius: 7, border: '1px dashed #b9c4cf', background: '#fff', color: '#48565f', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginRight: 10 }}>＋ 行追加</button>
                  {rows.length} 行
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#5b6773' }}>合計</div>
                <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}><span style={{ fontSize: 12, color: '#8290a0', marginRight: 4 }}>¥</span>{total.toLocaleString('ja-JP')}</div>
                <div />
                <div />
              </div>
            </div>

            {(inp.cheque || inp.spare1 || inp.spare2) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 12, color: '#5b6773', flexWrap: 'wrap' }}>
                {inp.cheque && <label className="ef-field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>小切手No <input className="ef-input" disabled={!editable} value={cheque} onChange={(e) => setCheque(e.target.value)} placeholder="任意" style={{ ...smallInput, width: 110 }} /></label>}
                {inp.spare1 && <label className="ef-field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>予備1 <input className="ef-input" disabled={!editable} value={spare[0]} onChange={(e) => setSpare([e.target.value, spare[1]])} style={{ ...smallInput, width: 120 }} /></label>}
                {inp.spare2 && <label className="ef-field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>予備2 <input className="ef-input" disabled={!editable} value={spare[1]} onChange={(e) => setSpare([spare[0], e.target.value])} style={{ ...smallInput, width: 120 }} /></label>}
              </div>
            )}

            {queue.length > 0 && (
              <div role="status" style={{ marginBottom: 10, padding: '7px 12px', borderRadius: 9, background: '#eef6f1', border: '1px solid #cfe5d8', color: '#1f6a48', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>定型仕訳の続き：この伝票を登録すると、次の伝票（残り {queue.length} 枚）を呼び出します。</span>
                <button type="button" className="ef-act" onClick={() => { setQueue([]); toast.show('定型仕訳の続きを取り消しました'); }} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 7, border: '1px solid #b7d6c5', background: '#fff', color: '#1f6a48', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>続きを取り消す</button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div role="alert" style={{ flex: 1, minHeight: 20, color: '#c0392b', fontSize: 12.5, fontWeight: 600 }}>{err}</div>
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
        key={special ? `${special.row}-${special.total}` : 'none'}
        open={special != null}
        total={special?.total ?? 0}
        onClose={() => { setSpecial(null); if (special) focusId(`fe-amt-${special.row}`); }}
        accent={GREEN}
        onOk={(parts) => {
          const at = special?.row ?? 0;
          const r = rows[at];
          setSpecial(null);
          if (!editable || !r) return;
          if (!kari || !kashi) { toast.show('先に借方・貸方の科目を選んでください'); focusId(kari ? 'fe-kashi' : 'fe-kari'); return; }
          const list = parts.filter((p) => p.amount > 0);
          const date = `${parseInt(month, 10) || 8}/${parseInt(day, 10) || 1}`;
          const ids = list.map((p) => addVoucher({ kind: '伝票', date, kari, kashi, tekiyo: `${r.tekiyo.trim() || '特殊金額入力'}（${p.division.split(' ')[1] ?? p.division}）`, amount: p.amount, service: p.division, gyosha: r.gyosha || undefined, shohyo: inp.shohyo ? r.shohyo : true }).id);
          setHi(ids);
          // 按分した行は登録済みになるので、入力中の伝票からは外す
          if (rows.length === 1) setRows([blankRow()]); else setRows((l) => l.filter((_, j) => j !== at));
          const next = Math.min(at, Math.max(0, rows.length - 2));
          setCur(next);
          focusId(`fe-tek-${next}`);
          toast.show(`特殊金額入力：区分別に ${list.length} 枚の伝票を登録しました`);
        }}
      />
      <AttachedStatementModal open={!!stmt} statement={stmt?.label ?? ''} entry={stmt?.entry ?? null} onClose={() => setStmt(null)} onDone={(reg) => { toast.show(reg ? `${stmt?.label}に登録しました` : '明細書には登録しませんでした'); setStmt(null); }} accent={GREEN} />

      {/* 参照パネル（右端固定・折りたたみ。日記帳／前年度日記帳／元帳１／元帳２／残高照合） */}
      <WidePanel accent={GREEN} layout="side" state={wide} top={topOffset} highlightIds={hi} returnTo="伝票入力" />
    </>
  );
}

function logoStyle(bg: string, size: number, font: number): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    background: bg,
    color: '#fff',
    borderRadius: 8,
    fontFamily: "'Zen Kaku Gothic New', sans-serif",
    fontWeight: 700,
    fontSize: font,
  };
}


function boxHeader(bg: string, color: string): CSSProperties {
  return {
    background: bg,
    padding: '9px 14px',
    fontWeight: 700,
    fontSize: 13,
    color,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderRadius: '11px 11px 0 0',
  };
}


/** 単一形式／振替伝票形式／振替単一形式：仕訳伝票形式と同じ右側の参照パネル（日記帳／前年度日記帳／元帳１・２／残高照合）を付ける。
 *  パネルの状態（表示内容・開閉）は4形式で共有（storageKey 'form-entry'）。 */
function EntryWithPanel({ page, topOffset, children }: { page: string; topOffset: number; children: ReactNode }) {
  const wide = useWidePanel('form-entry');
  const panelOpen = !wide.collapsed && !wide.narrow;
  return (
    <>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingRight: panelOpen ? WIDE_WIDTH : 0, transition: 'padding-right .28s ease' }}>{children}</div>
      <WidePanel accent={GREEN} layout="side" state={wide} top={topOffset} returnTo={page} />
    </>
  );
}
