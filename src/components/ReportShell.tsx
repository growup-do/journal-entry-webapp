// 問合せ（帳票）系画面の共通枠（依頼書 5.4.5 デザイン共通化）
//   すべての問合せ画面を同じ骨格で並べる：
//     呼び出し元へ戻るバー → 見出し（画面名・会計年度・区分名）・機能ボタン
//     → 集計期間（月）＋部の切替 → 指定科目 → 表示切替 → 注意書き → 一覧
//   表示切替（旧ファンクションキーでしか操作できなかった切替）は switches に渡すと、常に条件欄の右側へ並ぶ。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { displayName } from '../data';
import { startKindOf, useSession, type EnvSettings } from '../store/session';

export interface ToolButton {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  /** 無効表示（理由は title に） */
  disabled?: boolean;
  title?: string;
}

/** 部の切替（資産の部／負債の部／事業活動／資金の部）。集計期間の行の右端に並べ、← → キーでも切り替える */
export interface PartSpec {
  items: string[];
  current: number;
  onChange: (index: number) => void;
}

/** ドリルダウン元へ戻る導線（依頼書 5.4.1／6.1） */
export interface ReturnSpec {
  /** 呼び出し元の画面キー（例 '月次試算'） */
  from: string;
  onBack: () => void;
  /** 現在地の補足（例 科目名） */
  here?: string;
  /** 右端の補足文（省略時は表示条件を引き継ぐ旨の案内） */
  hint?: string;
}

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  title: string;
  subtitle?: ReactNode;
  tools?: ToolButton[];
  /** 呼び出し元へ戻るバー（ドリルダウンで開いたときだけ渡す） */
  returnTo?: ReturnSpec | null;
  /** 1) 集計期間（月タブなど） */
  period?: ReactNode;
  /** 集計期間の行の右側に置く集計値など */
  periodAside?: ReactNode;
  /** 部の切替（右上のボタン） */
  parts?: PartSpec;
  /** 2) 指定科目 */
  target?: ReactNode;
  /** 3) 表示切替（右寄せで並ぶ） */
  switches?: ReactNode;
  /** 画面固有の条件行（絞り込み・凡例など） */
  controls?: ReactNode;
  /** 一覧の直前に出す1行の注意書き */
  notice?: ReactNode;
  children: ReactNode;
  /** 見出しの右に出すバッジ（例：オプション） */
  badge?: ReactNode;
  /** 見出し右の年度・区分表記を差し替え（通常は指定しない） */
  org?: string;
  /** モーダルの中に置く（外側の余白・枠・影を付けない） */
  embedded?: boolean;
}

const PART_COLORS = ['#e8791e', '#d9a400', '#d9a400', '#d9a400'];

