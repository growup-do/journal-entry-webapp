// 勘定科目設定（依頼 5.5.7「科目設定（科目マスター登録）画面の一覧性改善」）：
//   縦長の階層一覧（項目＝集計上の見出し／科目＝伝票に入力する科目）＋ 右側の詳細パネル ＋「標準科目からチェックして追加」。
//   コード（表示コード・費目コード・区分コード 3-2-2-2-2）は親項目から自動設定。関連する設定（科目色・減価償却連動・1年基準・
//   決算附属明細書・内部取引）を詳細パネルにまとめて表示。勘定科目／資金科目／費目／使用科目設定タブ、Excel／CSV／印刷、注意事項、▲入換▼。
//   摘要辞書の自動補完候補もここ（SummaryAutoCompleteTab）。

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ExplainModal } from './ExplainModal';
import { ExportDialog, type ExportKind, type ExportSpec } from './ExportDialog';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input, lbl } from './ui';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { ACCOUNT_META, accountMatches, toKatakana, type AccountMeta } from '../lib/accounts';
import { ACCOUNTS, SERVICES, SUMMARIES, displayName } from '../data';
import { useSession } from '../store/session';

const HIMOKU_BS = [[1, 'サービス活動収益計 (1)'], [2, 'サービス活動費用計 (2)'], [3, 'サービス活動増減差額 (3)=(1)-(2)'], [4, 'サービス活動外収益計 (4)'], [5, 'サービス活動外費用計 (5)'], [7, '経常増減差額 (7)=(3)+(6)'], [8, '特別収益計 (8)'], [9, '特別費用計 (9)'], [11, '当期活動増減差額 (11)'], [50, '流動資産'], [51, '基本財産'], [52, 'その他の固定資産'], [60, '流動負債'], [61, '固定負債'], [70, '基本金'], [71, '国庫補助金等特別積立金'], [72, 'その他の積立金'], [80, '次期繰越活動増減差額']] as const;
const HIMOKU_FUND = [[1, '事業活動収入計 (1)'], [2, '事業活動支出計 (2)'], [3, '事業活動資金収支差額 (3)'], [4, '施設整備等収入計 (4)'], [5, '施設整備等支出計 (5)'], [7, 'その他の活動収入計 (7)'], [8, 'その他の活動支出計 (8)'], [10, '予備費支出 (10)'], [11, '当期資金収支差額合計 (11)'], [12, '前期末支払資金残高 (12)'], [13, '当期末支払資金残高 (11)+(12)']] as const;

type Cls = AccountMeta['cls'];
/** 項目（集計上の見出し）。top＝大項目、name＝中項目。科目のコードはこの項目から自動設定する */
interface GroupDef { name: string; top: string; cls: Cls; himoku: string; fundHimoku: string; prefix: string; fixed?: boolean }
const GROUPS: GroupDef[] = [
  { name: '現金及び預金', top: '流動資産', cls: '現預金', himoku: '50', fundHimoku: '', prefix: '11' },
  { name: '事業未収金', top: '流動資産', cls: '資産', himoku: '50', fundHimoku: '', prefix: '12' },
  { name: 'その他の流動資産', top: '流動資産', cls: '資産', himoku: '50', fundHimoku: '', prefix: '13' },
  { name: '基本財産', top: '固定資産', cls: '資産', himoku: '51', fundHimoku: '', prefix: '15', fixed: true },
  { name: 'その他の固定資産', top: '固定資産', cls: '資産', himoku: '52', fundHimoku: '', prefix: '16', fixed: true },
  { name: '流動負債', top: '負債', cls: '負債', himoku: '60', fundHimoku: '', prefix: '21' },
  { name: '固定負債', top: '負債', cls: '負債', himoku: '61', fundHimoku: '', prefix: '22' },
  { name: '事業収益', top: 'サービス活動収益', cls: '収益', himoku: '1', fundHimoku: '1', prefix: '41' },
  { name: '保育事業収益', top: 'サービス活動収益', cls: '収益', himoku: '1', fundHimoku: '1', prefix: '42' },
  { name: '人件費', top: 'サービス活動費用', cls: '費用', himoku: '2', fundHimoku: '2', prefix: '51' },
  { name: '事業費', top: 'サービス活動費用', cls: '費用', himoku: '2', fundHimoku: '2', prefix: '52' },
  { name: '事務費', top: 'サービス活動費用', cls: '費用', himoku: '2', fundHimoku: '2', prefix: '53' },
  { name: '減価償却費等', top: 'サービス活動費用', cls: '費用', himoku: '2', fundHimoku: '', prefix: '54' },
  { name: 'サービス活動外収益', top: 'サービス活動外増減', cls: '収益', himoku: '4', fundHimoku: '1', prefix: '43' },
  { name: 'サービス活動外費用', top: 'サービス活動外増減', cls: '費用', himoku: '5', fundHimoku: '2', prefix: '55' },
];
const groupDef = (g: string) => GROUPS.find((x) => x.name === g) ?? GROUPS[0];
const groupIdx = (g: string) => GROUPS.findIndex((x) => x.name === g);
/** 区分コード（3-2-2-2-2 桁）：表示コードの上2桁＝項目、下2桁＝項目内の連番 */
const kubunOf = (code: string) => `${code.slice(0, 2).padEnd(2, '0')}0-${code.slice(2, 4).padEnd(2, '0')}-00-00-00`;
const headKubun = (g: GroupDef) => `${g.prefix}0-00-00-00-00`;

/** 社会福祉法人会計基準の標準科目（サンプル）。「科目を追加」でチェックして一覧へ追加する */
interface StdItem { name: string; kana: string; group: string; desc: string; noFund?: boolean }
const STD: StdItem[] = [
  { group: 'その他の流動資産', name: '有価証券', kana: 'ユウカショウケン', desc: '一時的に保有する国債・地方債・株式などの有価証券。' },
  { group: 'その他の流動資産', name: '貯蔵品', kana: 'チョゾウヒン', desc: '未使用の消耗品・給食用材料などの期末在庫。' },
  { group: 'その他の流動資産', name: '前払金', kana: 'マエバライキン', desc: '物品の購入代金やサービスの対価を前もって支払った金額。' },
  { group: 'その他の流動資産', name: '前払費用', kana: 'マエバライヒヨウ', desc: '保険料・賃借料など、翌期以降の期間に対応する支払済みの費用。' },
  { group: 'その他の流動資産', name: '短期貸付金', kana: 'タンキカシツケキン', desc: '貸借対照表日の翌日から1年以内に回収期限が到来する貸付金。' },
  { group: 'その他の流動資産', name: '1年以内回収予定長期貸付金', kana: 'イチネンイナイカイシュウヨテイチョウキカシツケキン', desc: '長期貸付金のうち、1年以内に回収期限が到来する部分（1年基準）。' },
  { group: '基本財産', name: '土地', kana: 'トチ', desc: '基本財産に帰属する土地。減価償却は行いません。' },
  { group: '基本財産', name: '建物', kana: 'タテモノ', desc: '基本財産に帰属する建物及び建物付属設備。' },
  { group: 'その他の固定資産', name: '構築物', kana: 'コウチクブツ', desc: '建物以外の土地に固着している建造物（門・塀・遊具の基礎など）。' },
  { group: 'その他の固定資産', name: '車輌運搬具', kana: 'シャリョウウンパング', desc: '送迎用バス・乗用車などの車輌。' },
  { group: 'その他の固定資産', name: '器具及び備品', kana: 'キグオヨビビヒン', desc: '耐用年数1年以上かつ一定金額以上の器具・備品。減価償却の対象です。' },
  { group: 'その他の固定資産', name: 'ソフトウェア', kana: 'ソフトウェア', desc: 'コンピュータソフトウェアの購入・制作費用（無形固定資産）。' },
  { group: 'その他の固定資産', name: '長期貸付金', kana: 'チョウキカシツケキン', desc: '回収期限が1年を超えて到来する貸付金。' },
  { group: 'その他の固定資産', name: '退職給付引当資産', kana: 'タイショクキュウフヒキアテシサン', desc: '退職金の支払いに充てるために積み立てた預金等。' },
  { group: '流動負債', name: '事業未払金', kana: 'ジギョウミバライキン', desc: '事業活動に伴う費用等の未払い債務。' },
  { group: '流動負債', name: 'その他の未払金', kana: 'ソノタノミバライキン', desc: '固定資産の購入など、事業未払金以外の未払い債務。' },
  { group: '流動負債', name: '預り金', kana: 'アズカリキン', desc: '職員以外の者からの一時的な預り金。' },
  { group: '流動負債', name: '職員預り金', kana: 'ショクインアズカリキン', desc: '源泉所得税・社会保険料など、職員に関する一時的な預り金。' },
  { group: '流動負債', name: '1年以内返済予定設備資金借入金', kana: 'イチネンイナイヘンサイヨテイセツビシキンカリイレキン', desc: '設備資金借入金のうち、1年以内に支払期限が到来する部分（1年基準）。' },
  { group: '流動負債', name: '賞与引当金', kana: 'ショウヨヒキアテキン', desc: '翌期に支給する職員賞与のうち、当期の負担に属する見積額。' },
  { group: '固定負債', name: '設備資金借入金', kana: 'セツビシキンカリイレキン', desc: '施設設備等に係る外部からの長期借入金。' },
  { group: '固定負債', name: '長期運営資金借入金', kana: 'チョウキウンエイシキンカリイレキン', desc: '経常経費に係る外部からの長期借入金。' },
  { group: '固定負債', name: '退職給付引当金', kana: 'タイショクキュウフヒキアテキン', desc: '将来支給する退職金のうち、当期末までの負担に属する金額。' },
  { group: '保育事業収益', name: '施設型給付費収益', kana: 'シセツガタキュウフヒシュウエキ', desc: '施設型給付費の代理受領分。' },
  { group: '保育事業収益', name: '利用者等利用料収益', kana: 'リヨウシャトウリヨウリョウシュウエキ', desc: '実費徴収・特定負担額など、利用者等から受け取る利用料。' },
  { group: '保育事業収益', name: '私的契約利用料収益', kana: 'シテキケイヤクリヨウリョウシュウエキ', desc: '保育所等における私的契約に基づく利用料収益。' },
  { group: '人件費', name: '役員報酬', kana: 'ヤクインホウシュウ', desc: '役員（評議員を含む）に支払う報酬・諸手当。' },
  { group: '人件費', name: '職員賞与', kana: 'ショクインショウヨ', desc: '常勤職員に支払う賞与。' },
  { group: '人件費', name: '非常勤職員給与', kana: 'ヒジョウキンショクインキュウヨ', desc: '非常勤職員に支払う俸給・諸手当及び賞与。' },
  { group: '人件費', name: '退職給付費用', kana: 'タイショクキュウフヒヨウ', desc: '退職共済制度の掛金や退職給付引当金の繰入額など。' },
  { group: '事業費', name: '保健衛生費', kana: 'ホケンエイセイヒ', desc: '利用者の健康診断、施設内の消毒等に要する費用。' },
  { group: '事業費', name: '被服費', kana: 'ヒフクヒ', desc: '利用者の衣類・寝具等の購入に要する費用。' },
  { group: '事業費', name: '教養娯楽費', kana: 'キョウヨウゴラクヒ', desc: '行事・レクリエーション等、利用者の教養娯楽に要する費用。' },
  { group: '事業費', name: '車輌費', kana: 'シャリョウヒ', desc: '送迎用車輌等の燃料費・車検等の費用（事業）。' },
  { group: '事務費', name: '福利厚生費', kana: 'フクリコウセイヒ', desc: '役員・職員の健康診断、慶弔、福利厚生のための費用。' },
  { group: '事務費', name: '旅費交通費', kana: 'リョヒコウツウヒ', desc: '業務に係る役員・職員の出張旅費及び交通費。' },
  { group: '事務費', name: '研修研究費', kana: 'ケンシュウケンキュウヒ', desc: '役員・職員の研修・研究に要する費用。' },
  { group: '事務費', name: '事務消耗品費', kana: 'ジムショウモウヒンヒ', desc: '事務用の消耗品・器具什器のうち固定資産に該当しないもの。' },
  { group: '事務費', name: '修繕費', kana: 'シュウゼンヒ', desc: '建物・器具及び備品等の修繕・保守に要する費用。' },
  { group: '事務費', name: '業務委託費', kana: 'ギョウムイタクヒ', desc: '清掃・警備・会計処理など、業務の一部を外部に委託する費用。' },
  { group: '事務費', name: '手数料', kana: 'テスウリョウ', desc: '振込手数料など、役務提供に係る手数料。' },
  { group: '事務費', name: '保険料', kana: 'ホケンリョウ', desc: '火災保険・自動車保険・賠償責任保険等の保険料。' },
  { group: '事務費', name: '租税公課', kana: 'ソゼイコウカ', desc: '消費税・固定資産税・印紙税・自動車税等。' },
  { group: '減価償却費等', name: '減価償却費', kana: 'ゲンカショウキャクヒ', desc: '固定資産の減価償却の額。資金収支とは無関係の科目です。', noFund: true },
  { group: '減価償却費等', name: '国庫補助金等特別積立金取崩額', kana: 'コッコホジョキントウトクベツツミタテキントリクズシガク', desc: '減価償却等に対応して取り崩す国庫補助金等特別積立金の額（費用の控除項目）。', noFund: true },
  { group: 'サービス活動外収益', name: '借入金利息補助金収益', kana: 'カリイレキンリソクホジョキンシュウエキ', desc: '借入金利息に係る地方公共団体等からの補助金。' },
  { group: 'サービス活動外収益', name: '受取利息配当金収益', kana: 'ウケトリリソクハイトウキンシュウエキ', desc: '預貯金・有価証券等の利息及び配当金。' },
  { group: 'サービス活動外費用', name: '支払利息', kana: 'シハライリソク', desc: '設備資金借入金・長期運営資金借入金等の利息。' },
];

