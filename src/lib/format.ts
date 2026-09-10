// 共通ヘルパー（金額整形・プレースホルダ・補助候補・月抽出）

import { ACCOUNTS, SERVICES, SUMMARIES, VENDORS } from '../data';
import { accountMatches } from './accounts';
import type { AssistGroup, AssistType, JournalEntry, MonthFilter } from '../types';
import type { CSSProperties } from 'react';

/** 数字のみ抽出し3桁区切り表示。数値が無ければ空文字。 */
export function fmtAmount(v: string): string {
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('ja-JP');
}

/** フィールド表示値（値が空ならプレースホルダ色）。 */
export function mkField(v: string, placeholder: string): { text: string; style: CSSProperties } {
  return {
    text: v || placeholder,
    style: {
      color: v ? '#22303c' : '#9aa5b1',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
    },
  };
}

/** 補助ドロップダウンの候補グループを組み立てる（部分一致・残候補のあるグループのみ）。 */
export function buildGroups(type: AssistType, query: string): AssistGroup[] {
  const q = (query || '').trim();
  const f = (arr: string[]) => (q ? arr.filter((x) => x.indexOf(q) >= 0) : arr);
  if (type === 'account') {
    // 科目名のほか、コード（数字）・フリガナ（カナ／かな）でも絞り込める
    return ACCOUNTS.map((g) => ({
      group: g.group,
      hasHeader: true,
      items: g.items.filter((v) => accountMatches(v, q)).map((v) => ({ value: v })),
    })).filter((g) => g.items.length > 0);
  }
  if (type === 'service') return [{ group: '', hasHeader: false, items: f(SERVICES).map((v) => ({ value: v })) }];
  if (type === 'vendor') return [{ group: '', hasHeader: false, items: f(VENDORS).map((v) => ({ value: v })) }];
  if (type === 'summary')
    return [{ group: 'よく使う摘要', hasHeader: true, items: f(SUMMARIES).map((v) => ({ value: v })) }];
  return [];
}

/** 仕訳帳に存在する月を重複除去し数値昇順で返す。 */
export function monthsOf(journal: JournalEntry[]): string[] {
  return [...new Set(journal.map((e) => String(e.date).split('/')[0]))].sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10),
  );
}

/** 月フィルターで行を絞り込む。 */
export function applyMonth(list: JournalEntry[], monthFilter: MonthFilter): JournalEntry[] {
  if (monthFilter == null) return list;
  return list.filter((e) => String(e.date).split('/')[0] === monthFilter);
}

/** 16進アクセント色 → rgba 文字列（focusリング等）。 */
export function rgba(hex: string, a: number): string {
  const h = (hex || '#2c5f9e').replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
