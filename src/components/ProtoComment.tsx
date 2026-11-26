// プロトタイプのコメント（実際のシステムには出ない）
//   画面の機能ではなく、プロトタイプで動きを確かめるための説明と切り替えを置く。付箋のような見た目で、画面の部品と見分けられるようにする。

import type { ReactNode } from 'react';

export function ProtoComment({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span data-proto-comment style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '3px 10px', border: '1px dashed #d9b44a', borderRadius: 8, background: '#fffbe8', color: '#6b5310', fontSize: 12, lineHeight: 1.6, ...style }}>
      <span style={{ fontWeight: 700, padding: '0 6px', borderRadius: 6, background: '#f4e2a1', color: '#6b5310', whiteSpace: 'nowrap' }}>コメント</span>
      {children}
    </span>
  );
}
