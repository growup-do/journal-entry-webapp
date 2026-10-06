// 確認用アカウント（クライアントの他部署の方の確認用）
//   このアカウントでログインすると、確認メモ（付箋）・確認事項・やりとりなど、プロトタイプ確認用の表示を出さない。
//   状態はブラウザに保存する（ログアウトしても保持。通常のアカウントでログインすると解除）。本番にはない仕組み。

/** 通常アカウント（GROW UP・チャイルド社の担当者用。確認メモが見える） */
export const STANDARD_ACCOUNT = { email: 'keiri@example.jp', password: 'Keiri-2026' };
export const REVIEW_ACCOUNT = { email: 'kakunin@example.jp', password: 'kakunin2026' };
/** メール・パスワードが一致するアカウントの種類。一致しなければ null（この2つ以外ではログインできない） */
export function matchAccount(email: string, password: string): 'standard' | 'review' | null {
  const e = email.trim().toLowerCase();
  if (e === STANDARD_ACCOUNT.email && password === STANDARD_ACCOUNT.password) return 'standard';
  if (e === REVIEW_ACCOUNT.email && password === REVIEW_ACCOUNT.password) return 'review';
  return null;
}
const KEY = 'proto-review-mode';

export const isReviewMode = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setReviewMode = (on: boolean) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ } };
