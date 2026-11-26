// 寄附金収益明細書のデータ（確認メモ #418・#419）
//   伝票入力で寄附金の伝票を登録し、明細書への登録画面で「登録する」を選んだ金額を1件ずつためる。
//   別紙の「寄附金収益明細書」の明細入力は、開いたときにここの明細を見本の明細の後ろに並べる。
//   プロトタイプなので画面を読み込み直すと消える（仕訳の journalStore と同じ）。

/** 寄附金収益明細書：寄附者の属性（現行の並び） */
export const DONOR_ATTRS = ['法人の役職員', '利用者本人', '利用者の家族', '取引業者', 'その他'];
/** 寄附金収益明細書：区分（現行の並び。経常経費・運営資金・施設整備等・借入金元金償還・固定資産受贈） */
export const DONATION_KINDS = ['経常', '運営', '施設', '償還', '固定'];

export interface DonationRow {
  /** 受領年月日（例 令和8年8月31日） */
  date: string;
  attr: string;
  kind: string;
  amount: number;
  kihon: number;
  /** 入力区分（例 002 保育事業） */
  division: string;
}

let rows: DonationRow[] = [];

export function addDonations(list: DonationRow[]) {
  rows = [...rows, ...list];
}
export function getDonations(): DonationRow[] {
  return rows;
}
