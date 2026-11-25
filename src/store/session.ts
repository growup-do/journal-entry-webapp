// アプリ全体で共有する軽い状態（区分・年度・お気に入り・各種設定・テンプレート）。
// localStorage に保存し、useSession() で購読する。本番ではサーバー側のユーザー設定に置き換える想定。

import { useSyncExternalStore } from 'react';
import { DEFAULT_MEMBER_ACCESS, FULL_ACCESS, type Access } from './access';

/* ---------- 区分（事業区分 › 拠点区分 › サービス区分 › 小サービス区分） ---------- */
export interface DivisionNode {
  id: string;
  code: string;
  name: string;
  kind: '法人' | '事業区分' | '拠点区分' | 'サービス区分' | '小サービス区分' | '合算';
  /** 伝票入力区分（先頭に3桁コードのある区分）か */
  entry?: boolean;
  use?: boolean;
  color?: string;
  category?: string; // 事業種別
  startYear?: string;
  children?: DivisionNode[];
}

export const DEFAULT_TREE: DivisionNode = {
  id: 'corp', code: '', name: '社会福祉法人 チャイルド保育園', kind: '法人', children: [
    { id: 'shafuku', code: '', name: '社会福祉事業', kind: '事業区分', children: [
      { id: 'honbu', code: '001', name: '本部', kind: '拠点区分', entry: true, use: true, color: '#e8f0fb', category: '法人本部', startYear: '令和6年度', children: [] },
      { id: 'hoikuen', code: '', name: 'チャイルド保育園', kind: '拠点区分', children: [
        { id: 'hoiku', code: '002', name: '保育事業', kind: 'サービス区分', entry: true, use: true, color: '#eaf5ef', category: '保育事業', startYear: '令和6年度', children: [] },
        // 子育て支援は小サービス区分を持つ親区分（集計・参照用）の例。伝票は末端の入力区分で登録する
        { id: 'kosodate', code: '003', name: '子育て支援', kind: 'サービス区分', children: [
          { id: 'ichiji', code: '004', name: '一時預かり', kind: '小サービス区分', entry: true, use: true, color: '#fff7e6', category: '子育て支援', startYear: '令和7年度' },
        ] },
        { id: 'chiiki', code: '005', name: '地域支援', kind: 'サービス区分', entry: true, use: false, color: '#f1f4f6', category: '地域支援', startYear: '令和8年度' },
      ] },
    ] },
    // 公益事業・収益事業の配下はダミー（確認メモ #162：事業区分を3つ横に並べ、その下に拠点区分・サービス区分を並べた見た目の確認用。伝票のサンプルはない）
    { id: 'koeki', code: '', name: '公益事業', kind: '事業区分', children: [
      { id: 'd-kosodate-c', code: '', name: '子育て支援センター（ダミー）', kind: '拠点区分', children: [
        { id: 'd-soudan', code: '006', name: '子育て相談（ダミー）', kind: 'サービス区分', entry: true, use: true, color: '#fdeef3', category: 'その他', startYear: '令和8年度' },
        { id: 'd-hiroba', code: '007', name: '親子ひろば（ダミー）', kind: 'サービス区分', entry: true, use: true, color: '#efe6fb', category: 'その他', startYear: '令和8年度' },
      ] },
    ] },
    { id: 'shueki', code: '', name: '収益事業', kind: '事業区分', children: [
      { id: 'd-shueki-k', code: '', name: '収益事業拠点（ダミー）', kind: '拠点区分', children: [
        { id: 'd-parking', code: '008', name: '駐車場賃貸（ダミー）', kind: 'サービス区分', entry: true, use: true, color: '#fbe9d0', category: 'その他', startYear: '令和8年度' },
        { id: 'd-vending', code: '009', name: '自動販売機（ダミー）', kind: 'サービス区分', entry: true, use: true, color: '#e0f4f7', category: 'その他', startYear: '令和8年度' },
      ] },
    ] },
  ],
};
/** 区分ツリーの見本の版。上げると、以前の保存データにも見本の区分を足す（利用者が直した区分はそのまま） */
export const TREE_REV = 2;
/** 以前の保存データに、ダミーの事業区分・拠点区分・サービス区分を足す（確認メモ #162）。同じ id の区分がすでにあれば足さない */
function addSampleDivisions(tree: DivisionNode): DivisionNode {
  const has = new Set(flattenDivisions(tree).map((x) => x.node.id));
  const children = [...(tree.children ?? [])].map((c) => {
    const def = DEFAULT_TREE.children?.find((d) => d.id === c.id);
    const add = (def?.children ?? []).filter((d) => !has.has(d.id));
    return add.length ? { ...c, children: [...(c.children ?? []), ...add] } : c;
  });
  (DEFAULT_TREE.children ?? []).forEach((d) => { if (!has.has(d.id)) children.push(d); });
  return { ...tree, children };
}

