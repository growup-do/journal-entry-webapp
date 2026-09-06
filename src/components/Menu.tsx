// メニュー（横=フォーム型ナビ / 縦=スプレッドシート型サイドバー）
// テキストのみ・グループ区切りあり。アクティブ項目のみアクセント色。

import type { CSSProperties } from 'react';
import { ACTIVE_MENU, MENU } from '../data';

interface Props {
  orientation: 'h' | 'v';
  accent: string;
}

export function Menu({ orientation, accent }: Props) {
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
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              paddingTop: gi === 0 ? 0 : 8,
              marginTop: gi === 0 ? 0 : 8,
              borderTop: gi === 0 ? 'none' : '1px solid #eef2f5',
            };
        return (
          <div key={gi} style={groupStyle}>
            {group.map((label) => {
              const active = label === ACTIVE_MENU;
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
                    color: active ? accent : '#5b6773',
                    fontWeight: active ? 700 : 500,
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
                    color: active ? accent : '#5b6773',
                    fontWeight: active ? 700 : 500,
                  };
              return (
                <button
                  key={label}
                  type="button"
                  className={isH ? 'menu-item-h' : 'menu-item-v'}
                  style={style}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
