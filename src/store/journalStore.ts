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
  /** 内部取引にした側（借方か貸方のどちらか一方。確認メモ #186） */
  internalSide?: '借方' | '貸方';
  /** 伝票の出どころ（インポート伝票＝別システム〔小口現金・預金出納・減価償却・AI自動仕訳・給与など〕から取り込んだ伝票／自動按分伝票）。旧 伝票メニューの一括削除の対象 */
  source?: 'インポート' | '自動按分';
  /** 取込元のシステム名、または按分テンプレート名 */
  from?: string;
  /** 取込・按分の実行単位（既存の GUID に相当）。一括削除はこの単位で年度内の全件を消す（確認メモ #56） */
  batch?: string;
  /** 伝票日付の月の扱い（確認メモ #184）。決算＝決算月（月欄に 99 と入力。日付は 3月として持つ）／予備＝翌年度の予備月（年を翌年にして月に 4〜6 と入力。日付は 4〜6月として持つ。年度更新時に翌年度のデータとして引き継ぐ） */
  term?: '決算' | '予備';
  /** 振替伝票形式：行の借方金額・貸方金額（確認メモ #192／#199。未指定は amount と同じ） */
  kariAmount?: number;
  kashiAmount?: number;
  /** 振替伝票形式・振替単一形式：貸借それぞれの税区分・税額（確認メモ #192／#199／#200。未指定は科目からの既定と自動計算） */
  kariTax?: string;
  kariTaxAmt?: number;
  kashiTax?: string;
  kashiTaxAmt?: number;
}

/** サンプル：別システムから取り込んだ体の伝票（預金出納＝水道料金・電話料金、減価償却＝リース代。月ごとに1回の取込）と、自動按分で登録した体の伝票（ガス代。月ごとに1回の実行） */
const sourceOf = (r: JournalRow): Pick<Voucher, 'source' | 'from' | 'batch'> => {
  const m = r.date.split('/')[0];
  if (/ガス代/.test(r.tekiyo)) return { source: '自動按分', from: 'ガス代（本部／保育園／一時預かり）', batch: `alloc-gas-${m}` };
  if (/水道料金|電話料金/.test(r.tekiyo) && /預金/.test(r.kashi)) return { source: 'インポート', from: '預金出納', batch: `imp-bank-${m}` };
  if (/リース代/.test(r.tekiyo)) return { source: 'インポート', from: '減価償却', batch: `imp-dep-${m}` };
  return {};
};
let rows: Voucher[] = JOURNAL_ROWS.map((r, i) => ({ ...r, id: i + 1, check: false, fusen: '', ...sourceOf(r) }));
let nextId = rows.length + 1;
const listeners = new Set<() => void>();
/** 予備月（翌年4〜6月）の伝票を除いた一覧。当年度の帳票（日記帳・元帳など）はこちらを使う */
let current: Voucher[] = rows;
const emit = () => {
  current = rows.some((r) => r.term === '予備') ? rows.filter((r) => r.term !== '予備') : rows;
  listeners.forEach((l) => l());
};

/** 予備月の伝票も含めた全件 */
export function getVouchers() { return rows; }
/** withSpare＝予備月（翌年4〜6月）の伝票も含める。伝票入力の画面だけ true にする（当年度の帳票に翌年度の伝票を混ぜない） */
export function useVouchers(withSpare = false): Voucher[] {
  const snap = () => (withSpare ? rows : current);
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, snap, snap);
}
export function updateVoucher(id: number, patch: Partial<Voucher>) {
  rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
}
export function deleteVoucher(id: number) {
  rows = rows.filter((r) => r.id !== id);
  emit();
}
/** まとめて削除（インポート伝票の一括削除など） */
export function deleteVouchers(ids: number[]) {
  const set = new Set(ids);
  rows = rows.filter((r) => !set.has(r.id));
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
/** 同じ伝票（伝票No・年月日が同じ）の行 */
const sameVoucherRows = (id: number) => { const r = rows.find((x) => x.id === id); return r ? rows.filter((x) => x.no === r.no && x.date === r.date) : []; };
/** 証憑・チェック・付箋は伝票1枚につき1つ（10/16 鈴木さん決定。確認メモ #47）。同じ伝票の全行にまとめて反映する */
export function setVoucherFlags(id: number, patch: Partial<Pick<Voucher, 'check' | 'fusen' | 'shohyo'>>) {
  const ids = new Set(sameVoucherRows(id).map((x) => x.id));
  if (ids.size === 0) return;
  rows = rows.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r));
  emit();
}
export function cycleFusen(id: number) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  setVoucherFlags(id, { fusen: FUSEN_CYCLE[(FUSEN_CYCLE.indexOf(r.fusen) + 1) % FUSEN_CYCLE.length] });
}
