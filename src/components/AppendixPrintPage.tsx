// 別紙（注記・附属明細書・財産目録）（依頼書 5.5.3・5.1.1、マニュアル 7.5.2・7.5.3・4.7）
//   印刷メニュー「別紙」の画面。左で別紙を選び、右でその別紙の「設定・編集」と「印刷」を行う。
//   保守メニューにあった「財産目録設定」「計算書類に対する注記（法人全体用／拠点区分用）」は重複のため、この画面に一本化した。
//   附属明細書の明細入力・内訳表の合算テーブルも、印刷の準備としてここに置く（科目設定・監視は「決算附属明細書設定」）。
//   印刷は画面内で完結：出力先（基本条件つき）と詳細設定のタブ（PrintCenter の PrintFlow を利用）。
//   確認メモ #163：画面上部に「キャンセル」を置く。保存していない変更（注記・明細・財産目録の行設定・合算テーブル）を破棄し、最後に保存した内容へ戻す。
//   確認メモ #238：メニューの「別紙」は廃止し、「帳票の印刷」の中区分の1つにした（embedded で帳票の印刷の中に描く）。
//     小区分は 計算書類に対する注記／附属明細書（別紙3）／財産目録。表示条件（帳票選択・就労支援・授産）を満たさない別紙は一覧に出さない。
//     ⑩⑪ は共通印刷設定＝有（印刷の詳細設定に「共通の印刷設定を反映」を置く）。

import { DONATION_KINDS, DONOR_ATTRS, getDonations } from '../store/donationStore';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DepPrintPanel } from './DepPrintModal';
import { ExportDialog, runExport, type ExportSpec } from './ExportDialog';
import { Modal } from './Modal';
import { PreviewModal, PrintFlow, type ReportDef, type TableData } from './PrintCenter';
import { appendixSpec, formCond, formEnabled } from './printCatalog';
import { ImportExportButton, ImportExportDialog } from './ImportExportDialog';
import { KARIIRE_COLS, KARIIRE_NUM, KARIIRE_ROWS, KariireDetail, kariireTable } from './KariireDetail';
import { NOTE_TABLE_DEFS, NoteTablePickDialog, NoteTablesDialog, noteMarker, type NoteTables } from './NoteTables';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, HelpTip, Notice, SettingsShell, Tabs, Toggle, btn, card, cardHead, input, numInput, toInt, yen } from './ui';
import { SERVICES, displayName } from '../data';
import { useSession, type Session } from '../store/session';

type Editor = 'note' | 'detail' | 'auto' | 'inventory' | 'merge';
type Group = '計算書類に対する注記' | '附属明細書' | '財産目録' | '内訳表の準備';
interface Sheet { id: string; group: Group; no: string; name: string; unit: '法人全体' | '拠点区分' | ''; editor: Editor; /** 対象事業がない（就労支援・授産）。表示条件を満たさない */ na?: boolean; /** 自動作成の元になるデータ */ source?: string; /** 表示条件の説明 */ cond?: string; /** 帳票選択の様式キー（使用にしたときだけ表示） */ form?: string; /** 共通印刷設定＝有 */ common?: boolean }

/** 伝票登録時の明細書への登録画面で入力したデータから作る明細書の、作成元 */
const STMT_SOURCE = '伝票登録時に入力した明細データ';
const MARU = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲'];
const SHUROU = '就労支援事業を行う区分（就労支援区分）があるとき';
const SHUROU_S = '就労支援区分（年間売上高5,000万円以下）があるとき';
/** 附属明細書（別紙3 ①〜⑲。⑮〜⑱ は多機能事業所用等の -2 様式あり）：[番号, 名称, 作成単位, 編集, 自動作成の元, 表示条件] */
const DETAIL_SHEETS: [string, string, Sheet['unit'], Editor, string?, string?][] = [
  [MARU[0], '借入金明細書', '法人全体', 'detail'],
  [MARU[1], '寄附金収益明細書', '法人全体', 'detail'],
  [MARU[2], '補助金事業等収益明細書', '法人全体', 'detail'],
  // 現行に明細入力がないので、伝票登録時に入力した明細データから自動で作成する（確認メモ #461）
  [MARU[3], '事業区分間及び拠点区分間繰入金明細書', '法人全体', 'auto', STMT_SOURCE],
  [MARU[4], '事業区分間及び拠点区分間貸付金（借入金）残高明細書', '法人全体', 'detail'],
  [MARU[5], '基本金明細書', '法人全体', 'detail'],
  [MARU[6], '国庫補助金等特別積立金明細書', '法人全体', 'detail'],
  [MARU[7], '基本財産及びその他の固定資産（有形・無形固定資産）の明細書', '拠点区分', 'auto', '固定資産台帳（減価償却）'],
  [MARU[8], '引当金明細書', '拠点区分', 'detail'],
  [MARU[9], '拠点区分資金収支明細書', '拠点区分', 'auto', '伝票（サービス区分ごとの集計）'],
  [MARU[10], '拠点区分事業活動明細書', '拠点区分', 'auto', '伝票（サービス区分ごとの集計）'],
  [MARU[11], '積立金・積立資産明細書', '拠点区分', 'detail'],
  [MARU[12], 'サービス区分間繰入金明細書', '拠点区分', 'detail'],
  [MARU[13], 'サービス区分間貸付金（借入金）残高明細書', '拠点区分', 'detail'],
  [MARU[14], '就労支援事業別事業活動明細書', '拠点区分', 'auto', undefined, `${SHUROU}、または${SHUROU_S}`],
  [MARU[14] + '-2', '就労支援事業別事業活動明細書（多機能事業所用等）', '拠点区分', 'auto', undefined, `${SHUROU}、または${SHUROU_S}`],
  [MARU[15], '就労支援事業製造原価明細書', '拠点区分', 'auto', undefined, SHUROU],
  [MARU[15] + '-2', '就労支援事業製造原価明細書（多機能事業所用等）', '拠点区分', 'auto', undefined, SHUROU],
  [MARU[16], '就労支援事業販管費明細書', '拠点区分', 'auto', undefined, SHUROU],
  [MARU[16] + '-2', '就労支援事業販管費明細書（多機能事業所用等）', '拠点区分', 'auto', undefined, SHUROU],
  [MARU[17], '就労支援事業明細書', '拠点区分', 'auto', undefined, SHUROU_S],
  [MARU[17] + '-2', '就労支援事業明細書（多機能事業所用等）', '拠点区分', 'auto', undefined, SHUROU_S],
  [MARU[18], '授産事業費用明細書', '拠点区分', 'auto', undefined, '授産事業を行う区分（授産事業区分）があるとき'],
];
/** 附属明細書の名前（①〜⑲。WAMNET連携附属明細書出力で使う） */
export const APPENDIX_SHEET_NAMES = DETAIL_SHEETS.map(([no, n]) => no + ' ' + n);
const SHEETS: Sheet[] = [
  { id: 'note-corp', group: '計算書類に対する注記', no: '注', name: '計算書類に対する注記（法人全体用）', unit: '法人全体', editor: 'note', form: 'note' },
  { id: 'note-base', group: '計算書類に対する注記', no: '注', name: '計算書類に対する注記（拠点区分用）', unit: '拠点区分', editor: 'note', form: 'note' },
  ...DETAIL_SHEETS.map(([no, name, unit, editor, source, cond], i): Sheet => ({ id: `d${i + 1}`, group: '附属明細書', no, name, unit, editor, source, cond, na: !!cond, form: i === 9 ? 'a10' : i === 10 ? 'a11' : undefined, common: i === 9 || i === 10 })),
  { id: 'inventory', group: '財産目録', no: '財', name: '財産目録', unit: '法人全体', editor: 'inventory' },
  { id: 'merge', group: '内訳表の準備', no: '表', name: '合算テーブル（内訳表の横軸）', unit: '', editor: 'merge' },
];
const GROUPS: Group[] = ['計算書類に対する注記', '附属明細書', '財産目録', '内訳表の準備'];
/** 表示条件を満たすか（帳票選択で省略にした様式・対象事業のない明細書は満たさない） */
const sheetOk = (x: Sheet, s: Session) => !x.na && (!x.form || formEnabled(s.print.forms, x.form, s.tree));
/** 表示条件の説明 */
const condText = (x: Sheet) => x.cond ?? (x.form ? formCond(x.form).label : '');

