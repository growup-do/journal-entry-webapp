// 追加画面で共通に使う小さな部品（ボタン／入力／ラベル／タブ／トグル／カード）

import type { CSSProperties, ReactNode } from 'react';

export const btn = (color = '#5b6773', solid = false, small = false): CSSProperties => ({
  padding: small ? '4px 10px' : '8px 14px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color,
  fontSize: small ? 11.5 : 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
});
export const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
export const numInput: CSSProperties = { ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
export const lbl: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 5 };
export const card: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 12, overflow: 'hidden', background: '#fff' };
export const cardHead: CSSProperties = { padding: '10px 14px', background: '#f6f8fa', fontSize: 12.5, fontWeight: 700, borderBottom: '1px solid #eef2f5', display: 'flex', alignItems: 'center', gap: 8 };
export const yen = (n: number) => (n < 0 ? '△' + Math.abs(n).toLocaleString('ja-JP') : n.toLocaleString('ja-JP'));
export const toInt = (v: string) => parseInt(v.replace(/[^0-9-]/g, ''), 10) || 0;

export function Tabs({ items, current, onChange, accent, small }: { items: string[]; current: string; onChange: (v: string) => void; accent: string; small?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e2e8ee', padding: '0 22px', flexWrap: 'wrap' }}>
      {items.map((t) => {
        const on = t === current;
        return (
          <button key={t} type="button" className="tab" data-tab={t} onClick={() => onChange(t)} style={{ padding: small ? '8px 12px' : '11px 16px', border: 'none', borderBottom: '3px solid ' + (on ? accent : 'transparent'), background: 'transparent', color: on ? accent : '#5b6773', fontSize: small ? 12.5 : 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1 }}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, accent = '#1f7a52', label }: { on: boolean; onChange: (v: boolean) => void; accent?: string; label?: ReactNode }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
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
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: i <= current ? accent : '#e2e8ee', color: i <= current ? '#fff' : '#8290a0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
          <span style={{ fontSize: 12.5, fontWeight: i === current ? 700 : 500, color: i === current ? '#22303c' : '#7a8794', whiteSpace: 'nowrap' }}>{s}</span>
          {i < steps.length - 1 && <span style={{ flex: 1, height: 2, background: i < current ? accent : '#e2e8ee', margin: '0 10px' }} />}
        </div>
      ))}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const c = tone === 'warn' ? { bg: '#fff7e6', bd: '#f3d9b0', fg: '#8a5a00' } : tone === 'ok' ? { bg: '#eaf5ef', bd: '#bfe0cf', fg: '#1f7a52' } : { bg: '#f3f6f9', bd: '#dde4ea', fg: '#48565f' };
  return <div style={{ padding: '10px 12px', background: c.bg, border: '1px solid ' + c.bd, borderRadius: 10, fontSize: 12.5, color: c.fg, lineHeight: 1.7 }}>{children}</div>;
}

/** 設定系画面の共通シェル（SettingsPages の Shell と同じ見た目） */
export function SettingsShell({ variant, title, desc, badge = '設定', draft = true, actions, children }: { variant: 'form' | 'sheet'; title: string; desc: ReactNode; badge?: string; draft?: boolean; actions?: ReactNode; children: ReactNode }) {
  const isSheet = variant === 'sheet';
  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1240, background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              {title} <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56', verticalAlign: 'middle', marginLeft: 6 }}>{badge}</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>{desc}{draft && <span style={{ color: '#b7791f' }}>（叩き台）</span>}</div>
          </div>
          {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}
