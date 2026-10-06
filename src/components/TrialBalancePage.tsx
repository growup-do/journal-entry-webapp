// 試算表（月次試算）／決算書（月次決算）（共通部品）
//   骨格は ReportShell 共通：集計期間（月）＋部の切替（右上のボタン／← → キー）→ 表示切替 → 一覧。
//   表示切替＝表示階層（大区分〜細々区分）・行の配色パターン（5種）・表示列・内訳（合算区分・親区分で起動時）。
//   決算書のみ「残高グラフ」「収支分析」（収支分析は合算区分では使えない）。
//   科目行から元帳へドリルダウン：画面遷移せず右側の元帳パネルに表示（押した行を見たまま内訳を確認。別の行を押すと差し替わる）。
//   パネルの「元帳の画面で開く」で全画面の元帳へ移り、その「← 戻る」で同じ月・部・階層に戻る（表示状態は sessionStorage に保持）。
//   金額書式（桁区切り・負の表記・0円行のカット）は動作環境の設定に従う。
//   資産の部のみサンプルデータあり。他の部は「サンプル未作成」。

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { CHECK, LABEL, NUM, ReportShell, Segmented, SwitchPill, TD, TH, pct, useMoney, useViewState } from './ReportShell';
import { BS_ASSET_ROWS, displayName, type HierRow } from '../data';
import { grandTotal, rollup } from '../lib/hier';
import { Modal } from './Modal';
import { divisionLabel, flattenDivisions, startKindOf, useSession, type Session } from '../store/session';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { ScreenPrintMenu } from './ScreenPrintMenu';

const PARTS = ['資産の部', '負債の部', '事業活動', '資金の部'];
const DEPTHS = ['大区分', '中区分', '小区分', '細区分', '細々区分'] as const;
const PATTERNS = ['標準', '科目項目', '資金', '内部', '寄附補助'] as const;
type Depth = (typeof DEPTHS)[number];
type Pattern = (typeof PATTERNS)[number];

