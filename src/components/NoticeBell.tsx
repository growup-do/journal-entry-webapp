// お知らせのベル（ヘッダー右上、ユーザーアイコンの左。確認メモ #151）。
//   お知らせはホームに常時表示せず、ここから開く。未読があるあいだ、ベルに件数のバッジを出す。
//   一覧はタグで絞り込める。件名を押すと本文を開き、その時点で既読にする。
//   入力内容を持たない一覧なので、Esc と外側のクリックで閉じる。

import { useEffect, useRef, useState } from 'react';
import { HOME_NOTICES } from '../data';
import { markAllNoticesRead, markNoticeRead, noticeId, useNoticeRead } from '../store/notices';

const TAG_COLOR: Record<string, { bg: string; fg: string }> = {
  システム: { bg: '#e8f0fb', fg: '#2c5f9e' },
  法改正: { bg: '#fdeee9', fg: '#c0392b' },
  保守: { bg: '#fff1b8', fg: '#8a6d00' },
  お知らせ: { bg: '#eaf5ef', fg: '#1f7a52' },
};
const UNREAD = '#d0402b';

interface Props {
  accent: string;
}

export function NoticeBell({ accent }: Props) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState('すべて');
  const [expanded, setExpanded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const read = useNoticeRead();

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

  const all = HOME_NOTICES.map((n) => ({ ...n, id: noticeId(n) })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const unread = all.filter((n) => !read.includes(n.id)).length;
  const tags = ['すべて', ...Array.from(new Set(HOME_NOTICES.map((n) => n.tag)))];
  const list = all.filter((n) => tag === 'すべて' || n.tag === tag);
  const label = unread > 0 ? `お知らせ（未読 ${unread} 件）` : 'お知らせ（未読はありません）';

  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        data-notice-bell
        data-unread={unread}
        onClick={() => { setOpen((o) => !o); setExpanded(null); }}
        aria-expanded={open}
        aria-label={label}
        title={label}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: open ? accent : '#f4f6f8', color: open ? '#fff' : unread > 0 ? '#22303c' : '#5b6773', border: '1px solid ' + (open ? accent : '#e2e8ee'), cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span data-notice-badge aria-hidden style={{ position: 'absolute', top: -5, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: UNREAD, color: '#fff', fontSize: 12, fontWeight: 800, lineHeight: '18px', textAlign: 'center', boxShadow: '0 0 0 2px #fff', fontVariantNumeric: 'tabular-nums' }}>{unread}</span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="お知らせ" data-notice-panel style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 460, maxWidth: 'calc(100vw - 24px)', background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, boxShadow: '0 12px 32px rgba(24,42,62,.18)', zIndex: 130, fontFamily: "'Noto Sans JP', sans-serif", color: '#22303c', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px', borderBottom: '1px solid #eef2f5' }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>お知らせ</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: unread > 0 ? UNREAD : '#9aa5b1' }}>{unread > 0 ? `未読 ${unread} 件` : '未読はありません'}</span>
            <button type="button" data-notice-readall disabled={unread === 0} onClick={markAllNoticesRead} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 7, border: '1px solid ' + (unread === 0 ? '#e2e8ee' : accent), background: '#fff', color: unread === 0 ? '#b3bcc5' : accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: unread === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>すべて既読にする</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px 8px' }}>
            {tags.map((t) => {
              const on = tag === t;
              const c = TAG_COLOR[t];
              return (
                <button key={t} type="button" className="chip" aria-pressed={on} onClick={() => { setTag(t); setExpanded(null); }} style={{ padding: '4px 10px', borderRadius: 13, border: '1px solid ' + (on ? accent : '#dde4ea'), background: on ? accent : c ? c.bg : '#fff', color: on ? '#fff' : c ? c.fg : '#5b6773', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {t}<span style={{ marginLeft: 4, opacity: 0.75 }}>{t === 'すべて' ? all.length : all.filter((n) => n.tag === t).length}</span>
                </button>
              );
            })}
          </div>
          <div style={{ maxHeight: 'min(56vh, 420px)', overflow: 'auto', borderTop: '1px solid #f1f4f6' }}>
            {list.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>該当するお知らせはありません。</div>}
            {list.map((n) => {
              const c = TAG_COLOR[n.tag];
              const on = expanded === n.id;
              const isNew = !read.includes(n.id);
              return (
                <div key={n.id} data-notice-item data-notice-unread={isNew} style={{ borderBottom: '1px solid #f1f4f6', background: on ? '#f8fafc' : isNew ? '#fffaf3' : 'transparent' }}>
                  <button type="button" onClick={() => { setExpanded(on ? null : n.id); markNoticeRead(n.id); }} aria-expanded={on} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) auto', alignItems: 'start', gap: 8, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', color: '#22303c' }}>
                    <span aria-hidden title={isNew ? '未読' : undefined} style={{ width: 8, height: 8, borderRadius: '50%', background: isNew ? UNREAD : 'transparent', marginTop: 6 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9aa5b1' }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n.date}</span>
                        <span style={{ padding: '1px 7px', borderRadius: 8, background: c.bg, color: c.fg, fontWeight: 700 }}>{n.tag}</span>
                        {isNew && <span style={{ color: UNREAD, fontWeight: 700 }}>未読</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: isNew ? 700 : 500, lineHeight: 1.5, marginTop: 3 }}>{n.title}</span>
                    </span>
                    <span aria-hidden style={{ color: '#9aa5b1', transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s', marginTop: 2 }}>▾</span>
                  </button>
                  {on && <div style={{ padding: '0 14px 12px 32px', fontSize: 14, color: '#48565f', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{n.body}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ padding: '8px 14px', fontSize: 12, color: '#9aa5b1', background: '#fbfcfd' }}>件名を押すと本文を開き、既読にします。</div>
        </div>
      )}
    </div>
  );
}
