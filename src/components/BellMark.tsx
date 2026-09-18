// 「円に鈴」マーク：既存システムとの突合で挙動を推定した箇所（社内・鈴木宛の要確認箇所）に置く目印。
//   文字は持たず、マークだけで示す。内容は _社内資料/要確認_鈴木さん向け_*.md を参照。

import type { CSSProperties } from 'react';

export function BellMark({ note, style }: { note?: string; style?: CSSProperties }) {
  return (
    <span
      data-bell-mark
      title={note ?? '要確認（既存システムとの突合）'}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#fff7e0', border: '1.5px solid #d9a51b', color: '#a5780a', flex: 'none', verticalAlign: 'middle', cursor: 'help', ...style }}
    >
      <svg width="10" height="11" viewBox="0 0 20 22" fill="none" aria-hidden>
        <path d="M10 2.2a1.3 1.3 0 0 1 1.3 1.3v.6A5.6 5.6 0 0 1 15.6 9.5v4.3l1.9 2.6a.8.8 0 0 1-.65 1.3H3.15a.8.8 0 0 1-.65-1.3l1.9-2.6V9.5A5.6 5.6 0 0 1 8.7 4.1v-.6A1.3 1.3 0 0 1 10 2.2Z" fill="currentColor" />
        <path d="M7.6 19.2a2.4 2.4 0 0 0 4.8 0H7.6Z" fill="currentColor" />
      </svg>
    </span>
  );
}
