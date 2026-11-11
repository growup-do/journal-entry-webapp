// 左側のメニュー列（サイドバー）。1600×768 の画面で使う人が多いため、上部のメニューバーをやめてここに置いた（11/10）。
//   上：ロゴ（ホームへ）＋システム名＋バージョン
//   中：大メニュー（ホーム＋6分類）／お気に入りメニュー／機能から探す
//   下：折りたたみボタン。折りたたむとアイコンだけの細い列になり、分類にマウスを載せると項目が右に出る。開閉の状態はブラウザに覚える。
// 画面の高さに合わせて固定（スクロールしない）。本文の右に出る参照パネル・元帳パネルは本文に重ねて表示する（本文を押し出さない）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Flyout, SideMenu, SubItem, iconBtn } from './Menu';
import { FavoritesEditModal } from './FavoritesEditModal';
import { VersionBadge } from './VersionBadge';
import { Chevron } from './ui';
import { useSession } from '../store/session';
import { firstAllowed } from '../store/access';

export const SIDENAV_WIDTH = 228;
export const SIDENAV_COMPACT = 60;
const KEY = 'proto-sidenav:collapsed';
const readCollapsed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const writeCollapsed = (c: boolean) => { try { localStorage.setItem(KEY, c ? '1' : '0'); } catch { /* ignore */ } };

/** 左メニューの開閉状態（ブラウザに覚える） */
export function useSideNav() {
  const [collapsed, setC] = useState<boolean>(readCollapsed);
  return { collapsed, width: collapsed ? SIDENAV_COMPACT : SIDENAV_WIDTH, toggle: () => setC((c) => { writeCollapsed(!c); return !c; }) };
}

