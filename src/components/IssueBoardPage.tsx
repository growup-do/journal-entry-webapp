// 確認事項・やりとり（?page=issues）：クライアントとのやりとりを議題単位で記録する画面。
//   左＝確認事項の一覧（状態・優先度・画面で絞り込み、検索）、右＝選んだ確認事項のスレッド。
//   打ち合わせで出た確認事項を登録 → スレッドに「対応」「解決」「提案」「質問」「回答」「メモ」を積み重ね、状態を変える。
//   データは確認メモと同じ Firebase（コレクション protoIssues）でリアルタイム共有。作成者は GROW UP／チャイルド社。

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { COPYRIGHT, backToApp, goStatic } from './Footer';
import { HOME_CHECKS, MENU_GROUPS, SETTINGS_GROUPS, displayName } from '../data';
import { ISSUE_STATUSES, REPLY_KINDS, useIssues, type Issue, type IssueStatus, type Priority, type ReplyKind } from '../issues/useIssues';

const AUTHORS = ['GROW UP', 'チャイルド社'];
const GREEN = '#1f7a52';
const STATUS_COLOR: Record<IssueStatus, { bg: string; fg: string }> = {
  未対応: { bg: '#fdeee9', fg: '#c0392b' }, 対応中: { bg: '#e8f0fb', fg: '#2c5f9e' }, 確認待ち: { bg: '#fff7e6', fg: '#b7791f' }, 解決: { bg: '#eaf5ef', fg: '#1f7a52' }, 保留: { bg: '#f1f4f6', fg: '#5b6773' },
};
const KIND_COLOR: Record<ReplyKind, { bg: string; fg: string }> = {
  対応: { bg: '#e8f0fb', fg: '#2c5f9e' }, 解決: { bg: '#eaf5ef', fg: '#1f7a52' }, 提案: { bg: '#efe6fb', fg: '#6b3fb5' }, 質問: { bg: '#fff7e6', fg: '#b7791f' }, 回答: { bg: '#e0f4f7', fg: '#0b7285' }, メモ: { bg: '#f1f4f6', fg: '#5b6773' },
};
const SCREEN_OPTIONS = ['', 'ホーム', ...MENU_GROUPS.flatMap((g) => g.items), ...HOME_CHECKS, ...SETTINGS_GROUPS.flatMap((g) => g.items), 'ログイン', '機能一覧', '画面遷移図', '全体（画面を限定しない）'];
const fmt = (t: number) => { if (!t) return ''; const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtDate = (t: number) => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const isIme = (e: React.KeyboardEvent) => e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229;

const btn = (color = '#5b6773', solid = false, small = false): CSSProperties => ({ padding: small ? '5px 10px' : '8px 14px', borderRadius: 8, border: solid ? 'none' : '1px solid ' + (color === '#5b6773' ? '#cfd8e0' : color), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: small ? 12 : 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 5 };
const Chip = ({ text, c }: { text: string; c: { bg: string; fg: string } }) => <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{text}</span>;
const Pri = ({ p }: { p: Priority }) => <span title={`優先度：${p}`} style={{ fontSize: 10.5, fontWeight: 800, color: p === '高' ? '#c0392b' : p === '中' ? '#b7791f' : '#9aa5b1' }}>{p === '高' ? '●' : p === '中' ? '◐' : '○'} {p}</span>;

export function IssueBoardPage() {
  const { issues, loaded, error, add, update, reply, removeReply, remove } = useIssues();
  const [author, setAuthor] = useState(() => { try { return localStorage.getItem('memo-author') || AUTHORS[0]; } catch { return AUTHORS[0]; } });
  useEffect(() => { try { localStorage.setItem('memo-author', author); } catch { /* ignore */ } }, [author]);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<'すべて' | '未解決' | IssueStatus>('未解決');
  const [fScreen, setFScreen] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', source: '', screen: '', priority: '中' as Priority });
  const [rKind, setRKind] = useState<ReplyKind>('対応');
  const [rText, setRText] = useState('');
  const [rStatus, setRStatus] = useState<IssueStatus | ''>('');
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: '', body: '', source: '', screen: '', priority: '中' as Priority });
  const [confirmDel, setConfirmDel] = useState<Issue | null>(null);

  const list = useMemo(() => issues.filter((i) => (fStatus === 'すべて' || (fStatus === '未解決' ? i.status !== '解決' : i.status === fStatus)) && (!fScreen || i.screen === fScreen) && (!q || [i.title, i.body, i.source, ...i.replies.map((r) => r.text)].some((t) => t.includes(q)))), [issues, fStatus, fScreen, q]);
  const cur = issues.find((i) => i.id === sel) ?? null;
  const counts = ISSUE_STATUSES.map((s) => ({ s, n: issues.filter((i) => i.status === s).length }));

  const submitNew = async () => {
    if (!draft.title.trim()) return;
    const id = await add({ title: draft.title.trim(), body: draft.body.trim(), source: draft.source.trim(), screen: draft.screen, priority: draft.priority, author });
    setDraft({ title: '', body: '', source: '', screen: '', priority: '中' }); setNewOpen(false); setSel(id);
  };
  const submitReply = async () => {
    if (!cur || !rText.trim()) return;
    await reply(cur, { kind: rKind, text: rText.trim(), author }, rStatus || undefined);
    setRText(''); setRStatus('');
  };
  const openEdit = () => { if (!cur) return; setEdit({ title: cur.title, body: cur.body, source: cur.source, screen: cur.screen, priority: cur.priority }); setEditOpen(true); };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f5f7', fontFamily: "'Noto Sans JP', sans-serif", color: '#22303c' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', background: '#fff', borderBottom: '1px solid #dde4ea', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 17 }}>確認事項・やりとり</div>
        <span style={{ fontSize: 11.5, color: '#7a8794' }}>打ち合わせやメールで出た確認事項を登録し、スレッドで対応・解決・提案を記録します（GROW UP／チャイルド社で共有）</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: '#7a8794' }}>記入者</span>
          <select value={author} onChange={(e) => setAuthor(e.target.value)} style={{ ...input, width: 140, padding: '5px 8px' }}>{AUTHORS.map((a) => <option key={a}>{a}</option>)}</select>
          <button type="button" onClick={() => setNewOpen(true)} style={btn(GREEN, true)}>＋ 確認事項を登録</button>
          <button type="button" onClick={() => goStatic('features')} style={btn()}>機能一覧</button>
          <button type="button" onClick={backToApp} style={btn()}>システムへ戻る</button>
        </div>
      </div>
      {error && <div style={{ margin: '10px 18px 0', padding: '8px 12px', background: '#fdeee9', border: '1px solid #e6cfc7', color: '#c0392b', borderRadius: 8, fontSize: 12 }}>{error}</div>}

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 16, padding: 16, alignItems: 'start' }}>
        {/* 一覧 */}
        <section style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 16 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #eef2f5', display: 'grid', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="件名・内容・スレッドを検索" autoComplete="off" style={input} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['未解決', 'すべて', ...ISSUE_STATUSES] as const).map((s) => {
                const on = fStatus === s; const n = s === 'すべて' ? issues.length : s === '未解決' ? issues.filter((i) => i.status !== '解決').length : counts.find((c) => c.s === s)?.n ?? 0;
                return <button key={s} type="button" onClick={() => setFStatus(s)} style={{ ...btn(on ? GREEN : '#5b6773', on, true), padding: '3px 9px' }}>{s} <span style={{ opacity: 0.75 }}>{n}</span></button>;
              })}
            </div>
            <select value={fScreen} onChange={(e) => setFScreen(e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12 }}>
              <option value="">画面で絞り込まない</option>
              {SCREEN_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{displayName(s)}</option>)}
            </select>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 230px)', overflow: 'auto' }}>
            {!loaded && <div style={{ padding: 24, color: '#9aa5b1', fontSize: 12.5 }}>読み込み中…</div>}
            {loaded && list.length === 0 && <div style={{ padding: 24, color: '#9aa5b1', fontSize: 12.5 }}>該当する確認事項はありません。右上の「確認事項を登録」から追加してください。</div>}
            {list.map((i) => {
              const on = i.id === sel; const last = i.replies[i.replies.length - 1];
              return (
                <button key={i.id} type="button" onClick={() => setSel(i.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid #f1f4f6', borderLeft: '3px solid ' + (on ? GREEN : 'transparent'), background: on ? '#f3f8f5' : '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#22303c' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Chip text={i.status} c={STATUS_COLOR[i.status]} /><Pri p={i.priority} />
                    {i.screen && <span style={{ fontSize: 10.5, color: '#8290a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(i.screen)}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#9aa5b1', flex: 'none' }}>{fmtDate(i.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 }}>{i.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: '#7a8794' }}>
                    <span>{i.author}</span>
                    <span>返信 {i.replies.length}</span>
                    {last && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>最新：{last.kind}「{last.text.slice(0, 24)}{last.text.length > 24 ? '…' : ''}」</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* スレッド */}
        <section style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, minHeight: 400 }}>
          {!cur ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>左の一覧から確認事項を選ぶと、スレッドを表示します。</div>
          ) : (
            <>
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #eef2f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Chip text={cur.status} c={STATUS_COLOR[cur.status]} /><Pri p={cur.priority} />
                  {cur.screen && <span style={{ fontSize: 11.5, color: '#5b6773' }}>画面：<b>{displayName(cur.screen)}</b>{!['全体（画面を限定しない）', '機能一覧', '画面遷移図', 'ログイン'].includes(cur.screen) && <a href={`${window.location.pathname}?open=${encodeURIComponent(cur.screen)}`} target="_blank" rel="noopener" style={{ marginLeft: 6, color: GREEN, fontWeight: 700, textDecoration: 'none' }}>開く ↗</a>}</span>}
                  {cur.source && <span style={{ fontSize: 11.5, color: '#5b6773' }}>出どころ：{cur.source}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#9aa5b1' }}>{cur.author}・{fmt(cur.createdAt)} 登録</span>
                </div>
                <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 8, lineHeight: 1.4 }}>{cur.title}</div>
                {cur.body && <div style={{ fontSize: 13.5, color: '#48565f', lineHeight: 1.8, marginTop: 8, whiteSpace: 'pre-wrap' }}>{cur.body}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: '#7a8794' }}>状態を変更</span>
                  {ISSUE_STATUSES.map((s) => <button key={s} type="button" onClick={() => update(cur.id, { status: s })} style={{ ...btn(cur.status === s ? STATUS_COLOR[s].fg : '#5b6773', cur.status === s, true), padding: '3px 10px' }}>{s}</button>)}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button type="button" onClick={openEdit} style={btn('#5b6773', false, true)}>編集</button>
                    <button type="button" onClick={() => setConfirmDel(cur)} style={btn('#c0392b', false, true)}>削除</button>
                  </span>
                </div>
              </div>

              {/* スレッド本体 */}
              <div style={{ padding: '14px 20px', display: 'grid', gap: 10 }}>
                {cur.replies.length === 0 && <div style={{ fontSize: 12.5, color: '#9aa5b1' }}>まだ返信はありません。下の欄から「対応した」「解決した」「こういうのはどうか」を記録してください。</div>}
                {cur.replies.map((r) => {
                  const mine = r.author === author;
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', background: r.author === 'GROW UP' ? '#e8f0fb' : '#fdeef3', color: r.author === 'GROW UP' ? '#2c5f9e' : '#b0426a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{r.author === 'GROW UP' ? 'G' : 'C'}</div>
                      <div style={{ flex: 1, minWidth: 0, border: '1px solid #e2e8ee', borderRadius: 12, padding: '9px 12px', background: r.kind === '解決' ? '#f3f9f5' : r.kind === '提案' ? '#faf7ff' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Chip text={r.kind} c={KIND_COLOR[r.kind]} />
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{r.author}</span>
                          <span style={{ fontSize: 11, color: '#9aa5b1' }}>{fmt(r.createdAt)}</span>
                          {mine && <button type="button" onClick={() => removeReply(cur, r.id)} title="この返信を削除" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#b3bcc5', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>削除</button>}
                        </div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{r.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 返信欄 */}
              <div style={{ margin: '0 20px 18px', padding: 12, border: '1px solid #dde4ea', borderRadius: 12, background: '#fbfcfd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: '#7a8794' }}>種類</span>
                  {REPLY_KINDS.map((k) => <button key={k} type="button" onClick={() => setRKind(k)} style={{ ...btn(rKind === k ? KIND_COLOR[k].fg : '#5b6773', rKind === k, true), padding: '3px 10px' }}>{k}</button>)}
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#7a8794' }}>同時に状態を</span>
                  <select value={rStatus} onChange={(e) => setRStatus(e.target.value as IssueStatus | '')} style={{ ...input, width: 140, padding: '4px 8px', fontSize: 12 }}>
                    <option value="">変えない{rKind === '解決' ? '（解決にする）' : ''}</option>
                    {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}にする</option>)}
                  </select>
                </div>
                <textarea value={rText} onChange={(e) => setRText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isIme(e)) { e.preventDefault(); void submitReply(); } }} rows={3} placeholder={rKind === '提案' ? 'こういうのはどうか、という案を書きます' : rKind === '解決' ? 'どう解決したかを書きます（状態が「解決」になります）' : rKind === '対応' ? 'どう対応したかを書きます' : '内容を書きます'} style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#9aa5b1' }}>{author} として投稿　（⌘／Ctrl＋Enter で送信）</span>
                  <button type="button" disabled={!rText.trim()} onClick={() => void submitReply()} style={{ ...btn(GREEN, true), marginLeft: 'auto', opacity: rText.trim() ? 1 : 0.5 }}>スレッドに追加</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      <div style={{ padding: '6px 18px', fontSize: 10.5, color: '#8290a0', background: '#fff', borderTop: '1px solid #eef2f5' }}>{COPYRIGHT}</div>

      {/* 新規登録 */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} width={640} title="確認事項を登録" strict>
        <IssueForm v={draft} onChange={setDraft} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 22px 18px' }}>
          <button type="button" onClick={() => setNewOpen(false)} style={btn()}>キャンセル</button>
          <button type="button" disabled={!draft.title.trim()} onClick={() => void submitNew()} style={{ ...btn(GREEN, true), opacity: draft.title.trim() ? 1 : 0.5 }}>登録</button>
        </div>
      </Modal>
      {/* 編集 */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} width={640} title="確認事項を編集" strict>
        <IssueForm v={edit} onChange={setEdit} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 22px 18px' }}>
          <button type="button" onClick={() => setEditOpen(false)} style={btn()}>キャンセル</button>
          <button type="button" disabled={!edit.title.trim()} onClick={() => { if (cur) void update(cur.id, { title: edit.title.trim(), body: edit.body.trim(), source: edit.source.trim(), screen: edit.screen, priority: edit.priority }); setEditOpen(false); }} style={{ ...btn(GREEN, true), opacity: edit.title.trim() ? 1 : 0.5 }}>保存</button>
        </div>
      </Modal>
      {/* 削除確認 */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} width={460} title="確認事項を削除" strict>
        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>「{confirmDel?.title}」とスレッド（{confirmDel?.replies.length ?? 0} 件）を削除します。元に戻せません。</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => setConfirmDel(null)} style={btn()}>キャンセル</button>
            <button type="button" onClick={() => { if (confirmDel) { void remove(confirmDel.id); if (sel === confirmDel.id) setSel(null); } setConfirmDel(null); }} style={btn('#c0392b', true)}>削除する</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function IssueForm({ v, onChange }: { v: { title: string; body: string; source: string; screen: string; priority: Priority }; onChange: (x: typeof v) => void }) {
  return (
    <div style={{ padding: '14px 22px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ gridColumn: 'span 2' }}><span style={lbl}>件名（確認事項）</span><input value={v.title} onChange={(e) => onChange({ ...v, title: e.target.value })} placeholder="例：仕訳一覧の付箋は1色でよいか" autoComplete="off" autoFocus style={input} /></div>
      <div style={{ gridColumn: 'span 2' }}><span style={lbl}>内容・経緯</span><textarea value={v.body} onChange={(e) => onChange({ ...v, body: e.target.value })} rows={4} placeholder="打ち合わせで出た話、背景、決めたいこと" style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} /></div>
      <div><span style={lbl}>出どころ</span><input value={v.source} onChange={(e) => onChange({ ...v, source: e.target.value })} placeholder="例：10/2 打ち合わせ、メール、確認メモ #12" autoComplete="off" style={input} /></div>
      <div><span style={lbl}>優先度</span><select value={v.priority} onChange={(e) => onChange({ ...v, priority: e.target.value as Priority })} style={input}>{(['高', '中', '低'] as Priority[]).map((p) => <option key={p}>{p}</option>)}</select></div>
      <div style={{ gridColumn: 'span 2' }}><span style={lbl}>関係する画面（任意）</span><select value={v.screen} onChange={(e) => onChange({ ...v, screen: e.target.value })} style={input}><option value="">指定しない</option>{SCREEN_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{displayName(s)}</option>)}</select></div>
    </div>
  );
}
