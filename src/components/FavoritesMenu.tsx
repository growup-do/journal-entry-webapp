// メニューバー右端の「お気に入りメニュー ▾」：登録した画面をどの画面からも開ける（確認事項「お気に入りメニューに関して」10/9 回答：ダッシュボード以外からもアクセスできる形で残す）。
//   他の大メニューと同じく、マウスオーバー（またはクリック）で開く。登録・並べ替えはホームと同じ「お気に入りメニューの設定」で行う。入力内容を持たないメニューなので Esc・外側クリックで閉じてよい。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FavoritesEditModal } from './FavoritesEditModal';
import { Chevron } from './ui';
import { displayName } from '../data';
import { useSession } from '../store/session';

export function FavoritesMenu({ accent, active, onNavigate }: { accent: string; active: string; onNavigate: (label: string) => void }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // 大メニューと同じ hover 開閉（離れてから少し待って閉じる）
  const timer = useRef<number | undefined>(undefined);
  const enter = () => { window.clearTimeout(timer.current); setOpen(true); };
  const leave = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 160); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const item: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#22303c', fontFamily: 'inherit', cursor: 'pointer' };
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }} data-favorites-menu onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" data-menu="お気に入りメニュー" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" title="登録した画面をここから開けます（どの画面からでも）" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, border: '1px solid ' + (open ? accent : '#dde4ea'), background: open ? accent : '#f7f9fb', color: open ? '#fff' : '#22303c', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <span aria-hidden style={{ color: open ? '#fff' : '#d9a400' }}>★</span>お気に入りメニュー<Chevron open={open} color={open ? '#fff' : '#9aa5b1'} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 120, minWidth: 220, background: '#fff', border: '1px solid #e2e8ee', borderRadius: 12, boxShadow: '0 12px 36px rgba(20,30,40,.16)', padding: 6 }}>
          <div style={{ padding: '4px 10px 6px', fontSize: 10.5, fontWeight: 700, color: '#8290a0', letterSpacing: '.03em' }}>お気に入りメニュー</div>
          {s.favorites.map((l) => {
            const on = active === l;
            return <button key={l} type="button" role="menuitem" data-menu={'お気に入りメニュー:' + l} onClick={() => { setOpen(false); onNavigate(l); }} style={{ ...item, background: on ? accent + '14' : 'transparent', color: on ? accent : '#22303c' }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: on ? accent : '#c3ccd4', flex: 'none' }} />{displayName(l)}</button>;
          })}
          {s.favorites.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: '#9aa5b1' }}>まだ登録がありません。</div>}
          <div style={{ borderTop: '1px solid #eef2f5', marginTop: 4, paddingTop: 4 }}>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); setEdit(true); }} style={{ ...item, color: accent }}>お気に入りメニューを編集…</button>
          </div>
        </div>
      )}
      <FavoritesEditModal open={edit} onClose={() => setEdit(false)} accent={accent} />
    </div>
  );
}