/* ---------- 設定 ---------- */
export interface EnvSettings {
  confirmGeneral: boolean; confirmIncome: boolean; confirmExpense: boolean;
  autoComplete: boolean; autoCompleteAdd: boolean; specialPopup: boolean;
  budgetCheck: boolean; budgetThreshold: number; oneSideInternal: boolean; searchTotal: boolean;
  thousandsSep: '点線' | 'カンマ' | 'なし'; negativeSign: '-' | '△' | '▲'; negativeColor: '黒' | '赤'; zeroCut: boolean;
  colorReports: boolean; lineColor: string; shadeColor: string;
  wideInitial: string; wideMonth: string; ledger1Init: string; ledger2Init: string; order: '日付順' | '入力順';
  eraGannen: boolean; trialCalc: string; reserveOutput: string; noteOnExcel: boolean;
  /** 帳票・繰入金・注意書き（動作環境 4.2.2） */
  budgetInternalOffset: boolean; onePageRow: boolean; termFromStart: boolean; hideCorpName: boolean;
  transferWatch: '収入で監視' | '支払いで監視';
  /** 依頼書 2.6／5.5.1：動作環境の残り項目（全区分共通：フリガナ検索の無効化・帳票印刷の速度重視／区分ごと：負数の表記位置・バックアップ先・画面背景・金額フォントの自動調整）。
   *  確認メモ #170・#172・#173・#174：noFurigana／oneSideInternal／specialPopup／backupDest／backupFolder の設定欄は環境設定の画面から削除した（保存済みデータとの互換のためフィールドは残す） */
  noFurigana: boolean; printSpeed: boolean;
  negativePos: '前' | '後'; backupDest: 'クラウド（標準）' | 'フォルダ指定' | 'Dropbox'; backupFolder: string;
  bgMode: '色' | '画像'; bgColor: string; bgColorRight: string; autoAmountFont: boolean;
  /** 補正予算額の入力方式（依頼書 5.5.5：切替は「予算額の設定」画面内で行う。区分ごと） */
  supplementMode: '補正額' | '補正後予算額';
  /** 付箋の色の意味（全区分共通）。付箋ボタンのツールチップ・検索条件・印刷の絞り込みに表示する */
  fusenNames: Record<'赤' | '青' | '黄' | '緑', string>;
}
export const DEFAULT_ENV: EnvSettings = {
  confirmGeneral: true, confirmIncome: true, confirmExpense: true,
  autoComplete: true, autoCompleteAdd: true, specialPopup: true,
  budgetCheck: true, budgetThreshold: 90, oneSideInternal: false, searchTotal: true,
  thousandsSep: 'カンマ', negativeSign: '△', negativeColor: '赤', zeroCut: true,
  colorReports: true, lineColor: '#c8d3de', shadeColor: '#eef2f6',
  wideInitial: '仕訳日記帳', wideMonth: '最新月', ledger1Init: '普通預金（保育園）', ledger2Init: '', order: '日付順',
  eraGannen: true, trialCalc: '費目行に表記されている計算方式で計算する', reserveOutput: '予備費を標準方式で印字', noteOnExcel: true,
  budgetInternalOffset: true, onePageRow: false, termFromStart: false, hideCorpName: false, transferWatch: '収入で監視',
  noFurigana: false, printSpeed: false,
  negativePos: '前', backupDest: 'クラウド（標準）', backupFolder: '', bgMode: '色', bgColor: '#f3f6f9', bgColorRight: '#eef5fb', autoAmountFont: true,
  supplementMode: '補正額',
  fusenNames: { 赤: '', 青: '', 黄: '', 緑: '' },
};

export interface InputSettings {
  voucherNo: '自動' | '手入力'; shohyo: boolean; cheque: boolean; tekiyoCode: boolean; gyoshaCode: boolean; spare1: boolean; spare2: boolean; keepLast: boolean; font: '大き目' | '小さ目';
}
export const DEFAULT_INPUT: InputSettings = { voucherNo: '自動', shohyo: true, cheque: false, tekiyoCode: true, gyoshaCode: true, spare1: false, spare2: false, keepLast: false, font: '大き目' };

export interface PrintCommon {
  depth: string; lineGap: string; gapSize: string; perPage: number; twoLineNames: boolean; autoFontHeader: boolean;
  items: Record<string, boolean>; offsetX: number; offsetY: number;
  widthName: number; widthAmount: number; fontHeader: string; fontName: string; fontAmount: string;
  /** 共通の印刷書式設定（現行）：ヘッダー項目名・備考のフォント */
  fontHeaderItem: string; fontRemark: string;
  /** 内訳書の共通の印刷書式（現行【内訳書 - 共通の印刷書式設定】） */
  inner: InnerFormat;
  stamps: string[]; footnotes: Record<string, string>;
  /** ページ番号の開始番号 */
  pageStart: number;
  /** 備考・摘要（依頼書 3.2）：単位ごとに保持する（法人の決算書／拠点の決算書／サービス区分の資金収支計算書）。1つには統合しない */
  unitRemarks: Record<string, string>;
  /** 帳票選択（旧 動作環境パネル「帳票選択」。確認メモ #49）：決算書・準決算書で使う様式。区分階層により省略できる様式は false にできる */
  forms: Record<string, boolean>;
}
/** 内訳書の共通の印刷書式（現行マニュアル 7.1.2） */
export interface InnerFormat { paper: 'A4' | 'A3'; orient: '縦' | '横'; fontHeader: string; fontHeaderItem: string; fontName: string; fontAmount: string; widthName: number; widthAmount: number; deptEveryPage: boolean }
export const DEFAULT_INNER_FORMAT: InnerFormat = { paper: 'A4', orient: '横', fontHeader: 'Noto Sans JP 11pt', fontHeaderItem: 'Noto Sans JP 9pt', fontName: 'Noto Sans JP 9pt', fontAmount: 'Noto Sans JP 9pt', widthName: 50, widthAmount: 24, deptEveryPage: true };
export const PRINT_ITEMS: [string, string][] = [
  ['zero', '0データを印刷しない'], ['shade', '費目行を網掛け、太字にする'], ['bold', '費目下を太線にする'], ['stamp', '捺印欄を印刷する'], ['corp', '法人名を印刷する'],
  ['hline', '項目・科目毎に横線を印刷する'], ['note', '（注）予備費の充当額等を印刷する'], ['autofont', '科目名のフォントサイズを自動調整する'], ['page', 'ページ番号を印刷する'], ['date', '印刷時の日付を印刷する'],
  ['bottom', '常に最下行の下に横線を印刷する'], ['top', '常に最上行の上に横線を印刷する'], ['head2', '2ページ目以降も項目名を印刷する'], ['remarkfont', '資金収支計算書 備考のフォントサイズを自動調整する'], ['special', '事業活動明細書 特別増減の部を印刷する'],
];
export const DEFAULT_PRINT: PrintCommon = {
  depth: '細々区分まで印刷', lineGap: '上・下空き', gapSize: '2mm', perPage: 6, twoLineNames: false, autoFontHeader: true,
  items: Object.fromEntries(PRINT_ITEMS.map(([k]) => [k, ['zero', 'shade', 'corp', 'autofont', 'page', 'date'].includes(k)])),
  offsetX: 0, offsetY: 0, widthName: 60, widthAmount: 28, fontHeader: 'Noto Sans JP 11pt', fontName: 'Noto Sans JP 9pt', fontAmount: 'Noto Sans JP 9pt',
  fontHeaderItem: 'Noto Sans JP 9pt', fontRemark: 'Noto Sans JP 9pt', inner: DEFAULT_INNER_FORMAT,
  stamps: ['理事長', '園長', '事務長', ''], footnotes: {},
  pageStart: 1, unitRemarks: {}, forms: {},
};

