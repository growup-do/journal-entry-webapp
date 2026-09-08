// 前年仕訳（閲覧のみ）。入力画面の右側／一覧の代わりに表示する。

import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { NUM, TD, TH, yen } from './ReportShell';
import { PREV_YEAR_ROWS } from '../data';
import type { MonthFilter } from '../types';

interface Props {
  accent: string;
  /** 右側パネル用の狭い表示 */
  compact?: boolean;
}

export function PrevYearJournal({ accent, compact }: Props) {
  const [month, setMonth] = useState<MonthFilter>('決');
  const rows = PREV_YEAR_ROWS.filter((r) => month == null || r.date === month);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: compact ? '12px 14px 10px' : '10px 22px', borderBottom: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ padding: '2px 9px', borderRadius: 10, background: '#fff1b8', color: '#8a6d00', fontSize: 11, fontWeight: 700 }}>前年仕訳</span>
          <span style={{ fontSize: 12, color: '#7a8794' }}>令和7年度・閲覧のみ</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3' }}>{rows.length} 件</span>
        </div>
        <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} withAll />
      </div>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {rows.length === 0 ? (
          <div style={{ padding: '36px 14px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>この月の前年仕訳はありません（サンプルは決算仕訳のみ）。</div>
        ) : compact ? (
          rows.map((r) => (
            <div key={r.seq} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 84px', gap: 8, padding: '10px 14px', borderBottom: '1px solid #f1f4f6', fontSize: 12, alignItems: 'center' }}>
              <div style={{ color: '#8895a3', fontSize: 11 }}>決算</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kari} <span style={{ color: '#9aa5b1' }}>／</span> {r.kashi}</div>
                <div style={{ fontSize: 10.5, color: '#9aa5b1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tekiyo}</div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(r.amount)}</div>
            </div>
          ))
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 60 }}>月日</th>
                <th style={TH}>借方科目</th>
                <th style={TH}>貸方科目</th>
                <th style={TH}>摘要</th>
                <th style={{ ...TH, textAlign: 'right', width: 130 }}>金額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.seq}>
                  <td style={{ ...TD, color: '#8895a3' }}>決算</td>
                  <td style={{ ...TD, fontWeight: 500 }}>{r.kari}</td>
                  <td style={{ ...TD, color: '#48565f' }}>{r.kashi}</td>
                  <td style={{ ...TD, color: '#7a8794' }}>{r.tekiyo}</td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{yen(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
