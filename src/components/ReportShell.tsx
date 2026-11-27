// 問合せ（帳票）系画面の共通枠（依頼書 5.4.5 デザイン共通化）
//   すべての問合せ画面を同じ骨格で並べる：
//     呼び出し元へ戻るバー → 見出し（画面名・会計年度・区分名）・機能ボタン
//     → 集計期間（月）＋部の切替 → 指定科目 → 表示切替 → 注意書き → 一覧
//   表示切替（旧ファンクションキーでしか操作できなかった切替）は switches に渡すと、常に条件欄の右側へ並ぶ。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ToastView, useToast } from './Toast';
import { displayName } from '../data';
import { startKindOf, useSession, type EnvSettings } from '../store/session';
import { HelpTip, Icon, IconButton, TabStrip, tabBtn, type IconName } from './ui';
import { useBackClaim, useBackNav } from './BackNav';

export interface ToolButton {
  label: string;
  onClick: () => void;
  primary?: boolean;
  /** 無効表示（理由は title に） */
  disabled?: boolean;
  title?: string;
  /** アイコン。iconOnly のときは文字を出さず、名前はマウスを載せたときに出す */
  icon?: IconName;
  iconOnly?: boolean;
}

/** 部の切替（資産の部／負債の部／事業活動／資金の部）。一覧表のすぐ上にタブで並べる（← → キーでも切り替わる） */
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
  /** ツールボタンの並びに加える要素（画面の「印刷」メニューなど） */
  extraTools?: ReactNode;
  /** 呼び出し元へ戻るバー（ドリルダウンで開いたときだけ渡す） */
  returnTo?: ReturnSpec | null;
  /** 1) 集計期間（月タブなど） */
  period?: ReactNode;
  /** 集計期間の行の右側に置く集計値など */
  periodAside?: ReactNode;
  /** 部の切替（右上のボタン） */
  parts?: PartSpec;
  /** 集計期間を見出しの下の行に置き、印刷などのボタンと同じ行に並べる（試算表） */
  periodInHeader?: boolean;
  /** 2) 指定科目 */
  target?: ReactNode;
  /** 指定科目の見出し（例：指定取引先／絞り込み／科目検索）。既定は「指定科目」 */
  targetLabel?: string;
  /** 4) 一覧表の見出し行の右側に出す補足（件数など） */
  listNote?: ReactNode;
  /** 3) 表示切替（右寄せで並ぶ） */
  switches?: ReactNode;
  /** 画面固有の条件行（絞り込み・凡例など） */
  controls?: ReactNode;
  /** controls を見出しの列の下にずらさず、左端から並べる */
  controlsFull?: boolean;
  /** 一覧の直前に出す1行の注意書き */
  notice?: ReactNode;
  children: ReactNode;
  /** 見出しの右に出すバッジ（例：オプション） */
  badge?: ReactNode;
  /** 見出し右の年度・区分表記を差し替え（通常は指定しない） */
  org?: string;
  /** モーダルの中に置く（外側の余白・枠・影を付けない） */
  embedded?: boolean;
  /** 入力中：画面の枠を光らせる（残高照合の通帳残高の設定など） */
  editing?: boolean;
  /** 右側に元帳パネルを並べて表示しているときの、パネルの幅（本文の右余白をその分広げる） */
  asideWidth?: number;
}


