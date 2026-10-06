// 汎用モーダル。Esc キーや背景クリックでは閉じない（入力途中の内容が消えないように。全システム共通の既定）。
//   閉じるのは ×・キャンセル・登録などの明示的なボタンだけ。表示専用で Esc／背景クリックで閉じたいときだけ dismissible を指定する。

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  width?: number;
  title?: ReactNode;
  children: ReactNode;
  /** 旧指定（互換のため残す。現在は既定が「背景クリックで閉じない」） */
  strict?: boolean;
  /** true のときだけ Esc と背景クリックで閉じる（入力欄のない表示専用のものに限る） */
  dismissible?: boolean;
  /** false のときは閉じられない（×なし・オーバーレイ／Escでも閉じない）。画面内の「戻る」等で抜ける用途 */
  closable?: boolean;
  style?: CSSProperties;
}

export function Modal({ open, onClose, width = 720, title, children, dismissible = false, closable = true, style }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !dismissible) return;
    const h = (e: KeyboardEvent) => {
      // 重ねて開いたモーダルでは、最前面のものだけを閉じる
      const roots = document.querySelectorAll('[data-modal-root]');
      if (roots[roots.length - 1] !== rootRef.current) return;
      if (e.key === 'Escape' && closable) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose, closable, dismissible]);
  if (!open) return null;
  return (
    <div
      ref={rootRef}
      data-modal-root
      onMouseDown={(e) => {
        if (dismissible && closable && e.target === e.currentTarget) onClose();
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
