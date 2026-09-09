// 右上のユーザーアイコン → メニュー（事業者設定／ユーザー設定／メンバーの追加、管理／ログアウト）
// 設定系はプレースホルダ画面へ遷移。ログアウトはプロトタイプでは案内のみ。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export const USER_MENU_ITEMS = ['事業者設定', 'ユーザー設定', 'メンバーの追加、管理'];

interface Props {
  accent: string;
  /** アバターの背景色 */
  soft: string;
  onNavigate: (label: string) => void;
}

export function UserMenu({ accent, soft, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#22303c', cursor: 'pointer' };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        data-menu="ユーザーメニュー"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="ユーザーメニュー"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: soft, color: accent, fontSize: 13, fontWeight: 700, border: '2px solid ' + (open ? accent : 'transparent'), cursor: 'pointer', fontFamily: 'inherit' }}
      >
        経
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 240, background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,62,.18)', padding: 6, zIndex: 130, fontFamily: "'Noto Sans JP', sans-serif" }}>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #eef2f5', marginBottom: 4 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>経理 担当者</div>
            <div style={{ fontSize: 11.5, color: '#7a8794' }}>社会福祉法人 チャイルド保育園</div>
          </div>
          {USER_MENU_ITEMS.map((label) => (
            <button key={label} type="button" className="menu-sub" data-menu={label} onClick={() => { setOpen(false); onNavigate(label === '事業者設定' ? '事業者' : label); }} style={item}>
              <MenuIcon kind={label} />
              {label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #eef2f5', margin: '4px 0' }} />
          <button type="button" className="menu-sub" data-menu="ログアウト" onClick={() => { setOpen(false); onNavigate('ログアウト'); }} style={{ ...item, color: '#c0392b' }}>
            <MenuIcon kind="ログアウト" />
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ kind }: { kind: string }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { flex: 'none', opacity: 0.8 } };
  switch (kind) {
    case '事業者設定':
      return <svg {...p}><path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></svg>;
    case 'ユーザー設定':
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case 'メンバーの追加、管理':
      return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M19 8v6M16 11h6" /></svg>;
    default:
      return <svg {...p}><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M13 4h6v16h-6" /></svg>;
  }
}
