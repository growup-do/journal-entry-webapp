// 試算表（月次試算）／決算書（月次決算）（共通部品）
//   骨格は ReportShell 共通：集計期間（月）＋部の切替（右上のボタン／← → キー）→ 表示切替 → 一覧。
//   表示切替＝表示階層（大区分〜細々区分）・行の配色パターン（5種。確認メモ #28 の定義。「標準」は色分けなし＝すべて白）・表示列・内訳（合算区分・親区分で起動時）。
//   表示列の切り替えは合算区分・親区分で起動したときだけ。入力区分（下層の区分）で起動中は全列を固定表示する（確認メモ #131）。
//   一覧表のヘッダー行はスクロールしても上に固定する（確認メモ #135）。
//   決算書のみ「残高グラフ」。印刷メニューは決算書を計算書の種類ごと、準決算書を区分ごとに点線で区切り、拠点区分の帳票名に区分の名称を付ける（確認メモ #139／#140）。
//   貸借対照表の借方合計と貸方合計が一致しないときは、確認メッセージ（借方合計・貸方合計・差額）を出す（確認メモ #130。プロトタイプでは一覧見出しの切り替えで不一致の状態にして確認する）。
//   科目行から元帳へドリルダウン：画面遷移せず右側の元帳パネルに表示（押した行を見たまま内訳を確認。別の行を押すと差し替わる）。
//   パネルの「元帳の画面で開く」で全画面の元帳へ移り、その「← 戻る」で同じ月・部・階層に戻る（表示状態は sessionStorage に保持）。
//   金額書式（桁区切り・負の表記・0円行のカット）は動作環境の設定に従う。
//   資産の部のみサンプルデータあり。他の部は「サンプル未作成」。

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { periodLabel as periodText, type Period } from '../lib/period';
import { CHECK, LABEL, NUM, ReportShell, Segmented, SwitchPill, TD, TH, useMoney, useViewState } from './ReportShell';
import { BS_ASSET_ROWS, displayName, type HierRow } from '../data';
import { grandTotal, rollup } from '../lib/hier';
import { metaOf } from '../lib/accounts';
import { WATCHED, codeOf } from './EntryCommon';
import { Modal } from './Modal';
import { divisionLabel, flattenDivisions, startKindOf, useSession, type Session } from '../store/session';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { SCREEN_PRINTS, ScreenPrintMenu, type PrintGroup, type PrintItem } from './ScreenPrintMenu';

const PARTS = ['資産の部', '負債の部', '事業活動', '資金の部'];
/** 表示階層（「就労授産」は不要のため廃止。確認メモ #133） */
const DEPTHS = ['大区分', '中区分', '小区分', '細区分', '細々区分'] as const;
const PATTERNS = ['標準', '科目項目', '資金', '内部', '寄附補助'] as const;
type Depth = (typeof DEPTHS)[number];
type Pattern = (typeof PATTERNS)[number];

/** 配色パターンごとの塗り分け（凡例にも使う）。塗り分けの基準はクライアント回答（確認メモ #28）に合わせる。「標準」は色分けなし（確認メモ #134） */
const PATTERN_INFO: Record<Pattern, { color: string; note: string; test: (name: string, leaf: boolean) => boolean }> = {
  標準: { color: '#fff', note: '色分けなし（すべて白）', test: () => false },
  科目項目: { color: '#fff1b8', note: '黄＝項目（親）／白＝科目（子）を判別', test: (_n, leaf) => !leaf },
  資金: { color: '#d8f0f5', note: '水色＝科目マスターの「資金処理区分」が資金の科目（白＝非資金）', test: (n, leaf) => { const m = metaOf(n); return leaf && !!m && (m.cls === '現預金' || m.cls === '費用' || m.cls === '収益'); } },
  内部: { color: '#fbe3c4', note: '橙＝科目マスターの「内部取引」が通常取引以外の科目', test: (n) => /区分間|拠点間|内部/.test(n) },
  寄附補助: { color: '#e9defa', note: '紫＝決算附属明細書設定で寄附金収益明細書・補助金事業等収益明細書の科目にチェックのある科目', test: (n) => WATCHED.filter((w) => w.key === 'kifu' || w.key === 'hojo').some((w) => w.test.test(n)) },
};

