// 振替伝票形式・振替単一形式の税区分と税額（確認メモ #192／#199／#200）。
//   入力画面（TransferEntryPage）と、参照パネルからの伝票の編集（VoucherEdit）の両方で使う。
//   税区分・税額は借方と貸方のそれぞれに持つ。候補は税区分マスターに相当（依頼書 2.4）。

export const TAX_OPTS = ['課税仕入 10%', '課税仕入（軽減）8%', '課税売上 10%', '非課税', '不課税', '対象外'];

/** 科目からの既定の税区分（収益・収入の科目は課税売上、費用の科目は課税仕入、ほかは対象外。区分間の内部取引科目は対象外） */
export const taxDefaultOf = (account: string) => (/区分間/.test(account) ? '対象外' : /収益|収入/.test(account) ? '課税売上 10%' : /費|料|代/.test(account) ? '課税仕入 10%' : '対象外');

/** 税額の自動計算：金額 × 税率 ÷（100 ＋ 税率）の切り捨て */
export const taxAmountOf = (tax: string, amount: number) => (tax.includes('10%') ? Math.floor((amount * 10) / 110) : tax.includes('8%') ? Math.floor((amount * 8) / 108) : 0);
