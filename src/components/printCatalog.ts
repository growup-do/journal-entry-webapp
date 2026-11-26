// 帳票の印刷の一覧（確認メモ #238：現行の印刷メニューに合わせる。「帳票・印刷_画面一覧.xlsx」）
//   大区分＝メニューの「帳票の印刷」、中区分＝仕訳日記帳・元帳 など（画面上部のタブ）、
//   小区分＝予算書・予算管理表 などの見出し（左の一覧の見出し）、その下に各帳票。
//   共通印刷設定＝有 の帳票（決算書・附属明細書⑩⑪・準決算書）は、詳細設定に「共通の印刷設定を反映」を置く。
//   表示条件を満たさない帳票は一覧に出さない（「表示条件を満たさない帳票も表示」で薄く表示し、条件を確かめられる）。
//   詳細設定の項目は、現行の画面に合わせて種類（チェック／ラジオ／選択）を分ける。

import { divisionLabel, flattenDivisions, startKindOf, type DivisionNode, type PrintCommon, type Session } from '../store/session';

/* ---------------- 詳細設定の項目 ---------------- */
/** 別の項目がこの値のときだけ選べる（それ以外は灰色で押せない。現行どおり） */
export interface DetailWhen { k: string; v: DetailValue; /** true＝その値のときは押せない */ not?: boolean }
export type DetailItem =
  | { k: string; t: 'check'; label: string; on?: boolean; note?: string; when?: DetailWhen }
  | { k: string; t: 'radio'; label: string; options: string[]; def?: string; note?: string; when?: DetailWhen }
  | { k: string; t: 'select'; label: string; options: string[]; def?: string; note?: string; when?: DetailWhen }
  | { k: string; t: 'text'; label: string; def?: string; placeholder?: string; width?: number; note?: string; when?: DetailWhen };
/** 詳細設定のまとまり（現行の画面の枠に相当） */
export interface DetailSection { title: string; items: DetailItem[] }
export type DetailValue = boolean | string;

export const DEPTHS = ['大区分まで印刷', '中区分まで印刷', '小区分まで印刷', '細区分まで印刷', '細々区分まで印刷', '就労授産まで印刷'];
/** 詳細設定の［印刷位置］（現行はラジオ。印刷する区分の深さ） */
export const DEPTH_OPTS = ['大区分までの印刷', '中区分までの印刷', '小区分までの印刷', '細区分までの印刷', '細々区分までの印刷', '科目毎に指定'];
/** 行の間隔の空き（3.2〜6.4mm、0.1mm 刻み） */
const GAPS = Array.from({ length: 33 }, (_, i) => (3.2 + i * 0.1).toFixed(1));

/** 決算書 共通印刷設定から「反映」で写す項目（詳細設定の項目キー → 共通の印刷設定の値） */
export const COMMON_LINK: Record<string, (p: PrintCommon) => DetailValue | undefined> = {
  // 共通の印刷設定で「個別の設定を使う」にした項目は写さない（現行どおり）
  depth: (p) => { const v = p.depth.replace('まで印刷', 'までの印刷'); return DEPTH_OPTS.includes(v) ? v : undefined; },
  lineGap: (p) => (['上・下空き', '上のみ空き', '空きなし'].includes(p.lineGap) ? p.lineGap : undefined),
shade: (p) => !!p.items.shade, bold: (p) => !!p.items.bold, stamp: (p) => !!p.items.stamp, corp: (p) => !!p.items.corp,
  hline: (p) => !!p.items.hline, note: (p) => !!p.items.note, autofont: (p) => !!p.items.autofont, page: (p) => !!p.items.page, date: (p) => !!p.items.date,
  bottom: (p) => !!p.items.bottom, top: (p) => !!p.items.top, head2: (p) => !!p.items.head2, remarkfont: (p) => !!p.items.remarkfont, special: (p) => !!p.items.special,
  twoLine: (p) => p.twoLineNames, autoFontHead: (p) => p.autoFontHeader, perPage: (p) => String(p.perPage),
};

const chk = (k: string, label: string, on = false, note?: string): DetailItem => ({ k, t: 'check', label, on, note });
const rad = (k: string, label: string, options: string[], def?: string, note?: string): DetailItem => ({ k, t: 'radio', label, options, def: def ?? options[0], note });
const sel = (k: string, label: string, options: string[], def?: string, note?: string): DetailItem => ({ k, t: 'select', label, options, def: def ?? options[0], note });
const txt = (k: string, label: string, def = '', placeholder?: string, width?: number): DetailItem => ({ k, t: 'text', label, def, placeholder, width });

const DEPTH_SECTION = (def = '細々区分までの印刷'): DetailSection => ({ title: '印刷位置', items: [rad('depth', '印刷する区分の深さ', DEPTH_OPTS, def)] });
const LINE_GAP = (def = '上のみ空き', gap = '4.8'): DetailSection => ({ title: '行の間隔', items: [rad('lineGap', '行の間隔', ['上・下空き', '上のみ空き', '空きなし'], def), sel('gap', '空きの間隔（mm。空きなしは 3.2mm）', GAPS, gap)] });