/** サンプル：配色パターン（内部／寄附補助）を確認できるよう、資産の部に該当科目の金額を補う */
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
    const items = g.items.flatMap((it) => (it.name.startsWith(BASE_HEAD) && bases.length ? bases.map((b) => ({ ...it, name: `${b}${BASE_HEAD}${it.name.slice(BASE_HEAD.length)}` })) : [it]));
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
  const info = PATTERN_INFO[view.pattern];

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
  // 行の配色：「標準」は色分けなし（すべて白。確認メモ #134）。ほかのパターンは該当する行だけ色を付ける
  const rowBg = (r: { name: string; level: number; leaf: boolean }) => (info.test(r.name, r.leaf) ? info.color : 'transparent');
  const linkBtn: CSSProperties = { marginLeft: 10, padding: '1px 8px', borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
  /** 表示する列のチェック（切り替えできないときは薄く表示） */
  const colCheck: CSSProperties = colsLocked ? { ...CHECK, cursor: 'not-allowed', opacity: 0.6 } : CHECK;
  // 一覧表のヘッダー行：スクロールしても上に固定する（確認メモ #135）。固定中は下の罫線が消えるので、影で線を補う
  const headLine = 'inset 0 -1px 0 #e2e8ee';
  // 月次決算の印刷メニュー（決算書・準決算書の区切りと、拠点区分の帳票名。確認メモ #139／#140）
  const prints = isClosing ? closingPrints(s) : null;
  // 貸借対照表の借方合計・貸方合計（サンプル。不一致の状態では貸方合計を差額の分だけずらす）
  const debitTotal = total[1];
  const creditTotal = debitTotal - (unbalanced ? BS_GAP : 0);

  return (
    <>
    <ReportShell
      variant={variant}
      accent={accent}
      asideWidth={drawer.asideWidth}
      extraTools={prints ? (
        <>
          <ScreenPrintMenu page={KEY} groups={prints} accent={accent} />
        </>
      ) : <ScreenPrintMenu page={KEY} accent={accent} />}
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
          <Segmented label="行の配色" items={PATTERNS} value={view.pattern} onChange={(p) => setView({ pattern: p })} accent={accent} />
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
            <span style={{ width: 14, height: 14, borderRadius: 3, background: info.color, border: '1px solid #c3ccd4' }} />
            配色「{view.pattern}」：{info.note}
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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead data-sticky-head style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...TH, minWidth: 260, boxShadow: headLine }} rowSpan={2}>科目名</th>
                {groups.map((g, i) => (
                  <th key={i} style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1', background: g.breakdown ? '#f0f5fa' : TH.background }} colSpan={g.cols.length}>
                    {g.breakdown && <span style={{ marginRight: 6, padding: '0 5px', borderRadius: 4, background: '#fff', border: '1px solid #d3dbe3', fontSize: 12 }}>内訳</span>}
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                {flat.map((c, i) => <th key={i} style={{ ...TH, textAlign: 'right', fontWeight: 500, borderLeft: c.first ? '1px solid #e6ecf1' : undefined, background: c.breakdown ? '#f0f5fa' : TH.background, boxShadow: headLine }}>{c.head}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bold = r.level === 0;
                return (
                  <tr key={r.name + ':' + r.level + ':' + i} data-account={r.name} onDoubleClick={() => { if (r.leaf) openLedger(r.name); }} title={r.leaf ? 'ダブルクリックで元帳を開く' : undefined} data-picked={picked(r.name) || undefined} style={{ background: picked(r.name) ? '#eaf5ef' : hit(r.name) ? '#fff8d6' : rowBg(r), boxShadow: picked(r.name) ? `inset 3px 0 0 ${accent}` : undefined, cursor: r.leaf ? 'pointer' : 'default' }}>
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
              <tr style={{ background: '#e9eef3' }}>
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
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} />
    </>
  );
}
