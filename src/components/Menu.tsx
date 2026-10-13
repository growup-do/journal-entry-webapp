// メニュー
//   横（フォーム型ナビ）… 大メニュー7つ。マウスオーバー（またはクリック）でその階層の項目をドロップダウン表示
//   縦（スプレッドシート型サイドバー）… 大メニューをアコーディオンで開閉。開いている階層の項目を表示
// 出納・資産・決裁（旧オプション）階層は他の階層と同じ見た目（最後尾に配置するのみ）。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { MENU_GROUPS, displayName, groupOf, isOptionMenu, type MenuGroup } from '../data';
import { startKindOf, useSession, type Session } from '../store/session';
import { FavoritesMenu } from './FavoritesMenu';
import { Chevron } from './ui';

/** メニュー項目の状態（依頼書 5.1.1／5.1.4）：起動区分の種類で変わる。使えない項目は隠さず、グレーアウトの無効表示にする（理由はツールチップのみ。確認事項 10/9 回答） */
function itemState(label: string, s: Session): { disabled?: string; tag?: string } {
  const kind = startKindOf(s);
  if (['単一入力', '伝票入力', '振替入力', '振替単一'].includes(label) && kind !== '入力区分') return { disabled: `${kind}で起動中は伝票を入力できません（入力区分に切り替えてください）` };
  if (['業者元帳', '業者推移'].includes(label) && kind === '合算区分') return { disabled: '合算区分で起動中は利用できません' };
  if (isOptionMenu(label) && kind === '合算区分') return { disabled: '合算区分で起動中は利用できません（入力区分・拠点区分などで起動してください）' };
  return {};
}


interface Props {
  orientation: 'h' | 'v';
  accent: string;
  active: string;
  onSelect: (label: string) => void;
}

export function Menu({ orientation, accent, active, onSelect }: Props) {
  return orientation === 'h' ? <HMenu accent={accent} active={active} onSelect={onSelect} /> : <VMenu accent={accent} active={active} onSelect={onSelect} />;
}

