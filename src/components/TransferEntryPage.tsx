// 振替入力（振替伝票形式）／振替単一（振替単一形式：single）
//   振替伝票形式は、開いた直後に注意（複数行にわたる内部取引には非対応）を表示。
//   各行：借方金額／借方科目（資金科目は自動表示）／貸方科目（資金科目は自動表示）／貸方金額／摘要。行の追加・挿入・削除ができる。
//   借方合計＝貸方合計で登録可。登録した行は下の当年仕訳一覧に入る。
//   機能ボタン（伝票の操作／行の操作／入力補助／参照）は常に表示し、Alt＋英字のショートカットでも動く。

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { DivisionDialog } from './DivisionPicker';
import { useEntryTools } from './EntryExtras';
import { ComboField, EntryStyles, isIme, FieldLabel, FlagButtons, FundAccountLine, IssueList, fieldState, fmtNum, focusId, hasError, hasWarn, isInternalAccount, judgeEntry, needsPartner, onEnter, scopeStyle, setPartner, toNum, type FundMode, type FusenColor, type Issue } from './EntryCommon';
import { useWidePanel } from './WidePanel';
import { makeSheetSeed } from '../data';
import { applyMonth } from '../lib/format';
import { addVoucher, getVouchers, updateVoucher } from '../store/journalStore';
import { getSession, useSession, type TemplateLine } from '../store/session';
import type { JournalEntry, MonthFilter } from '../types';

const PINK = '#b0426a';
const BLUE = '#2c5f9e';
const ROW_COUNT = 5;
const ALERT_KEY = 'transfer-alert-hidden';

interface Row {
  kariAmt: string;
  kari: string;
  kashi: string;
  kashiAmt: string;
  tekiyo: string;
  shohyo: boolean;
  check: boolean;
  fusen: FusenColor;
}
const emptyRow = (): Row => ({ kariAmt: '', kari: '', kashi: '', kashiAmt: '', tekiyo: '', shohyo: true, check: false, fusen: '' });
const isUsed = (r: Row) => !!(r.kari || r.kashi || toNum(r.kariAmt) || toNum(r.kashiAmt));
const isTouched = (r: Row) => isUsed(r) || !!r.tekiyo;

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  /** 振替単一：1行のみ・注意ダイアログなし */
  single?: boolean;
  /** 形式の切替・問合せ画面への移動。未指定のときは切替を出さず、現在の形式だけを表示 */
  onNavigate?: (label: string) => void;
}