/* ---------- 定型仕訳・自動按分 ---------- */
export interface TemplateLine { kari: string; kashi: string; tekiyo: string; amount: string; gyosha?: string; /** 入力予備１・２（確認メモ #292） */ spare1?: string; spare2?: string; /** 消費税コード（貸借それぞれ。空は科目からの既定。確認メモ #292） */ kariTax?: string; kashiTax?: string; /** 振替伝票式：行の借方金額・貸方金額（確認メモ #293。amount は借方金額と同じ） */ kariAmount?: string; kashiAmount?: string }
/** 連続定型のページ（1 ページ＝伝票 1 枚。確認メモ #291） */
export interface TemplatePage { lines: TemplateLine[]; /** 伝票画面で登録の対象にするか（未指定は有効）。伝票画面の連続定型で切り替えて保存できる */ enabled?: boolean }
/** 連続定型。1 つの定型に複数のページ（伝票）を持つ（確認メモ #291）。lines は全ページの行をつなげたもの（一覧の表示用。pages がない古いデータは lines を 1 ページとして読む） */
export interface JournalTemplate { id: string; name: string; form: '単一式' | '伝票式' | '振替伝票式' | '振替単一式'; lines: TemplateLine[]; pages?: TemplatePage[]; /** 古いデータの有効／無効（確認メモ #202）。いまはページごとに持つ */ enabled?: boolean }

/** 定型のページを返す。pages がない古いデータは、lines を 1 ページにする（単一式は 1 行＝1 ページ） */
export function templatePages(t: JournalTemplate): TemplatePage[] {
  if (t.pages) return t.pages;
  if (t.form === '単一式') return t.lines.map((l) => ({ lines: [l], enabled: t.enabled }));
  return [{ lines: t.lines, enabled: t.enabled }];
}
/** ページを差し替えた定型（lines も合わせる） */
export const withPages = (t: JournalTemplate, pages: TemplatePage[]): JournalTemplate => ({ ...t, pages, lines: pages.flatMap((p) => p.lines), enabled: undefined });
/** 以前の自動按分の行（1 行＝伝票 1 枚）。読み込みの互換だけに使う */
export interface AllocationLine { division: string; kari: string; kashi: string; tekiyo: string; rate: number; mode: '％' | '分数' | '残り'; }
/** 金額欄に適用する按分率（現行の「按分率設定」。確認メモ #295）
 *  ％＝パーセントで指定、分数＝分子／分母で指定、残り＝残りの按分率を適用する、按分元金＝入力される按分元金（総金額）をそのまま適用する */
export type AllocMode = '％' | '分数' | '残り' | '按分元金';
export interface AllocShare { mode: AllocMode; rate: number; num?: number; den?: number }
/** 伝票の明細 1 行。振替の 2 形式は借方・貸方それぞれに按分率を持つ（kashiShare がなければ借方と同じ率） */
export interface AllocationEntry { kari: string; kashi: string; tekiyo: string; gyosha?: string; share: AllocShare; kashiShare?: AllocShare }
/** 伝票 1 枚（ページ）。伝票ごとに伝票入力区分を選べる */
export interface AllocationPage { division: string; entries: AllocationEntry[] }
export interface AllocationTemplate { id: string; name: string; form: JournalTemplate['form']; rounding: '切り捨て' | '四捨五入' | '切り上げ'; /** 以前の形式（読み込みの互換） */ lines: AllocationLine[]; pages?: AllocationPage[] }
/** 自動按分の伝票の上限（現行「50枚を超えて伝票登録はできません。」） */
export const MAX_ALLOCATION_PAGES = 50;
export const isTransferForm = (f: JournalTemplate['form']) => f === '振替伝票式' || f === '振替単一式';
/** 自動按分仕訳の伝票（ページ）。以前の形式は 1 行を伝票 1 枚にする */
export function allocationPages(t: AllocationTemplate): AllocationPage[] {
  if (t.pages) return t.pages;
  return t.lines.map((l) => ({ division: l.division, entries: [{ kari: l.kari, kashi: l.kashi, tekiyo: l.tekiyo, share: l.mode === '分数' ? { mode: '分数', rate: l.rate, num: l.rate, den: 100 } : { mode: l.mode, rate: l.rate } }] }));
}
/** 按分率をパーセントにした値 */
export const sharePct = (s: AllocShare) => (s.mode === '分数' ? (s.den ? ((s.num ?? 0) / s.den) * 100 : 0) : s.mode === '％' ? s.rate : 0);
export const shareText = (s: AllocShare) => (s.mode === '残り' ? '残り' : s.mode === '按分元金' ? '按分元金' : s.mode === '分数' ? `${s.num ?? 0}/${s.den ?? 0}` : `${s.rate}%`);
/** 行の借方（side 0）・貸方（side 1）に適用する按分率。科目がない側は null（振替の 2 形式だけ。ほかの形式は貸方も借方と同じ金額） */
export function entryShare(t: AllocationTemplate, e: AllocationEntry, side: 0 | 1): AllocShare | null {
  if (!isTransferForm(t.form)) return e.share;
  if (side === 0) return e.kari ? e.share : null;
  return e.kashi ? e.kashiShare ?? e.share : null;
}
export interface AllocatedRow { kari: string; kashi: string; tekiyo: string; gyosha?: string; amount: number; kashiAmount: number; note: string; kashiNote: string }
export interface AllocatedVoucher { division: string; rows: AllocatedRow[] }
/** 自動按分の実行。総金額を、借方・貸方それぞれ伝票の順・行の順に按分率で分ける。
 *  按分の並びの最後（最後の伝票、振替伝票では最終行）は残りを適用し、合計が総金額と一致するようにする */
