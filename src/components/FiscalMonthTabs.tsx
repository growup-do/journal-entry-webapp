// 会計年度の月タブ（既存システムの「4 5 6 … 3 決」に相当）

import type { MonthFilter } from '../types';
import { useSession } from '../store/session';

export const FISCAL_MONTHS = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3', '決'];

interface Props {
  current: MonthFilter;
  accent: string;
  onSelect: (m: MonthFilter) => void;
  /** 「全月」ボタンを付ける */
  withAll?: boolean;
}

export function FiscalMonthTabs({ current, accent, onSelect, withAll }: Props) {
  // 環境設定（全区分共通）「月範囲の選択で、期首から月を選択する」：期首〜選択月を帯で示す（依頼書 2.5）
  const fromStart = useSession().env.termFromStart;
  const curIdx = current == null || current === '決' ? -1 : FISCAL_MONTHS.indexOf(current);
  const opts: { label: string; value: MonthFilter }[] = [
    ...(withAll ? [{ label: '全月', value: null as MonthFilter }] : []),
    ...FISCAL_MONTHS.map((m) => ({ label: m, value: m })),
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {opts.map((o) => {
        const on = current === o.value;
        const inRange = fromStart && !on && o.value != null && o.value !== '決' && curIdx > 0 && FISCAL_MONTHS.indexOf(o.value) < curIdx;
        return (
          <button
            key={o.label}
            type="button"
            className="chip"
            onClick={() => onSelect(o.value)}
            title={inRange ? '期首からの累計に含まれる月（環境設定「期首から月を選択する」）' : undefined}
            data-in-range={inRange || undefined}
            style={{
              minWidth: 30,
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: on ? accent : inRange ? accent + '22' : '#fff',
              color: on ? '#fff' : inRange ? accent : '#5b6773',
              border: '1px solid ' + (on || inRange ? accent : '#d3dbe3'),
            }}
          >
            {o.label}
          </button>
        );
      })}
      {fromStart && curIdx > 0 && <span data-from-start style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }} title="環境設定（全区分共通）「月範囲の選択で、期首から月を選択する」が有効です">4月〜{current}月の累計</span>}
    </div>
  );
}
