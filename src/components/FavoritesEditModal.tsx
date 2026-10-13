// お気に入りメニューの設定（登録・解除・ドラッグ＆ドロップで並べ替え）。ホームの「編集」とヘッダーの「お気に入り ▾ › 編集」から開く。

import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { HOME_CHECKS, IMPLEMENTED_MENU, MENU_GROUPS, SETTINGS_MENU, displayName } from '../data';
import { setSession, useSession } from '../store/session';

/** 登録できる機能（プロトタイプで画面があるもの） */
const CANDIDATES = [...MENU_GROUPS.flatMap((g) => g.items), ...HOME_CHECKS, '元帳１', '元帳２', '残高照合', '法人印刷', ...SETTINGS_MENU].filter((l) => IMPLEMENTED_MENU.includes(l) || l === '印刷センター' || l === '予算' || SETTINGS_MENU.includes(l));

export function FavoritesEditModal({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const s = useSession();
  // ドラッグ＆ドロップで並べ替え
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null); // 描画を待たずに参照できるよう ref にも保持
  const startDrag = (i: number) => { dragRef.current = i; setDrag(i); };
  const dropFav = (to: number) => { const from = dragRef.current; if (from == null || from === to) return; const f = [...s.favorites]; const [m] = f.splice(from, 1); f.splice(to, 0, m); setSession({ favorites: f }); };
  const endDrag = () => { dragRef.current = null; setDrag(null); setOver(null); };
  return (
    <Modal open={open} onClose={onClose} width={640} title="お気に入りメニューの設定">
      <div style={{ padding: '12px 22px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>登録済み（上から順に表示・ドラッグ＆ドロップで並べ替え）</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 200 }}>
            {s.favorites.map((l, i) => (
              <div
                key={l}
                draggable
                onDragStart={(e) => { startDrag(i); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== i) setOver(i); }}
                onDragLeave={() => { if (over === i) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); dropFav(i); endDrag(); }}
                onDragEnd={endDrag}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #f1f4f6', fontSize: 14, cursor: 'grab', background: drag === i ? '#f3f6f9' : over === i && drag != null ? accent + '14' : '#fff', boxShadow: over === i && drag != null && drag !== i ? `inset 0 2px 0 ${accent}` : undefined }}
              >
                <span aria-hidden style={{ color: '#b3bcc5', fontSize: 14, letterSpacing: -2, lineHeight: 1 }}>⋮⋮</span>
                <span style={{ flex: 1 }}>{displayName(l)}</span>
                <button type="button" onClick={() => setSession({ favorites: s.favorites.filter((x) => x !== l) })} style={{ border: '1px solid #f2c9c2', background: '#fff', color: '#c0392b', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>解除</button>
              </div>
            ))}
            {s.favorites.length === 0 && <div style={{ padding: 20, color: '#9aa5b1', fontSize: 14 }}>右の一覧から追加してください。</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>登録できる機能（クリックで追加）</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 300, overflow: 'auto' }}>
            {CANDIDATES.filter((c) => !s.favorites.includes(c)).map((c) => <button key={c} type="button" onClick={() => setSession({ favorites: [...s.favorites, c] })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid #f1f4f6', background: '#fff', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>＋ {displayName(c)}</button>)}
          </div>
        </div>
        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>閉じる</button></div>
      </div>
    </Modal>
  );
}