export function allocate(t: AllocationTemplate, total: number): AllocatedVoucher[] {
  const round = (v: number) => (t.rounding === '切り捨て' ? Math.floor(v) : t.rounding === '切り上げ' ? Math.ceil(v) : Math.round(v));
  const pages = allocationPages(t);
  const res = pages.map((p) => p.entries.map(() => [{ amt: 0, note: '' }, { amt: 0, note: '' }]));
  const sides: (0 | 1)[] = isTransferForm(t.form) ? [0, 1] : [0];
  for (const side of sides) {
    const seq: [number, number, AllocShare][] = [];
    pages.forEach((p, pi) => p.entries.forEach((e, ei) => {
      const sh = entryShare(t, e, side);
      if (!sh) return;
      if (sh.mode === '按分元金') res[pi][ei][side] = { amt: total, note: '按分元金' };
      else seq.push([pi, ei, sh]);
    }));
    let used = 0;
    let usedPct = 0;
    seq.forEach(([pi, ei, sh], k) => {
      const last = k === seq.length - 1 || sh.mode === '残り';
      const pct = last ? Math.max(0, 100 - usedPct) : sharePct(sh);
      const amt = last ? total - used : round((total * pct) / 100);
      used += amt; usedPct += pct;
      res[pi][ei][side] = { amt, note: `${last ? '按分残' : '按分率'} ${pct.toFixed(2)}%` };
    });
  }
  return pages.map((p, pi) => ({
    division: p.division,
    rows: p.entries.map((e, ei) => {
      const [d, c] = res[pi][ei];
      const cr = sides.length === 2 ? c : d;
      return { kari: e.kari, kashi: e.kashi, tekiyo: e.tekiyo, gyosha: e.gyosha, amount: d.amt, kashiAmount: cr.amt, note: d.note, kashiNote: cr.note };
    }),
  }));
}
/** 登録できない理由（なければ空）。現行の入力チェックの文言にそろえる（確認メモ #295） */
export function allocationError(t: AllocationTemplate): string {
  if (!t.name.trim()) return '自動按分仕訳の名称を入力してください';
  const pages = allocationPages(t);
  const transfer = isTransferForm(t.form);
  if (pages.length === 0) return '伝票がありません。「伝票追加」で伝票を追加してください';
  if (pages.length > MAX_ALLOCATION_PAGES) return `${MAX_ALLOCATION_PAGES}枚を超えて伝票登録はできません`;
  const badShare = (sh: AllocShare) => (sh.mode === '％' && !(sh.rate > 0)) || (sh.mode === '分数' && !((sh.num ?? 0) > 0 && (sh.den ?? 0) > 0 && (sh.num ?? 0) <= (sh.den ?? 0)));
  for (let pi = 0; pi < pages.length; pi++) {
    const p = pages[pi];
    if (!p.division) return `${pi + 1}枚目：伝票入力区分を選んでください`;
    if (p.entries.length === 0) return `${pi + 1}枚目の行が 0 行です。行を追加するか、伝票を削除してください`;
    for (let ei = 0; ei < p.entries.length; ei++) {
      const e = p.entries[ei];
      const at = `${pi + 1}枚目 ${ei + 1}行目`;
      if (transfer ? !e.kari && !e.kashi : !e.kari || !e.kashi) return `${at}：${transfer ? '借方か貸方の科目' : '借方・貸方の科目'}を選んでください`;
      if (e.kari && e.kari === e.kashi) return `${at}：借方と貸方に同じ科目は選べません`;
      for (const side of [0, 1] as const) {
        const sh = entryShare(t, e, side);
        if (sh && badShare(sh)) return `${at}：${transfer ? (side === 0 ? '借方' : '貸方') : ''}按分率が設定されていません`;
      }
    }
  }
  for (const side of (transfer ? [0, 1] : [0]) as (0 | 1)[]) {
    const seq = pages.flatMap((p) => p.entries.map((e) => entryShare(t, e, side)).filter((sh): sh is AllocShare => !!sh && sh.mode !== '按分元金'));
    const name = transfer ? (side === 0 ? '借方の' : '貸方の') : '';
    if (seq.length === 0) continue;
    if (seq.slice(0, -1).some((sh) => sh.mode === '残り')) return `${name}「残り」は、最後の伝票（振替伝票では最終行）でだけ選べます`;
    if (seq[seq.length - 1].mode !== '残り') return `最後の伝票（振替伝票では最終行）の${name}按分率は「残りの按分率を適用する」にしてください`;
    if (seq.slice(0, -1).reduce((a, sh) => a + sharePct(sh), 0) > 100) return `${name}按分率の合計が 100% を超えています`;
  }
  if (transfer) {
    // 伝票ごとに貸借が一致すること（現行「貸借それぞれの '按分率' は、一枚の伝票毎に同じ率になるように設定してください」）
    for (const total of [1000003, 999]) {
      const bad = allocate(t, total).findIndex((v) => v.rows.reduce((a, r) => a + (r.kari ? r.amount : 0), 0) !== v.rows.reduce((a, r) => a + (r.kashi ? r.kashiAmount : 0), 0));
      if (bad >= 0) return `${bad + 1}枚目：借方と貸方の金額が一致しません。貸借それぞれの按分率は、一枚の伝票ごとに同じ率になるように設定してください`;
    }
  }
  return '';
}

