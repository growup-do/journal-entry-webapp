// 補助ドロップダウン（AssistPanel）
// 参考画像準拠のミニマルな検索＋分類ドロップダウン。
// フィールド直下に絶対配置され、親の [data-assist] 要素内に置く前提。
// 選択は mousedown で確定（外側クリックの閉じる処理より先に発火させるため）。

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AssistGroup } from '../types';

interface Props {
  groups: AssistGroup[];
  query: string;
  empty: boolean;
  onInput: (value: string) => void;
  onPick: (value: string) => void;
  /** フィールド直下への絶対配置スタイル（呼び出し側で位置・幅を指定） */
  style?: CSSProperties;
}

export function AssistPanel({ groups, query, empty, onInput, onPick, style }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  // 開いたら検索入力に自動フォーカス
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #d3dce4',
        borderRadius: 11,
        boxShadow: '0 14px 36px rgba(24,42,62,.18)',
        overflow: 'hidden',
        fontFamily: "'Noto Sans JP', sans-serif",
        ...style,
      }}
    >
      <div style={{ padding: 9, borderBottom: '1px solid #eef2f5', background: '#fafcfd' }}>
        <input
          id="assist-search"
          ref={searchRef}
          className="assist-search"
          value={query}
          onInput={(e) => onInput((e.target as HTMLInputElement).value)}
          onChange={(e) => onInput(e.target.value)}
          placeholder="入力して絞り込み"
          autoComplete="off"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 11px',
            border: '1px solid #d3dce4',
            borderRadius: 8,
            fontSize: 13.5,
            outline: 'none',
            fontFamily: 'inherit',
            background: '#ffffff',
            color: '#22303c',
          }}
        />
      </div>
      <div style={{ maxHeight: 232, overflowY: 'auto', padding: '4px 0' }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.hasHeader && (
              <div
                style={{
                  padding: '9px 13px 3px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#93a0ad',
                  letterSpacing: '.05em',
                }}
              >
                {g.group}
              </div>
            )}
            {g.items.map((it) => (
              <div
                key={it.value}
                className="assist-item"
                // 外側クリックの閉じる処理（mousedown capture）より先に確定させるため mousedown を使用
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(it.value);
                }}
                style={{
                  padding: '8px 15px',
                  fontSize: 14,
                  color: '#283641',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                }}
              >
                {it.value}
              </div>
            ))}
          </div>
        ))}
        {empty && (
          <div style={{ padding: '16px 15px', fontSize: 13, color: '#9aa5b1', textAlign: 'center' }}>
            該当する候補がありません
          </div>
        )}
      </div>
    </div>
  );
}
