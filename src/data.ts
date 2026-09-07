// 仕訳伝票入力 画面 — 静的マスタ / メニュー / シードデータ
// 注: 本番では会計マスタAPIから取得する想定（README「マスタデータ」参照）

import type { JournalEntry } from './types';

/** 勘定科目（分類見出しあり） */
export const ACCOUNTS: { group: string; items: string[] }[] = [
  { group: '現金及び預金', items: ['現金', '普通預金（保育園）', '当座預金（保育園）', '小口現金'] },
  { group: '事業未収金', items: ['事業未収金', '未収金', '立替金', '仮払金'] },
  {
    group: '事業費',
    items: ['保育材料費', '給食費', '水道光熱費（事業）', '通信運搬費', '賃借料（事業）', '印刷製本費', '消耗品費'],
  },
  {
    group: '人件費',
    items: ['職員俸給', '法定福利費', '特殊業務手当', '扶養手当', '時間外手当', '通勤手当', 'その他手当'],
  },
  { group: '事業収益', items: ['委託費収益', 'その他の利用料収益', '現金（収入）', '受託事業収益', '補助金収益'] },
];

/** サービス区分（見出しなし） */
export const SERVICES = ['001 本部', '002 保育事業', '003 子育て支援', '004 一時預かり', '005 地域支援'];

/** 業者（見出しなし）。「（なし）」選択時は空値に。 */
export const VENDORS = ['（なし）', '東京電力', 'ＮＴＴ東日本', '中央リース', 'みどり商店', '市役所', '保護者'];

/** 摘要（見出し「よく使う摘要」） */
export const SUMMARIES = [
  '健康保険',
  '厚生年金',
  '法定福利費',
  '職員俸給',
  '委託費ー８月分',
  '電話料金',
  'ガス代ー７月分',
  '副食費ー保護者より',
  'コピー代',
  '夏祭り用品',
  '振込手数料',
];

/** 勘定科目を分類なしのフラット配列に（検索プルダウン用） */
export function accountFlat(): string[] {
  const a: string[] = [];
  ACCOUNTS.forEach((g) => g.items.forEach((v) => a.push(v)));
  return a;
}

/** サイドメニュー / ナビの項目（11グループ） */
export const MENU: string[][] = [
  ['単一入力', '伝票入力', '振替入力', '振替単一'],
  ['仕訳一覧', '勘定元帳', '資金元帳', '業者元帳'],
  ['科目推移', '資金推移', '業者推移'],
  ['月次試算', '予算対比', '月次決算'],
  ['仕訳数'],
  ['日次調査', '決算調査'],
  ['小口現金', '減価償却', '預金出納', '収入支出'], // オプションメニュー
  ['経年グラフ', '分析グラフ', '充実残額'],
  ['バージョン'],
  ['当年仕訳'],
  ['前年仕訳', '元帳１', '元帳２', '残高照合'],
];

/** オプション契約の機能（メニュー上で色分け表示） */
export const OPTION_MENU = ['小口現金', '減価償却', '預金出納', '収入支出'];
export const isOptionMenu = (label: string) => OPTION_MENU.includes(label);

/** 法人メニュー（通常メニューと別枠でアプリバーに配置） */
export const CORP_MENU = ['法人調査', '法人印刷'];

/** 初期表示のメニュー項目 */
export const DEFAULT_MENU = '伝票入力';

/** プロトタイプとして画面を用意しているメニュー項目 */
export const IMPLEMENTED_MENU = ['単一入力', '伝票入力', '振替入力', '日次調査', '決算調査'];

/** 仕訳帳シード（フォーム型・8件） */
const SEED_FORM: Omit<JournalEntry, 'id'>[] = [
  { date: '8/1', kari: '健康保険', kashi: '普通預金（保育園）', tekiyo: '健康保険', amount: 237873 },
  { date: '8/1', kari: '厚生年金', kashi: '普通預金（保育園）', tekiyo: '厚生年金', amount: 390886 },
  { date: '8/1', kari: '法定福利費', kashi: '普通預金（保育園）', tekiyo: '健康保険・厚生年金', amount: 670361 },
  { date: '8/1', kari: '保育材料費', kashi: '普通預金（保育園）', tekiyo: '夏祭り用品', amount: 12529 },
  { date: '8/1', kari: '手数料', kashi: '小口現金', tekiyo: '振込手数料', amount: 660 },
  { date: '8/1', kari: '水道光熱費（事業）', kashi: '普通預金（保育園）', tekiyo: '水道料金', amount: 23870 },
  { date: '8/4', kari: '現金（収入）', kashi: 'その他の利用料収益', tekiyo: '副食費ー保護者より', amount: 4500 },
  { date: '8/5', kari: '通信運搬費', kashi: '普通預金（保育園）', tekiyo: '電話料金', amount: 8936 },
];