/** 行の間隔と、上・下空き／上のみ空きに付随する空きの間隔（空きなしのときは押せない。確認メモ #365） */
const GAP_WITH = (def: string, gap: string): DetailSection => ({ title: '行の間隔', items: [rad('lineGap', '行の間隔', ['上・下空き', '上のみ空き', '空きなし'], def), { ...sel('gap', '空きの間隔（mm）', GAPS, gap), when: { k: 'lineGap', v: '空きなし', not: true } }] });
/** 伝票番号（仕訳日記帳・伝票で共通） */
const SLIP_NO: DetailSection = { title: '伝票番号', items: [
  rad('slipNo', '伝票番号', ['入力番号', '自動連番 番号指定', '自動連番 Seq-No', 'Seq指定']),
  txt('slipStart', '開始番号（自動連番 番号指定のとき）', '1', '1', 100),
  { ...txt('seqList', 'Seq指定（1,3,6 のようにカンマで区切るか、4-8 のように範囲を指定。全ての月で有効）', '', '例：1,3,6 または 4-8', 260) },
  // Seq指定の番号を、入力番号と SeqNo. のどちらとして扱うか（Seq指定のときだけ選べる。確認メモ #311）
  { ...rad('seqNoKind', '伝票番号は', ['入力番号', 'SeqNo.'], '入力番号'), when: { k: 'slipNo', v: 'Seq指定' } },
] };
/** 印刷位置調整（上方向・右方向への移動量） */
const POSITION = (up: string, right: string): DetailSection => ({ title: '印刷位置調整', items: [txt('offsetUp', '上方向への移動量（mm）', up, '0', 100), txt('offsetRight', '右方向への移動量（mm）', right, '0', 100)] });
/** 試算表の詳細設定（現行「残高試算表 - 詳細設定」が基準。資金収支予算管理表・予算内訳表も同じ系統） */
function TRIAL(o: { head2?: boolean; serial?: boolean; extra?: DetailItem[]; depth?: string; right?: string; stamp?: boolean } = {}): DetailSection[] {
  return [
    { title: '印刷項目', items: [
      chk('shade', '費目行を網掛け、太字にする', true), chk('bold', '費目下を太線にする', true), chk('stamp', '捺印欄を印刷する', o.stamp ?? true), chk('area', '区分名を印刷する', true),
      chk('hline', '項目・科目毎に横線を印刷する', true), chk('foot', '脚注を印刷する'), chk('autofont', '科目名のフォントサイズを自動調整する', true), chk('page', 'ページ番号を印刷する'), chk('date', '印刷時の日付を印刷する'),
      ...(o.head2 ? [chk('head2', '２ページ目以降も項目名を印刷する', true)] : []), ...(o.serial ? [chk('serial', '貸借対照内訳表 連続型印刷をする', true)] : []), ...(o.extra ?? []),
      txt('pageStart', 'ページ番号の開始番号', '1', '1', 80),
    ] },
    DEPTH_SECTION(o.depth),
    LINE_GAP(),
    POSITION('0', o.right ?? '5'),
  ];
}
type BudgetKind = '前年度' | '当初' | '補正' | '次年度';
/** 予算書の詳細設定（現行「当初予算書 - 詳細設定」が基準。前年度・補正・次年度は項目の名称・順序・ヘッダーが違う） */
function BUDGET(kind: BudgetKind): DetailSection[] {
  const names: Record<BudgetKind, [string, string][]> = {
    前年度: [['前年度予算額', '予 算 額'], ['前々年度予算額', '前年予算額'], ['差引増減額', '差引増減額']],
    当初: [['当年度予算額', '予 算 額'], ['前年度予算額', '前年予算額'], ['差引増減額', '差引増減額']],
    補正: [['補正前予算額', '補正前予算額'], ['今回補正額', '今回補正額'], ['補正後予算額', '補正後予算額']],
    次年度: [['次年度予算額', '次年度予算額'], ['当年度予算額', '当年度予算額'], ['差引増減額', '差引増減額']],
  };
  const orders: Record<BudgetKind, string[]> = {
    前年度: ['前年、前々年、差引', '前年、差引、前々年', '前々年、前年、差引', '前々年、差引、前年'],
    当初: ['当初、前年、差引', '当初、差引、前年', '前年、当初、差引', '前年、差引、当初'],
    補正: ['補正前、補正、補正後', '補正前、補正後、補正', '補正後、補正、補正前', '補正後、補正前、補正'],
    次年度: ['次年、当年、差引', '次年、差引、当年', '当年、次年、差引', '当年、差引、次年'],
  };
  const header: DetailItem[] = kind === '補正' ? [chk('noYear', '「〇〇年度」を印字しない'), chk('noNth', '「第〇次」を印字しない')]
    : [rad('titleYear', 'タイトルの年', kind === '前年度' ? ['当年を用いる', '前年を用いる', '印字しない'] : kind === '次年度' ? ['当年を用いる', '次年を用いる', '印字しない'] : ['当年を用いる', '印字しない'], kind === '次年度' ? '次年を用いる' : '当年を用いる')];
  const prev = kind === '前年度' ? '前々年度予算' : kind === '当初' ? '前年度予算' : kind === '次年度' ? '当年度予算' : '';
  return [
    { title: '印刷項目', items: [
      chk('shade', '費目行を網掛け、太字にする', true), chk('bold', '費目下を太線にする', true), chk('stamp', '捺印欄を印刷する', true),
      kind === '補正' ? chk('area', '区分名を印刷する', true) : chk('mergeName', '合算の名称を印刷する', true),
      chk('foot', '脚注、注記を印刷する'), chk('autofont', '科目名のフォントサイズを自動調整する', true), chk('tfont', '摘要のフォントサイズを自動調整する'),
      // 所属区分の摘要を使用する：ON のとき使う区分を選ぶ。［摘要］は押せなくなる（確認メモ #348・#349）
      chk('ownRemark', '所属区分の摘要を使用する'), { ...sel('ownDiv', '使用する区分', ['（選択してください）']), when: { k: 'ownRemark', v: true } },
      chk('page', 'ページ番号を印刷する'), chk('date', '印刷時の日付を印刷する'), chk('hline', '項目・科目毎に横線を印刷する'), chk('head2', '２ページ目以降も項目名を印刷する'),
      txt('pageStart', 'ページ番号の開始番号', '1', '1', 80),
    ] },
    DEPTH_SECTION(),
    { title: '単位', items: [rad('unit', '単位', ['円単位', '千円単位'])] },
    { title: '項目の名称', items: names[kind].map(([l, v], i) => txt('colName' + i, l, v, v, 200)) },
    { title: '項目の順序', items: [rad('colOrder', '項目の順序', orders[kind])] },
    LINE_GAP('上のみ空き', kind === '前年度' ? '6.4' : '4.8'),
    { title: 'ヘッダー', items: header },
    ...(prev ? [{ title: prev, items: [rad('prevBudget', prev, ['当初予算を使用', '確定後予算を使用'], kind === '次年度' ? '確定後予算を使用' : '当初予算を使用')] }] : []),
    POSITION('0', kind === '前年度' ? '5' : '2'),
  ];
}
type ClosingKind = '資金収支' | '事業活動' | '貸借対照表' | '内訳表';
/** 決算書・準決算書の詳細設定（現行「資金収支計算書 - 詳細設定」が基準。事業活動計算書系・貸借対照表系・内訳表系で項目が少し違う） */
function CLOSING(kind: ClosingKind, o: { depth?: string; serial?: boolean } = {}): DetailSection[] {
  const fund = kind === '資金収支';
  return [
    { title: '印刷項目', items: [
      chk('shade', '費目行を網掛け、太字にする', true), chk('bold', '費目下を太線にする', true), chk('stamp', '捺印欄を印刷する', kind === '内訳表'), chk('corp', '法人名を印刷する', true), chk('hline', '項目・科目毎に横線を印刷する', true),
      fund ? chk('note', '（注）予備費の充当額等を印刷する') : chk('foot', '脚注を印刷する'),
      chk('autofont', '科目名のフォントサイズを自動調整する', true), chk('page', 'ページ番号を印刷する'), chk('date', '印刷時の日付を印刷する'),
      chk('bottom', '常に最下行の下に横線を印刷する', true), chk('top', '常に最上行の上に横線を印刷する', true), chk('head2', '２ページ目以降も項目名を印刷する', true),
      ...(fund ? [chk('remarkfont', '資金収支計算書 備考のフォントサイズを自動調整する', true)] : []),
      ...(o.serial ? [chk('serial', '貸借対照内訳表 連続型印刷をする', true)] : []),
      txt('pageStart', 'ページ番号の開始番号', '1', '1', 80),
      ...(fund ? [txt('reserve', '資金収支計算書 予備費充当額（円）', '0', '0', 140)] : []),
    ] },
    DEPTH_SECTION(o.depth),
    { title: '行の間隔', items: [rad('lineGap', '行の間隔', kind === '貸借対照表' ? ['上・下空き', '上のみ空き', '空きなし', '上・下空き（科目名２行）'] : ['上・下空き', '上のみ空き', '空きなし'], '上のみ空き'), sel('gap', '空きの間隔（mm。空きなしは 3.2mm）', GAPS, '6.2')] },
    ...(kind === '内訳表' ? [{ title: '内訳表', items: [chk('twoLine', '項目名を二行で印刷する'), chk('autoFontHead', '項目名のフォントサイズを自動調整する', true), sel('perPage', '１ページの区分数', Array.from({ length: 20 }, (_, i) => String(i + 1)), '6'), chk('pickArea', '印刷区分を指定する')] }] : []),
    POSITION('-8', '5'),
  ];
}
/** 資金収支予算内訳表（試算表系の項目＋内訳表の設定） */
const BUDGET_INNER: DetailSection[] = (() => {
  const t = TRIAL({ head2: true, depth: '小区分までの印刷', stamp: false });
  return [t[0],
    // 現行の「合算テーブル」と「内部取引消去対応」の選択はなくし、内部取引消去対応をもとに1つにまとめた（確認メモ #380／#388）。
    //   合算テーブルにだけあった 計算式・列名の変更・2ページ以降の区分名 は、［印刷区分］の表示区分選択と下の項目に入れた。印刷区分を指定する が ON で［印刷区分］（確認メモ #346）
    { title: '内訳表', items: [chk('twoLine', '項目名を二行で印刷する'), chk('autoFontHead', '項目名のフォントサイズを自動調整する'), sel('perPage', '１ページの区分数', Array.from({ length: 20 }, (_, i) => String(i + 1)), '5'), chk('namePerPage', '2ページ以降も区分名を印刷する'), chk('pickArea', '印刷区分を指定する')] },
    ...t.slice(1)];
})();

