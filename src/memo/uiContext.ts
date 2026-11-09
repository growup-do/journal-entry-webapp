// 確認メモの「画面の状態」
//   メモは画面キー（どの画面か）だけでなく、そのとき開いていたモーダル・選んでいたタブ・開いていたパネルも覚える。
//   ピンは、覚えた状態と今の画面が一致するときだけ表示する（モーダルを閉じたら、その中に置いたメモの番号は消える）。
//   一覧から番号を選んだときは、記録しておいた操作（タブを切り替えた／モーダルを開いた）を再生して、同じ状態にしてから表示する。
//
// 状態は DOM から読む：
//   モーダル … Modal 部品の [data-modal-root]（タイトルは [data-modal-title]）
//   タブ     … [role=tab][aria-selected=true]、[role=radio][aria-checked=true]、[data-tab][aria-selected=true]
//   パネル   … [data-memo-panel="名前"]（aria-hidden="true" のものは閉じている扱い）
// ピンの位置は、モーダルやパネルの中に置いたときは、その要素（[data-memo-anchor]）の左上からの相対位置で持つ。

export interface UiCtx {
  /** 開いているモーダルのタイトル（奥から手前の順） */
  modals: string[];
  /** 選ばれているタブ・切替ボタン */
  tabs: string[];
  /** 開いているパネル */
  panels: string[];
}

/** ピンを置いた要素（モーダル本体・固定パネル）と、その左上からの位置（CSS px） */
export interface MemoAnchor {
  name: string;
  dx: number;
  dy: number;
}

const CLICKABLE = 'button, [role="tab"], [role="radio"], [role="option"], a, tr, summary, label, [data-memo-click]';
const TAB_SEL = '[role="tab"][aria-selected="true"], [role="radio"][aria-checked="true"], [data-tab][aria-selected="true"]';

const txt = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
const visible = (el: Element) => el.getClientRects().length > 0;
const uniq = <T,>(a: T[]) => Array.from(new Set(a));
const inMemoLayer = (el: Element) => !!el.closest('[data-memo-layer]');

/** タブの識別子。件数バッジなどで表示文字が変わっても同じになるよう、data-tab／data-menu を優先する */
const tabKey = (el: Element) => el.getAttribute('data-tab') ?? el.getAttribute('data-menu') ?? txt(el);

export function readCtx(): UiCtx {
  const modals = Array.from(document.querySelectorAll('[data-modal-root]')).map((r) => {
    const t = txt(r.querySelector('[data-modal-title]'));
    return t || '(無題) ' + txt(r.querySelector('[data-memo-anchor]')).slice(0, 20);
  });
  const tabs = Array.from(document.querySelectorAll(TAB_SEL))
    .filter((el) => visible(el) && !inMemoLayer(el))
    .map(tabKey)
    .filter(Boolean);
  const panels = Array.from(document.querySelectorAll('[data-memo-panel]'))
    .filter((el) => el.getAttribute('aria-hidden') !== 'true')
    .map((el) => el.getAttribute('data-memo-panel') ?? '')
    .filter(Boolean);
  return { modals, tabs: uniq(tabs), panels: uniq(panels) };
}

/** 覚えた状態と今の状態が合っているか。モーダルは完全一致、タブ・パネルは「覚えたものが今も選ばれて（開いて）いる」こと */
export function ctxMatches(saved: UiCtx | undefined, now: UiCtx): boolean {
  if (!saved) return true; // 状態を持たない古いメモは、これまでどおり常に表示
  if ((saved.modals ?? []).join('\n') !== now.modals.join('\n')) return false;
  return (saved.tabs ?? []).every((t) => now.tabs.includes(t)) && (saved.panels ?? []).every((p) => now.panels.includes(p));
}

/** 状態を人が読める形に（「固定資産の登録」を開いた状態、など） */
export function describeCtx(c: UiCtx | undefined): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.modals?.length) parts.push(`「${c.modals[c.modals.length - 1]}」を開いた`);
  if (c.panels?.length) parts.push(`「${c.panels.join('」「')}」を開いた`);
  if (c.tabs?.length) parts.push(`タブ「${c.tabs.join('」「')}」を選んだ`);
  return parts.join('、');
}

// ---------------------------------------------------------------- ピンの位置（アンカー）

/** 画面全体の縮小率（「入力の変更」の表示フォント 小さ目＝0.8）。getBoundingClientRect は縮小後の値を返すので割り戻す */
const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-zoom')) || 1;

