// 仕訳（サンプル25件）の共有ストア。仕訳一覧・元帳・照会で同じデータを参照し、
// 訂正／削除／証憑・チェック・付箋の切替／並べ替えを画面間で反映する。

import { useSyncExternalStore } from 'react';
import { JOURNAL_ROWS, type JournalRow } from '../data';

export type Fusen = '' | '赤' | '青' | '黄' | '緑';
export const FUSEN_COLORS: Record<Exclude<Fusen, ''>, string> = { 赤: '#c0392b', 青: '#2c5f9e', 黄: '#d9a400', 緑: '#1f7a52' };
export const FUSEN_CYCLE: Fusen[] = ['', '赤', '青', '黄', '緑'];

export interface Voucher extends JournalRow {
  id: number;
  check: boolean;
  fusen: Fusen;
  cheque?: string;
  spare1?: string;
  spare2?: string;
  /** 通常伝票／移行伝票 */
  migrated?: boolean;
  internal?: boolean;
}

let rows: Voucher[] = JOURNAL_ROWS.map((r, i) => ({ ...r, id: i + 1, check: false, fusen: '' }));
let nextId = rows.length + 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getVouchers() { return rows; }
export function useVouchers(): Voucher[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => rows, () => rows);
}
export function updateVoucher(id: number, patch: Partial<Voucher>) {
  rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
}
export function deleteVoucher(id: number) {
  rows = rows.filter((r) => r.id !== id);
  emit();
}
export function addVoucher(v: Omit<Voucher, 'id' | 'check' | 'fusen' | 'seq' | 'no'> & Partial<Pick<Voucher, 'seq' | 'no'>>) {
  const seq = v.seq ?? (rows.reduce((m, r) => Math.max(m, r.seq), 0) + 1);
  const row: Voucher = { seq, no: v.no ?? `${v.date.replace('/', '-')}`, check: false, fusen: '', ...v, id: nextId++ };
  rows = [...rows, row];
  emit();
  return row;
}
/** 同一日の中で表示順を上げ下げ（既存 F3／F4 入換） */
export function moveVoucher(id: number, dir: -1 | 1) {
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length || rows[i].date !== rows[j].date) return false;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  rows = next;
  emit();
  return true;
}
export function cycleFusen(id: number) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  updateVoucher(id, { fusen: FUSEN_CYCLE[(FUSEN_CYCLE.indexOf(r.fusen) + 1) % FUSEN_CYCLE.length] });
}