/** 既存科目の説明（サンプル） */
const DESC: Record<string, string> = {
  現金: '手許にある現金。小口現金出納帳と連動します。', '普通預金（保育園）': '保育園拠点の普通預金口座。預金出納帳の対象です。', '当座預金（保育園）': '保育園拠点の当座預金口座。', 小口現金: '日常の少額の支払いに充てるための現金。',
  事業未収金: '事業収益に対する未収入金（委託費・補助金など）。', 未収金: '事業収益以外の未収入金。', 立替金: '一時的に立替払いをした金額。', 仮払金: '処理すべき科目や金額が確定しない場合の支出額を一時的に処理する科目。',
  保育材料費: '保育に必要な文具材料・絵本・玩具等の購入費用。', 給食費: '食材及び食品の費用。', '水道光熱費（事業）': '利用者に直接必要な電気・ガス・水道等の費用。', 通信運搬費: '電話・郵便・インターネット接続料等。', '賃借料（事業）': '利用者が使用する器具及び備品のリース料・レンタル料。', 印刷製本費: '事務に必要な書類・諸用紙・関係資料の印刷及び製本の費用。', 消耗品費: '事務用品以外の消耗品で固定資産に該当しないもの。',
  職員俸給: '常勤職員に支払う俸給（本俸）。', 法定福利費: '法令に基づいて法人が負担する健康保険料・厚生年金保険料・雇用保険料等。', 特殊業務手当: '特殊な業務に従事する職員に支払う手当。', 扶養手当: '扶養親族のある職員に支払う手当。', 時間外手当: '所定時間外の勤務に対して支払う手当。', 通勤手当: '通勤に要する費用として支払う手当。', その他手当: '上記に該当しない諸手当。',
  委託費収益: '保育所運営に係る市区町村からの委託費。', その他の利用料収益: '利用者からの利用料（委託費・補助金以外）。', '現金（収入）': '収入を現金で受け取った場合に使う科目。', 受託事業収益: '地方公共団体から委託された事業に係る収益。', 補助金収益: '保育事業に対する地方公共団体等からの補助金。',
};

const B_OPTS = ['0：科目特性無し', '1：現金科目（小口現金連動）', '2：預金科目', '7：予算にのみ使用する科目', '8：前年度繰越額', '9：当年度繰越額'];
const E_OPTS = ['0：両加算', '1：借方加算＆貸方減算', '2：借方減算＆貸方加算', '3：資金収支と無関係（減価償却費など）', '4：資金科目（流動資産・流動負債）'];
const INTERNAL_OPTS = ['0：通常の勘定科目', '1：事業区分間の取引', '2：拠点区分間の取引', '3：サービス区分間の取引', '4：小サービス区分間の取引'];
const F_OPTS = ['0：指定なし', '1：保育事業', '2：子育て支援'];
const MEISAI_OPTS = ['', '借入金明細書', '基本財産及びその他の固定資産（有形・無形固定資産）の明細書', '引当金明細書', '補助金事業等収益明細書', '積立金・積立資産明細書', '事業区分間及び拠点区分間繰入金明細書'];
/** 施設（拠点）ごとの表示名を設定できる拠点（サンプル） */
const SITES = ['本部', 'みどり保育園', 'わかば保育園', '子育て支援センター'];
/** まとめて設定の入力値（''＝変更しない） */
const EMPTY_BULK = { color: '', depr: '', oneYear: '', meisai: '', internal: '' };
const COLOR_PRESETS: { label: string; fg: string; bg: string }[] = [{ label: '赤字', fg: '#c0392b', bg: '#ffffff' }, { label: '青字', fg: '#2c5f9e', bg: '#ffffff' }, { label: '黄背景', fg: '#22303c', bg: '#fff1b8' }, { label: '緑背景', fg: '#1f5a3f', bg: '#e1f3e9' }];

interface AcctRow extends AccountMeta {
  group: string; himoku: string; kubun: string; printName: string; dispName: string; siteNames: Record<string, string>;
  a: '1' | '2'; b: string; c: '0' | '1'; d: '0' | '1'; e: string; f: string; internal: string; partner: string; fundHimoku: string; fundKubun: string; key: number;
  desc: string; manualCode: boolean; color: { fg: string; bg: string } | null; depr: boolean; oneYear: boolean; meisai: string;
}
const fundOf = (name: string, cls: Cls, noFund?: boolean) => (noFund ? '—' : cls === '費用' ? name.replace(/（.*）/, '') + '支出' : cls === '収益' ? name.replace(/収益$/, '収入') : cls === '現預金' ? '（支払資金）' : '—');
const makeRow = (m: AccountMeta, group: string, key: number, desc = ''): AcctRow => {
  const g = groupDef(group); const pl = m.cls === '費用' || m.cls === '収益'; const noFund = m.fund === '—';
  return {
    ...m, group, himoku: g.himoku, kubun: kubunOf(m.code), printName: m.name, dispName: m.name, siteNames: {},
    a: m.cls === '収益' || m.cls === '負債' ? '2' : '1', b: m.cls === '現預金' ? (m.name.includes('現金') ? B_OPTS[1] : B_OPTS[2]) : B_OPTS[0], c: /手当|俸給/.test(m.name) ? '1' : '0', d: '1',
    e: pl ? (noFund ? E_OPTS[3] : m.cls === '費用' ? E_OPTS[2] : E_OPTS[1]) : m.cls === '現預金' || g.top === '流動資産' || g.name === '流動負債' ? E_OPTS[4] : E_OPTS[0],
    f: '0', internal: INTERNAL_OPTS[0], partner: '', fundHimoku: pl && !noFund ? g.fundHimoku : '', fundKubun: pl && !noFund ? kubunOf(m.code) : '', key,
    desc: desc || DESC[m.name] || `「${g.name}」に属する科目です。`, manualCode: false, color: null, depr: !!g.fixed && m.name !== '土地' && !/貸付金|引当資産/.test(m.name), oneYear: /1年以内/.test(m.name),
    meisai: /借入金$/.test(m.name) ? MEISAI_OPTS[1] : g.fixed ? MEISAI_OPTS[2] : /引当金$/.test(m.name) ? MEISAI_OPTS[3] : /補助金/.test(m.name) ? MEISAI_OPTS[4] : '',
  };
};
const stdMeta = (s: StdItem, code: string): AccountMeta => { const g = groupDef(s.group); return { name: s.name, code, kana: s.kana, kind: g.cls === '費用' || g.cls === '収益' ? 'PL' : 'BS', cls: g.cls, fund: fundOf(s.name, g.cls, s.noFund) }; };
const sortRows = (rs: AcctRow[]) => [...rs].sort((x, y) => groupIdx(x.group) - groupIdx(y.group));
/** 項目内で次に空いている表示コード（10 刻み） */
const lastCode = (g: GroupDef, rows: AcctRow[]) => Math.max(Number(g.prefix) * 100, ...rows.filter((r) => r.code.length === 4 && r.code.startsWith(g.prefix)).map((r) => Number(r.code)));
type Codes = { code: string; himoku: string; kubun: string };
/** チェックした標準科目の表示コード・費目コード・区分コードを親項目から自動設定 */
const autoCodes = (names: string[], rows: AcctRow[]): Record<string, Codes> => {
  const last: Record<string, number> = {}; const out: Record<string, Codes> = {};
  names.forEach((n) => {
    const s = STD.find((x) => x.name === n); if (!s) return; const g = groupDef(s.group);
    if (last[g.name] == null) last[g.name] = lastCode(g, rows);
    last[g.name] += 10; const code = String(last[g.name]); out[n] = { code, himoku: g.himoku, kubun: kubunOf(code) };
  });
  return out;
};
const initRows = (): AcctRow[] => {
  const base = ACCOUNT_META.map((m, i) => makeRow(m, ACCOUNTS.find((g) => g.items.includes(m.name))?.group ?? '事業費', 1000 + i));
  // 標準科目のうち、よく使うものを最初から登録済みにしておく（負債・固定資産の見本）
  const pre = ['器具及び備品', '事業未払金', '預り金', '設備資金借入金']; const codes = autoCodes(pre, base);
  const extra = pre.map((n, i) => { const s = STD.find((x) => x.name === n)!; return makeRow(stdMeta(s, codes[n].code), s.group, 1100 + i, s.desc); });
  return sortRows([...base, ...extra]);
};
const rowMatches = (r: AcctRow, q: string) => {
  const t = q.trim(); if (!t) return true;
  if (accountMatches(r.name, t)) return true;
  const d = t.replace(/-/g, '');
  return r.dispName.includes(t) || r.printName.includes(t) || r.fund.includes(t) || r.code.startsWith(t) || (d !== '' && r.kubun.replace(/-/g, '').startsWith(d)) || (!!r.kana && r.kana.startsWith(toKatakana(t)));
};

