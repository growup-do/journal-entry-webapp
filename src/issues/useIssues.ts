// 確認事項・やりとりのストア（Firestore コレクション 'protoMemos' に type:'issue' で保存・リアルタイム同期）
//   ※ Firestore ルールが protoMemos にしか開いていないため同じコレクションを共用する。確認メモ側（useMemos）は type のある文書を読み飛ばす。
//   打ち合わせなどで出た確認事項を登録し、スレッドで「対応した」「解決した」「提案」などを積み重ねる。
//   確認メモ（画面上の付箋）とは別に、議題単位で経緯を残すためのもの。

import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../memo/firebase';

export type IssueStatus = '未対応' | '対応中' | '確認待ち' | '解決' | '保留';
export const ISSUE_STATUSES: IssueStatus[] = ['未対応', '対応中', '確認待ち', '解決', '保留'];
export type ReplyKind = '対応' | '解決' | '提案' | '質問' | '回答' | 'メモ';
export const REPLY_KINDS: ReplyKind[] = ['対応', '解決', '提案', '質問', '回答', 'メモ'];
export type Priority = '高' | '中' | '低';

export interface Reply { id: string; kind: ReplyKind; text: string; author: string; createdAt: number }
export interface Issue {
  id: string;
  title: string;
  body: string;
  /** 出どころ（例：10/2 打ち合わせ、メール、確認メモ #12） */
  source: string;
  /** 関係する画面（画面キー。空なら全体） */
  screen: string;
  status: IssueStatus;
  priority: Priority;
  author: string;
  createdAt: number;
  updatedAt: number;
  replies: Reply[];
}

const uid = () => (crypto?.randomUUID?.() ?? 'i-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
function fbErr(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return '保存が拒否されました（Firestore ルール）。';
  if (code.includes('unavailable') || code.includes('network')) return '通信に失敗しました。ネットワークをご確認ください。';
  return '保存でエラー: ' + ((e as Error)?.message ?? String(e));
}

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'protoMemos'),
      (snap) => {
        const list = snap.docs.filter((d) => (d.data() as { type?: string }).type === 'issue').map((d) => {
          const r = d.data() as Partial<Issue>;
          return {
            id: d.id,
            title: r.title ?? '', body: r.body ?? '', source: r.source ?? '', screen: r.screen ?? '',
            status: (r.status ?? '未対応') as IssueStatus, priority: (r.priority ?? '中') as Priority,
            author: r.author ?? '', createdAt: r.createdAt ?? 0, updatedAt: r.updatedAt ?? r.createdAt ?? 0,
            replies: (r.replies ?? []).map((x) => ({ id: x.id ?? uid(), kind: (x.kind ?? 'メモ') as ReplyKind, text: x.text ?? '', author: x.author ?? '', createdAt: x.createdAt ?? 0 })),
          } as Issue;
        });
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        setIssues(list); setLoaded(true); setError('');
      },
      (err) => { setError(fbErr(err)); setLoaded(true); },
    );
    return unsub;
  }, []);

  const add = useCallback(async (v: Pick<Issue, 'title' | 'body' | 'source' | 'screen' | 'priority' | 'author'>) => {
    const id = uid();
    const now = Date.now();
    try { await setDoc(doc(db, 'protoMemos', id), { type: 'issue', ...v, status: '未対応', createdAt: now, updatedAt: now, replies: [] }); } catch (e) { setError(fbErr(e)); }
    return id;
  }, []);
  const update = useCallback(async (id: string, patch: Partial<Omit<Issue, 'id'>>) => {
    try { await updateDoc(doc(db, 'protoMemos', id), { ...patch, updatedAt: Date.now() }); } catch (e) { setError(fbErr(e)); }
  }, []);
  /** スレッドに返信を追加。種類が「解決」なら状態も解決にする（任意で状態を同時変更） */
  const reply = useCallback(async (issue: Issue, r: Pick<Reply, 'kind' | 'text' | 'author'>, status?: IssueStatus) => {
    const next: Reply = { id: uid(), createdAt: Date.now(), ...r };
    const patch: Partial<Issue> = { replies: [...issue.replies, next] };
    if (status) patch.status = status; else if (r.kind === '解決') patch.status = '解決';
    await update(issue.id, patch);
  }, [update]);
  const removeReply = useCallback(async (issue: Issue, replyId: string) => { await update(issue.id, { replies: issue.replies.filter((x) => x.id !== replyId) }); }, [update]);
  const remove = useCallback(async (id: string) => { try { await deleteDoc(doc(db, 'protoMemos', id)); } catch (e) { setError(fbErr(e)); } }, []);

  return { issues, loaded, error, add, update, reply, removeReply, remove };
}
