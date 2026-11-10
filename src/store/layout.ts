// プロトタイプ確認用：画面レイアウトの切替（新＝左メニュー・パネルは重ねて表示／旧＝上部メニューバー・パネルは本文を押し出す）。
//   旧レイアウトは、11/10 より前に置かれた確認メモの位置を確かめるために残している（製品の機能ではない）。
//   選んだレイアウトは localStorage に覚える。

import { useSyncExternalStore } from 'react';

export type LayoutMode = 'new' | 'classic';
const KEY = 'proto-layout';
const listeners = new Set<() => void>();
const read = (): LayoutMode => { try { return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'new'; } catch { return 'new'; } };
let mode: LayoutMode = read();

export const getLayoutMode = () => mode;
export function setLayoutMode(m: LayoutMode) {
  mode = m;
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => mode, () => mode);
}
