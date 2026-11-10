// お知らせの既読状態（確認メモ #151）。
//   お知らせはホームに常時表示せず、ヘッダーのベルから開く。未読があるあいだ、ベルに件数のバッジを出す。
//   既読はブラウザーごとに保存する（本番では利用者ごとにサーバーで持つ想定）。

import { useSyncExternalStore } from 'react';
import { HOME_NOTICES } from '../data';

const KEY = 'proto-notice-read-v1';

/** お知らせ 1 件を見分けるキー（日付＋件名） */
export const noticeId = (n: { date: string; title: string }) => n.date + '|' + n.title;

function load(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

let read: string[] = load();
const subs = new Set<() => void>();

function save(next: string[]) {
  read = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境（プライベートウィンドウなど）では、開いているあいだだけ覚えておく
  }
  subs.forEach((f) => f());
}

/** 1 件を既読にする */
export function markNoticeRead(id: string) {
  if (!read.includes(id)) save([...read, id]);
}

/** すべて既読にする */
export function markAllNoticesRead() {
  save(HOME_NOTICES.map(noticeId));
}

/** 既読にしたお知らせのキー一覧 */
export function useNoticeRead(): string[] {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => read,
  );
}