/** 明細入力の列と初期データ（num＝金額の列） */
const KURIIRE_COLS = ['繰入元の区分', '繰入先の区分', '繰入金の財源', '金額', '使用目的等'];
const KASHI_COLS = ['貸付元の区分', '借入先の区分', '前年度末残高', '当期増加額', '当期減少額', '期末残高', '使用目的等'];
const DETAILS: Record<string, { cols: string[]; num: number[]; rows: string[][]; hint?: string; /** 一覧から選ぶ列（列の番号 → 選択肢） */ choices?: Record<number, string[]> }> = {
  // 借入金明細書：行は科目に結び付く（先頭の列＝科目）。入力は KariireDetail（確認メモ #394）
  d1: { cols: KARIIRE_COLS, num: KARIIRE_NUM, rows: KARIIRE_ROWS },
  // 寄附金収益明細書：明細は1件ずつ縦に並べる（件数の列はなし）。拠点区分ごとの内訳は「入力区分」（確認メモ #419）。
  //   伝票入力の明細書への登録画面で「登録する」にした金額が、ここに1件ずつ追加される。印刷では寄附者の属性と区分ごとにまとめて件数を数える
  d2: { cols: ['受領年月日', '寄附者の属性', '区分', '寄附金額', 'うち基本金組入額', '入力区分'], num: [3, 4], choices: { 1: DONOR_ATTRS, 2: DONATION_KINDS }, rows: [
    ['令和8年5月10日', '利用者の家族', '経常', '50000', '0', '002 保育事業'], ['令和8年6月14日', '利用者の家族', '経常', '50000', '0', '002 保育事業'], ['令和8年7月12日', '利用者の家族', '経常', '50000', '0', '002 保育事業'],
    ['令和8年8月3日', '法人の役職員', '施設', '500000', '500000', '002 保育事業']], hint: '伝票入力で寄附金の伝票を登録し、明細書への登録画面で「登録する」を選んだ金額は、ここに1件ずつ追加されます。' },
  d3: { cols: ['拠点名', '補助金の種類', '交付者', '目的', '当期収益額', '備考'], num: [4], rows: [['チャイルド保育園', '市区町村補助金', '○○市', '延長保育事業', '660000', ''], ['チャイルド保育園', '市区町村補助金', '○○市', '障害児保育事業', '0', '']], hint: '「科目から明細を作成する」（決算附属明細書設定）が有効な場合は、科目ごとに拠点名・目的を設定します。' },
  d4: { cols: KURIIRE_COLS, num: [3], rows: [['チャイルド保育園', '本部', '委託費収入', '1200000', '本部経費']] },
  d5: { cols: KASHI_COLS, num: [2, 3, 4, 5], rows: [['本部', 'チャイルド保育園', '0', '0', '0', '0', '運転資金']] },
  d6: { cols: ['区分', '前期末残高', '当期組入額', '当期取崩額', '当期末残高'], num: [1, 2, 3, 4], rows: [['第1号基本金', '25800000', '0', '0', '25800000'], ['第2号基本金', '0', '0', '0', '0'], ['第3号基本金', '0', '0', '0', '0']], hint: '組入・取崩が発生していなくても印刷する場合は、印刷の詳細設定で指定します。' },
  d7: { cols: ['区分並びに積立・取崩の事由', '補助金の種類', '前期繰越額', '当期積立額', '当期取崩額', '当期末残高'], num: [2, 3, 4, 5], rows: [['園舎建設', '国庫補助金', '8400000', '0', '420000', '7980000']] },
  d9: { cols: ['科目', '期首残高', '当期増加額', '当期減少額（目的使用）', '当期減少額（その他）', '期末残高'], num: [1, 2, 3, 4, 5], rows: [['賞与引当金', '1500000', '1693000', '1500000', '0', '1693000'], ['退職給付引当金', '0', '0', '0', '0', '0']] },
  d12: { cols: ['積立金・積立資産の名称', '前期末残高', '当期増加額', '当期減少額', '当期末残高', '摘要'], num: [1, 2, 3, 4], rows: [['施設整備等積立金／積立資産', '0', '0', '0', '0', ''], ['人件費積立金／積立資産', '0', '0', '0', '0', '']] },
  d13: { cols: KURIIRE_COLS, num: [3], rows: [['保育事業', '子育て支援', '委託費収入', '300000', '事業費の補填']] },
  d14: { cols: KASHI_COLS, num: [2, 3, 4, 5], rows: [['保育事業', '一時預かり', '0', '0', '0', '0', '運転資金']] },
};

/** 寄附金収益明細書の印刷：寄附者の属性と区分ごとにまとめ、件数・寄附金額・うち基本金組入額を集計する（明細は1件ずつ入力。確認メモ #419） */
function donationTable(list: string[][]): TableData {
  const map = new Map<string, { attr: string; kind: string; n: number; amt: number; kihon: number; divs: string[] }>();
  list.forEach((r) => {
    const key = r[1] + '|' + r[2];
    const g = map.get(key) ?? { attr: r[1], kind: r[2], n: 0, amt: 0, kihon: 0, divs: [] };
    g.n += 1; g.amt += toInt(r[3] ?? ''); g.kihon += toInt(r[4] ?? ''); if (r[5] && !g.divs.includes(r[5])) g.divs.push(r[5]);
    map.set(key, g);
  });
  return { header: ['寄附者の属性', '区分', '件数', '寄附金額', 'うち基本金組入額', '入力区分'], rows: [...map.values()].map((g) => [g.attr, g.kind, g.n, g.amt, g.kihon, g.divs.join('・')]) };
}

