// 予算対比表
//   骨格は ReportShell 共通：集計期間（月）→ 科目検索 → 表示切替 → 一覧。
//   対象は資金の部（資金収支）だけ。資産・負債・事業の部への切り替えはない（確認メモ #136）。
//   表示切替＝表／実績グラフ／達成率グラフ／構成比グラフ。科目名／現額予算／実績額／予算残高／達成率／構成比の階層表。
//   科目行から元帳へドリルダウン：月次試算と同じく、画面遷移せず右側の元帳パネルに資金元帳を表示する（確認メモ #138）。
//   パネルの「元帳の画面で開く」で全画面の資金元帳へ移り、その「← 戻る」でこの画面に戻る。
//   集計行は現行と同じ名称と並び（確認メモ #137）：区分ごとの 収入計・支出計・資金収支差額、予備費支出、
//   当期資金収支差額合計、前期末支払資金残高、当期末支払資金残高。集計行は緑、科目の行は白と薄い緑の縞。金額はサンプル。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { NUM, pct, ReportShell, Segmented, TD, TH, useMoney, useViewState } from './ReportShell';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { BUDGET_PREV_BALANCE, BUDGET_RESERVE, BUDGET_SECTIONS, displayName, type HierRow } from '../data';
import { codeOf } from './EntryCommon';
import { grandTotal, rollup } from '../lib/hier';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

const KEY = '予算対比';
const VIEWS = ['表', '実績グラフ', '達成率グラフ', '構成比グラフ'] as const;
type ViewKind = (typeof VIEWS)[number];

/** kind：row＝科目の行、sum＝集計行。leaf＝金額を持つ科目の行（元帳を開けるのはこの行）。b＝現額予算、a＝実績額 */
interface Line { kind: 'row' | 'sum'; name: string; level: number; b: number; a: number; leaf: boolean }
type Pair = [number, number];

/** 集計行の色（現行と同じ緑）と、科目の行の縞（白と薄い緑） */
const SUM_BG = '#b9e0ad';
const SUM_LINE = '#9ccb8f';
const STRIPE_BG = '#f1f8f3';

/** 現行と同じ並びの行を組み立てる（確認メモ #137）。
 *   区分ごとに：収入の科目 → 収入計(n) → 支出の科目 → 支出計(n+1) → 資金収支差額(n+2)=(n)-(n+1)
 *   続けて：予備費支出(10) → 当期資金収支差額合計(11) → 前期末支払資金残高(12) → 当期末支払資金残高 */
function buildLines(): { lines: Line[]; incomeActual: number } {
  const lines: Line[] = [];
  let incomeActual = 0;
  const sum = (name: string, v: Pair): Line => ({ kind: 'sum', name, level: 0, b: v[0], a: v[1], leaf: false });
  const net: Pair = [0, 0];
  BUDGET_SECTIONS.forEach((sec, i) => {
    const n = i * 3 + 1;
    const part = (src: HierRow[]): Pair => {
      const rs = rollup(src, 2);
      rs.forEach((r, k) => lines.push({ kind: 'row', name: r.name, level: r.level, b: r.values[0], a: r.values[1], leaf: !!src[k].v }));
      const t = grandTotal(rs, 2);
      return [t[0], t[1]];
    };
    const inc = part(sec.income);
    incomeActual += inc[1];
    lines.push(sum(`${sec.name}収入計(${n})`, inc));
    const exp = part(sec.expense);
    lines.push(sum(`${sec.name}支出計(${n + 1})`, exp));
    const diff: Pair = [inc[0] - exp[0], inc[1] - exp[1]];
    net[0] += diff[0];
    net[1] += diff[1];
    lines.push(sum(`${sec.name}資金収支差額(${n + 2})=(${n})-(${n + 1})`, diff));
  });
  const total: Pair = [net[0] - BUDGET_RESERVE[0], net[1] - BUDGET_RESERVE[1]];
  lines.push(sum('予備費支出(10)', BUDGET_RESERVE));
  lines.push(sum('当期資金収支差額合計(11)=(3)+(6)+(9)-(10)', total));
  lines.push(sum('前期末支払資金残高(12)', BUDGET_PREV_BALANCE));
  lines.push(sum('当期末支払資金残高(11)+(12)', [total[0] + BUDGET_PREV_BALANCE[0], total[1] + BUDGET_PREV_BALANCE[1]]));
  return { lines, incomeActual };
}
const { lines: LINES, incomeActual: INCOME_ACTUAL } = buildLines();
/** 構成比の分母（現行と同じ）＝収入の実績額の合計＋前期末支払資金残高。収入・支出・差額・残高のどの行も同じ分母で割る */
const SHARE_BASE = INCOME_ACTUAL + BUDGET_PREV_BALANCE[1];

