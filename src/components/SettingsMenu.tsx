// 各種設定メニュー（ヘッダーの歯車 → パネル）。旧「保守」メニューを性質ごとに分類（依頼書 5.1.2）。
//   マスター設定／登録機能／保守・運用／年度更新 を見出しで分け、
//   取り消しできない「年度更新」は警告色で囲んで離して配置する（5.5.2／6.4）。参照年度の切替はヘッダーの「会計期間」で行う。
//   重複していた 財産目録設定・計算書類に対する注記 は「帳票・印刷 › 別紙」に一本化（5.5.3）。

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
    <section key={g.key} style={{ breakInside: 'avoid', border: '1px solid ' + (g.danger ? '#f2c9c2' : '#dde4ea'), borderRadius: 10, overflow: 'hidden', background: g.danger ? '#fdf5f3' : '#fff' }}>
      <div style={{ padding: '7px 12px', background: g.danger ? '#f9e4df' : '#eef2f6', borderBottom: '1px solid ' + (g.danger ? '#f2c9c2' : '#dde4ea') }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: g.danger ? DANGER : '#22303c', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
          {g.danger && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg>}
          {g.label}
        </div>
        {g.note && <div style={{ fontSize: 10.5, color: g.danger ? '#b5564a' : '#7a8794', marginTop: 1 }}>{g.note}</div>}
      </div>
      <div style={{ padding: 6 }}>{g.items.map((l) => item(l, g))}</div>
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
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 860, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 90px)', overflow: 'auto', background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,62,.18)', padding: 10, zIndex: 130, fontFamily: "'Noto Sans JP', sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 10px 8px' }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>各種設定</span>
            <span style={{ fontSize: 11, color: '#9aa5b1' }}>起動中の区分：{session.division}（{kind}）</span>
          </div>
          {/* 3列で高さをそろえる：左＝マスター設定（9項目）、中＝保守・運用＋Web版の追加案、右＝ユーザー・権限＋登録機能＋年度更新（警告色。右下に離して置く） */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
            {group(by('master'))}
            <div style={{ display: 'grid', gap: 12 }}>
              {group(by('maint'))}
              {group(by('web'))}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {group(by('users'))}
              {group(by('register'))}
              {group(by('update'))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
