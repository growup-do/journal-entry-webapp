// 残高照合の月別データ（確認メモ #201）
//   残高照合の画面と、伝票入力の参照パネル「残高照合」で共通に使う。
//   月選択ボタン（4〜3・決）で選んだ月の月末時点のシステム残高と、その月に入力した通帳残高を返す。
//   システム残高は独自のサンプル（8月は data.ts の BALANCE_ACCOUNTS の値。ほかの月はそこから機械的に増減させたもの）。
//   通帳残高は月ごとに覚える（画面を開いている間だけ。プロトタイプのため保存はしない）。

import { useSyncExternalStore } from 'react';
import { BALANCE_ACCOUNTS } from '../data';
import { FISCAL_MONTHS } from './period';

/** 初期表示の月（サンプルの当月） */
export const BALANCE_DEFAULT_MONTH = '8';

const LAST_DAY: Record<string, number> = { '4': 30, '5': 31, '6': 30, '7': 31, '8': 31, '9': 30, '10': 31, '11': 30, '12': 31, '1': 31, '2': 28, '3': 31 };

/** 「令和8年 8月31日 時点」のような表示。決＝決算月（3月31日・決算整理後） */
export function balanceAsOf(month: string): string {
  if (month === '決') return '令和9年 3月31日 時点（決算月）';
  const n = parseInt(month, 10);
  return `令和${n >= 4 ? 8 : 9}年 ${n}月${LAST_DAY[month] ?? 30}日 時点`;
}
/** 帳票のファイル名などに使う短い表示（令和8年8月／令和9年決算月） */
export function balanceMonthLabel(month: string): string {
  if (month === '決') return '令和9年決算月';
  const n = parseInt(month, 10);
  return `令和${n >= 4 ? 8 : 9}年${n}月`;
}

/** 月ごとのシステム残高（サンプル）。BALANCE_ACCOUNTS と同じ並び */
export function systemBalances(month: string): number[] {
  const i = Math.max(0, FISCAL_MONTHS.indexOf(month));
  return BALANCE_ACCOUNTS.map((a, k) => {
    if (month === BALANCE_DEFAULT_MONTH || a.system === 0) return a.system;
    // 8月（位置 4）を基準に、月ごとに少しずつ増減させる
    const rate = 1 + (i - 4) * 0.035 + ((i + k) % 3 - 1) * 0.02;
    return Math.max(0, Math.round((a.system * rate) / 100) * 100);
  });
}

// ---- 通帳残高（月ごと） ----
const books: Record<string, number[]> = {};
const EMPTY: number[] = BALANCE_ACCOUNTS.map(() => 0);
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** その月に入力した通帳残高（未入力は 0） */
export function useBookBalances(month: string): number[] {
  return useSyncExternalStore(subscribe, () => books[month] ?? EMPTY);
}
export function setBookBalance(month: string, index: number, value: number) {
  books[month] = (books[month] ?? EMPTY).map((x, k) => (k === index ? value : x));
  listeners.forEach((fn) => fn());
}
