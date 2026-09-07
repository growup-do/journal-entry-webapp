// メニュー（横=フォーム型ナビ / 縦=スプレッドシート型サイドバー）
// テキストのみ・グループ区切りあり。アクティブ項目のみアクセント色。クリックで画面遷移。

import type { CSSProperties } from 'react';
import { MENU, isOptionMenu } from '../data';

/** オプション項目の色（琥珀） */
const OPTION = '#b45309';

interface Props {
  orientation: 'h' | 'v';
  accent: string;
  active: string;
  onSelect: (label: string) => void;
}

export function Menu({ orientation, accent, active: activeLabel, onSelect }: Props) {
  const isH = orientation === 'h';

  return (
    <>
      {MENU.map((group, gi) => {
        const groupStyle: CSSProperties = isH
          ? {
              display: 'flex',
              gap: 1,
              flex: 'none',
              // グループ間の区切り線（縦型サイドバーと同じ色・同等の余白）
              marginLeft: gi === 0 ? 0 : 8,
              paddingLeft: gi === 0 ? 0 : 8,
              borderLeft: gi === 0 ? 'none' : '1px solid #dde3e9',
              alignSelf: 'stretch',
              ...(group.every(isOptionMenu) ? { background: '#fff7e6', borderRadius: 6, paddingLeft: 8, paddingRight: 4 } : {}),
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              paddingTop: gi === 0 ? 0 : 8,
              marginTop: gi === 0 ? 0 : 8,
              borderTop: gi === 0 ? 'none' : '1px solid #eef2f5',
              ...(group.every(isOptionMenu) ? { background: '#fff7e6', borderRadius: 8, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4, paddingBottom: 6 } : {}),
            };
        return (
          <div key={gi} style={groupStyle}>
            {group.map((label) => {
              const active = label === activeLabel;
              const option = isOptionMenu(label);
              const baseColor = option ? OPTION : '#5b6773';
              const style: CSSProperties = isH
                ? {
                    padding: '6px 11px',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    borderBottom: '2px solid ' + (active ? accent : 'transparent'),
                    color: active ? accent : baseColor,
                    fontWeight: active || option ? 700 : 500,
                  }
                : {
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    background: active ? '#eef2f6' : 'transparent',
                    border: 'none',
                    borderLeft: '3px solid ' + (active ? accent : 'transparent'),
                    color: active ? accent : baseColor,
                    fontWeight: active || option ? 700 : 500,
                  };
              return (
                <button
                  key={label}
                  type="button"
                  className={isH ? 'menu-item-h' : 'menu-item-v'}
                  style={style}
                  onClick={() => onSelect(label)}
                  data-menu={label}
                >
                  {label}
                  {option && (
                    <span style={{ marginLeft: 4, fontSize: 8.5, fontWeight: 800, color: '#fff', background: active ? accent : OPTION, borderRadius: 4, padding: '1px 4px', verticalAlign: 'middle', letterSpacing: '.02em' }}>
                      OP
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