/** 仕訳伝票形式のサンプル（連続定型のダイアログで有効／無効を切り替えて登録する。確認メモ #202） */
const SLIP_TEMPLATES: JournalTemplate[] = ([
  // 1 つの定型に 4 ページ。保育材料のページは無効にしてある（伝票画面で有効にすると登録の対象になる。確認メモ #291）
  { id: 't5', name: '月次の支払（保育園）', form: '伝票式', lines: [], pages: [
    { lines: [{ kari: '水道光熱費（事業）', kashi: '当座預金（保育園）', tekiyo: '電気代', amount: '61000', gyosha: '東京電力' }, { kari: '水道光熱費（事業）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', amount: '26000', gyosha: '東京電力' }] },
    { lines: [{ kari: '給食費', kashi: '普通預金（保育園）', tekiyo: '給食材料', amount: '186000', gyosha: 'みどり商店' }] },
    { lines: [{ kari: '賃借料（事業）', kashi: '普通預金（保育園）', tekiyo: 'コピー機リース代', amount: '10995', gyosha: '中央リース' }] },
    { enabled: false, lines: [{ kari: '保育材料費', kashi: '普通預金（保育園）', tekiyo: '保育材料', amount: '', gyosha: '' }] },
  ] },
] as JournalTemplate[]).map((t) => (t.pages ? withPages(t, t.pages) : t));
/** 制限付きのサンプルアカウント（小口・預金・資産 担当者）の「使える機能」を、一度だけ既定に戻す（確認メモ #298）。
 *  以前の確認でユーザー設定から変えたままだと、資産 担当者でログインしても減価償却以外のメニューが出てしまうため。2 回目以降は保存した設定を使う */
const ACCESS_REV = 2;
const SAMPLE_LIMITED = ['koguchi', 'yokin', 'shisan'];
function resetSampleAccess(saved: Partial<Session> & { accessRev?: number }): Pick<Session, 'access' | 'memberAccess'> & { accessRev: number } {
  const access = { ...FULL_ACCESS, ...(saved.access ?? {}) };
  const memberAccess: Session['memberAccess'] = { ...DEFAULT_MEMBER_ACCESS, me: access, ...(saved.memberAccess ?? {}) };
  if ((saved.accessRev ?? 1) >= ACCESS_REV) return { access, memberAccess, accessRev: ACCESS_REV };
  for (const id of SAMPLE_LIMITED) memberAccess[id] = DEFAULT_MEMBER_ACCESS[id];
  const id = saved.accountId ?? 'me';
  return { access: SAMPLE_LIMITED.includes(id) ? DEFAULT_MEMBER_ACCESS[id] : access, memberAccess, accessRev: ACCESS_REV };
}
/** 保存してある定型を読み込むときの置き換え。ページのない以前のサンプル（t5〜t7）は、ページを持つ新しいサンプルに差し替える（確認メモ #291） */
function migrateTemplates(ts: JournalTemplate[]): JournalTemplate[] {
  const oldSample = ts.some((t) => t.id === 't5' && !t.pages);
  const kept = oldSample ? ts.filter((t) => !['t5', 't6', 't7'].includes(t.id)) : ts;
  return kept.some((t) => t.form === '伝票式') ? kept : [...kept, ...SLIP_TEMPLATES];
}
export const DEFAULT_TEMPLATES: JournalTemplate[] = [
  { id: 't1', name: '電話料金', form: '単一式', lines: [{ kari: '通信運搬費', kashi: '普通預金（保育園）', tekiyo: '電話料金', amount: '', gyosha: 'ＮＴＴ東日本' }] },
  { id: 't2', name: '給与支給（月次）', form: '振替伝票式', lines: [{ kari: '職員俸給', kashi: '普通預金（保育園）', tekiyo: '職員俸給', amount: '' }, { kari: '特殊業務手当', kashi: '普通預金（保育園）', tekiyo: '特殊業務手当', amount: '' }, { kari: '通勤手当', kashi: '普通預金（保育園）', tekiyo: '通勤手当', amount: '' }] },
  { id: 't3', name: '副食費 保護者より', form: '単一式', lines: [{ kari: '現金（収入）', kashi: 'その他の利用料収益', tekiyo: '副食費ー保護者より', amount: '4500', gyosha: '保護者' }] },
  { id: 't4', name: 'コピー機リース', form: '単一式', lines: [{ kari: '賃借料（事業）', kashi: '普通預金（保育園）', tekiyo: 'コピー機リース代', amount: '10995', gyosha: '中央リース' }] },
  ...SLIP_TEMPLATES,
];
const pct = (rate: number): AllocShare => ({ mode: '％', rate });
const REST: AllocShare = { mode: '残り', rate: 0 };
export const DEFAULT_ALLOCATIONS: AllocationTemplate[] = [
  { id: 'a1', name: '水道代（事務費／事業費）', form: '単一式', rounding: '切り捨て', lines: [], pages: [
    { division: '001 本部', entries: [{ kari: '水道光熱費（事務）', kashi: '普通預金（保育園）', tekiyo: '水道代', share: pct(30) }] },
    { division: '002 保育事業', entries: [{ kari: '水道光熱費（事業）', kashi: '普通預金（保育園）', tekiyo: '水道代', share: REST }] },
  ] },
  { id: 'a2', name: 'ガス代（本部／保育園／一時預かり）', form: '単一式', rounding: '四捨五入', lines: [], pages: [
    { division: '001 本部', entries: [{ kari: '水道光熱費（事務）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', share: pct(10) }] },
    { division: '002 保育事業', entries: [{ kari: '水道光熱費（事業）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', share: pct(80) }] },
    { division: '004 一時預かり', entries: [{ kari: '水道光熱費（事業）', kashi: '当座預金（保育園）', tekiyo: 'ガス代', share: REST }] },
  ] },
  // 振替伝票形式：1 枚の伝票の中で、借方を事務費・事業費に分け、貸方は按分元金のまま（確認メモ #295）
  { id: 'a3', name: '電気代（振替・事務費／事業費）', form: '振替伝票式', rounding: '四捨五入', lines: [], pages: [
    { division: '002 保育事業', entries: [
      { kari: '水道光熱費（事務）', kashi: '普通預金（保育園）', tekiyo: '電気代', gyosha: '東京電力', share: pct(20), kashiShare: { mode: '按分元金', rate: 0 } },
      { kari: '水道光熱費（事業）', kashi: '', tekiyo: '電気代', gyosha: '東京電力', share: REST },
    ] },
  ] },
];
/** 保存してある自動按分仕訳を読み込むときの置き換え。振替形式のサンプルがなければ足す（確認メモ #295） */
function migrateAllocations(list: AllocationTemplate[]): AllocationTemplate[] {
  return list.some((a) => a.id === 'a3' || isTransferForm(a.form)) ? list : [...list, DEFAULT_ALLOCATIONS[2]];
}
/** 特殊金額入力の按分率（集合区分で起動したときの区分別配分） */
export const DEFAULT_SPECIAL_RATES: { division: string; rate: number }[] = [{ division: '001 本部', rate: 20 }, { division: '002 保育事業', rate: 60 }, { division: '003 子育て支援', rate: 10 }, { division: '004 一時預かり', rate: 10 }];
/** 特殊金額入力の按分率（科目ごと。確認メモ #179）：科目ごとに各区分の按分率と、端数の加算先区分を持つ。設定のない科目は共通の按分率（specialRates）を使う */
export interface SpecialRateSetting { account: string; rates: { division: string; rate: number }[]; /** 端数の加算先区分 */ roundTo: string }
export const DEFAULT_SPECIAL_RATES_BY_ACCOUNT: SpecialRateSetting[] = [
  { account: '水道光熱費（事業）', rates: [{ division: '001 本部', rate: 10 }, { division: '002 保育事業', rate: 70 }, { division: '003 子育て支援', rate: 10 }, { division: '004 一時預かり', rate: 10 }], roundTo: '002 保育事業' },
  { account: '通信運搬費', rates: [{ division: '001 本部', rate: 30 }, { division: '002 保育事業', rate: 50 }, { division: '003 子育て支援', rate: 10 }, { division: '004 一時預かり', rate: 10 }], roundTo: '001 本部' },
  { account: '賃借料（事業）', rates: [{ division: '001 本部', rate: 0 }, { division: '002 保育事業', rate: 80 }, { division: '003 子育て支援', rate: 10 }, { division: '004 一時預かり', rate: 10 }], roundTo: '002 保育事業' },
];

