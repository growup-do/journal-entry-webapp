// 取引区分チップ（資金 / 事業 / その他）— 単一選択トグル

import type { Torihiki } from '../types';

const LABELS: ('資金' | '事業' | 'その他')[] = ['資金', '事業', 'その他'];

interface Props {
  current: Torihiki;
  accent: string; // 選択時の背景/枠色
  onToggle: (label: '資金' | '事業' | 'その他') => void;
}

export function Chips({ current, accent, onToggle }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {LABELS.map((label) => {
        const on = current === label;
        return (
          <button
            key={label}
            type="button"
            className="chip"
            onClick={() => onToggle(label)}
            style={{
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: on ? accent : '#fff',
              color: on ? '#fff' : '#5b6773',
              border: '1px solid ' + (on ? accent : '#cfd8e0'),
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
