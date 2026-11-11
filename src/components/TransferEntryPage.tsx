// 振替入力（振替伝票形式）／振替単一（振替単一形式：single）
//   振替伝票形式は、開いた直後に注意（複数行にわたる内部取引には非対応）を表示。
//   振替伝票形式の各行：借方金額／借方科目（資金科目は自動表示）／貸方科目（資金科目は自動表示）／貸方金額／摘要／取引先（確認メモ #193）。
//   振替単一形式は、1枚の伝票の中に単一形式の行が複数ある形（確認メモ #195）。
//     各行：金額／借方科目／貸方科目／内部取引（スイッチと相手区分）／摘要／取引先。金額は行ごとに完結する。
//   どちらも行の追加・挿入・削除ができる。入力区分・伝票日付・伝票No・Seq No・チェック・証憑・付箋・合計は伝票に1つ。
//   Enter 送り：月 → 日 →（振替伝票形式：内部取引スイッチ →（オンのとき相手区分）→）1行目の金額 →…（10/13 鈴木さん指示：日付の次に内部取引）。
//     どの欄の Enter でも登録はしない。行の最後の欄（取引先）の次は次の行へ移り、最後の行なら行を追加する（確認メモ #191／#196）。
//   振替伝票形式は借方合計＝貸方合計で登録可。当年仕訳の一覧は出さない（確認メモ #194／#197）。
//   機能ボタン（伝票の操作／行の操作／入力補助／参照）は常に表示し、Alt＋英字のショートカットでも動く。
//   消費税対応の法人（事業者 › 会計方針）では、各行に税区分・税額の欄を借方と貸方のそれぞれに出す（依頼書 2.4。確認メモ #192）。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { BudgetGraphModal, BudgetHintLive, EntryConfirmModal, EntryDivisionField, InternalSwitch, useEntryTools } from './EntryExtras';
import { judgeTorihiki } from '../lib/accounts';
import { ComboField, ENTRY_MONTH_HELP, EntryMonthNote, EntryStyles, parseEntryDate, useEntryYear, ENTRY_DATE_RANGE, ENTRY_YEAR_HELP, isIme, FundAccountLine, PAPER, PaperBox, PaperDate, PaperStyles, PaperTitle, fieldMessage, fieldState, fmtNum, focusId, hasError, hasWarn, isInternalAccount, judgeEntry, needsPartner, onEnter, scopeStyle, setPartner, toNum, type FundMode, type FusenColor, type Issue, FusenTab, VoucherMarks } from './EntryCommon';
import { useWidePanel } from './WidePanel';
import { addVoucher, updateVoucher } from '../store/journalStore';
import { setSession, useSession } from '../store/session';
import { useEntryDivision } from '../lib/entryDivision';
import { TAX_OPTS, taxAmountOf, taxDefaultOf } from '../lib/transferTax';

const PINK = '#b0426a';
const BLUE = '#2c5f9e';
const PURPLE = '#6b3fb5';
const ROW_COUNT = 5;
const ALERT_KEY = 'transfer-alert-hidden';

interface Row {
  /** 借方金額（振替単一形式では、その行の金額） */
  kariAmt: string;
  kari: string;
  kashi: string;
  /** 貸方金額（振替伝票形式だけ。振替単一形式では使わない） */
  kashiAmt: string;
  tekiyo: string;
  /** 取引先（行ごと。確認メモ #193） */
  gyosha: string;
  /** 税区分（消費税対応の法人のみ。借方・貸方それぞれ。空＝科目からの既定。確認メモ #192） */
  kariTax?: string;
  kashiTax?: string;
  /** 税額の手入力（借方・貸方それぞれ。未指定＝自動計算。端数の調整用。確認メモ #55） */
  kariTaxAmt?: string;
  kashiTaxAmt?: string;
  /** 振替単一形式：行ごとの内部取引と相手区分（確認メモ #195） */
  internal?: boolean;
  aite?: string;
}
const emptyRow = (): Row => ({ kariAmt: '', kari: '', kashi: '', kashiAmt: '', tekiyo: '', gyosha: '' });
/** 証憑・チェック・付箋は伝票1枚につき1つ（10/16 鈴木さん決定。確認メモ #47） */
interface VoucherFlags { check: boolean; fusen: FusenColor; shohyo: boolean }
const DEFAULT_FLAGS: VoucherFlags = { check: false, fusen: '', shohyo: true };
const isUsed = (r: Row) => !!(r.kari || r.kashi || toNum(r.kariAmt) || toNum(r.kashiAmt));
const isTouched = (r: Row) => isUsed(r) || !!r.tekiyo || !!r.gyosha;
/** 行の科目が内部取引科目（区分間…）か。内部取引スイッチは自動でオンになる */
const rowLocked = (r: Row) => isInternalAccount(r.kari) || isInternalAccount(r.kashi);
/** 振替単一形式：その行が内部取引か（スイッチがオン、または内部取引科目） */
const rowInternal = (r: Row) => !!r.internal || rowLocked(r);

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  /** 振替単一：1枚の伝票に、貸借が行ごとに完結する行を複数持つ（確認メモ #195）。注意ダイアログなし */
  single?: boolean;
  /** 形式の切替・問合せ画面への移動。未指定のときは切替を出さず、現在の形式だけを表示 */
  onNavigate?: (label: string) => void;
}

