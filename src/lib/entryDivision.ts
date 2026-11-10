// 伝票入力で使う「入力区分」の決め方（確認メモ #157／#181／#182／#183）。
//   入力区分で起動中 … その区分だけ（固定表示）
//   親区分で起動中   … 起動中の親区分に属する入力区分から選んで登録できる（入力権限があるとき）
//   合算区分で起動中 … 登録できない（内訳の確認用）
// 日記帳・元帳など、伝票入力以外の画面の権限（session.ts の canEdit）は変えない。

import { useSyncExternalStore } from 'react';
import { divisionLabel, editBlockReason, flattenDivisions, startKindOf, useSession, type Session } from '../store/session';

/** 起動中の区分で、伝票を登録できる入力区分の一覧（「コード 名称」の形） */
export function entryDivisionsOf(s: Session): string[] {
  const kind = startKindOf(s);
  if (kind === '入力区分') return [s.division];
  if (kind !== '親区分') return [];
  const hit = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division);
  if (!hit) return [];
  return flattenDivisions(hit.node).filter((x) => x.node.entry && x.node.use !== false).map((x) => divisionLabel(x.node));
}
/** 伝票入力の画面で、登録・訂正・削除ができるか（親区分で起動中でも、配下に入力区分があればできる） */
export const canEnterVoucher = (s: Session) => s.role === '入力可' && entryDivisionsOf(s).length > 0;
/** 伝票入力の画面で操作できない理由（できるときは空文字） */
export const entryBlockReason = (s: Session) => (canEnterVoucher(s) ? '' : s.role === '入力可' && startKindOf(s) === '親区分' ? 'この親区分には、伝票を登録できる入力区分がありません' : editBlockReason(s));

/* 親区分で起動中に選んだ入力区分（起動区分ごとに覚える。4形式で共有し、形式を切り替えても引き継ぐ） */
const pickedDivision = new Map<string, string>();
const divisionListeners = new Set<() => void>();
let divisionTick = 0;

export interface EntryDivisionCtl {
  /** いま伝票を登録する入力区分 */
  division: string;
  setDivision: (d: string) => void;
  /** 選べる入力区分 */
  options: string[];
  /** 選べない（入力区分で起動中、または選べる区分が 1 つ以下）。固定表示にする */
  fixed: boolean;
}
export function useEntryDivision(): EntryDivisionCtl {
  const s = useSession();
  useSyncExternalStore((l) => { divisionListeners.add(l); return () => { divisionListeners.delete(l); }; }, () => divisionTick, () => divisionTick);
  const options = entryDivisionsOf(s);
  const picked = pickedDivision.get(s.division);
  const division = picked && options.includes(picked) ? picked : options[0] ?? s.division;
  const setDivision = (d: string) => { pickedDivision.set(s.division, d); divisionTick += 1; divisionListeners.forEach((l) => l()); };
  return { division, setDivision, options, fixed: options.length <= 1 };
}
