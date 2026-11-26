// 左側のメニュー列（サイドバー）。1600×768 の画面で使う人が多いため、上部のメニューバーをやめてここに置いた（11/10）。
//   ロゴ（ホームへ）＋システム名＋バージョンは、会計期間と同じヘッダーの左端に置く（AppBrand。名前を省略せずに出すため 11/26）
//   サイドバーの表示は「各種設定 › メニューボタン表示設定」で 名前付き／アイコンだけ／表示しない を選ぶ。
//   表示しないときは、ヘッダーのロゴの左の ≡ からメニュー（MenuDrawer）を開く。
//   中：ホーム／お気に入りメニュー（ホームのすぐ下）／大メニュー（6分類）。「機能から探す」はホームと同じ一覧のため廃止
//   下：折りたたみボタン。折りたたむとアイコンだけの細い列になり、分類にマウスを載せると項目が右に出る。開閉の状態はブラウザに覚える。
// 画面の高さに合わせて固定（スクロールしない）。本文の右に出る参照パネル・元帳パネルは本文に重ねて表示する（本文を押し出さない）。

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Flyout, SideMenu, SubItem, iconBtn } from './Menu';
import { FavoritesEditModal } from './FavoritesEditModal';
import { VersionBadge } from './VersionBadge';
import { Chevron, Toggle } from './ui';
import { useSession } from '../store/session';
import { canOpen, firstAllowed } from '../store/access';

export const SIDENAV_WIDTH = 228;
export const SIDENAV_COMPACT = 60;
const KEY = 'proto-sidenav:collapsed';
const readCollapsed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const writeCollapsed = (c: boolean) => { try { localStorage.setItem(KEY, c ? '1' : '0'); } catch { /* ignore */ } };

/* サイドバーの表示（名前付き／アイコンだけ／表示しない）。ブラウザに覚え、設定画面・メニューの切替・サイドバーで同じ値を使う */
export type SideNavMode = '名前付き' | 'アイコンだけ' | '表示しない';
const HIDE_KEY = 'proto-sidenav:hidden';
const readHidden = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
let navState = { collapsed: readCollapsed(), hidden: readHidden() };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const sideNavMode = (st = navState): SideNavMode => (st.hidden ? '表示しない' : st.collapsed ? 'アイコンだけ' : '名前付き');
export function setSideNavMode(m: SideNavMode) {
  navState = { collapsed: m === 'アイコンだけ' ? true : m === '名前付き' ? false : navState.collapsed, hidden: m === '表示しない' };
  writeCollapsed(navState.collapsed);
  try { localStorage.setItem(HIDE_KEY, navState.hidden ? '1' : '0'); } catch { /* ignore */ }
  emit();
}
/** サイドバーを表示するか（表示しないときはヘッダーの ≡ から開く） */
export function setSideNavShown(on: boolean) { setSideNavMode(on ? (navState.collapsed ? 'アイコンだけ' : '名前付き') : '表示しない'); }
export function useSideNavMode(): SideNavMode { return useSyncExternalStore(subscribe, () => sideNavMode()); }

/** 左メニューの開閉状態（ブラウザに覚える） */
export function useSideNav() {
  const mode = useSideNavMode();
  const collapsed = mode === 'アイコンだけ';
  return { collapsed, hidden: mode === '表示しない', width: collapsed ? SIDENAV_COMPACT : SIDENAV_WIDTH, toggle: () => setSideNavMode(collapsed ? '名前付き' : 'アイコンだけ') };
}

const BRAND_FONT = "'Zen Kaku Gothic New', sans-serif";
const hamburger = (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
);

