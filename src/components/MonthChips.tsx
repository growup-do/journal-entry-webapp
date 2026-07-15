// 月フィルターチップ（全月 ＋ 仕訳帳に存在する月）

import type { MonthFilter } from '../types';

interface Props {
  months: string[];
  current: MonthFilter;
  accent: string;
  onSelect: (month: MonthFilter) => void;
}

export function MonthChips({ months, current, accent, onSelect }: Props) {
  const opts: { label: string; value: MonthFilter }[] = [
    { label: '全月', value: null },
    ...months.map((m) => ({ label: m + '月', value: m })),
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map((o) => {
        const on = current === o.value;
        return (
          <button
            key={o.label}
            type="button"
            className="chip"
            onClick={() => onSelect(o.value)}
            style={{
              padding: '4px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 16,
              cursor: 'pointer',
              fontFamily: 'inherit',
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