interface Props {
  accent: string;
  active: string;
  onSelect: (label: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function SideNav({ accent, active, onSelect, collapsed, onToggle }: Props) {
  const width = collapsed ? SIDENAV_COMPACT : SIDENAV_WIDTH;
  // 会計本体を使えないアカウント：ホーム・お気に入り・機能から探すは出さない（使える機能だけのメニューにする）
  const access = useSession().access;
  const core = access.core;
  const home = core ? 'ホーム' : firstAllowed(access);
  return (
    <aside
      data-side-nav
      data-collapsed={collapsed ? '1' : '0'}
      aria-label="メニュー"
      style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', height: 'calc(100vh / var(--app-zoom, 1))', width, flex: 'none', background: '#fff', borderRight: '1px solid #dde4ea', display: 'flex', flexDirection: 'column', zIndex: 101, transition: 'width .2s ease' }}
    >
      {/* ロゴ・システム名 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: collapsed ? '10px 0 8px' : '10px 12px 8px 14px', justifyContent: collapsed ? 'center' : 'flex-start', borderBottom: '1px solid #eef2f5', minHeight: 52, flex: 'none' }}>
        <button type="button" data-menu="ホーム（ロゴ）" onClick={() => onSelect(home)} title={core ? 'ホームへ' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: accent, color: '#fff', borderRadius: 8, fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, flex: 'none' }}>会</span>
          {!collapsed && <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>会計基準システム</span>}
        </button>
        {!collapsed && <span style={{ marginLeft: 'auto', flex: 'none' }}><VersionBadge accent={accent} /></span>}
      </div>

      {/* メニュー本体。展開時は縦にスクロール、折りたたみ時はフライアウトが切れないよう overflow を解放 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: collapsed ? 'visible' : 'auto', overflowX: 'visible', padding: collapsed ? '8px 0' : '8px 8px 8px' }}>
        <SideMenu accent={accent} active={active} onSelect={onSelect} compact={collapsed} />
        {core && <>
          <div role="separator" style={{ height: 1, background: '#eef2f5', margin: collapsed ? '8px 10px' : '8px 6px' }} />
          <Favorites accent={accent} active={active} onNavigate={onSelect} compact={collapsed} />
          <FinderButton accent={accent} active={active === '機能から探す'} onClick={() => onSelect('機能から探す')} compact={collapsed} />
        </>}
      </div>

      {/* 折りたたみ */}
      <div style={{ flex: 'none', borderTop: '1px solid #eef2f5', padding: collapsed ? '6px 0' : '6px 8px' }}>
        <button type="button" className="menu-item-v" data-menu={collapsed ? 'メニューを広げる' : 'メニューをたたむ'} data-sidenav-toggle onClick={onToggle} aria-expanded={!collapsed} title={collapsed ? 'メニューを広げる' : 'メニューをたたんでコンパクトにする'} style={collapsed ? { ...iconBtn, color: '#5b6773' } : { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', transform: collapsed ? 'scaleX(-1)' : 'none' }}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M17 10l-2 2 2 2" /></svg>
          {!collapsed && <span>メニューをたたむ</span>}
        </button>
      </div>
    </aside>
  );
}

/* ---------------- お気に入りメニュー ----------------
 *   登録した画面をどの画面からも開ける（確認事項「お気に入りメニューに関して」10/9 回答）。
 *   展開時はアコーディオン、折りたたみ時はマウスオーバー（またはクリック）で右にフライアウト。登録・並べ替えはホームと同じ「お気に入りメニューの設定」。 */
function Favorites({ accent, active, onNavigate, compact }: { accent: string; active: string; onNavigate: (label: string) => void; compact: boolean }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const enter = () => { if (!compact) return; window.clearTimeout(timer.current); setOpen(true); };
  const leave = () => { if (!compact) return; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 160); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { setOpen(false); }, [compact]);
  const star = <span aria-hidden style={{ color: '#d9a400', fontSize: compact ? 20 : 15, lineHeight: 1, flex: 'none' }}>★</span>;
  const items = (
    <>
      {s.favorites.map((l) => <SubItem key={l} label={l} active={active === l} accent={accent} indent={!compact} onClick={() => { setOpen(false); onNavigate(l); }} />)}
      {s.favorites.length === 0 && <div style={{ padding: compact ? '8px 12px' : '6px 10px 6px 34px', fontSize: 13, color: '#9aa5b1', whiteSpace: 'nowrap' }}>まだ登録がありません。</div>}
      <button type="button" data-menu="お気に入りメニューを編集" onClick={() => { setOpen(false); setEdit(true); }} style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: compact ? '8px 14px' : '6px 10px 6px 34px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13, fontWeight: 700, color: accent, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>お気に入りメニューを編集…</button>
    </>
  );
  // 項目側の data-menu は以前のメニューバーと同じ名前にしておく（確認メモの操作履歴の再生に使うため）
  return (
    <div data-favorites-menu style={{ position: 'relative' }} onMouseEnter={enter} onMouseLeave={leave}>
      {compact ? (
        <button type="button" data-menu="お気に入りメニュー" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="お気に入りメニュー" title="お気に入りメニュー（登録した画面をここから開けます）" style={{ ...iconBtn, background: open ? '#f4f6f8' : 'transparent' }}>{star}</button>
      ) : (
        <button type="button" className="menu-item-v" data-menu="お気に入りメニュー" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="登録した画面をここから開けます（どの画面からでも）" style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', border: 'none', borderRadius: 8, color: '#3d4a56', whiteSpace: 'nowrap' }}>
          {star}
          <span style={{ flex: 1 }}>お気に入りメニュー</span>
          <Chevron open={open} color="#9aa5b1" />
        </button>
      )}
      {open && (compact ? <Flyout title="お気に入りメニュー">{items}</Flyout> : <div style={{ padding: '0 2px 6px 2px' }}>{items}</div>)}
      <FavoritesEditModal open={edit} onClose={() => setEdit(false)} accent={accent} />
    </div>
  );
}

/* ---------------- 機能から探す ---------------- */
function FinderButton({ accent, active, onClick, compact }: { accent: string; active: boolean; onClick: () => void; compact: boolean }) {
  const color = active ? accent : '#3d4a56';
  const icon = <svg width={compact ? 20 : 16} height={compact ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
  const base: CSSProperties = compact ? { ...iconBtn, background: active ? '#eef2f6' : 'transparent', color } : { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 14, fontWeight: active ? 700 : 600, fontFamily: 'inherit', cursor: 'pointer', background: active ? '#eef2f6' : 'transparent', border: 'none', borderRadius: 8, color, whiteSpace: 'nowrap' };
  return (
    <button type="button" className="menu-item-v" data-menu="機能から探す" onClick={onClick} aria-label="機能から探す" title="すべての機能を分類ごとに見る・キーワードで探す" style={base}>
      {icon}
      {!compact && <span>機能から探す</span>}
    </button>
  );
}