export function TransferEntryPage({ variant, accent, single, onNavigate }: Props) {
  const sess = useSession();
  const title = single ? '振替単一' : '振替伝票';
  const pre = single ? 'ts' : 'tr';
  /** 入力欄の id。ka＝借方金額（振替単一形式では行の金額）／k＝借方科目／s＝貸方科目／sa＝貸方金額／t＝摘要／g＝取引先／in＝行の内部取引スイッチ／ai＝行の相手区分 */
  const fid = (i: number, col: 'ka' | 'k' | 's' | 'sa' | 't' | 'g' | 'in' | 'ai') => `${pre}-${i}-${col}`;
  const [alertOpen, setAlertOpen] = useState(() => {
    if (single) return false;
    try {
      return localStorage.getItem(ALERT_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [dontShow, setDontShow] = useState(false);
  // 入力区分：入力区分で起動中は固定。親区分で起動中は、配下の入力区分から選んで登録できる（確認メモ #181／#182）
  const ed = useEntryDivision();
  const service = ed.division;
  // 日付：月・日は未入力で始める（入力は月から）
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  // 年：月を入れると自動で合う。翌年度の予備月（4〜6月）は年を直して入力する（確認メモ #184 の修正）
  const yr = useEntryYear();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: ROW_COUNT }, emptyRow));
  const [flags, setFlagsState] = useState<VoucherFlags>(DEFAULT_FLAGS);
  const setFlags = (p: Partial<VoucherFlags>) => setFlagsState((f) => ({ ...f, ...p }));
  const [active, setActive] = useState(0);
  const [cheque, setCheque] = useState('');
  const [err, setErr] = useState('');
  const [fundMode, setFundMode] = useState<FundMode>('自動資金');
  const [internal, setInternal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [aite, setAite] = useState('');
  const [graphAcct, setGraphAcct] = useState<string | null>(null);
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
    focusId(`${pre}-month`); // 案内を閉じたら日付の「月」から入力を始める
  };
  // 画面を開いたら「月」にカーソルを置く（案内ダイアログ表示中は閉じた後に置く）
  useEffect(() => { if (alertOpen) return; const t = window.setTimeout(() => document.getElementById(`${pre}-month`)?.focus(), 80); return () => window.clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setErr('');
  };
  const cur = Math.min(active, rows.length - 1);

  const kariTotal = rows.reduce((a, r) => a + toNum(r.kariAmt), 0);
  // 振替単一形式は金額が行ごとに完結するので、合計は1つ（貸方合計は借方合計と同じ。確認メモ #195）
  const kashiTotal = single ? kariTotal : rows.reduce((a, r) => a + toNum(r.kashiAmt), 0);
  const balanced = kariTotal > 0 && kariTotal === kashiTotal;
  const used = rows.filter(isUsed);
  const dirty = rows.some(isTouched);

  // 内部取引
  //   振替伝票形式：伝票に1つ。複数行の伝票では登録できない（振替伝票形式の制約）。1行の伝票のときだけ相手区分を入力する
  //   振替単一形式：行ごとに設定する（各行にスイッチと相手区分を持つ。確認メモ #195）
  const hasInternalAcc = rows.some(rowLocked);
  const multiInternal = !single && used.length > 1 && (hasInternalAcc || internal);
  const first = used[0] ?? rows[cur];
  const partner = !single && !multiInternal && (internal || hasInternalAcc) && needsPartner({ kari: first?.kari ?? '', kashi: first?.kashi ?? '', internal });
  /** 内部取引スイッチの表示（振替伝票形式。オンのとき相手区分を入力できる） */
  const internalOn = partner || internal || hasInternalAcc;

  /** 行ごとの判定（借方・貸方の両方が入っている行だけ） */
  const rowIssues: Issue[][] = rows.map((r) => {
    if (!r.kari || !r.kashi) return [];
    // 振替単一形式：内部取引と相手区分は行ごとに判定する
    if (single) return judgeEntry({ kari: r.kari, kashi: r.kashi, amount: toNum(r.kariAmt), fundMode, internal: !!r.internal, aite: r.aite ?? '', division: service }, sess.env);
    const list = judgeEntry({ kari: r.kari, kashi: r.kashi, amount: toNum(r.kariAmt) || toNum(r.kashiAmt), fundMode, internal: partner && internal, aite, division: service }, sess.env);
    // 複数行の内部取引は伝票全体のエラーとして別に出す
    return multiInternal ? list.filter((x) => x.code !== 'aite' && x.code !== 'aite-same' && x.code !== 'oneside') : list;
  });
  const voucherIssues: Issue[] = multiInternal ? [{ level: 'error', code: 'multi-internal', title: '複数行にわたる内部取引は振替伝票形式では登録できません', detail: '内部取引は、振替単一形式（行ごとに内部取引を設定できます）か、振替伝票形式の1行だけの伝票で登録してください。', field: 'pair' }] : [];
  const allIssues = [...voucherIssues, ...rowIssues.flatMap((list, i) => list.map((x) => ({ ...x, code: `${i}-${x.code}`, title: rows.length > 1 ? `${i + 1}行目：${x.title}` : x.title })))];
  const blocked = hasError(allIssues);

  /** 登録後・中止後の初期化。keepAccounts＝各行の借方・貸方科目を残す（入力の変更「登録後も直前の科目を残す」。確認メモ #47） */
  const resetEntry = (keepAccounts = false) => {
    setRows((rs) => Array.from({ length: ROW_COUNT }, (_, i) => (keepAccounts && rs[i] ? { ...emptyRow(), kari: rs[i].kari, kashi: rs[i].kashi } : emptyRow())));
    setActive(0);
    setCheque('');
    setErr('');
    setInternal(false);
    setAite('');
    setFlagsState(DEFAULT_FLAGS);
  };

  const submit = (confirmed = false): void => {
    if (!tools.editable) { toast.show(tools.reason); return; }
    // 年と月の組み合わせで判定する。決算月は月に 99、翌年度の予備月は年を翌年にして月に 4〜6（確認メモ #184）
    const em = parseEntryDate(yr.year, month);
    const dn = parseInt(day, 10);
    if (!em.ok || !(dn >= 1 && dn <= 31)) { setErr(`日付（年・月・日）を正しく入力してください。入力できるのは、${ENTRY_DATE_RANGE}です。`); focusId(!em.ok ? `${pre}-month` : `${pre}-day`); return; }
    if (used.length === 0) { setErr(single ? '金額と借方・貸方の科目を入力してください。' : '借方・貸方の科目と金額を入力してください。'); focusId(fid(0, 'ka')); return; }
    const noAcc = rows.findIndex((r) => isUsed(r) && !r.kari && !r.kashi);
    if (noAcc >= 0) { setErr(`${noAcc + 1}行目の科目が未入力です。`); focusId(fid(noAcc, 'k')); return; }
    if (single) {
      // 振替単一形式：金額は行ごとに完結する。入力のある行は、金額・借方科目・貸方科目がそろっていること（確認メモ #195）
      const bad = rows.findIndex((r) => isUsed(r) && (!toNum(r.kariAmt) || !r.kari || !r.kashi));
      if (bad >= 0) {
        const r = rows[bad];
        setErr(`${bad + 1}行目の${!toNum(r.kariAmt) ? '金額' : !r.kari ? '借方科目' : '貸方科目'}が未入力です（振替単一形式は、行ごとに金額・借方科目・貸方科目を入力します）。`);
        focusId(fid(bad, !toNum(r.kariAmt) ? 'ka' : !r.kari ? 'k' : 's'));
        return;
      }
    } else if (!balanced) { setErr(`借方合計と貸方合計が一致していません（差額 ${Math.abs(kariTotal - kashiTotal).toLocaleString('ja-JP')} 円）。`); return; }
    if (blocked) {
      toast.show('登録できない内容があります。入力欄の下に表示しているエラーを直してください');
      if (single) {
        // 相手区分が未入力・不正の行があれば、その行の相手区分へ
        const k = rows.findIndex((r, i) => rowInternal(r) && rowIssues[i].some((x) => x.field === 'aite'));
        if (k >= 0) focusId(fid(k, 'ai'));
      } else if (partner && !aite) focusId(`${pre}-aite`);
      return;
    }
    if (hasWarn(allIssues) && !confirmed) { setConfirmOpen(true); return; }
    // 登録の前に「登録しますか？」と確認する（確認メモ #153）。警告の確認を経たときは重ねて聞かない
    if (!confirmed) { tools.askRegister(() => submit(true)); return; }
    const date = `${em.month}/${dn}`;
    let no: string | undefined;
    let seq: number | undefined;
    used.forEach((r) => {
      const ka = toNum(r.kariAmt);
      const sa = single ? ka : toNum(r.kashiAmt);
      // 内部取引：振替単一形式は行ごと、振替伝票形式は伝票に1つ
      const rowPartner = single ? rowInternal(r) : partner;
      // 税区分・税額（消費税対応の法人のみ。借方・貸方それぞれ。確認メモ #192）
      const kt = r.kariTax || taxDefaultOf(r.kari);
      const st = r.kashiTax || taxDefaultOf(r.kashi);
      const tax = sess.taxEntry ? { kariTax: kt, kariTaxAmt: r.kariTaxAmt ? toNum(r.kariTaxAmt) : taxAmountOf(kt, ka), kashiTax: st, kashiTaxAmt: r.kashiTaxAmt ? toNum(r.kashiTaxAmt) : taxAmountOf(st, sa) } : {};
      // 共有の仕訳（参照パネル・残高・伝票訂正の対象）に登録。同じ伝票の行は同じ伝票Noにまとめる
      const stored = addVoucher({
        kind: single ? '振単' : '振替', date, kari: r.kari || '諸口', kashi: r.kashi || '諸口', tekiyo: r.tekiyo, gyosha: r.gyosha || undefined,
        amount: ka || sa,
        // 振替伝票形式は、行の借方金額と貸方金額をそれぞれ持つ（行単位では貸借の金額が異なることがある）
        ...(single ? {} : { kariAmount: ka, kashiAmount: sa }),
        ...tax,
        service, shohyo: flags.shohyo, cheque: cheque || undefined, internal: rowPartner || undefined, term: em.term,
        ...(no != null && seq != null ? { no, seq } : {}),
      });
      no = stored.no;
      seq = stored.seq;
      if (flags.check || flags.fusen) updateVoucher(stored.id, { check: flags.check, fusen: flags.fusen });
      if (rowPartner) setPartner(stored.id, single ? r.aite ?? '' : aite);
    });
    resetEntry(sess.input.keepLast);
    toast.show(`${title}を登録しました（${used.length}行）`);
    focusId(fid(0, 'ka'));
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
    lines: rows.filter(isTouched).map((r) => ({ kari: r.kari, kashi: r.kashi, tekiyo: r.tekiyo, amount: r.kariAmt || r.kashiAmt, gyosha: r.gyosha || undefined })),
    multiRow: true,
    rowLabel: `${cur + 1}行目`,
    flags,
    onFlags: setFlags,
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
    // 内部取引：振替単一形式は入力中の行、振替伝票形式は伝票に1つ
    internal: single ? rowInternal(rows[cur] ?? emptyRow()) : internalOn,
    internalLocked: single ? rowLocked(rows[cur] ?? emptyRow()) : hasInternalAcc,
    internalId: `${pre}-internal`,
    onInternalNext: () => focusId(internalOn && !aite ? `${pre}-aite` : fid(cur, 'ka')),
    blocked,
    onInternal: () => {
      if (single) {
        // 入力中の行の内部取引を切り替える（内部取引科目の行はオンのまま固定）
        const r = rows[cur];
        if (!r || rowLocked(r)) return;
        if (r.internal) { setRow(cur, { internal: false, aite: '' }); return; }
        setRow(cur, { internal: true });
        focusId(fid(cur, 'ai'));
        return;
      }
      if (internal) { setInternal(false); return; }
      setInternal(true);
      if (used.length > 1) toast.show('内部取引は1行の伝票で登録してください（複数行の振替伝票では登録できません）');
      else focusId(`${pre}-aite`);
    },
    year: yr.year,
    onPickDate: (m, d, y) => { setMonth(m); setDay(d); if (y) yr.set(y); focusId(single ? fid(0, 'ka') : `${pre}-internal`); },
    onOpenPanel: () => { wide.setCollapsed(false); toast.show('画面の下に参照パネルを開きました'); },
    submitId: `${pre}-submit`,
    enterOrder: single
      ? '月 → 日 → 行ごとに［金額 → 借方科目 → 貸方科目 → 内部取引スイッチ（Shift+Enter でオン／オフ）→（オンのとき：相手区分）→ 摘要 → 取引先］→ 次の行（最後の行なら行を追加）。入力を終えるときは、何も入力していない行の金額欄で Enter を押すと伝票登録ボタンへ移ります'
      : '月 → 日 → 内部取引スイッチ（Shift+Enter でオン／オフ）→（オンのとき：相手区分）→ 行ごとに［借方金額 → 借方科目 → 貸方科目 → 貸方金額 → 摘要 → 取引先］→ 次の行（最後の行なら行を追加）。貸借が一致したあと、何も入力していない行の借方金額で Enter を押すと伝票登録ボタンへ移ります',
  });
  const ro = !tools.editable;

  // ── Enter での移動（確認メモ #191／#196）。金額欄・摘要・取引先の Enter では登録しない ──
  /** 伝票日付（日・小切手No）の次：振替伝票形式は内部取引スイッチ、振替単一形式は1行目の金額 */
  const afterDate = () => focusId(single ? fid(0, 'ka') : `${pre}-internal`);
  /** 行の最後の欄（取引先）の次：次の行の金額へ。最後の行なら行を追加する（仕訳伝票形式の #154 と同じ考え方） */
  const nextRow = (i: number) => {
    if (i + 1 >= rows.length) {
      if (ro) { focusId(`${pre}-submit`); return; }
      setRows((rs) => [...rs, emptyRow()]);
    }
    setActive(i + 1);
    focusId(fid(i + 1, 'ka'));
  };
  /** 摘要の次：取引先へ。Shift+Enter：この行の下に1行追加 */
  const afterTekiyo = (i: number) => focusId(fid(i, 'g'));
  const rowAddAfter = (i: number) => { if (ro) return; setRows((rs) => [...rs.slice(0, i + 1), emptyRow(), ...rs.slice(i + 1)]); setActive(i + 1); focusId(fid(i + 1, 'ka')); };
  /** 金額（借方金額）の次：借方科目へ。入力を終えるとき＝何も入力していない行（2行目以降）で、登録できる内容がそろっていれば伝票登録ボタンへ */
  const afterKariAmt = (i: number) => {
    if (i > 0 && (single ? used.length > 0 : balanced) && !isTouched(rows[i])) { focusId(`${pre}-submit`); return; }
    focusId(fid(i, 'k'));
  };
  /** 貸方科目の次。振替伝票形式：貸方金額へ（空なら借方金額を写す）。振替単一形式：行の内部取引スイッチへ */
  const afterKashi = (i: number, value: string) => {
    if (single) { focusId(fid(i, tools.viewOnly ? 't' : 'in')); return; }
    const r = rows[i];
    if (value && !r.kashiAmt && r.kariAmt && r.kari) setRow(i, { kashiAmt: r.kariAmt });
    focusId(fid(i, 'sa'));
  };
  /** 貸方金額・相手区分の次：摘要へ */
  const toTekiyo = (i: number) => focusId(fid(i, 't'));

  const isSheet = variant === 'sheet';

  const input: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    border: '1px solid transparent',
    borderRadius: 4,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    color: '#22303c',
    background: 'transparent',
    minWidth: 0,
  };
  const amt: CSSProperties = { ...input, textAlign: 'right', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' };
  /** 用紙の列。振替伝票形式：借方金額 ｜ 借方科目 ｜ 貸方科目 ｜ 貸方金額 ｜ 行番号・行の操作。振替単一形式：金額 ｜ 借方科目 ｜ 貸方科目 ｜ 内部取引 ｜ 行番号・行の操作 */
  const GRID = single ? '158px minmax(0,1fr) minmax(0,1fr) 190px 118px' : '158px minmax(0,1fr) minmax(0,1fr) 158px 118px';
  const rowBtn: CSSProperties = { padding: '3px 7px', borderRadius: 6, border: '1px solid #cfd8e0', background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#5b6773' };
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
  const budgetTh = sess.env.budgetCheck ? sess.env.budgetThreshold : 101;
  const divisionName = service.replace(/^\d+\s*/, '');
  const fillerRows = Math.max(0, ROW_COUNT - rows.length);
  const cell: CSSProperties = { padding: '6px 8px' };
  const bandCell: CSSProperties = { padding: '2px 8px 6px', minHeight: 32 };
  const subLab: CSSProperties = { fontSize: 12, fontWeight: 700, color: PAPER.ink, flex: 'none', whiteSpace: 'nowrap' };

  // ── 税区分・税額（消費税対応の法人のみ。借方と貸方のそれぞれに持つ。確認メモ #192） ──
  /** 税額の基礎になる金額：借方は借方金額、貸方は貸方金額（振替単一形式は行の金額） */
  const taxBase = (r: Row, side: 'kari' | 'kashi') => toNum(side === 'kari' || single ? r.kariAmt : r.kashiAmt);
  const taxKindOf = (r: Row, side: 'kari' | 'kashi') => (side === 'kari' ? r.kariTax || taxDefaultOf(r.kari) : r.kashiTax || taxDefaultOf(r.kashi));
  const taxKindCell = (r: Row, i: number, side: 'kari' | 'kashi', bg?: string) => {
    const name = side === 'kari' ? '借方' : '貸方';
    return (
      <div className="pp-cell" style={{ ...cell, padding: '4px 8px', background: bg, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...subLab, color: side === 'kari' ? BLUE : PINK }}>{name} 税区分</span>
        <select data-tax-kind={side} aria-label={`${i + 1}行目 ${name}の税区分`} disabled={ro} value={taxKindOf(r, side)} onChange={(e) => setRow(i, side === 'kari' ? { kariTax: e.target.value } : { kashiTax: e.target.value })} className="ef-input pp-input" style={{ fontSize: 14, padding: '3px 4px', minWidth: 0, flex: 1 }}>
          {TAX_OPTS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
  };
  const taxAmtCell = (r: Row, i: number, side: 'kari' | 'kashi', bg?: string) => {
    const name = side === 'kari' ? '借方' : '貸方';
    const manual = side === 'kari' ? r.kariTaxAmt : r.kashiTaxAmt;
    const patch = (v: string | undefined): Partial<Row> => (side === 'kari' ? { kariTaxAmt: v } : { kashiTaxAmt: v });
    return (
      <div className="pp-cell pp-num" style={{ ...cell, padding: '4px 8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <span style={{ ...subLab, color: side === 'kari' ? BLUE : PINK }}>税額</span>
        <input
          data-tax-amount={side}
          aria-label={`${i + 1}行目 ${name}の税額`}
          disabled={ro}
          className="ef-input pp-input"
          inputMode="numeric"
          value={fmtNum(manual ?? String(taxAmountOf(taxKindOf(r, side), taxBase(r, side))))}
          onChange={(e) => setRow(i, patch(e.target.value.replace(/[^0-9]/g, '')))}
          onBlur={() => { if (manual === '') setRow(i, patch(undefined)); }}
          title="金額 × 税率 ÷（100 ＋ 税率）の切り捨てで自動計算。端数の調整は手入力で変更できます（空にすると自動計算に戻ります）"
          style={{ width: 90, textAlign: 'right', fontSize: 14, padding: '3px 6px', color: manual != null ? '#22303c' : '#48565f' }}
        />
      </div>
    );
  };

  return (
    <main className="ef-scope" style={{ ...scopeStyle(accent), flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <EntryStyles />
      <PaperStyles />
      <ToastView msg={toast.msg} />
      {tools.dialogs}
      <EntryConfirmModal
        open={confirmOpen}
        kind={judgeTorihiki(rows[cur]?.kari ?? '', rows[cur]?.kashi ?? '', fundMode === '強制資金').kind}
        issues={allIssues.filter((i) => i.level === 'warn')}
        onClose={() => setConfirmOpen(false)}
        onProceed={(dont) => {
          const warns = allIssues.filter((i) => i.level === 'warn');
          if (dont) setSession({ env: { ...sess.env, ...(warns.some((w) => /expense$/.test(w.code)) ? { confirmExpense: false } : {}), ...(warns.some((w) => /income$/.test(w.code)) ? { confirmIncome: false } : {}) } });
          setConfirmOpen(false);
          submit(true);
        }}
        accent={accent}
      />
      <BudgetGraphModal open={!!graphAcct} onClose={() => setGraphAcct(null)} account={graphAcct ?? ''} />

      {/* 振替伝票形式の注意（複数行の内部取引には非対応） */}
      <Modal open={alertOpen} onClose={closeAlert} width={520} strict>
        <div style={{ padding: '26px 28px 22px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#fff3cd', color: '#b7791f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>!</span>
            <div>
              <div style={{ fontSize: 14, color: '#8290a0', fontWeight: 700, marginBottom: 4 }}>振替式の内部取引伝票入力についてのご確認</div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6 }}>振替伝票は複数行にわたる内部取引の仕訳に対応しておりません</div>
              <div style={{ fontSize: 14, color: '#48565f', lineHeight: 1.7, marginTop: 8 }}>振替式単一、もしくは振替式で１行の伝票入力であれば登録が可能です。</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#5b6773', cursor: 'pointer' }}>
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
              今後、このメッセージを表示しない
            </label>
            <button type="button" autoFocus onClick={closeAlert} style={{ padding: '9px 32px', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </div>
      </Modal>

      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* 伝票（候補の一覧がカードの外にはみ出せるよう、overflow は隠さない） */}
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: radius, boxShadow: '0 6px 26px rgba(30,50,70,.07)' }}>
          <div style={{ borderRadius: `${radius}px ${radius}px 0 0`, overflow: 'hidden' }}>
            {/* 伝票の形式の切替 */}
            {tools.topBar}
            {tools.banner}
          </div>

          <div style={{ padding: '18px 22px 12px', background: '#eef1ef', borderBottom: '1px solid #e2e8ee' }}>
            {/* 伝票用紙 */}
            <div className="pp-sheet" style={{ padding: '16px 20px 16px' }}>
              {/* 伝票に付けた付箋：用紙の右端に貼る（伝票1枚につき1つ） */}
              <FusenTab color={flags.fusen} offset={-10} top={64} />
              <PaperTitle
                title={title}
                division={`${divisionName} 拠点区分`}
                badge={<span style={{ fontSize: 12, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{single ? '振替単一形式（複数行）' : '振替伝票形式（複数行）'}　<span style={{ color: '#7a8794', fontWeight: 500 }}>{single ? '金額は行ごとに完結します（1行に金額・借方科目・貸方科目を入力）' : '借方合計と貸方合計が一致すると登録できます'}</span></span>}
                right={tools.templateButton}
              />

              {/* 1段目：入力区分／年月日／伝票No／小切手No／内部取引相手区分 */}
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div className="ef-field" style={{ display: 'flex', width: 300 }}>
                  <PaperBox label="入力区分" grow>
                    <EntryDivisionField ctl={ed} id={`${pre}-service`} disabled={ro} onCommit={() => focusId(`${pre}-month`)} />
                  </PaperBox>
                </div>
                <div className="ef-field" style={{ display: 'flex', alignItems: 'center' }}>
                  <PaperDate
                    yearInput={<input id={`${pre}-year`} className="ef-input pp-input" aria-label="年" title={ENTRY_YEAR_HELP} disabled={ro} value={yr.year} onChange={(e) => yr.edit(e.target.value)} onFocus={(e) => e.currentTarget.select()} onKeyDown={onEnter(() => focusId(`${pre}-month`))} inputMode="numeric" autoComplete="off" style={{ ...input, width: 44, padding: '8px 2px', textAlign: 'center', fontSize: 14 }} />}
                    note={<EntryMonthNote month={month} year={yr.year} />}
                    month={<input id={`${pre}-month`} className="ef-input pp-input" aria-label="月" title={ENTRY_MONTH_HELP} disabled={ro} value={month} onChange={(e) => { const m = e.target.value.replace(/[^0-9]/g, '').slice(0, 2); setMonth(m); yr.onMonth(m); }} onKeyDown={onEnter(() => { if (parseEntryDate(yr.year, month).term === '決算' && !day) setDay('31'); focusId(`${pre}-day`); })} inputMode="numeric" style={{ ...input, width: 44, padding: '8px 2px', textAlign: 'center', fontSize: 14 }} />}
                    day={<input id={`${pre}-day`} className="ef-input pp-input" aria-label="日" disabled={ro} value={day} onChange={(e) => setDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} onKeyDown={onEnter(afterDate)} inputMode="numeric" style={{ ...input, width: 44, padding: '8px 2px', textAlign: 'center', fontSize: 14 }} />}
                  />
                </div>
                <PaperBox label={<span>伝票<span className="pp-sub">No</span></span>}>
                  <span className="pp-ro" style={{ whiteSpace: 'nowrap' }}>自動採番<small>自動</small></span>
                </PaperBox>
                {sess.input.cheque && (
                  <div className="ef-field" style={{ display: 'flex', width: 190 }}>
                    <PaperBox label="小切手No" grow>
                      <input className="ef-input pp-input" disabled={ro} value={cheque} onChange={(e) => setCheque(e.target.value)} onKeyDown={onEnter(afterDate)} placeholder="任意" autoComplete="off" style={{ ...input, padding: '6px 6px' }} />
                    </PaperBox>
                  </div>
                )}
                {/* 内部取引相手区分（振替伝票形式：伝票に1つ。最初から表示し、スイッチがオンのときだけ入力できる）。振替単一形式は行ごとに持つので、ここには出さない */}
                {!single && (
                  <div className="ef-field" data-internal-area data-on={internalOn ? '1' : '0'} style={{ display: 'flex', width: 430 }}>
                    <PaperBox label={<span style={{ color: internalOn ? PURPLE : '#8895a3' }}>内部取引相手区分</span>} grow muted={!internalOn}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                        {tools.internalSwitch}
                        <div style={{ flex: 1, minWidth: 0, opacity: internalOn ? 1 : 0.5 }}>
                          <ComboField id={`${pre}-aite`} title={!internalOn ? '左の「内部取引」スイッチをオンにすると入力できます（内部取引科目を選ぶと自動でオンになります）' : undefined} kind="service" value={aite} onChange={setAite} onCommit={() => focusId(fid(cur, 'ka'))} placeholder="相手先の区分を指定" disabled={ro || !internalOn} padY={6} invalid={internalOn ? fieldState(rowIssues.flat(), 'aite') : undefined} message={internalOn ? fieldMessage(rowIssues.flat(), 'aite') : undefined} />
                        </div>
                      </div>
                    </PaperBox>
                  </div>
                )}
                <VoucherMarks seq="自動" flags={flags} onChange={setFlags} disabled={ro} viewOnly={tools.viewOnly} />
                {/* 資金モードの切替（自動資金⇄強制資金） */}
                <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>{tools.fundSwitch}</div>
              </div>

              {/* 2段目：明細（金額／率／予算残 ｜ 借方科目 ｜ 貸方科目 ｜ 金額／率／予算残） */}
              <div className="pp-table" style={{ gridTemplateColumns: '1fr' }}>
                <div className="pp-row" style={{ gridTemplateColumns: GRID }}>
                  <div className="pp-lab" style={{ color: BLUE }}><span>{single ? '金額' : '借方 金額'}<span className="pp-sub">率／予算残</span></span></div>
                  <div className="pp-lab pp-left" style={{ color: BLUE, fontSize: 14 }}><span>借方科目<span className="pp-sub">資金科目（自動）／摘要</span></span></div>
                  <div className="pp-lab pp-left" style={{ color: PINK, fontSize: 14 }}><span>貸方科目<span className="pp-sub">資金科目（自動）／取引先</span></span></div>
                  {single
                    ? <div className="pp-lab" style={{ color: PURPLE }}><span>内部取引<span className="pp-sub">行ごと／相手区分</span></span></div>
                    : <div className="pp-lab" style={{ color: PINK }}><span>貸方 金額<span className="pp-sub">率／予算残</span></span></div>}
                  <div className="pp-lab"><span>行<span className="pp-sub">挿入／削除</span></span></div>
                </div>

                {rows.map((r, i) => {
                  const on = i === cur;
                  const bg = on ? '#f7fbf9' : undefined;
                  const rin = rowInternal(r);
                  return (
                    <div key={i} className="pp-row" data-row={i} onFocus={() => setActive(i)} style={{ gridTemplateColumns: GRID }}>
                      {/* 1行目：金額・科目 */}
                      <div className="pp-cell" style={{ ...cell, background: bg }}>
                        <input id={fid(i, 'ka')} className="ef-input pp-input" aria-label={single ? `${i + 1}行目 金額` : `${i + 1}行目 借方金額`} disabled={ro} value={fmtNum(r.kariAmt)} onChange={(e) => setRow(i, { kariAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => afterKariAmt(i))} inputMode="numeric" placeholder="0" autoComplete="off" style={amt} />
                      </div>
                      <div className="pp-cell" style={{ ...cell, background: bg }}>
                        <ComboField id={fid(i, 'k')} kind="account" value={r.kari} onChange={(x) => setRow(i, { kari: x })} onCommit={() => focusId(fid(i, 's'))} placeholder="借方科目（コード・名称・フリガナ）" listWidth={400} padY={8} disabled={ro} invalid={fieldState(rowIssues[i], 'kari', 'pair')} message={fieldMessage(rowIssues[i], 'kari')} />
                      </div>
                      <div className="pp-cell" style={{ ...cell, background: bg }}>
                        <ComboField id={fid(i, 's')} kind="account" value={r.kashi} onChange={(x) => setRow(i, { kashi: x })} onCommit={(x) => afterKashi(i, x)} placeholder="貸方科目（コード・名称・フリガナ）" listWidth={400} padY={8} disabled={ro} invalid={fieldState(rowIssues[i], 'kashi', 'pair')} message={fieldMessage(rowIssues[i], 'kashi', 'pair')} />
                      </div>
                      {single ? (
                        // 振替単一形式：内部取引は行ごと（スイッチ。内部取引科目を選ぶと自動でオン）
                        <div className="pp-cell pp-center" data-row-internal data-on={rin ? '1' : '0'} style={{ ...cell, padding: '6px 4px', background: bg }}>
                          {!tools.viewOnly && (
                            <InternalSwitch
                              id={fid(i, 'in')}
                              on={rin}
                              disabled={ro}
                              locked={rowLocked(r)}
                              onToggle={() => setRow(i, r.internal ? { internal: false, aite: '' } : { internal: true })}
                              onNext={() => focusId(fid(i, rin && !r.aite ? 'ai' : 't'))}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="pp-cell" style={{ ...cell, background: bg }}>
                          <input id={fid(i, 'sa')} className="ef-input pp-input" aria-label={`${i + 1}行目 貸方金額`} disabled={ro} value={fmtNum(r.kashiAmt)} onChange={(e) => setRow(i, { kashiAmt: e.target.value.replace(/[^0-9]/g, '') })} onKeyDown={onEnter(() => toTekiyo(i))} inputMode="numeric" placeholder="0" autoComplete="off" style={amt} />
                        </div>
                      )}
                      <div className="pp-cell pp-center" style={{ ...cell, padding: '6px 4px', gap: 6, background: bg }}>
                        <span style={{ fontSize: 14, color: '#9aa5b1', flex: 'none' }}>
                          <span className="ef-rowno pp-num" style={{ fontWeight: on ? 800 : 500, color: on ? accent : '#9aa5b1' }}>{i + 1}</span>
                          <span className="ef-rownow" style={{ padding: '1px 5px', borderRadius: 7, background: accent, color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>入力中</span>
                        </span>
                      </div>
                      {/* 2行目：資金（薄い帯）…率／予算残・資金科目 */}
                      <div className="pp-cell pp-auto pp-col" style={bandCell}>
                        <div style={{ marginTop: -8 }}><BudgetHintLive account={r.kari} threshold={budgetTh} onOpen={() => setGraphAcct(r.kari)} /></div>
                      </div>
                      <div className="pp-cell pp-auto" style={{ ...bandCell, gap: 8 }}>
                        <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: PAPER.ink, marginTop: 5 }}>資金</span>
                        <div style={{ flex: 1, minWidth: 0 }}><FundAccountLine name={r.kari} other={r.kashi} mode={fundMode} /></div>
                      </div>
                      <div className="pp-cell pp-auto" style={{ ...bandCell, gap: 8 }}>
                        <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: PAPER.ink, marginTop: 5 }}>資金</span>
                        <div style={{ flex: 1, minWidth: 0 }}><FundAccountLine name={r.kashi} other={r.kari} mode={fundMode} /></div>
                      </div>
                      <div className="pp-cell pp-auto pp-col" style={bandCell}>
                        <div style={{ marginTop: -8 }}><BudgetHintLive account={r.kashi} threshold={budgetTh} onOpen={() => setGraphAcct(r.kashi)} /></div>
                      </div>
                      <div className="pp-cell pp-band pp-center" style={{ ...bandCell, gap: 4, paddingTop: 4 }}>
                        {!tools.viewOnly ? (
                          <>
                            <button type="button" className="ef-act" tabIndex={-1} disabled={ro} onClick={() => insertAt(i)} title={ro ? tools.reason : `${i + 1}行目の上に1行挿入`} style={rowBtn}>挿入</button>
                            <button type="button" className="ef-act" tabIndex={-1} disabled={ro} onClick={() => deleteAt(i)} title={ro ? tools.reason : `${i + 1}行目を削除`} style={{ ...rowBtn, color: '#c0392b', borderColor: '#f2c9c2' }}>削除</button>
                          </>
                        ) : null}
                      </div>
                      {/* 3行目：摘要 ｜ 取引先（どちらも行ごと。確認メモ #193）｜ 振替単一形式は行の相手区分 */}
                      <div className="pp-cell pp-right" style={{ ...cell, padding: '4px 8px', background: bg }}>
                        <span style={subLab}>摘要</span>
                      </div>
                      <div className="pp-cell" style={{ ...cell, padding: '4px 8px', background: bg }} onKeyDownCapture={(e) => { if (e.key === 'Enter' && e.shiftKey && !isIme(e)) { e.preventDefault(); e.stopPropagation(); rowAddAfter(i); } }}>
                        <ComboField id={fid(i, 't')} kind="summary" freeText value={r.tekiyo} onChange={(x) => setRow(i, { tekiyo: x })} onCommit={() => afterTekiyo(i)} placeholder="摘要（任意）" listWidth={320} fontSize={14} padY={5} disabled={ro} />
                      </div>
                      <div className="pp-cell" style={{ ...cell, padding: '4px 8px', background: bg, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={subLab}>取引先</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <ComboField id={fid(i, 'g')} kind="vendor" value={r.gyosha} onChange={(x) => setRow(i, { gyosha: x })} onCommit={() => nextRow(i)} placeholder="取引先（任意）" listWidth={300} fontSize={14} padY={5} disabled={ro} />
                        </div>
                      </div>
                      <div className="pp-cell" style={{ ...cell, padding: '4px 8px', gridColumn: 'span 2', background: bg, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {single && (
                          <>
                            <span style={{ ...subLab, color: rin ? PURPLE : '#8895a3' }}>相手区分</span>
                            <div style={{ flex: 1, minWidth: 0, opacity: rin ? 1 : 0.5 }}>
                              <ComboField id={fid(i, 'ai')} title={!rin ? 'この行の「内部取引」スイッチをオンにすると入力できます（内部取引科目を選ぶと自動でオンになります）' : undefined} kind="service" value={r.aite ?? ''} onChange={(x) => setRow(i, { aite: x })} onCommit={() => toTekiyo(i)} placeholder="相手先の区分" listWidth={300} fontSize={14} padY={5} disabled={ro || !rin} invalid={rin ? fieldState(rowIssues[i], 'aite') : undefined} message={rin ? fieldMessage(rowIssues[i], 'aite') : undefined} />
                            </div>
                          </>
                        )}
                      </div>
                      {/* 4行目（消費税対応の法人のみ）：税区分・税額を借方と貸方のそれぞれに持つ（依頼書 2.4、確認メモ #192。税区分の画面「消費税対応」で切替） */}
                      {sess.taxEntry && (
                        <>
                          {taxAmtCell(r, i, 'kari', bg)}
                          {taxKindCell(r, i, 'kari', bg)}
                          {taxKindCell(r, i, 'kashi', bg)}
                          {taxAmtCell(r, i, 'kashi', bg)}
                          <div className="pp-cell" style={{ ...cell, padding: '4px 8px', background: bg }} />
                        </>
                      )}
                    </div>
                  );
                })}

                {Array.from({ length: fillerRows }, (_, k) => (
                  <div key={'blank-' + k} className="pp-row" aria-hidden style={{ gridTemplateColumns: GRID }}>
                    <div className="pp-cell pp-empty" style={{ minHeight: 42 }} />
                    <div className="pp-cell pp-empty" style={{ minHeight: 42 }} />
                    <div className="pp-cell pp-empty" style={{ minHeight: 42 }} />
                    <div className="pp-cell pp-empty" style={{ minHeight: 42 }} />
                    <div className="pp-cell pp-empty pp-center pp-num" style={{ minHeight: 42, color: '#c9d4ce', fontSize: 14 }}>{rows.length + k + 1}</div>
                    <div className="pp-cell pp-band" style={{ minHeight: 28, color: '#b7c9bd', fontSize: 12 }}>資金</div>
                    <div className="pp-cell pp-band" style={{ minHeight: 28, color: '#b7c9bd', fontSize: 12 }}>資金</div>
                    <div className="pp-cell pp-band" style={{ minHeight: 28, color: '#b7c9bd', fontSize: 12 }}>資金</div>
                    <div className="pp-cell pp-band" style={{ minHeight: 28 }} />
                    <div className="pp-cell pp-band" style={{ minHeight: 28 }} />
                  </div>
                ))}

                {/* 下段：合計 ｜ 小切手No ｜ 合計（振替単一形式は合計金額が伝票に1つ） */}
                <div className="pp-row" style={{ gridTemplateColumns: GRID }}>
                  <div className="pp-cell" style={{ padding: 0 }}>
                    <div className="pp-foot" style={{ width: '100%' }}>
                      <span className="pp-lab" style={{ fontSize: 14, color: BLUE }}>{single ? '合計金額' : '合計'}</span>
                      <span className="pp-val pp-grow pp-num"><span className="pp-ro pp-ro-fill" style={{ justifyContent: 'flex-end', fontSize: 17, fontWeight: 800, color: BLUE }}>{kariTotal.toLocaleString('ja-JP')}</span></span>
                    </div>
                  </div>
                  <div className="pp-cell" style={{ padding: '6px 12px', gridColumn: 'span 2', background: PAPER.fill, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {sess.input.cheque && <><span className="pp-lab" style={{ fontSize: 14 }}>小切手No</span><span className="pp-ro pp-ro-s pp-num">{cheque || '—'}</span></>}
                  </div>
                  {single ? (
                    <>
                      <div className="pp-cell" style={{ padding: '6px 8px', background: PAPER.fill }} />
                      <div className="pp-cell pp-center" style={{ padding: '4px 6px' }}>
                        <span data-used-rows style={{ fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: used.length > 0 ? '#eaf5ef' : '#f1f4f6', color: used.length > 0 ? '#1f7a52' : '#8290a0', whiteSpace: 'nowrap' }}>入力 {used.length} 行</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pp-cell" style={{ padding: 0 }}>
                        <div className="pp-foot" style={{ width: '100%' }}>
                          <span className="pp-lab" style={{ fontSize: 14, color: PINK }}>合計</span>
                          <span className="pp-val pp-grow pp-num"><span className="pp-ro pp-ro-fill" style={{ justifyContent: 'flex-end', fontSize: 17, fontWeight: 800, color: PINK }}>{kashiTotal.toLocaleString('ja-JP')}</span></span>
                        </div>
                      </div>
                      <div className="pp-cell pp-center" style={{ padding: '4px 6px' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: balanced ? '#eaf5ef' : '#fdeee9', color: balanced ? '#1f7a52' : '#c0392b', whiteSpace: 'nowrap' }}>{balanced ? '貸借一致' : `差額 ${Math.abs(kariTotal - kashiTotal).toLocaleString('ja-JP')}`}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {!tools.viewOnly && <button type="button" className="ef-act" tabIndex={-1} disabled={ro} onClick={() => { const n = rows.length; setRows((rs) => [...rs, emptyRow()]); setActive(n); focusId(fid(n, 'ka')); }} title={ro ? tools.reason : '最後に1行追加します'} style={{ ...rowBtn, padding: '4px 11px', borderStyle: 'dashed', borderColor: '#b9c4cf', fontSize: 14 }}>＋ 行追加</button>}
                <span style={{ fontSize: 12, color: '#8290a0' }}>{rows.length} 行　取引先で Enter → 次の行（最後の行なら行を追加）／摘要で Shift+Enter → 下に行追加／何も入力していない行の{single ? '金額' : '借方金額'}で Enter → 伝票登録ボタン</span>
                {err && <span role="alert" style={{ color: '#c0392b', fontSize: 14, fontWeight: 600 }}>{err}</span>}
                <span style={{ marginLeft: 'auto' }}>{tools.submitButton}</span>
              </div>
            </div>

            {/* 伝票全体のエラー（行の入力欄には出せないもの）。確認が必要な内容は登録時にモーダルで表示 */}
            {voucherIssues.length > 0 && (
              <div role="alert" style={{ marginTop: 12, padding: '9px 12px', borderRadius: 9, border: '1px solid #f0b9ae', borderLeft: '5px solid #a5281b', background: '#fdeee9', color: '#a5281b', fontSize: 14, lineHeight: 1.6 }}>
                {voucherIssues.map((i) => <div key={i.code}><b>{i.title}</b>　<span style={{ fontWeight: 400 }}>{i.detail}</span></div>)}
              </div>
            )}
          </div>

          {/* 機能ボタン（入力補助／参照） */}
          <div style={{ padding: '10px 22px 16px', borderRadius: `0 0 ${radius}px ${radius}px` }}>{tools.actionBar}</div>
        </div>

        {/* 当年仕訳の一覧は置かない（確認メモ #194／#197）。登録した伝票は画面下の参照パネル（仕訳日記帳）で確認する */}
      </div>
    </main>
  );
}
