// 確認メモ（フロート付箋）
// 画面上の任意の場所にピンを置き、クライアントへの確認事項を残す。クライアント側は回答を書き込める。
// 解決してプロトタイプに反映したら「解決済み」にすると非表示になる（「解決済みも表示」で履歴を確認可）。
// 位置は「ページ幅に対する%（横）」「ページ上端からのpx（縦）」で保存。全閲覧者にリアルタイム同期。

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useMemos, type Memo } from './useMemos';

const AMBER = '#d97706';
const AMBER_SOFT = '#fff7e6';
const AUTHORS = ['GROW UP', 'チャイルド社'];

interface Props {
  /** 現在の画面キー（例 'form:単一入力'） */
  screenKey: string;
  /** 画面キー → 表示名 */
  screenLabel: (key: string) => string;
  /** メモ一覧から別画面のメモを選んだときの遷移 */
  onNavigate: (key: string) => void;
}

type Numbered = Memo & { no: number };

const fmtDate = (ts: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Cmd/Ctrl+Enter で保存（IME変換中は無視） */
const onCmdEnter = (fn: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
    e.preventDefault();
    fn();
  }
};

export function MemoLayer({ screenKey, screenLabel, onNavigate }: Props) {
  const { memos, error, add, update, remove } = useMemos();
  const [panelOpen, setPanelOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem('memo-author') || AUTHORS[0];
    } catch {
      return AUTHORS[0];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('memo-author', author);
    } catch {
      /* 保存できない環境は無視 */
    }
  }, [author]);

  // Esc で配置中止・ポップオーバーを閉じる
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlacing(false);
        setDraft(null);
        setOpenId(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const numbered: Numbered[] = useMemo(() => memos.map((m, i) => ({ ...m, no: i + 1 })), [memos]);
  const openCount = memos.filter((m) => m.status === 'open').length;
  const pinsHere = numbered.filter((m) => m.screen === screenKey && (showResolved || m.status === 'open'));
  const openMemo = numbered.find((m) => m.id === openId) ?? null;
  const listed = numbered.filter((m) => showResolved || m.status === 'open');

  // ポップオーバーを開いたとき、回答欄に既存の回答を読み込む
  useEffect(() => {
    setReplyDraft(openMemo?.reply ?? '');
    // openId が変わったときだけ再読込（他者の編集で上書きしない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const startPlacing = () => {
    setPlacing(true);
    setDraft(null);
    setOpenId(null);
    setPanelOpen(false);
  };
  const onPlaceClick = (e: MouseEvent<HTMLDivElement>) => {
    const x = (e.pageX / document.documentElement.scrollWidth) * 100;
    setDraft({ x: Math.min(98, Math.max(2, x)), y: e.pageY });
    setDraftText('');
    setPlacing(false);
  };
  const saveDraft = async () => {
    if (!draft || !draftText.trim()) return;
    const id = await add({ screen: screenKey, x: draft.x, y: draft.y, text: draftText.trim(), author });
    setDraft(null);
    setOpenId(id);
  };
  const goTo = (m: Numbered) => {
    if (m.screen !== screenKey) onNavigate(m.screen);
    setPanelOpen(false);
    setOpenId(m.id);
    setTimeout(() => window.scrollTo({ top: Math.max(0, m.y - 220), behavior: 'smooth' }), 60);
  };
  const resolve = (m: Numbered) => update(m.id, { status: 'resolved', resolvedAt: Date.now() });
  const reopen = (m: Numbered) => update(m.id, { status: 'open', resolvedAt: null });
  const saveReply = (m: Numbered) => update(m.id, { reply: replyDraft.trim() });
  const del = (m: Numbered) => {
    if (confirm(`メモ #${m.no} を削除しますか？（取り消せません）`)) {
      remove(m.id);
      setOpenId(null);
    }
  };

  const popoverPos = (x: number, y: number): CSSProperties => ({
    position: 'absolute',
    left: `${x}%`,
    top: y + 12,
    transform: x > 62 ? 'translateX(-100%)' : 'none',
    width: 330,
    zIndex: 285,
    pointerEvents: 'auto',
  });

  return (
    <>
      {/* ピン（ページ座標に絶対配置） */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 0, zIndex: 280, pointerEvents: 'none' }}>
        {pinsHere.map((m) => {
          const resolved = m.status === 'resolved';
          const active = m.id === openId;
          return (
            <button
              key={m.id}
              type="button"
              title={m.text}
              onClick={() => setOpenId(active ? null : m.id)}
              style={{
                position: 'absolute',
                left: `${m.x}%`,
                top: m.y,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'auto',
                width: 28,
                height: 28,
                borderRadius: '50% 50% 50% 4px',
                border: '2px solid #fff',
                background: resolved ? '#9aa5b1' : AMBER,
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: active ? `0 0 0 4px rgba(217,119,6,.25), 0 4px 12px rgba(0,0,0,.25)` : '0 4px 12px rgba(0,0,0,.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {m.no}
            </button>
          );
        })}

        {/* 既存メモのポップオーバー */}
        {openMemo && (
          <div style={{ ...popoverPos(openMemo.x, openMemo.y), ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={noBadge(openMemo.status === 'resolved')}>#{openMemo.no}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22303c' }}>{openMemo.author || '—'}</span>
              <span style={{ fontSize: 11, color: '#9aa5b1' }}>{fmtDate(openMemo.createdAt)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: openMemo.status === 'resolved' ? '#f1f4f6' : AMBER_SOFT, color: openMemo.status === 'resolved' ? '#7a8794' : AMBER }}>
                {openMemo.status === 'resolved' ? '解決済み' : '確認中'}
              </span>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#22303c', marginBottom: 12 }}>{openMemo.text}</div>

            <div style={{ borderTop: '1px solid #eef2f5', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 5 }}>回答・コメント</div>
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={onCmdEnter(() => saveReply(openMemo))}
                placeholder="回答を入力（⌘/Ctrl + Enter で保存）"
                rows={3}
                style={textareaStyle}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => saveReply(openMemo)} disabled={replyDraft.trim() === (openMemo.reply || '')} style={btn(AMBER, true)}>
                  回答を保存
                </button>
                {openMemo.status === 'open' ? (
                  <button type="button" onClick={() => resolve(openMemo)} style={btn('#1f7a52', true)}>
                    ✓ 解決済みにする
                  </button>
                ) : (
                  <button type="button" onClick={() => reopen(openMemo)} style={btn('#5b6773')}>
                    未解決に戻す
                  </button>
                )}
                <button type="button" onClick={() => del(openMemo)} style={{ ...btn('#c0392b'), marginLeft: 'auto' }}>
                  削除
                </button>
                <button type="button" onClick={() => setOpenId(null)} style={btn('#5b6773')}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 新規メモのポップオーバー */}
        {draft && (
          <>
            <div
              style={{
                position: 'absolute',
                left: `${draft.x}%`,
                top: draft.y,
                transform: 'translate(-50%, -100%)',
                width: 28,
                height: 28,
                borderRadius: '50% 50% 50% 4px',
                border: '2px dashed #fff',
                background: AMBER,
                boxShadow: '0 4px 12px rgba(0,0,0,.25)',
                opacity: 0.8,
              }}
            />
            <div style={{ ...popoverPos(draft.x, draft.y), ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>確認メモを追加</span>
                <select value={author} onChange={(e) => setAuthor(e.target.value)} style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'inherit', padding: '3px 6px', border: '1px solid #cfd8e0', borderRadius: 6, background: '#fff' }}>
                  {AUTHORS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                autoFocus
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={onCmdEnter(saveDraft)}
                placeholder="確認したい内容を入力（⌘/Ctrl + Enter で保存）"
                rows={4}
                style={textareaStyle}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDraft(null)} style={btn('#5b6773')}>
                  キャンセル
                </button>
                <button type="button" onClick={saveDraft} disabled={!draftText.trim()} style={btn(AMBER, true)}>
                  保存
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 配置モードのオーバーレイ */}
      {placing && (
        <div onClick={onPlaceClick} style={{ position: 'fixed', inset: 0, zIndex: 290, cursor: 'crosshair', background: 'rgba(217,119,6,.06)' }}>
          <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: '#22303c', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}>
            メモを貼りたい場所をクリック（Esc で中止）
          </div>
        </div>
      )}

      {/* 一覧パネル */}
      {panelOpen && (
        <div style={{ position: 'fixed', right: 18, bottom: 70, width: 350, maxHeight: '62vh', zIndex: 300, ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #eef2f5' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>確認メモ</span>
            <span style={{ fontSize: 11.5, color: '#8290a0' }}>未解決 {openCount} 件</span>
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#5b6773', cursor: 'pointer' }}>
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
              解決済みも表示
            </label>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {listed.length === 0 && <div style={{ padding: '28px 14px', textAlign: 'center', color: '#9aa5b1', fontSize: 12.5 }}>{showResolved ? 'メモはありません。' : '未解決のメモはありません。'}</div>}
            {listed.map((m) => {
              const resolved = m.status === 'resolved';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => goTo(m)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f1f4f6', background: m.id === openId ? AMBER_SOFT : '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: resolved ? 0.6 : 1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={noBadge(resolved)}>#{m.no}</span>
                    <span style={{ fontSize: 11, color: '#8290a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{screenLabel(m.screen)}</span>
                    {m.reply && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#1f7a52', fontWeight: 700, flex: 'none' }}>回答あり</span>}
                    {resolved && <span style={{ marginLeft: m.reply ? 6 : 'auto', fontSize: 10.5, color: '#7a8794', fontWeight: 700, flex: 'none' }}>解決済み</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#22303c', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.text}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div style={{ position: 'fixed', right: 18, bottom: panelOpen ? 'calc(62vh + 80px)' : 70, zIndex: 301, background: '#fdeee9', border: '1px solid #e6cfc7', color: '#c0392b', padding: '8px 12px', borderRadius: 8, fontSize: 12, maxWidth: 350 }}>
          {error}
        </div>
      )}

      {/* ツールバー（右下固定） */}
      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 300, display: 'flex', gap: 8 }}>
        <button
          type="button"
          title="このシステムの機能一覧を別タブで開く"
          onClick={() => window.open(window.location.origin + window.location.pathname + '?page=features', '_blank', 'noopener')}
          style={{ ...toolBtn, background: '#fff', color: '#22303c', border: '1px solid #dde4ea' }}
        >
          機能一覧 ↗
        </button>
        <button type="button" onClick={placing ? () => setPlacing(false) : startPlacing} style={{ ...toolBtn, background: placing ? '#22303c' : '#fff', color: placing ? '#fff' : AMBER, border: `1px solid ${placing ? '#22303c' : '#f3d9b0'}` }}>
          {placing ? '配置を中止' : '＋ メモを置く'}
        </button>
        <button type="button" onClick={() => setPanelOpen((o) => !o)} style={{ ...toolBtn, background: panelOpen ? AMBER : '#fff', color: panelOpen ? '#fff' : '#22303c', border: `1px solid ${panelOpen ? AMBER : '#dde4ea'}` }}>
          確認メモ
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: panelOpen ? '#fff' : AMBER, color: panelOpen ? AMBER : '#fff', fontSize: 11.5, fontWeight: 700 }}>{openCount}</span>
        </button>
      </div>
    </>
  );
}

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #dde4ea',
  borderRadius: 12,
  boxShadow: '0 12px 36px rgba(24,42,62,.22)',
  padding: 14,
  fontFamily: "'Noto Sans JP', sans-serif",
  color: '#22303c',
};
const textareaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  lineHeight: 1.6,
  resize: 'vertical',
  outline: 'none',
  color: '#22303c',
};
const toolBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 40,
  padding: '0 16px',
  borderRadius: 11,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 6px 22px rgba(30,50,70,.16)',
};
const noBadge = (resolved: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  height: 20,
  padding: '0 6px',
  borderRadius: 10,
  background: resolved ? '#9aa5b1' : AMBER,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  flex: 'none',
});
const btn = (color: string, solid = false): CSSProperties => ({
  padding: '6px 11px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: solid ? color : '#fff',
  color: solid ? '#fff' : color,
  border: `1px solid ${solid ? color : '#cfd8e0'}`,
});
