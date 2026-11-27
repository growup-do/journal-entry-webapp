// 一覧表の共通部品（確認メモ #476・#477）
//  ・ListScroll：一覧表の枠。枠の中ではスクロールせず、ウィンドウのスクロールで一覧を送る。
//    見出し（thead）はアプリの帯のすぐ下に固定して、いつも見えるようにする（styles.css の [data-list-scroll]）。
//    表が枠より広いときだけ、横スクロールにする（このときは見出しの固定はかからない）。
//  ・usePager／Pager：一覧の上と下に置くページ送り。
//  ・BackToTop：下へスクロールしたときに出す「トップへ戻る」ボタン。
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';

export function ListScroll({ children, style, innerRef, ...rest }: { children: ReactNode; style?: CSSProperties; innerRef?: Ref<HTMLDivElement>; [k: `data-${string}`]: unknown }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setWide(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    return () => ro.disconnect();
  }, []);
  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el;
    if (typeof innerRef === 'function') innerRef(el);
    else if (innerRef) (innerRef as { current: HTMLDivElement | null }).current = el;
  };
  return (
    <div ref={setRef} data-list-scroll data-list-wide={wide || undefined} {...rest} style={{ overflowX: wide ? 'auto' : 'visible', ...style }}>
      {children}
    </div>
  );
}

/** 一画面に出す件数の選択肢 */
const SIZES = [20, 50, 100];

export type PagerState = { page: number; size: number; total: number; setPage: (p: number) => void; setSize: (n: number) => void };

/** 一覧のページ送り。resetKey（絞り込みの条件など）が変わったら 1 ページ目に戻る */
export function usePager<T>(rows: T[], resetKey?: unknown): { rows: T[]; pager: PagerState; offset: number } {
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(0);
  const total = rows.length;
  const last = Math.max(0, Math.ceil(total / size) - 1);
  const p = Math.min(page, last);
  const key = JSON.stringify(resetKey ?? null);
  const prevKey = useRef(key);
  useEffect(() => { if (prevKey.current !== key) { prevKey.current = key; setPage(0); } }, [key]);
  return {
    rows: rows.slice(p * size, (p + 1) * size),
    offset: p * size,
    pager: { page: p, size, total, setPage, setSize: (n) => { setSize(n); setPage(0); } },
  };
}

const pbtn = (on: boolean, accent: string): CSSProperties => ({
  minWidth: 30, height: 28, padding: '0 8px', border: '1px solid ' + (on ? accent : '#cfd8e0'), borderRadius: 6,
  background: on ? accent : '#fff', color: on ? '#fff' : '#3d4a56', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
  cursor: on ? 'default' : 'pointer', fontVariantNumeric: 'tabular-nums',
});

/** 表示するページ番号（多いときは先頭・末尾・前後だけ出し、間を「…」にする） */
function pageList(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const s = new Set([0, count - 1, page - 1, page, page + 1].filter((n) => n >= 0 && n < count));
  const out: (number | '…')[] = [];
  let prev = -1;
  for (const n of Array.from(s).sort((a, b) => a - b)) { if (n - prev > 1) out.push('…'); out.push(n); prev = n; }
  return out;
}

/** ページ送り。一覧の上（position="top"）と下（position="bottom"）に置く。下で押したときは一覧の先頭が見える位置まで戻す */
export function Pager({ pager, accent, position, unit = '件' }: { pager: PagerState; accent: string; position: 'top' | 'bottom'; unit?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { page, size, total } = pager;
  const count = Math.max(1, Math.ceil(total / size));
  const from = total ? page * size + 1 : 0;
  const to = Math.min(total, (page + 1) * size);
  const go = (n: number) => {
    if (n < 0 || n >= count || n === page) return;
    pager.setPage(n);
    if (position === 'bottom') {
      // 下のページ送りで押したとき：上のページ送りが見える位置へ
      const list = ref.current?.parentElement?.querySelector('[data-pager="top"]') as HTMLElement | null;
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-top-h')) || 52;
      if (list) window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - top - 8 });
    }
  };
  const arrow = (label: string, n: number, title: string) => (
    <button type="button" onClick={() => go(n)} disabled={n < 0 || n >= count || n === page} title={title} style={{ ...pbtn(false, accent), opacity: n < 0 || n >= count || n === page ? 0.4 : 1, cursor: n < 0 || n >= count || n === page ? 'default' : 'pointer' }}>{label}</button>
  );
  return (
    <div ref={ref} data-pager={position} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: position === 'top' ? '8px 22px' : '10px 22px 12px', borderTop: position === 'bottom' ? '1px solid #eef2f5' : undefined, fontSize: 13, color: '#5b6773' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>全 <b style={{ color: '#22303c' }}>{total.toLocaleString('ja-JP')}</b> {unit}中 {from.toLocaleString('ja-JP')}〜{to.toLocaleString('ja-JP')} {unit}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
        {arrow('«', 0, '最初のページ')}
        {arrow('‹', page - 1, '前のページ')}
        {pageList(page, count).map((n, i) => n === '…'
          ? <span key={'g' + i} style={{ padding: '0 2px', color: '#9aa5b1' }}>…</span>
          : <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => go(n)} style={pbtn(n === page, accent)}>{n + 1}</button>)}
        {arrow('›', page + 1, '次のページ')}
        {arrow('»', count - 1, '最後のページ')}
      </span>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        表示件数
        <select value={size} onChange={(e) => pager.setSize(Number(e.target.value))} style={{ height: 28, padding: '0 6px', border: '1px solid #cfd8e0', borderRadius: 6, background: '#fff', fontSize: 13, fontFamily: 'inherit' }}>
          {SIZES.map((n) => <option key={n} value={n}>{n} {unit}</option>)}
        </select>
      </label>
    </div>
  );
}

/** 下へスクロールしたときに出す「トップへ戻る」ボタン */
export function BackToTop({ accent }: { accent: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 300);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (!show) return null;
  return (
    <button type="button" data-back-to-top onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="ページの先頭へ戻ります" aria-label="トップへ戻る"
      style={{ position: 'fixed', right: 24, bottom: 84, zIndex: 150, width: 44, height: 44, borderRadius: '50%', border: '1px solid ' + accent, background: '#fff', color: accent, fontSize: 20, fontWeight: 800, lineHeight: 1, cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,50,70,.18)', fontFamily: 'inherit' }}>
      ↑
    </button>
  );
}
