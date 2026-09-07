// 帳票系画面の共通枠：見出し・機能ボタン（既存Fキー相当）・条件行・本体

import type { CSSProperties, ReactNode } from 'react';
import { NOT_IMPL, ToastView, useToast } from './Toast';

export interface ToolButton {
  label: string;
  onClick?: () => void;
  primary?: boolean;
}

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  title: string;
  subtitle?: ReactNode;
  tools?: ToolButton[];
  /** 条件行（月タブ・指定科目など） */
  controls?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
}

export function ReportShell({ variant, accent, title, subtitle, tools = [], controls, children, onBack }: Props) {
  const toast = useToast();
  const isSheet = variant === 'sheet';
  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, background: '#fff', border: '1px solid #dde4ea', borderRadius: isSheet ? 14 : 16, boxShadow: '0 6px 26px rgba(30,50,70,.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              {title} <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>社会福祉法人　チャイルド保育園 › 社会福祉事業</span>
            </div>
            {subtitle && <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tools.map((t) => (
              <button key={t.label} type="button" className="btn-outline" onClick={t.onClick ?? (() => toast.show(NOT_IMPL))} style={toolStyle(t.primary ? accent : undefined)}>
                {t.label}
              </button>
            ))}
            {onBack && (
              <button type="button" className="btn-outline" onClick={onBack} style={toolStyle()}>
                戻る
              </button>
            )}
          </div>
        </div>
        {controls && <div style={{ padding: '12px 22px', borderBottom: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 10 }}>{controls}</div>}
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

/* ---- 表の共通スタイル ---- */
export const TH: CSSProperties = { padding: '9px 12px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5', textAlign: 'left', whiteSpace: 'nowrap' };
export const TD: CSSProperties = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f1f4f6', verticalAlign: 'middle' };
export const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
export const yen = (n: number) => (n < 0 ? '△' + Math.abs(n).toLocaleString('ja-JP') : n.toLocaleString('ja-JP'));
export const pct = (n: number) => (isFinite(n) ? (n * 100).toFixed(1) + '%' : '');
export const LABEL: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8290a0', flex: 'none' };
export const CHECK: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#5b6773', cursor: 'pointer' };