export function BudgetComparePage({ variant, accent, onNavigate }: Props) {
  const money = useMoney();
  const [view, setView] = useViewState<{ month: string; kind: ViewKind }>(KEY, { month: '10', kind: '表' });
  const [q, setQ] = useState('');
  // 科目の行（グラフと科目検索の対象）。集計行は表にだけ出す
  const rows = LINES.filter((r) => r.kind === 'row');
  // 構成比＝その行の実績額 ÷（収入の実績額の合計＋前期末支払資金残高）。実績額が 0 の行は空欄（現行と同じ）
  const share = (r: Line) => (r.a && SHARE_BASE ? r.a / SHARE_BASE : null);
  // 科目名の一部、または科目コード（前方一致）で強調する（確認メモ #160）
  const hit = (name: string) => { const k = q.trim(); return !!k && (name.includes(k) || (/^\d+$/.test(k) && codeOf('account', name).startsWith(k))); };
  const hits = rows.filter((r) => hit(r.name)).length;
  const maxActual = Math.max(1, ...rows.map((r) => r.a));

  // グラフ1本分の値（0〜1）と右端の表示
  const bar = (r: Line): { ratio: number; text: ReactNode } => {
    const sh = share(r);
    return view.kind === '実績グラフ' ? { ratio: r.a / maxActual, text: money(r.a) }
      : view.kind === '達成率グラフ' ? { ratio: r.b ? Math.min(1, r.a / r.b) : 0, text: r.b ? pct(r.a / r.b) : '—' }
        : { ratio: sh ?? 0, text: sh != null ? pct(sh) : '—' };
  };
  const graphNote = view.kind === '実績グラフ' ? '棒：実績額（最大の科目を100%として表示）' : view.kind === '達成率グラフ' ? '棒：実績額 ÷ 現額予算（達成率）' : '棒：実績額 ÷（収入の実績額合計＋前期末支払資金残高）（構成比）';

  // 元帳へのドリルダウン：右側の元帳パネルに資金元帳を出す（月次試算と同じ出し方。確認メモ #138）
  const drawer = useLedgerDrawer(KEY, 'fund');
  const openLedger = (name: string) => drawer.open({ account: name, month: view.month, kind: 'fund', from: KEY });
  const picked = (name: string) => !drawer.collapsed && drawer.target?.account === name;
  const linkBtn: CSSProperties = { marginLeft: 10, padding: '1px 8px', borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };

  return (
    <>
    <ReportShell
      variant={variant}
      accent={accent}
      asideWidth={drawer.asideWidth}
      title={displayName(KEY)}
      subtitle="現額予算と実績額を科目ごとに対比し、予算残高・達成率・構成比を表示します。表とグラフ（実績／達成率／構成比）を切り替えできます。表の科目の行の「元帳」ボタン（または行のダブルクリック）で、右側に資金元帳を表示します。"
      extraTools={<ScreenPrintMenu page="予算対比" accent={accent} />}
      tools={[{ label: '再計算' }]}
      period={
        <>
          <FiscalMonthTabs current={view.month} accent={accent} onSelect={(m) => setView({ month: m ?? '10' })} />
          <span style={{ fontSize: 14, color: '#48565f' }}>令和8年 {view.month}月</span>
        </>
      }
      periodAside={<span data-part-fixed title="予算対比表は資金の部（資金収支）だけを表示します" style={{ padding: '4px 12px', borderRadius: 8, background: '#fff3c4', color: '#7a5600', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>資金の部</span>}
      targetLabel="科目検索"
      target={
        <>
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名の一部、または科目コード" autoComplete="off" style={{ width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          {q.trim() && <span style={{ fontSize: 14, color: hits ? accent : '#c0392b', fontWeight: 700 }}>{hits ? `${hits} 件の科目を強調表示中` : '該当する科目がありません'}</span>}
          {q && <button type="button" onClick={() => setQ('')} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>クリア</button>}
        </>
      }
      switches={<Segmented label="表示形式" items={VIEWS} value={view.kind} onChange={(k) => setView({ kind: k })} accent={accent} />}
    >
      {view.kind !== '表' ? (
        <div data-graph={view.kind} style={{ padding: '18px 22px 24px', overflow: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 130px 1fr 90px', gap: 12, padding: '0 0 6px', borderBottom: '1px solid #e2e8ee', fontSize: 12, fontWeight: 700, color: '#8290a0' }}>
            <span>科目名</span><span style={{ textAlign: 'right' }}>実績額</span><span>{view.kind}</span><span style={{ textAlign: 'right' }}>{view.kind === '実績グラフ' ? '実績額' : view.kind === '達成率グラフ' ? '達成率' : '構成比'}</span>
          </div>
          {rows.map((r, i) => {
            const a = r.a;
            const g = bar(r);
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '260px 130px 1fr 90px', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid #f1f4f6', background: hit(r.name) ? '#fff8d6' : 'transparent' }}>
                <div style={{ fontSize: 14, fontWeight: r.level === 0 ? 700 : r.level === 1 ? 600 : 400, paddingLeft: r.level * 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{money(a)}</div>
                <div style={{ position: 'relative', height: 16, background: '#eef2f5', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(1, g.ratio)) * 100}%`, background: view.kind === '達成率グラフ' ? accent : view.kind === '実績グラフ' ? '#2c5f9e' : '#b7791f', opacity: r.level === 0 ? 0.95 : 0.7 }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.text}</div>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 10 }}>{graphNote}</div>
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            {/* 一覧をスクロールしても見出しは固定する（月次試算と同じ。確認メモ #135） */}
            <thead data-sticky-head style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...TH, minWidth: 260 }}>科目名</th>
                <th style={{ ...TH, textAlign: 'right' }}>現額予算</th>
                <th style={{ ...TH, textAlign: 'right' }}>実績額</th>
                <th style={{ ...TH, textAlign: 'right' }}>予算残高</th>
                <th style={{ ...TH, textAlign: 'right', width: 80 }}>達成率</th>
                <th style={{ ...TH, textAlign: 'right', width: 80 }}>構成比</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let n = 0; // 科目の行の通し番号（縞の色を決める。集計行は数えない）
                return LINES.map((r, i) => {
                  const { b, a } = r;
                  const sh = share(r);
                  // 集計行（確認メモ #137）：現行と同じ名称で、緑の背景・太字。元帳は開かない
                  if (r.kind === 'sum') return (
                    <tr key={i} data-sum-row={r.name} style={{ background: SUM_BG }}>
                      <td style={{ ...TD, paddingLeft: 12, whiteSpace: 'nowrap', borderBottom: '1px solid ' + SUM_LINE }}>{r.name}</td>
                      <td style={{ ...NUM, borderBottom: '1px solid ' + SUM_LINE }}>{money(b)}</td>
                      <td style={{ ...NUM, borderBottom: '1px solid ' + SUM_LINE }}>{money(a)}</td>
                      <td style={{ ...NUM, borderBottom: '1px solid ' + SUM_LINE }}>{money(b - a)}</td>
                      <td style={{ ...NUM, borderBottom: '1px solid ' + SUM_LINE }}>{b ? pct(a / b) : ''}</td>
                      <td style={{ ...NUM, borderBottom: '1px solid ' + SUM_LINE }}>{sh != null ? pct(sh) : ''}</td>
                    </tr>
                  );
                  const stripe = n++ % 2 === 1;
                  const bold = r.level === 0;
                  const on = r.leaf && picked(r.name);
                  return (
                    <tr key={i} data-account={r.name} onDoubleClick={() => { if (r.leaf) openLedger(r.name); }} title={r.leaf ? 'ダブルクリックで資金元帳を開く' : undefined} data-picked={on || undefined} style={{ background: on ? '#dff0e6' : hit(r.name) ? '#fff8d6' : stripe ? STRIPE_BG : '#fff', boxShadow: on ? `inset 3px 0 0 ${accent}` : undefined, cursor: r.leaf ? 'pointer' : 'default' }}>
                      <td style={{ ...TD, paddingLeft: 12 + r.level * 18, fontWeight: bold || on ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {r.name}
                        {r.leaf && <button type="button" className="btn-outline" data-action="元帳" onClick={(e) => { e.stopPropagation(); openLedger(r.name); }} style={linkBtn}>元帳 ›</button>}
                      </td>
                      <td style={{ ...NUM, fontWeight: bold ? 700 : 400 }}>{money(b)}</td>
                      <td style={{ ...NUM, fontWeight: bold ? 700 : 400 }}>{money(a)}</td>
                      <td style={NUM}>{money(b - a)}</td>
                      <td style={NUM}>{b ? pct(a / b) : ''}</td>
                      <td style={NUM}>{sh != null ? pct(sh) : ''}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} />
    </>
  );
}