export function ReportShell({ variant, accent, title, subtitle, tools = [], returnTo, period, periodAside, parts, target, switches, controls, notice, children, badge, org, embedded }: Props) {
  const toast = useToast();
  const s = useSession();
  const isSheet = variant === 'sheet';
  const kind = startKindOf(s);
  const pastYear = s.fiscalYear !== s.currentYear;

  // 部の切替：← → キー（入力欄・ダイアログ操作中は無視）
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const hasParts = !!parts;
  useEffect(() => {
    if (!hasParts) return;
    const h = (e: KeyboardEvent) => {
      const p = partsRef.current;
      if (!p || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[data-modal-root]')) return;
      const next = p.current + (e.key === 'ArrowRight' ? 1 : -1);
      if (next < 0 || next >= p.items.length) return;
      e.preventDefault();
      p.onChange(next);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [hasParts]);

  const hasConditions = !!(period || periodAside || parts || target || switches || controls);
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };

  return (
    <main style={embedded ? { minWidth: 0 } : { flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={embedded ? { width: '100%', background: '#fff', display: 'flex', flexDirection: 'column' } : { width: '100%', maxWidth: isSheet ? 'none' : 1280, background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {returnTo && (
          <div data-return-bar style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 22px', background: '#f3f6f9', borderBottom: '1px solid #e2e8ee', flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline" onClick={returnTo.onBack} style={{ padding: '6px 14px', border: '1px solid ' + accent, borderRadius: 8, background: '#fff', color: accent, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ← {displayName(returnTo.from)}に戻る
            </button>
            <span style={{ fontSize: 12, color: '#7a8794' }}>
              {displayName(returnTo.from)} <span style={{ margin: '0 4px' }}>›</span> <b style={{ color: '#22303c' }}>{title}</b>{returnTo.here ? `（${returnTo.here}）` : ''}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#9aa5b1' }}>{returnTo.hint ?? '戻ると、開く前と同じ表示条件（月・部・表示階層など）で表示します'}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              {title} {badge}
              {org != null ? (
                <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{org}</span>
              ) : (
                <span data-org style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8, whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 700, color: pastYear ? '#b7791f' : '#48565f' }}>{s.fiscalYear}</span>
                  {pastYear && <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 6, background: '#fff7e6', border: '1px solid #f3d9b0', color: '#8a5a00', fontSize: 10.5, fontWeight: 700 }}>過去年度を参照中</span>}
                  <span style={{ margin: '0 6px' }}>／</span>
                  <span style={{ fontWeight: 700, color: '#48565f' }}>{s.division}</span>
                  <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 6, background: '#eef2f6', color: '#5b6773', fontSize: 10.5, fontWeight: 700 }}>{kind}</span>
                </span>
              )}
            </div>
            {subtitle && <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tools.map((t) => (
              <span key={t.label} title={t.title}>
                <button type="button" className="btn-outline" disabled={t.disabled} onClick={t.onClick ?? (() => toast.show(NOT_IMPL))} style={{ ...toolStyle(t.primary ? accent : undefined), ...(t.disabled ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}) }}>
                  {t.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        {hasConditions && (
          <div style={{ padding: '12px 22px', borderBottom: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(period || periodAside || parts) && (
              <div style={row}>
                {period}
                {(periodAside || parts) && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {periodAside}
                    {parts && (
                      <div role="tablist" aria-label="部の切替" title="← → キーでも切り替えできます" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {parts.items.map((p, i) => {
                          const on = parts.current === i;
                          const color = PART_COLORS[i] ?? '#d9a400';
                          return (
                            <button key={p} type="button" role="tab" aria-selected={on} className="chip" data-part={p} onClick={() => parts.onChange(i)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? color : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? color : '#d3dbe3'), whiteSpace: 'nowrap' }}>
                              {p}
                            </button>
                          );
                        })}
                        <span style={{ fontSize: 10.5, color: '#9aa5b1', whiteSpace: 'nowrap' }}>← → キーでも切替</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {target && <div style={{ ...row, fontSize: 12.5, color: '#48565f' }}>{target}</div>}
            {switches && (
              <div data-switches style={{ ...row, gap: 10 }}>
                <span style={{ ...LABEL, marginRight: 'auto' }}>表示切替</span>
                {switches}
              </div>
            )}
            {controls}
          </div>
        )}
        {notice && <div style={{ padding: '8px 22px', borderBottom: '1px solid #eef2f5', background: '#fffaf0', fontSize: 12, color: '#8a5a00', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{notice}</div>}
        {children}
      </div>
    </main>
  );
}

function toolStyle(bg?: string): CSSProperties {
  return {
    padding: '7px 14px',
    border: '1px solid ' + (bg ?? '#cfd8e0'),
    borderRadius: 8,
    background: bg ?? '#fff',
    color: bg ? '#fff' : '#5b6773',
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

/* ---- 表示切替の共通部品 ---- */

/** セグメント切替（表示階層・配色パターン・金額単位・表／グラフ など） */
export function Segmented<T extends string>({ label, items, value, onChange, accent, disabled, title }: { label?: string; items: readonly T[]; value: T; onChange: (v: T) => void; accent: string; disabled?: boolean; title?: string }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.5 : 1 }}>
      {label && <span style={LABEL}>{label}</span>}
      <span role="radiogroup" aria-label={label} style={{ display: 'inline-flex', border: '1px solid #cfd8e0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        {items.map((it, i) => {
          const on = it === value;
          return (
            <button key={it} type="button" role="radio" aria-checked={on} disabled={disabled} data-seg={it} onClick={() => onChange(it)} style={{ padding: '5px 11px', border: 'none', borderLeft: i ? '1px solid #e2e8ee' : 'none', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {it}
            </button>
          );
        })}
      </span>
    </span>
  );
}

/** ON／OFF スイッチ（区分色・区分名・消費税表示 など）。無効時は理由を title に出す */
export function SwitchPill({ label, on, onChange, accent, disabled, title }: { label: string; on: boolean; onChange: (v: boolean) => void; accent: string; disabled?: boolean; title?: string }) {
  const act = () => { if (!disabled) onChange(!on); };
  return (
    <span title={title} data-switch={label} aria-disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', border: '1px solid #e2e8ee', borderRadius: 20, background: disabled ? '#f5f7f9' : '#fff', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span onClick={act} style={{ fontSize: 12, fontWeight: on && !disabled ? 800 : 500, color: on && !disabled ? accent : '#9aa5b1' }}>{label}</span>
      <span role="switch" aria-checked={on && !disabled} onClick={act} style={{ display: 'inline-block', width: 36, height: 20, borderRadius: 10, background: on && !disabled ? accent : '#cfd8e0', position: 'relative', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: on && !disabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </span>
  );
}

/* ---- 画面の表示状態を保持（ドリルダウンから戻ったときに同じ月・部・階層で表示する） ---- */
export function useViewState<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem('proto-view:' + key);
      return raw ? { ...initial, ...(JSON.parse(raw) as Partial<T>) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { sessionStorage.setItem('proto-view:' + key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key, v]);
  return [v, (patch) => setV((p) => ({ ...p, ...patch }))];
}

/* ---- 金額書式（動作環境：桁区切り・負の記号・負の表示色） ---- */
type MoneyEnv = Pick<EnvSettings, 'thousandsSep' | 'negativeSign' | 'negativeColor'>;
const NEG_RED = '#c0392b';

/** 文字列版（出力・ツールチップ用）。点線区切りは文字では表せないため空白区切りにする */
export function moneyText(n: number, env: MoneyEnv): string {
  const abs = Math.abs(Math.round(n)).toLocaleString('ja-JP');
  const body = env.thousandsSep === 'なし' ? abs.replace(/,/g, '') : env.thousandsSep === '点線' ? abs.replace(/,/g, ' ') : abs;
  return (n < 0 ? env.negativeSign : '') + body;
}

/** 画面表示用。useMoney() で得た関数を yen の代わりに使う */
export function useMoney(): (n: number) => ReactNode {
  const env = useSession().env;
  return (n: number) => {
    const neg = n < 0;
    const color = neg && env.negativeColor === '赤' ? NEG_RED : undefined;
    if (env.thousandsSep !== '点線') return <span style={{ color }}>{moneyText(n, env)}</span>;
    const groups = Math.abs(Math.round(n)).toLocaleString('ja-JP').split(',');
    return (
      <span style={{ color }}>
        {neg ? env.negativeSign : ''}
        {groups.map((g, i) => <span key={i} style={i ? { borderLeft: '1px dotted #8290a0', marginLeft: 2, paddingLeft: 2 } : undefined}>{g}</span>)}
      </span>
    );
  };
}

/* ---- 表の共通スタイル ---- */
export const TH: CSSProperties = { padding: '9px 12px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5', textAlign: 'left', whiteSpace: 'nowrap' };
export const TD: CSSProperties = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
export const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
export const yen = (n: number) => (n < 0 ? '△' + Math.abs(n).toLocaleString('ja-JP') : n.toLocaleString('ja-JP'));
export const pct = (n: number) => (isFinite(n) ? (n * 100).toFixed(1) + '%' : '');
export const LABEL: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8290a0', flex: 'none' };
export const CHECK: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#5b6773', cursor: 'pointer' };
