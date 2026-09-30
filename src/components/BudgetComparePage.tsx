// 予算対比表
//   骨格は ReportShell 共通：集計期間（月）＋部の切替（右上のボタン／← → キー）→ 科目検索 → 表示切替 → 一覧。
//   表示切替＝表／実績グラフ／達成率グラフ／構成比グラフ。科目名／現額予算／実績額／予算残高／達成率／構成比の階層表。
//   資金の部（収入）のみサンプルあり。

import { useState } from 'react';
import type { ReactNode } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { LABEL, NUM, pct, ReportShell, Segmented, TD, TH, useMoney, useViewState } from './ReportShell';
import { BUDGET_ROWS, displayName } from '../data';
import { grandTotal, rollup } from '../lib/hier';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

const KEY = '予算対比';
const PARTS = ['資産', '負債', '事業', '資金'];
const VIEWS = ['表', '実績グラフ', '達成率グラフ', '構成比グラフ'] as const;
type ViewKind = (typeof VIEWS)[number];

export function BudgetComparePage({ variant, accent }: Props) {
  const money = useMoney();
  const [view, setView] = useViewState<{ month: string; part: number; kind: ViewKind }>(KEY, { month: '10', part: 3, kind: '表' });
  const [q, setQ] = useState('');
  const rows = rollup(BUDGET_ROWS, 2);
  const total = grandTotal(rows, 2);
  const hit = (name: string) => !!q.trim() && name.includes(q.trim());
  const hits = rows.filter((r) => hit(r.name)).length;
  const maxActual = Math.max(1, ...rows.map((r) => r.values[1]));

  // グラフ1本分の値（0〜1）と右端の表示
  const bar = (b: number, a: number): { ratio: number; text: ReactNode } => (
    view.kind === '実績グラフ' ? { ratio: a / maxActual, text: money(a) }
      : view.kind === '達成率グラフ' ? { ratio: b ? Math.min(1, a / b) : 0, text: b ? pct(a / b) : '—' }
        : { ratio: total[1] ? a / total[1] : 0, text: a ? pct(a / total[1]) : '—' }
  );
  const graphNote = view.kind === '実績グラフ' ? '棒：実績額（最大の科目を100%として表示）' : view.kind === '達成率グラフ' ? '棒：実績額 ÷ 現額予算（達成率）' : '棒：実績額 ÷ 実績額合計（構成比）';

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={displayName(KEY)}
      subtitle="現額予算と実績額を科目ごとに対比し、予算残高・達成率・構成比を表示します。表とグラフ（実績／達成率／構成比）を切り替えできます。"
      tools={[{ label: '再計算' }]}
      period={
        <>
          <span style={LABEL}>集計期間</span>
          <FiscalMonthTabs current={view.month} accent={accent} onSelect={(m) => setView({ month: m ?? '10' })} />
          <span style={{ fontSize: 12.5, color: '#48565f' }}>令和8年 {view.month}月</span>
        </>
      }
      parts={{ items: PARTS, current: view.part, onChange: (i) => setView({ part: i }) }}
      target={
        <>
          <span style={LABEL}>科目検索</span>
          <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="科目名の一部を入力" autoComplete="off" style={{ width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
          {q.trim() && <span style={{ fontSize: 12, color: hits ? accent : '#c0392b', fontWeight: 700 }}>{hits ? `${hits} 件の科目を強調表示中` : '該当する科目がありません'}</span>}
          {q && <button type="button" onClick={() => setQ('')} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>クリア</button>}
        </>
      }
      switches={<Segmented label="表示形式" items={VIEWS} value={view.kind} onChange={(k) => setView({ kind: k })} accent={accent} />}
    >
      {view.part !== 3 ? (
        <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>「{PARTS[view.part]}」のサンプルデータは未作成です（資金で表の構成をご確認ください）。</div>
      ) : view.kind !== '表' ? (
        <div data-graph={view.kind} style={{ padding: '18px 22px 24px', overflow: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 130px 1fr 90px', gap: 12, padding: '0 0 6px', borderBottom: '1px solid #e2e8ee', fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>
            <span>科目名</span><span style={{ textAlign: 'right' }}>実績額</span><span>{view.kind}</span><span style={{ textAlign: 'right' }}>{view.kind === '実績グラフ' ? '実績額' : view.kind === '達成率グラフ' ? '達成率' : '構成比'}</span>
          </div>
          {rows.map((r, i) => {
            const [b, a] = r.values;
            const g = bar(b, a);
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '260px 130px 1fr 90px', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid #f1f4f6', background: hit(r.name) ? '#fff8d6' : 'transparent' }}>
                <div style={{ fontSize: 12.5, fontWeight: r.level === 0 ? 700 : r.level === 1 ? 600 : 400, paddingLeft: r.level * 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ textAlign: 'right', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{money(a)}</div>
                <div style={{ position: 'relative', height: 16, background: '#eef2f5', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(1, g.ratio)) * 100}%`, background: view.kind === '達成率グラフ' ? accent : view.kind === '実績グラフ' ? '#2c5f9e' : '#b7791f', opacity: r.level === 0 ? 0.95 : 0.7 }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.text}</div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 10 }}>{graphNote}</div>
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
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
                  <tr key={i} style={{ background: hit(r.name) ? '#fff8d6' : r.level === 0 ? '#f3f6f9' : 'transparent' }}>
                    <td style={{ ...TD, paddingLeft: 12 + r.level * 18, fontWeight: bold ? 700 : 400 }}>{r.name}</td>
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
  );
}
