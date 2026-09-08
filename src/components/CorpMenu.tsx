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
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, background: '#f4f6f8', border: '1px solid #e2e8ee', borderRadius: 8, flex: 'none' }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8290a0', padding: '0 4px', letterSpacing: '.02em' }}>法人</span>
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
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid ' + (on ? accent : '#d3dbe3'),
              background: on ? accent : '#fff',
              color: on ? '#fff' : '#3d4a56',
              fontSize: 11.5,
              fontWeight: 700,
              lineHeight: 1.3,
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