/** 名前のアンカー要素。モーダル（'modal'）は最前面のもの */
export function anchorEl(name: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-memo-anchor="${CSS.escape(name)}"]`)).filter(visible);
  return all[all.length - 1] ?? null;
}

/** クリック位置（clientX/Y）から、ピンを結び付けるアンカーと相対位置を求める。アンカーの中でなければ null */
export function anchorAt(clientX: number, clientY: number, ignore?: HTMLElement | null): MemoAnchor | null {
  const prev = ignore?.style.pointerEvents;
  if (ignore) ignore.style.pointerEvents = 'none';
  const hit = document.elementFromPoint(clientX, clientY);
  if (ignore) ignore.style.pointerEvents = prev ?? '';
  const el = hit?.closest<HTMLElement>('[data-memo-anchor]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const z = zoom();
  return { name: el.getAttribute('data-memo-anchor') ?? '', dx: (clientX - r.left) / z + el.scrollLeft, dy: (clientY - r.top) / z + el.scrollTop };
}

/** アンカー基準のピンのページ座標（CSS px）。アンカーが無ければ null（＝表示しない） */
export function anchorPos(a: MemoAnchor): { left: number; top: number } | null {
  const el = anchorEl(a.name);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const z = zoom();
  return { left: r.left / z + a.dx - el.scrollLeft + window.scrollX, top: r.top / z + a.dy - el.scrollTop + window.scrollY };
}

// ---------------------------------------------------------------- 操作の記録と再生

interface Step {
  /** 状態を変えた操作（クリックした要素の識別子）。キーボードなどで変わって分からなければ '' */
  key: string;
  /** その操作の後の状態（JSON） */
  after: string;
}

let history: Step[] = [];
let currentJson = '';
let pending: { key: string; at: number } | null = null;
let timer = 0;
let started = false;
const listeners = new Set<() => void>();

/** クリックした要素の識別子（data-menu／data-tab などの属性か、表示文字。同じものが複数あれば出現順） */
function baseKey(el: Element): string | null {
  const d = (el as HTMLElement).dataset;
  for (const k of ['menu', 'tab', 'kind', 'part', 'division', 'memoClick']) if (d[k]) return `${k}=${d[k]}`;
  const t = txt(el);
  if (t) return 'text=' + t;
  const a = el.getAttribute('aria-label') || el.getAttribute('title');
  return a ? 'label=' + a : null;
}
const candidates = () => Array.from(document.querySelectorAll(CLICKABLE)).filter((el) => visible(el) && !inMemoLayer(el));
function fullKey(el: Element): string | null {
  const b = baseKey(el);
  if (!b) return null;
  const same = candidates().filter((c) => baseKey(c) === b);
  const n = same.indexOf(el);
  return n > 0 ? `${b}#${n}` : b;
}
function findByKey(key: string): HTMLElement | null {
  const m = /^(.*?)(?:#(\d+))?$/.exec(key);
  const b = m?.[1] ?? key;
  const n = Number(m?.[2] ?? 0);
  const same = candidates().filter((c) => baseKey(c) === b);
  return (same[n] as HTMLElement | undefined) ?? null;
}

function check() {
  const json = JSON.stringify(readCtx());
  if (json === currentJson) {
    if (pending && Date.now() - pending.at > 1500) pending = null;
    return;
  }
  currentJson = json;
  const key = pending && Date.now() - pending.at <= 1500 ? pending.key : '';
  pending = null;
  // 前にあった状態に戻った（モーダルを閉じた、タブを戻した）なら、そこまで巻き戻す
  const i = history.findIndex((s) => s.after === json);
  if (i >= 0) history = history.slice(0, i + 1);
  else history.push({ key, after: json });
  listeners.forEach((f) => f());
}
function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(check, 80);
}

function start() {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      if (!t || inMemoLayer(t)) return;
      const el = t.closest(CLICKABLE);
      const key = el ? fullKey(el) : null;
      if (key) pending = { key, at: Date.now() };
      schedule();
    },
    true,
  );
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-checked', 'aria-hidden', 'data-memo-panel', 'data-modal-root'] });
  currentJson = JSON.stringify(readCtx());
  history = [{ key: '', after: currentJson }];
}

/** 画面が変わったときに呼ぶ。操作の記録をやり直す */
export function resetHistory() {
  start();
  window.setTimeout(() => {
    currentJson = JSON.stringify(readCtx());
    history = [{ key: '', after: currentJson }];
    listeners.forEach((f) => f());
  }, 120);
}

/** 状態が変わったら知らせる */
export function subscribeCtx(fn: () => void): () => void {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** いまの状態に至る操作の列（メモに保存する） */
export function currentPath(): string[] {
  start();
  return history.map((s) => s.key).filter(Boolean);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => T | null, ms: number): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(100);
  }
}

/** 覚えた状態を再現する。開いているモーダルを閉じてから、記録した操作を順にクリックする。最後に一致したかを返す */
export async function restoreCtx(saved: UiCtx | undefined, path: string[] | undefined): Promise<boolean> {
  if (ctxMatches(saved, readCtx())) return true;
  // 先に、いま開いているモーダルを手前から閉じる（× が無いものは閉じられないので中止）
  for (let guard = 0; guard < 6 && document.querySelector('[data-modal-root]'); guard++) {
    const roots = document.querySelectorAll('[data-modal-root]');
    const close = roots[roots.length - 1].querySelector<HTMLElement>('[data-modal-close]');
    if (!close) return false;
    close.click();
    await sleep(150);
  }
  for (const key of path ?? []) {
    const el = await waitFor(() => findByKey(key), 2500);
    if (!el) return false;
    el.click();
    await sleep(220);
  }
  await sleep(120);
  return ctxMatches(saved, readCtx());
}
