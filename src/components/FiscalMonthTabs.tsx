// 会計年度の月タブ（既存システムの「4 5 6 … 3 決」に相当）

import type { MonthFilter } from '../types';

export const FISCAL_MONTHS = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3', '決'];

interface Props {
  current: MonthFilter;
  accent: string;
  onSelect: (m: MonthFilter) => void;
  /** 「全月」ボタンを付ける */
  withAll?: boolean;
}

export function FiscalMonthTabs({ current, accent, onSelect, withAll }: Props) {
  const opts: { label: string; value: MonthFilter }[] = [
    ...(withAll ? [{ label: '全月', value: null as MonthFilter }] : []),
    ...FISCAL_MONTHS.map((m) => ({ label: m, value: m })),
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {opts.map((o) => {
        const on = current === o.value;
        return (
          <button
            key={o.label}
            type="button"
            className="chip"
            onClick={() => onSelect(o.value)}
            style={{
              minWidth: 30,
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: on ? accent : '#fff',
              color: on ? '#fff' : '#5b6773',
              border: '1px solid ' + (on ? accent : '#d3dbe3'),
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
