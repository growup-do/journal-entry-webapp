// 法人メニュー（法人調査・法人印刷）
// 通常メニューとは別枠で、アプリバーの会計期間の隣に配置する（メニューが多すぎて使いづらいため）。

import { CORP_MENU } from '../data';

interface Props {
  accent: string;
  active: string;
  onSelect: (label: string) => void;
}

export function CorpMenu({ accent, active, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, background: '#f4f6f8', border: '1px solid #e2e8ee', borderRadius: 9 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#8290a0', padding: '0 6px 0 5px', letterSpacing: '.04em' }}>法人</span>
      {CORP_MENU.map((label) => {
        const on = active === label;
        return (
          <button
            key={label}
            type="button"
            className="btn-outline"
            onClick={() => onSelect(label)}
            data-menu={label}
            style={{
              padding: '5px 11px',
              borderRadius: 7,
              border: '1px solid ' + (on ? accent : '#d3dbe3'),
              background: on ? accent : '#fff',
              color: on ? '#fff' : '#3d4a56',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label.replace('法人', '')}
          </button>
        );
      })}
    </div>
  );
}
