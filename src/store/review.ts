// ログインできるアカウント（プロトタイプのテスト用。本番にはない仕組み）
//   通常アカウント：GROW UP・チャイルド社の担当者用。管理者（me）としてログインし、確認メモが見える。
//   確認用アカウント（クライアントの他部署の方の確認用）：このアカウントでログインすると、確認メモ（付箋）・確認事項・やりとりなど、
//     プロトタイプ確認用の表示を出さない。状態はブラウザに保存する（ログアウトしても保持。ほかのアカウントでログインすると解除）。
//   機能制限のあるアカウント（確認事項「小口、預金、減価について」）：園長／小口 担当者／預金 担当者／資産 担当者。
//     メールアドレスは store/access.ts の ACCOUNTS。ログインすると、そのアカウントの使える機能だけを表示する。

import { ACCOUNTS } from './access';

/** 通常アカウント（GROW UP・チャイルド社の担当者用。確認メモが見える） */
export const STANDARD_ACCOUNT = { email: 'keiri@example.jp', password: 'Keiri-2026' };
export const REVIEW_ACCOUNT = { email: 'kakunin@example.jp', password: 'kakunin2026' };
/** 機能制限のあるアカウントのパスワード（アカウントの id → パスワード） */
export const MEMBER_PASSWORDS: Record<string, string> = {
  encho: 'Encho-2026',
  koguchi: 'Koguchi-2026',
  yokin: 'Yokin-2026',
  shisan: 'Shisan-2026',
};

export interface LoginHit {
  /** review のときは確認用の表示を出さない */
  kind: 'standard' | 'review';
  /** ログインしたアカウント（store/access.ts の ACCOUNTS の id） */
  id: string;
}

/** メール・パスワードが一致するアカウント。一致しなければ null（ここにあるアカウント以外ではログインできない） */
export function matchAccount(email: string, password: string): LoginHit | null {
  const e = email.trim().toLowerCase();
  if (e === STANDARD_ACCOUNT.email && password === STANDARD_ACCOUNT.password) return { kind: 'standard', id: 'me' };
  if (e === REVIEW_ACCOUNT.email && password === REVIEW_ACCOUNT.password) return { kind: 'review', id: 'me' };
  const member = ACCOUNTS.find((a) => a.id !== 'me' && a.email === e);
  if (member && MEMBER_PASSWORDS[member.id] === password) return { kind: 'standard', id: member.id };
  return null;
}
const KEY = 'proto-review-mode';

export const isReviewMode = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setReviewMode = (on: boolean) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ } };
