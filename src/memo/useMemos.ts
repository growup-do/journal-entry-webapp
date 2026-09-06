// 確認メモのストア（Firestore コレクション 'protoMemos'・リアルタイム同期）
// GROW UP ⇄ クライアント間の「この仕様で合っていますか？」を画面上に貼って残すための仕組み。
// 解決したメモは status='resolved' にして非表示（履歴として残す）。

import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export type MemoStatus = 'open' | 'resolved';

export interface Memo {
  id: string;
  /** どの画面に貼ったか（例 'form:単一入力'） */
  screen: string;
  /** 横位置：ページ幅に対する % */
  x: number;
  /** 縦位置：ページ上端からの px */
  y: number;
  text: string;
  author: string;
  reply: string;
  status: MemoStatus;
  createdAt: number;
  resolvedAt: number | null;
}

const uid = () => (crypto?.randomUUID?.() ?? 'm-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

function fbErr(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'メモの保存が拒否されました（Firestore ルール）。';
  if (code.includes('unavailable') || code.includes('network')) return '通信に失敗しました。ネットワークをご確認ください。';
  return 'メモの保存でエラー: ' + ((e as Error)?.message ?? String(e));
}

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'protoMemos'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const r = d.data() as Partial<Memo>;
          return {
            id: d.id,
            screen: r.screen ?? '',
            x: r.x ?? 50,
            y: r.y ?? 200,
            text: r.text ?? '',
            author: r.author ?? '',
            reply: r.reply ?? '',
            status: (r.status ?? 'open') as MemoStatus,
            createdAt: r.createdAt ?? 0,
            resolvedAt: r.resolvedAt ?? null,
          };
        });
        list.sort((a, b) => a.createdAt - b.createdAt);
        setMemos(list);
        setLoaded(true);
        setError('');
      },
      (err) => {
        setError(fbErr(err));
        setLoaded(true);
      },
    );
    return unsub;
  }, []);

  const add = useCallback(async (m: Pick<Memo, 'screen' | 'x' | 'y' | 'text' | 'author'>) => {
    const id = uid();
    try {
      await setDoc(doc(db, 'protoMemos', id), { ...m, reply: '', status: 'open', createdAt: Date.now(), resolvedAt: null });
    } catch (e) {
      setError(fbErr(e));
    }
    return id;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Omit<Memo, 'id'>>) => {
    try {
      await updateDoc(doc(db, 'protoMemos', id), patch);
    } catch (e) {
      setError(fbErr(e));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'protoMemos', id));
    } catch (e) {
      setError(fbErr(e));
    }
  }, []);

  return { memos, loaded, error, add, update, remove };
}
