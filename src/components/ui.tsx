// 追加画面で共通に使う小さな部品（ボタン／入力／ラベル／タブ／トグル／カード）

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UNSAVED_BG } from '../store/unsaved';
import { BackButton, useBackClaim, useBackNav } from './BackNav';

export const btn = (color = '#5b6773', solid = false, small = false): CSSProperties => ({
  padding: small ? '6px 12px' : '10px 18px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color,
  fontSize: small ? 12 : 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
});
export const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
export const numInput: CSSProperties = { ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
export const lbl: CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: '#8290a0', marginBottom: 7 };
export const card: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 12, overflow: 'hidden', background: '#fff' };
export const cardHead: CSSProperties = { padding: '12px 16px', background: '#f6f8fa', fontSize: 14, fontWeight: 700, borderBottom: '1px solid #eef2f5', display: 'flex', alignItems: 'center', gap: 8 };
export const yen = (n: number) => (n < 0 ? '△' + Math.abs(n).toLocaleString('ja-JP') : n.toLocaleString('ja-JP'));
export const toInt = (v: string) => parseInt(v.replace(/[^0-9-]/g, ''), 10) || 0;

/** タブの帯。薄い緑の背景で、ここがタブだと分かるようにする */
export const TAB_BAR: CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 2, padding: '6px 22px 0', borderBottom: '1px solid #d5e6dc', background: '#eef6f1', flexWrap: 'wrap' };
/** タブ 1 つ分の見た目。選んだタブは文字色で示し、下線は TabStrip が描く。className は "tab-btn" を付ける */
export function tabBtn(on: boolean, accent: string): CSSProperties {
  return { padding: '9px 14px 10px', border: 'none', background: 'transparent', color: on ? accent : '#4f5d68', fontSize: 14, fontWeight: on ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' };
}

/** タブの帯。中の role="tab" のボタンに下線を 1 本だけ引き、マウスを載せた（キーボードで選んだ）タブへすべるように動かす。
 *  帯から外れると、選んでいるタブ（aria-selected）の下へ戻る */
export function TabStrip({ accent, style, children, ...rest }: { accent: string; style?: CSSProperties; children: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'>) {
  const ref = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);
  const [ready, setReady] = useState(false);
  // 位置が変わったときだけ state を変える（毎回の描画のあとに呼ぶので、同じ値で set すると描き直しが止まらなくなる）
  const inkRef = useRef<{ left: number; width: number } | null>(null);
  const place = (el: Element | null) => {
    const t = el as HTMLElement | null;
    const next = t ? { left: t.offsetLeft, width: t.offsetWidth } : null;
    const cur = inkRef.current;
    if (cur === next || (cur && next && cur.left === next.left && cur.width === next.width)) return;
    inkRef.current = next;
    setInk(next);
  };
  const toSelected = () => place(ref.current?.querySelector('[role="tab"][aria-selected="true"]') ?? null);
  // 選んでいるタブが変わったとき・描き直したときは、選んでいるタブの下へ
  useLayoutEffect(() => { if (!hovering.current) toSelected(); });
  // 最初の位置へは動かさずに置き、そのあとから動きを付ける
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (!hovering.current) toSelected(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tabOf = (e: { target: EventTarget }) => (e.target as HTMLElement).closest?.('[role="tab"]') ?? null;
  return (
    <div
      ref={ref}
      role="tablist"
      {...rest}
      onMouseOver={(e) => { const t = tabOf(e); if (t && ref.current?.contains(t)) { hovering.current = true; place(t); } }}
      onMouseLeave={() => { hovering.current = false; toSelected(); }}
      onFocus={(e) => { const t = tabOf(e); if (t) place(t); }}
      onBlur={() => { if (!hovering.current) toSelected(); }}
      style={{ ...TAB_BAR, position: 'relative', ...style }}
    >
      {children}
      <span aria-hidden="true" className="tab-ink" style={{ position: 'absolute', bottom: -1, left: ink?.left ?? 0, width: ink?.width ?? 0, height: 2, borderRadius: 2, background: accent, opacity: ink ? 1 : 0, pointerEvents: 'none', transition: ready ? 'left .32s cubic-bezier(0.33, 0, 0.15, 1), width .32s cubic-bezier(0.33, 0, 0.15, 1), background-color .2s' : 'none' }} />
    </div>
  );
}

export function Tabs({ items, current, onChange, accent, marks }: { items: string[]; current: string; onChange: (v: string) => void; accent: string; small?: boolean; /** 保存されていない変更があるタブ（名称の右に印を付ける。確認メモ #225） */ marks?: string[] }) {
  return (
    <TabStrip accent={accent}>
      {items.map((t) => {
        const on = t === current;
        return (
          <button key={t} type="button" role="tab" aria-selected={on} className="tab tab-btn" data-tab={t} onClick={() => onChange(t)} style={tabBtn(on, accent)}>
            {t}
            {marks?.includes(t) && <span data-tab-unsaved title="保存されていない変更があります" aria-label="保存されていない変更があります" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#c2410c', marginLeft: 7, verticalAlign: 'middle' }} />}
          </button>
        );
      })}
    </TabStrip>
  );
}

export function Toggle({ on, onChange, accent = '#1f7a52', label }: { on: boolean; onChange: (v: boolean) => void; accent?: string; label?: ReactNode }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
      <span role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ display: 'inline-block', width: 36, height: 20, borderRadius: 10, background: on ? accent : '#cfd8e0', position: 'relative', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
      {label && <span onClick={() => onChange(!on)}>{label}</span>}
    </label>
  );
}

export function Field({ label, children, span }: { label: string; children: ReactNode; span?: number }) {
  return <div style={{ gridColumn: span ? `span ${span}` : undefined }}><span style={lbl}>{label}</span>{children}</div>;
}

export function Steps({ steps, current, accent }: { steps: string[]; current: number; accent: string }) {
  return (
    <div style={{ display: 'flex', padding: '16px 22px 0' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: i <= current ? accent : '#e2e8ee', color: i <= current ? '#fff' : '#8290a0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
          <span style={{ fontSize: 14, fontWeight: i === current ? 700 : 500, color: i === current ? '#22303c' : '#7a8794', whiteSpace: 'nowrap' }}>{s}</span>
          {i < steps.length - 1 && <span style={{ flex: 1, height: 2, background: i < current ? accent : '#e2e8ee', margin: '0 10px' }} />}
        </div>
      ))}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const c = tone === 'warn' ? { bg: '#fff7e6', bd: '#f3d9b0', fg: '#8a5a00' } : tone === 'ok' ? { bg: '#eaf5ef', bd: '#bfe0cf', fg: '#1f7a52' } : { bg: '#f3f6f9', bd: '#dde4ea', fg: '#48565f' };
  return <div style={{ padding: '12px 14px', background: c.bg, border: '1px solid ' + c.bd, borderRadius: 10, fontSize: 14, color: c.fg, lineHeight: 1.8 }}>{children}</div>;
}

/** 設定系画面の共通シェル（SettingsPages の Shell と同じ見た目）。
 *  unsaved … 変更したのに保存していないあいだ true にすると、画面の色を薄い暖色に変える（確認メモ #224・#225） */
export function SettingsShell({ variant, title, desc, badge, draft = false, actions, manual, unsaved = false, editing = false, children }: { variant: 'form' | 'sheet'; title: string; /** 省略したときは説明の行を出さない */ desc?: ReactNode; badge?: string; draft?: boolean; actions?: ReactNode; /** 見出しの右に置くマニュアルのボタン（ManualButton） */ manual?: ReactNode; unsaved?: boolean; /** 入力中：画面の枠を光らせる */ editing?: boolean; children: ReactNode }) {
  const isSheet = variant === 'sheet';
  // 画面内のリンクで移ってきたときは、画面の枠の上端に戻るの帯を出す（BackNav.tsx）
  const backNav = useBackNav();
  useBackClaim(!!backNav.from);
  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : '16px 28px 20px', display: 'flex', justifyContent: 'center' }}>
      {/* 角丸の外にはみ出す部分は切るが、スクロールの枠にはしない（clip）。中の position: sticky（印刷画面の下のボタンなど）が画面に対して効くようにする */}
      <div data-unsaved={unsaved || undefined} data-editing={editing || undefined} className={editing ? 'edit-glow' : undefined} style={{ width: '100%', maxWidth: isSheet ? 'none' : 1240, background: unsaved ? UNSAVED_BG : '#fff', border: '1px solid ' + (unsaved ? '#ecd9b4' : '#dde4ea'), borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'clip', transition: 'background .15s, border-color .15s' }}>
        {backNav.from && (
          <div data-return-bar style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 22px', background: '#f3f6f9', borderBottom: '1px solid #e2e8ee', borderRadius: '12px 12px 0 0' }}>
            <BackButton from={backNav.from} onBack={backNav.back} accent="#1f7a52" />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 24px 12px', borderBottom: '1px solid ' + (unsaved ? '#f0e2c6' : '#eef2f5'), flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              {title}{badge && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56', verticalAlign: 'middle', marginLeft: 6 }}>{badge}</span>}
              {manual && <span style={{ marginLeft: 6 }}>{manual}</span>}
            </div>
            {(desc || draft) && <div style={{ color: '#7a8794', fontSize: 14, marginTop: 4 }}>{desc}{draft && <span style={{ color: '#b7791f' }}>（叩き台）</span>}</div>}
          </div>
          {actions && <div className="toolbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}

/** 一覧で複数行を選んだときの操作バー（日記帳の見た目で全画面共通）。件数＋ヒント、右端に「選択解除」と画面ごとの操作ボタン */
export function SelectionBar({ count, unit = '行', hint, onClear, actions, style }: { count: number; unit?: string; hint?: ReactNode; onClear: () => void; actions?: ReactNode; style?: CSSProperties }) {
  if (count <= 0) return null;
  return (
    <div data-selection-bar style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff7cc', borderBottom: '1px solid #f3e3a0', fontSize: 14, ...style }}>
      <b>{count} {unit}を選択中</b>
      {hint && <span style={{ color: '#7a8794' }}>{hint}</span>}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button type="button" onClick={onClear} style={btn('#5b6773', false, true)}>選択解除</button>
        {actions}
      </span>
    </div>
  );
}

/** プルダウンの矢印（大メニュー・印刷・お気に入りメニュー・区分の切替などで共通。開いているときは上向き） */
export function Chevron({ open = false, color = '#9aa5b1', size = 12 }: { open?: boolean; color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', flex: 'none' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** 操作説明の ? アイコン。マウスを載せる（またはフォーカスする）と操作説明をツールチップで表示する。
 *  画面に常に出していた操作の説明文（Enter で次の行へ など）は、これに置き換える。text を配列にすると 1 行ずつ表示 */
export function HelpTip({ text, size = 16, style }: { text: ReactNode | string[]; size?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 170 > window.innerHeight;
    setPos({ x: Math.min(Math.max(r.left + r.width / 2, 175), window.innerWidth - 175), y: up ? r.top - 8 : r.bottom + 8, up });
  };
  const hide = () => setPos(null);
  const lines = Array.isArray(text) ? text : null;
  const label = lines ? lines.join('。') : typeof text === 'string' ? text : '操作説明';
  return (
    <>
      <span ref={ref} data-help-tip role="img" aria-label={label} tabIndex={-1} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, boxSizing: 'border-box', borderRadius: '50%', border: '1px solid #b9c4cf', background: '#fff', color: '#7a8794', fontSize: Math.round(size * 0.7), fontWeight: 700, lineHeight: 1, cursor: 'help', flex: 'none', verticalAlign: 'middle', userSelect: 'none', fontFamily: 'inherit', ...style }}>?</span>
      {pos && createPortal(
        <div role="tooltip" data-help-tip-body style={{ position: 'fixed', left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.up ? '-100%' : '0'})`, width: 'max-content', maxWidth: 330, padding: '8px 12px', background: '#22303c', color: '#fff', fontSize: 12, fontWeight: 500, lineHeight: 1.7, borderRadius: 8, boxShadow: '0 6px 18px rgba(20,30,40,.22)', zIndex: 100000, pointerEvents: 'none', textAlign: 'left', whiteSpace: 'normal' }}>
          {lines ? lines.map((l, i) => <div key={i}>{l}</div>) : text}
        </div>, document.body)}
    </>
  );
}

/** 一覧の行をクリックで開く（確認メモ #271：ダブルクリックから変更）。文字を選択しただけのときは開かない */
export const rowClick = (fn: () => void) => () => {
  if (String(window.getSelection?.() ?? '').trim()) return;
  fn();
};

/* ------------------------------------------------------------------ */
/* アイコン・アイコンだけのボタン（右上の機能ボタンを文字なしにそろえる）                    */
/* ------------------------------------------------------------------ */
export type IconName = 'print' | 'gear' | 'log' | 'search' | 'recalc' | 'link' | 'switch' | 'sliders' | 'sum' | 'undo' | 'count' | 'import' | 'approve' | 'trash' | 'trend' | 'bars' | 'carry' | 'eye' | 'copy' | 'book' | 'alert';
const ICON_PATHS: Record<IconName, ReactNode> = {
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  bars: <><path d="M3 21h18" /><path d="M6 17v-6" /><path d="M11 17V5" /><path d="M16 17v-9" /><path d="M20 17v-3" /></>,
  carry: <><path d="M3 12h12" /><path d="M10 6l6 6-6 6" /><path d="M20 4v16" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5" /><path d="M9 7h7M9 11h5" /></>,
  alert: <><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  trend: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 6-7" /></>,
  log: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  recalc: <><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /></>,
  link: <><path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" /></>,
  switch: <><path d="M12 2l10 5-10 5L2 7z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
  sum: <><path d="M18 7V4H6l6 8-6 8h12v-3" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  import: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  approve: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  count: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h4" /></>,
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      {ICON_PATHS[name]}
    </svg>
  );
}
/** マニュアル（説明）を開くボタン。見出しの右側に置く、枠のない小さな「アイコン＋文字」（確認メモ #297。全画面のマニュアルへのリンクで共通） */
export function ManualButton({ label = 'マニュアル', onClick, title, style }: { label?: string; onClick: () => void; title?: string; style?: CSSProperties }) {
  return (
    <button type="button" className="manual-link" data-manual-link={label} onClick={onClick} title={title ?? `${label}を開きます`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', border: 'none', borderRadius: 6, background: 'transparent', color: '#1f7a52', fontSize: 12, fontWeight: 700, fontFamily: "'Noto Sans JP', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap', verticalAlign: 'middle', ...style }}>
      <Icon name="book" size={14} />{label}
    </button>
  );
}
/** 印刷ボタンのアイコン（全画面の印刷ボタンで同じものを使う） */
export const PrintIcon = () => <Icon name="print" size={14} />;

/** アイコンだけのボタン。マウスを載せたときの表示（title）と読み上げ（aria-label）は、メニュー名だけにする。
 *  大きさは右上の機能ボタン（btn の通常の大きさ）と同じ高さの正方形 */
export function IconButton({ icon, label, color = '#5b6773', solid = false, size = 42, badge, tipOnly = false, style, onMouseEnter, onFocus, ...rest }: { icon: IconName; label: string; color?: string; solid?: boolean; size?: number; /** 右上の赤い数字（承認待ちの件数など）。0 は出さない */ badge?: number; /** 枠を広げず、マウスを載せたときにツールチップ（印刷ボタンと同じ小さな表記）で名前だけを出す */ tipOnly?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'color' | 'title'>) {
  // ふだんはアイコンだけの正方形。マウスを載せると枠の幅が広がってアイコンの横にメニュー名が出て、並んでいるほかのボタンは動いて場所を空ける（styles.css の .icon-btn-label）。
  // 右寄せのボタン列では名前をアイコンの左に出す。こうするとマウスを載せたボタン（アイコン）は動かず、左側のボタンが左へ動く
  const iconSize = size >= 40 ? 19 : 16;
  const ref = useRef<HTMLButtonElement>(null);
  const [toLeft, setToLeft] = useState(false);
  const measure = (b: HTMLButtonElement) => {
    const text = b.querySelector('.icon-btn-label > span') as HTMLElement | null;
    if (text) b.style.setProperty('--ib-w', text.scrollWidth + 'px');
  };
  useLayoutEffect(() => { if (ref.current) measure(ref.current); }, [label]);
  const pickSide = () => {
    const b = ref.current;
    if (!b || tipOnly) return;
    measure(b);
    // 右寄せの並び（margin-left: auto、または右詰め）かどうか。ボタンを包む要素があれば 1 つ上も見る
    const rightAligned = (el: HTMLElement | null) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      return el.style.marginLeft === 'auto' || cs.justifyContent === 'flex-end' || cs.justifyContent === 'end' || cs.justifyContent === 'right';
    };
    const p = b.parentElement;
    setToLeft(rightAligned(p) || (!!p && p.children.length === 1 && rightAligned(p.parentElement)));
  };
  return (
    <button
      ref={ref}
      type="button"
      className="icon-btn"
      data-icon-btn={label}
      data-solid={solid || undefined}
      data-expand={tipOnly ? undefined : toLeft ? 'left' : 'right'}
      title={tipOnly ? label : undefined}
      {...rest}
      onMouseEnter={(e) => { pickSide(); onMouseEnter?.(e); }}
      onFocus={(e) => { pickSide(); onFocus?.(e); }}
      aria-label={label}
      style={{ position: 'relative', minWidth: size, height: size, boxSizing: 'border-box', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${(size - 2 - iconSize) / 2}px`, borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, cursor: rest.disabled ? 'not-allowed' : 'pointer', opacity: rest.disabled ? 0.45 : 1, fontFamily: 'inherit', ...style }}
    >
      <Icon name={icon} size={iconSize} />
      {!tipOnly && <span className="icon-btn-label" aria-hidden="true"><span>{label}</span></span>}
      {!!badge && <span aria-hidden="true" style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 9, background: '#c0392b', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
    </button>
  );
}