/** ヘッダー左端のロゴ・システム名・バージョン。サイドバーを表示しないときは、左に ≡（メニューを開く）を置く */
export function AppBrand({ accent, onSelect, onMenu, menuOpen }: { accent: string; onSelect: (label: string) => void; /** ≡ を押したとき（サイドバーを表示しないときだけ渡す） */ onMenu?: () => void; menuOpen?: boolean }) {
  const access = useSession().access;
  const home = access.core ? 'ホーム' : firstAllowed(access);
  return (
    <div data-app-brand style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
      {onMenu && <button type="button" data-menu-drawer-open onClick={onMenu} aria-expanded={!!menuOpen} aria-label="メニューを開く" title="メニュー" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, border: 'none', borderRadius: 18, background: menuOpen ? '#eef2f6' : 'transparent', color: '#3d4a56', cursor: 'pointer', marginLeft: -6 }}>{hamburger}</button>}
      <button type="button" data-menu="ホーム（ロゴ）" onClick={() => onSelect(home)} title={access.core ? 'ホームへ' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#22303c', fontFamily: 'inherit' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: accent, color: '#fff', borderRadius: 8, fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 16, flex: 'none' }}>会</span>
        <span data-app-name style={{ fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>会計基準システム</span>
      </button>
      <VersionBadge accent={accent} />
    </div>
  );
}

/** サイドバーを表示しないときのメニュー（≡ から左に開く。メニュー項目を選ぶか、×・外側のクリック・Esc で閉じる） */
export function MenuDrawer({ open, onClose, accent, active, onSelect }: { open: boolean; onClose: () => void; accent: string; active: string; onSelect: (label: string) => void }) {
  const core = useSession().access.core;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const go = (label: string) => { onClose(); onSelect(label); };
  return (
    <div data-menu-drawer style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,30,40,.28)' }} />
      <aside aria-label="メニュー" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, background: '#fff', boxShadow: '4px 0 24px rgba(20,30,40,.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 10px 10px 16px', borderBottom: '1px solid #eef2f5', minHeight: 56, flex: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: accent, color: '#fff', borderRadius: 8, fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 16 }}>会</span>
          <span style={{ fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>会計基準システム</span>
          <button type="button" data-menu-drawer-close onClick={onClose} aria-label="メニューを閉じる" title="閉じる" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', borderRadius: 18, background: 'transparent', color: accent, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div data-sidenav-show role="button" tabIndex={0} onClick={() => { setSideNavShown(true); onClose(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSideNavShown(true); onClose(); } }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #eef2f5', fontSize: 14, cursor: 'pointer', flex: 'none' }}>
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3d4a56" strokeWidth="1.9" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
          <span style={{ flex: 1 }}>サイドバーを表示</span>
          <Toggle on={false} onChange={() => undefined} accent={accent} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          <SideMenu accent={accent} active={active} onSelect={go} compact={false} afterHome={core ? <Favorites accent={accent} active={active} onNavigate={go} compact={false} /> : undefined} />
        </div>
      </aside>
    </div>
  );
}

interface Props {
  accent: string;
  active: string;
  onSelect: (label: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  /** ヘッダー（＋年度の帯）の高さ。サイドバーはその下に固定する */
  top?: number;
}

export function SideNav({ accent, active, onSelect, collapsed, onToggle, top = 0 }: Props) {
  const width = collapsed ? SIDENAV_COMPACT : SIDENAV_WIDTH;
  // 会計本体を使えないアカウント：お気に入りは出さない（使える機能だけのメニューにする）
  const core = useSession().access.core;
  return (
    <aside
      data-side-nav
      data-collapsed={collapsed ? '1' : '0'}
      aria-label="メニュー"
      style={{ position: 'sticky', top, alignSelf: 'flex-start', height: `calc(100vh / var(--app-zoom, 1) - ${top}px)`, width, flex: 'none', background: '#fff', borderRight: '1px solid #dde4ea', display: 'flex', flexDirection: 'column', zIndex: 101, transition: 'width .2s ease' }}
    >
      {/* メニュー本体。展開時は縦にスクロール、折りたたみ時はフライアウトが切れないよう overflow を解放 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: collapsed ? 'visible' : 'auto', overflowX: 'visible', padding: collapsed ? '8px 0' : '8px 8px 8px' }}>
        <SideMenu accent={accent} active={active} onSelect={onSelect} compact={collapsed} afterHome={core ? <Favorites accent={accent} active={active} onNavigate={onSelect} compact={collapsed} /> : undefined} />
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
  // ほかの分類のアイコンと同じ線画・同じ色（#3d4a56）の星
  const star = <svg aria-hidden width={compact ? 20 : 17} height={compact ? 20 : 17} viewBox="0 0 24 24" fill="none" stroke="#3d4a56" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.95l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z" /></svg>;
  const items = (
    <>
      {s.favorites.filter((l) => canOpen(l, s.access)).map((l) => <SubItem key={l} label={l} active={active === l} accent={accent} indent={!compact} onClick={() => { setOpen(false); onNavigate(l); }} />)}
      {!s.favorites.some((l) => canOpen(l, s.access)) && <div style={{ padding: compact ? '8px 12px' : '6px 10px 6px 34px', fontSize: 13, color: '#9aa5b1', whiteSpace: 'nowrap' }}>まだ登録がありません。</div>}
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

