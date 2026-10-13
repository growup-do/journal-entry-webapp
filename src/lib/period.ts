// 集計期間（会計年度の月タブ・月の範囲・日付の範囲）の共通ヘルパー（確認メモ #57／#58）
//   日付は 'M/D'（例 '4/15'）。会計年度は 4月始まり（4,5,…,12,1,2,3）。

export const FISCAL_MONTHS = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3', '決'];

/** 期間（両端を含む）。from／to は 'M/D' */
export interface Period { from: string; to: string }

const DAYS: Record<string, number> = { '4': 30, '5': 31, '6': 30, '7': 31, '8': 31, '9': 30, '10': 31, '11': 30, '12': 31, '1': 31, '2': 28, '3': 31 };
export const lastDayOf = (m: string) => DAYS[m] ?? 31;

/** 会計年度内の並び順（4/1 → 0）。月タブ・範囲の比較に使う */
export function ordinal(date: string): number {
  const [m, d] = date.split('/');
  const mi = FISCAL_MONTHS.indexOf(String(parseInt(m, 10)));
  return (mi < 0 ? 0 : mi) * 31 + (parseInt(d, 10) || 1);
}
export const inPeriod = (date: string, p: Period) => ordinal(date) >= ordinal(p.from) && ordinal(date) <= ordinal(p.to);

/** 1か月（月初〜月末） */
export const monthPeriod = (m: string): Period => ({ from: `${m}/1`, to: `${m}/${lastDayOf(m)}` });
/** 月の範囲（順不同で渡せる） */
export function monthRange(a: string, b: string): Period {
  const [x, y] = FISCAL_MONTHS.indexOf(a) <= FISCAL_MONTHS.indexOf(b) ? [a, b] : [b, a];
  return { from: `${x}/1`, to: `${y}/${lastDayOf(y)}` };
}
/** 期間に含まれる月（タブの帯表示用） */
export const monthsIn = (p: Period) => FISCAL_MONTHS.filter((m) => m !== '決' && ordinal(`${m}/1`) <= ordinal(p.to) && ordinal(`${m}/${lastDayOf(m)}`) >= ordinal(p.from));
/** 'M/D'／'M月D日' を 'M/D' に整える。読めなければ null */
export function parseMD(text: string): string | null {
  const t = text.trim().normalize('NFKC').replace(/月/, '/').replace(/日/, '');
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (!m) return null;
  const mm = String(parseInt(m[1], 10)), dd = parseInt(m[2], 10);
  if (!FISCAL_MONTHS.includes(mm) || mm === '決' || dd < 1 || dd > lastDayOf(mm)) return null;
  return `${mm}/${dd}`;
}
/** 表示用：令和8年 4月15日 〜 6月30日（月末は「末日」） */
export function periodLabel(p: Period, year = '令和8年'): string {
  const f = (d: string) => { const [m, dd] = d.split('/'); return `${m}月${parseInt(dd, 10) >= lastDayOf(m) ? '末' : dd}日`; };
  return `${year} ${f(p.from)} 〜 ${f(p.to)}`;
}
/** ファイル名などに使う短い表記：4月15日-6月30日 */
export const periodShort = (p: Period) => `${p.from.replace('/', '月')}日-${p.to.replace('/', '月')}日`;