const INVENTORY_TABS = ['流動資産', '固定資産（基本財産）', '固定資産（その他の固定資産）', '流動負債', '固定負債'];
const INVENTORY_DEFAULT: Record<string, string[][]> = {
  流動資産: [['現金預金', '現金手許有高', '44,200'], ['現金預金', '普通預金 みどり銀行本店', '8,610,000'], ['現金預金', '当座預金 みどり銀行本店', '468,100'], ['事業未収金', '8月分委託費', '1,200,000']],
  '固定資産（基本財産）': [['土地', '○○市○○町1-1　320㎡', '22,000,000'], ['建物', '園舎 鉄筋コンクリート造2階建', '15,300,000']],
  '固定資産（その他の固定資産）': [['器具及び備品', '遊具・厨房設備ほか', '1,750,000'], ['ソフトウェア', '会計システム', '340,000']],
  流動負債: [['事業未払金', '8月分給食材料費ほか', '400,000'], ['職員預り金', '社会保険料・税', '250,000']],
  固定負債: [],
};
const cloneInv = (): Record<string, string[][]> => JSON.parse(JSON.stringify(INVENTORY_DEFAULT));

const NOTE_DEFAULT = `1. 継続事業の前提に関する注記
　該当なし。
2. 重要な会計方針
（1）有価証券の評価基準及び評価方法　満期保有目的の債券等：償却原価法（定額法）
（2）固定資産の減価償却の方法　建物・器具及び備品：定額法
（3）引当金の計上基準　賞与引当金：職員に対する賞与の支給に備えるため、支給見込額のうち当期に帰属する額を計上。
3. 重要な会計方針の変更
　該当なし。
4. 法人で採用する退職給付制度
　独立行政法人福祉医療機構の社会福祉施設職員等退職手当共済制度を採用している。
5. 法人が作成する計算書類と拠点区分、サービス区分
　当法人の作成する計算書類は以下のとおりになっている。
（1）法人全体の計算書類（会計基準省令第1号第1様式、第2号第1様式、第3号第1様式）
（2）事業区分別内訳表（会計基準省令第1号第2様式、第2号第2様式、第3号第2様式）
6. 基本財産の増減の内容及び金額
　基本財産の増減の内容及び金額は以下のとおりである。
@@表1@@`;
const NOTE_BASE_DEFAULT = `1. 重要な会計方針
（1）固定資産の減価償却の方法　建物・器具及び備品：定額法
（2）引当金の計上基準　賞与引当金：支給見込額のうち当期に帰属する額を計上。
2. 重要な会計方針の変更
　該当なし。
3. 採用する退職給付制度
　社会福祉施設職員等退職手当共済制度を採用している。
4. 拠点が作成する計算書類とサービス区分
　チャイルド保育園拠点の計算書類は、保育事業・一時預かり・子育て支援のサービス区分ごとに作成している。
5. 基本財産の増減の内容及び金額
　基本財産の増減の内容及び金額は以下のとおりである。
@@表1@@`;
/** 注記の表の初期値（表1.基本財産の増減。金額は会計データから集計する） */
const NOTE_TABLES_DEFAULT = (): NoteTables => {
  const amt = (accts: string[], amtKind: string) => ({ accts, amtKind, minus: false, add: '0' });
  const row = (label: string, a: string[]) => ({ kind: '通常行' as const, label, amounts: [amt(a, '前年度決算額'), amt(a, '増加'), amt(a, '減少'), amt(a, '当年度決算額')] });
  return { 1: [row('土地', ['土地']), row('建物', ['建物']), { kind: '合計行', label: '合計' }] };
};

const downloadJson = (name: string, obj: unknown) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
};
/** 「保存」で確定する編集内容（キャンセルで戻す対象）。印刷書式はダイアログの OK で確定するので含めない */
interface Draft { rows: Record<string, string[][]>; notes: Record<string, string>; /** 注記の表（注記ごと・表ごと。確認メモ #390） */ tables: Record<string, NoteTables>; inv: Record<string, string[][]>; merge: { code: string; name: string; formula: string }[]; perPage: number }
const cloneDraft = (d: Draft): Draft => JSON.parse(JSON.stringify(d));
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