/** 元帳の詳細設定（現行「元帳印刷 詳細設定」。総勘定元帳・資金元帳・取引先元帳で項目と初期値が少し違う） */
function LEDGER(kind: '総勘定元帳' | '資金元帳' | '取引先元帳'): DetailSection[] {
  const gl = kind === '総勘定元帳';
  return [
    { title: '印刷項目', items: [
      // 残高のみも印刷する は 月計を印刷する のときだけ、残高 0 も印刷する は 残高のみも印刷する のときだけ（確認メモ #328。取引先元帳にもある）
      //   付随する項目は親のすぐ下に段を下げて並べる（確認メモ #381／#382）
      chk('month', '月計を印刷する', true),
      { ...chk('balOnly', '残高のみも印刷する', kind !== '取引先元帳'), when: { k: 'month', v: true } },
      { ...chk('zeroBal', '残高 0 も印刷する'), when: { k: 'balOnly', v: true } },
      chk('total', '合計を印刷する', gl), chk('totalYear', '合計の集計は年間でする', true),
      ...(gl ? [] : [chk('budgetRest', '合計印刷時に予算残を印刷する', true)]),
      chk('monthBreak', '月次で改頁する', kind === '取引先元帳'), chk('monthOnly', '月計だけ印刷する'),
      ...(gl ? [chk('dispCode', '表示コードを印刷する')] : []),
      chk('dayBal', '残高を日計で印刷する', true), chk('seq', 'Seq番号を印刷する'),
      ...(gl ? [chk('cashTitle', '現金・預金の表題を変更する')] : []),
      chk('evid', '証憑の有無を印刷する', true), chk('spare1', '入力予備１を印刷する'), chk('spare2', '入力予備２を印刷する'), chk('a4', 'A4白紙に印刷する'),
      chk('noElim', '内部取引消去を印字しない'), chk('tline', '摘要行も印刷する（伝票式・振替式）'),
      // 摘要行も印刷する に付随（確認メモ #324）
      { ...chk('noBlank', '空行は印刷しない'), when: { k: 'tline', v: true } },
      // 入力区分で開いたときは「伝票入力区分名を印刷する」（現行は同じ欄の文言が変わる。確認メモ #329）
      chk('mergeName', '合算の名称を印刷する', true),
      chk('page', 'ページ番号を印刷する', true), chk('tfont', '摘要のフォントサイズを自動調整する'), chk('date', '印刷時の日付を印刷する'), chk('match', '貸借の金額が一致する行を消し込む'), chk('stamp', '捺印欄を印刷する（白紙印刷時）'),
    ] },
    { title: '印刷科目', items: [rad('acct', '印刷科目', ['印刷用', '表示用'], '表示用')] },
    ...(gl ? [{ title: '印刷科目設定', items: [rad('special', '印刷科目設定', ['特殊摘要の項目のみ印刷する', '特殊摘要の科目のみ印刷する', '特殊摘要の科目項目両方印刷する'], '特殊摘要の科目項目両方印刷する')] }] : []),
    { title: 'カラー印刷時の基調色', items: [rad('color', '基調色', gl ? ['緑', '青', '動作環境の色指定'] : ['茶', '青', '動作環境の色指定'])] },
    POSITION('0', gl ? '2' : '0'),
  ];
}

/** 仕訳伝票（伝票式）・振替伝票（振替式）の詳細設定（現行「振替式印刷 - 詳細設定」が基準。Windows の現行画面で確認）
 *  捺印欄は項目ではなく［捺印欄］ボタン（常に押せる）。伝票式は 5 欄、振替式は 4 欄（確認メモ #322） */
function VOUCHER(kind: '伝票式' | '振替式'): DetailSection[] {
  const slip = kind === '伝票式';
  return [
    SLIP_NO,
    { title: '科目欄', items: [
      rad('acctCol', '科目欄', ['科目名を印刷する', '入力コード・科目名を印刷する', '科目名・資金科目名を印刷する'], '入力コード・科目名を印刷する'),
      // 伝票式：科目名・資金科目名を印刷する のときだけ選べる（確認メモ #316）
      ...(slip ? [{ ...chk('fundSpecial', '特摘行の資金科目名も印刷する'), when: { k: 'acctCol', v: '科目名・資金科目名を印刷する' } }] : []),
    ] },
    { title: '印刷項目', items: [
      // 伝票式は 特摘行の資金科目名も印刷する が ON のとき、振替式は 科目名・資金科目名を印刷する のとき押せない（確認メモ #317）
      slip ? { ...chk('vendor', '取引先名を印刷する'), when: { k: 'fundSpecial', v: true, not: true } } : { ...chk('vendor', '取引先名を印刷する'), when: { k: 'acctCol', v: '科目名・資金科目名を印刷する', not: true } },
      // A4白紙と A5白紙はどちらか一方だけ（確認メモ #319・#320）。上下連続は A4白紙のときだけ
      { ...chk('a4', 'A4白紙に印刷する', true), when: { k: 'a5', v: true, not: true } }, { ...chk('a4cont', 'A4白紙印刷時に上下連続印刷する', true), when: { k: 'a4', v: true } },
      { ...chk('a5', 'A5白紙に印刷する'), when: { k: 'a4', v: true, not: true } }, chk('drcrHead', '借方・貸方のヘッダーを印刷する'),
      // 伝票式だけの項目（確認メモ #318）
      ...(slip ? [chk('copy', '複写の伝票を印刷する', true), chk('evid', '証憑の有無を印刷する', true), chk('spare1', '入力予備１を印刷する'), chk('spare2', '入力予備２を印刷する')] : []),
      chk('tfont', '摘要のフォントサイズを自動調整する'), chk('era', '元号を印字する（標準伝票用紙のみ）'), sel('paper', '伝票用紙', ['標準', '日本保育協会'])] },
    { title: '印刷順序', items: [rad('order', '印刷順序', ['入力順', '日付順'], '日付順')] },
    { title: '印刷科目', items: [rad('acct', '印刷科目', ['印刷用', '表示用'], '表示用')] },
    { title: '伝票種別', items: [chk('normal', '通常伝票', true), chk('opening', '移行伝票', true), chk('single', '単一式伝票を含める')] },
    { title: 'カラー印刷時の基調色', items: [rad('color', '基調色', ['緑', '動作環境の色指定'])] },
    POSITION('0', '0'),
  ];
}