/* ---------- 消費税の処理方式（確認メモ #175。旧 消費税動作環境） ---------- */
export const TAX_MODES = ['通常モード', '簡易課税方式', '本則課税の一括比例配分方式', '本則課税の個別対応方式'] as const;
export type TaxMode = (typeof TAX_MODES)[number];
/** 伝票入力に税区分・税額の欄を出す方式か（通常モード＝消費税の処理をしないので出さない） */
export const taxModeUsesTax = (m: TaxMode) => m !== '通常モード';

/* ---------- セッション本体 ---------- */
export interface Session {
  division: string;        // 表示中の伝票入力区分（例 '002 保育事業'）
  divisionPath: string[];  // パンくず（法人 › 事業区分 › 拠点区分 › サービス区分）
  fiscalYear: string;      // 例 '令和8年度'
  currentYear: string;     // 本来の当年度
  tree: DivisionNode;
  /** 区分ツリーの見本の版（TREE_REV） */
  treeRev?: number;
  merges: { name: string; members: string[] }[];
  favorites: string[];
  env: EnvSettings;
  input: InputSettings;
  print: PrintCommon;
  templates: JournalTemplate[];
  allocations: AllocationTemplate[];
  specialRates: { division: string; rate: number }[];
  /** 推移・試算表からの元帳ドリルダウン */
  ledgerTarget: { account: string; month: string; /** 呼び出し元の画面（戻り導線に使う。例 '月次試算'） */ from?: string } | null;
  /** 日次調査の「伝票表示」から日記帳へ（不一致が見つかった日・呼び出し元を引き継ぐ） */
  journalTarget: { month: string; day: number; from: string; /** 日記帳で印を付ける伝票の id（日次調査：不一致の原因になっている伝票。確認メモ #127） */ markIds?: number[]; /** 印の補足（例：'差額 18,000'） */ markNote?: string } | null;
  /** 決算チェック設定（項目番号→有効） */
  auditEnabled: Record<number, boolean>;
  /** 法人決算チェック設定（法人全体。項目番号→有効）。区分ごとの設定とは別に保持する（確認メモ #124） */
  auditCorpEnabled: Record<number, boolean>;
  /** 法人情報（部門情報の変更）：データ開始年月日（西暦8桁）・法人税納税の有無 */
  corpStartDate: string;
  corpTax: string;
  /** 利用者の権限（依頼書 2.1-7）。参照のみ＝伝票の入力・訂正・削除・入換ができない */
  role: '入力可' | '参照のみ';
  /** 起動直後（区分選択後）に表示する画面（依頼書 5.2.2） */
  startScreen: 'ホーム' | '伝票入力';
  /** ホーム（ダッシュボード）に表示するメニュー。利用者が「表示させるメニューの編集」で切り替える */
  homeSections: Record<HomeSectionKey, boolean>;
  /** 消費税対応（法人単位。依頼書 2.4：振替伝票形式・振替単一形式に税区分・税額の欄を出す）。事業者 › 会計方針で切替 */
  taxEntry: boolean;
  /** 消費税の処理方式（法人単位。確認メモ #175）。変更は setTaxMode() で行い、taxEntry（税区分・税額の欄を出すか）も同時に更新する */
  taxMode: TaxMode;
  /** 特殊金額入力の按分率（科目ごと。確認メモ #179）。引くときは specialRatesOf() を使う */
  specialRatesByAccount: SpecialRateSetting[];
  /** 共通の按分率（specialRates。科目ごとの設定がない科目に使う）の端数の加算先区分 */
  specialRoundTo: string;
  /** 開始残高の「期中入力」を行うか（期の途中から導入する場合。確認メモ #167）。true のときだけ期中入力の3つのタブを出す */
  openingMidTerm: boolean;
  /** このアカウントで使える機能（会計本体／小口現金／預金出納／減価償却）。確認事項「小口、預金、減価について」 */
  access: Access;
  /** アカウントごとの使える機能（アカウントの id → 設定）。ユーザー設定の「アカウントごとの利用できる機能」で管理者が決める */
  memberAccess: Record<string, Access>;
  /** ログイン中のアカウント（store/access.ts の ACCOUNTS の id）。access はこのアカウントの memberAccess と同じ内容 */
  accountId: string;
  /** 補助簿（明細表）を作る科目（勘定科目の「補助簿（明細表）」タブ。印刷センターの「○○［科目名］明細表」に使う。確認メモ #361）
   *  subLedger＝伝票を印刷時に明細として指定（科目名、項目は '#'+項目名）／subBlue＝項目以下の科目を明細とする（項目名） */
  subLedger: Record<string, boolean>;
  subBlue: Record<string, boolean>;
}