/** 仕訳帳シード（スプレッドシート型・10件） */
const SEED_SHEET: Omit<JournalEntry, 'id'>[] = [
  ...SEED_FORM,
  { date: '8/5', kari: '賃借料（事業）', kashi: '普通預金（保育園）', tekiyo: '冷凍冷蔵庫リース代', amount: 18216 },
  { date: '8/8', kari: '印刷製本費', kashi: '普通預金（保育園）', tekiyo: 'コピー代', amount: 10287 },
];

/**
 * シードから仕訳帳配列を生成。
 * 初期エントリは負のidを割り当て、submitで採番する正のidと衝突させない。
 */
function seedToJournal(seed: Omit<JournalEntry, 'id'>[]): JournalEntry[] {
  let id = -1;
  return seed.map((e) => ({ ...e, id: id-- }));
}

/** 単一入力シード（4件・証憑/業者つき） */
const SEED_SINGLE: Omit<JournalEntry, 'id'>[] = [
  { date: '8/1', kari: '法定福利費', kashi: '普通預金（保育園）', tekiyo: '健康保険・厚生年金', amount: 670361, shohyo: true },
  { date: '8/1', kari: '保育材料費', kashi: '小口現金', tekiyo: '夏祭り用品', gyosha: 'みどり商店', amount: 12529, shohyo: true },
  { date: '8/4', kari: '現金（収入）', kashi: 'その他の利用料収益', tekiyo: '副食費ー保護者より', gyosha: '保護者', amount: 4500, shohyo: false },
  { date: '8/5', kari: '通信運搬費', kashi: '普通預金（保育園）', tekiyo: '電話料金', gyosha: 'ＮＴＴ東日本', amount: 8936, shohyo: true },
];

export const makeFormSeed = () => seedToJournal(SEED_FORM);
export const makeSingleSeed = () => seedToJournal(SEED_SINGLE);
export const makeSheetSeed = () => seedToJournal(SEED_SHEET);

/** 決算調査（決算チェック）の項目。既存システムの 01〜28 を転記（★は既存表記のまま） */
export const AUDIT_ITEMS: { no: number; name: string }[] = [
  { no: 1, name: '前期末支払資金残高' },
  { no: 2, name: '当期末支払資金残高' },
  { no: 3, name: '当期資金収支差額' },
  { no: 4, name: '次期繰越活動増減差額' },
  { no: 5, name: '（うち当期繰越活動増減差額）' },
  { no: 6, name: '積立金と積立資産－①' },
  { no: 7, name: '積立金と積立資産－②' },
  { no: 8, name: '諸口勘定科目の残高' },
  { no: 9, name: '減価償却資産の増減' },
  { no: 10, name: '退職共済' },
  { no: 11, name: '設備資金借入金の増減' },
  { no: 12, name: '国庫補助金等特別積立金の増減' },
  { no: 13, name: '基本金の増減' },
  { no: 14, name: '10万円以上の費用' },
  { no: 15, name: '減価償却システムの期首帳簿価格' },
  { no: 16, name: '減価償却システムの減価償却費' },
  { no: 17, name: '減価償却システムの期末帳簿価格' },
  { no: 18, name: '前期末支払資金残高(予算・決算)' },
  { no: 19, name: '人件費・事業費・事務費' },
  { no: 20, name: '★前年度との連続性' },
  { no: 21, name: '★期中残高 0円チェック(未収金)' },
  { no: 22, name: '★期中残高 0円チェック(未払金)' },
  { no: 23, name: '★１年基準科目 期中残高チェック' },
  { no: 24, name: '★内部取引合計残高チェック' },
  { no: 25, name: '★特定勘定科目残高チェック' },
  { no: 26, name: '★予備費予算額チェック' },
  { no: 27, name: '★予算額の支払資金残高率' },
  { no: 28, name: '★小口現金出納帳残高チェック' },
];

/** 決算調査の「説明」文。既存システムから確認できたものだけ転記（他はクライアントから提供予定） */
export const AUDIT_EXPLANATIONS: Record<number, { left: string; right: string; text: string }> = {
  4: {
    left: '次期繰越\n活動増減差額',
    right: '次期繰越\n活動増減差額\n（１７）',
    text: '事業活動計算書の「次期繰越活動増減差額(17)」の額と、貸借対照表の「次期繰越活動収支差額」が一致していることを確認します。',
  },
};

/** 日次調査の結果に使うサンプル値（構造の確認用。実データではありません） */
export const DAILY_AUDIT_SAMPLE = {
  shishutsu: 17_100_000,
  zenkiShiharai: 9_800_000,
  shunyu: 16_000_000,
  tokiShiharai: 8_700_000,
  ryudoShisan: 9_150_000,
  ryudoFusai: 700_000,
  hikiate: 250_000,
  koteiShisan: 39_400_000,
  koteiFusai: 0,
  junShisan: 7_700_000,
  jigyoShishutsu: 15_400_000,
  jigyoShunyu: 16_000_000,
  zenkiKurikoshi: -8_300_000,
  jikiKurikoshi: -7_700_000,
};