export function ReportShell({ variant, accent, title, subtitle, tools = [], extraTools, returnTo, period, periodAside, parts, periodInHeader = false, target, targetLabel = '指定科目', switches, controls, controlsFull = false, notice, listNote, children, badge, org, embedded, asideWidth = 0, editing = false }: Props) {
  const toast = useToast();
  const s = useSession();
  const isSheet = variant === 'sheet';
  const kind = startKindOf(s);
  // 過去年度だけを対象にする（翌年度は含めない）。色はヘッダーの帯と同じ（確認メモ #218）
  const yearNo = (y: string) => parseInt(y.replace(/[^0-9]/g, ''), 10) || 0;
  const pastYear = yearNo(s.fiscalYear) < yearNo(s.currentYear);

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

  const periodInConditions = !periodInHeader && !!(period || periodAside);
  const hasConditions = !!(periodInConditions || target || switches || controls);
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };

  // 画面内のリンクで移ってきたときは、画面の枠の上端に戻るの帯を出す（画面が独自の戻り先を持つときはそちらを優先）
  const backNav = useBackNav();
  const rt: ReturnSpec | null = returnTo ?? (!embedded && backNav.from ? { from: backNav.from, onBack: backNav.back } : null);
  useBackClaim(!embedded && !!rt);
  return (
    <main style={embedded ? { minWidth: 0 } : { flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : '16px 28px 20px', paddingRight: (isSheet ? 24 : 28) + asideWidth, transition: 'padding-right .28s ease', display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div data-editing={editing || undefined} className={editing && !embedded ? 'edit-glow' : undefined} style={embedded ? { width: '100%', background: '#fff', display: 'flex', flexDirection: 'column' } : { width: '100%', maxWidth: isSheet ? 'none' : 1280, background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'clip', display: 'flex', flexDirection: 'column' }}>
        {rt && (
          <div data-return-bar style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 22px', background: '#f3f6f9', borderBottom: '1px solid #e2e8ee', flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline" onClick={rt.onBack} style={{ padding: '6px 14px', border: '1px solid ' + accent, borderRadius: 8, background: '#fff', color: accent, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ← {displayName(rt.from)}に戻る
            </button>
            <span style={{ fontSize: 14, color: '#7a8794' }}>
              {displayName(rt.from)} <span style={{ margin: '0 4px' }}>›</span> <b style={{ color: '#22303c' }}>{title}</b>{rt.here ? `（${rt.here}）` : ''}
            </span>
            {(rt.hint || returnTo) && <HelpTip style={{ marginLeft: 'auto' }} text={rt.hint ?? '戻ると、開く前と同じ表示条件（月・部・表示階層など）で表示します'} />}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 24px 12px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, ...(periodInHeader ? { flexBasis: '100%' } : {}) }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              {title} {badge}
              {org != null ? (
                <span style={{ fontSize: 14, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{org}</span>
              ) : (
                <span data-org style={{ fontSize: 14, fontWeight: 500, color: '#7a8794', marginLeft: 8, whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 700, color: pastYear ? '#d7191c' : '#48565f' }}>{s.fiscalYear}</span>
                  {pastYear && <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 6, background: '#d7191c', color: '#fff', fontSize: 12, fontWeight: 800 }}>過去年度を参照中</span>}
                  <span style={{ margin: '0 6px' }}>／</span>
                  <span style={{ fontWeight: 700, color: '#48565f' }}>{s.division}</span>
                  <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 6, background: '#eef2f6', color: '#5b6773', fontSize: 12, fontWeight: 700 }}>{kind}</span>
                </span>
              )}
            </div>
            {subtitle && <div style={{ color: '#7a8794', fontSize: 14, marginTop: 4 }}>{subtitle}</div>}
          </div>
          {/* 集計期間は印刷などのボタンと同じ行に置く（試算表） */}
          {periodInHeader && (period || periodAside) && (
            <div data-period-row style={{ ...row, gap: 10, minWidth: 0 }}>
              <span style={SECTION_TAG} data-section="集計期間">集計期間</span>
              {period}
              {periodAside}
            </div>
          )}
          {listNote && <div data-list-note style={{ marginLeft: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#48565f', whiteSpace: 'nowrap' }}>{listNote}</div>}
          <div className="toolbar-actions" style={{ marginLeft: listNote ? 0 : 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 印刷はどの画面でも右端に置く：印刷以外のツール → 印刷のツール → 印刷メニュー（extraTools）の順 */}
            {[...tools.filter((t) => t.icon !== 'print'), ...tools.filter((t) => t.icon === 'print')].map((t) => t.icon && t.iconOnly ? (
              <span key={t.label} data-tip={t.disabled ? t.title : undefined} style={{ display: 'inline-flex' }}>
                <IconButton icon={t.icon} label={t.label} disabled={t.disabled} color={t.primary ? accent : '#5b6773'} size={42} onClick={t.onClick} />
              </span>
            ) : (
              <span key={t.label} title={t.disabled ? undefined : t.title} data-tip={t.disabled ? t.title : undefined} style={{ display: 'inline-flex' }}>
                <button type="button" className="btn-outline" disabled={t.disabled} onClick={t.onClick} style={{ ...toolStyle(t.primary ? accent : undefined), ...(t.icon ? { display: 'inline-flex', alignItems: 'center', gap: 6 } : {}), ...(t.icon === 'print' && !t.primary ? { color: accent } : {}), ...(t.disabled ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}) }}>
                  {t.icon && <Icon name={t.icon} size={14} />}{t.label}
                </button>
              </span>
            ))}
            {extraTools}
          </div>
        </div>
        {/* 問合せ画面の共通構成（依頼書 5.4.5／2.5）：① 集計期間の選択 → ② 指定科目 → ③ 表示切替 → ④ 一覧表。見出しは共通シェルが付ける */}
        {hasConditions && (
          <div data-conditions style={{ padding: '10px 22px', borderBottom: '1px solid #eef2f5', display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', columnGap: 14, rowGap: 8, alignItems: 'center' }}>
            {periodInConditions && (
              <>
                <span style={SECTION_TAG} data-section="集計期間">集計期間</span>
                <div style={row}>
                  {period}
                  {periodAside && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {periodAside}
                    </div>
                  )}
                </div>
              </>
            )}
            {target && (
              <>
                <span style={SECTION_TAG} data-section="指定科目">{targetLabel}</span>
                <div style={{ ...row, fontSize: 14, color: '#48565f' }}>{target}</div>
              </>
            )}
            {switches && (
              <>
                <span style={SECTION_TAG} data-section="表示切替">表示切替</span>
                <div data-switches style={{ ...row, gap: 10 }}>{switches}</div>
              </>
            )}
            {controls && (controlsFull ? (
              <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>{controls}</div>
            ) : (
              <>
                <span />
                <div style={{ minWidth: 0 }}>{controls}</div>
              </>
            ))}
          </div>
        )}
        {notice && <div style={{ padding: '8px 22px', borderBottom: '1px solid #eef2f5', background: '#fffaf0', fontSize: 14, color: '#8a5a00', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{notice}</div>}
        {/* 部の切替はタブ（減価償却ページのタブと同じ形） */}
        {parts && (
          <TabStrip aria-label="部の切替" data-parts accent={accent}>
            {parts.items.map((p, i) => {
              const on = parts.current === i;
              return (
                <button key={p} type="button" role="tab" aria-selected={on} data-part={p} className="tab-btn" onClick={() => parts.onChange(i)} style={tabBtn(on, accent)}>
                  {p}
                </button>
              );
            })}
          </TabStrip>
        )}
        {/* 「一覧表」の帯は出さない（確認メモ #473）。件数などは見出しの行に出す */}
        {children}
      </div>
    </main>
  );
}

function toolStyle(bg?: string): CSSProperties {
  return {
    padding: '10px 16px',
    boxSizing: 'border-box',
    minHeight: 42,
    border: '1px solid ' + (bg ?? '#cfd8e0'),
    borderRadius: 8,
    background: bg ?? '#fff',
    color: bg ? '#fff' : '#5b6773',
    fontSize: 14,
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
            <button key={it} type="button" role="radio" aria-checked={on} disabled={disabled} data-seg={it} onClick={() => onChange(it)} style={{ padding: '7px 13px', border: 'none', borderLeft: i ? '1px solid #e2e8ee' : 'none', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
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
    <span title={disabled ? undefined : title} data-tip={disabled ? title : undefined} data-switch={label} aria-disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px solid #e2e8ee', borderRadius: 20, background: disabled ? '#f5f7f9' : '#fff', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span onClick={act} style={{ fontSize: 14, fontWeight: on && !disabled ? 800 : 500, color: on && !disabled ? accent : '#9aa5b1' }}>{label}</span>
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
export const TH: CSSProperties = { padding: '8px 14px', background: '#f6f8fa', fontSize: 14, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5', textAlign: 'left', whiteSpace: 'nowrap' };
export const TD: CSSProperties = { padding: '7px 14px', fontSize: 14, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
export const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
export const yen = (n: number) => (n < 0 ? '△' + Math.abs(n).toLocaleString('ja-JP') : n.toLocaleString('ja-JP'));
export const pct = (n: number) => (isFinite(n) ? (n * 100).toFixed(1) + '%' : '');
export const LABEL: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#8290a0', flex: 'none' };
/** 問合せ画面の共通構成の見出し（集計期間／指定科目／表示切替／一覧表） */
export const SECTION_TAG: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'start', minWidth: 72, padding: '4px 10px', borderRadius: 7, background: '#e9eef3', color: '#3d4a56', fontSize: 12, fontWeight: 800, letterSpacing: '.04em', whiteSpace: 'nowrap' };
export const CHECK: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#5b6773', cursor: 'pointer' };
