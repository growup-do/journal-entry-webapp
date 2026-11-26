// 確認メモのボタン（memo.action）から画面へ合図を送る仕組み。
//   メモに { label, event } を持たせると、メモを開いたときにボタンが出る。押すと event の名前で合図を送り、
//   その名前を useMemoAction で受け取っている画面が動く（例：貸借が合わないときの警告画面を見本の金額で出す。確認メモ #384〜#386）。

import { useEffect, useRef } from 'react';

const EVENT = 'proto-memo-action';

export interface MemoAction {
  /** ボタンの文字 */
  label: string;
  /** 画面に送る合図の名前 */
  event: string;
}

export function fireMemoAction(name: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: name }));
}

/** 確認メモのボタンからの合図を受け取る */
export function useMemoAction(name: string, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail === name) ref.current(); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [name]);
}
