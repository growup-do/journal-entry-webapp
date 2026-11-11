// アカウントごとの機能制限（確認事項・やりとり「小口、預金、減価について」）。
//   現行システムでは、小口現金・預金出納は会計本体を起動しなくても単独で起動できる（減価償却も単独起動に改良予定）。
//   Web 版では、アカウントごとに「使える機能」を決める：
//     会計本体 … 伝票入力・帳簿・帳票・調査・各種設定など、会計のすべての機能
//     小口現金／預金出納／減価償却 … それぞれの機能だけ
//   会計本体が使えないアカウントは、会計本体では区分変更（区分・年度の切替）だけができ、
//   許可された 小口現金／預金出納／減価償却 だけを開ける。メニューにも許可された機能だけを出す。

export type AccessKey = 'core' | 'petty' | 'bank' | 'dep';
export type Access = Record<AccessKey, boolean>;

export const ACCESS_ITEMS: { key: AccessKey; label: string; short: string; page?: string; note: string }[] = [
  { key: 'core', label: '会計本体', short: '会計', note: '伝票入力・帳簿・帳票・調査・各種設定など、会計のすべての機能' },
  { key: 'petty', label: '小口現金', short: '小口', page: '小口現金', note: '小口現金出納帳' },
  { key: 'bank', label: '預金出納', short: '預金', page: '預金出納', note: '預金出納帳' },
  { key: 'dep', label: '減価償却', short: '減価', page: '減価償却', note: '固定資産台帳・減価償却' },
];

export const FULL_ACCESS: Access = { core: true, petty: true, bank: true, dep: true };
const only = (k: AccessKey): Access => ({ core: false, petty: false, bank: false, dep: false, [k]: true });

const PAGE_KEY: Record<string, AccessKey> = { 小口現金: 'petty', 預金出納: 'bank', 減価償却: 'dep' };
/** 会計本体が使えないアカウントでも開ける画面（自分のアカウントの設定） */
const ALWAYS = ['ユーザー設定'];

/** その画面（メニュー名）を、このアカウントで開けるか */
export function canOpen(page: string, a: Access): boolean {
  const k = PAGE_KEY[page];
  if (k) return a[k];
  if (ALWAYS.includes(page)) return true;
  return a.core;
}

/** このアカウントで最初に開く画面（会計本体が使えればホーム、使えなければ許可された最初の機能） */
export function firstAllowed(a: Access): string {
  if (a.core) return 'ホーム';
  return ACCESS_ITEMS.find((i) => i.page && a[i.key])?.page ?? 'ユーザー設定';
}

/** 使える機能の名称（例「小口現金・預金出納」。すべて使えるときは「すべての機能」） */
export function accessLabel(a: Access): string {
  if (ACCESS_ITEMS.every((i) => a[i.key])) return 'すべての機能';
  const on = ACCESS_ITEMS.filter((i) => a[i.key]).map((i) => i.label);
  return on.length ? on.join('・') : 'なし';
}

/** 使えない項目のツールチップ・案内 */
export const ACCESS_DENIED = 'このアカウントでは利用できません（利用できる機能は管理者が設定します）';

/**
 * アカウントの一覧（プロトタイプのサンプル）。どれでもログインできる（パスワードは store/review.ts）。
 * me は管理者（通常アカウント・確認用アカウントでログインしたとき）。アカウントごとの利用できる機能を設定できるのは管理者だけ。
 */
export const ACCOUNTS: { id: string; name: string; kana: string; email: string; dept: string; role: '管理者' | '担当者' }[] = [
  { id: 'me', name: '経理 担当者', kana: 'ケイリ タントウシャ', email: 'keiri@example.jp', dept: '本部 経理', role: '管理者' },
  { id: 'encho', name: '園長', kana: 'エンチョウ', email: 'encho@example.jp', dept: 'チャイルド保育園', role: '担当者' },
  { id: 'koguchi', name: '小口 担当者', kana: 'コグチ タントウシャ', email: 'koguchi@example.jp', dept: 'チャイルド保育園 事務', role: '担当者' },
  { id: 'yokin', name: '預金 担当者', kana: 'ヨキン タントウシャ', email: 'yokin@example.jp', dept: '本部 経理', role: '担当者' },
  { id: 'shisan', name: '資産 担当者', kana: 'シサン タントウシャ', email: 'shisan@example.jp', dept: '本部 総務', role: '担当者' },
];
/** id のアカウント（見つからなければ管理者） */
export const accountOf = (id: string) => ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
/** アカウントごとの使える機能の既定 */
export const DEFAULT_MEMBER_ACCESS: Record<string, Access> = {
  me: FULL_ACCESS,
  encho: FULL_ACCESS,
  koguchi: only('petty'),
  yokin: only('bank'),
  shisan: only('dep'),
};
