// 設定メニュー（ヘッダーの歯車アイコン → ドロップダウン）。末尾に「サポートサイトへ」（外部サイト・別タブ）

/** サポートサイトのURL（仮。正式なURLはクライアントに確認） */
export const SUPPORT_URL = 'https://www.child.co.jp/';

import { useEffect, useRef, useState } from 'react';
import { SETTINGS_MENU } from '../data';

interface Props {
  accent: string;
  active: string;
  onNavigate: (label: string) => void;
}

export function SettingsMenu({ accent, active, onNavigate }: Props) {
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
  const isActive = SETTINGS_MENU.includes(active);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        data-menu="設定メニュー"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="設定"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: open || isActive ? accent : '#f4f6f8', color: open || isActive ? '#fff' : '#5b6773', border: '1px solid ' + (open || isActive ? accent : '#e2e8ee'), cursor: 'pointer' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 230, background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,62,.18)', padding: 6, zIndex: 130, fontFamily: "'Noto Sans JP', sans-serif" }}>
          <div style={{ padding: '8px 12px 6px', fontSize: 11, fontWeight: 700, color: '#8290a0', letterSpacing: '.04em' }}>設定</div>
          {SETTINGS_MENU.map((label) => {
            const on = active === label;
            return (
              <button key={label} type="button" className="menu-sub" data-menu={label} onClick={() => { setOpen(false); onNavigate(label); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: on ? '#eef2f6' : 'transparent', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: on ? accent : '#22303c', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                {label}
              </button>
            );
          })}
          <div style={{ height: 1, background: '#eef2f5', margin: '6px 4px' }} />
          <button
            type="button"
            className="menu-sub"
            data-menu="サポートサイトへ"
            onClick={() => { setOpen(false); window.open(SUPPORT_URL, '_blank', 'noopener'); }}
            title="サポートサイトを別タブで開く"
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#22303c', fontWeight: 500, cursor: 'pointer' }}
          >
            <span style={{ flex: 1 }}>サポートサイトへ</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8290a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