export function AppendixPrintPage({ variant, accent, onNavigate, embedded }: { variant: 'form' | 'sheet'; accent: string; /** メニュー項目名で別画面へ移動（決算附属明細書設定へのリンクに使用） */ onNavigate?: (label: string) => void; /** 帳票の印刷の中区分「別紙」として、画面の枠（SettingsShell）なしで描く */ embedded?: boolean }) {
  const s = useSession();
  const toast = useToast();
  // 選んでいる帳票と「設定・編集／印刷」はブラウザのタブの間だけ覚える（決算附属明細書設定へ移って戻ったときに、同じ帳票を開いたままにする。確認メモ #392）
  const remembered = (k: string, d: string) => { try { return sessionStorage.getItem('proto-appendix:' + k) ?? d; } catch { return d; } };
  const remember = (k: string, v: string) => { try { sessionStorage.setItem('proto-appendix:' + k, v); } catch { /* ignore */ } };
  const [cur, setCurRaw] = useState(() => remembered('cur', 'note-corp'));
  const setCur = (v: string) => { setCurRaw(v); remember('cur', v); };
  const [mode, setModeRaw] = useState(() => remembered('mode', '設定・編集'));
  const setMode = (v: string) => { setModeRaw(v); remember('mode', v); };
  const [hideNa, setHideNa] = useState(true);
  /** 就労支援・授産（⑮〜⑲）：条件を満たしたときの画面を見本として表示する（確認メモ #360） */
  const [peek, setPeek] = useState(false);
  const shown = (x: Sheet) => !hideNa || sheetOk(x, s);
  const [rows, setRows] = useState<Record<string, string[][]>>(() => {
    const base: Record<string, string[][]> = Object.fromEntries(Object.entries(DETAILS).map(([k, v]) => [k, v.rows.map((r) => [...r])]));
    // 伝票入力の明細書への登録画面で登録した寄附金（確認メモ #419）
    base.d2 = [...base.d2, ...getDonations().map((d) => [d.date, d.attr, d.kind, String(d.amount), String(d.kihon), d.division])];
    return base;
  });
  const [notes, setNotes] = useState<Record<string, string>>({ 'note-corp': NOTE_DEFAULT, 'note-base': NOTE_BASE_DEFAULT });
  const [inv, setInv] = useState<Record<string, string[][]>>(cloneInv);
  const [invTab, setInvTab] = useState(INVENTORY_TABS[0]);
  const [invSel, setInvSel] = useState<number | null>(null);
  const [merge, setMerge] = useState<{ code: string; name: string; formula: string }[]>([{ code: '001', name: '本部', formula: '' }, { code: '002', name: '保育事業', formula: '' }, { code: '004', name: '一時預かり', formula: '' }, { code: '小計', name: '保育園計', formula: '2+3' }, { code: '003', name: '子育て支援', formula: '' }, { code: '合計', name: '社会福祉事業計', formula: '1+4+5' }]);
  const [perPage, setPerPage] = useState(6);
  const [fmtOpen, setFmtOpen] = useState(false);
  const [fmt, setFmt] = useState({ orient: '縦', font: 'Noto Sans JP 9pt', shade: true, corp: true, page: true });
  // 注記の表（確認メモ #390）：pickOpen＝挿入する表の選択画面、tablesOpen＝注記表 設定画面（開く表の番号）
  const [tables, setTables] = useState<Record<string, NoteTables>>(() => ({ 'note-corp': NOTE_TABLES_DEFAULT(), 'note-base': NOTE_TABLES_DEFAULT() }));
  const [pickOpen, setPickOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState<number | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [load, setLoad] = useState<'inv' | 'note' | null>(null);
  const [ask, setAsk] = useState<{ msg: string; ok: string; run: () => void } | null>(null);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string; hideZero?: boolean } } | null>(null);
  /** 最後に保存した内容。「保存」で更新し、「キャンセル」でここへ戻す */
  const draft: Draft = { rows, notes, tables, inv, merge, perPage };
  const [saved, setSaved] = useState<Draft>(() => cloneDraft(draft));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const saveAll = () => { setSaved(cloneDraft(draft)); toast.show('別紙の内容を保存しました'); };
  const restoreSaved = () => { const d = cloneDraft(saved); setRows(d.rows); setNotes(d.notes); setTables(d.tables); setInv(d.inv); setMerge(d.merge); setPerPage(d.perPage); setInvSel(null); toast.show('変更を破棄し、最後に保存した内容に戻しました'); };
  const cancelAll = () => { if (!dirty) { toast.show('保存していない変更はありません'); return; } setAsk({ msg: '保存していない変更（注記・明細・財産目録の行設定・合算テーブル）を破棄して、最後に保存した内容に戻しますか？', ok: '変更を破棄', run: restoreSaved }); };

  const sheet = SHEETS.find((x) => x.id === cur && shown(x)) ?? SHEETS.find(shown) ?? SHEETS[0];
  /** 本文のカーソル位置に表の目印を入れる（行の途中なら前後で改行する） */
  const insertTable = (no: number) => {
    const ta = noteRef.current; const text = notes[sheet.id] ?? '';
    const at = ta ? ta.selectionStart : text.length;
    const before = text.slice(0, at), after = text.slice(at);
    const mark = (before && !before.endsWith('\n') ? '\n' : '') + noteMarker(no) + (after && !after.startsWith('\n') ? '\n' : '');
    setNotes({ ...notes, [sheet.id]: before + mark + after });
    setPickOpen(false);
    toast.show(`表${no}.${NOTE_TABLE_DEFS[no - 1].name} の目印を本文に入れました`);
    requestAnimationFrame(() => { if (ta) { ta.focus(); const p = before.length + mark.length; ta.setSelectionRange(p, p); } });
  };
  const def = DETAILS[sheet.id];
  const myRows = rows[sheet.id] ?? [];
  const invRows = inv[invTab] ?? [];
  const pick = (id: string) => { setCur(id); setMode('設定・編集'); setInvSel(null); setPeek(false); };
  const goSettings = () => { if (onNavigate) onNavigate('決算附属明細書'); else toast.show(`科目の設定は「各種設定 ＞ ${displayName('決算附属明細書')}」で行います`); };

  /** 左の一覧に出す状態 */
  const statusOf = (x: Sheet): { label: string; bg: string; fg: string } => {
    if (!sheetOk(x, s)) return { label: '条件外', bg: '#f1f4f6', fg: '#9aa5b1' };
    if (x.editor === 'auto') return { label: '自動作成', bg: '#e8f0fb', fg: '#2c5f9e' };
    if (x.editor === 'detail') { const d = DETAILS[x.id]; const filled = (rows[x.id] ?? []).some((r) => d.num.some((i) => toInt(r[i] ?? '') !== 0)); return filled ? { label: '入力あり', bg: '#eaf5ef', fg: '#1f7a52' } : { label: '金額なし', bg: '#fff7e6', fg: '#8a5a00' }; }
    if (x.editor === 'inventory') return Object.values(inv).some((r) => r.length) ? { label: '行設定済み', bg: '#eaf5ef', fg: '#1f7a52' } : { label: '未設定', bg: '#fff7e6', fg: '#8a5a00' };
    if (x.editor === 'merge') return { label: `${merge.length} 行`, bg: '#eef2f6', fg: '#3d4a56' };
    return { label: '編集可', bg: '#eef2f6', fg: '#3d4a56' };
  };

  /** 印刷に使う表データ */
  const invAmount = (tabs: string[]) => tabs.reduce((a, t) => a + (inv[t] ?? []).reduce((b, r) => b + toInt(r[2] ?? ''), 0), 0);
  const tableOf = (x: Sheet): TableData | undefined => {
    if (x.id === 'd1') return kariireTable(rows.d1 ?? [], s.kariireAccts ?? []);
    if (x.id === 'd2') return donationTable(rows.d2 ?? []);
    // ④ 繰入金明細書：伝票登録時に入力した明細データ（この画面では編集しない。確認メモ #461）
    if (x.id === 'd4') { const d = DETAILS.d4; return { header: d.cols, rows: (rows.d4 ?? d.rows).map((r) => r.map((c, i) => (d.num.includes(i) ? toInt(c) : c))) }; }
    if (x.editor === 'detail') { const d = DETAILS[x.id]; return { header: d.cols, rows: (rows[x.id] ?? []).map((r) => r.map((c, i) => (d.num.includes(i) ? toInt(c) : c))) }; }
    if (x.editor === 'inventory') {
      const assets = invAmount(INVENTORY_TABS.slice(0, 3)), debts = invAmount(INVENTORY_TABS.slice(3));
      return { header: ['区分', '貸借対照表科目', '場所・物量等', '金額'], rows: [...INVENTORY_TABS.flatMap((t) => (inv[t] ?? []).map((r): (string | number)[] => [t, r[0], r[1], toInt(r[2] ?? '')])), ['資産合計', '', '', assets], ['負債合計', '', '', debts], ['差引純資産', '', '', assets - debts]] };
    }
    if (x.editor === 'note') return { header: [x.name], rows: (notes[x.id] ?? '').split('\n').map((l) => [l.replace(/@@表(\d)@@/g, (_, n) => `［表${n}.${NOTE_TABLE_DEFS[Number(n) - 1]?.name ?? ''}］`)]) };
    return undefined;
  };
  // 詳細設定は現行の各明細書の画面に合わせる（確認メモ #238）
  const reportOf = (x: Sheet): ReportDef => ({
    id: 'appendix:' + x.id, name: x.group === '附属明細書' ? `${x.name}（別紙3${x.no}）` : x.name, cat: '別紙', sub: x.group, annual: true, common: x.common, title: x.name,
    ...appendixSpec(x.id),
  });

  /* ---- 設定ファイル（財産目録の行設定／注記） ---- */
  const saveFile = (kind: 'inv' | 'note') => {
    if (kind === 'inv') { downloadJson(`財産目録行設定_${stamp()}.json`, { type: 'chappy-inventory', savedAt: new Date().toISOString(), rows: inv }); toast.show('財産目録の行設定を保存しました'); }
    else { downloadJson(`注記_${stamp()}.json`, { type: 'chappy-note', savedAt: new Date().toISOString(), noteKind: sheet.name, note: notes[sheet.id] ?? '', tables: tables[sheet.id] ?? {} }); toast.show('注記および表を保存しました'); }
  };
  const applyLoaded = (obj: unknown, label: string) => {
    const o = (obj ?? {}) as Record<string, unknown>;
    if (load === 'inv') {
      const r0 = o.rows as Record<string, unknown> | undefined;
      if (!r0 || typeof r0 !== 'object') return toast.show('財産目録の行設定ファイルではありません');
      const next: Record<string, string[][]> = {};
      INVENTORY_TABS.forEach((t) => { const r = r0[t]; next[t] = Array.isArray(r) ? r.filter((x): x is string[] => Array.isArray(x)).map((x) => [String(x[0] ?? ''), String(x[1] ?? ''), String(x[2] ?? '')]) : []; });
      setInv(next); setInvSel(null); toast.show(`${label} から財産目録の行設定を読み込みました（${Object.values(next).reduce((a, r) => a + r.length, 0)} 行）`);
    } else {
      if (typeof o.note !== 'string') return toast.show('注記の設定ファイルではありません');
      setNotes((n) => ({ ...n, [sheet.id]: o.note as string }));
      if (o.tables && typeof o.tables === 'object') setTables((t) => ({ ...t, [sheet.id]: o.tables as NoteTables }));
      toast.show(`${label} から注記および表を読み込みました`);
    }
    setLoad(null);
  };
  const onFile = (f: File | undefined) => { if (!f) return; f.text().then((t) => { try { applyLoaded(JSON.parse(t), f.name); } catch { toast.show('JSON として読み込めませんでした'); } }); };
  const loadSample = () => {
    if (load === 'inv') applyLoaded({ rows: { ...INVENTORY_DEFAULT, 流動資産: [...INVENTORY_DEFAULT.流動資産, ['立替金', '職員立替分', '12,000']], 固定負債: [['設備資金借入金', '○○銀行（園舎改修）', '3,000,000']] } }, 'サンプル');
    else applyLoaded({ note: (sheet.id === 'note-base' ? NOTE_BASE_DEFAULT : NOTE_DEFAULT) + '\n7. 担保に供している資産\n　該当なし。\n8. 満期保有目的の債券の内訳並びに帳簿価額、時価及び評価損益\n　該当なし。' }, 'サンプル');
  };
  /* ---- 合算テーブル ---- */
  const exportTable = () => toast.show(runExport({ kind: 'csv', title: '合算テーブル', fileName: `合算テーブル_${stamp()}`, header: ['No.', 'コード', '部門名称', '計算式', '1ページ中の項目数'], rows: merge.map((m, i) => [i + 1, m.code, m.name, m.formula, i === 0 ? perPage : '']) }));
  const onTableFile = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => {
      const lines = t.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
      const cells = (l: string) => { const out: string[] = []; let c0 = ''; let q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { c0 += '"'; i++; } else if (c === '"') q = false; else c0 += c; } else if (c === '"') q = true; else if (c === ',') { out.push(c0); c0 = ''; } else c0 += c; } out.push(c0); return out; };
      const body = lines.map(cells).filter((r) => r[1] && r[0] !== 'No.');
      if (!body.length) return toast.show('合算テーブルの行が見つかりませんでした（エクスポートした CSV を選んでください）');
      setMerge(body.map((r) => ({ code: r[1], name: r[2] ?? '', formula: r[3] ?? '' })));
      const pp = parseInt(body[0][4] ?? '', 10); if (pp >= 3 && pp <= 10) setPerPage(pp);
      toast.show(`${f.name} から合算テーブルを読み込みました（${body.length} 行）`);
    });
  };
  const moveInv = (dir: -1 | 1) => { if (invSel == null) return; const j = invSel + dir; if (j < 0 || j >= invRows.length) return; const n = [...invRows]; [n[invSel], n[j]] = [n[j], n[invSel]]; setInv({ ...inv, [invTab]: n }); setInvSel(j); };
  const setCell = (ri: number, ci: number, v: string) => setRows((d) => ({ ...d, [sheet.id]: (d[sheet.id] ?? []).map((r, i) => (i === ri ? r.map((c, k) => (k === ci ? v : c)) : r)) }));

  const peeking = peek && !!sheet.na;
  const canPrint = sheet.editor !== 'merge' && (sheetOk(sheet, s) || peeking);
  const tag = (label: string, bg: string, fg: string): ReactNode => <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: bg, color: fg, whiteSpace: 'nowrap' }}>{label}</span>;

  const actions = <>
    <button type="button" className="btn-outline" onClick={cancelAll} title="保存していない変更を破棄して、最後に保存した内容に戻します" style={btn()} data-appendix-cancel>キャンセル</button>
    <button type="button" className="submit-btn" onClick={saveAll} style={btn(accent, true)}>保存</button>
  </>;
  const body = (
    <>
      <ToastView msg={toast.msg} />
      {embedded && (
        <div data-appendix-bar style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid #eef2f5', background: dirty ? '#fff8ea' : '#fff' }}>
          <span style={{ fontSize: 14, color: '#5b6773' }}>決算書に添付する別紙です。注記・明細・財産目録の行設定は、編集したあと「保存」で確定します。</span>
          {dirty && <span style={{ fontSize: 12, fontWeight: 700, color: '#8a5a00' }}>保存で変更内容を確定してください。</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{actions}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', minHeight: 520, alignItems: 'start' }}>
        {/* 左：別紙の一覧 */}
        <nav aria-label="別紙の一覧" style={{ borderRight: '1px solid #eef2f5', padding: 10, maxHeight: 'calc(100vh - 220px)', overflow: 'auto', alignSelf: 'stretch' }}>
          {GROUPS.map((g) => {
            const items = SHEETS.filter((x) => x.group === g && shown(x));
            return (
              <div key={g} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#8290a0', padding: '6px 8px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>{g}{g === '附属明細書' && <span style={{ fontWeight: 500 }}>（別紙3 ①〜⑲）</span>}</div>
                {items.map((x) => {
                  const on = x.id === cur; const st = statusOf(x);
                  return (
                    <button key={x.id} type="button" data-sheet={x.id} onClick={() => pick(x.id)} aria-current={on ? 'true' : undefined} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', borderRadius: 8, background: on ? accent : 'transparent', color: on ? '#fff' : sheetOk(x, s) ? '#22303c' : '#9aa5b1', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 1 }}>
                      <span style={{ width: x.no.length > 1 && x.group === '附属明細書' ? 30 : 20, flex: 'none', fontSize: 14, fontWeight: 700, textAlign: 'center', opacity: 0.85, whiteSpace: 'nowrap' }}>{x.no}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: on ? 700 : 500, lineHeight: 1.45 }}>{x.name}</span>
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: on ? 'rgba(255,255,255,.22)' : st.bg, color: on ? '#fff' : st.fg, marginTop: 2 }}>{st.label}</span>
                    </button>
                  );
                })}
                {g === '附属明細書' && <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: '#8290a0', padding: '4px 8px', cursor: 'pointer' }}><input type="checkbox" checked={!hideNa} onChange={(e) => setHideNa(!e.target.checked)} />表示条件を満たさない別紙も表示（就労支援・授産 ⑮〜⑲ など）</label>}
              </div>
            );
          })}
        </nav>

        {/* 右：選んだ別紙の設定・編集／印刷 */}
        <div style={{ minWidth: 0 }}>
          <div style={{ padding: '14px 22px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, minWidth: 0 }}>{sheet.group === '附属明細書' ? `${sheet.no} ` : ''}{sheet.name}</div>
            {sheet.group === '附属明細書' && tag(`別紙3（${sheet.no}）`, '#eef2f6', '#3d4a56')}
            {sheet.unit && tag(`${sheet.unit}で作成`, sheet.unit === '法人全体' ? '#e4f1f0' : '#fff3dc', sheet.unit === '法人全体' ? '#1f6f6b' : '#8a5a00')}
            {condText(sheet) && tag(sheetOk(sheet, s) ? '表示条件あり' : '表示条件を満たしていません', sheetOk(sheet, s) ? '#eef2f6' : '#fdecea', sheetOk(sheet, s) ? '#3d4a56' : '#b03a2e')}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8290a0' }}>{s.fiscalYear}　{s.division}</span>
          </div>
          {condText(sheet) && <div data-sheet-cond style={{ padding: '0 22px 8px', fontSize: 12, color: '#8290a0' }}>表示条件：{condText(sheet)}</div>}
          {peeking && <div data-sheet-peek style={{ margin: '0 22px 10px', padding: '8px 12px', borderRadius: 8, background: '#fff8ea', border: '1px solid #f0dcae', fontSize: 14, color: '#6b4e00', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 0 }}>見本の表示です。対象の事業がある法人で、条件を満たしたときの画面を確認用に表示しています（起動中の法人では印刷されません）。</span>
            <button type="button" onClick={() => { setPeek(false); setMode('設定・編集'); }} style={btn('#5b6773', false, true)}>見本の表示をやめる</button>
          </div>}
          {canPrint && <Tabs items={['設定・編集', '印刷']} current={mode} onChange={setMode} accent={accent} small />}

          {mode === '印刷' && canPrint ? (
            <div style={{ padding: '14px 22px 22px' }}>
              <div style={{ ...card, overflow: 'visible', ['--print-foot-bottom' as string]: 'var(--proto-dock-space, 0px)', ['--print-foot-radius' as string]: '0 0 12px 12px' }}>
                {/* ⑧ 固定資産の明細書は、減価償却の同じ帳票と同じ印刷画面（詳細設定も共有。確認メモ #425） */}
                {sheet.id === 'd8' ? <DepPrintPanel key={sheet.id} name={sheet.name} accent={accent} onRun={(v, o) => {
                  const t = String(v.title || sheet.name);
                  if (o === 'preview') { setPreview({ title: t, opts: { from: String(v.periodFrom ?? ''), to: String(v.periodTo ?? ''), output: '画面へプレビューする' } }); return; }
                  const spec: ExportSpec = { kind: o, title: t, meta: s.division, ...tableOf(sheet) };
                  if (o === 'print') toast.show(runExport(spec)); else setExp(spec);
                }} /> : <PrintFlow key={sheet.id} report={reportOf(sheet)} accent={accent} data={tableOf(sheet)} onPreview={(title, opts) => setPreview({ title, opts })} />}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 22px 22px', display: 'grid', gap: 12 }}>
              {/* ---- 注記の編集 ---- */}
              {sheet.editor === 'note' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 14, alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <textarea ref={noteRef} data-note-text aria-label={`${sheet.name}の本文`} value={notes[sheet.id] ?? ''} onChange={(e) => setNotes({ ...notes, [sheet.id]: e.target.value })} rows={18} style={{ ...input, resize: 'vertical', lineHeight: 1.8, fontSize: 14 }} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, fontSize: 12, color: '#8290a0' }}>注記の表<HelpTip text={['［表挿入］で選んだ表の目印（例 @@表1@@）を、本文のカーソルの位置に入れます', '表の中身は［表編集］で作り、目印の位置に印刷します', '法人全体用と拠点区分用は、本文も表も別々に保存します']} /></div>
                    <button type="button" data-note-insert onClick={() => setPickOpen(true)} style={btn(accent)}>表挿入</button>
                    <button type="button" data-note-edit onClick={() => { const m = (notes[sheet.id] ?? '').match(/@@表(\d)@@/); setTablesOpen(m ? Number(m[1]) : 1); }} style={btn()}>表編集</button>
                    <button type="button" onClick={() => setAsk({ msg: `${sheet.name} の本文と表を既定の内容に戻しますか？`, ok: '既定に戻す', run: () => { setNotes((n) => ({ ...n, [sheet.id]: sheet.id === 'note-base' ? NOTE_BASE_DEFAULT : NOTE_DEFAULT })); setTables((t) => ({ ...t, [sheet.id]: NOTE_TABLES_DEFAULT() })); } })} style={btn()}>既定の設定に戻す</button>
                    <button type="button" data-import-export-btn="注記" onClick={() => setLoad('note')} style={btn()}>インポート／エクスポート</button>
                    <button type="button" onClick={() => setMode('印刷')} style={{ ...btn(accent, true), marginTop: 8 }}>印刷へ進む</button>
                  </div>
                </div>
              )}

              {/* ---- 附属明細書：明細入力 ---- */}
              {sheet.editor === 'detail' && def && (
                <>
                  {sheet.id === 'd1' ? <KariireDetail rows={myRows} accts={s.kariireAccts ?? []} tree={s.tree} accent={accent} onChange={(r) => setRows((d) => ({ ...d, d1: r }))} onOpenSettings={goSettings} /> : <div style={card}>
                    <div style={cardHead}>明細入力 <span style={{ fontWeight: 500, color: '#8290a0', fontSize: 12 }}>金額を入力すると明細書に印刷されます</span><button type="button" onClick={() => setRows((d) => ({ ...d, [sheet.id]: [...(d[sheet.id] ?? []), def.cols.map((_, ci) => def.choices?.[ci]?.[0] ?? '')] }))} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>＋ 行を追加</button></div>
                    <div style={{ overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{def.cols.map((c, i) => <th key={c} style={{ ...TH, textAlign: def.num.includes(i) ? 'right' : 'left' }}>{c}</th>)}<th style={{ ...TH, width: 50 }} /></tr></thead>
                        <tbody>
                          {myRows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => { const numeric = def.num.includes(ci); const ch = def.choices?.[ci]; if (ch) return <td key={ci} style={TD}><select className="field-input" aria-label={def.cols[ci]} value={c} onChange={(e) => setCell(ri, ci, e.target.value)} style={{ ...input, padding: '4px 8px', fontSize: 14, minWidth: 120 }}>{(ch.includes(c) ? ch : [c, ...ch]).map((o) => <option key={o}>{o}</option>)}</select></td>; return <td key={ci} style={numeric ? NUM : TD}><input className="field-input" aria-label={def.cols[ci]} value={numeric && c ? yen(toInt(c)) : c} onChange={(e) => setCell(ri, ci, numeric ? String(toInt(e.target.value)) : e.target.value)} inputMode={numeric ? 'numeric' : undefined} style={{ ...(numeric ? numInput : input), padding: '4px 8px', fontSize: 14, minWidth: numeric ? 96 : Math.max(110, Math.max(...myRows.map((x) => (x[ci] ?? '').length)) * 14 + 24), color: numeric && toInt(c) < 0 ? '#c0392b' : undefined }} /></td>; })}<td style={TD}><button type="button" title="この行を削除" onClick={() => setRows((d) => ({ ...d, [sheet.id]: (d[sheet.id] ?? []).filter((_, i) => i !== ri) }))} style={btn('#c0392b', false, true)}>×</button></td></tr>)}
                          {myRows.length === 0 && <tr><td colSpan={def.cols.length + 1} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 24 }}>明細がありません。「＋ 行を追加」で入力します。</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {def.hint && <div style={{ padding: '8px 14px', fontSize: 12, color: '#9aa5b1' }}>{def.hint}</div>}
                  </div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14, color: '#5b6773' }}>
                    <span>集計する科目・伝票入力時の監視は「{displayName('決算附属明細書')}」で設定します。</span>
                    <button type="button" onClick={goSettings} style={btn('#5b6773', false, true)}>{displayName('決算附属明細書')}を開く</button>
                    <button type="button" onClick={() => setMode('印刷')} style={{ ...btn(accent, true, true), marginLeft: 'auto' }}>印刷へ進む</button>
                  </div>
                </>
              )}

              {/* ---- 自動作成／対象外 ---- */}
              {sheet.editor === 'auto' && (
                !sheetOk(sheet, s) && !peeking ? <Notice>{sheet.na ? <>この明細書は、就労支援事業・授産事業を行う法人が作成するものです。起動中の法人には対象の事業がないため、編集・印刷する内容はありません。<span style={{ display: 'block', marginTop: 8 }}><button type="button" data-peek onClick={() => setPeek(true)} style={btn(accent, false, true)}>条件を満たしたときの画面を見る（見本）</button></span></> : `この明細書は表示条件（${condText(sheet)}）を満たしていないため、印刷できません。`}</Notice>
                  : <>
                    <Notice tone="ok">{sheet.source === STMT_SOURCE ? `この明細書は${STMT_SOURCE}から自動で作成します。この画面で編集する項目はありません。` : <>この明細書は「{sheet.source ?? (sheet.na ? '伝票（就労支援事業・授産事業の区分ごとの集計）' : '伝票')}」から自動で作成します。この画面で編集する項目はありません。</>}</Notice>
                    <div><button type="button" onClick={() => setMode('印刷')} style={btn(accent, true)}>印刷へ進む</button></div>
                  </>
              )}

              {/* ---- 財産目録の行設定 ---- */}
              {sheet.editor === 'inventory' && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{INVENTORY_TABS.map((t) => <button key={t} type="button" onClick={() => { setInvTab(t); setInvSel(null); }} style={btn(invTab === t ? accent : '#5b6773', invTab === t, true)}>{t}<span style={{ opacity: 0.7, marginLeft: 4 }}>{(inv[t] ?? []).length}</span></button>)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 170px', gap: 14, alignItems: 'start' }}>
                    <div style={card}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={{ ...TH, width: 40 }}>#</th><th style={TH}>貸借対照表科目</th><th style={TH}>場所・物量等</th><th style={{ ...TH, textAlign: 'right', width: 140 }}>金額</th></tr></thead>
                        <tbody>{invRows.map((r, i) => <tr key={i} onClick={() => setInvSel(i)} style={{ background: invSel === i ? '#eef2f6' : 'transparent', cursor: 'pointer' }}><td style={TD}>{i + 1}</td>{r.map((c, k) => <td key={k} style={k === 2 ? NUM : TD}><input className="field-input" value={c} onFocus={() => setInvSel(i)} onChange={(e) => setInv({ ...inv, [invTab]: invRows.map((x, xi) => (xi === i ? x.map((y, yi) => (yi === k ? e.target.value : y)) : x)) })} style={{ ...(k === 2 ? numInput : input), padding: '4px 8px', fontSize: 14 }} /></td>)}</tr>)}{invRows.length === 0 && <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 24 }}>行がありません。「行挿入」または「既定に戻す」で追加してください。</td></tr>}</tbody>
                      </table>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <button type="button" onClick={() => moveInv(-1)} style={btn()}>上へ移動</button><button type="button" onClick={() => moveInv(1)} style={btn()}>下へ移動</button>
                      <button type="button" onClick={() => setInv({ ...inv, [invTab]: [...invRows.slice(0, invSel ?? invRows.length), ['', '', ''], ...invRows.slice(invSel ?? invRows.length)] })} style={btn()}>行挿入</button>
                      <button type="button" onClick={() => { if (invSel != null) { setInv({ ...inv, [invTab]: invRows.filter((_, i) => i !== invSel) }); setInvSel(null); } else toast.show('削除する行を選んでください'); }} style={btn('#c0392b')}>行削除</button>
                      <button type="button" onClick={() => setAsk({ msg: `「${invTab}」の全行を削除しますか？`, ok: '全行削除', run: () => { setInv((v) => ({ ...v, [invTab]: [] })); setInvSel(null); } })} style={btn('#c0392b')}>全行削除</button>
                      <button type="button" onClick={() => setAsk({ msg: '財産目録の行設定を、貸借対照表の科目から作成した既定の内容に戻しますか？', ok: '既定に戻す', run: () => { setInv(cloneInv()); setInvSel(null); } })} style={btn()}>既定に戻す</button>
                      <button type="button" data-import-export-btn="財産目録の行設定" onClick={() => setLoad('inv')} style={btn()}>インポート／エクスポート</button>
                      <button type="button" onClick={() => setMode('印刷')} style={{ ...btn(accent, true), marginTop: 8 }}>印刷へ進む</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, fontVariantNumeric: 'tabular-nums' }}>
                    <span>資産合計 <b>{yen(invAmount(INVENTORY_TABS.slice(0, 3)))}</b></span><span>負債合計 <b>{yen(invAmount(INVENTORY_TABS.slice(3)))}</b></span><span>差引純資産 <b>{yen(invAmount(INVENTORY_TABS.slice(0, 3)) - invAmount(INVENTORY_TABS.slice(3)))}</b></span>
                  </div>
                  <Notice>初期状態では行が空のため、最初に「既定に戻す」で貸借対照表の科目から行を作成します。差引純資産の網掛け・行送りなど印刷の条件は、「印刷」タブの詳細設定で指定します。</Notice>
                </>
              )}

              {/* ---- 合算テーブル ---- */}
              {sheet.editor === 'merge' && (
                <>
                  <Notice>内訳表（区分を横に並べた決算書・附属明細書）を印刷する前に、横軸となる区分と小計・合計の計算式を設定します。作成しないまま内訳表を印刷することはできません。</Notice>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#8290a0' }}>1ページ中の項目数</span>
                    <button type="button" aria-label="項目数を減らす" onClick={() => setPerPage((p) => Math.max(3, p - 1))} style={btn('#5b6773', false, true)}>▼</button><b style={{ fontVariantNumeric: 'tabular-nums' }}>{perPage}</b><button type="button" aria-label="項目数を増やす" onClick={() => setPerPage((p) => Math.min(10, p + 1))} style={btn('#5b6773', false, true)}>▲</button>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}><ImportExportButton name="合算テーブル" accent={accent} format="CSV" exportDesc="区分・小計・合計の行と計算式を CSV ファイルに書き出します。" onExport={exportTable} importDesc="書き出した CSV ファイルを選んで、合算テーブルを置き換えます。" accept=".csv,text/csv" onImport={(f) => onTableFile(f)} importWarn="読み込むと、いまの合算テーブルの行は置き換わります。" /><button type="button" onClick={() => setFmtOpen(true)} style={btn()}>印刷書式</button></span>
                  </div>
                  <div style={card}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={{ ...TH, width: 50 }}>No.</th><th style={{ ...TH, width: 140 }}>コード（区分／小計／合計）</th><th style={TH}>部門名称</th><th style={{ ...TH, width: 200 }}>計算式（No.で指定）</th><th style={{ ...TH, width: 50 }} /></tr></thead>
                      <tbody>{merge.map((m, i) => <tr key={i} style={{ background: m.code === '小計' ? '#fff8d6' : m.code === '合計' ? '#efe6fb' : 'transparent' }}><td style={TD}>{i + 1}</td><td style={TD}><select value={m.code} onChange={(e) => setMerge(merge.map((x, k) => (k === i ? { ...x, code: e.target.value } : x)))} style={{ ...input, padding: '4px 8px', fontSize: 14 }}>{[...SERVICES.map((v) => v.split(' ')[0]), '小計', '合計'].map((o) => <option key={o}>{o}</option>)}</select></td><td style={TD}><input className="field-input" value={m.name} onChange={(e) => setMerge(merge.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} style={{ ...input, padding: '4px 8px', fontSize: 14 }} /></td><td style={TD}>{(m.code === '小計' || m.code === '合計') ? <input className="field-input" value={m.formula} onChange={(e) => setMerge(merge.map((x, k) => (k === i ? { ...x, formula: e.target.value } : x)))} placeholder="例：2+3" style={{ ...input, padding: '4px 8px', fontSize: 14 }} /> : <span style={{ color: '#9aa5b1', fontSize: 14 }}>—</span>}</td><td style={TD}><button type="button" title="この行を削除" onClick={() => setMerge(merge.filter((_, k) => k !== i))} style={btn('#c0392b', false, true)}>×</button></td></tr>)}</tbody>
                    </table>
                    <div style={{ padding: 10 }}><button type="button" onClick={() => setMerge([...merge, { code: SERVICES[0].split(' ')[0], name: '', formula: '' }])} style={btn(accent, false, true)}>＋ 行を追加</button></div>
                  </div>
                  <div style={{ fontSize: 14, color: '#7a8794' }}>黄色＝小計、紫＝合計。計算式には、合計する行の No. を 2+3 のように入力します。</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #eef2f5', padding: '10px 22px 14px', fontSize: 12, color: '#8290a0', lineHeight: 1.7 }}>
        これまで「保守」メニューにあった「財産目録設定」「計算書類に対する注記（法人全体用／拠点区分用）」は、同じ機能が重複していたため、この画面にまとめました。
      </div>

      {/* 確認（既定に戻す・全行削除・変更の破棄） */}
      <Modal open={!!ask} onClose={() => setAsk(null)} width={440} title="確認" strict>
        {ask && <div style={{ padding: '16px 22px 18px', display: 'grid', gap: 14 }}><div style={{ fontSize: 14, lineHeight: 1.8 }}>{ask.msg}</div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setAsk(null)} style={btn()}>キャンセル</button><button type="button" onClick={() => { ask.run(); setAsk(null); }} style={btn('#c0392b', true)}>{ask.ok}</button></div></div>}
      </Modal>
      {/* 注記の表：挿入する表の選択画面／注記表 設定画面（確認メモ #390） */}
      {pickOpen && <NoteTablePickDialog accent={accent} onCancel={() => setPickOpen(false)} onPick={insertTable} />}
      {tablesOpen != null && <NoteTablesDialog value={tables[sheet.id] ?? {}} initial={tablesOpen} accent={accent} onCancel={() => setTablesOpen(null)} onOk={(v) => { setTables({ ...tables, [sheet.id]: v }); setTablesOpen(null); toast.show('注記の表を設定しました'); }} />}
      {/* 財産目録の行設定／注記のインポート／エクスポート（確認事項「インポート・エクスポート処理の統一」） */}
      <ImportExportDialog open={!!load} onClose={() => setLoad(null)} name={load === 'inv' ? '財産目録の行設定' : sheet.name} accent={accent} format="JSON"
        exportDesc="いまの内容を設定ファイルに書き出します。"
        onExport={() => { if (load) saveFile(load); }}
        importDesc="書き出した設定ファイルを選んで、いまの内容を置き換えます。読み込んだ内容は画面上部の「保存」で確定します。"
        accept=".json,application/json"
        onImport={(f) => onFile(f)}
        onSample={loadSample}
        importWarn="「保存」で確定したあとは、読み込む前の内容に戻せません（「既定に戻す」で初期状態には戻せます）。" />
      {/* 合算テーブルの印刷書式 */}
      <Modal open={fmtOpen} onClose={() => setFmtOpen(false)} width={520} title="合算テーブル（内訳表）の印刷書式">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="用紙の向き"><select value={fmt.orient} onChange={(e) => setFmt({ ...fmt, orient: e.target.value })} style={input}><option>縦</option><option>横</option></select></Field>
          <Field label="1ページ中の項目数"><input className="field-input" value={String(perPage)} onChange={(e) => setPerPage(Math.max(3, Math.min(10, toInt(e.target.value) || 3)))} inputMode="numeric" style={numInput} /></Field>
          <Field label="フォント" span={2}><select value={fmt.font} onChange={(e) => setFmt({ ...fmt, font: e.target.value })} style={input}>{['Noto Sans JP 9pt', 'Noto Sans JP 10pt', 'ＭＳ 明朝 9pt', 'ＭＳ ゴシック 9pt'].map((o) => <option key={o}>{o}</option>)}</select></Field>
          <div style={{ gridColumn: 'span 2', display: 'grid', gap: 8 }}>
            <Toggle on={fmt.shade} onChange={(v) => setFmt({ ...fmt, shade: v })} accent={accent} label="合計行を網掛けにする" />
            <Toggle on={fmt.corp} onChange={(v) => setFmt({ ...fmt, corp: v })} accent={accent} label="法人名を印刷する" />
            <Toggle on={fmt.page} onChange={(v) => setFmt({ ...fmt, page: v })} accent={accent} label="ページ番号を印刷する" />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setFmtOpen(false)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => { setFmtOpen(false); toast.show('印刷書式を保存しました'); }} style={btn(accent, true)}>OK</button>
          </div>
        </div>
      </Modal>
      {/* プレビュー */}
      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} pages={1} data={preview ? tableOf(sheet) : undefined}>
        {preview && sheet.editor === 'note' ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.9 }}>{notes[sheet.id] ?? ''}</pre> : undefined}
      </PreviewModal>
    </>
  );
  if (embedded) return <div data-appendix-embedded>{body}</div>;
  return (
    <SettingsShell variant={variant} title="別紙（注記・附属明細書・財産目録）" badge="印刷" desc="決算書に添付する別紙の編集と印刷を行います。左の一覧から別紙を選び、右側で内容の編集と印刷をします。" actions={actions}>
      {body}
    </SettingsShell>
  );
}
