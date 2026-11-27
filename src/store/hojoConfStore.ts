// 補助金事業等収益明細書の設定（確認メモ #450〜#453）
//   決算附属明細書の設定画面で保存した「集計方法」「補助金の区分」「区分ごとの交付団体及び交付の目的」を、
//   伝票入力の明細書への登録画面でも使えるように持つ。
//   プロトタイプなので画面を読み込み直すと既定に戻る（仕訳の journalStore と同じ）。

export type HojoMethod = '明細による集計' | '科目による集計' | '交付目的による集計';
export const HOJO_METHODS: HojoMethod[] = ['明細による集計', '科目による集計', '交付目的による集計'];

/** 交付団体及び交付の目的（補助金の区分ごとに登録する。確認メモ #450） */
export interface Grant { kubun: string; org: string; purpose: string }

export interface HojoConf {
  method: HojoMethod;
  /** 補助金の区分（設定画面で補助金事業等収益明細書用にチェックした科目） */
  kubuns: string[];
  grants: Grant[];
}

export const HOJO_KUBUN_DEFAULT = ['補助金収益', '市区町村補助金収益', '都道府県補助金収益', 'その他の補助金収益'];
export const GRANTS_DEFAULT: Grant[] = [
  { kubun: '補助金収益', org: '○○市', purpose: '延長保育事業' },
  { kubun: '補助金収益', org: '○○市', purpose: '障害児保育事業' },
  { kubun: '市区町村補助金収益', org: '○○市', purpose: '一時預かり事業' },
  { kubun: '都道府県補助金収益', org: '○○県', purpose: '保育士等処遇改善事業' },
];

let conf: HojoConf = { method: '交付目的による集計', kubuns: [...HOJO_KUBUN_DEFAULT], grants: GRANTS_DEFAULT.map((g) => ({ ...g })) };

export function getHojoConf(): HojoConf {
  return conf;
}
export function setHojoConf(p: Partial<HojoConf>) {
  conf = { ...conf, ...p };
}
