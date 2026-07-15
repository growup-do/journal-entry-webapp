// 仕訳伝票入力 画面 — 型定義

/** 補助ドロップダウンの対象タイプ */
export type AssistType = 'account' | 'service' | 'vendor' | 'summary';

/** 補助ドロップダウンを開くフィールド名 */
export type AssistFieldName = 'service' | 'kariKamoku' | 'kashiKamoku' | 'tekiyo' | 'gyosha';

/** 取引区分 */
export type Torihiki = '資金' | '事業' | 'その他' | '';

/** 1件分のフォーム状態 */
export interface FormState {
  service: string;
  month: string;
  day: string;
  torihiki: Torihiki;
  kariKamoku: string;
  kashiKamoku: string;
  tekiyo: string;
  gyosha: string;
  amount: string; // 数字のみ保持（表示は3桁区切り）
}

/** 仕訳帳の1エントリ */
export interface JournalEntry {
  id: number;
  date: string; // "M/D"
  kari: string;
  kashi: string;
  tekiyo: string;
  amount: number;
}

/** 補助ドロップダウンの候補グループ */
export interface AssistGroup {
  group: string;
  hasHeader: boolean;
  items: { value: string }[];
}

/** 現在開いている補助ドロップダウンの状態 */
export interface AssistState {
  open: boolean;
  field: AssistFieldName | '';
  type: AssistType | '';
  query: string;
}

/** スプレッドシート型の検索条件 */
export interface SearchState {
  keyword: string;
  kari: string;
  kashi: string;
  amountMin: string;
  amountMax: string;
}

/** 月フィルターの選択値（null = 全月） */
export type MonthFilter = string | null;
