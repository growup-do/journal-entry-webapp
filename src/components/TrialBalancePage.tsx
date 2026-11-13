// 試算表（月次試算）／決算書（月次決算）（共通部品）
//   骨格は ReportShell 共通：集計期間（月）＋部の切替（右上のボタン／← → キー）→ 表示切替 → 一覧。
//   表示切替＝表示階層（大区分〜細々区分）・行の配色パターン（標準／科目項目／資金／内部／寄付補助。塗り分けの基準は確認メモ #28、色と名称は現行システムに合わせる。確認メモ #132。「標準」は色分けなし）・表示列・内訳（合算区分・親区分で起動時）。
//   月次試算の表は、見出し・合計行・地の色も現行システムの色にする（確認メモ #132。月次決算の表は従来の色のまま）。
//   表示列の切り替えは合算区分・親区分で起動したときだけ。入力区分（下層の区分）で起動中は全列を固定表示する（確認メモ #131）。
//   一覧表のヘッダー行はスクロールしても上に固定する（確認メモ #135）。
//   決算書のみ「残高グラフ」。印刷メニューは決算書を計算書の種類ごと、準決算書を区分ごとに点線で区切り、拠点区分の帳票名に区分の名称を付ける（確認メモ #139／#140）。
//   決算書の印刷は、メニューで帳票を選ぶと「帳票一括印刷」ダイアログ（年月指定＝月ボタンと開始・終了年月／出力先の指定）を開く（現行と同じ。確認メモ #141）。
//   貸借対照表の借方合計と貸方合計が一致しないときは、確認メッセージ（借方合計・貸方合計・差額）を出す（確認メモ #130。プロトタイプでは一覧見出しの切り替えで不一致の状態にして確認する）。
//   科目行から元帳へドリルダウン：画面遷移せず右側の元帳パネルに表示（押した行を見たまま内訳を確認。別の行を押すと差し替わる）。
//   パネルの「元帳の画面で開く」で全画面の元帳へ移り、その「← 戻る」で同じ月・部・階層に戻る（表示状態は sessionStorage に保持）。
//   金額書式（桁区切り・負の表記・0円行のカット）は動作環境の設定に従う。
//   資産の部のみサンプルデータあり。他の部は「サンプル未作成」。

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { FISCAL_MONTHS, lastDayOf, periodLabel as periodText, type Period } from '../lib/period';
import { CHECK, LABEL, NUM, ReportShell, Segmented, SwitchPill, TD, TH, useMoney, useViewState } from './ReportShell';
import { BS_ASSET_ROWS, displayName, type HierRow } from '../data';
import { grandTotal, rollup } from '../lib/hier';
import { metaOf } from '../lib/accounts';
import { WATCHED, codeOf } from './EntryCommon';
import { Modal } from './Modal';
import { divisionLabel, flattenDivisions, startKindOf, useSession, type Session } from '../store/session';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { SCREEN_PRINTS, ScreenPrintMenu, type PrintGroup, type PrintItem } from './ScreenPrintMenu';
import { PreviewModal, formEnabled, sampleReportData } from './PrintCenter';
import { PrintSteps, type OutKind } from './PrintSteps';
import { WAMNET_ITEMS, WamnetDialog, type WamnetItem } from './WamnetDialog';
import { runExport } from './ExportDialog';
import { ToastView, useToast } from './Toast';

const PARTS = ['資産の部', '負債の部', '事業活動', '資金の部'];
/** 表示階層（「就労授産」は不要のため廃止。確認メモ #133） */
const DEPTHS = ['大区分', '中区分', '小区分', '細区分', '細々区分'] as const;
/** 行の配色。名称は現行システムのボタンに合わせる（「寄付補助」は現行の表記。確認メモ #132） */
const PATTERNS = ['標準', '科目項目', '資金', '内部', '寄付補助'] as const;
type Depth = (typeof DEPTHS)[number];
type Pattern = (typeof PATTERNS)[number];

/** 月次試算の表の色（現行システムの色。確認メモ #132）。月次決算の表には使わない。
 *  head＝見出し／total＝合計行／base＝表の地の色（現行の色）。headSub（内訳の見出し）・headText・headLine は、現行の色に合わせて決めた色 */
const TRIAL_COLORS = { head: '#999ef1', headSub: '#b9bdf6', headText: '#22303c', headLine: '#7f85e0', total: '#cfcff8', base: '#fffff4' };

/** 配色パターンごとの塗り分け（凡例にも使う）。塗り分けの基準はクライアント回答（確認メモ #28）、色は現行システムに合わせる（確認メモ #132）。
 *  該当しない行は表の地の色のまま。「標準」は色分けなし（確認メモ #134）
 *  ・科目項目／資金／寄付補助の色は、現行の画面の色
 *  ・内部の色は、現行の画面で色のついた行を確認できていないため、現行の色の系統に合わせた仮の色
 *  ・寄付補助は、現行の画面で色がついていた「固定資産」の行にも色をつける（現行の規則は未確認） */
