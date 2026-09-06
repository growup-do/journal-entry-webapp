// 補助ドロップダウンの開閉状態（複数行フォーム用）
// useEntryForm の assist 部分だけを切り出したもの。key で「どのフィールドが開いているか」を識別する。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildGroups } from '../lib/format';
import type { AssistType } from '../types';

interface St {
  key: string;
  type: AssistType | '';
  query: string;
}
const CLOSED: St = { key: '', type: '', query: '' };

export function useAssist() {
  const [st, setSt] = useState<St>(CLOSED);

  // ドロップダウン外の mousedown（capture）で閉じる
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (st.key && !(t && t.closest('[data-assist]'))) setSt(CLOSED);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [st.key]);

  const open = useCallback((key: string, type: AssistType) => {
    setSt({ key, type, query: '' });
    setTimeout(() => document.getElementById('assist-search')?.focus(), 30);
  }, []);
  const close = useCallback(() => setSt(CLOSED), []);
  const setQuery = useCallback((query: string) => setSt((s) => ({ ...s, query })), []);
  const groups = useMemo(() => (st.key && st.type ? buildGroups(st.type, st.query) : []), [st]);
  const empty = !!st.key && groups.reduce((n, g) => n + g.items.length, 0) === 0;
  const isOpen = useCallback((k: string) => st.key === k, [st.key]);

  return { key: st.key, query: st.query, groups, empty, isOpen, open, close, setQuery };
}