const KEY = 'proto-session-v2'; // v2：区分ツリーの見直し（入力区分／親区分）に伴い保存形式を更新
/** ホーム（ダッシュボード）の表示メニュー */
export const HOME_SECTIONS = [
  // 預金残高は「推移・分析」へ（確認メモ #149）、お知らせはヘッダーのベルへ（#151）移したので、ここでは選ばない
  // 調査・チェック（仕訳数／日次調査／決算調査）は、ヘッダーの区分のボタンへ移した（確認メモ #242）
  // お気に入りメニューの枠は、機能一覧の星で登録済みが分かるようになったのでなくした（左のメニュー列の「お気に入りメニュー」は残す）
  { key: 'faq', label: 'よくある質問（FAQ）', note: '操作で迷ったときの質問と回答' },
  { key: 'banners', label: 'バナー', note: 'ご案内の画像' },
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number]['key'];
const DEFAULT_HOME_SECTIONS: Record<HomeSectionKey, boolean> = { faq: true, banners: true };

const DEFAULT: Session = {
  division: '002 保育事業', divisionPath: ['社会福祉法人 チャイルド保育園', '社会福祉事業', 'チャイルド保育園', '保育事業'],
  fiscalYear: '令和8年度', currentYear: '令和8年度', tree: DEFAULT_TREE, treeRev: TREE_REV, merges: [{ name: '合算_001（保育園＋子育て支援）', members: ['002 保育事業', '003 子育て支援'] }],
  favorites: ['単一入力', '伝票入力', '仕訳一覧', '勘定元帳', '月次試算', '日次調査'],
  env: DEFAULT_ENV, input: DEFAULT_INPUT, print: DEFAULT_PRINT, templates: DEFAULT_TEMPLATES, allocations: DEFAULT_ALLOCATIONS, specialRates: DEFAULT_SPECIAL_RATES,
  ledgerTarget: null, journalTarget: null, auditEnabled: {}, auditCorpEnabled: { 21: false, 22: false }, corpStartDate: '20240401', corpTax: '非課税',
  role: '入力可', startScreen: '伝票入力', homeSections: DEFAULT_HOME_SECTIONS, taxEntry: false,
  taxMode: '通常モード', specialRatesByAccount: DEFAULT_SPECIAL_RATES_BY_ACCOUNT, specialRoundTo: DEFAULT_SPECIAL_RATES[DEFAULT_SPECIAL_RATES.length - 1].division, openingMidTerm: false,
  access: FULL_ACCESS, memberAccess: DEFAULT_MEMBER_ACCESS, accountId: 'me', subLedger: {}, subBlue: {},
};