const PATTERN_INFO: Record<Pattern, { color: string; note: string; test: (name: string, leaf: boolean) => boolean }> = {
  標準: { color: 'transparent', note: '色分けなし（すべて地の色）', test: () => false },
  科目項目: { color: '#e1fcfd', note: '水色＝項目（子を持つ親の科目）／地の色＝科目（末端の科目）を判別', test: (_n, leaf) => !leaf },
  資金: { color: '#dfffdf', note: '薄緑＝科目マスターの「資金処理区分」が資金の科目（地の色＝非資金の科目と親の項目）', test: (n, leaf) => { const m = metaOf(n); return leaf && !!m && (m.cls === '現預金' || m.cls === '費用' || m.cls === '収益'); } },
  内部: { color: '#ffe4c8', note: '薄橙＝科目マスターの「内部取引」が通常取引以外の科目（該当の科目がなければ色はつきません）', test: (n) => /区分間|拠点間|内部/.test(n) },
  寄付補助: { color: '#a6d99b', note: '緑＝決算附属明細書設定で寄附金収益明細書・補助金事業等収益明細書の科目にチェックのある科目と「固定資産」', test: (n) => n === '固定資産' || WATCHED.filter((w) => w.key === 'kifu' || w.key === 'hojo').some((w) => w.test.test(n)) },
};

/** サンプル：配色パターン（内部／寄付補助）を確認できるよう、資産の部に該当科目の金額を補う */
const ROWS: HierRow[] = BS_ASSET_ROWS.flatMap((r) => {
  if (r.name === '未収補助金') return [{ ...r, v: [0, 0, 300000, 660000] }];
  if (r.name === '貯蔵品') return [{ name: '拠点区分間貸付金', level: 1, v: [500000, 500000, 0, 0] }, { name: '事業区分間貸付金', level: 1, v: [0, 0, 0, 0] }, r];
  return [r];
});

/** 起動区分の内訳（合算区分＝合算の構成区分／親区分＝配下の伝票入力区分） */
function membersOf(s: Session): string[] {
  const kind = startKindOf(s);
  if (kind === '合算区分') return s.merges.find((m) => m.name === s.division)?.members ?? [];
  if (kind === '親区分') {
    const hit = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node;
    return hit ? flattenDivisions(hit).map((x) => x.node).filter((n) => n.entry && n.use !== false).map(divisionLabel) : [];
  }
  return [];
}
/** サンプル値 [本部 前月繰越, 本部 残高, 保育園 前月繰越, 保育園 残高] を、合計＋内訳（区分ごと）の列に割り振る */
function toColumns(v: number[], division: string, members: string[]): number[] {
  if (members.length === 0) return division.startsWith('001') ? [v[0], v[1]] : [v[2], v[3]];
  const W: Record<string, number> = { '002': 70, '003': 20, '004': 10, '005': 5 };
  const others = members.filter((m) => !m.startsWith('001'));
  const wsum = others.reduce((a, m) => a + (W[m.slice(0, 3)] ?? 10), 0) || 1;
  let restC = v[2], restB = v[3];
  const per = members.map((m) => {
    if (m.startsWith('001')) return [v[0], v[1]];
    const last = others.indexOf(m) === others.length - 1;
    const w = (W[m.slice(0, 3)] ?? 10) / wsum;
    const c = last ? restC : Math.round((v[2] * w) / 100) * 100;
    const b = last ? restB : Math.round((v[3] * w) / 100) * 100;
    restC -= c; restB -= b;
    return [c, b];
  });
  return [per.reduce((a, p) => a + p[0], 0), per.reduce((a, p) => a + p[1], 0), ...per.flat()];
}

/* ---------------- 月次決算の印刷メニュー（確認メモ #139／#140） ---------------- */
/** 帳票名の先頭に付く「拠点区分」（ここに区分の名称を付ける） */
const BASE_HEAD = '拠点区分 ';
/** 起動区分が属する拠点区分の名称（合算区分は構成区分が属する拠点区分。法人・事業区分で起動中は配下の拠点区分すべて） */
function baseNamesOf(s: Session): string[] {
  const isBase = (n: { kind: string; use?: boolean }) => n.kind === '拠点区分' && n.use !== false;
  const all = flattenDivisions(s.tree);
  const bases = all.map((x) => x.node).filter(isBase);
  const starts = s.merges.find((m) => m.name === s.division)?.members ?? [s.division];
  const within = bases.filter((b) => flattenDivisions(b).some((x) => starts.includes(divisionLabel(x.node))));
  if (within.length) return within.map((b) => b.name);
  const start = all.find((x) => divisionLabel(x.node) === s.division)?.node;
  const below = start ? flattenDivisions(start).map((x) => x.node).filter(isBase) : [];
  return (below.length ? below : bases).map((b) => b.name);
}
/** 連続する同じキーの帳票をひとまとめにする */
function chunkBy(items: PrintItem[], key: (it: PrintItem) => string): PrintItem[][] {
  const out: PrintItem[][] = [];
  let last: string | null = null;
  items.forEach((it) => {
    const k = key(it);
    if (k === last) out[out.length - 1].push(it); else { out.push([it]); last = k; }
  });
  return out;
}
/** 月次決算の印刷メニュー：決算書は計算書の種類ごと、準決算書は区分ごとに区切る。拠点区分の帳票名には区分の名称を付ける（例：チャイルド保育園拠点区分 資金収支計算書）。
 *  決算書・準決算書の中の区切りは点線（dashedBelow）にする。決算書／準決算書／その他の間は実線のまま */
