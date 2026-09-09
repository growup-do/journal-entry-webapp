// 汎用モーダル（オーバーレイクリック / Esc で閉じる）

import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  width?: number;
  title?: ReactNode;
  children: ReactNode;
  /** true のときはオーバーレイクリックで閉じない（確認ダイアログ用） */
  strict?: boolean;
  /** false のときは閉じられない（×なし・オーバーレイ／Escでも閉じない）。画面内の「戻る」等で抜ける用途 */
  closable?: boolean;
  style?: CSSProperties;
}

export function Modal({ open, onClose, width = 720, title, children, strict, closable = true, style }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose, closable]);
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => {
        if (!strict && closable && e.target === e.currentTarget) onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 260, background: 'rgba(20,30,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        style={{
          width,
          maxWidth: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(10,20,30,.35)',
          fontFamily: "'Noto Sans JP', sans-serif",
          color: '#22303c',
          ...style,
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #eef2f5' }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, flex: 1 }}>{title}</div>
            {closable && (
              <button type="button" onClick={onClose} title="閉じる" style={{ border: 'none', background: 'transparent', fontSize: 20, color: '#8290a0', cursor: 'pointer', lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