let state: Session = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const saved = JSON.parse(raw) as Partial<Session>;
    return { ...DEFAULT, ...saved, tree: normalizeTree((saved.treeRev ?? 1) < TREE_REV && saved.tree ? addSampleDivisions(saved.tree) : saved.tree ?? DEFAULT.tree), treeRev: TREE_REV, env: { ...DEFAULT_ENV, ...(saved.env ?? {}) }, input: { ...DEFAULT_INPUT, ...(saved.input ?? {}) }, print: { ...DEFAULT_PRINT, ...(saved.print ?? {}) }, homeSections: { ...DEFAULT_HOME_SECTIONS, ...(saved.homeSections ?? {}) }, ...resetSampleAccess(saved), ledgerTarget: null, journalTarget: null,
      // 以前の保存データ（消費税対応の On／Off だけ）には方式がないので、On は「簡易課税方式」として引き継ぐ（確認メモ #175）
      taxMode: saved.taxMode ?? (saved.taxEntry ? '簡易課税方式' : DEFAULT.taxMode),
      // 以前の保存データには仕訳伝票形式の定型がないので、サンプルを足す（確認メモ #202）
      templates: saved.templates ? migrateTemplates(saved.templates) : DEFAULT_TEMPLATES,
      allocations: saved.allocations ? migrateAllocations(saved.allocations) : DEFAULT_ALLOCATIONS };
  } catch {
    return DEFAULT;
  }
})();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getSession() { return state; }
export function setSession(patch: Partial<Session> | ((s: Session) => Partial<Session>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, ledgerTarget: null, journalTarget: null })); } catch { /* ignore */ }
  emit();
}
export function resetSession() { state = DEFAULT; try { localStorage.removeItem(KEY); } catch { /* ignore */ } emit(); }
export function useSession(): Session {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

/** 区分ツリーを平坦化（伝票入力区分のみ／すべて） */
export function flattenDivisions(node: DivisionNode, path: string[] = []): { node: DivisionNode; path: string[] }[] {
  const here = [...path, node.name];
  const out: { node: DivisionNode; path: string[] }[] = [{ node, path: here }];
  (node.children ?? []).forEach((c) => out.push(...flattenDivisions(c, here)));
  return out;
}
export const divisionLabel = (n: DivisionNode) => (n.code ? `${n.code} ${n.name}` : n.name);
/** 入力区分は配下に区分を持てない（確認メモ #69／#70）。以前の保存データで配下を持つ入力区分は親区分に直す */
export function normalizeTree(n: DivisionNode): DivisionNode {
  const children = (n.children ?? []).map(normalizeTree);
  return { ...n, entry: n.entry && children.length === 0 ? true : undefined, children };
}

/* ---------- 起動区分の種類と権限（依頼書 2.1） ---------- */
/** 入力区分＝ツリー末端の伝票入力区分／親区分＝それらを集計する区分（法人・事業区分・拠点など）／合算区分＝任意の合算 */
export type StartKind = '入力区分' | '親区分' | '合算区分';
export function startKindOf(s: Session): StartKind {
  if (s.merges.some((m) => m.name === s.division)) return '合算区分';
  const hit = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node;
  if (!hit) return '入力区分';
  return hit.entry ? '入力区分' : '親区分';
}
/** 伝票の入力・訂正・削除ができるか（参照のみ権限、親区分・合算区分での起動では不可） */
export const canEdit = (s: Session) => s.role === '入力可' && startKindOf(s) === '入力区分';
/** 参照のみ権限か（操作できないボタンは無効表示ではなく非表示にする。区分の都合で使えないときは無効表示＋理由） */
export const isViewOnly = (s: Session) => s.role !== '入力可';
/** 一覧の表示順入換ができるか（参照のみ権限・合算区分では不可） */
export const canReorder = (s: Session) => s.role === '入力可' && startKindOf(s) !== '合算区分';
/** 使えない理由（ツールチップ用）。使えるときは空文字 */
export const editBlockReason = (s: Session) => (s.role !== '入力可' ? '参照のみの権限のため操作できません' : startKindOf(s) === '合算区分' ? '合算区分で起動中のため操作できません（内訳の確認用）' : startKindOf(s) === '親区分' ? '親区分で起動中のため操作できません（伝票は入力区分で登録します）' : '');

/** 付箋の表示名：「赤（要確認）」のように色と意味を並べる。意味は環境設定の「付箋の色の意味」で変更できる */
/** 付箋の表示名：色＋（意味）。意味は環境設定で任意に付ける（既定は空。確認メモ #49：利用者が自由に使い分けているため） */
export const fusenLabel = (f: string): string => { if (!f) return 'なし'; const n = getSession().env.fusenNames[f as '赤' | '青' | '黄' | '緑'] ?? ''; return n ? `${f}（${n}）` : f; };

/* ---------- 消費税の処理方式の変更（確認メモ #175） ---------- */
/** 消費税の処理方式を変える。税区分・税額の欄を出すか（taxEntry）も方式に合わせて同時に更新する */
export function setTaxMode(m: TaxMode) { setSession({ taxMode: m, taxEntry: taxModeUsesTax(m) }); }

/* ---------- 特殊金額入力の按分率（科目ごと。確認メモ #179） ---------- */
/** 科目名から、特殊金額入力の按分率と端数の加算先区分を引く。
 *  科目ごとの設定があればそれを、なければ共通の按分率（specialRates）と共通の端数の加算先を返す。
 *  区分の並びは共通の按分率に合わせる（科目ごとの設定に無い区分は 0%）。byAccount＝科目ごとの設定が見つかったか */
export function specialRatesOf(s: Pick<Session, 'specialRates' | 'specialRatesByAccount' | 'specialRoundTo'>, account: string): { rates: { division: string; rate: number }[]; roundTo: string; byAccount: boolean } {
  const hit = account ? (s.specialRatesByAccount ?? []).find((x) => x.account === account) : undefined;
  const rates = hit ? s.specialRates.map((r) => ({ division: r.division, rate: hit.rates.find((x) => x.division === r.division)?.rate ?? 0 })) : s.specialRates;
  const want = hit ? hit.roundTo : s.specialRoundTo;
  const roundTo = rates.some((r) => r.division === want) ? want : rates[rates.length - 1]?.division ?? '';
  return { rates, roundTo, byAccount: !!hit };
}
/** 金額を科目の按分率で区分に配分する（区分ごとに円未満を切り捨て、端数は加算先の区分に足す。合計は必ず total に一致する） */
export function splitSpecialAmount(s: Pick<Session, 'specialRates' | 'specialRatesByAccount' | 'specialRoundTo'>, account: string, total: number): { division: string; rate: number; amount: number }[] {
  const { rates, roundTo } = specialRatesOf(s, account);
  const parts = rates.map((r) => ({ ...r, amount: Math.trunc((total * r.rate) / 100) }));
  const rest = total - parts.reduce((a, p) => a + p.amount, 0);
  return parts.map((p) => (p.division === roundTo ? { ...p, amount: p.amount + rest } : p));
}