function closingPrints(s: Session): PrintGroup[] {
  const bases = baseNamesOf(s);
  const groups: PrintGroup[] = [];
  (SCREEN_PRINTS['月次決算'] ?? []).forEach((g) => {
    // 共通の印刷設定「様式設定」で省略にした様式は出さない
    const items = g.items.filter((it) => !it.form || formEnabled(s.print.forms, it.form, s.tree)).flatMap((it) => (it.name.startsWith(BASE_HEAD) && bases.length ? bases.map((b) => ({ ...it, name: `${b}${BASE_HEAD}${it.name.slice(BASE_HEAD.length)}` })) : [it]));
    const chunks = g.label === '決算書' ? chunkBy(items, (it) => it.base) : g.label === '準決算書' ? chunkBy(items, (it) => it.name.split(/(?:拠点|サービス)区分 /)[0]) : [items];
    chunks.forEach((c, i) => {
      if (i > 0) groups[groups.length - 1].dashedBelow = true;
      groups.push({ label: i === 0 ? g.label : undefined, items: c });
    });
  });
  return groups;
}
/** サンプル：貸借対照表が不一致のときの差額（確認メモ #130。プロトタイプ確認用の値） */
const BS_GAP = 12_600;

/* ---------------- 帳票一括印刷（月次決算の印刷。確認メモ #141） ----------------
 *  流れはほかの帳票と同じ「1. 詳細設定（年月指定）→ 2. 出力先 → 3. 印刷／プレビュー」（PrintSteps。確認事項「印刷の画面遷移の統一」） */
/** 年月（令和 y 年 m 月）。m は 1〜12、または「決」（決算月） */
interface YM { y: string; m: string }
interface BatchOpts { from: string; to: string; out: OutKind | 'preview' }
/** 会計年度（例：'令和8年度' → 8） */
const eraYearOf = (fiscalYear: string) => parseInt(fiscalYear.replace(/[^0-9]/g, ''), 10) || 8;
/** 月ボタン（4〜3・決）→ 年月。1〜3月と「決」は翌年 */
const ymOf = (fy: number, m: string): YM => ({ y: String(m === '決' || Number(m) <= 3 ? fy + 1 : fy), m });
/** 年月の並び順（「決」は 3月の後）。読めない入力は null */
function ymOrder(v: YM): number | null {
  const y = /^\d+$/.test(v.y) ? parseInt(v.y, 10) : NaN;
  const m = v.m === '決' ? 3.5 : /^\d+$/.test(v.m) ? parseInt(v.m, 10) : NaN;
  return y >= 1 && m >= 1 && m <= 12 ? y * 12 + m : null;
}
/** 年月の短い表記（確認表・要約用） */
const ymText = (v: YM) => `令和${v.y || '?'}年${v.m === '決' ? '決算月' : `${v.m || '?'}月`}`;
/** 期間の表記（開始は月初、終了は月末。「決」は 3月） */
function ymDay(v: YM, end: boolean): string {
  const m = v.m === '決' ? '3' : String(parseInt(v.m, 10));
  return `令和${parseInt(v.y, 10)}年${m}月${end ? lastDayOf(m) : 1}日`;
}

/** 年・月の入力欄：全角の数字は半角に直し、数字以外は入れない（月は「決」も可）。
 *  日本語入力の変換中は直さず、変換を確定したとき・欄を離れたときに直す。Enter での確定（印刷の実行）は作らない */