export function TransferEntryPage({ variant, accent, single, onNavigate }: Props) {
  const sess = useSession();
  const rowCount = single ? 1 : ROW_COUNT;
  const title = single ? '振替単一' : '振替伝票';
  const pre = single ? 'ts' : 'tr';
  const fid = (i: number, col: 'ka' | 'k' | 's' | 'sa' | 't') => `${pre}-${i}-${col}`;
  const [alertOpen, setAlertOpen] = useState(() => {
    if (single) return false;
    try {
      return localStorage.getItem(ALERT_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [dontShow, setDontShow] = useState(false);
  const [service, setService] = useState('001 本部');
  const [divOpen, setDivOpen] = useState(false);
  const [month, setMonth] = useState('8');
  const [day, setDay] = useState('5');
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: rowCount }, emptyRow));
  const [active, setActive] = useState(0);
  const [cheque, setCheque] = useState('');
  const [err, setErr] = useState('');
  const [fundMode, setFundMode] = useState<FundMode>('自動資金');
  const [internal, setInternal] = useState(false);
  const [aite, setAite] = useState('');
  const [journal, setJournal] = useState<JournalEntry[]>(() => makeSheetSeed());
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('8');
  const [lastIds, setLastIds] = useState<number[]>([]);
  const [, setHi] = useState<number[]>([]);
  const nextId = useRef(1);
  const toast = useToast();
  const wide = useWidePanel('form-entry'); // 右側の参照パネル（4形式で共有。表示は FormScreen 側）

  const closeAlert = () => {
    if (dontShow) {
      try {
        localStorage.setItem(ALERT_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    setAlertOpen(false);
    focusId(fid(0, 'ka'));
  };

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setErr('');
  };
  const cur = Math.min(active, rows.length - 1);

  const kariTotal = rows.reduce((a, r) => a + toNum(r.kariAmt), 0);
  const kashiTotal = rows.reduce((a, r) => a + toNum(r.kashiAmt), 0);
  const balanced = kariTotal > 0 && kariTotal === kashiTotal;
  const used = rows.filter(isUsed);
  const dirty = rows.some(isTouched);

  // 内部取引：複数行の伝票では登録できない（振替伝票形式の制約）。1行の伝票のときだけ相手区分を入力する
  const hasInternalAcc = rows.some((r) => isInternalAccount(r.kari) || isInternalAccount(r.kashi));
  const multiInternal = !single && used.length > 1 && (hasInternalAcc || internal);
  const first = used[0] ?? rows[cur];
  const partner = !multiInternal && (internal || hasInternalAcc) && needsPartner({ kari: first?.kari ?? '', kashi: first?.kashi ?? '', internal });

  /** 行ごとの判定（借方・貸方の両方が入っている行だけ） */
  const rowIssues: Issue[][] = rows.map((r) => {
    if (!r.kari || !r.kashi) return [];
    const list = judgeEntry({ kari: r.kari, kashi: r.kashi, amount: toNum(r.kariAmt) || toNum(r.kashiAmt), fundMode, internal: partner && internal, aite, division: service }, sess.env);
    // 複数行の内部取引は伝票全体のエラーとして別に出す
    return multiInternal ? list.filter((x) => x.code !== 'aite' && x.code !== 'aite-same' && x.code !== 'oneside') : list;
  });
  const voucherIssues: Issue[] = multiInternal ? [{ level: 'error', code: 'multi-internal', title: '複数行にわたる内部取引は振替伝票形式では登録できません', detail: '内部取引は1行の伝票で登録してください（振替単一形式、または振替伝票形式で1行だけ入力）。', field: 'pair' }] : [];
  const allIssues = [...voucherIssues, ...rowIssues.flatMap((list, i) => list.map((x) => ({ ...x, code: `${i}-${x.code}`, title: rows.length > 1 ? `${i + 1}行目：${x.title}` : x.title })))];
  const blocked = hasError(allIssues);

  const resetEntry = () => {
    setRows(Array.from({ length: rowCount }, emptyRow));
    setActive(0);
    setCheque('');
    setErr('');
    setInternal(false);
    setAite('');
  };

  const submit = (confirmed = false) => {
    if (!tools.editable) { toast.show(tools.reason); return; }
    if (used.length === 0) { setErr('借方・貸方の科目と金額を入力してください。'); focusId(fid(0, 'ka')); return; }
    const noAcc = rows.findIndex((r) => isUsed(r) && !r.kari && !r.kashi);
    if (noAcc >= 0) { setErr(`${noAcc + 1}行目の科目が未入力です。`); focusId(fid(noAcc, 'k')); return; }
    if (single && (!rows[0].kari || !rows[0].kashi)) { setErr('借方科目・貸方科目の両方を入力してください。'); focusId(fid(0, rows[0].kari ? 's' : 'k')); return; }
    if (!balanced) { setErr(`借方合計と貸方合計が一致していません（差額 ${Math.abs(kariTotal - kashiTotal).toLocaleString('ja-JP')} 円）。`); return; }
    if (blocked) {
      toast.show('登録できない内容があります。行の下の表示を確認してください');
      if (partner && !aite) focusId(`${pre}-aite`);
      return;
    }
    if (hasWarn(allIssues) && !confirmed) {
      toast.show('確認が必要な内容があります。「確認して登録」を押すと登録します');
      focusId(`${pre}-confirm`);
      return;
    }
    const date = `${month}/${day}`;
    const ids: number[] = [];
    const storeIds: number[] = [];
    let no: string | undefined;
    let seq: number | undefined;
    const entries: JournalEntry[] = used.map((r) => {
      const id = nextId.current++;
      ids.push(id);
      const e: JournalEntry = { id, date, kari: r.kari || '諸口', kashi: r.kashi || '諸口', tekiyo: r.tekiyo, amount: toNum(r.kariAmt) || toNum(r.kashiAmt), shohyo: r.shohyo, cheque: cheque || undefined };
      // 共有の仕訳（参照パネル・残高・伝票訂正の対象）にも登録。同じ伝票の行は同じ伝票Noにまとめる
      const stored = addVoucher({ kind: single ? '振単' : '振替', date, kari: e.kari, kashi: e.kashi, tekiyo: e.tekiyo, amount: e.amount, service, shohyo: r.shohyo, cheque: cheque || undefined, internal: partner || undefined, ...(no != null && seq != null ? { no, seq } : {}) });
      no = stored.no;
      seq = stored.seq;
      if (r.check || r.fusen) updateVoucher(stored.id, { check: r.check, fusen: r.fusen });
      if (partner) setPartner(stored.id, aite);
      storeIds.push(stored.id);
      return e;
    });
    setJournal((j) => [...j, ...entries]);
    setLastIds(ids);
    setHi(storeIds);
    resetEntry();
    setMonthFilter((mf) => (mf != null && mf !== month ? month : mf));
    toast.show(`${title}を登録しました（${entries.length}行）`);
    focusId(fid(0, 'ka'));
    setTimeout(() => {
      const el = document.getElementById('journal-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  };

  const loadLines = (lines: TemplateLine[]) => {
    const src = single ? lines.slice(0, 1) : lines;
    const filled: Row[] = src.map((l) => { const a = String(l.amount ?? '').replace(/[^0-9]/g, ''); return { ...emptyRow(), kari: l.kari, kashi: l.kashi, tekiyo: l.tekiyo, kariAmt: l.kari ? a : '', kashiAmt: l.kashi ? a : '' }; });
    while (filled.length < rowCount) filled.push(emptyRow());
    setRows(filled);
    setActive(0);
    setErr('');
  };

  const tools = useEntryTools({
    format: single ? '振替単一' : '振替入力',
    accent,
    onNavigate,
    toast: toast.show,
    dirty,
    service,
    month,
    day,
    kari: rows[cur]?.kari ?? '',
    kashi: rows[cur]?.kashi ?? '',
    lines: rows.filter(isTouched).map((r) => ({ kari: r.kari, kashi: r.kashi, tekiyo: r.tekiyo, amount: r.kariAmt || r.kashiAmt })),
    multiRow: !single,
    rowLabel: single ? '入力中の伝票' : `${cur + 1}行目`,
    flags: { check: rows[cur].check, fusen: rows[cur].fusen, shohyo: rows[cur].shohyo },
    onFlags: (p) => setRow(cur, p),
    fundMode,
    onFundMode: setFundMode,
    onSubmit: () => submit(),
    onCancel: () => { resetEntry(); focusId(fid(0, 'ka')); },
    onRowAdd: () => { const n = rows.length; setRows((rs) => [...rs, emptyRow()]); setActive(n); focusId(fid(n, 'ka')); },
    onRowInsert: () => { setRows((rs) => [...rs.slice(0, cur), emptyRow(), ...rs.slice(cur)]); focusId(fid(cur, 'ka')); toast.show(`${cur + 1}行目に1行挿入しました`); },
    onRowDelete: () => {
      if (rows.length <= 1) { setRows([emptyRow()]); toast.show('行の内容を消しました（最後の1行は削除できません）'); return; }
      setRows((rs) => rs.filter((_, k) => k !== cur));
      const n = Math.min(cur, rows.length - 2);
      setActive(n);
      focusId(fid(n, 'ka'));
      toast.show(`${cur + 1}行目を削除しました`);
    },
    internal: partner || internal,
    onInternal: () => {
      if (internal) { setInternal(false); return; }
      setInternal(true);
      if (!single && used.length > 1) toast.show('内部取引は1行の伝票で登録してください（複数行の振替伝票では登録できません）');
      else focusId(`${pre}-aite`);
    },
    onLoadTemplate: (t) => {
      if (t.lines.length === 0) { toast.show(`定型仕訳「${t.name}」には行がありません`); return; }
      loadLines(t.lines);
      focusId(fid(0, 'ka'));
      toast.show(single && t.lines.length > 1 ? `定型仕訳「${t.name}」の1行目を呼び出しました（振替単一形式は1行のみ）` : `定型仕訳「${t.name}」を呼び出しました。金額を確認して登録してください`);
    },
    onRegistered: (ids) => {
      // 自動按分で登録した伝票を当年仕訳の一覧にも追加
      const added = getVouchers().filter((r) => ids.includes(r.id));
      const local = added.map((r): JournalEntry => ({ id: nextId.current++, date: r.date, kari: r.kari, kashi: r.kashi, tekiyo: r.tekiyo, amount: r.amount, shohyo: r.shohyo }));
      setJournal((j) => [...j, ...local]);
      setLastIds(local.map((e) => e.id));
      setHi(ids);
    },
    onPickDate: (m, d) => { setMonth(m); setDay(d); focusId(fid(0, 'ka')); },
    onOpenPanel: () => { wide.setCollapsed(false); toast.show('画面の下に参照パネルを開きました'); },
    submitId: `${pre}-submit`,
    enterOrder: single
      ? '月 → 日 → 借方金額 → 借方科目 → 貸方科目 → 貸方金額 →（内部取引のとき：相手区分）→ 摘要 → 伝票登録ボタン（Enter で登録）'
      : '月 → 日 → 行ごとに［借方金額 → 借方科目 → 貸方科目 → 貸方金額 → 摘要］→ 次の行。貸借が一致したあとの空行で Enter を押すと伝票登録ボタンへ移ります',
  });
  const ro = !tools.editable;

  /** 摘要の次：次の行へ。貸借が一致していて次が空行（または最終行）のときは登録ボタンへ */
  /** 摘要（行の最後）で Enter：登録（警告があれば「確認して登録」へ）。Shift+Enter：この行の下に1行追加 */
  const afterTekiyo = () => {
    if (hasWarn(allIssues) && !blocked) { focusId(`${pre}-confirm`); return; }
    submit();
  };
  const rowAddAfter = (i: number) => { if (ro) return; setRows((rs) => [...rs.slice(0, i + 1), emptyRow(), ...rs.slice(i + 1)]); setActive(i + 1); focusId(fid(i + 1, 'ka')); };
  /** 空の借方金額で Enter：貸借が一致していれば登録ボタンへ（空行で入力を終える） */
  const afterKariAmt = (i: number) => {
    if (i > 0 && balanced && !isUsed(rows[i])) { focusId(hasWarn(allIssues) && !blocked ? `${pre}-confirm` : `${pre}-submit`); return; }
    focusId(fid(i, 'k'));
  };
  /** 貸方科目の次：貸方金額が空なら借方金額を写す（1行で貸借が一致する伝票を速く入力できるように） */
  const afterKashi = (i: number, value: string) => {
    const r = rows[i];
    if (value && !r.kashiAmt && r.kariAmt && r.kari) setRow(i, { kashiAmt: r.kariAmt });
    focusId(fid(i, 'sa'));
  };
  const afterKashiAmt = (i: number) => focusId(partner && !aite ? `${pre}-aite` : fid(i, 't'));

  const list = applyMonth(journal, monthFilter);
  const isSheet = variant === 'sheet';

  const input: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    border: '1px solid #cfd8e0',
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    color: '#22303c',
    background: ro ? '#f5f7f9' : '#fff',
    minWidth: 0,
  };
  const amt: CSSProperties = { ...input, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' };
  const GRID = '44px 130px minmax(0,1fr) minmax(0,1fr) 130px 84px 74px';
  const rowBtn: CSSProperties = { padding: '3px 7px', borderRadius: 6, border: '1px solid #cfd8e0', background: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#5b6773' };
  /** 行ごとのボタン用：i 行目の上に挿入／i 行目を削除 */
  const insertAt = (i: number) => { setRows((rs) => [...rs.slice(0, i), emptyRow(), ...rs.slice(i)]); setActive(i); focusId(fid(i, 'ka')); };
  const deleteAt = (i: number) => {
    if (rows.length <= 1) { setRows([emptyRow()]); toast.show('行の内容を消しました（最後の1行は削除できません）'); return; }
    setRows((rs) => rs.filter((_, k) => k !== i));
    const n = Math.min(i, rows.length - 2);
    setActive(n);
    focusId(fid(n, 'ka'));
  };
  const radius = isSheet ? 14 : 16;

  return (
    <main className="ef-scope" style={{ ...scopeStyle(accent), flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <EntryStyles />
      <ToastView msg={toast.msg} />
      {tools.dialogs}

      {/* 振替伝票形式の注意（複数行の内部取引には非対応） */}
      <Modal open={alertOpen} onClose={closeAlert} width={520} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#fff3cd', color: '#b7791f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>!</span>
            <div>
              <div style={{ fontSize: 12, color: '#8290a0', fontWeight: 700, marginBottom: 4 }}>振替式の内部取引伝票入力についてのご確認</div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6 }}>振替伝票は複数行にわたる内部取引の仕訳に対応しておりません</div>
              <div style={{ fontSize: 13, color: '#48565f', lineHeight: 1.7, marginTop: 8 }}>振替式単一、もしくは振替式で１行の伝票入力であれば登録が可能です。</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5b6773', cursor: 'pointer' }}>
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
              今後、このメッセージを表示しない
            </label>
            <button type="button" autoFocus onClick={closeAlert} style={{ padding: '9px 32px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </div>
      </Modal>
      <DivisionDialog open={divOpen} accent={accent} onClose={() => { setDivOpen(false); const d = getSession().division; if (d !== service) { setService(d); toast.show(`伝票入力区分を「${d}」に切り替えました`); } }} />

      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* 伝票（候補の一覧がカードの外にはみ出せるよう、overflow は隠さない） */}
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: radius, boxShadow: '0 6px 26px rgba(30,50,70,.07)' }}>
          <div style={{ borderRadius: `${radius}px ${radius}px 0 0`, overflow: 'hidden' }}>
            {/* 伝票の形式の切替 */}
            {tools.topBar}
            {tools.banner}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, padding: '14px 22px 12px', borderBottom: '2px solid #28323c', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21, letterSpacing: '.04em' }}>
                  {title} <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>チャイルド保育園　拠点区分</span>
                </div>
                <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>{single ? '1行の振替伝票です（内部取引にも使えます）。' : '行ごとに借方・貸方の科目と金額を入力します（行の追加・挿入・削除ができます）。'}借方合計と貸方合計が一致すると登録できます。</div>
              </div>
              <div style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>{tools.templateButton}</div>
            </div>
          </div>

          {/* 伝票の属性（サービス区分・年月日・伝票No・内部取引相手区分） */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 22px', background: '#fbfcfd', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
            <div className="ef-field" style={{ width: 210 }}>
              <FieldLabel>サービス区分</FieldLabel>
              <ComboField id={`${pre}-service`} kind="service" value={service} onChange={setService} onCommit={() => focusId(`${pre}-month`)} placeholder="コード・名称で指定" disabled={ro} padY={8} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="button" className="ef-act" onClick={() => setDivOpen(true)} title="区分の階層から伝票入力区分を選びます" style={{ padding: '8px 12px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                区分選択
              </button>
            </div>
            <div className="ef-field">
              <FieldLabel>年月日</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13.5, color: '#5b6773', height: 36 }}>
                <span>令和8年</span>
                <input id={`${pre}-month`} className="ef-input" aria-label="月" disabled={ro} value={month} onChange={(e) => setMonth(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} onKeyDown={onEnter(() => focusId(`${pre}-day`))} inputMode="numeric" style={{ ...input, width: 40, padding: '8px 2px', textAlign: 'center' }} />
                <span>月</span>
                <input id={`${pre}-day`} className="ef-input" aria-label="日" disabled={ro} value={day} onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} onKeyDown={onEnter(() => focusId(fid(0, 'ka')))} inputMode="numeric" style={{ ...input, width: 40, padding: '8px 2px', textAlign: 'center' }} />
                <span>日</span>
              </div>
            </div>
            <div>
              <FieldLabel>伝票No</FieldLabel>
              <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f5f7f9', border: '1px solid #e2e8ee', borderRadius: 8, fontSize: 13, color: '#9aa5b1' }}>自動採番</div>
            </div>
            {sess.input.cheque && (
              <div className="ef-field" style={{ width: 120 }}>
                <FieldLabel>小切手No</FieldLabel>
                <input className="ef-input" disabled={ro} value={cheque} onChange={(e) => setCheque(e.target.value)} onKeyDown={onEnter(() => focusId(fid(0, 'ka')))} placeholder="任意" autoComplete="off" style={input} />
              </div>
            )}
            {partner && (
              <div className="ef-field" style={{ width: 240 }}>
                <FieldLabel color="#6b3fb5">内部取引相手区分</FieldLabel>
                <ComboField id={`${pre}-aite`} kind="service" value={aite} onChange={setAite} onCommit={() => focusId(fid(rows.findIndex(isUsed) >= 0 ? rows.findIndex(isUsed) : 0, 't'))} placeholder="相手先の区分を指定" disabled={ro} padY={8} invalid={fieldState(rowIssues.flat(), 'aite')} />
              </div>
            )}
            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 11.5, color: fundMode === '自動資金' ? '#7a8794' : '#6b3fb5', fontWeight: fundMode === '自動資金' ? 500 : 700, paddingBottom: 9 }}>資金モード：{fundMode}</div>
          </div>

          {/* 行見出し */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '9px 22px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
            <div>行</div>
            <div style={{ textAlign: 'right', color: BLUE }}>借方 金額</div>
            <div style={{ color: BLUE }}>借方科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目（自動）／ 摘要</span></div>
            <div style={{ color: PINK }}>貸方科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目（自動）</span></div>
            <div style={{ textAlign: 'right', color: PINK }}>貸方 金額</div>
            <div>証憑・印</div>
            <div>行操作</div>
          </div>

          {rows.map((r, i) => (
            <div key={i} className="ef-row" onFocus={() => setActive(i)} style={{ padding: '10px 22px', borderBottom: '1px solid #f1f4f6', background: !single && i === cur ? '#fcfdfe' : 'transparent' }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'start' }}>
                <div style={{ paddingTop: 9, fontSize: 12, color: '#9aa5b1' }}>
                  <span className="ef-rowno" style={{ fontWeight: !single && i === cur ? 800 : 500, color: !single && i === cur ? accent : '#9aa5b1' }}>{i + 1}</span>
                  <span className="ef-rownow" style={{ padding: '1px 5px', borderRadius: 7, background: accent, color: '#fff', fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{i + 1} 入力中</span>
                </div>
                <input id={fid(i, 'ka')} className="ef-input" aria-label={`${i + 1}行目 借方金額`} disabled={ro} value={fmtNum(r.kariAmt)} onChange={(e) => setRow(i, { kariAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => afterKariAmt(i))} inputMode="numeric" placeholder="0" autoComplete="off" style={amt} />
                <div style={{ minWidth: 0 }}>
                  <ComboField id={fid(i, 'k')} kind="account" value={r.kari} onChange={(x) => setRow(i, { kari: x })} onCommit={() => focusId(fid(i, 's'))} placeholder="借方科目（コード・名称・フリガナ）" listWidth={400} padY={8} disabled={ro} invalid={fieldState(rowIssues[i], 'kari', 'pair')} />
                  <FundAccountLine name={r.kari} other={r.kashi} mode={fundMode} />
                  <div style={{ marginTop: 4 }} onKeyDownCapture={(e) => { if (e.key === 'Enter' && e.shiftKey && !isIme(e)) { e.preventDefault(); e.stopPropagation(); rowAddAfter(i); } }}>
                    <ComboField id={fid(i, 't')} kind="summary" freeText value={r.tekiyo} onChange={(x) => setRow(i, { tekiyo: x })} onCommit={() => afterTekiyo()} placeholder="摘要（任意）" listWidth={320} fontSize={12} padY={4} disabled={ro} />
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <ComboField id={fid(i, 's')} kind="account" value={r.kashi} onChange={(x) => setRow(i, { kashi: x })} onCommit={(x) => afterKashi(i, x)} placeholder="貸方科目（コード・名称・フリガナ）" listWidth={400} padY={8} disabled={ro} invalid={fieldState(rowIssues[i], 'kashi', 'pair')} />
                  <FundAccountLine name={r.kashi} other={r.kari} mode={fundMode} />
                </div>
                <input id={fid(i, 'sa')} className="ef-input" aria-label={`${i + 1}行目 貸方金額`} disabled={ro} value={fmtNum(r.kashiAmt)} onChange={(e) => setRow(i, { kashiAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => afterKashiAmt(i))} inputMode="numeric" placeholder="0" autoComplete="off" style={amt} />
                <div style={{ paddingTop: 6 }}>
                  <FlagButtons shohyo={r.shohyo} check={r.check} fusen={r.fusen} disabled={ro} onChange={(p) => setRow(i, p)} />
                </div>
                {!single ? (
                  <div style={{ display: 'flex', gap: 4, paddingTop: 8 }}>
                    <button type="button" className="ef-act" tabIndex={-1} disabled={ro} onClick={() => insertAt(i)} title={ro ? tools.reason : `${i + 1}行目の上に1行挿入`} style={rowBtn}>挿入</button>
                    <button type="button" className="ef-act" tabIndex={-1} disabled={ro} onClick={() => deleteAt(i)} title={ro ? tools.reason : `${i + 1}行目を削除`} style={{ ...rowBtn, color: '#c0392b', borderColor: '#f2c9c2' }}>削除</button>
                  </div>
                ) : <div />}
              </div>
              {rowIssues[i].length > 0 && <div style={{ marginTop: 8, marginLeft: 56 }}><IssueList issues={rowIssues[i]} compact /></div>}
            </div>
          ))}

          {/* 合計 */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 22px', background: '#fbfcfd', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>合計</div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: BLUE, fontVariantNumeric: 'tabular-nums' }}>{kariTotal.toLocaleString('ja-JP')}</div>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: balanced ? '#eaf5ef' : '#fdeee9', color: balanced ? '#1f7a52' : '#c0392b' }}>
                {balanced ? '貸借一致' : `差額 ${Math.abs(kariTotal - kashiTotal).toLocaleString('ja-JP')}`}
              </span>
              <span style={{ fontSize: 12, color: '#9aa5b1' }}>Seq No：自動</span>
              {err && <span role="alert" style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 600 }}>{err}</span>}
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16, color: PINK, fontVariantNumeric: 'tabular-nums' }}>{kashiTotal.toLocaleString('ja-JP')}</div>
            <div />
            <div />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px 12px', background: '#fbfcfd' }}>
            {!single && <button type="button" className="ef-act" tabIndex={-1} disabled={ro} onClick={() => { const n = rows.length; setRows((rs) => [...rs, emptyRow()]); setActive(n); focusId(fid(n, 'ka')); }} title={ro ? tools.reason : '最後に1行追加します'} style={rowBtn}>＋ 行追加</button>}
            <span style={{ fontSize: 11.5, color: '#8290a0' }}>{rows.length} 行</span>
            <span style={{ marginLeft: 'auto' }}>{tools.submitButton}</span>
          </div>

          {/* 伝票全体の判定（エラー＝登録不可／確認＝確認して登録） */}
          {allIssues.length > 0 && (
            <div style={{ padding: '0 22px 10px', background: '#fbfcfd' }}>
              <IssueList issues={allIssues} confirmId={`${pre}-confirm`} onConfirm={() => submit(true)} confirmDisabled={ro ? tools.reason : !balanced ? '借方合計と貸方合計が一致すると登録できます' : undefined} />
            </div>
          )}

          {/* 機能ボタン（入力補助／参照） */}
          <div style={{ padding: '4px 22px 16px', background: '#fbfcfd', borderRadius: `0 0 ${radius}px ${radius}px` }}>{tools.actionBar}</div>
        </div>

        {/* 当年仕訳一覧 */}
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: radius, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderBottom: '1px solid #eef2f5' }}>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 }}>当年仕訳</span>
            <FiscalMonthTabs current={monthFilter} accent={accent} onSelect={setMonthFilter} withAll />
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3' }}><b style={{ color: '#22303c' }}>{list.length}</b> 件</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) 120px', gap: 14, padding: '9px 22px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
            <div>月日</div>
            <div>借方科目</div>
            <div>貸方科目</div>
            <div>摘要</div>
            <div style={{ textAlign: 'right' }}>金額</div>
          </div>
          <div id="journal-scroll" style={{ overflowY: 'auto', maxHeight: 320 }}>
            {list.length === 0 && <div style={{ padding: '32px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>この月の仕訳はありません。</div>}
            {list.map((e) => {
              const isNew = lastIds.includes(e.id);
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '60px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) 120px', gap: 14, padding: '9px 22px', borderBottom: '1px solid #f1f4f6', fontSize: 12.5, alignItems: 'center', background: isNew ? '#fff2c9' : 'transparent', animation: isNew ? 'rowin 1.8s ease' : 'none' }}>
                  <div style={{ color: '#8895a3', fontSize: 12 }}>{e.date}</div>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kari}</div>
                  <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kashi}</div>
                  <div style={{ color: '#7a8794', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.tekiyo}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.amount.toLocaleString('ja-JP')}</div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </main>
  );
}