/** 配色パターンごとの塗り分け（凡例にも使う） */
const PATTERN_INFO: Record<Pattern, { color: string; note: string; test: (name: string, leaf: boolean) => boolean }> = {
  標準: { color: '#f3f6f9', note: '大区分の行を薄く塗り、1行おきに縞模様', test: () => false },
  科目項目: { color: '#fff1b8', note: '黄＝項目（集計行）／白＝科目', test: (_n, leaf) => !leaf },
  資金: { color: '#d8f0f5', note: '水色＝支払資金に関わる科目', test: (n, leaf) => leaf && /現金|預金|未収|貯蔵|立替|前払|仮払|未払|預り/.test(n) },
  内部: { color: '#fbe3c4', note: '橙＝内部取引の科目（区分間の貸付・繰入など）', test: (n) => /区分間|拠点間|内部/.test(n) },
  寄附補助: { color: '#e9defa', note: '紫＝寄附金・補助金に関わる科目', test: (n) => /補助|寄附/.test(n) },
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
  const [analysis, setAnalysis] = useState(false);
  const kind = startKindOf(s);
  const members = membersOf(s);
  const showBreakdown = members.length > 0 && view.breakdown;
  const width = 2 + members.length * 2;
  const src: HierRow[] = ROWS.map((r) => (r.v ? { ...r, v: toColumns(r.v, s.division, members) } : r));
  const all = rollup(src, width).map((r, i) => ({ ...r, leaf: !!src[i].v }));
  const depthIndex = DEPTHS.indexOf(view.depth);
  const zeroCut = s.env.zeroCut;
  const rows = all.filter((r) => r.level <= depthIndex && (!zeroCut || r.values.some((x) => x !== 0)));
  const hiddenZero = all.filter((r) => r.level <= depthIndex).length - rows.length;
  const total = grandTotal(all, width);
  const info = PATTERN_INFO[view.pattern];

  // 列の定義：合計（起動区分）→ 内訳（区分ごと）→ 内部取引消去（決算書のみ）
  type Col = { head: string; get: (v: number[]) => number; first?: boolean; muted?: boolean };
  const subCols = (ci: number, bi: number): Col[] => (isClosing
    ? [{ head: '当年度末(決算)', get: (v: number[]) => v[bi], first: true }, ...(view.prev ? [{ head: '前年度末', get: (v: number[]) => v[ci] }] : []), ...(view.diff ? [{ head: '増減', get: (v: number[]) => v[bi] - v[ci] }] : [])]
    : [...(view.carry ? [{ head: '前月繰越', get: (v: number[]) => v[ci] }] : []), ...(view.debit ? [{ head: '借方', get: (v: number[]) => Math.max(0, v[bi] - v[ci]) }] : []), ...(view.credit ? [{ head: '貸方', get: (v: number[]) => Math.max(0, v[ci] - v[bi]) }] : []), ...(view.balance ? [{ head: '残高', get: (v: number[]) => v[bi] }] : [])]
  ).map((c, i) => ({ ...c, first: i === 0 }));
  const groups: { label: ReactNode; cols: Col[]; breakdown?: boolean }[] = [
    { label: showBreakdown ? <>合計<span style={{ fontWeight: 500, marginLeft: 6 }}>{s.division}</span></> : s.division, cols: subCols(0, 1) },
    ...(showBreakdown ? members.map((m, i) => ({ label: m, breakdown: true, cols: isClosing ? [{ head: '当年度末(決算)', get: (v: number[]) => v[3 + i * 2], first: true }] : subCols(2 + i * 2, 3 + i * 2) })) : []),
    ...(showBreakdown && isClosing ? [{ label: '内部取引消去', breakdown: true, cols: [{ head: '当年度末(決算)', get: () => 0, first: true, muted: true }] }] : []),
  ];
  const flat = groups.flatMap((g) => g.cols.map((c) => ({ ...c, breakdown: g.breakdown })));

  // 元帳へのドリルダウン：右側の元帳パネルに出す（全画面の元帳はパネルの「元帳の画面で開く」から）
  const drawer = useLedgerDrawer(KEY);
  const openLedger = (name: string) => drawer.open({ account: name, month: view.month, kind: 'account', from: KEY });
  const picked = (name: string) => !drawer.collapsed && drawer.target?.account === name;
  const rowBg = (r: { name: string; level: number; leaf: boolean }, i: number) => (view.pattern === '標準' ? (r.level === 0 ? '#f3f6f9' : i % 2 ? '#fbfcfd' : 'transparent') : info.test(r.name, r.leaf) ? info.color : 'transparent');
  const linkBtn: CSSProperties = { marginLeft: 10, padding: '1px 8px', borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', color: accent, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
  const analysisBlocked = kind === '合算区分';

  return (
    <>
    <ReportShell
      variant={variant}
      accent={accent}
      asideWidth={drawer.asideWidth}
      extraTools={<ScreenPrintMenu page={KEY} accent={accent} />}
      title={displayName(KEY)}
      subtitle={<>{isClosing ? '当年度末（決算）の残高を一覧します。' : '前月繰越・当月の借方／貸方・残高を一覧します。'}科目の行の「元帳」ボタン（または行のダブルクリック）で、右側に総勘定元帳を表示します。別の行を押すと差し替わり、全画面で見たいときはパネルの「元帳の画面で開く」を使います。</>}
      tools={isClosing ? [
        { label: '残高グラフ', onClick: () => setGraph(true) },
        { label: '収支分析', onClick: () => setAnalysis(true), disabled: analysisBlocked, title: analysisBlocked ? '合算区分で起動中のため収支分析は使えません' : '収入・支出の構成と比率を表示します' },
        { label: '充実残額', onClick: () => onNavigate('充実残額') },
      ] : []}
      period={
        <>
          <span style={LABEL}>集計期間</span>
          <FiscalMonthTabs current={view.month} accent={accent} onSelect={(m) => setView({ month: m ?? '8' })} />
          <span style={{ fontSize: 12.5, color: '#48565f' }}>令和8年 {view.month}月</span>
        </>
      }
      parts={{ items: PARTS, current: view.part, onChange: (i) => setView({ part: i }) }}
      switches={
        <>
          <Segmented label="表示階層" items={DEPTHS} value={view.depth} onChange={(d) => setView({ depth: d })} accent={accent} />
          <Segmented label="行の配色" items={PATTERNS} value={view.pattern} onChange={(p) => setView({ pattern: p })} accent={accent} />
          <SwitchPill label="内訳（区分ごと）" on={members.length > 0 && view.breakdown} onChange={(v) => setView({ breakdown: v })} accent={accent} disabled={members.length === 0} title={members.length === 0 ? '合算区分・親区分で起動したときに、区分ごとの金額を表示できます' : '区分ごとの金額の列を表示します'} />
        </>
      }
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={LABEL}>表示する列</span>
          {isClosing ? (
            <>
              <label style={{ ...CHECK, cursor: 'default' }}><input type="checkbox" checked readOnly />当年度末(決算)</label>
              <label style={CHECK}><input type="checkbox" checked={view.prev} onChange={() => setView({ prev: !view.prev })} />前年度末</label>
              <label style={CHECK}><input type="checkbox" checked={view.diff} onChange={() => setView({ diff: !view.diff })} />増減</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />予算</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />差異</label>
            </>
          ) : (
            <>
              <label style={CHECK}><input type="checkbox" checked={view.carry} onChange={() => setView({ carry: !view.carry })} />前月繰越</label>
              <label style={CHECK}><input type="checkbox" checked={view.debit} onChange={() => setView({ debit: !view.debit })} />借方</label>
              <label style={CHECK}><input type="checkbox" checked={view.credit} onChange={() => setView({ credit: !view.credit })} />貸方</label>
              <label style={CHECK}><input type="checkbox" checked={view.balance} onChange={() => setView({ balance: !view.balance })} />残高</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />前月累計</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />当月</label>
              <label style={{ ...CHECK, cursor: 'default', opacity: 0.5 }}><input type="checkbox" disabled />累計</label>
            </>
          )}
          <span data-pattern-legend style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#7a8794' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: info.color, border: '1px solid #c3ccd4' }} />
            配色「{view.pattern}」：{info.note}
          </span>
        </div>
      }
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
        {view.part !== 0 ? (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>「{PARTS[view.part]}」のサンプルデータは未作成です（資産の部で表の構成をご確認ください）。</div>
        ) : flat.length === 0 ? (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>表示する列を1つ以上選んでください。</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, minWidth: 260 }} rowSpan={2}>科目名</th>
                {groups.map((g, i) => (
                  <th key={i} style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1', background: g.breakdown ? '#f0f5fa' : TH.background }} colSpan={g.cols.length}>
                    {g.breakdown && <span style={{ marginRight: 6, padding: '0 5px', borderRadius: 4, background: '#fff', border: '1px solid #d3dbe3', fontSize: 9.5 }}>内訳</span>}
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                {flat.map((c, i) => <th key={i} style={{ ...TH, textAlign: 'right', fontWeight: 500, borderLeft: c.first ? '1px solid #e6ecf1' : undefined, background: c.breakdown ? '#f0f5fa' : TH.background }}>{c.head}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bold = r.level === 0;
                return (
                  <tr key={r.name + ':' + r.level + ':' + i} data-account={r.name} onDoubleClick={() => { if (r.leaf) openLedger(r.name); }} title={r.leaf ? 'ダブルクリックで元帳を開く' : undefined} data-picked={picked(r.name) || undefined} style={{ background: picked(r.name) ? '#eaf5ef' : rowBg(r, i), boxShadow: picked(r.name) ? `inset 3px 0 0 ${accent}` : undefined, cursor: r.leaf ? 'pointer' : 'default' }}>
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
      <div data-format-note style={{ padding: '8px 22px', borderTop: '1px solid #eef2f5', fontSize: 11.5, color: '#9aa5b1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span>金額の書式は「動作環境」の設定に従います（桁区切り：{s.env.thousandsSep}／負の表記：{s.env.negativeSign}・{s.env.negativeColor}字／0円の行：{zeroCut ? `表示しない${hiddenZero > 0 ? `（${hiddenZero} 行を省略中）` : ''}` : '表示する'}）</span>
      </div>

      <Modal open={graph} onClose={() => setGraph(false)} width={640} title={`${displayName(KEY)} - 残高グラフ`}>
        <div style={{ padding: '12px 22px 18px' }}>
          {(() => { const items = rows.filter((r) => r.level <= 1 && r.values[1] > 0).slice(0, 8); const max = Math.max(1, ...items.map((r) => r.values[1])); return (
            <div style={{ display: 'grid', gap: 8 }}>{items.map((r) => { const v = r.values[1]; return <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 120px', gap: 10, alignItems: 'center', fontSize: 12.5 }}><span style={{ fontWeight: r.level === 0 ? 700 : 500 }}>{r.name}</span><div style={{ height: 14, background: '#eef2f5', borderRadius: 7, overflow: 'hidden' }}><div style={{ width: `${(v / max) * 100}%`, height: '100%', background: accent }} /></div><span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(v)}</span></div>; })}</div>
          ); })()}
          <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 10 }}>{PARTS[view.part]}・当年度末残高（{s.division}）。値はサンプルです。</div>
        </div>
      </Modal>

      <Modal open={analysis} onClose={() => setAnalysis(false)} width={680} title={`${displayName(KEY)} - 収支分析`}>
        <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 14 }}>
          {ANALYSIS.map((blk) => {
            const base = blk.items[0].value;
            return (
              <div key={blk.title}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5b6773', marginBottom: 6 }}>{blk.title}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {blk.items.map((it, i) => (
                    <div key={it.name} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 120px 64px', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                      <span style={{ fontWeight: i === 0 ? 700 : 500, paddingLeft: i === 0 ? 0 : 12 }}>{it.name}</span>
                      <div style={{ height: 14, background: '#eef2f5', borderRadius: 7, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (Math.abs(it.value) / base) * 100)}%`, height: '100%', background: i === 0 ? '#9aa5b1' : blk.color }} /></div>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: i === 0 ? 700 : 400 }}>{money(it.value)}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#7a8794' }}>{i === 0 ? '' : pct(it.value / base)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11.5, color: '#9aa5b1' }}>事業活動の収入・支出の構成と、収入に対する比率（人件費率など）。値はサンプルです。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setAnalysis(false)} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
        </div>
      </Modal>
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} />
    </>
  );
}

/** 収支分析のサンプル（構成確認用） */
const ANALYSIS: { title: string; color: string; items: { name: string; value: number }[] }[] = [
  { title: '収入の構成', color: '#2c5f9e', items: [{ name: 'サービス活動収益 計', value: 16_000_000 }, { name: '保育事業収益', value: 14_900_000 }, { name: '経常経費寄附金収益', value: 300_000 }, { name: 'その他の収益', value: 800_000 }] },
  { title: '支出の構成（収入に対する比率）', color: '#e8791e', items: [{ name: 'サービス活動収益 計', value: 16_000_000 }, { name: '人件費', value: 11_200_000 }, { name: '事業費', value: 2_600_000 }, { name: '事務費', value: 1_600_000 }, { name: 'サービス活動増減差額', value: 600_000 }] },
];
