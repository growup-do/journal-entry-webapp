// 予算対比表
//   骨格は ReportShell 共通：集計期間（月）→ 科目検索 → 表示切替 → 一覧。
//   対象は資金の部（資金収支）だけ。資産・負債・事業の部への切り替えはない（確認メモ #136）。
//   表示切替＝表／実績グラフ／達成率グラフ／構成比グラフ。科目名／現額予算／実績額／予算残高／達成率／構成比の階層表。
//   科目行から元帳へドリルダウン：月次試算と同じく、画面遷移せず右側の元帳パネルに資金元帳を表示する（確認メモ #138）。
//   パネルの「元帳の画面で開く」で全画面の資金元帳へ移り、その「← 戻る」でこの画面に戻る。
//   サンプルは収入の科目のみ。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { NUM, pct, ReportShell, Segmented, TD, TH, useMoney, useViewState } from './ReportShell';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { BUDGET_ROWS, displayName } from '../data';
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

export function BudgetComparePage({ variant, accent, onNavigate }: Props) {
  const money = useMoney();
  const [view, setView] = useViewState<{ month: string; kind: ViewKind }>(KEY, { month: '10', kind: '表' });
  const [q, setQ] = useState('');
  // leaf＝金額を持つ科目の行（集計行ではない）。元帳を開けるのはこの行
  const rows = rollup(BUDGET_ROWS, 2).map((r, i) => ({ ...r, leaf: !!BUDGET_ROWS[i].v }));
  const total = grandTotal(rows, 2);
  // 科目名の一部、または科目コード（前方一致）で強調する（確認メモ #160）
  const hit = (name: string) => { const k = q.trim(); return !!k && (name.includes(k) || (/^\d+$/.test(k) && codeOf('account', name).startsWith(k))); };
  const hits = rows.filter((r) => hit(r.name)).length;
  const maxActual = Math.max(1, ...rows.map((r) => r.values[1]));

  // グラフ1本分の値（0〜1）と右端の表示
  const bar = (b: number, a: number): { ratio: number; text: ReactNode } => (
    view.kind === '実績グラフ' ? { ratio: a / maxActual, text: money(a) }
      : view.kind === '達成率グラフ' ? { ratio: b ? Math.min(1, a / b) : 0, text: b ? pct(a / b) : '—' }
        : { ratio: total[1] ? a / total[1] : 0, text: a ? pct(a / total[1]) : '—' }
  );
  const graphNote = view.kind === '実績グラフ' ? '棒：実績額（最大の科目を100%として表示）' : view.kind === '達成率グラフ' ? '棒：実績額 ÷ 現額予算（達成率）' : '棒：実績額 ÷ 実績額合計（構成比）';

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
            const [b, a] = r.values;
            const g = bar(b, a);
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
              {rows.map((r, i) => {
                const [b, a] = r.values;
                const bold = r.level === 0;
                return (
                  <tr key={i} data-account={r.name} onDoubleClick={() => { if (r.leaf) openLedger(r.name); }} title={r.leaf ? 'ダブルクリックで資金元帳を開く' : undefined} data-picked={picked(r.name) || undefined} style={{ background: picked(r.name) ? '#eaf5ef' : hit(r.name) ? '#fff8d6' : r.level === 0 ? '#f3f6f9' : 'transparent', boxShadow: picked(r.name) ? `inset 3px 0 0 ${accent}` : undefined, cursor: r.leaf ? 'pointer' : 'default' }}>
                    <td style={{ ...TD, paddingLeft: 12 + r.level * 18, fontWeight: bold || picked(r.name) ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {r.name}
                      {r.leaf && <button type="button" className="btn-outline" data-action="元帳" onClick={(e) => { e.stopPropagation(); openLedger(r.name); }} style={linkBtn}>元帳 ›</button>}
                    </td>
                    <td style={{ ...NUM, fontWeight: bold ? 700 : 400 }}>{money(b)}</td>
                    <td style={{ ...NUM, fontWeight: bold ? 700 : 400 }}>{money(a)}</td>
                    <td style={NUM}>{money(b - a)}</td>
                    <td style={NUM}>{b ? pct(a / b) : ''}</td>
                    <td style={NUM}>{a ? pct(a / total[1]) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e9eef3' }}>
                <td style={{ ...TD, fontWeight: 700 }}>合計</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{money(total[0])}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{money(total[1])}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{money(total[0] - total[1])}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{pct(total[1] / total[0])}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} />
    </>
  );
}
