// 予算対比（既存「予算対比」の再現）
//   指定年月・部（資金の部）・表形式／グラフ切替。科目名／現額予算／実績額／予算残高／達成率／構成比の階層表。
//   資金の部（収入）のみサンプルあり。

import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { LABEL, NUM, pct, ReportShell, TD, TH, yen } from './ReportShell';
import { BUDGET_ROWS } from '../data';
import { grandTotal, rollup } from '../lib/hier';
import type { MonthFilter } from '../types';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function BudgetComparePage({ variant, accent, onNavigate }: Props) {
  const [month, setMonth] = useState<MonthFilter>('10');
  const [view, setView] = useState<'table' | 'graph'>('table');
  const rows = rollup(BUDGET_ROWS, 2);
  const total = grandTotal(rows, 2);
  const top = rows.filter((r) => r.level <= 1);

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title="予算対比"
      subtitle="現額予算と実績額を科目ごとに対比し、予算残高・達成率・構成比を表示します。"
      tools={[{ label: '表', onClick: () => setView('table'), primary: view === 'table' }, { label: 'グラフ', onClick: () => setView('graph'), primary: view === 'graph' }, { label: '計算' }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={LABEL}>指定年月</span>
          <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} />
          <span style={{ fontSize: 12.5, color: '#48565f' }}>令和8年 {month ?? '10'}月</span>
          <span style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 8, background: '#e8791e', color: '#fff', fontSize: 12.5, fontWeight: 700 }}>資金の部</span>
          <select value={view} onChange={(e) => setView(e.target.value as 'table' | 'graph')} style={{ padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}>
            <option value="table">表形式</option>
            <option value="graph">グラフ形式</option>
          </select>
        </div>
      }
    >
      {view === 'graph' ? (
        <div style={{ padding: '18px 22px 24px' }}>
          {top.map((r, i) => {
            const [b, a] = r.values;
            const ratio = b ? Math.min(1, a / b) : 0;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 90px', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid #f1f4f6' }}>
                <div style={{ fontSize: 12.5, fontWeight: r.level === 0 ? 700 : 500, paddingLeft: r.level * 16 }}>{r.name}</div>
                <div style={{ position: 'relative', height: 18, background: '#eef2f5', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${ratio * 100}%`, background: accent, opacity: 0.85 }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{b ? pct(a / b) : '—'}</div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 10 }}>棒：実績額 ÷ 現額予算（達成率）</div>
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
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
                  <tr key={i} style={{ background: r.level === 0 ? '#f3f6f9' : 'transparent' }}>
                    <td style={{ ...TD, paddingLeft: 12 + r.level * 18, fontWeight: bold ? 700 : 400 }}>{r.name}</td>
                    <td style={{ ...NUM, fontWeight: bold ? 700 : 400 }}>{yen(b)}</td>
                    <td style={{ ...NUM, fontWeight: bold ? 700 : 400 }}>{yen(a)}</td>
                    <td style={{ ...NUM, color: b - a < 0 ? '#c0392b' : undefined }}>{yen(b - a)}</td>
                    <td style={NUM}>{b ? pct(a / b) : ''}</td>
                    <td style={NUM}>{a ? pct(a / total[1]) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e9eef3' }}>
                <td style={{ ...TD, fontWeight: 700 }}>合計</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(total[0])}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(total[1])}</td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(total[0] - total[1])}</td>
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
