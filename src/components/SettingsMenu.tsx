// 各種設定メニュー（ヘッダーの歯車 → パネル）。旧「保守」メニューを性質ごとに分類（依頼書 5.1.2）。
//   マスター設定／登録機能／保守・運用／年度の切替／年度更新 を見出しで分け、
//   取り消しできない「年度更新」は区切り線と警告色で「年度の切替」から離して配置する（5.5.2／6.4）。
//   重複していた 財産目録設定・計算書類に対する注記 は「帳票・印刷 › 別紙」に一本化（5.5.3）。
// 末尾に「サポートサイトへ」（外部サイト・別タブ）

/** サポートサイトのURL（仮。正式なURLはクライアントに確認） */
export const SUPPORT_URL = 'https://www.child.co.jp/';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { SETTINGS_GROUPS, SETTINGS_MENU, displayName, type SettingsGroup } from '../data';
import { startKindOf, useSession } from '../store/session';

interface Props {
  accent: string;
  active: string;
  onNavigate: (label: string) => void;
}

const DANGER = '#c0392b';
/** 入力区分でのみ使える設定（親区分・合算区分では無効表示） */
const ENTRY_ONLY = ['仕訳辞書', '摘要辞書', '取引先'];

export function SettingsMenu({ accent, active, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const session = useSession();
  const kind = startKindOf(session);
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

  const item = (label: string, g: SettingsGroup) => {
    const on = active === label;
    const off = ENTRY_ONLY.includes(label) && kind !== '入力区分';
    const color = off ? '#b3bcc5' : g.danger ? DANGER : on ? accent : '#22303c';
    const style: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: on ? '#eef2f6' : 'transparent', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color, fontWeight: on || g.danger ? 700 : 500, cursor: off ? 'not-allowed' : 'pointer' };
    return (
      <button key={label} type="button" className="menu-sub" data-menu={label} aria-disabled={off} title={off ? `${kind}で起動中は利用できません（入力区分ごとの設定です）` : undefined} onClick={off ? undefined : () => { setOpen(false); onNavigate(label); }} style={style}>
        <span style={{ flex: 1 }}>{displayName(label)}</span>
        {off && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#f1f4f6', color: '#9aa5b1' }}>利用不可</span>}
      </button>
    );
  };
  const group = (g: SettingsGroup) => (
    <section key={g.key} style={{ breakInside: 'avoid', marginBottom: 10, padding: g.danger ? '8px 6px 6px' : '0 0 2px', border: g.danger ? '1px solid #f2c9c2' : 'none', background: g.danger ? '#fdf5f3' : 'transparent', borderRadius: 10 }}>
      <div style={{ padding: '4px 10px 2px', fontSize: 11, fontWeight: 800, color: g.danger ? DANGER : '#5b6773', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
        {g.danger && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg>}
        {g.label}
      </div>
      {g.note && <div style={{ padding: '0 10px 4px', fontSize: 10.5, color: g.danger ? '#b5564a' : '#9aa5b1' }}>{g.note}</div>}
      {g.items.map((l) => item(l, g))}
    </section>
  );
  const by = (k: string) => SETTINGS_GROUPS.find((g) => g.key === k)!;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        data-menu="設定メニュー"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="各種設定"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px 0 8px', borderRadius: 16, background: open || isActive ? accent : '#f4f6f8', color: open || isActive ? '#fff' : '#5b6773', border: '1px solid ' + (open || isActive ? accent : '#e2e8ee'), cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        各種設定
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 600, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 90px)', overflow: 'auto', background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,62,.18)', padding: 10, zIndex: 130, fontFamily: "'Noto Sans JP', sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 10px 8px' }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>各種設定</span>
            <span style={{ fontSize: 11, color: '#9aa5b1' }}>起動中の区分：{session.division}（{kind}）</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>{group(by('master'))}</div>
            <div>
              {group(by('register'))}
              {group(by('maint'))}
              {group(by('web'))}
            </div>
          </div>
          {/* 年度：切替（元に戻せる）と 更新（取り消し不可）を左右に離し、更新側は警告色で囲む */}
          <div style={{ borderTop: '1px solid #eef2f5', marginTop: 4, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
            <div>{group(by('year'))}</div>
            <div>{group(by('update'))}</div>
          </div>
          <div style={{ height: 1, background: '#eef2f5', margin: '2px 4px 6px' }} />
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