function YmInput({ value, onChange, month, label, name }: { value: string; onChange: (v: string) => void; month?: boolean; label: string; name: string }) {
  const norm = (t: string) => { const n = t.normalize('NFKC'); return month && n.includes('決') ? '決' : n.replace(/[^0-9]/g, '').slice(0, 2); };
  return (
    <input
      type="text" inputMode="numeric" autoComplete="off" aria-label={label} data-batch-ym={name} value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange((e.nativeEvent as InputEvent).isComposing ? e.target.value : norm(e.target.value))}
      onCompositionEnd={(e) => onChange(norm(e.currentTarget.value))}
      onBlur={(e) => onChange(norm(e.target.value))}
      style={{ width: 46, boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', textAlign: 'center', fontVariantNumeric: 'tabular-nums', outline: 'none', background: '#fff', color: '#22303c' }}
    />
  );
}

/** 帳票一括印刷の中身。開くたびに作り直すので、月の初期値は開いたときに画面で選んでいる月（範囲）になる */
function BatchPrintForm({ item, fy, init, accent, onCancel, onRun }: { item: PrintItem; fy: number; /** 画面で選んでいる月（開始・終了） */ init: [string, string]; accent: string; onCancel: () => void; onRun: (opts: BatchOpts) => void }) {
  const [from, setFrom] = useState<YM>(() => ymOf(fy, init[0]));
  const [to, setTo] = useState<YM>(() => ymOf(fy, init[1]));
  /** 月ボタンを次に押したときに決まるほう（1回目＝開始、2回目＝終了） */
  const [next, setNext] = useState<'開始' | '終了'>('開始');
  const [dest, setDest] = useState<OutKind>('print');
  const fo = ymOrder(from), too = ymOrder(to);
  const err = fo == null || too == null ? `${fo == null ? '開始年月' : '終了年月'}を正しく入力してください（年は数字、月は 1〜12 または「決」）` : fo > too ? '終了年月は、開始年月と同じか後の年月にしてください' : '';
  const pick = (m: string) => {
    const v = ymOf(fy, m);
    // 1回目：開始（終了も同じ月にして単月の指定にする）
    if (next === '開始') { setFrom(v); setTo(v); setNext('終了'); return; }
    // 2回目：終了。開始より前の月を押したときは、開始と終了を入れ替える
    if (fo != null && (ymOrder(v) ?? 0) < fo) { setTo(from); setFrom(v); } else setTo(v);
    setNext('開始');
  };
  const run = (out: OutKind | 'preview') => { if (!err) onRun({ from: ymDay(from, false), to: ymDay(to, true), out }); };
  const head: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#48565f' };
  const ymRow = (label: string, key: 'from' | 'to', v: YM, set: (x: YM) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
      <span style={{ width: 76, fontWeight: 700, color: '#48565f' }}>{label}</span>
      <span>令和</span>
      <YmInput value={v.y} onChange={(y) => { set({ ...v, y }); }} label={`${label}の年`} name={`${key}-y`} />
      <span>年</span>
      <YmInput value={v.m} onChange={(m) => { set({ ...v, m }); }} month label={`${label}の月`} name={`${key}-m`} />
      <span>月</span>
    </div>
  );
  return (
    <div data-batch-print>
      <PrintSteps
        accent={accent}
        detailSummary={err ? '年月を確かめてください' : `${ymText(from)}〜${ymText(to)}`}
        dest={dest}
        onDest={setDest}
        confirm={[['帳票', item.name], ['年月', `${ymText(from)} 〜 ${ymText(to)}`]]}
        blocked={err || undefined}
        onPreview={() => run('preview')}
        onRun={() => run(dest)}
        onClose={onCancel}
        detail={<div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f6f8fa', border: '1px solid #e2e8ee', fontSize: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', flex: 'none' }}>印刷する帳票</span>
        <span data-batch-report style={{ fontWeight: 700 }}>{item.name}</span>
        {item.note && <span style={{ fontSize: 12, color: '#9aa5b1', flex: 'none' }}>{item.note}</span>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={head}>年月指定</div>
        <div role="group" aria-label="年月指定" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FISCAL_MONTHS.map((m) => {
            const o = ymOrder(ymOf(fy, m));
            const on = fo != null && too != null && o != null && o >= fo && o <= too;
            return (
              <button key={m} type="button" data-batch-month={m} aria-pressed={on} onClick={() => pick(m)} title={m === '決' ? '決算月' : `${m}月`} style={{ width: 34, height: 32, padding: 0, borderRadius: 6, border: `1px solid ${on ? accent : '#cfd8e0'}`, background: on ? accent : '#fff', color: on ? '#fff' : accent, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{m}</button>
            );
          })}
        </div>
        {ymRow('開始年月', 'from', from, setFrom)}
        {ymRow('終了年月', 'to', to, setTo)}
        <div data-batch-next={next} style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>月のボタンは、1回目に押した月が開始年月、2回目に押した月が終了年月になります（次に押す月：<b style={{ color: accent }}>{next}年月</b>）。入力欄でも直せます。</div>
      </div>
      {err && <div data-batch-error role="alert" style={{ fontSize: 14, fontWeight: 700, color: '#c0392b' }}>{err}</div>}
        </div>}
      />
    </div>
  );
}

/** 帳票一括印刷ダイアログ。item＝印刷メニューで選んだ帳票（null のとき非表示）。Esc・背景クリックでは閉じない（×・キャンセル・印刷で閉じる） */
function BatchPrintDialog({ item, onClose, accent, fy, init }: { item: PrintItem | null; onClose: () => void; accent: string; fy: number; init: [string, string] }) {
  const toast = useToast();
  const [preview, setPreview] = useState<{ title: string; opts: BatchOpts } | null>(null);
  const run = (opts: BatchOpts) => {
    if (!item) return;
    // プレビュー：ダイアログは開いたまま、手前にプレビューを重ねる（ほかの画面の印刷と同じ）
    if (opts.out === 'preview') { setPreview({ title: item.name, opts }); return; }
    // プリンター／PDF／Excel／CSV：出力して閉じる（帳票の中身はサンプル表）
    toast.show(runExport({ kind: opts.out, title: item.name, meta: `（自）${opts.from}　（至）${opts.to}`, ...sampleReportData(item.name) }));
    onClose();
  };
  return (
    <>
      <ToastView msg={toast.msg} />
      <Modal open={!!item} onClose={onClose} width={720} title="帳票一括印刷">
        {item && <BatchPrintForm item={item} fy={fy} init={init} accent={accent} onCancel={onClose} onRun={run} />}
      </Modal>
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview ? { from: preview.opts.from, to: preview.opts.to, output: '画面へプレビューする' } : undefined} accent={accent} data={preview ? sampleReportData(preview.title) : undefined} />
    </>
  );
}

interface Props {
  mode: 'trial' | 'closing';
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

interface View {
  month: string;
  part: number;
  depth: Depth;
  pattern: Pattern;
  carry: boolean; debit: boolean; credit: boolean; balance: boolean;
  prev: boolean; diff: boolean;
  breakdown: boolean;
}

export function TrialBalancePage({ mode, variant, accent, onNavigate }: Props) {
  const isClosing = mode === 'closing';
  const KEY = isClosing ? '月次決算' : '月次試算';
  const s = useSession();
  const money = useMoney();
  const [view, setView] = useViewState<View>(KEY, { month: '8', part: 0, depth: '細々区分', pattern: '標準', carry: true, debit: false, credit: false, balance: true, prev: true, diff: true, breakdown: true });
  const [graph, setGraph] = useState(false);
  // 貸借対照表の不一致（確認メモ #130）：unbalanced＝不一致の状態（プロトタイプ確認用の切り替え）、warn＝確認メッセージを表示中
  const [unbalanced, setUnbalanced] = useState(false);
  const [warn, setWarn] = useState(false);
  /** 集計し直したとき（月・期間の切り替え）に、不一致なら確認メッセージを出す */
  const recheck = () => { if (unbalanced) setWarn(true); };
  // 指定科目：科目名の一部、または科目コード（前方一致）で一覧の行を強調（共通構成の②。確認メモ #160）
  const [q, setQ] = useState('');
  const hit = (name: string) => { const k = q.trim(); return !!k && (name.includes(k) || (/^\d+$/.test(k) && codeOf('account', name).startsWith(k))); };
  const members = membersOf(s);
  const showBreakdown = members.length > 0 && view.breakdown;
  // 表示列の切り替えは合算区分・親区分で起動したときだけ。入力区分（内訳のない下層の区分）で起動中は全列を固定表示（確認メモ #131）
  const colsLocked = members.length === 0;
  const show = colsLocked ? { carry: true, debit: true, credit: true, balance: true, prev: true, diff: true } : view;
  const lockedNote = `入力区分（${s.division}）で起動中は、表示する列を切り替えできません（すべての列を表示します）。合算区分または親区分（法人・事業区分・拠点区分）で起動すると切り替えできます`;
  const width = 2 + members.length * 2;
  const src: HierRow[] = ROWS.map((r) => (r.v ? { ...r, v: toColumns(r.v, s.division, members) } : r));
  const all = rollup(src, width).map((r, i) => ({ ...r, leaf: !!src[i].v }));
  // 以前の表示状態に、廃止した階層（就労授産）が残っているときは細々区分として扱う
  const depth: Depth = DEPTHS.includes(view.depth) ? view.depth : '細々区分';
  const depthIndex = DEPTHS.indexOf(depth);
  const zeroCut = s.env.zeroCut;
  const rows = all.filter((r) => r.level <= depthIndex && (!zeroCut || r.values.some((x) => x !== 0)));
  const hiddenZero = all.filter((r) => r.level <= depthIndex).length - rows.length;
  const total = grandTotal(all, width);
  // 以前の表示状態に旧名称（寄附補助）が残っているときは、現行の名称（寄付補助）として扱う
  const pattern: Pattern = PATTERNS.includes(view.pattern) ? view.pattern : (view.pattern as string) === '寄附補助' ? '寄付補助' : '標準';
  const info = PATTERN_INFO[pattern];
  // 月次試算の表だけ、見出し・合計行・地の色を現行システムの色にする（確認メモ #132）。月次決算の表は従来の色のまま
  const tc = isClosing ? null : TRIAL_COLORS;
  const th: CSSProperties = tc ? { ...TH, background: tc.head, color: tc.headText, borderBottom: `1px solid ${tc.headLine}` } : TH;
  const thSubBg = tc ? tc.headSub : '#f0f5fa';
  const thDivider = `1px solid ${tc ? tc.headLine : '#e6ecf1'}`;

  // 列の定義：合計（起動区分）→ 内訳（区分ごと）→ 内部取引消去（決算書のみ）
  type Col = { head: string; get: (v: number[]) => number; first?: boolean; muted?: boolean };
  const subCols = (ci: number, bi: number): Col[] => (isClosing
    ? [{ head: '当年度末(決算)', get: (v: number[]) => v[bi], first: true }, ...(show.prev ? [{ head: '前年度末', get: (v: number[]) => v[ci] }] : []), ...(show.diff ? [{ head: '増減', get: (v: number[]) => v[bi] - v[ci] }] : [])]
    : [...(show.carry ? [{ head: '前月繰越', get: (v: number[]) => v[ci] }] : []), ...(show.debit ? [{ head: '借方', get: (v: number[]) => Math.max(0, v[bi] - v[ci]) }] : []), ...(show.credit ? [{ head: '貸方', get: (v: number[]) => Math.max(0, v[ci] - v[bi]) }] : []), ...(show.balance ? [{ head: '残高', get: (v: number[]) => v[bi] }] : [])]
  ).map((c, i) => ({ ...c, first: i === 0 }));
  const groups: { label: ReactNode; cols: Col[]; breakdown?: boolean }[] = [
    { label: showBreakdown ? <>合計<span style={{ fontWeight: 500, marginLeft: 6 }}>{s.division}</span></> : s.division, cols: subCols(0, 1) },
    ...(showBreakdown ? members.map((m, i) => ({ label: m, breakdown: true, cols: isClosing ? [{ head: '当年度末(決算)', get: (v: number[]) => v[3 + i * 2], first: true }] : subCols(2 + i * 2, 3 + i * 2) })) : []),
    ...(showBreakdown && isClosing ? [{ label: '内部取引消去', breakdown: true, cols: [{ head: '当年度末(決算)', get: () => 0, first: true, muted: true }] }] : []),
  ];
  const flat = groups.flatMap((g) => g.cols.map((c) => ({ ...c, breakdown: g.breakdown })));

  // 元帳へのドリルダウン：右側の元帳パネルに出す（全画面の元帳はパネルの「元帳の画面で開く」から）
  /** 集計期間の範囲（月の範囲・日付の範囲。確認メモ #57／#58）。サンプルの金額は月末残高のため、範囲は期間の表示に使う */
  const [range, setRange] = useState<Period | null>(null);
  const drawer = useLedgerDrawer(KEY);
  const openLedger = (name: string) => drawer.open({ account: name, month: view.month, kind: 'account', from: KEY });
  const picked = (name: string) => !drawer.collapsed && drawer.target?.account === name;
  // 行の配色：「標準」は色分けなし（すべて地の色。確認メモ #134）。ほかのパターンは該当する行だけ色を付ける（該当しない行は地の色）
  const toned = (r: { name: string; leaf: boolean }) => info.test(r.name, r.leaf);
  const rowBg = (r: { name: string; leaf: boolean }) => (toned(r) ? info.color : 'transparent');
  const linkBtn: CSSProperties = { marginLeft: 10, padding: '1px 8px', borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
  /** 表示する列のチェック（切り替えできないときは薄く表示） */
  const colCheck: CSSProperties = colsLocked ? { ...CHECK, cursor: 'not-allowed', opacity: 0.6 } : CHECK;
  // 一覧表のヘッダー行：スクロールしても上に固定する（確認メモ #135）。固定中は下の罫線が消えるので、影で線を補う
  const headLine = `inset 0 -1px 0 ${tc ? tc.headLine : '#e2e8ee'}`;
  // 月次決算の印刷メニュー（決算書・準決算書の区切りと、拠点区分の帳票名。確認メモ #139／#140）
  const prints = isClosing ? closingPrints(s) : null;
  // 月次決算の印刷：メニューで帳票を選ぶと「帳票一括印刷」ダイアログを開く（確認メモ #141）。batch＝選んだ帳票
  const [batch, setBatch] = useState<PrintItem | null>(null);
  // 帳票を選ぶと「帳票一括印刷」を開く。WAMNET連携出力は印刷ではないので、WAMNET連携のダイアログへ回す
  const [wamnet, setWamnet] = useState<WamnetItem | null>(null);
  const printActions = prints && [
    ...prints.map((g) => ({ label: g.label, dashedBelow: g.dashedBelow, items: g.items.map((it) => ({ name: it.name, note: it.note, onClick: () => (it.base === 'WAMNET' ? setWamnet(WAMNET_ITEMS.find((w) => w.name === it.name) ?? null) : setBatch(it)) })) })),
    // 現行の印刷メニューの「様式設定」：使う様式（省略する様式）は共通の印刷設定で選ぶ
    { label: '設定', items: [{ name: '様式設定', note: '共通の印刷設定', onClick: () => onNavigate('共通の印刷設定') }] },
  ];
  /** 帳票一括印刷の月の初期値：画面で選んでいる月（範囲を選んでいるときは、その開始月〜終了月） */
  const batchInit: [string, string] = range ? [range.from.split('/')[0], range.to.split('/')[0]] : [view.month, view.month];
  // 貸借対照表の借方合計・貸方合計（サンプル。不一致の状態では貸方合計を差額の分だけずらす）
  const debitTotal = total[1];
  const creditTotal = debitTotal - (unbalanced ? BS_GAP : 0);

  return (
    <>
    <ReportShell
      variant={variant}
      accent={accent}
      asideWidth={drawer.asideWidth}
      extraTools={printActions ? <ScreenPrintMenu page={KEY} actions={printActions} accent={accent} /> : <ScreenPrintMenu page={KEY} accent={accent} />}
      title={displayName(KEY)}
      subtitle={<>{isClosing ? '当年度末（決算）の残高を一覧します。' : '前月繰越・当月の借方／貸方・残高を一覧します。'}科目の行の「元帳」ボタン（または行のダブルクリック）で、右側に総勘定元帳を表示します。別の行を押すと差し替わり、全画面で見たいときはパネルの「元帳の画面で開く」を使います。</>}
      tools={isClosing ? [
        { label: '残高グラフ', onClick: () => setGraph(true) },
        { label: '充実残額', onClick: () => onNavigate('充実残額') },
        { label: '繰越判断', onClick: () => onNavigate('繰越判断'), title: '委託費の繰越・積立の判断（繰越判断の基準）を開きます（旧 F10 繰越）' },
      ] : []}
      period={
        <>
          <FiscalMonthTabs current={view.month} accent={accent} onSelect={(m) => { setView({ month: m ?? '8' }); recheck(); }} range={range} onRange={(p) => { setRange(p); recheck(); }} />
          <span style={{ fontSize: 14, color: '#48565f' }}>{range ? periodText(range) : `令和8年 ${view.month}月`}</span>
        </>
      }
      parts={{ items: PARTS, current: view.part, onChange: (i) => setView({ part: i }) }}
      targetLabel="科目検索"
      target={
        <>
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名の一部、または科目コードを入力すると一覧で強調します" autoComplete="off" style={{ width: 300, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          {q.trim() && <span style={{ fontSize: 14, color: rows.some((r) => hit(r.name)) ? accent : '#c0392b', fontWeight: 700 }}>{rows.filter((r) => hit(r.name)).length ? `${rows.filter((r) => hit(r.name)).length} 件の科目を強調表示中` : '該当する科目がありません'}</span>}
          {q && <button type="button" onClick={() => setQ('')} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>解除</button>}
          <span style={{ fontSize: 12, color: '#9aa5b1' }}>科目の行の「元帳」で、右側に元帳を表示します</span>
        </>
      }
      listNote={
        <>
          <span>{rows.length} 行{hiddenZero > 0 ? `（0データの ${hiddenZero} 行を非表示）` : ''}</span>
          {/* 貸借対照表が不一致のときの確認メッセージを確かめるための切り替え（製品の機能ではない。確認メモ #130） */}
          <span data-proto-unbalanced style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9aa5b1', whiteSpace: 'nowrap' }}>
            <span>プロトタイプ確認用：</span>
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} title="チェックを入れると、貸借対照表の借方合計と貸方合計が一致しない状態になり、確認メッセージを表示します。入れたままにすると、集計期間（月）を切り替えるたびに表示します">
              <input type="checkbox" checked={unbalanced} onChange={(e) => { setUnbalanced(e.target.checked); setWarn(e.target.checked); }} />貸借対照表が不一致の場合の表示
            </label>
          </span>
        </>
      }
      switches={
        <>
          <Segmented label="表示階層" items={DEPTHS} value={depth} onChange={(d) => setView({ depth: d })} accent={accent} />
          <Segmented label="行の配色" items={PATTERNS} value={pattern} onChange={(p) => setView({ pattern: p })} accent={accent} />
          <SwitchPill label="内訳（区分ごと）" on={members.length > 0 && view.breakdown} onChange={(v) => setView({ breakdown: v })} accent={accent} disabled={members.length === 0} title={members.length === 0 ? `入力区分（${s.division}）で起動中は内訳がないため切り替えできません。合算区分または親区分（法人・事業区分・拠点区分）で起動すると、区分ごとの金額を表示できます` : '区分ごとの金額の列を表示します'} />
        </>
      }
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={LABEL}>表示する列</span>
          {isClosing ? (
            <>
              <label style={{ ...CHECK, cursor: 'default' }}><input type="checkbox" checked readOnly />当年度末(決算)</label>
              <label style={colCheck} title={colsLocked ? lockedNote : undefined}><input type="checkbox" checked={show.prev} disabled={colsLocked} onChange={() => setView({ prev: !view.prev })} />前年度末</label>
              <label style={colCheck} title={colsLocked ? lockedNote : undefined}><input type="checkbox" checked={show.diff} disabled={colsLocked} onChange={() => setView({ diff: !view.diff })} />増減</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />予算</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />差異</label>
            </>
          ) : (
            <>
              <label style={colCheck} title={colsLocked ? lockedNote : undefined}><input type="checkbox" checked={show.carry} disabled={colsLocked} onChange={() => setView({ carry: !view.carry })} />前月繰越</label>
              <label style={colCheck} title={colsLocked ? lockedNote : undefined}><input type="checkbox" checked={show.debit} disabled={colsLocked} onChange={() => setView({ debit: !view.debit })} />借方</label>
              <label style={colCheck} title={colsLocked ? lockedNote : undefined}><input type="checkbox" checked={show.credit} disabled={colsLocked} onChange={() => setView({ credit: !view.credit })} />貸方</label>
              <label style={colCheck} title={colsLocked ? lockedNote : undefined}><input type="checkbox" checked={show.balance} disabled={colsLocked} onChange={() => setView({ balance: !view.balance })} />残高</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />前月累計</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />当月</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />累計</label>
            </>
          )}
          {colsLocked && <span data-cols-locked style={{ fontSize: 12, color: '#9aa5b1' }}>入力区分で起動中は切り替えできません（全列を表示）</span>}
          <span data-pattern-legend style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a8794' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: pattern === '標準' ? tc?.base ?? '#fff' : info.color, border: '1px solid #c3ccd4' }} />
            配色「{pattern}」：{info.note}
          </span>
        </div>
      }
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        {view.part !== 0 ? (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>「{PARTS[view.part]}」のサンプルデータは未作成です（資産の部で表の構成をご確認ください）。</div>
        ) : flat.length === 0 ? (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>表示する列を1つ以上選んでください。</div>
        ) : (
          <table data-table-tone={tc ? '現行' : undefined} style={{ width: '100%', borderCollapse: 'collapse', background: tc?.base }}>
            <thead data-sticky-head style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...th, minWidth: 260, boxShadow: headLine }} rowSpan={2}>科目名</th>
                {groups.map((g, i) => (
                  <th key={i} style={{ ...th, textAlign: 'center', borderLeft: thDivider, background: g.breakdown ? thSubBg : th.background }} colSpan={g.cols.length}>
                    {g.breakdown && <span style={{ marginRight: 6, padding: '0 5px', borderRadius: 4, background: '#fff', border: '1px solid #d3dbe3', fontSize: 12 }}>内訳</span>}
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                {flat.map((c, i) => <th key={i} style={{ ...th, textAlign: 'right', fontWeight: 500, borderLeft: c.first ? thDivider : undefined, background: c.breakdown ? thSubBg : th.background, boxShadow: headLine }}>{c.head}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bold = r.level === 0;
                return (
                  <tr key={r.name + ':' + r.level + ':' + i} data-account={r.name} onDoubleClick={() => { if (r.leaf) openLedger(r.name); }} title={r.leaf ? 'ダブルクリックで元帳を開く' : undefined} data-picked={picked(r.name) || undefined} data-pattern-hit={toned(r) || undefined} style={{ background: picked(r.name) ? '#eaf5ef' : hit(r.name) ? '#fff8d6' : rowBg(r), boxShadow: picked(r.name) ? `inset 3px 0 0 ${accent}` : undefined, cursor: r.leaf ? 'pointer' : 'default' }}>
                    <td style={{ ...TD, paddingLeft: 12 + r.level * 18, fontWeight: bold || picked(r.name) ? 700 : r.level === 1 ? 600 : 400, whiteSpace: 'nowrap' }}>
                      {r.name}
                      {r.leaf && <button type="button" className="btn-outline" data-action="元帳" onClick={(e) => { e.stopPropagation(); openLedger(r.name); }} style={linkBtn}>元帳 ›</button>}
                    </td>
                    {flat.map((c, k) => <td key={k} style={{ ...NUM, fontWeight: bold ? 700 : 400, borderLeft: c.first ? '1px solid #f1f4f6' : undefined, color: c.muted ? '#9aa5b1' : undefined }}>{money(c.get(r.values))}</td>)}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr data-total-row style={{ background: tc ? tc.total : '#e9eef3' }}>
                <td style={{ ...TD, fontWeight: 700 }}>合計</td>
                {flat.map((c, k) => <td key={k} style={{ ...NUM, fontWeight: 700, borderLeft: c.first ? '1px solid #dde4ea' : undefined }}>{money(c.get(total))}</td>)}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div data-format-note style={{ padding: '8px 22px', borderTop: '1px solid #eef2f5', fontSize: 12, color: '#9aa5b1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span>金額の書式は「動作環境」の設定に従います（桁区切り：{s.env.thousandsSep}／負の表記：{s.env.negativeSign}・{s.env.negativeColor}字／0データの判定：{zeroCut ? `相殺結果が0円の項目を0データとみなして表示しない${hiddenZero > 0 ? `（${hiddenZero} 行を省略中）` : ''}` : '0データとみなさず表示する'}）</span>
      </div>

      <Modal open={graph} onClose={() => setGraph(false)} width={640} title={`${displayName(KEY)} - 残高グラフ`}>
        <div style={{ padding: '12px 22px 18px' }}>
          {(() => { const items = rows.filter((r) => r.level <= 1 && r.values[1] > 0).slice(0, 8); const max = Math.max(1, ...items.map((r) => r.values[1])); return (
            <div style={{ display: 'grid', gap: 8 }}>{items.map((r) => { const v = r.values[1]; return <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 120px', gap: 10, alignItems: 'center', fontSize: 14 }}><span style={{ fontWeight: r.level === 0 ? 700 : 500 }}>{r.name}</span><div style={{ height: 14, background: '#eef2f5', borderRadius: 7, overflow: 'hidden' }}><div style={{ width: `${(v / max) * 100}%`, height: '100%', background: accent }} /></div><span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(v)}</span></div>; })}</div>
          ); })()}
          <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 10 }}>{PARTS[view.part]}・当年度末残高（{s.division}）。値はサンプルです。</div>
        </div>
      </Modal>

      {/* 確認メッセージ：貸借対照表が不一致（確認メモ #130）。閉じるのは OK ボタンだけ */}
      <Modal open={warn} onClose={() => setWarn(false)} width={460} title="確認" closable={false}>
        <div data-bs-unbalanced style={{ padding: '16px 22px 18px', display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>貸借対照表 決算額の借方合計と貸方合計が一致しておりません。</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', padding: '10px 14px', borderRadius: 8, background: '#f6f8fa', border: '1px solid #e2e8ee', fontSize: 14 }}>
            <span style={{ color: '#5b6773' }}>借方合計</span><span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(debitTotal)}</span>
            <span style={{ color: '#5b6773' }}>貸方合計</span><span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(creditTotal)}</span>
            <span style={{ fontWeight: 700, paddingTop: 6, borderTop: '1px solid #e2e8ee' }}>差額</span><span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, paddingTop: 6, borderTop: '1px solid #e2e8ee' }}>{money(debitTotal - creditTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}><button type="button" data-action="OK" autoFocus onClick={() => setWarn(false)} style={{ minWidth: 110, padding: '8px 22px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>OK</button></div>
        </div>
      </Modal>

      {/* 帳票一括印刷（月次決算の印刷メニューで帳票を選ぶと開く。確認メモ #141）。閉じるのは ×・キャンセル・印刷だけ */}
      {isClosing && <BatchPrintDialog item={batch} onClose={() => setBatch(null)} accent={accent} fy={eraYearOf(s.fiscalYear)} init={batchInit} />}
      {/* WAMNET連携出力（月次決算の印刷メニューから開く）。閉じるのは ×・キャンセルなどのボタンだけ */}
      {isClosing && <WamnetDialog item={wamnet} onClose={() => setWamnet(null)} accent={accent} />}
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} />
    </>
  );
}
