// 階層つき科目行の集計（上位行 = 直下〜末端の合計）

import type { HierRow } from '../data';

export interface HierValue extends HierRow {
  values: number[];
  hasChildren: boolean;
}

/** 末端の値を上位に集計し、全行に values を付けて返す */
export function rollup(rows: HierRow[], width: number): HierValue[] {
  const out: HierValue[] = rows.map((r) => ({ ...r, values: r.v ? [...r.v] : new Array(width).fill(0), hasChildren: false }));
  for (let i = 0; i < out.length; i++) {
    if (rows[i].v) continue;
    const sum = new Array(width).fill(0);
    let has = false;
    for (let j = i + 1; j < out.length && rows[j].level > rows[i].level; j++) {
      if (rows[j].v) {
        has = true;
        rows[j].v!.forEach((x, k) => (sum[k] += x));
      }
    }
    out[i].values = sum;
    out[i].hasChildren = has;
  }
  return out;
}

/** 最上位行の合計 */
export function grandTotal(rows: HierValue[], width: number): number[] {
  const t = new Array(width).fill(0);
  rows.filter((r) => r.level === 0).forEach((r) => r.values.forEach((x, k) => (t[k] += x)));
  return t;
}

/** 表示する階層の深さでフィルタ（大区分=0 … 細々区分=3） */
export const byDepth = (rows: HierValue[], depth: number) => rows.filter((r) => r.level <= depth);

/** 決定的な疑似乱数（推移グラフ用のサンプル値） */
export function seededSeries(key: string, months: number, base: number): number[] {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < months; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    out.push(Math.round(base * (0.6 + ((h >>> 8) % 1000) / 1250) / 100) * 100);
  }
  return out;
}