/* ---------------- 横：大メニュー＋ドロップダウン ---------------- */
function HMenu({ accent, active, onSelect }: Omit<Props, 'orientation'>) {
  const session = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeGroup = groupOf(active)?.key;

  const enter = (k: string) => {
    window.clearTimeout(timer.current);
    setOpen(k);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(null), 160);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, paddingRight: 150 }}>
      <HomeButton active={active === 'ホーム'} accent={accent} onClick={() => onSelect('ホーム')} />
      {MENU_GROUPS.map((g) => {
        const on = activeGroup === g.key;
        const isOpen = open === g.key;
        const color = on ? accent : '#3d4a56';
        return (
          <div key={g.key} style={{ position: 'relative' }} onMouseEnter={() => enter(g.key)} onMouseLeave={leave}>
            <button
              type="button"
              className="menu-item-h"
              data-group={g.key}
              onClick={() => setOpen(isOpen ? null : g.key)}
              aria-expanded={isOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 15px',
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                background: isOpen ? '#f4f6f8' : 'transparent',
                border: 'none',
                borderRadius: 8,
                borderBottom: '2px solid ' + (on ? accent : 'transparent'),
                color,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon kind={g.icon} color={color} />
              {g.label}
              <Chevron open={isOpen} color="#9aa5b1" />
            </button>
            {isOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 2px)',
                  left: 0,
                  minWidth: 220,
                  background: '#fff',
                  border: '1px solid #dde4ea',
                  borderRadius: 10,
                  boxShadow: '0 12px 32px rgba(24,42,62,.16)',
                  padding: 6,
                  zIndex: 120,
                }}
              >
                {g.items.map((label) => (
                  <SubItem key={label} label={label} state={itemState(label, session)} active={label === active} accent={accent} onClick={() => { onSelect(label); setOpen(null); }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {/* 右端：お気に入り ▾（登録した画面をどの画面からも開く）＋ 機能から探す（全機能の一覧と検索） */}
      <div style={{ position: 'absolute', right: 16, top: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
      <FavoritesMenu accent={accent} active={active} onNavigate={onSelect} />
      <button
        type="button"
        className="menu-item-h"
        data-menu="機能から探す"
        onClick={() => onSelect('機能から探す')}
        title="すべての機能を分類ごとに見る・キーワードで探す"
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 15px', fontSize: 14, fontWeight: active === '機能から探す' ? 700 : 600, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', border: 'none', borderRadius: 8, borderBottom: '2px solid ' + (active === '機能から探す' ? accent : 'transparent'), color: active === '機能から探す' ? accent : '#3d4a56', whiteSpace: 'nowrap' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        機能から探す
      </button>
      </div>
    </div>
  );
}

/* ---------------- 縦：アコーディオン ---------------- */
function VMenu({ accent, active, onSelect }: Omit<Props, 'orientation'>) {
  const session = useSession();
  const activeGroup = groupOf(active)?.key;
  const [opened, setOpened] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []));
  // 別の階層の項目が選ばれたら（メモからの遷移など）その階層を開く
  useEffect(() => {
    if (activeGroup) setOpened((s) => (s.has(activeGroup) ? s : new Set([...s, activeGroup])));
  }, [activeGroup]);
  const toggle = (k: string) => setOpened((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <HomeButton active={active === 'ホーム'} accent={accent} onClick={() => onSelect('ホーム')} vertical />
      {MENU_GROUPS.map((g) => {
        const on = activeGroup === g.key;
        const isOpen = opened.has(g.key);
        const color = on ? accent : '#3d4a56';
        return (
          <div key={g.key} style={{ borderRadius: 8 }}>
            <button
              type="button"
              className="menu-item-v"
              data-group={g.key}
              onClick={() => toggle(g.key)}
              aria-expanded={isOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                textAlign: 'left',
                padding: '9px 10px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color,
              }}
            >
              <Icon kind={g.icon} color={color} />
              <span style={{ flex: 1 }}>{g.label}</span>
              <Chevron open={isOpen} color="#9aa5b1" />
            </button>
            {isOpen && (
              <div style={{ padding: '0 4px 6px 4px' }}>
                {g.items.map((label) => (
                  <SubItem key={label} label={label} state={itemState(label, session)} active={label === active} accent={accent} indent onClick={() => onSelect(label)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 部品 ---------------- */
function HomeButton({ active, accent, onClick, vertical }: { active: boolean; accent: string; onClick: () => void; vertical?: boolean }) {
  const color = active ? accent : '#3d4a56';
  return (
    <button
      type="button"
      className={vertical ? 'menu-item-v' : 'menu-item-h'}
      data-menu="ホーム"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: vertical ? 9 : 7,
        width: vertical ? '100%' : undefined,
        textAlign: 'left',
        padding: vertical ? '9px 10px' : '8px 13px',
        marginBottom: vertical ? 4 : 0,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: 'pointer',
        background: active ? (vertical ? '#eef2f6' : 'transparent') : 'transparent',
        border: 'none',
        borderRadius: 8,
        borderBottom: vertical ? 'none' : '2px solid ' + (active ? accent : 'transparent'),
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>
      ホーム
    </button>
  );
}

function SubItem({ label, active, accent, indent, onClick, state = {} }: { label: string; active: boolean; accent: string; indent?: boolean; onClick: () => void; state?: { disabled?: string; tag?: string } }) {
  const off = !!state.disabled;
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    textAlign: 'left',
    padding: indent ? '9px 12px 9px 36px' : '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    cursor: off ? 'not-allowed' : 'pointer',
    background: active ? '#eef2f6' : 'transparent',
    border: 'none',
    borderRadius: 7,
    borderLeft: indent ? '3px solid ' + (active ? accent : 'transparent') : 'none',
    color: off ? '#b3bcc5' : active ? accent : '#3d4a56',
    fontWeight: active ? 700 : 500,
    whiteSpace: 'nowrap',
  };
  return (
    <button type="button" className="menu-sub" data-menu={label} onClick={off ? undefined : onClick} aria-disabled={off} title={state.disabled} style={style}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(label)}</span>
      {off && <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#f1f4f6', color: '#9aa5b1', flex: 'none' }}>利用不可</span>}
      {state.tag && <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#fff7e6', color: '#b7791f', flex: 'none' }}>{state.tag}</span>}
    </button>
  );
}


/** 大メニューのアイコン（線画） */
function Icon({ kind, color }: { kind: MenuGroup['icon']; color: string }): ReactNode {
  const p = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { flex: 'none' } };
  switch (kind) {
    case 'input':
      return <svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" /><path d="M14 3v5h5" /><path d="M9 14h6M12 11v6" /></svg>;
    case 'ledger':
      return <svg {...p}><path d="M3 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z" /><path d="M21 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z" /></svg>;
    case 'trend':
      return <svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
    case 'compare':
      return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>;
    case 'audit':
      return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11l2 2 4-4" /></svg>;
    case 'option':
      // 出納・資産・決裁（旧オプション）：財布（出納帳・資産）の線画
      return <svg {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M15 15h3" /><path d="M7 6V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" /></svg>;
    case 'graph':
      return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case 'print':
      return <svg {...p}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></svg>;
  }
}