/* ---- 小さな表示部品 ---- */
const Badge = ({ kind }: { kind: '項目' | '科目' }) => (
  <span title={kind === '項目' ? '集計上の見出し（伝票には入力しません）' : '伝票に入力する科目'} style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, lineHeight: '16px', padding: '0 6px', borderRadius: 5, border: '1px solid ' + (kind === '項目' ? '#3d4a56' : '#b9c6d2'), background: kind === '項目' ? '#3d4a56' : '#fff', color: kind === '項目' ? '#fff' : '#5b6773' }}>{kind}</span>
);
const Chip = ({ on, onClick, accent, children }: { on: boolean; onClick: () => void; accent: string; children: ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} style={{ padding: '4px 11px', borderRadius: 999, border: '1px solid ' + (on ? accent : '#cfd8e0'), background: on ? accent : '#fff', color: on ? '#fff' : '#48565f', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>{children}</button>
);
const AutoTag = ({ manual }: { manual?: boolean }) => <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 5, background: manual ? '#fff1b8' : '#e8f0fb', color: manual ? '#8a6d00' : '#2c5f9e', marginLeft: 6 }}>{manual ? '手動' : '自動設定'}</span>;
const Mark = ({ children, title }: { children: ReactNode; title: string }) => <span title={title} style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#eef2f6', color: '#48565f' }}>{children}</span>;
const Swatch = ({ c }: { c: { fg: string; bg: string } }) => <span title="科目色" style={{ display: 'inline-block', width: 22, height: 15, borderRadius: 4, border: '1px solid #cfd8e0', background: c.bg, color: c.fg, fontSize: 10.5, fontWeight: 800, lineHeight: '15px', textAlign: 'center' }}>A</span>;
const Section = ({ title, note, right, children }: { title: string; note?: string; right?: ReactNode; children: ReactNode }) => (
  <section style={{ ...card, marginTop: 12 }}>
    <div style={cardHead}>{title}{note && <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>{note}</span>}{right && <span style={{ marginLeft: 'auto' }}>{right}</span>}</div>
    <div style={{ padding: 12 }}>{children}</div>
  </section>
);
const RelRow = ({ label, note, state, on, onOpen, disabled }: { label: string; note: string; state: ReactNode; on: boolean; onOpen: () => void; disabled?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f1f4f6' }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#8290a0', lineHeight: 1.5 }}>{note}</div>
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color: on ? '#1f7a52' : '#9aa5b1', textAlign: 'right', maxWidth: 150 }}>{state}</span>
    <span data-tip={disabled ? '左のスイッチをオンにすると設定できます' : undefined} style={{ display: 'inline-flex' }}><button type="button" onClick={onOpen} disabled={disabled} style={{ ...btn('#5b6773', false, true), opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' }}>設定</button></span>
  </div>
);

type RelKind = 'color' | 'depr' | 'oneYear' | 'meisai' | 'internal';
const REL_TITLE: Record<RelKind, string> = { color: '科目色設定', depr: '減価償却連動（固定資産科目）', oneYear: '1年基準科目', meisai: '決算附属明細書へ集計する科目', internal: '内部取引科目と相手区分' };
const CLS_CHIPS: Cls[] = ['現預金', '資産', '負債', '収益', '費用'];

export function AccountSettingsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [tab, setTab] = useState('勘定科目');
  const [rows, setRows] = useState<AcctRow[]>(initRows);
  const [selKey, setSelKey] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [clsF, setClsF] = useState<Cls | null>(null);
  const [useF, setUseF] = useState<'使用' | '非使用' | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [recalc, setRecalc] = useState<null | number>(null);
  const [use, setUse] = useState<Record<string, boolean>>(() => Object.fromEntries(initRows().flatMap((m) => SERVICES.map((s) => [m.name + '|' + s, !(s.startsWith('005') && m.cls !== '現預金') && m.name !== '立替金' && m.name !== 'その他手当']))));
  const [link, setLink] = useState<'しない' | '区分内' | '横一列'>('しない');
  const [himokuNames, setHimokuNames] = useState<Record<number, string>>({});
  const [cautionOpen, setCautionOpen] = useState(false);
  const [descEdit, setDescEdit] = useState(false);
  const [rel, setRel] = useState<RelKind | null>(null);
  /** 科目を追加：標準科目のチェック・コードの手動変更 */
  const [addOpen, setAddOpen] = useState(false);
  const [addChecked, setAddChecked] = useState<string[]>([]);
  const [addManual, setAddManual] = useState(false);
  const [addOver, setAddOver] = useState<Record<string, Partial<Codes>>>({});
  const [blankGroup, setBlankGroup] = useState('事務費');
  /** ▲入換▼：選択中の科目と同じ項目の中で並び順を編集する */
  const [swap, setSwap] = useState<{ group: string; keys: number[]; cur: number; drag: number | null } | null>(null);
  /** 使用科目設定の表示：全科目／内部取引科目／起動区分のみ（旧【使用科目】の3メニュー） */
  const [useView, setUseView] = useState<'全科目' | '内部取引科目' | '起動区分のみ'>('全科目');
  /** 複数科目を選んで関連する設定をまとめて変更する（確認メモ #30） */
  const [bulk, setBulk] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkVal, setBulkVal] = useState(EMPTY_BULK);
  /** 補助簿（明細表）を作る科目（旧【補助簿（明細表）設定】） */
  const [subLedger, setSubLedger] = useState<Record<string, boolean>>(() => Object.fromEntries(initRows().filter((r) => /未収|未払|預り|立替|仮払/.test(r.name)).map((r) => [r.name, true])));
  const session = useSession();
  const useCols = useView === '起動区分のみ' ? (SERVICES.includes(session.division) ? [session.division] : [SERVICES[1]]) : SERVICES;
  const useRows = useView === '内部取引科目' ? rows.filter((m) => !m.internal.startsWith('0')) : rows;
  /** 使用科目設定を更新：仕訳のある科目（現預金・費用・収益）を表示中の区分で「使用」にする */
  const refreshUse = () => {
    const names = new Set(ACCOUNT_META.filter((m) => m.cls === '現預金' || m.cls === '費用' || m.cls === '収益').map((m) => m.name));
    let n = 0; const next = { ...use };
    names.forEach((nm) => useCols.forEach((sv) => { if (!next[nm + '|' + sv]) { next[nm + '|' + sv] = true; n++; } }));
    setUse(next); toast.show(n ? `仕訳のある科目 ${n} 件を「使用」にしました` : '仕訳のある科目はすべて「使用」になっています');
  };
  const applyBulk = () => {
    const preset = COLOR_PRESETS.find((x) => x.label === bulkVal.color);
    setRows((rs) => rs.map((r) => {
      if (!bulk.includes(r.key)) return r;
      const n = { ...r };
      if (bulkVal.color === 'none') n.color = null; else if (preset) n.color = { fg: preset.fg, bg: preset.bg };
      if (bulkVal.depr) n.depr = bulkVal.depr === '1';
      if (bulkVal.oneYear) n.oneYear = bulkVal.oneYear === '1';
      if (bulkVal.meisai) n.meisai = bulkVal.meisai === '-' ? '' : bulkVal.meisai;
      if (bulkVal.internal) { n.internal = bulkVal.internal; if (bulkVal.internal.startsWith('0')) n.partner = ''; }
      return n;
    }));
    setBulkOpen(false); toast.show(`${bulk.length} 科目の関連する設定を更新しました`); setBulk([]); setBulkVal(EMPTY_BULK);
  };

  const fundTab = tab === '資金科目';
  const sel = rows.find((r) => r.key === selKey) ?? null;
  const usedCount = (r: AcctRow) => SERVICES.filter((s) => use[r.name + '|' + s]).length;
  const pick = (key: number | null) => { setSelKey(key); setDescEdit(false); };
  const openSwap = () => { if (!sel) return; const keys = rows.filter((r) => r.group === sel.group).map((r) => r.key); setSwap({ group: sel.group, keys, cur: keys.indexOf(sel.key), drag: null }); };
  const moveSwap = (from: number, to: number) => setSwap((sw) => { if (!sw || to < 0 || to >= sw.keys.length || from === to) return sw; const keys = [...sw.keys]; const [k] = keys.splice(from, 1); keys.splice(to, 0, k); return { ...sw, keys, cur: to }; });
  const applySwap = () => {
    if (!swap) return;
    // 同じ項目の行だけを新しい順序で差し替える（他の項目の位置は変えない）
    const ordered = swap.keys.map((k) => rows.find((r) => r.key === k)!);
    let i = 0;
    setRows((rs) => rs.map((r) => (r.group === swap.group ? ordered[i++] : r)));
    setSwap(null); toast.show(`項目「${swap.group}」の並び順を更新しました（${swap.keys.length} 科目）`);
  };
  const upd = (p: Partial<AcctRow>) => sel && setRows((rs) => rs.map((r) => (r.key === sel.key ? { ...r, ...p } : r)));
  /** 親項目の変更：コードが自動設定のときは表示コード・費目コード・区分コードも付け直す */
  const changeGroup = (gn: string) => {
    if (!sel) return; const g = groupDef(gn);
    const code = String(lastCode(g, rows.filter((r) => r.key !== sel.key)) + 10);
    const auto: Partial<AcctRow> = sel.manualCode ? {} : { code, himoku: g.himoku, kubun: kubunOf(code) };
    setRows((rs) => sortRows(rs.map((r) => (r.key === sel.key ? { ...r, group: gn, cls: g.cls, kind: g.cls === '費用' || g.cls === '収益' ? 'PL' : 'BS', ...auto } : r))));
    setCollapsed((c) => c.filter((x) => x !== gn));
  };
  const resetRow = (r: AcctRow): AcctRow => {
    const m = ACCOUNT_META.find((x) => x.name === r.name); if (m) return makeRow(m, ACCOUNTS.find((g) => g.items.includes(m.name))?.group ?? r.group, r.key);
    const s = STD.find((x) => x.name === r.name); return s ? makeRow(stdMeta(s, r.code), s.group, r.key, s.desc) : r;
  };

  const visible = rows.filter((r) => (fundTab ? r.fund !== '—' && r.fund !== '（支払資金）' : true) && rowMatches(r, q) && (!clsF || r.cls === clsF) && (!useF || (useF === '使用') === usedCount(r) > 0));
  const filtering = !!q.trim() || !!clsF || !!useF;
  // 階層表示：大項目 ＞ 中項目 ＞ 科目（rows は項目順に並んでいる）
  type Item = { t: 'top'; name: string; count: number } | { t: 'group'; g: GroupDef; count: number } | { t: 'row'; r: AcctRow };
  const items: Item[] = [];
  { let lastTop = ''; let lastGroup = '';
    visible.forEach((r) => {
      const g = groupDef(r.group);
      if (g.top !== lastTop) { items.push({ t: 'top', name: g.top, count: visible.filter((x) => groupDef(x.group).top === g.top).length }); lastTop = g.top; lastGroup = ''; }
      if (g.name !== lastGroup) { items.push({ t: 'group', g, count: visible.filter((x) => x.group === g.name).length }); lastGroup = g.name; }
      if (filtering || !collapsed.includes(g.name)) items.push({ t: 'row', r });
    });
  }

  /* ---- 科目を追加（標準科目からチェック） ---- */
  const registered = new Set(rows.map((r) => r.name));
  const addAuto = autoCodes(addChecked, rows);
  const addCode = (n: string): Codes => ({ ...addAuto[n], ...(addManual ? addOver[n] : {}) });
  const toggleAdd = (n: string) => setAddChecked((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]));
  const openAdd = () => { setAddChecked([]); setAddManual(false); setAddOver({}); setAddOpen(true); };
  const showAdded = (news: AcctRow[], msg: string) => {
    setRows((rs) => sortRows([...rs, ...news]));
    setUse((u) => ({ ...u, ...Object.fromEntries(news.flatMap((n) => SERVICES.map((s) => [n.name + '|' + s, true]))) }));
    setCollapsed((c) => c.filter((x) => !news.some((n) => n.group === x)));
    setQ(''); setClsF(null); setUseF(null); if (fundTab && news[0].fund === '—') setTab('勘定科目');
    pick(news[0].key); setAddOpen(false); toast.show(msg);
  };
  const doAdd = () => {
    if (!addChecked.length) return;
    let key = Math.max(...rows.map((r) => r.key));
    const news = addChecked.map((n) => { const s = STD.find((x) => x.name === n)!; const c = addCode(n); key += 1; return { ...makeRow(stdMeta(s, c.code), s.group, key, s.desc), himoku: c.himoku, kubun: c.kubun, manualCode: addManual && !!addOver[n] }; });
    showAdded(news, `${news.length} 科目を追加しました（コードは${addManual && Object.keys(addOver).length ? '一部手動で' : '親項目から自動で'}設定）`);
  };
  const addBlank = () => {
    const g = groupDef(blankGroup); const key = Math.max(...rows.map((r) => r.key)) + 1; const code = String(lastCode(g, rows) + 10); const name = `新しい科目（${code}）`;
    showAdded([makeRow({ name, code, kana: '', kind: g.cls === '費用' || g.cls === '収益' ? 'PL' : 'BS', cls: g.cls, fund: fundOf(name, g.cls, !g.fundHimoku && (g.cls === '費用' || g.cls === '収益')) }, g.name, key, '')], `項目「${g.name}」に空の科目を作成しました。右のパネルで名称を入力してください`);
  };

  const runRecalc = () => { setRecalc(0); const t0 = Date.now(); const id = window.setInterval(() => { const p = Math.min(100, Math.round((Date.now() - t0) / 30)); setRecalc(p); if (p >= 100) { window.clearInterval(id); setTimeout(() => { setRecalc(null); toast.show('仕訳の更新が完了しました（全伝票の勘定科目と資金科目の連動を整理）'); }, 400); } }, 100); };
  const toggleUse = (name: string, svc: string) => {
    const k = name + '|' + svc; const v = !use[k];
    setUse((u) => { const n = { ...u, [k]: v }; if (link === '区分内') rows.forEach((m) => { n[m.name + '|' + svc] = v; }); if (link === '横一列') SERVICES.forEach((s) => { n[name + '|' + s] = v; }); return n; });
  };
  const small: CSSProperties = { ...input, padding: '6px 8px', fontSize: 12.5 };
  const ro: CSSProperties = { ...small, background: '#f5f7f9', color: '#48565f', fontVariantNumeric: 'tabular-nums' };
  // Excel／ファイル（CSV）／印刷：表示中のタブ（勘定科目／資金科目）の一覧を出力（既存の「貸借科目 Excel 出力」「事業科目 Excel 出力」「ファイル」に相当）
  const exportList = (kind: ExportKind) => {
    const cond = [q.trim() && `検索：${q.trim()}`, clsF && `区分：${clsF}`, useF && `${useF}のみ`].filter(Boolean).join('　');
    setExp({
      kind, title: fundTab ? '資金科目一覧' : '勘定科目一覧', meta: `${visible.length} 件${cond ? `　${cond}` : ''}`,
      header: ['項目', '表示コード', '費目', '区分コード', fundTab ? '資金科目' : '科目名', '印刷用科目名称', 'フリガナ', 'A', 'B', 'C', 'D', 'E', 'F', '内部取引', fundTab ? '勘定科目' : '資金科目', 'キー'],
      rows: visible.map((r) => [r.group, r.code, fundTab ? r.fundHimoku : r.himoku, fundTab ? r.fundKubun : r.kubun, fundTab ? r.fund : r.dispName, r.printName, r.kana, r.a, r.b.split('：')[0], r.c, r.d, r.e.split('：')[0], r.f, r.internal.split('：')[0], fundTab ? r.dispName : r.fund, r.key]),
    });
  };
  // 使用科目設定のファイル出力（CSV）：科目 × 区分の使用可否（1＝使用）
  const exportUse = (which: 'fund' | 'bs') => {
    const metas = rows.filter((m) => (which === 'fund' ? m.fund !== '—' && m.fund !== '（支払資金）' : true));
    setExp({
      kind: 'csv', title: which === 'fund' ? '資金科目（使用科目設定）' : '貸借・事業科目（使用科目設定）', meta: `${metas.length} 科目 × ${SERVICES.length} 区分`,
      header: ['科目', which === 'fund' ? '資金科目' : '区分', ...SERVICES],
      rows: metas.map((m) => [m.name, which === 'fund' ? m.fund : m.cls, ...SERVICES.map((sv) => (use[m.name + '|' + sv] ? 1 : 0))]),
    });
  };

  const listTab = tab === '勘定科目' || fundTab;
  const cols = sel ? 'minmax(230px, 1fr) 76px 132px 48px 50px' : 'minmax(280px, 1.4fr) 84px 140px 56px minmax(150px, 1fr) 150px 60px';
  const cell: CSSProperties = { padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const mono: CSSProperties = { ...cell, fontVariantNumeric: 'tabular-nums', color: '#48565f' };
  const hcell: CSSProperties = { ...cell, fontSize: 11.5, fontWeight: 700, color: '#6b7783' };
  const scrollH = 'calc(100vh - 330px)';

  return (
    <SettingsShell variant={variant} title={displayName('勘定科目')} desc="科目の一覧（項目＝集計上の見出し／科目＝伝票に入力する科目）を縦に大きく表示し、行を選ぶと右側に詳細を表示します。科目の追加は標準科目にチェックを入れるだけで、コードは自動設定されます。既存の【科目設定】【費目入力】【使用科目設定】に相当します。" actions={<>
      <button type="button" className="btn-outline" onClick={() => setPreview(true)} style={btn()}>プレビュー</button>
      <button type="button" className="btn-outline" onClick={() => exportList('excel')} style={btn()}>Excel出力</button>
      <button type="button" className="btn-outline" onClick={() => exportList('csv')} style={btn()}>ファイル（CSV）</button>
      <ScreenPrintMenu accent={accent} actions={[{ items: [{ name: fundTab ? '資金科目一覧' : '勘定科目一覧', onClick: () => exportList('print') }] }]} />
      <button type="button" className="btn-outline" onClick={() => setCautionOpen(true)} style={btn()}>注意事項</button>
      <button type="button" className="btn-outline" onClick={() => { if (confirm('仕訳更新を開始します。1年分の全伝票を対象に、勘定科目と資金科目の連動を整理・更新します。途中で中断はできません。よろしいですか？')) runRecalc(); }} style={btn('#b7791f')}>仕訳の再集計</button>
      {listTab && <button type="button" className="submit-btn" onClick={openAdd} style={btn(accent, true)}>＋ 科目を追加</button>}
    </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={['勘定科目', '資金科目', '費目', '使用科目設定', '補助簿（明細表）']} current={tab} onChange={setTab} accent={accent} />

      {listTab && (
        <div style={{ display: 'grid', gridTemplateColumns: sel ? 'minmax(0, 1fr) minmax(400px, 460px)' : 'minmax(0, 1fr)', minHeight: 520 }}>
          {/* ---- 科目一覧（縦長・階層表示） ---- */}
          <div style={{ minWidth: 0, borderRight: sel ? '1px solid #e2e8ee' : 'none' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #eef2f5', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="名称・コード・フリガナで検索" aria-label="科目を検索" style={{ ...input, width: 250 }} />
                <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                  <Chip on={!clsF} onClick={() => setClsF(null)} accent={accent}>すべて</Chip>
                  {CLS_CHIPS.map((c) => <Chip key={c} on={clsF === c} onClick={() => setClsF(clsF === c ? null : c)} accent={accent}>{c}</Chip>)}
                </span>
                <span style={{ width: 1, height: 18, background: '#dde4ea' }} />
                <span style={{ display: 'inline-flex', gap: 5 }}>
                  {(['使用', '非使用'] as const).map((u) => <Chip key={u} on={useF === u} onClick={() => setUseF(useF === u ? null : u)} accent={accent}>{u}</Chip>)}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3' }}>{visible.length} 科目</span>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 11.5, color: '#6b7783', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Badge kind="項目" />集計上の見出し（伝票には入力しません）</span>
                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Badge kind="科目" />伝票に入力する科目</span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                  {bulk.length > 0 && <><span style={{ fontSize: 12, color: '#3d4a56', alignSelf: 'center' }} data-bulk-count>{bulk.length} 科目を選択中</span><button type="button" onClick={() => setBulkOpen(true)} style={btn(accent, true, true)} data-bulk-open>まとめて設定</button><button type="button" onClick={() => setBulk([])} style={btn('#5b6773', false, true)}>選択解除</button></>}
                  <button type="button" onClick={() => setCollapsed([])} style={btn('#5b6773', false, true)}>すべて開く</button>
                  <button type="button" onClick={() => setCollapsed(GROUPS.map((g) => g.name))} style={btn('#5b6773', false, true)}>項目だけ表示</button>
                </span>
              </div>
            </div>
            <div style={{ overflow: 'auto', maxHeight: scrollH }}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: 32, background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', position: 'sticky', top: 0, zIndex: 1 }}>
                <span style={hcell}>{fundTab ? '資金科目' : '科目名称'}</span><span style={hcell}>表示コード</span><span style={hcell}>区分コード</span><span style={hcell}>貸借</span>
                {!sel && <><span style={hcell}>{fundTab ? '勘定科目' : '対応する資金科目'}</span><span style={hcell}>関連する設定</span></>}
                <span style={hcell}>使用</span>
              </div>
              {items.length === 0 && <div style={{ padding: 28, color: '#9aa5b1', fontSize: 13, textAlign: 'center' }}>条件に合う科目がありません。検索語やフィルタを変更してください。</div>}
              {items.map((it) => {
                if (it.t === 'top') return (
                  <div key={'t' + it.name} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 10px', background: '#e6ecf1', borderBottom: '1px solid #d5dde4', fontSize: 14.5, fontWeight: 800 }}>
                    <Badge kind="項目" />{it.name}<span style={{ fontSize: 11.5, fontWeight: 500, color: '#6b7783' }}>{it.count} 科目</span>
                  </div>
                );
                if (it.t === 'group') { const open = filtering || !collapsed.includes(it.g.name); return (
                  <div key={'g' + it.g.name} role="button" tabIndex={0} aria-expanded={open} onClick={() => setCollapsed((c) => (c.includes(it.g.name) ? c.filter((x) => x !== it.g.name) : [...c, it.g.name]))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) setCollapsed((c) => (c.includes(it.g.name) ? c.filter((x) => x !== it.g.name) : [...c, it.g.name])); }}
                    style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: 36, background: '#f3f6f9', borderBottom: '1px solid #e6ebf0', cursor: 'pointer', fontSize: 13.5 }}>
                    <span style={{ ...cell, paddingLeft: 24, display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800 }}>
                      <span style={{ width: 12, color: '#6b7783', fontSize: 11 }}>{open ? '▼' : '▶'}</span><Badge kind="項目" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.g.name}</span><span style={{ fontSize: 11.5, fontWeight: 500, color: '#6b7783' }}>{it.count} 科目</span>
                    </span>
                    <span style={mono} /><span style={{ ...mono, fontSize: 12.5 }}>{headKubun(it.g)}</span><span style={cell} />
                    {!sel && <><span style={{ ...cell, fontSize: 12, color: '#8290a0' }}>費目 {it.g.himoku}</span><span style={cell} /></>}
                    <span style={cell} />
                  </div>
                ); }
                const r = it.r; const on = selKey === r.key; const used = usedCount(r);
                return (
                  <div key={r.key} role="button" tabIndex={0} aria-pressed={on} className="row-hover" onClick={() => pick(on ? null : r.key)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) pick(r.key); }}
                    style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', minHeight: 40, borderBottom: '1px solid #f1f4f6', cursor: 'pointer', fontSize: 14, background: on ? '#eaf1f8' : '#fff', boxShadow: on ? `inset 3px 0 0 ${accent}` : 'none', opacity: used ? 1 : 0.6 }}>
                    <span style={{ ...cell, paddingLeft: 36, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <input type="checkbox" checked={bulk.includes(r.key)} onClick={(e) => e.stopPropagation()} onChange={() => setBulk((b) => (b.includes(r.key) ? b.filter((k) => k !== r.key) : [...b, r.key]))} aria-label={`${r.dispName}を選択（まとめて設定）`} title="チェックして「まとめて設定」" style={{ margin: 0 }} data-bulk-check />
                      <Badge kind="科目" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: on ? 700 : 500, ...(r.color ? { color: r.color.fg, background: r.color.bg, padding: '1px 6px', borderRadius: 4 } : {}) }}>{fundTab ? r.fund : r.dispName}</span>
                    </span>
                    <span style={mono}>{r.code}</span>
                    <span style={{ ...mono, fontSize: 12.5 }}>{fundTab ? r.fundKubun : r.kubun}</span>
                    <span style={{ ...cell, fontSize: 12.5 }}>{r.a === '1' ? '借方' : '貸方'}</span>
                    {!sel && <>
                      <span style={{ ...cell, fontSize: 12.5, color: r.fund === '—' ? '#b7c2cc' : '#48565f' }}>{fundTab ? r.dispName : r.fund}</span>
                      <span style={{ ...cell, display: 'flex', gap: 4, alignItems: 'center' }}>
                        {r.color && <Swatch c={r.color} />}{r.depr && <Mark title="減価償却連動">償却</Mark>}{r.oneYear && <Mark title="1年基準科目">1年</Mark>}{r.meisai && <Mark title={`決算附属明細書：${r.meisai}`}>明細</Mark>}{!r.internal.startsWith('0') && <Mark title={`内部取引：${r.internal}`}>内部</Mark>}
                      </span>
                    </>}
                    <span style={{ ...cell, fontSize: 12, fontWeight: 700, color: used ? '#1f7a52' : '#9aa5b1' }}>{used ? '使用' : '非使用'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- 詳細パネル（右側） ---- */}
          {sel && (
            <aside aria-label="科目の詳細" style={{ padding: '14px 16px 18px', overflow: 'auto', maxHeight: 'calc(100vh - 250px)', background: '#fcfdfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge kind="科目" /><b style={{ fontSize: 16, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fundTab ? `${sel.fund}（${sel.dispName}）` : sel.dispName}</b>
                <button type="button" aria-label="詳細パネルを閉じる" onClick={() => pick(null)} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>× 閉じる</button>
              </div>
              <div style={{ fontSize: 11.5, color: '#8290a0', marginTop: 4 }}>{groupDef(sel.group).top} ＞ {sel.group}　／　キーコード {sel.key}（登録順に自動付与・変更不可）</div>

              <Section title="科目の説明" right={<button type="button" onClick={() => setDescEdit(!descEdit)} style={btn(descEdit ? accent : '#5b6773', descEdit, true)}>{descEdit ? '編集を終了' : '編集'}</button>}>
                {descEdit
                  ? <textarea className="field-input" value={sel.desc} onChange={(e) => upd({ desc: e.target.value })} rows={3} aria-label="科目の説明" placeholder="この科目で処理する内容を入力（伝票入力の科目選択時にも表示されます）" style={{ ...small, resize: 'vertical', lineHeight: 1.7 }} />
                  : <div style={{ fontSize: 13, lineHeight: 1.8, color: sel.desc ? '#22303c' : '#9aa5b1' }}>{sel.desc || '説明は未登録です。「編集」で入力できます。'}</div>}
              </Section>

              <Section title="項目とコード" note="親の項目から自動設定">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="所属する項目（親）" span={2}><select value={sel.group} onChange={(e) => changeGroup(e.target.value)} style={small}>{GROUPS.map((g) => <option key={g.name} value={g.name}>{g.top} ＞ {g.name}</option>)}</select></Field>
                  <div><span style={lbl}>表示コード（1〜9桁）<AutoTag manual={sel.manualCode} /></span>{sel.manualCode ? <input className="field-input ring" value={sel.code} onChange={(e) => upd({ code: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })} style={small} /> : <div style={ro}>{sel.code}</div>}</div>
                  <div><span style={lbl}>費目コード<AutoTag manual={sel.manualCode} /></span>{sel.manualCode ? <select value={sel.himoku} onChange={(e) => upd({ himoku: e.target.value })} style={small}>{HIMOKU_BS.map(([n, l]) => <option key={n} value={String(n)}>{n} {l}</option>)}</select> : <div style={ro}>{sel.himoku}　{HIMOKU_BS.find(([n]) => String(n) === sel.himoku)?.[1] ?? ''}</div>}</div>
                  <div style={{ gridColumn: 'span 2' }}><span style={lbl}>区分コード（3-2-2-2-2 桁）<AutoTag manual={sel.manualCode} /></span>{sel.manualCode ? <input className="field-input ring" value={sel.kubun} onChange={(e) => upd({ kubun: e.target.value.replace(/[^0-9-]/g, '').slice(0, 15) })} style={{ ...small, fontVariantNumeric: 'tabular-nums' }} /> : <div style={ro}>{sel.kubun}</div>}</div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Toggle on={sel.manualCode} accent={accent} label={<span style={{ fontSize: 12.5 }}>コードを手動で変更</span>} onChange={(v) => upd(v ? { manualCode: true } : { manualCode: false, himoku: groupDef(sel.group).himoku, kubun: kubunOf(sel.code) })} />
                </div>
              </Section>

              <Section title="名称">
                <div style={{ display: 'grid', gap: 10 }}>
                  <Field label="印刷用科目名称（40文字まで）"><input className="field-input ring" value={sel.printName} onChange={(e) => upd({ printName: e.target.value.slice(0, 40), dispName: sel.dispName === sel.printName ? e.target.value.slice(0, 40) : sel.dispName })} style={small} /></Field>
                  <Field label="表示用科目名称（画面に表示する名称）"><input className="field-input ring" value={sel.dispName} onChange={(e) => upd({ dispName: e.target.value })} style={small} /></Field>
                  <Field label="フリガナ（検索用）"><input className="field-input" value={sel.kana} onChange={(e) => upd({ kana: e.target.value })} style={small} /></Field>
                  <div>
                    <span style={lbl}>施設ごとの表示名（空欄の施設は表示用科目名称を使います）</span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8ee' }}>
                      <thead><tr><th style={{ ...TH, width: 150 }}>拠点（施設）</th><th style={TH}>表示名</th></tr></thead>
                      <tbody>{SITES.map((s) => <tr key={s}><td style={{ ...TD, fontSize: 12.5 }}>{s}</td><td style={{ ...TD, padding: 3 }}><input className="field-input" value={sel.siteNames[s] ?? ''} onChange={(e) => upd({ siteNames: { ...sel.siteNames, [s]: e.target.value } })} placeholder={sel.dispName} aria-label={`${s}の表示名`} style={{ ...small, padding: '4px 8px' }} /></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </Section>

              <Section title="属性">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="貸借区分"><select value={sel.a} onChange={(e) => upd({ a: e.target.value as '1' | '2' })} style={small}><option value="1">1：借方</option><option value="2">2：貸方</option></select></Field>
                  <Field label="特質指定"><select value={sel.b} onChange={(e) => upd({ b: e.target.value })} style={small}>{B_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="資金区分" span={2}><select value={sel.e} onChange={(e) => upd({ e: e.target.value })} style={small}>{E_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="事業種別"><select value={sel.f} onChange={(e) => upd({ f: e.target.value })} style={small}>{F_OPTS.map((o) => <option key={o} value={o.split('：')[0]}>{o}</option>)}</select></Field>
                  <Field label="伝票入力"><select value={sel.d} onChange={(e) => upd({ d: e.target.value as '0' | '1' })} style={small}><option value="1">1：伝票に入力する</option><option value="0">0：科目欄に入力しない</option></select></Field>
                  <Field label="特殊摘要科目" span={2}><select value={sel.c} onChange={(e) => upd({ c: e.target.value as '0' | '1' })} style={small}><option value="0">0：通常の科目</option><option value="1">1：特殊摘要で使用</option></select></Field>
                  <Field label="内部取引指定" span={2}><select value={sel.internal} onChange={(e) => upd({ internal: e.target.value, partner: e.target.value.startsWith('0') ? '' : sel.partner })} style={small}>{INTERNAL_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="相手区分（内部取引の相手先）" span={2}><select value={sel.partner} onChange={(e) => upd({ partner: e.target.value })} style={{ ...small, background: sel.internal.startsWith('0') ? '#f5f7f9' : '#fff' }} disabled={sel.internal.startsWith('0')}><option value="">伝票入力時に指定</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                </div>
              </Section>

              <Section title="対応する資金科目" note="資金収支計算書の科目">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="資金科目（借方／貸方）" span={2}><div style={{ ...ro, color: sel.fund === '—' ? '#9aa5b1' : '#22303c' }}>{sel.fund === '—' ? '対応する資金科目はありません' : sel.fund}</div></Field>
                  <Field label="費目"><select value={sel.fundHimoku} onChange={(e) => upd({ fundHimoku: e.target.value })} style={small}><option value="">—</option>{HIMOKU_FUND.map(([n, l]) => <option key={n} value={String(n)}>{n} {l}</option>)}</select></Field>
                  <Field label="区分コード"><input className="field-input" value={sel.fundKubun} onChange={(e) => upd({ fundKubun: e.target.value })} style={{ ...small, fontVariantNumeric: 'tabular-nums' }} /></Field>
                </div>
              </Section>

              <section style={{ ...card, marginTop: 12 }}>
                <div style={cardHead}>関連する設定 <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>別画面の設定のうち、この科目に関係するもの</span></div>
                <RelRow label="科目色設定" note="文字色・背景色。カラー帳票有効時に印刷へ反映" on={!!sel.color} state={sel.color ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Swatch c={sel.color} />設定あり</span> : '設定なし'} onOpen={() => setRel('color')} />
                <RelRow label="減価償却連動" note="固定資産科目を減価償却と連動させます" on={sel.depr} state={groupDef(sel.group).fixed ? (sel.depr ? '連動する' : '連動しない') : '対象外（固定資産のみ）'} onOpen={() => setRel('depr')} disabled={!groupDef(sel.group).fixed} />
                <RelRow label="1年基準科目" note="1年以内に期限が到来する分を流動へ振り替える科目" on={sel.oneYear} state={sel.oneYear ? '対象' : '対象外'} onOpen={() => setRel('oneYear')} />
                <RelRow label="決算附属明細書へ集計" note={`${displayName('決算附属明細書')}で集計する科目`} on={!!sel.meisai} state={sel.meisai || '集計しない'} onOpen={() => setRel('meisai')} />
                <RelRow label="内部取引科目と相手区分" note="区分間の取引に使う科目と相手先の対応" on={!sel.internal.startsWith('0')} state={sel.internal.startsWith('0') ? '通常の科目' : `${sel.internal.split('：')[1]}／${sel.partner || '入力時に指定'}`} onOpen={() => setRel('internal')} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>使用科目設定</div><div style={{ fontSize: 11, color: '#8290a0' }}>区分ごとの使用／非使用</div></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: usedCount(sel) ? '#1f7a52' : '#9aa5b1' }}>{usedCount(sel) ? `${usedCount(sel)} / ${SERVICES.length} 区分で使用` : '非使用'}</span>
                  <button type="button" onClick={() => setTab('使用科目設定')} style={btn('#5b6773', false, true)}>開く</button>
                </div>
              </section>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button type="button" onClick={openSwap} style={btn()}>▲入換▼</button>
                <button type="button" onClick={() => { setRows((rs) => rs.map((r) => (r.key === sel.key ? resetRow(r) : r))); toast.show('入力を初期の内容に戻しました'); }} style={btn()}>入力をクリア</button>
                <button type="button" className="submit-btn" onClick={() => toast.show(`「${sel.dispName}」を登録／更新しました`)} style={{ ...btn(accent, true), marginLeft: 'auto' }}>登録 / 更新</button>
              </div>
              <div style={{ marginTop: 10 }}><Notice tone="warn">設定されている科目を変更する前に、担当者またはカスタマーセンターへご相談ください。変更の影響は各帳票の計算結果・印刷順に及びます。</Notice></div>
            </aside>
          )}
        </div>
      )}

      {tab === '費目' && (
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {[['勘定費目（貸借対照表と事業活動計算書）', HIMOKU_BS], ['資金費目（資金収支計算書）', HIMOKU_FUND]].map(([title, list]) => (
            <div key={title as string} style={card}>
              <div style={cardHead}>{title as string}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={{ ...TH, width: 70 }}>費目No</th><th style={TH}>費目名称（ダブルクリックで編集）</th></tr></thead>
                <tbody>{(list as readonly (readonly [number, string])[]).map(([n, l]) => <tr key={n}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{n}</td><td style={{ ...TD, background: '#fff1b8' }}>{l}</td></tr>)}
                  {[14, 15, 16].map((n) => <tr key={n}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{n}</td><td style={TD}><input className="field-input" value={himokuNames[n] ?? ''} onChange={(e) => setHimokuNames({ ...himokuNames, [n]: e.target.value })} placeholder="（空白）Enterで確定して新規登録" style={{ ...input, padding: '3px 8px', fontSize: 12.5 }} /></td></tr>)}
                </tbody></table>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}><Notice tone="warn">費目No.99までが固定で作成されています。設定済みの「費目」を訂正・削除すると各帳票で正しい計算結果が得られなくなります。追加は空白の費目Noに名称を入れて登録します。</Notice></div>
        </div>
      )}

      {tab === '使用科目設定' && (
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={lbl}>表示</span>{(['全科目', '内部取引科目', '起動区分のみ'] as const).map((l) => <label key={l} style={{ fontSize: 12.5, display: 'flex', gap: 4 }}><input type="radio" name="use-view" checked={useView === l} onChange={() => setUseView(l)} data-use-view={l} />{l}</label>)}
            <span style={{ width: 1, height: 18, background: '#dde4ea' }} />
            <span style={lbl}>チェック連動</span>{(['しない', '区分内', '横一列'] as const).map((l) => <label key={l} style={{ fontSize: 12.5, display: 'flex', gap: 4 }}><input type="radio" checked={link === l} onChange={() => setLink(l)} />{l}</label>)}
            <button type="button" onClick={() => setUse(Object.fromEntries(Object.keys(use).map((k) => [k, true])))} style={{ ...btn('#5b6773', false, true), marginLeft: 8 }}>全て ON</button>
            <button type="button" onClick={refreshUse} title="仕訳のある科目を自動で「使用」にします（旧【使用科目設定更新】）" style={btn('#5b6773', false, true)} data-use-refresh>使用科目設定を更新</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>区分ごとに使用する科目をチェック（帳票の表示／非表示にも使います）</span>
          </div>
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>科目</th>{useCols.map((s) => <th key={s} style={{ ...TH, textAlign: 'center', width: 110 }}>{s}</th>)}</tr></thead>
              <tbody>{useRows.length === 0 && <tr><td colSpan={useCols.length + 1} style={{ ...TD, color: '#9aa5b1', textAlign: 'center', padding: 28 }}>内部取引科目として設定された科目はありません。勘定科目タブで科目を選び「関連する設定 › 内部取引科目と相手区分」で指定します。</td></tr>}{useRows.map((m) => <tr key={m.key}><td style={{ ...TD, fontWeight: 500 }}>{m.dispName}<span style={{ fontSize: 10.5, color: '#9aa5b1', marginLeft: 6 }}>{m.group}</span>{!m.internal.startsWith('0') && <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 6, padding: '0 5px', borderRadius: 4, background: '#eef2f6', color: '#3d4a56' }}>内部</span>}</td>{useCols.map((s) => <td key={s} style={{ ...TD, textAlign: 'center' }}><input type="checkbox" aria-label={`${m.dispName}を${s}で使用`} checked={!!use[m.name + '|' + s]} onChange={() => toggleUse(m.name, s)} /></td>)}</tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button type="button" onClick={() => exportUse('fund')} style={btn()}>資金科目ファイル出力</button><button type="button" onClick={() => exportUse('bs')} style={btn()}>貸借・事業科目ファイル出力</button><button type="button" className="submit-btn" onClick={() => toast.show('使用科目設定を保存しました')} style={{ ...btn(accent, true), marginLeft: 'auto' }}>OK</button></div>
        </div>
      )}

      {tab === '補助簿（明細表）' && (
        <div style={{ padding: 22, display: 'grid', gap: 12 }} data-subledger>
          <Notice>補助簿（明細表）を作る科目を指定します。黄色の行が対象です。対象にした科目は、帳票の印刷の「補助簿」で相手先・業者ごとの明細を印刷できます（既存の【補助簿（明細表）設定】に相当）。</Notice>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
            {([['資産（流動資産・固定資産）', (c: string) => c === '現預金' || c === '資産'], ['負債', (c: string) => c === '負債']] as const).map(([title, f]) => {
              const list = rows.filter((r) => f(r.cls));
              return (
                <div key={title} style={card}><div style={cardHead}>{title}<span style={{ fontSize: 11, fontWeight: 600, color: '#5b6773', marginLeft: 6 }}>対象 {list.filter((r) => subLedger[r.name]).length} 科目</span></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>科目・項目</th><th style={{ ...TH, textAlign: 'right', width: 150 }}>令和7年度末残高</th><th style={{ ...TH, width: 110, textAlign: 'center' }}>補助簿を作る</th></tr></thead>
                    <tbody>
                      {list.length === 0 && <tr><td colSpan={3} style={{ ...TD, color: '#9aa5b1', textAlign: 'center', padding: 24 }}>該当する科目がありません</td></tr>}
                      {list.map((r) => { const on = !!subLedger[r.name]; const bal = ((r.key * 48271) % 1200) * 1000; return (
                        <tr key={r.key} style={{ background: on ? '#fff7cc' : '#fff' }}>
                          <td style={TD}>{r.dispName}<span style={{ fontSize: 10.5, color: '#9aa5b1', marginLeft: 6 }}>{r.group}</span></td>
                          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{bal.toLocaleString('ja-JP')}</td>
                          <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={on} onChange={() => setSubLedger((x) => ({ ...x, [r.name]: !on }))} aria-label={`${r.dispName}の補助簿を作る`} /></td>
                        </tr>
                      ); })}
                    </tbody></table>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: '#5b6773' }}>対象 {Object.values(subLedger).filter(Boolean).length} 科目　残高は前年度末（令和7年度末）のサンプルです</span>
            <button type="button" className="submit-btn" onClick={() => toast.show('補助簿（明細表）の設定を保存しました')} style={{ ...btn(accent, true), marginLeft: 'auto' }}>保存して終了</button>
          </div>
        </div>
      )}

      {/* ---- まとめて設定（複数科目の関連する設定を同時に変更） ---- */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} width={560} title={`関連する設定をまとめて変更：${bulk.length} 科目`}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: '#5b6773', maxHeight: 72, overflow: 'auto' }}>対象：{rows.filter((r) => bulk.includes(r.key)).map((r) => r.dispName).join('、')}</div>
          <Notice>「変更しない」の項目はそのままです。選んだ科目すべてに同じ値を設定します。固定資産以外の科目に減価償却連動を設定しても、減価償却では対象になりません。</Notice>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="科目色"><select value={bulkVal.color} onChange={(e) => setBulkVal({ ...bulkVal, color: e.target.value })} style={small}><option value="">変更しない</option><option value="none">色を外す</option>{COLOR_PRESETS.map((x) => <option key={x.label} value={x.label}>{x.label}</option>)}</select></Field>
            <Field label="減価償却連動"><select value={bulkVal.depr} onChange={(e) => setBulkVal({ ...bulkVal, depr: e.target.value })} style={small}><option value="">変更しない</option><option value="1">連動する</option><option value="0">連動しない</option></select></Field>
            <Field label="1年基準科目"><select value={bulkVal.oneYear} onChange={(e) => setBulkVal({ ...bulkVal, oneYear: e.target.value })} style={small}><option value="">変更しない</option><option value="1">対象</option><option value="0">対象外</option></select></Field>
            <Field label="決算附属明細書へ集計"><select value={bulkVal.meisai} onChange={(e) => setBulkVal({ ...bulkVal, meisai: e.target.value })} style={small}><option value="">変更しない</option>{MEISAI_OPTS.map((o) => <option key={o || '-'} value={o || '-'}>{o || '集計しない'}</option>)}</select></Field>
            <Field label="内部取引指定" span={2}><select value={bulkVal.internal} onChange={(e) => setBulkVal({ ...bulkVal, internal: e.target.value })} style={small}><option value="">変更しない</option>{INTERNAL_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setBulkOpen(false)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={applyBulk} style={btn(accent, true)} data-bulk-apply>選択した科目に適用</button></div>
        </div>
      </Modal>

      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />

      {/* ---- 科目を追加：標準科目からチェックして追加 ---- */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} width={980} title="科目を追加（標準科目から選ぶ）">
        <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice>社会福祉法人会計基準の標準科目から、追加したい科目にチェックを入れてください。表示コード・費目コード・区分コードは、親の項目から自動で設定されます。</Notice>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: 14 }}>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: '52vh', overflow: 'auto' }}>
              {GROUPS.filter((g) => STD.some((s) => s.group === g.name)).map((g) => {
                const its = STD.filter((s) => s.group === g.name); const free = its.filter((s) => !registered.has(s.name)); const all = free.length > 0 && free.every((s) => addChecked.includes(s.name));
                return (
                  <div key={g.name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: '#f3f6f9', borderBottom: '1px solid #e6ebf0', fontSize: 13, fontWeight: 800, position: 'sticky', top: 0 }}>
                      <Badge kind="項目" />{g.name}<span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>{g.top}</span>
                      {free.length > 0 && <button type="button" onClick={() => setAddChecked((c) => (all ? c.filter((n) => !free.some((s) => s.name === n)) : [...c, ...free.map((s) => s.name).filter((n) => !c.includes(n))]))} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>{all ? 'チェックを外す' : 'すべてチェック'}</button>}
                    </div>
                    {its.map((s) => { const done = registered.has(s.name); const ck = addChecked.includes(s.name); return (
                      <label key={s.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 12px 8px 30px', borderBottom: '1px solid #f1f4f6', cursor: done ? 'default' : 'pointer', background: ck ? '#eaf1f8' : '#fff', opacity: done ? 0.55 : 1 }}>
                        <input type="checkbox" checked={done || ck} disabled={done} onChange={() => toggleAdd(s.name)} style={{ marginTop: 3, width: 16, height: 16 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>{done && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1f7a52', marginLeft: 8 }}>登録済み</span>}
                          <span style={{ display: 'block', fontSize: 11.5, color: '#7a8794', lineHeight: 1.6 }}>{s.desc}</span>
                        </span>
                      </label>
                    ); })}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <div style={{ ...card }}>
                <div style={cardHead}>追加する科目 <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0' }}>{addChecked.length} 件</span><span style={{ marginLeft: 'auto' }}><AutoTag manual={addManual} /></span></div>
                <div style={{ maxHeight: '36vh', overflow: 'auto' }}>
                  {addChecked.length === 0 ? <div style={{ padding: 22, fontSize: 12.5, color: '#9aa5b1', textAlign: 'center' }}>左の一覧でチェックした科目が、ここに自動設定されたコードとともに表示されます。</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={TH}>科目（親の項目）</th><th style={{ ...TH, width: 78 }}>表示コード</th><th style={{ ...TH, width: 56 }}>費目</th><th style={{ ...TH, width: 138 }}>区分コード</th></tr></thead>
                      <tbody>{addChecked.map((n) => { const s = STD.find((x) => x.name === n)!; const c = addCode(n); const set = (p: Partial<Codes>) => setAddOver((o) => ({ ...o, [n]: { ...o[n], ...p } })); const ci: CSSProperties = { ...small, padding: '3px 6px', fontVariantNumeric: 'tabular-nums' }; return (
                        <tr key={n}>
                          <td style={TD}><div style={{ fontWeight: 600, fontSize: 13 }}>{n}</div><div style={{ fontSize: 11, color: '#8290a0' }}>{s.group}</div></td>
                          {addManual ? <>
                            <td style={{ ...TD, padding: 3 }}><input className="field-input" aria-label={`${n}の表示コード`} value={c.code} onChange={(e) => set({ code: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })} style={ci} /></td>
                            <td style={{ ...TD, padding: 3 }}><input className="field-input" aria-label={`${n}の費目コード`} value={c.himoku} onChange={(e) => set({ himoku: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} style={ci} /></td>
                            <td style={{ ...TD, padding: 3 }}><input className="field-input" aria-label={`${n}の区分コード`} value={c.kubun} onChange={(e) => set({ kubun: e.target.value.replace(/[^0-9-]/g, '').slice(0, 15) })} style={ci} /></td>
                          </> : <>
                            <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', background: '#f5f7f9' }}>{c.code}</td>
                            <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', background: '#f5f7f9' }}>{c.himoku}</td>
                            <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', background: '#f5f7f9', fontSize: 12.5 }}>{c.kubun}</td>
                          </>}
                        </tr>
                      ); })}</tbody>
                    </table>
                  )}
                </div>
                <div style={{ padding: '10px 12px', borderTop: '1px solid #eef2f5' }}>
                  <Toggle on={addManual} onChange={setAddManual} accent={accent} label={<span style={{ fontSize: 12.5 }}>コードを手動で変更</span>} />
                  <div style={{ fontSize: 11, color: '#8290a0', marginTop: 4 }}>通常は自動設定のままで問題ありません。独自のコード体系を使う場合のみオンにしてください。</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7783', flexWrap: 'wrap' }}>
                標準科目にない科目：
                <select value={blankGroup} onChange={(e) => setBlankGroup(e.target.value)} aria-label="空の科目を作成する項目" style={{ ...small, width: 190 }}>{GROUPS.map((g) => <option key={g.name}>{g.name}</option>)}</select>
                <button type="button" onClick={addBlank} style={btn('#5b6773', false, true)}>この項目に空の科目を作成</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAddOpen(false)} style={btn()}>キャンセル</button>
            <span data-tip={addChecked.length ? undefined : '追加する科目にチェックを入れると押せます'} style={{ display: 'inline-flex' }}><button type="button" className="submit-btn" onClick={doAdd} disabled={!addChecked.length} style={{ ...btn(accent, true), opacity: addChecked.length ? 1 : 0.5 }}>チェックした科目を追加{addChecked.length ? `（${addChecked.length} 件）` : ''}</button></span>
          </div>
        </div>
      </Modal>

      {/* ---- 関連する設定：その場で開く小さなダイアログ ---- */}
      <Modal open={!!rel && !!sel} onClose={() => setRel(null)} width={500} title={rel ? `${REL_TITLE[rel]}：${sel?.dispName ?? ''}` : ''}>
        {rel && sel && (
          <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
            {rel === 'color' && <>
              <Toggle on={!!sel.color} accent={accent} label="この科目に色を付ける" onChange={(v) => upd({ color: v ? { fg: '#c0392b', bg: '#ffffff' } : null })} />
              {sel.color && <>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>文字色<input type="color" value={sel.color.fg} onChange={(e) => upd({ color: { ...sel.color!, fg: e.target.value } })} /></label>
                  <label style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>背景色<input type="color" value={sel.color.bg} onChange={(e) => upd({ color: { ...sel.color!, bg: e.target.value } })} /></label>
                  <span style={{ display: 'inline-flex', gap: 5 }}>{COLOR_PRESETS.map((p) => <button key={p.label} type="button" onClick={() => upd({ color: { fg: p.fg, bg: p.bg } })} style={{ ...btn('#5b6773', false, true), color: p.fg, background: p.bg }}>{p.label}</button>)}</span>
                </div>
                <div><span style={lbl}>表示の見本</span><div style={{ border: '1px solid #e2e8ee', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 14, fontSize: 13.5, color: sel.color.fg, background: sel.color.bg }}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{sel.code}</span><span style={{ flex: 1 }}>{sel.printName}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>1,234,567</span></div></div>
              </>}
              <Notice>画面の科目一覧にはすぐ反映されます。印刷への反映は「{displayName('環境設定')}」でカラー帳票を有効にしている場合のみです。</Notice>
            </>}
            {rel === 'depr' && <>
              <Toggle on={sel.depr} accent={accent} label="この固定資産科目を減価償却と連動させる" onChange={(v) => upd({ depr: v })} />
              <Notice>連動させると、減価償却（オプション）の資産台帳でこの科目を選べるようになり、償却額の仕訳が自動で作成されます。土地など償却しない科目はオフにします。</Notice>
            </>}
            {rel === 'oneYear' && <>
              <Toggle on={sel.oneYear} accent={accent} label="1年基準の対象科目にする" onChange={(v) => upd({ oneYear: v })} />
              <Notice>長期の貸付金・借入金などのうち、決算日の翌日から1年以内に期限が到来する分を流動資産／流動負債へ振り替える対象として扱います。</Notice>
            </>}
            {rel === 'meisai' && <>
              <Field label="集計先の明細書"><select value={sel.meisai} onChange={(e) => upd({ meisai: e.target.value })} style={small}>{MEISAI_OPTS.map((o) => <option key={o} value={o}>{o || '集計しない'}</option>)}</select></Field>
              <Notice>選んだ明細書に、この科目の金額が集計されます。明細書ごとの様式・印刷は「{displayName('決算附属明細書')}」で設定します。</Notice>
            </>}
            {rel === 'internal' && <>
              <Field label="内部取引指定"><select value={sel.internal} onChange={(e) => upd({ internal: e.target.value, partner: e.target.value.startsWith('0') ? '' : sel.partner })} style={small}>{INTERNAL_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="相手区分（内部取引の相手先）"><select value={sel.partner} onChange={(e) => upd({ partner: e.target.value })} disabled={sel.internal.startsWith('0')} style={{ ...small, background: sel.internal.startsWith('0') ? '#f5f7f9' : '#fff' }}><option value="">伝票入力時に指定</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Notice>内部取引科目にすると、法人全体の集計で相手区分の科目と相殺（内部取引消去）されます。相手区分を固定しない場合は伝票入力時に指定します。</Notice>
            </>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={() => { setRel(null); toast.show(`${REL_TITLE[rel]}を更新しました`); }} style={btn(accent, true)}>OK</button></div>
          </div>
        )}
      </Modal>

      <Modal open={preview} onClose={() => setPreview(false)} width={760} title="プレビュー（登録されている科目の一覧）">
        <div style={{ padding: '10px 22px 18px', maxHeight: '70vh', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={TH}>コード</th><th style={TH}>科目名</th><th style={TH}>項目</th><th style={TH}>区分</th><th style={TH}>資金科目</th><th style={{ ...TH, textAlign: 'right' }}>キー</th></tr></thead><tbody>{rows.map((r) => <tr key={r.key}><td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r.code}</td><td style={TD}>{r.dispName}</td><td style={TD}>{r.group}</td><td style={TD}>{r.kind}・{r.cls}</td><td style={TD}>{r.fund}</td><td style={NUM}>{r.key}</td></tr>)}</tbody></table>
        </div>
      </Modal>
      <ExplainModal open={cautionOpen} onClose={() => setCautionOpen(false)} accent={accent} title="勘定科目設定の注意事項" source="マニュアル 2.3.4 勘定科目・資金科目の設定／2.2 キーコード" sections={[
        { h: '変更前に必ずご相談ください', body: <>設定されている科目を変更する前に、担当者またはカスタマーセンター（Tel:050-3786-5432）までご相談ください。科目を変更・修正した結果の影響（帳票の計算結果・印刷順・過去伝票の表示）については補償の対象外です。</>},
        { h: '項目と科目', body: <>「項目」は集計上の見出しで、伝票には入力しません。「科目」は伝票に入力する科目で、必ずいずれかの項目に属します。一覧では項目を濃いラベルと太字、科目を字下げして表示しています。</>},
        { h: '科目の追加', body: <>「＋ 科目を追加」で標準科目の一覧を開き、追加したい科目にチェックを入れて「チェックした科目を追加」を押します。表示コード（1〜9桁）・費目コード・区分コード（3-2-2-2-2）は親の項目から自動設定されます。独自のコードを使う場合のみ「コードを手動で変更」をオンにしてください。費用・収益の科目は「対応する資金科目」（費目・区分コード）も確認してください。連動が無いと資金収支計算書に反映されません。</>},
        { h: '科目の削除・変更', body: <>伝票で使用済みの科目は削除できません（先に伝票側の科目を付け替えるか、「使用科目設定」で非表示にします）。表示コードや区分コードを変更しても過去の伝票はキーコードで紐付いているため壊れませんが、帳票上の並び順・集計位置が変わります。変更後は「仕訳の再集計」を実行してください。</>},
        { h: '科目の移動（▲入換▼）', body: <>並び順の変更は「▲入換▼」で同じ項目内の科目を上下に入れ換えます。項目をまたぐ移動は詳細パネルの「所属する項目」を変更します。費目の集計行（費目No.99まで）は固定のため訂正・削除しないでください。</>},
        { h: 'キーコード', body: <>登録された伝票が持つ科目情報は「キーコード」（登録順にシステムが自動付与・変更不可）のみです。複数の端末で運用する場合は、特定の1台でのみ科目の追加・変更を行い、全端末の科目マスターをキーコードのレベルで一致させてください。見かけ上同じ科目体系でもキーコードが異なると、法人合算で正しく集計されません。</>},
        { h: '名称・コードの制限', body: <>印刷用科目名称は最大40文字。表示用科目名称は画面表示用で、新規登録時は印刷用名称が自動入力されます。施設ごとの表示名を入力すると、その施設の画面ではその名称で表示されます。表示コードは1〜9桁の数値で、同一区分内で重複しないようにしてください。フリガナは科目検索に使われます。</>},
        { h: '属性の意味', body: <>貸借区分（借方／貸方）、特質指定（現金・預金科目、予算専用、繰越額）、特殊摘要科目、伝票の科目欄に入力するか、資金区分（両加算／借方加算＆貸方減算／借方減算＆貸方加算／資金収支と無関係／資金科目）、事業種別。資金区分の設定を誤ると資金収支計算書の金額が合わなくなります。</>},
      ]} />
      <Modal open={!!swap} onClose={() => setSwap(null)} width={560} title={`▲入換▼ 科目の並び順（項目：${swap?.group ?? ''}）`}>
        {swap && (
          <div style={{ padding: '12px 22px 18px', display: 'grid', gap: 10 }}>
            <Notice>行をドラッグするか、選択して「▲上へ」「▼下へ」で並び順を変えます。OK で一覧・帳票の印刷順に反映します（表示コードは変わりません）。</Notice>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 360, overflow: 'auto' }}>
              {swap.keys.map((k, i) => { const r = rows.find((x) => x.key === k)!; const on = i === swap.cur; return (
                <div key={k} draggable onDragStart={() => setSwap({ ...swap, drag: i, cur: i })} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (swap.drag != null) moveSwap(swap.drag, i); }} onDragEnd={() => setSwap((sw) => (sw ? { ...sw, drag: null } : sw))} onClick={() => setSwap({ ...swap, cur: i })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid #f1f4f6', background: on ? '#eef2f6' : '#fff', cursor: 'grab', fontSize: 13, opacity: swap.drag === i ? 0.4 : 1 }}>
                  <span style={{ color: '#b7c2cc', fontSize: 14 }}>⋮⋮</span><span style={{ width: 28, color: '#8290a0', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{i + 1}</span><span style={{ width: 60, fontVariantNumeric: 'tabular-nums', color: '#5b6773' }}>{r.code}</span><span style={{ flex: 1, fontWeight: on ? 700 : 500 }}>{r.dispName}</span><span style={{ fontSize: 11, color: '#9aa5b1' }}>キー {r.key}</span>
                </div>); })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span data-tip={swap.cur <= 0 ? '先頭の科目のため、これ以上は上へ動かせません' : undefined} style={{ display: 'inline-flex' }}><button type="button" onClick={() => moveSwap(swap.cur, swap.cur - 1)} disabled={swap.cur <= 0} style={{ ...btn(), opacity: swap.cur <= 0 ? 0.5 : 1 }}>▲ 上へ</button></span>
              <span data-tip={swap.cur >= swap.keys.length - 1 ? '最後の科目のため、これ以上は下へ動かせません' : undefined} style={{ display: 'inline-flex' }}><button type="button" onClick={() => moveSwap(swap.cur, swap.cur + 1)} disabled={swap.cur >= swap.keys.length - 1} style={{ ...btn(), opacity: swap.cur >= swap.keys.length - 1 ? 0.5 : 1 }}>▼ 下へ</button></span>
              <button type="button" onClick={() => moveSwap(swap.cur, 0)} style={btn()}>先頭へ</button>
              <button type="button" onClick={() => moveSwap(swap.cur, swap.keys.length - 1)} style={btn()}>末尾へ</button>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button type="button" onClick={() => setSwap(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={applySwap} style={btn(accent, true)}>OK</button></span>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={recalc != null} onClose={() => {}} closable={false} width={460} title="仕訳更新">
        <div style={{ padding: '18px 22px 22px' }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>全仕訳の勘定科目と資金科目の連動を整理しています…　{recalc}%</div>
          <div style={{ height: 10, background: '#eef2f5', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${recalc ?? 0}%`, height: '100%', background: accent, transition: 'width .1s' }} /></div>
          <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 8 }}>処理中は中断できません。伝票数によっては数分かかる場合があります。</div>
        </div>
      </Modal>
    </SettingsShell>
  );
}

/* ---------------- 摘要辞書：自動補完候補 ---------------- */
export function SummaryAutoCompleteTab({ accent }: { accent: string }) {
  const toast = useToast();
  const [cands, setCands] = useState<string[]>([...SUMMARIES, '電気代ー７月分', '園児おやつ代', '保護者会費']);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const add = () => { const t = text.trim(); if (!t) return; if (!cands.includes(t)) setCands([...cands, t]); setText(''); };
  return (
    <div style={{ padding: 22, display: 'grid', gap: 12, maxWidth: 760 }}>
      <Notice>伝票入力時に過去に入力した摘要から候補を自動表示します（環境設定「摘要自動補完入力機能を有効にする」）。「入力された摘要を候補に追加する」が有効なら、登録した摘要がここに自動で溜まります。</Notice>
      <div style={{ display: 'flex', gap: 8 }}><input className="field-input ring" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) add(); }} placeholder="摘要文字列を入力して Enter で追加" style={input} /><button type="button" onClick={add} style={btn(accent, true)}>追加</button></div>
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
        {cands.map((c) => <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #f1f4f6', fontSize: 13 }}><input type="checkbox" checked={checked.has(c)} onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(c); else n.delete(c); setChecked(n); }} /><span style={{ flex: 1 }}>{c}</span></label>)}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { if (!checked.size) return toast.show('削除する候補をチェックしてください'); if (confirm(`${checked.size} 件の候補を削除しますか？`)) { setCands(cands.filter((c) => !checked.has(c))); setChecked(new Set()); } }} style={btn('#c0392b')}>削除</button>
        <button type="button" onClick={() => { setCands([...new Set([...cands, '委託費ー７月分', '委託費ー６月分', 'ガス代ー６月分'])]); toast.show('前年度の候補をコピーしました'); }} style={btn()}>前年度のデータをコピー</button>
        <button type="button" className="submit-btn" onClick={() => toast.show('追加修正を保存しました')} style={{ ...btn(accent, true), marginLeft: 'auto' }}>追加修正を保存して閉じる</button>
      </div>
      <ToastView msg={toast.msg} />
    </div>
  );
}