/** 消費税区分（区分コード＋名称。現行の消費税区分コンボの並び） */
const TAX_CODES = ['14 課税売上　第１種業種（みなし仕入率＝90%）(8%軽減)', '15 課税売上　第２種業種（みなし仕入率＝80%）(8%軽減)', '24 課税売上　第１種業種（みなし仕入率＝90%）(10%)', '25 課税売上　第２種業種（みなし仕入率＝80%）(10%)', '31 非課税売上', '41 課税仕入 (10%)', '42 課税仕入 (8%軽減)', '51 対象外'];
const TAX_SHORT = ['014:課売　１種（8%軽減）', '015:課売　２種（8%軽減）', '024:課売　１種（10%）', '041:課仕 (10%)', '042:課仕 (8%軽減)'];
const D: Record<string, DetailSection[]> = {
  // 仕訳日記帳・伝票・元帳は現行の［詳細設定］の項目・種類・初期値に合わせた（Windows の現行画面で確認。確認メモ #238）
  journal: [
    { title: '印刷項目', items: [chk('mergeName', '合算の名称を印刷する', true), chk('code', '科目コードを印刷する', true), chk('stamp', '捺印欄を印刷する'), { ...chk('stamp2', '2ページ目以降も捺印欄を印刷する'), when: { k: 'stamp', v: true } }, chk('spare1', '入力予備１を印刷する'), chk('spare2', '入力予備２を印刷する'), chk('a4v', 'Ａ４縦に印刷する'), chk('tfont', '摘要のフォントサイズを自動調整する')] },
    SLIP_NO,
    { title: '印刷順序', items: [rad('order', '印刷順序', ['入力順', '日付順'], '日付順')] },
    { title: '印刷科目', items: [rad('acct', '印刷科目', ['印刷用', '表示用'], '印刷用')] },
    { title: '伝票種別', items: [chk('normal', '通常伝票', true), chk('opening', '移行伝票', true)] },
    { title: '内部取引', items: [chk('internalOnly', '内部取引伝票のみ')] },
    POSITION('0', '0'),
  ],
  voucher: VOUCHER('伝票式'),
  transfer: VOUCHER('振替式'),
  ledger: LEDGER('総勘定元帳'),
  fundLedger: LEDGER('資金元帳'),
  vendorLedger: LEDGER('取引先元帳'),
  // 月別の推移表（現行は 0データ・網掛け・太線・横線と、印刷位置・行の間隔・タイトル・位置調整だけ）
  monthly: [{ title: '印刷項目', items: [chk('shade', '費目行を網掛け、太字にする'), chk('bold', '費目下を太線にする'), chk('hline', '項目・科目毎に横線を印刷する'), chk('area', '区分名を印刷する', true)] }, DEPTH_SECTION('中区分までの印刷'), LINE_GAP('上・下空き', '6.4'), POSITION('0', '0')],
  sub: [
    { title: '印刷条件', items: [rad('amt', '明細表内に印刷する金額', ['全ての伝票', '伝票を選択']), rad('pdate', '印刷日付', ['日付印刷しない', '期首〜期末', '指定月']), txt('title', 'タイトル（全角20文字）', '', '例：未払金明細表', 260)] },
    { title: '印刷項目', items: [chk('vsub', '取引先コード小計（同一取引先コードは集計する）'), chk('tshade', '合計行を網掛け、太字にする', true), chk('area', '区分名を印刷する', true)] },
  ],
  analysis: [
    { title: '印刷条件', items: [rad('unit', '単位', ['円', '千円', '百万円']), sel('graphs', 'グラフ数（1ページ）', ['3', '4', '5', '6', '7', '8'], '6')] },
    { title: '印刷項目', items: [chk('title', 'タイトルを印刷する', true), chk('area', '伝票入力区分名を印刷する', true), chk('scale', '縦軸スケールを自動調整する', true), chk('avg', '平均値を表示する')] },
  ],
  // 消費税区分別集計表・科目別消費税区分別集計表（現行「消費税区分別集計表 - 詳細設定」）
  tax: [{ title: '印刷項目', items: [chk('area', '区分名を印刷する', true), chk('autofont', '科目名のフォントサイズを自動調整する'), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する')] }, GAP_WITH('上・下空き', '6.4'), POSITION('0', '0')],
  // 消費税区分別集計内訳表（現行は条件画面だけで、詳細設定ボタンは無い）
  taxInner: [
    { title: '消費税区分', items: [sel('taxKind', '消費税区分', TAX_CODES, TAX_CODES[0])] },
    { title: 'ページ設定', items: [chk('monthBreak', '月毎に改ページする'), txt('pageStart', 'ページ番号の初期値', '1', '1', 80), chk('date', '印刷時の日付を印刷する')] },
    POSITION('0', '0'),
  ],
  // 消費税区分コード内訳表（現行「印刷詳細」）
  taxCode: [
    { title: '印刷項目', items: [chk('shade', '費目行を網掛け、太字にする'), chk('bold', '費目下を太線にする'), chk('stamp', '捺印欄を印刷する'), chk('area', '区分名を印刷する', true), chk('hline', '項目・科目毎に横線を印刷する'), chk('lastCol', '合計額を最後の列に印刷する'), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する')] },
    // 細々区分までの印刷も選べる（確認メモ #367）
    { title: '印刷位置', items: [rad('depth', '印刷する区分の深さ', DEPTH_OPTS.slice(0, 5), '中区分までの印刷')] },
    GAP_WITH('上・下空き', '6.4'),
    { title: '消費税区分（選択した税区）', items: TAX_SHORT.map((t, i) => chk('tc' + i, t, i === 0)) },
    { title: '科目体系', items: [rad('acctKind', '科目体系', ['勘定科目', '資金科目'], '資金科目')] },
    { title: '印刷金額', items: [rad('amount', '印刷金額', ['消費税額', '税込金額'])] },
    { title: '印刷用紙・向き', items: [rad('paper', '印刷用紙', ['Ａ４用紙', 'Ａ３用紙'], 'Ａ４用紙', 'A3対応プリンター以外は、A4用紙を選択してください'), rad('orient', '印刷向き', ['縦', '横'])] },
  ],
  internal: [{ title: '内部取引区分', items: [rad('kind', '内部取引区分', ['全て', '事業', '拠点', 'サービス', '小サービス'])] }],
};

/** ページ番号の開始番号は「ページ番号を印刷する」に付随させる（すぐ下に字下げして置き、オンのときだけ入力できる。確認メモ #359） */
function withPageStart(sections: DetailSection[]): DetailSection[] {
  return sections.map((sec) => {
    const start = sec.items.find((it) => it.k === 'pageStart');
    const pi = sec.items.findIndex((it) => it.k === 'page');
    if (!start || pi < 0) return sec;
    const rest = sec.items.filter((it) => it !== start);
    const at = rest.findIndex((it) => it.k === 'page') + 1;
    return { ...sec, items: [...rest.slice(0, at), { ...start, label: '開始番号', when: { k: 'page', v: true } }, ...rest.slice(at)] };
  });
}

/* ---------------- 別紙（現行の各明細書の詳細設定。行の間隔・印刷様式・印刷位置調整は共通の部品） ---------------- */
const AP_GAP = (def: string): DetailSection => ({ title: '行の間隔', items: [rad('lineGap', '行の間隔', ['上・下空き', '上のみ空き', '空きなし'], def, '上・下空き 6.4mm／上のみ空き 4.8mm／空きなし 3.2mm')] });
/** 附属明細書の印刷項目（shade・autofont は初期値。undefined の項目は現行に無い） */
const apItems = (o: { shade?: boolean; autofont: boolean; extra?: DetailItem[] }): DetailItem[] => [
  ...(o.shade === undefined ? [] : [chk('shade', '費目行を網掛け、太字にする', o.shade)]),
  chk('stamp', '捺印欄を印刷する'), chk('corp', '法人名を印刷する', true), chk('foot', '脚注を印刷する'), chk('autofont', '科目名のフォントサイズを自動調整する', o.autofont),
  chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する'), ...(o.extra ?? []),
];
const AP_INNER = (twoLine: boolean): DetailSection => ({ title: '内訳表', items: [chk('twoLine', '項目名を二行で印刷する', twoLine), chk('autoFontHead', '項目名のフォントサイズを自動調整する', true)] });
/** 資金収支明細書・事業活動明細書（決算書と同じく 決算書 共通印刷設定を反映できる） */
const AP_LINKED = (activity: boolean): DetailSection[] => [
  { title: '印刷項目', items: [
    chk('shade', '費目行を網掛け、太字にする', true), chk('bold', '費目下を太線にする', true), chk('stamp', '捺印欄を印刷する'), chk('corp', '法人名を印刷する', true), chk('hline', '項目・科目毎に横線を印刷する', true), chk('foot', '脚注を印刷する'),
    // ページ番号の開始番号を「ページ番号を印刷する」に付随させる（確認メモ #396）
    chk('autofont', '科目名のフォントサイズを自動調整する', true), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する'),
    chk('bottom', '常に最下行の下に横線を印刷する', true), chk('top', '常に最上行の上に横線を印刷する', true), chk('head2', '２ページ目以降も項目名を印刷する', true),
    ...(activity ? [chk('special', '事業活動明細書 特別増減の部を印刷する', true)] : []),
  ] },
  DEPTH_SECTION(activity ? '細々区分までの印刷' : '小区分までの印刷'),
  LINE_GAP('上のみ空き', '6.2'),
  { title: '内訳表', items: [chk('twoLine', '項目名を二行で印刷する'), chk('autoFontHead', '項目名のフォントサイズを自動調整する', true), sel('perPage', '１ページの区分数', Array.from({ length: 20 }, (_, i) => String(i + 1)), '6'), chk('pickArea', '印刷区分を指定する')] },
  POSITION('-8', '5'),
];
export interface AppendixSpec { detail: DetailSection[]; note?: string; /** 開発用のメモ。画面には出さない */ memo?: string; zero?: boolean; noZero?: boolean; outs?: ReportDef['outs']; range?: boolean; common?: boolean; ownInit?: boolean; innerBtn?: boolean; innerWidths?: [string, string] }
const AP: Record<string, AppendixSpec> = {
  // 別紙1・2 注記（「注記印刷詳細」。年月指定は無い）
  // ２ページ目以降も項目名を印刷する（確認メモ #358）
  'note-corp': { noZero: true, outs: ['print', 'excel', 'pdf'], detail: [{ title: '印刷項目', items: [chk('corp', '法人名を印刷する'), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する'), chk('head2', '２ページ目以降も項目名を印刷する', true)] }, POSITION('0', '0')] },
  'note-base': { noZero: true, outs: ['print', 'excel', 'pdf'], detail: [{ title: '印刷項目', items: [chk('corp', '法人名を印刷する'), chk('site', '拠点名を印刷する'), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する'), chk('head2', '２ページ目以降も項目名を印刷する', true)] }, POSITION('0', '0')] },
  // 借入金明細書：２ページ目以降も項目名を印刷する（確認メモ #395）
  d1: { zero: false, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: true, extra: [chk('head2', '２ページ目以降も項目名を印刷する')] }) }, AP_GAP('空きなし'), POSITION('-13', '0')] },
  d2: { noZero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: true }) }, AP_INNER(true), AP_GAP('上・下空き'), POSITION('0', '0')] },
  d3: { zero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: true }) }, AP_INNER(false), AP_GAP('上・下空き'), POSITION('0', '0')] },
  d4: { noZero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ autofont: true }) }, AP_GAP('上・下空き'), POSITION('0', '0')] },
  d5: { zero: false, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: true }) }, AP_GAP('空きなし'), POSITION('-13', '0')] },
  d6: { noZero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: true, extra: [chk('noMove', '基本金明細書 組入・取崩が発生していなくても印刷する', true), chk('sumCol', '基本金明細書 通常行の合計金額の列も印字する')] }) }, AP_INNER(true), AP_GAP('上・下空き'), POSITION('0', '0')] },
  d7: { noZero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: true, extra: [chk('sumCol', '国庫補助金等特別積立金明細書 通常行の合計金額の列も印字する')] }) }, AP_INNER(true), AP_GAP('上・下空き'), POSITION('0', '0')] },
  // ⑧ の詳細設定は減価償却システム側の画面（フォント・罫線・データ印字の選択）
  d8: { noZero: true, outs: ['print', 'excel', 'pdf'], memo: '詳細設定は減価償却の画面（フォント・罫線・データ印字の選択）で行う', detail: [] },
  d9: { zero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: false, autofont: false }) }, AP_GAP('空きなし'), POSITION('-13', '0')] },
  d10: { zero: true, range: true, detail: AP_LINKED(false) },
  d11: { zero: true, range: true, detail: AP_LINKED(true) },
  d12: { zero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: true, autofont: false }) }, AP_GAP('上・下空き'), POSITION('0', '0')] },
  d13: { noZero: true, range: true, detail: [{ title: '印刷項目', items: apItems({ autofont: false }) }, AP_GAP('上・下空き'), POSITION('0', '0')] },
  d14: { zero: false, range: true, detail: [{ title: '印刷項目', items: apItems({ shade: false, autofont: true }) }, AP_GAP('空きなし'), POSITION('-13', '0')] },
  // 別紙4 財産目録（現行「財産目録設定」）
  inventory: { zero: true, range: true, detail: [
    { title: '印刷項目', items: [chk('netShade', '差引純資産行を網掛け、太字にする', true), chk('stamp', '捺印欄を印刷する'), chk('corp', '法人名を印刷する', true), chk('hline', '項目・科目毎に横線を印刷する', true), chk('foot', '脚注、注記を印刷する'), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する')] },
    { title: '行送り', items: [sel('pitch', '行送り（標準 6.4mm）', GAPS, '5.8')] },
    POSITION('0', '2'),
  ] },
};
/** 就労支援・授産の明細書（⑮〜⑲の9様式。現行の「決算附属明細書印刷」の詳細設定はタイトル以外すべて同じ）
 *  共通の印刷設定を反映できる（初期は個別の設定）。印刷位置は「科目毎に指定」と［表示設定］、内訳表と［内訳書の印刷書式］がある */
const AP_SHUROU: AppendixSpec = {
  zero: false, range: true, common: true, ownInit: true, innerBtn: true, innerWidths: ['60', '20'],
  memo: '現行のメニュー定義 ID 33542〜33550。就労・授産の事業がない区分ではメニューに出ない',
  detail: [
    { title: '印刷項目', items: [
      chk('shade', '費目行を網掛け、太字にする'), chk('stamp', '捺印欄を印刷する'), chk('corp', '法人名を印刷する', true), chk('foot', '脚注を印刷する'),
      chk('autofont', '科目名のフォントサイズを自動調整する'), chk('page', 'ページ番号を印刷する'), txt('pageStart', 'ページ番号の開始番号', '1', '1', 80), chk('date', '印刷時の日付を印刷する'),
      chk('bottom', '常に最下行の下に横線を印刷する'), chk('top', '常に最上行の上に横線を印刷する'),
    ] },
    DEPTH_SECTION('中区分までの印刷'),
    AP_GAP('上・下空き'),
    { title: '内訳表', items: [chk('twoLine', '項目名を二行で印刷する'), chk('autoFontHead', '項目名のフォントサイズを自動調整する'), sel('perPage', '１ページの区分数', Array.from({ length: 20 }, (_, i) => String(i + 1)), '6')] },
    POSITION('0', '0'),
  ],
};
export const appendixSpec = (id: string): AppendixSpec => { const a = AP[id] ?? AP_SHUROU; return { ...a, detail: withPageStart(a.detail) }; };

/* ---------------- 表示条件 ---------------- */
export interface Cond { label: string; ok: (s: Session) => boolean }
const nodeOf = (s: Session): DivisionNode | undefined => flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node;
const C = {
  entry: { label: '伝票入力区分で起動したとき', ok: (s: Session) => startKindOf(s) === '入力区分' } as Cond,
  parent: { label: '親区分で起動したとき', ok: (s: Session) => startKindOf(s) === '親区分' } as Cond,
  service: { label: '伝票入力区分（サービス区分・小サービス区分）で起動したとき', ok: (s: Session) => { const n = nodeOf(s); return startKindOf(s) === '入力区分' && (n?.kind === 'サービス区分' || n?.kind === '小サービス区分'); } } as Cond,
  belowSite: { label: '拠点区分以下で起動したとき', ok: (s: Session) => { const k = nodeOf(s)?.kind; return k === '拠点区分' || k === 'サービス区分' || k === '小サービス区分'; } } as Cond,
  honsoku: { label: '消費税モードが本則課税（一括比例配分方式／個別対応方式）のとき', ok: (s: Session) => s.taxMode === '本則課税の一括比例配分方式' || s.taxMode === '本則課税の個別対応方式' } as Cond,
  subAcct: { label: '補助簿（明細表）設定で科目を指定したとき', ok: (s: Session) => subLedgerNames(s).length > 0 } as Cond,
};

/* ---------------- 帳票選択（様式設定） ---------------- */
/** 帳票選択の様式（旧 動作環境パネル「帳票選択」）。決算書・別紙・準決算書の表示条件に使う。区分階層により省略が許される様式がある（確認メモ #49） */
export const FORM_GROUPS: { title: string; closing?: boolean; items: { key: string; label: string; name: string; omit?: '事業区分' | '拠点区分' }[] }[] = [
  { title: '資金収支計算書（第一号様式）', closing: true, items: [{ key: 'c1-1', label: '1-1', name: '第一号第一様式（法人全体）' }, { key: 'c1-2', label: '1-2', name: '第一号第二様式（事業区分別 内訳表）', omit: '事業区分' }, { key: 'c1-3', label: '1-3', name: '第一号第三様式（拠点区分別 内訳表）', omit: '拠点区分' }, { key: 'c1-4', label: '1-4', name: '第一号第四様式（拠点区分）' }] },
  { title: '事業活動計算書（第二号様式）', closing: true, items: [{ key: 'c2-1', label: '2-1', name: '第二号第一様式（法人全体）' }, { key: 'c2-2', label: '2-2', name: '第二号第二様式（事業区分別 内訳表）', omit: '事業区分' }, { key: 'c2-3', label: '2-3', name: '第二号第三様式（拠点区分別 内訳表）', omit: '拠点区分' }, { key: 'c2-4', label: '2-4', name: '第二号第四様式（拠点区分）' }] },
  { title: '貸借対照表（第三号様式）', closing: true, items: [{ key: 'c3-1', label: '3-1', name: '第三号第一様式（法人全体）' }, { key: 'c3-2', label: '3-2', name: '第三号第二様式（事業区分別 内訳表）', omit: '事業区分' }, { key: 'c3-3', label: '3-3', name: '第三号第三様式（拠点区分別 内訳表）', omit: '拠点区分' }, { key: 'c3-4', label: '3-4', name: '第三号第四様式（拠点区分）' }] },
  { title: '別紙', items: [{ key: 'note', label: '注記', name: '計算書類に対する注記' }, { key: 'a10', label: '別紙3（⑩）', name: '拠点区分資金収支明細書' }, { key: 'a11', label: '別紙3（⑪）', name: '拠点区分事業活動明細書' }] },
  { title: '準決算書', items: [{ key: 'pc6', label: 'C別紙6', name: '拠点区分 貸借対照表明細書' }, { key: 'pc1-5', label: 'C1-5', name: 'サービス区分 資金収支計算書' }, { key: 'pc2-5', label: 'C2-5', name: 'サービス区分 事業活動計算書' }, { key: 'pc3-5', label: 'C3-5', name: 'サービス区分 貸借対照表' }] },
];
/** 区分階層から省略できる様式を判定：事業区分が1つなら第二様式、各事業区分の拠点区分が1つなら第三様式を省略できる */
export function omittable(tree: DivisionNode): Record<'事業区分' | '拠点区分', boolean> {
  const biz = (tree.children ?? []).filter((b) => (b.children ?? []).length > 0);
  const sites = biz.map((b) => (b.children ?? []).length);
  return { 事業区分: biz.length <= 1, 拠点区分: sites.every((n) => n <= 1) };
}
/** 帳票選択：使う様式／省略する様式。省略できる様式は既定で省略（確認メモ #49：区分階層ツリーの内容によって省略が許される帳票がある） */
export const formEnabled = (forms: Record<string, boolean>, key: string, tree: DivisionNode) => {
  if (key in forms) return forms[key];
  const item = FORM_GROUPS.flatMap((g) => g.items).find((x) => x.key === key);
  return !(item?.omit && omittable(tree)[item.omit]);
};
const formLabel = (key: string) => FORM_GROUPS.flatMap((g) => g.items).find((x) => x.key === key)?.label ?? key;
export const formCond = (key: string): Cond => ({ label: `決算書 共通印刷設定の帳票選択で「${formLabel(key)}」を使用にしたとき`, ok: (s) => formEnabled(s.print.forms, key, s.tree) });

/* ---------------- 帳票の一覧 ---------------- */
export interface ReportDef {
  id: string; name: string;
  /** 中区分 */ cat: string;
  /** 小区分（左の一覧の見出し） */ sub?: string;
  /** 一覧の帳票名の下に出す補足（様式番号など短いものだけ） */ note?: string; detail: DetailSection[]; scope?: boolean;
  /** 開発用のメモ（現行との違いなど）。画面には出さない */ memo?: string;
  /** 年次の帳票（期間は会計年度の期首〜期末。月の指定なし） */ annual?: boolean;
  /** WAMNET連携出力：印刷ではなく WAMNET連携のダイアログを開く */ wamnet?: boolean;
  /** 共通印刷設定＝有（詳細設定に「共通の印刷設定を反映」を置く） */ common?: boolean;
  /** 表示条件 */ cond?: Cond;
  /** 帳票選択の様式キー */ form?: string;
  /** 印刷様式のタイトルの初期値（省略時は帳票名） */ title?: string;
  /** 条件画面に［範囲指定の種類の指定］がある（試算表と同じ条件画面の帳票） */ range?: boolean;
  /** ［範囲指定の種類］が「範囲指定の合計を印刷」だけ */ rangeSumOnly?: boolean;
  /** 予算書の条件画面（通常＝印字する年月日、補正＝第○次補正と年月） */ budget?: '通常' | '補正';
  /** 出力できる先（省略時はすべて。月別の推移表は Excel・CSV だけ） */ outs?: ('print' | 'pdf' | 'excel' | 'csv')[];
  /** 「0データを表示しない」の初期値（省略時は共通の印刷設定の値） */ zero?: boolean;
  /** 現行の詳細設定に「０データを印刷しない」が無い帳票 */ noZero?: boolean;
  /** 科目ごとの備考を入力する［備考］ボタン（確認メモ #364） */ remarkBtn?: '備考';
  /** 条件画面に勘定科目・資金科目の一覧を出し、印刷する科目をチェックで選ぶ（科目別消費税区分別集計表。確認メモ #366） */ acctPick?: boolean;
  /** 共通の印刷設定を反映できるが、初期値は帳票個別の値（就労支援・授産の明細書） */ ownInit?: boolean;
  /** ［内訳書の印刷書式］を置く（決算書・準決算書の内訳表のほか） */ innerBtn?: boolean;
  /** ［内訳書の印刷書式］の印刷幅の標準（科目名・金額 mm） */ innerWidths?: [string, string];
}
type R = Omit<ReportDef, 'cat' | 'sub'>;
const group = (cat: string, sub: string, list: R[]): ReportDef[] => list.map((r) => ({ ...r, detail: withPageStart(r.detail), cat, sub, range: r.range ?? (cat === '試算表' || cat === '決算書' || cat === '準決算書' || !!r.rangeSumOnly) }));
const BUDGET4 = ['前年度', '当初', '補正', '次年度'];
const BUDGET_TITLE: Record<string, string> = { 前年度: '前年度資金収支予算書', 当初: '資金収支予算書', 補正: '資金収支補正予算書', 次年度: '次年度資金収支予算書' };
const CLOSING12: [string, string][] = [
  ['法人単位資金収支計算書', 'c1-1'], ['資金収支内訳表', 'c1-2'], ['○○事業区分 資金収支内訳表', 'c1-3'], ['○○拠点区分 資金収支計算書', 'c1-4'],
  ['法人単位事業活動計算書', 'c2-1'], ['事業活動内訳表', 'c2-2'], ['○○事業区分 事業活動内訳表', 'c2-3'], ['○○拠点区分 事業活動計算書', 'c2-4'],
  ['法人単位貸借対照表', 'c3-1'], ['貸借対照表内訳表', 'c3-2'], ['○○事業区分 貸借対照表内訳表', 'c3-3'], ['○○拠点区分 貸借対照表', 'c3-4'],
];
/** 様式キー → 詳細設定（第一様式・第四様式は計算書の系統、第二様式・第三様式は内訳表系） */
const closingOf = (form: string): DetailSection[] => {
  const [, n, k] = /^c(\d)-(\d)$/.exec(form) ?? [];
  if (k === '2' || k === '3') return CLOSING('内訳表', { serial: n === '3' });
  return CLOSING(n === '1' ? '資金収支' : n === '2' ? '事業活動' : '貸借対照表', { depth: form === 'c1-1' ? '大区分までの印刷' : undefined });
};
const FORM_NOTE: Record<string, string> = { 'c1-1': '第一号第一様式', 'c1-2': '第一号第二様式', 'c1-3': '第一号第三様式', 'c1-4': '第一号第四様式', 'c2-1': '第二号第一様式', 'c2-2': '第二号第二様式', 'c2-3': '第二号第三様式', 'c2-4': '第二号第四様式', 'c3-1': '第三号第一様式', 'c3-2': '第三号第二様式', 'c3-3': '第三号第三様式', 'c3-4': '第三号第四様式' };

export const REPORTS: ReportDef[] = [
  ...group('仕訳日記帳', '仕訳日記帳', [
    { id: 'j1', name: '仕訳日記帳', detail: D.journal, noZero: true },
    { id: 'j2', name: '仕訳伝票（伝票式）', detail: D.voucher, noZero: true },
    { id: 'j3', name: '振替伝票（振替式）', detail: D.transfer, noZero: true },
  ]),
  ...group('元帳', '元帳', [
    { id: 'l1', name: '総勘定元帳', scope: true, detail: D.ledger },
    { id: 'l2', name: '資金元帳', scope: true, detail: D.fundLedger },
    { id: 'l3', name: '取引先元帳', scope: true, detail: D.vendorLedger },
    { id: 'l4', name: '集計元帳', scope: true, cond: C.entry, detail: D.ledger },
    { id: 'l5', name: '取引先元帳（合算集計）', scope: true, memo: '法人全体の取引先を合算（旧 元帳（業者合算集計））', detail: D.vendorLedger },
  ]),
  ...group('試算表', '試算表', [
    { id: 't1', name: '資金収支計算書（試算表）', title: '資 金 収 支 計 算 書', detail: TRIAL() },
    { id: 't2', name: '事業活動計算書（試算表）', title: '事業活動計算書', detail: TRIAL({ depth: '細区分までの印刷' }) },
    { id: 't3', name: '貸借対照表（試算表）', title: '貸 借 対 照 表', detail: TRIAL({ extra: [chk('debtTitle', '貸借対照表(試算表) 負債の部タイトルを印刷する')] }) },
    { id: 't4', name: '資金収支残高試算表', title: '資金収支残高試算表', detail: TRIAL({ head2: true, depth: '細区分までの印刷', extra: [chk('corp', '法人名を印刷する'), chk('bs', '資金収支残高試算表 貸借を印刷する')] }) },
    { id: 't5', name: '残高試算表', title: '残　高　試　算　表', detail: TRIAL({ head2: true, serial: true }) },
  ]),
  ...group('予算', '予算書', [
    ...BUDGET4.map((k, i): R => ({ id: 'b' + (i + 1), name: `資金収支${k}予算書`, annual: true, budget: k === '補正' ? '補正' : '通常', title: BUDGET_TITLE[k], detail: BUDGET(k as BudgetKind) })),
    { id: 'b5', name: '資金収支予算内訳表', annual: true, cond: C.parent, rangeSumOnly: true, detail: BUDGET_INNER },
    { id: 'b6', name: '資金収支次年度予算内訳表', annual: true, cond: C.parent, rangeSumOnly: true, memo: '内訳表の列は［印刷区分］の表示区分選択で指定（合算テーブルは統合。確認メモ #380）', detail: BUDGET_INNER },
  ]),
  ...group('予算', '予算書（拠点区分）', BUDGET4.map((k, i): R => ({ id: 'bk' + (i + 1), name: `資金収支${k}予算書（拠点区分）`, annual: true, cond: C.service, budget: k === '補正' ? '補正' : '通常', title: BUDGET_TITLE[k], detail: BUDGET(k as BudgetKind) }))),
  ...group('予算', '予算管理表', [
    { id: 'bm1', name: '予算管理表（予算対比表）', title: '資金収支予算管理表', range: true, detail: TRIAL() },
    ...['資金収支月別予算推移表', '資金収支月別実績推移表', '資金収支月別予算実績推移表'].map((name, i): R => ({ id: 'bm' + (i + 2), name, outs: ['excel', 'csv'], zero: false, detail: D.monthly })),
  ]),
  ...group('決算書', '決算書', CLOSING12.map(([name, form]): R => ({ id: 'c' + form.slice(1), name, note: FORM_NOTE[form], common: true, form, cond: formCond(form), detail: closingOf(form) }))),
  // 別紙（注記・附属明細書・財産目録）は、中区分「別紙」の画面（AppendixPrintPage）で一覧・編集・印刷する
  ...group('補助簿（明細表）', '補助簿（明細表）', [
    { id: 's1', name: '○○［科目名］明細表', memo: '補助簿（明細表）設定で指定した科目ごと（例：事業未収金 明細表・職員預り金 明細表）', cond: C.subAcct, detail: D.sub },
  ]),
  ...group('準決算書', '準決算書', [
    { id: 'p1', name: '○○拠点区分 貸借対照表明細書', note: 'C別紙6', common: true, form: 'pc6', cond: formCond('pc6'), remarkBtn: '備考', detail: CLOSING('内訳表', { serial: true }) },
    { id: 'p2', name: '○○サービス区分 資金収支計算書', note: 'C1-5', common: true, form: 'pc1-5', cond: formCond('pc1-5'), detail: CLOSING('資金収支') },
    { id: 'p3', name: '○○サービス区分 事業活動計算書', note: 'C2-5', common: true, form: 'pc2-5', cond: formCond('pc2-5'), detail: CLOSING('事業活動') },
    { id: 'p4', name: '○○サービス区分 貸借対照表', note: 'C3-5', common: true, form: 'pc3-5', cond: formCond('pc3-5'), detail: CLOSING('貸借対照表') },
  ]),
  ...group('消費税', '消費税', [
    { id: 'x1', name: '消費税区分別集計内訳表', memo: '現行は条件画面だけ（詳細設定ボタンなし）', noZero: true, detail: D.taxInner },
    { id: 'x2', name: '消費税区分別集計表', range: true, noZero: true, title: '消費税区分別集計表', detail: D.tax },
    { id: 'x3', name: '科目別消費税区分別集計表', memo: '現行は条件画面の右半分に勘定科目・資金科目の一覧（科目名だけ、全てON／全てOFF、初期は未チェック）。科目設定は他の伝票入力区分と共有。印刷書式は科目名81mm・金額25mm', zero: false, acctPick: true, title: '消費税区分別集計表', detail: [{ ...D.tax[0], items: D.tax[0].items.map((it) => (it.k === 'area' && it.t === 'check' ? { ...it, on: false } : it)) }, ...D.tax.slice(1)] },
    { id: 'x4', name: '消費税区分コード内訳表', range: true, zero: false, detail: D.taxCode },
    { id: 'x5', name: '売上仕入税額集計表', memo: '現行の印刷メニューでは見当たらない（帳票・印刷_画面一覧には記載）', cond: C.honsoku, range: true, noZero: true, title: '売上仕入税額集計表', detail: D.tax },
  ]),
  ...group('経営分析', '経営分析', [
    ...([['財務分析一覧表', '各種財務分析事項の5年間の推移を一覧表形式で確認'], ['財務分析グラフ', '各種財務分析事項の10年間の推移を棒グラフで確認'], ['財務分析シート', '当年度の各種財務分析事項を円グラフで確認'], ['基本チェック表', '財務3表および選択した財務分析事項のグラフを確認'], ['経年推移グラフ', '各科目毎の推移を年別に棒グラフで確認'], ['経月推移グラフ', '各科目毎の推移を月別に棒グラフで確認'], ['前年度同月対比表', '各科目毎の前年度同月対比を一覧表形式で確認']] as const).map(([name, note], i): R => ({ id: 'a' + (i + 1), name, memo: note, noZero: true, detail: D.analysis })),
    { id: 'a8', name: '３期連続資金収支比較表', memo: '3期連続の資金収支を比較。決算予想ができる', noZero: true, detail: [{ title: '予想額', items: [rad('forecast', '当年度予算予想額の算出方法', ['当月より倍率', '当月累計＋過去の平均']), chk('thousand', '千円単位にする')] }, ...D.analysis] },
    ...([['財務分析内訳グラフ', '各経理区分の財務分析事項を円グラフで確認'], ['経月推移内訳グラフ', '各経理区分、各科目毎の推移を月別に棒グラフで確認'], ['経年推移内訳グラフ', '各経理区分、各科目毎の推移を年別に棒グラフで確認']] as const).map(([name, note], i): R => ({ id: 'a' + (i + 9), name, memo: note, noZero: true, cond: C.parent, detail: D.analysis })),
  ]),
  ...group('内部取引 一覧表', '内部取引 一覧表', [
    { id: 'i1', name: '内部取引 仕訳一覧表', memo: '登録されている仕訳伝票のみの集計（残高は含まない）。借方側・貸方側・要確認を色分け', noZero: true, outs: ['print', 'csv'], detail: D.internal },
    { id: 'i2', name: '内部取引 残高一覧表', memo: 'サービス区分ごとの表（内 事業／内 拠点／内 サービス／内 小サービス）と貸借計・差異', noZero: true, outs: ['print'], detail: [] },
    { id: 'i3', name: '内部取引 予算一覧表', memo: '残高一覧表と同じ表', noZero: true, outs: ['print'], detail: [] },
  ]),
  ...group('WAMNET連携出力', 'WAMNET連携出力', ['WAMNET連携設定', 'WAMNET連携科目チェック', 'WAMNET連携ファイル出力', 'WAMNET連携注記出力（PDF）', 'WAMNET連携注記出力（Excel）', 'WAMNET連携附属明細書出力（PDF）', 'WAMNET連携附属明細書出力（Excel）'].map((name, i): R => ({ id: 'w' + (i + 1), name, wamnet: true, note: i < 2 ? '設定・確認' : '出力', detail: [] }))),
  ...group('その他', 'その他', [
    { id: 'o1', name: '決算書 表紙', noZero: true, detail: [] },
    { id: 'o2', name: '収支分析表', memo: '［設定］で科目名称・金額の決定方法・背景色・文字色を指定', noZero: true, outs: ['print', 'excel'], detail: [{ title: '印刷項目', items: [chk('thousand', '金額を千円単位で表示する', true)] }] },
    { id: 'o3', name: '自動按分出力', cond: C.belowSite, detail: [{ title: '出力条件', items: [rad('kind', '出力種類', ['貸借対照表', '事業活動計算書', '資金収支計算書']), rad('cols', '出力する列', ['当年度末', '前年度末', '増減']), rad('round', '端数の加算区分', ['按分率の最も大きい区分', '最後の区分'])] }, { title: '印刷項目', items: [chk('sum', '合計値を印刷する', true)] }] },
    { id: 'o4', name: '取引先内訳表', memo: '旧 業者内訳表', cond: C.belowSite, detail: [{ title: '印刷項目', items: [chk('vsub', '取引先コード小計'), chk('zeroV', '0円の取引先を印刷しない', true), chk('area', '区分名を印刷する', true)] }] },
  ]),
];
/** 中区分の並び（現行の印刷メニューの順。別紙は決算書の次） */
export const CATS = ['仕訳日記帳', '元帳', '試算表', '予算', '決算書', '別紙', '補助簿（明細表）', '準決算書', '消費税', '経営分析', '内部取引 一覧表', 'WAMNET連携出力', 'その他'];
/** 中区分の中の小区分（並び順） */
export const subsOf = (cat: string) => [...new Set(REPORTS.filter((r) => r.cat === cat).map((r) => r.sub ?? cat))];
/** 表示条件を満たすか（条件のない帳票は常に表示） */
export const condOk = (r: ReportDef, s: Session) => !r.cond || r.cond.ok(s);

/* ---------------- 帳票名の「○○」（確認メモ #355・#356・#361〜#363） ---------------- */
/** 起動中の区分から法人までの区分（上から順） */
function chainOf(node: DivisionNode, label: string, up: DivisionNode[] = []): DivisionNode[] | null {
  const here = [...up, node];
  if (divisionLabel(node) === label) return here;
  for (const c of node.children ?? []) { const hit = chainOf(c, label, here); if (hit) return hit; }
  return null;
}
const withTail = (name: string, tail: string) => (name.endsWith(tail.replace(/区分$/, '')) ? name + '区分' : name + tail);
/** 補助簿（明細表）設定で指定した科目・項目の名前 */
export function subLedgerNames(s: Pick<Session, 'subLedger' | 'subBlue'>): string[] {
  const a = Object.entries(s.subLedger ?? {}).filter(([, on]) => on).map(([k]) => k.replace(/^#/, ''));
  const b = Object.entries(s.subBlue ?? {}).filter(([, on]) => on).map(([k]) => k);
  return [...new Set([...a, ...b])];
}
/** 帳票名の「○○事業区分」「○○拠点区分」「○○サービス区分」を、起動中の区分が属する区分の名前で埋める */
export function fillReportName(name: string, s: Pick<Session, 'tree' | 'division'>): string {
  if (!name.includes('○○')) return name;
  const chain = chainOf(s.tree, s.division) ?? [];
  const biz = chain.find((n) => n.kind === '事業区分');
  const site = chain.find((n) => n.kind === '拠点区分');
  const svc = chain.find((n) => n.kind === 'サービス区分');
  // 拠点区分以上で起動中のときは、拠点区分に属するサービス区分の名前を並べる
  const svcs = svc ? [svc] : (site?.children ?? []).filter((n) => n.kind === 'サービス区分');
  let out = name;
  if (biz) out = out.replace('○○事業区分', withTail(biz.name, '事業区分'));
  if (site) out = out.replace('○○拠点区分', withTail(site.name, '拠点区分'));
  if (svcs.length) out = out.replace('○○サービス区分', svcs.map((n) => n.name).join('・') + 'サービス区分');
  return out;
}
/** 印刷センターに出す帳票：区分名を埋め、補助簿（明細表）は設定した科目ごとに分ける */
export function localizeReports(s: Session): ReportDef[] {
  const subs = subLedgerNames(s);
  return REPORTS.flatMap((r): ReportDef[] => {
    if (r.id === 's1') return subs.length ? subs.map((n) => ({ ...r, id: 's1:' + n, name: `${n} 明細表`, title: `${n}明細表` })) : [r];
    return [{ ...r, name: fillReportName(r.name, s) }];
  });
}
