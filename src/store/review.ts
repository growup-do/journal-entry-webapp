// 確認用アカウント（クライアントの他部署の方の確認用）
//   このアカウントでログインすると、確認メモ（付箋）・確認事項・やりとりなど、プロトタイプ確認用の表示を出さない。
//   状態はブラウザに保存する（ログアウトしても保持。通常のアカウントでログインすると解除）。本番にはない仕組み。

export const REVIEW_ACCOUNT = { email: 'kakunin@example.jp', password: 'kakunin2026' };
const KEY = 'proto-review-mode';

export const isReviewMode = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setReviewMode = (on: boolean) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ } };
export const isReviewAccount = (email: string) => email.trim().toLowerCase() === REVIEW_ACCOUNT.email;
