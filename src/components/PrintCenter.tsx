// 帳票の印刷（提案C／依頼書 5.1.1・5.5.1・6.3・6.5）
//   印刷の流れは「1. 詳細設定 → 2. 出力先 → 3. 印刷／プレビュー」に統一（確認事項「印刷の画面遷移の統一」。枠は PrintSteps と共通）。
//   帳票選択は印刷画面に入れない。帳票は印刷画面を開く前（各画面の「印刷 ▾」、帳票の印刷の一覧）で決める。期間・区分は詳細設定の先頭に置く。
//   詳細設定は影響範囲で分けて表示する：
//     ① この帳票の詳細設定（帳票個別。現行の画面の枠ごとにチェック・ラジオ・選択を描き分ける）
//     ② 決算書 共通印刷設定から使う設定（共通印刷設定＝有 の帳票だけ。「共通の印刷設定を反映」「決算書 共通印刷設定を開く」を置く。確認メモ #238）
//     ③ 動作環境から引き継ぐ設定（全区分共通／区分ごと。確認のみ）
//   帳票の一覧（中区分 › 小区分 › 帳票）は printCatalog.ts、画面は PrintCenterPage.tsx。
//   各帳票画面には PrintButton を置き、画面内から同じ流れを開く（5.1.1）。
//   金額は動作環境の金額書式（桁区切り・負数の表記と色）で表示し、0円行は「0データを表示しない」に従って省く（6.5）。

import { useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FISCAL_MONTHS, FiscalMonthTabs } from './FiscalMonthTabs';
import { monthsIn, type Period } from '../lib/period';
import type { MonthFilter } from '../types';
import { Modal } from './Modal';
import { TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, IconButton, Notice, SettingsShell, Toggle, btn, card, cardHead, input, lbl, numInput } from './ui';
import { ExportDialog, runExport, type ExportKind, type ExportSpec } from './ExportDialog';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { TargetCombo } from './TargetCombo';
import { AreaPickDialog, DisplaySettingDialog, FormatDialog, InnerFormatDialog, RemarkDialog, STD_INNER_PRINT, formatSummary, stdFormat, type FormatSpec, type InnerPrintFormat, type PrintFormat } from './PrintDetailDialogs';
import { PrintSteps, type OutKind } from './PrintSteps';
import { LoadDivisionSettings } from './DivisionSettingsLoad';
import { COMMON_LINK, FORM_GROUPS, REPORTS, formEnabled, omittable, type DetailItem, type DetailSection, type DetailValue, type ReportDef } from './printCatalog';
import { goScreen } from '../lib/nav';
import { ACCOUNT_META } from '../lib/accounts';
import { ACCOUNTS, displayName } from '../data';
import { DEFAULT_INNER_FORMAT, PRINT_ITEMS, divisionLabel, flattenDivisions, fusenLabel, setSession, startKindOf, useSession, type EnvSettings, type InnerFormat, type PrintCommon, type Session } from '../store/session';

export { CATS, FORM_GROUPS, REPORTS, formEnabled } from './printCatalog';
export type { ReportDef } from './printCatalog';

/** 印刷・出力に使う表データ（各画面の実データ、または帳票ごとのサンプル） */
export interface TableData { header: string[]; rows: (string | number)[][]; }
/** 帳票名からサンプルの表（科目／当月／累計）を作る。本番では各帳票の集計結果が入る。
 *  0円行・負数の表示を確認できるよう、5行目を 0 円、10行目の当月を負数にしている */
export function sampleReportData(name: string, n = 14): TableData {
  const names = ACCOUNTS.flatMap((g) => g.items);
  let h = 7;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rows: (string | number)[][] = names.slice(0, n).map((acct, i) => {
    if (i === 4) return [acct, 0, 0];
    const cur = ((h + i * 7919) % 900000) + 10000;
    const total = cur * 5 + ((h + i * 131) % 50000);
    return i === 9 ? [acct, -Math.round(cur / 10), total] : [acct, cur, total];
  });
  rows.push(['合計', rows.reduce((a, r) => a + Number(r[1]), 0), rows.reduce((a, r) => a + Number(r[2]), 0)]);
  return { header: ['科目', '当月', '累計'], rows };
}
/** 出力先（OUTPUTS）→ 出力種別。画面プレビューは null */
export const outputKind = (output: string): ExportKind | null => (output === OUTPUTS[0] ? 'print' : output === OUTPUTS[2] ? 'csv' : output === OUTPUTS[3] ? 'excel' : output === OUTPUTS[4] ? 'pdf' : null);

/* ---------------- 金額の表示（依頼書 6.5） ---------------- */
type AmountEnv = Pick<EnvSettings, 'thousandsSep' | 'negativeSign' | 'negativeColor'> & Partial<Pick<EnvSettings, 'negativePos'>>;
/** 動作環境の金額書式（桁区切り・負数の記号と位置）で金額を文字列にする */
export function formatAmount(n: number, env: AmountEnv): string {
  const abs = Math.abs(n).toLocaleString('ja-JP');
  const body = env.thousandsSep === 'なし' ? abs.replace(/,/g, '') : env.thousandsSep === '点線' ? abs.replace(/,/g, '.') : abs;
  if (n >= 0) return body;
  return env.negativePos === '後' ? body + env.negativeSign : env.negativeSign + body;
}
/** 負数の表示色（動作環境：黒／赤） */
export const amountColor = (n: number, env: AmountEnv): string | undefined => (n < 0 && env.negativeColor === '赤' ? '#c0392b' : undefined);
/** 0円行（金額の列がすべて 0 の行）を省く。省いた行数も返す */
export function dropZeroRows(data: TableData): { data: TableData; dropped: number } {
  const rows = data.rows.filter((r) => { const nums = r.filter((c): c is number => typeof c === 'number'); return !(nums.length > 0 && nums.every((x) => x === 0)); });
  return { data: { header: data.header, rows }, dropped: data.rows.length - rows.length };
}

/* ---------------- 設定の影響範囲バッジ（依頼書 5.5.1／6.3） ---------------- */
export type ScopeKind = '帳票個別' | '決算書共通' | '全区分共通' | '区分ごと';
const SCOPE_STYLE: Record<ScopeKind, { bg: string; fg: string; bd: string; hint: string }> = {
  帳票個別: { bg: '#e8f0fb', fg: '#2c5f9e', bd: '#c9d9ec', hint: 'この帳票の印刷だけに影響します' },
  決算書共通: { bg: '#f1eafb', fg: '#6b3fa0', bd: '#dccdf0', hint: '決算書（共通印刷設定＝有 の帳票）の印刷に影響します' },
  全区分共通: { bg: '#e4f1f0', fg: '#1f6f6b', bd: '#bfdcd9', hint: 'システム全体（すべての区分）に影響します' },
  区分ごと: { bg: '#fff3dc', fg: '#8a5a00', bd: '#f0dcae', hint: '起動中の区分だけに影響します' },
};
export function ScopeBadge({ kind, label }: { kind: ScopeKind; label?: string }) {
  const c = SCOPE_STYLE[kind];
  return <span title={c.hint} style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap', lineHeight: 1.5 }}>{label ?? kind}</span>;
}
/** 影響範囲ごとのまとまり（見出しにバッジと説明を付けた枠） */
export function ScopeBlock({ kind, title, desc, right, children, toggle, descBelow }: { kind?: ScopeKind; title: string; desc?: ReactNode; right?: ReactNode; /** 説明文を見出しの下の行に置き、right を見出しと同じ行の右端に出す */ descBelow?: boolean; children: ReactNode; /** アコーディオン：見出し全体を押すと開閉。右端に「変更する ▾／閉じる ▴」を出す */ toggle?: { open: boolean; onToggle: () => void; openLabel?: string; closeLabel?: string } }) {
  const c = kind ? SCOPE_STYLE[kind] : { bg: '#f3f6f9', bd: '#dde4ea' };
  const fg = kind ? SCOPE_STYLE[kind].fg : '#3d4a56';
  const head = (
    <>
      {toggle && <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 5, background: '#fff', border: '1px solid ' + c.bd, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: fg, transition: 'transform .18s', transform: toggle.open ? 'rotate(90deg)' : 'none' }}>▶</span>}
      {kind && <ScopeBadge kind={kind} />}
      <b style={{ fontSize: 14 }}>{title}</b>
      {desc && <span style={{ fontSize: 12, color: '#5b6773', ...(descBelow ? { order: 2, flexBasis: '100%' } : {}) }}>{desc}</span>}
      {(right || toggle) && (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {right}
          {toggle && <span data-scope-toggle aria-hidden style={{ ...btn(fg, !toggle.open, true), display: 'inline-flex', alignItems: 'center', gap: 4 }}>{toggle.open ? (toggle.closeLabel ?? '閉じる') : (toggle.openLabel ?? '変更する')}<span style={{ fontSize: 12 }}>{toggle.open ? '▴' : '▾'}</span></span>}
        </span>
      )}
    </>
  );
  return (
    <section data-scope={kind} style={{ border: '1px solid ' + c.bd, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {toggle ? (
        <button type="button" aria-expanded={toggle.open} onClick={toggle.onToggle} title={toggle.open ? 'このブロックを閉じます' : 'このブロックを開いて設定を変更します'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: c.bg, flexWrap: 'wrap', width: '100%', border: 'none', borderBottom: toggle.open ? '1px solid ' + c.bd : 'none', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer' }}>
          {head}
        </button>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: c.bg, flexWrap: 'wrap' }}>
        {head}
      </div>
      )}
      <div style={{ padding: 12 }}>{children}</div>
    </section>
  );
}

export const OUTPUTS = ['プリンターから印刷する', '画面へプレビューする', 'エクセル互換ファイル（CSV）へ出力する', 'Excelファイル出力', 'PDFファイル出力'];

/** 一覧にない画面専用の帳票の詳細設定 */
export const SCREEN_DETAIL: DetailSection[] = [{ title: '印刷項目', items: [{ k: 'title', t: 'check', label: 'タイトルを印刷する', on: true }, { k: 'area', t: 'check', label: '区分名を印刷する', on: true }] }];
/** 画面の帳票名から印刷対象の帳票を探す。一覧にない名前は、その画面専用の帳票として扱う */
export function findReport(name: string): ReportDef {
  const exact = REPORTS.find((r) => r.name === name);
  if (exact) return exact;
  const part = REPORTS.find((r) => r.name.includes(name) || name.includes(r.name.replace(/（.*$/, '')));
  if (part) return part;
  const KEY: [RegExp, string][] = [[/日記帳|仕訳一覧/, 'j1'], [/資金元帳/, 'l2'], [/取引先元帳|取引先別支払/, 'l3'], [/元帳/, 'l1'], [/試算/, 't1'], [/予算/, 'bm1'], [/決算/, 'c1-1'], [/推移/, 'a5']];
  const hit = KEY.find(([re]) => re.test(name));
  const base = hit ? REPORTS.find((r) => r.id === hit[1]) : undefined;
  return { id: 'screen:' + name, name, cat: base?.cat ?? '画面の帳票', sub: base?.sub, scope: base?.scope, common: base?.common, detail: base?.detail ?? SCREEN_DETAIL };
}

/* ---------------- 印刷の流れ（1つのパネルで完結） ---------------- */
/** 出力先（PrintSteps）と、帳票ごとに覚えておく出力の文言（OUTPUTS）の対応 */
const OUT_OF: Record<OutKind, string> = { print: OUTPUTS[0], pdf: OUTPUTS[4], excel: OUTPUTS[3], csv: OUTPUTS[2] };
const kindOfOut = (o: string): OutKind => (o === OUTPUTS[4] ? 'pdf' : o === OUTPUTS[3] ? 'excel' : o === OUTPUTS[2] ? 'csv' : 'print');
const FONTS = ['Noto Sans JP 9pt', 'Noto Sans JP 10pt', 'Noto Sans JP 11pt', 'Noto Serif JP 10pt', 'ＭＳ 明朝 10pt', 'ＭＳ ゴシック 10pt'];
/** 備考・摘要設定を保持する単位（依頼書 3.2：1つには統合しない） */
export const REMARK_UNITS = ['法人の決算書', '拠点の決算書', 'サービス区分の資金収支計算書'];
function remarkUnitOf(s: Session): string {
  const k = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node.kind;
  return k === '法人' || k === '事業区分' ? REMARK_UNITS[0] : k === 'サービス区分' || k === '小サービス区分' ? REMARK_UNITS[2] : REMARK_UNITS[1];
}
const usesRemark = (r: ReportDef) => r.cat === '決算書' || r.cat === '準決算書' || r.cat === '予算' || /資金収支計算書/.test(r.name);
const itemsOf = (r: ReportDef): DetailItem[] => r.detail.flatMap((sec) => sec.items);
const usesDepth = (r: ReportDef) => itemsOf(r).some((it) => it.k === 'depth');


const eraYear = (fy: string) => parseInt(fy.replace(/[^0-9]/g, ''), 10) || 8;
const monthNo = (m: string) => (m === '決' ? 3 : Number(m));
const monthYear = (fy: number, m: string) => (monthNo(m) <= 3 ? fy + 1 : fy);
const monthStart = (fy: number, m: string) => `令和${monthYear(fy, m)}年${monthNo(m)}月1日`;
const monthEnd = (fy: number, m: string) => `令和${monthYear(fy, m)}年${monthNo(m)}月${new Date(2018 + monthYear(fy, m), monthNo(m), 0).getDate()}日`;

interface FlowPrefs {
  months: string[]; from: string; to: string; range: string; scope: string; target: string;
  checks: { check: boolean; red: boolean; blue: boolean; yellow: boolean; green: boolean };
  output: string; zeroHide: boolean; title: string; detail: Record<string, DetailValue>;
  /** 月タブ（日記帳と同じ。全月・ドラッグで範囲。確認メモ #333）：選んでいる月（null＝全月）と範囲 */
  mCur?: MonthFilter; mRange?: Period | null;
  /** 科目指定（取引先元帳は取引先指定）の開始・終了（確認メモ #323・#327） */
  scopeFrom?: string; scopeTo?: string;
  /** 捺印欄に印刷する名前（最大4欄。確認メモ #310） */
  stamps?: string[];
  /** 印刷書式（印刷幅とフォント。確認メモ #314・#339・#342） */
  fmt?: PrintFormat;
  /** 予算内訳表：内訳書－印刷書式・表示区分（確認メモ #345・#346） */
  innerFmt?: InnerPrintFormat; areas?: string[];
  /** 予算書：科目ごとの摘要（確認メモ #343） */
  remarks?: Record<string, string>;
  /** 科目毎の表示設定（印刷位置の「科目毎に指定」。確認メモ #338） */
  disp?: Record<string, boolean>;
}
/** 印刷書式の中身（現行「印刷書式設定」。帳票ごとに印刷幅の有無と初期値、フォントの行が違う） */
function formatSpecOf(r: ReportDef): FormatSpec | null {
  if (r.id === 'j1') return { rows: ['name', 'amount', 'remark'] };
  if (r.cat === '試算表') return { widths: ['49', '22'], rows: ['name', 'amount'] };
  if (r.id === 'bm1') return { widths: ['70', '26'], rows: ['name', 'amount'] };
  if (r.cat === '予算' && r.budget && !r.rangeSumOnly) return { widths: ['60', '25'], rows: ['name', 'amount', 'remark'] };
  return null;
}
/** 捺印欄の欄の数：仕訳伝票（伝票式）は 5 欄、そのほかは 4 欄（確認メモ #322） */
const stampMaxOf = (r: ReportDef) => (r.id === 'j2' ? 5 : 4);
/** 捺印欄の初期値：伝票・元帳は最後の欄が「担当者」（現行どおり）。仕訳日記帳などは空 */
const stampDefault = (r: ReportDef): string[] => {
  const n = stampMaxOf(r);
  const tanto = r.id !== 'j1';
  return Array.from({ length: n }, (_, i) => (tanto && i === n - 1 ? '担当者' : ''));
};
/** 伝票は「捺印欄を印刷する」の項目がなく、［捺印欄］ボタンだけを置く */
const stampButtonOnly = (r: ReportDef) => r.id === 'j2' || r.id === 'j3';
/** 捺印欄 1欄の文字数（現行は 6 バイト＝全角 3 文字） */
const STAMP_LEN = 3;
/** チェック項目の右に置くボタン（捺印欄・脚注編集など）。チェックが ON のときだけ押せる */
export interface DetailButton { label: string; onClick: () => void; note?: string; title?: string; /** チェックや選択に関係なく、いつでも押せる（表示設定など） */ always?: boolean; /** 押せない（ほかの項目との連動） */ disabled?: boolean }
/** 半角1・全角2 で数えて max バイトまでに切る（現行の入力欄の文字数制限） */
function clipBytes(v: string, max: number): string {
  let n = 0, out = '';
  for (const ch of v) { n += /[ -~｡-ﾟ]/.test(ch) ? 1 : 2; if (n > max) break; out += ch; }
  return out;
}
/** 帳票ごとの印刷条件（この帳票の詳細設定）。開き直しても前回の条件を引き継ぐ */
const PREFS = new Map<string, FlowPrefs>();
/** 共通印刷設定＝有 の帳票：決算書 共通印刷設定の値のうち、この帳票の詳細設定にある項目（「共通の印刷設定を反映」で写す） */
export function commonValues(r: ReportDef, common: PrintCommon): Record<string, DetailValue> {
  return Object.fromEntries(itemsOf(r).filter((it) => it.k in COMMON_LINK).map((it): [string, DetailValue | undefined] => [it.k, COMMON_LINK[it.k](common)]).filter((x): x is [string, DetailValue] => x[1] !== undefined));
}
const initDetail = (r: ReportDef, common: PrintCommon): Record<string, DetailValue> => ({
  ...Object.fromEntries(itemsOf(r).map((it): [string, DetailValue] => [it.k, it.t === 'check' ? !!it.on : it.def ?? ''])),
  ...(r.common ? commonValues(r, common) : {}),
});
const defaultPrefs = (r: ReportDef, fy: number, common: PrintCommon): FlowPrefs => ({
  months: r.annual ? [] : ['8'], from: monthStart(fy, r.annual ? '4' : '8'), to: monthEnd(fy, r.annual ? '3' : '8'), range: '範囲指定の合計を印刷', scope: '全て', target: '起動中の区分',
  checks: { check: false, red: false, blue: false, yellow: false, green: false },
  output: r.outs ? OUT_OF[r.outs[0]] : OUTPUTS[0], zeroHide: r.noZero ? false : r.zero ?? !!common.items.zero, title: r.title ?? r.name, detail: initDetail(r, common),
});

/** 詳細設定の項目（現行の画面の枠ごとに、チェック・ラジオ・選択・入力を描き分ける。確認メモ #238） */
export function DetailSections({ sections, values, onChange, accent, labelOf, optionsOf, buttons, lead }: { /** 選択肢を画面で決める項目（区分の一覧など） */ optionsOf?: (it: DetailItem) => string[] | undefined; sections: DetailSection[]; values: Record<string, DetailValue>; onChange: (k: string, v: DetailValue) => void; accent: string; /** 起動中の区分などで文言を変える項目 */ labelOf?: (it: DetailItem) => string; /** 項目の右のボタン（「捺印欄を印刷する」の［捺印欄］など。確認メモ #310・#336・#341） */ buttons?: Record<string, DetailButton>; /** 「印刷項目」の枠の先頭に置くもの（0データを表示しない。確認メモ #335） */ lead?: ReactNode }) {
  const uid = useId();
  const label = (it: DetailItem) => labelOf?.(it) ?? it.label;
  const head = (it: DetailItem, dis?: boolean) => <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: dis ? '#b4bfca' : '#8290a0' }}>{label(it)}</span>;
  const byKey = new Map(sections.flatMap((sec) => sec.items.map((it): [string, DetailItem] => [it.k, it])));
  // 押せない項目の値は、ほかの項目の条件では「OFF」として扱う（例：科目欄を変えたあとの 特摘行の資金科目名）
  //   A4白紙と A5白紙のような「お互いに押せなくなる」組（not）は、たどると循環するので値をそのまま使う
  const eff = (k: string): DetailValue | undefined => { const c = byKey.get(k); return c?.when && !c.when.not && off(c) ? undefined : values[k]; };
  function off(it: DetailItem): boolean { return !!it.when && (it.when.not ? !!eff(it.when.k) === !!it.when.v : eff(it.when.k) !== it.when.v); }
  return (
    <div data-detail-sections style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, alignItems: 'start' }}>
      {sections.map((sec) => {
        // 項目の多い枠（元帳の印刷項目など）は横幅いっぱいに広げ、項目を複数列に並べる
        const wide = sec.items.length > 8;
        return (
        <fieldset key={sec.title} data-detail-section={sec.title} style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '4px 12px 12px', margin: 0, minWidth: 0, background: '#fff', gridColumn: wide ? '1 / -1' : undefined }}>
          <legend style={{ fontSize: 12, fontWeight: 800, color: '#5b6773', padding: '0 6px', letterSpacing: '.04em' }}>{sec.title}</legend>
          {lead && sec === sections.find((x) => x.title === '印刷項目') && <div data-detail-lead style={{ marginBottom: 9, paddingBottom: 9, borderBottom: '1px solid #eef2f6' }}>{lead}</div>}
          {/* 枠の見出しと同じ名前の小見出しは出さない（重複のため。確認メモ #312・#313） */}
          <div style={{ display: 'grid', gap: wide ? '7px 16px' : 9, gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(260px, 1fr))' : undefined }}>
            {sec.items.map((it) => {
              const v = values[it.k];
              const dis = off(it);
              // 枠の見出しと同じ名前、または枠に選択が1つだけで見出しに含まれる名前の小見出しは出さない（確認メモ #312・#313・#315・#321・#326・#344）
              const dup = label(it) === sec.title || (sec.title.includes(label(it)) && sec.items.filter((x) => x.t !== 'check').length === 1);
              if (it.t === 'check') {
                const xb = buttons?.[it.k];
                return (
                <div key={it.k} data-detail-item={it.k} data-type="check" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', paddingLeft: it.when && !it.when.not ? 20 : 0 }}>
                  <label style={{ flex: 1, minWidth: 0, display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 14, cursor: dis ? 'default' : 'pointer', lineHeight: 1.5, color: dis ? '#9aa5b1' : undefined }}>
                    <input type="checkbox" checked={!!v} disabled={dis} onChange={() => onChange(it.k, !v)} style={{ marginTop: 4, accentColor: accent }} /><span style={{ flex: 1 }}>{label(it)}{xb && v && xb.note && <span data-button-note={it.k} style={{ display: 'block', fontSize: 12, color: '#8290a0' }}>{xb.note}</span>}</span>
                  </label>
                  {xb && <button type="button" data-open-button={it.k} disabled={(!v && !xb.always) || dis || xb.disabled} onClick={xb.onClick} title={v ? xb.title : `「${label(it)}」を選ぶと使えます`} style={{ ...btn(v ? accent : '#9aa5b1', false, true), opacity: v ? 1 : 0.55, cursor: v ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>{xb.label}</button>}
                </div>
                );
              }
              if (it.t === 'radio') return (
                <div key={it.k} role="radiogroup" aria-label={label(it)} aria-disabled={dis || undefined} data-detail-item={it.k} data-type="radio" style={{ display: dup ? 'block' : 'grid', gap: 3 }}>
                  {!dup && head(it, dis)}
                  <div style={{ display: 'flex', gap: '2px 14px', flexWrap: 'wrap' }}>{it.options.map((o) => <label key={o} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 14, cursor: dis ? 'default' : 'pointer', whiteSpace: 'nowrap', color: dis ? '#9aa5b1' : undefined }}><input type="radio" name={uid + it.k} checked={v === o} disabled={dis} onChange={() => onChange(it.k, o)} style={{ accentColor: accent }} />{o}</label>)}</div>
                  {buttons?.[it.k] && (() => { const b = buttons[it.k]; return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      {b.note && <span data-button-note={it.k} style={{ fontSize: 12, color: '#8290a0' }}>{b.note}</span>}
                      <button type="button" data-open-button={it.k} onClick={b.onClick} title={b.title} style={{ ...btn(accent, false, true), whiteSpace: 'nowrap' }}>{b.label}</button>
                    </div>
                  ); })()}
                </div>
              );
              if (it.t === 'select') return (
                <label key={it.k} data-detail-item={it.k} data-type="select" style={{ display: 'grid', gap: 3 }}>
                  {!dup && head(it, dis)}
                  <select value={String(v ?? '')} disabled={dis} onChange={(e) => onChange(it.k, e.target.value)} style={{ ...input, padding: '6px 8px', opacity: dis ? 0.55 : 1 }}>{(optionsOf?.(it) ?? it.options).map((o) => <option key={o}>{o}</option>)}</select>
                </label>
              );
              return (
                <label key={it.k} data-detail-item={it.k} data-type="text" style={{ display: 'grid', gap: 3 }}>
                  {!dup && head(it, dis)}
                  <input className="field-input" value={String(v ?? '')} disabled={dis} placeholder={it.placeholder} onChange={(e) => onChange(it.k, e.target.value)} style={{ ...input, padding: '6px 8px', width: it.width ?? '100%', maxWidth: '100%', opacity: dis ? 0.55 : 1 }} />
                </label>
              );
            })}
          </div>
        </fieldset>
        );
      })}
    </div>
  );
}

export interface PrintFlowProps {
  report: ReportDef;
  accent: string;
  /** 画面の実データ（省略時は帳票ごとのサンプル表） */
  data?: TableData;
  onPreview: (title: string, opts: { from: string; to: string; output: string; hideZero?: boolean }) => void;
  /** キャンセル／出力完了で閉じる（画面内パネルでは省略可） */
  onClose?: () => void;
}

export function PrintFlow({ report, accent, data, onPreview, onClose }: PrintFlowProps) {
  const s = useSession();
  const uidFmt = useId();
  const toast = useToast();
  const fy = eraYear(s.fiscalYear);
  const [p, setP] = useState<FlowPrefs>(() => PREFS.get(report.id) ?? defaultPrefs(report, fy, s.print));
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [unit, setUnit] = useState(() => remarkUnitOf(s));
  const [stampEdit, setStampEdit] = useState<string[] | null>(null);
  const [dlg, setDlg] = useState<'' | 'fmt' | 'inner' | 'areas' | 'remarks' | 'disp'>('');
  const [footEdit, setFootEdit] = useState<string | null>(null);
  // 0データを表示しない は「印刷項目」の枠の先頭に置く（確認メモ #335）。仕訳日記帳・伝票は出さない（noZero。確認メモ #337）
  const zeroInItems = !report.noZero && report.detail.some((sec) => sec.title === '印刷項目');
  const zeroToggle = (
    <label data-detail-item="zeroHide" data-type="check" style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer', lineHeight: 1.5 }}>
      <input type="checkbox" checked={p.zeroHide} onChange={() => set({ zeroHide: !p.zeroHide })} style={{ marginTop: 4, accentColor: accent }} />
      <span style={{ flex: 1 }}>0データを表示しない<span style={{ display: 'block', fontSize: 12, color: '#8290a0' }}>金額がすべて 0 円の行を印刷・プレビューから省きます。</span></span>
    </label>
  );
  const STAMP_MAX = stampMaxOf(report);
  const stamps = p.stamps ?? (report.common ? [...s.print.stamps, '', '', '', ''].slice(0, STAMP_MAX) : stampDefault(report));
  /** 印刷書式（詳細設定の下のボタン。確認メモ #314・#339・#342） */
  const fmtSpec = formatSpecOf(report);
  const fmt = p.fmt ?? (fmtSpec ? stdFormat(fmtSpec) : null);
  const hasItem = (k: string) => report.detail.some((sec) => sec.items.some((it) => it.k === k));
  /** 予算内訳表：内訳書－印刷書式は「内部取引消去対応」のときだけ（確認メモ #345） */
  const hasInner = hasItem('innerMode');
  const innerOn = p.detail.innerMode === '内部取引消去対応';
  /** 予算書：［摘要］。「所属区分の摘要を使用する」のときは押せない（確認メモ #343・#348） */
  const hasRemarks = hasItem('ownRemark');
  const serviceNames = flattenDivisions(s.tree).filter((x) => x.node.kind === 'サービス区分').map((x) => divisionLabel(x.node));
  useEffect(() => { PREFS.set(report.id, p); }, [report.id, p]);
  const set = (patch: Partial<FlowPrefs>) => setP((x) => ({ ...x, ...patch }));
  const pr = s.print;
  const setCommon = (patch: Partial<PrintCommon>) => setSession({ print: { ...pr, ...patch } });
  const kind = startKindOf(s);
  // 入力区分で開いたときは「伝票入力区分名を印刷する」（確認メモ #309）
  //   予算は「区分名を印刷する」（確認メモ #340）
  const optionsOf = (it: DetailItem) => (it.k === 'ownDiv' ? ['（選択してください）', ...serviceNames] : undefined);
  const labelOf = (it: DetailItem) => (it.k !== 'mergeName' || kind !== '入力区分' ? it.label : report.cat === '仕訳日記帳' || report.cat === '元帳' ? '伝票入力区分名を印刷する' : report.cat === '予算' ? '区分名を印刷する' : it.label);
  const myUnit = remarkUnitOf(s);
  const destKind = kindOfOut(p.output);
  const onCount = itemsOf(report).filter((it) => it.t === 'check' && p.detail[it.k]).length;
  // 決算書 共通印刷設定との差（共通印刷設定＝有 の帳票のみ）
  const cv = report.common ? commonValues(report, pr) : {};
  const diff = report.common ? Object.keys(cv).filter((k) => p.detail[k] !== cv[k]).length + (p.zeroHide !== !!pr.items.zero ? 1 : 0) : 0;
  const applyCommon = () => {
    set({ detail: { ...p.detail, ...cv }, zeroHide: !!pr.items.zero });
    toast.show(diff ? `決算書 共通印刷設定の内容を反映しました（${diff} 項目を変更）` : '決算書 共通印刷設定と同じ内容です（変更はありません）');
  };

  // 月タブ：1か月・全月・範囲（ドラッグ／Shift＋クリック）。期間の入力欄にも反映する
  const md = (d: string) => { const [m, dd] = d.split('/'); return `令和${monthYear(fy, m)}年${m}月${dd}日`; };
  const ALL = FISCAL_MONTHS.filter((m) => m !== '決');
  const selectMonth = (m: MonthFilter) => setP((x) => {
    if (x.mRange) return { ...x, mCur: m };
    if (m == null) return { ...x, mCur: null, months: [...ALL], from: monthStart(fy, ALL[0]), to: monthEnd(fy, ALL[ALL.length - 1]) };
    return { ...x, mCur: m, months: [m], from: monthStart(fy, m), to: monthEnd(fy, m) };
  });
  const selectRange = (r: Period | null) => setP((x) => (r ? { ...x, mRange: r, months: monthsIn(r), from: md(r.from), to: md(r.to) } : { ...x, mRange: null }));
  const curMonth: MonthFilter = p.mCur !== undefined ? p.mCur : p.months.length === 1 ? p.months[0] : null;
  const table = (): TableData => { const base = data ?? sampleReportData(report.name); return p.zeroHide ? dropZeroRows(base).data : base; };
  const preview = () => onPreview(report.name, { from: p.from, to: p.to, output: OUTPUTS[1], hideZero: p.zeroHide });
  const run = () => {
    const kindOut = outputKind(p.output) ?? 'print';
    const spec: ExportSpec = { kind: kindOut, title: p.title.trim() || report.name, meta: `${p.from}〜${p.to}　${s.division}${report.scope && p.scope === '科目指定' ? '　科目指定' : ''}`, ...table() };
    if (kindOut === 'print') { toast.show(runExport(spec)); onClose?.(); return; }
    // ファイル出力は【名前を付けて保存】を経由する
    setExp(spec);
  };

  const radio = (on: boolean): CSSProperties => ({ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 8px', borderRadius: 8, background: on ? '#eef2f6' : 'transparent', fontSize: 14, cursor: 'pointer' });
  const confirm: [string, string][] = [
    ['帳票', report.name],
    ['期間', `${p.from} 〜 ${p.to}${report.range ? `（${p.range}）` : ''}`],
    ['区分', `${s.division}${kind !== '入力区分' ? `（${p.target === '起動中の区分' ? '合計で印刷' : '構成する区分ごとに印刷'}）` : ''}`],
    ['この帳票の詳細設定', `${report.noZero ? '' : `0データ：${p.zeroHide ? '表示しない' : '表示する'}／`}印刷項目 ${onCount} 件を有効${usesDepth(report) ? `／印刷範囲：${p.detail.depth}` : ''}${usesRemark(report) ? `／備考：${myUnit}${pr.unitRemarks[myUnit] ? '' : '（未入力）'}` : ''}`],
  ];
  if (report.common) confirm.push(['決算書 共通印刷設定', `${diff ? `${diff} 項目が共通の設定と異なる` : '共通の設定どおり'}／行の間隔 ${pr.lineGap}・${pr.fontName}`]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ToastView msg={toast.msg} />
      <PrintSteps
        accent={accent}
        detailSummary={`${p.from}〜${p.to}／印刷項目 ${onCount} 件${report.common ? (diff ? `／共通と異なる ${diff} 項目` : '／共通の設定どおり') : ''}`}
        dest={destKind}
        dests={report.outs}
        onDest={(k) => set({ output: OUT_OF[k] })}
        onPreview={preview}
        onRun={run}
        onClose={onClose}
        confirm={confirm}
        detail={<>
          <ScopeBlock title="基本条件" desc="印刷する期間と区分です。">
            <div data-print-basic style={{ display: 'grid', gap: 14 }}>
            <div>
              <span style={lbl}>{report.annual ? '期間（年次の帳票のため、会計年度の期首〜期末）' : '期間（月のボタンで1か月。ドラッグか Shift＋クリックで月の範囲、「全月」で年度全体）'}</span>
              {!report.annual && <div data-print-months style={{ marginBottom: 8 }}><FiscalMonthTabs current={curMonth} accent={accent} onSelect={selectMonth} withAll range={p.mRange ?? null} onRange={selectRange} pickRange={false} /></div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><input className="field-input" value={p.from} onChange={(e) => set({ from: e.target.value })} style={{ ...input, width: 170 }} aria-label="開始日" /><span>〜</span><input className="field-input" value={p.to} onChange={(e) => set({ to: e.target.value })} style={{ ...input, width: 170 }} aria-label="終了日" /><span style={{ fontSize: 12, color: '#8290a0' }}>会計年度：{s.fiscalYear}</span></div>
            </div>
            <div>
              <span style={lbl}>区分</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
                <b>{s.division}</b><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56' }}>{kind}で起動中</span>
                {kind !== '入力区分' && <span style={{ display: 'flex', gap: 4 }}>{['起動中の区分', '構成する区分ごと'].map((o) => <label key={o} style={radio(p.target === o)}><input type="radio" checked={p.target === o} onChange={() => set({ target: o })} />{o === '起動中の区分' ? '合計で印刷' : '構成する区分ごとに印刷'}</label>)}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#8290a0', marginTop: 4 }}>印刷する区分を変える場合は、画面上部の区分の切替で区分を選び直します。</div>
            </div>
            {(report.cat === '仕訳日記帳' || report.cat === '元帳') && (
              <div>
                <span style={lbl}>チェック・付箋で絞り込む（選ばなければ全件）</span>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
                  <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={p.checks.check} onChange={() => set({ checks: { ...p.checks, check: !p.checks.check } })} />チェック</label>
                  {([['red', '赤', '#c0392b'], ['blue', '青', '#2c5f9e'], ['yellow', '黄', '#b7791f'], ['green', '緑', '#1f7a52']] as const).map(([k, l, c]) => <label key={k} style={{ display: 'flex', gap: 5, alignItems: 'center', color: c }}><input type="checkbox" checked={p.checks[k]} onChange={() => set({ checks: { ...p.checks, [k]: !p.checks[k] } })} />付箋 {fusenLabel(l)}</label>)}
                </div>
              </div>
            )}
            {report.scope && (() => {
              // 科目の範囲：他画面と同じ科目検索（コード・名称・フリガナで絞り込む）。取引先元帳は「取引先の指定」（確認メモ #323・#327）
              const vend = /取引先元帳/.test(report.name);
              const pick = vend ? '取引先指定' : '科目指定';
              const on = p.scope === pick || p.scope === '科目指定';
              return (
              <div data-print-scope={vend ? 'vendor' : 'account'}><span style={lbl}>{vend ? '取引先の指定' : '科目の範囲'}</span><div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>{['全て', pick].map((o) => <label key={o} style={radio(o === '全て' ? !on : on)}><input type="radio" checked={o === '全て' ? !on : on} onChange={() => set({ scope: o })} />{o}</label>)}</div>
                {on && <div data-scope-range style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 14 }}>
                  <TargetCombo id={uidFmt + 'scopeFrom'} kind={vend ? 'vendor' : 'account'} value={p.scopeFrom ?? ''} onChange={(v) => set({ scopeFrom: v })} accent={accent} placeholder={vend ? '開始の取引先（コード・名称）' : '開始科目（コード・科目名・フリガナ）'} width={300} hint={false} />
                  <span>〜</span>
                  <TargetCombo id={uidFmt + 'scopeTo'} kind={vend ? 'vendor' : 'account'} value={p.scopeTo ?? ''} onChange={(v) => set({ scopeTo: v })} accent={accent} placeholder={vend ? '終了の取引先（コード・名称）' : '終了科目（コード・科目名・フリガナ）'} width={300} hint={false} />
                  <span style={{ fontSize: 12, color: '#8290a0', flexBasis: '100%' }}>コードを入力するか、候補から選びます（ほかの画面の{vend ? '取引先' : '科目'}検索と同じ操作です）。</span>
                </div>}
              </div>
              );
            })()}
            {report.range && (
              <div><span style={lbl}>範囲指定の種類</span><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(report.rangeSumOnly ? ['範囲指定の合計を印刷'] : ['範囲指定の合計を印刷', '範囲指定の月を連続で印刷']).map((o) => <label key={o} style={radio(p.range === o)}><input type="radio" checked={p.range === o} onChange={() => set({ range: o })} />{o}</label>)}</div></div>
            )}
            {/* 印字する年月日：予算書のほか、予算内訳表にも置く（確認メモ #347） */}
            {(report.budget === '通常' || (report.cat === '予算' && report.rangeSumOnly)) && (
              <div data-budget-date><span style={lbl}>印字する年月日（何も入力しなくても印刷されます。入力した値をそのまま印字します）</span><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}><select defaultValue="令和" aria-label="元号" style={{ ...input, width: 90 }}>{['', '明治', '大正', '昭和', '平成', '令和'].map((o) => <option key={o} value={o}>{o || '（空白）'}</option>)}</select><input className="field-input" aria-label="年" style={{ ...input, width: 60 }} />年<input className="field-input" aria-label="月" style={{ ...input, width: 60 }} />月<input className="field-input" aria-label="日" style={{ ...input, width: 60 }} />日</div></div>
            )}
            {report.budget === '補正' && (
              <div data-budget-rev><span style={lbl}>補正予算の年月</span><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>第<input className="field-input" aria-label="補正の回数" defaultValue="1" style={{ ...input, width: 60 }} />次補正　令和<input className="field-input" aria-label="年" style={{ ...input, width: 60 }} />年<input className="field-input" aria-label="月" style={{ ...input, width: 60 }} />月</div></div>
            )}
            </div>
          </ScopeBlock>
            <ScopeBlock kind="帳票個別" title="この帳票の詳細設定" desc={`「${report.name}」の印刷だけに反映されます。`} right={report.common ? <>
              <button type="button" data-apply-common onClick={(e) => { e.stopPropagation(); applyCommon(); }} title="決算書 共通印刷設定の値を、この帳票の詳細設定に写します" style={{ ...btn(accent, true, true), whiteSpace: 'nowrap' }}>共通の印刷設定を反映</button>
              <button type="button" data-open-common onClick={(e) => { e.stopPropagation(); goScreen('共通の印刷設定'); }} title="決算書 共通印刷設定の画面を開きます" style={{ ...btn('#5b6773', false, true), whiteSpace: 'nowrap' }}>決算書 共通印刷設定を開く</button>
            </> : undefined}>
              <div style={{ display: 'grid', gap: 12 }}>
                {report.common && <div data-common-diff={diff} style={{ fontSize: 12, color: diff ? '#6b3fa0' : '#8290a0', lineHeight: 1.6 }}>{diff ? `決算書 共通印刷設定と異なる項目が ${diff} 件あります。「共通の印刷設定を反映」で共通の値にそろえます。` : '決算書 共通印刷設定と同じ内容です。'}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {!report.noZero && !zeroInItems && <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
                    <Toggle on={p.zeroHide} onChange={(v) => set({ zeroHide: v })} accent={accent} label="0データを表示しない" />
                    <span style={{ fontSize: 12, color: '#8290a0', paddingLeft: 46 }}>金額がすべて 0 円の行を印刷・プレビューから省きます。</span>
                  </div>}
                  <Field label="タイトル（印刷様式）"><input className="field-input" value={p.title} onChange={(e) => set({ title: e.target.value })} style={input} /></Field>
                </div>
                {report.detail.length > 0 && <DetailSections sections={report.detail} values={p.detail} onChange={(k, v) => set({ detail: { ...p.detail, [k]: v } })} accent={accent} labelOf={labelOf} optionsOf={optionsOf} lead={zeroInItems ? zeroToggle : undefined} buttons={{
                  depth: { label: report.cat === '予算' && report.budget && !report.rangeSumOnly ? '表示科目' : '表示設定', always: true, onClick: () => setDlg('disp'), title: '科目毎の表示設定（「科目毎に指定」で印刷する科目）を開きます', note: Object.values(p.disp ?? {}).some((x) => x === false) ? `表示しない科目 ${Object.values(p.disp ?? {}).filter((x) => x === false).length} 件` : undefined },
                  pickArea: { label: '印刷区分', onClick: () => setDlg('areas'), title: '内訳表に表示する区分を選びます', note: (p.areas ?? []).filter(Boolean).length ? `${(p.areas ?? []).filter(Boolean).length} 区分を指定` : '区分が未指定です' },
                  stamp: { label: '捺印欄', onClick: () => setStampEdit([...stamps]), note: stamps.filter(Boolean).join('・') || '名前が未入力です', title: '捺印欄に印刷する名前を入力します' },
                  foot: { label: '脚注編集', onClick: () => setFootEdit(pr.footnotes[report.name] ?? ''), note: pr.footnotes[report.name] ? pr.footnotes[report.name].slice(0, 30) + (pr.footnotes[report.name].length > 30 ? '…' : '') : '脚注が未入力です', title: 'この帳票の脚注を入力します' },
                }} />}
                {stampButtonOnly(report) && (
                  <div data-voucher-stamp style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" data-open-stamp onClick={() => setStampEdit([...stamps])} style={btn('#5b6773', false, true)}>捺印欄</button>
                    <span style={{ fontSize: 12, color: '#8290a0' }}>{stamps.filter(Boolean).join('・') || '名前が未入力です'}（{STAMP_MAX} 欄）</span>
                  </div>
                )}
                {(fmtSpec || hasInner || hasRemarks) && (
                  <div data-detail-buttons style={{ display: 'grid', gap: 6 }}>
                    {fmtSpec && fmt && <div data-journal-format style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" data-open-journal-format onClick={() => setDlg('fmt')} style={btn('#5b6773', false, true)}>印刷書式</button>
                      <span style={{ fontSize: 12, color: '#8290a0' }}>{formatSummary(fmtSpec, fmt)}</span>
                    </div>}
                    {hasInner && <div data-inner-format style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" data-open-inner-format disabled={!innerOn} onClick={() => setDlg('inner')} title={innerOn ? undefined : '「内部取引消去対応」を選ぶと使えます'} style={{ ...btn('#5b6773', false, true), opacity: innerOn ? 1 : 0.5, cursor: innerOn ? 'pointer' : 'default' }}>内訳表の印刷書式</button>
                      <span style={{ fontSize: 12, color: '#8290a0' }}>{innerOn ? (() => { const f = p.innerFmt ?? STD_INNER_PRINT; return `${f.paper}・${f.orient}／科目名 ${f.widths[0]}mm／金額 ${f.widths[1]}mm`; })() : '合算テーブルのときは使いません'}</span>
                    </div>}
                    {hasRemarks && <div data-remarks style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" data-open-remarks disabled={!!p.detail.ownRemark} onClick={() => setDlg('remarks')} title={p.detail.ownRemark ? '「所属区分の摘要を使用する」のときは、選んだ区分の摘要を使います' : '科目ごとの摘要（備考）を入力します'} style={{ ...btn('#5b6773', false, true), opacity: p.detail.ownRemark ? 0.5 : 1, cursor: p.detail.ownRemark ? 'default' : 'pointer' }}>摘要</button>
                      <span style={{ fontSize: 12, color: '#8290a0' }}>{p.detail.ownRemark ? `所属区分の摘要を使用（${p.detail.ownDiv && p.detail.ownDiv !== '（選択してください）' ? p.detail.ownDiv : '区分が未選択'}）` : Object.keys(p.remarks ?? {}).length ? `${Object.keys(p.remarks ?? {}).length} 科目に入力済み` : '未入力'}</span>
                    </div>}
                  </div>
                )}
                {usesRemark(report) && (
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 14 }}>備考・摘要</b><span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56' }}>単位ごとに保持</span><span style={{ fontSize: 12, color: '#8290a0' }}>法人・拠点・サービス区分で内容が異なる場合があるため、単位ごとに別々に保存します。</span></div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{REMARK_UNITS.map((u) => <button key={u} type="button" onClick={() => setUnit(u)} style={btn(unit === u ? accent : '#5b6773', unit === u, true)}>{u}{u === myUnit ? '（今回の印刷で使用）' : ''}</button>)}</div>
                    <textarea value={pr.unitRemarks[unit] ?? ''} onChange={(e) => setCommon({ unitRemarks: { ...pr.unitRemarks, [unit]: e.target.value } })} rows={3} placeholder={`${unit}の備考欄に印刷する文字`} style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
                    {unit !== myUnit && <div style={{ fontSize: 12, color: '#8a5a00' }}>起動中の区分（{s.division}）の印刷では「{myUnit}」の備考を使います。ここで編集した内容は「{unit}」を印刷するときに使われます。</div>}
                  </div>
                )}
              </div>
            </ScopeBlock>

            {report.common && (
              <ScopeBlock kind="決算書共通" title="決算書 共通印刷設定から使う設定" desc="決算書の帳票に共通の設定です（ここでは確認のみ。変更は「決算書 共通印刷設定を開く」から）。">
                <div data-common-summary style={{ display: 'flex', gap: '4px 16px', flexWrap: 'wrap', fontSize: 14, color: '#48565f' }}>
                  <span>行の間隔：{pr.lineGap}{pr.lineGap === '空きなし' || pr.lineGap === '個別の設定を使う' ? '' : `（${pr.gapSize}）`}</span><span>位置調整：横 {pr.offsetX}mm／縦 {pr.offsetY}mm</span><span>印刷幅：科目 {pr.widthName}mm／金額 {pr.widthAmount}mm</span><span>フォント：{pr.fontHeader}／{pr.fontName}／{pr.fontAmount}</span><span>捺印欄の氏名：{pr.stamps.filter(Boolean).join('・') || '（なし）'}</span><span>ページ番号の開始：{pr.pageStart}</span>
                </div>
              </ScopeBlock>
            )}

            <ScopeBlock title="動作環境から引き継ぐ設定" descBelow right={<button type="button" data-open-env onClick={(e) => { e.stopPropagation(); goScreen('環境設定'); }} style={btn('#5b6773', false, true)}>{displayName('環境設定')}を開く</button>} desc="画面表示と印刷の両方に関わるため動作環境に残した設定です（ここでは確認のみ。区分ごと／全区分共通の別を表示）。">
              <EnvPrintSummary env={s.env} division={s.division} budget={report.cat === '予算'} />
            </ScopeBlock>
        </>}
      />
      {/* 捺印欄（現行「捺印欄」：最大4欄、1欄 全角3文字。確認メモ #310） */}
      <Modal open={!!stampEdit} onClose={() => setStampEdit(null)} width={520} title="捺印欄">
        {stampEdit && <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#48565f' }}>捺印欄に印刷する名前を入力してください。<span style={{ display: 'block', fontSize: 12, color: '#8290a0' }}>最大 {STAMP_MAX} 欄、1欄は全角 {STAMP_LEN} 文字（半角 {STAMP_LEN * 2} 文字）まで。左の欄から順に印刷します。</span></div>
          <div data-stamp-inputs style={{ display: 'grid', gridTemplateColumns: `repeat(${STAMP_MAX}, 1fr)`, gap: 8 }}>{stampEdit.map((v, i) => <Field key={i} label={`捺印欄 ${i + 1}`}><input className="field-input" value={v} maxLength={STAMP_LEN * 2} onChange={(e) => setStampEdit(stampEdit.map((x, k) => (k === i ? clipBytes(e.target.value, STAMP_LEN * 2) : x)))} style={{ ...input, textAlign: 'center' }} /></Field>)}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setStampEdit(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { set({ stamps: stampEdit.map((x) => x.trim()) }); setStampEdit(null); }} style={btn(accent, true)}>OK</button></div>
        </div>}
      </Modal>
      {/* 脚注編集（「脚注を印刷する」「脚注、注記を印刷する」の右のボタン。決算書 共通印刷設定の脚注と同じ保存先。確認メモ #336・#341） */}
      <Modal open={footEdit !== null} onClose={() => setFootEdit(null)} width={560} title={`脚注編集：${report.name}`}>
        {footEdit !== null && <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: '#8290a0' }}>帳票の下に印刷する脚注（注記）を入力します。改行もそのまま印刷します。</div>
          <textarea data-foot-text value={footEdit} onChange={(e) => setFootEdit(e.target.value)} rows={6} placeholder="（注）予備費の充当額 ○○円 は …" style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setFootEdit(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { setCommon({ footnotes: { ...pr.footnotes, [report.name]: footEdit } }); setFootEdit(null); toast.show('脚注を保存しました'); }} style={btn(accent, true)}>OK</button></div>
        </div>}
      </Modal>
      {dlg === 'fmt' && fmtSpec && fmt && <FormatDialog spec={fmtSpec} value={fmt} accent={accent} onCancel={() => setDlg('')} onOk={(f) => { set({ fmt: f }); setDlg(''); }} />}
      {dlg === 'inner' && <InnerFormatDialog value={p.innerFmt ?? STD_INNER_PRINT} accent={accent} onCancel={() => setDlg('')} onOk={(f) => { set({ innerFmt: f }); setDlg(''); }} />}
      {dlg === 'areas' && <AreaPickDialog value={p.areas ?? []} divisions={serviceNames} perPage={Number(p.detail.perPage) || 5} accent={accent} onCancel={() => setDlg('')} onOk={(v) => { set({ areas: v }); setDlg(''); }} />}
      {dlg === 'remarks' && <RemarkDialog title={report.name} value={p.remarks ?? {}} accent={accent} onCancel={() => setDlg('')} onOk={(v) => { set({ remarks: v }); setDlg(''); }} />}
      {dlg === 'disp' && <DisplaySettingDialog value={p.disp ?? {}} accent={accent} onCancel={() => setDlg('')} onOk={(v) => { set({ disp: v }); setDlg(''); }} />}
      {/* 【名前を付けて保存】は印刷の流れの上に重ねる（DOM 上で後に置く） */}
      <ExportDialog spec={exp} onClose={() => { setExp(null); onClose?.(); }} accent={accent} />
    </div>
  );
}

/** 帳票の色・印字。動作環境にあった印刷関連の項目を、印刷の詳細設定と共通の印刷設定に集約（依頼書 5.5.1） */
export function ReportStyleSettings({ accent, compact }: { accent: string; compact?: boolean }) {
  const s = useSession();
  const e = s.env;
  const set = (patch: Partial<EnvSettings>) => setSession({ env: { ...e, ...patch } });
  const colorLbl: CSSProperties = { fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' };
  return (
    <div data-report-style style={{ display: 'grid', gap: compact ? 8 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Toggle on={e.colorReports} onChange={(v) => set({ colorReports: v })} accent={accent} label="カラー帳票を有効にする" />
        <label style={colorLbl}>罫線色<input type="color" value={e.lineColor} onChange={(ev) => set({ lineColor: ev.target.value })} disabled={!e.colorReports} /></label>
        <label style={colorLbl}>網掛け色<input type="color" value={e.shadeColor} onChange={(ev) => set({ shadeColor: ev.target.value })} disabled={!e.colorReports} /></label>
        <span style={{ fontSize: 12, color: '#7a8794' }}>決算書・予算書・試算表・仕訳日記帳の罫線と網掛け。元帳・伝票は帳票ごとの固定色</span>
      </div>
      <Toggle on={e.printSpeed} onChange={(v) => set({ printSpeed: v })} accent={accent} label="帳票印刷の速度を重視する（大量ページの作成を優先）" />
      <Toggle on={e.onePageRow} onChange={(v) => set({ onePageRow: v })} accent={accent} label="1行のみの改ページを抑制する（1行だけが次ページに送られないようにする）" />
      <Toggle on={e.noteOnExcel} onChange={(v) => set({ noteOnExcel: v })} accent={accent} label="Excel／PDF出力で明細書の注意書きを印字する" />
      <Field label="試算表：予備費出力の選択"><select value={e.reserveOutput} onChange={(ev) => set({ reserveOutput: ev.target.value })} style={input}>{['予備費を標準方式で印字', '予備費の差異に計算結果を印字', '予備費の1行目に充当前の予算額を印字'].map((o) => <option key={o}>{o}</option>)}</select></Field>
    </div>
  );
}

/** 動作環境のうち印刷に反映される設定の一覧（影響範囲つき・確認のみ） */
export function EnvPrintSummary({ env, division, budget }: { env: EnvSettings; division: string; /** 予算の帳票：予算の内部取引消去も出す（確認メモ #334） */ budget?: boolean }) {
  const rows: [string, ReactNode, ScopeKind][] = [
    ['金額の書式', <>桁区切り：{env.thousandsSep}／負数：<span style={{ color: amountColor(-1, env), fontVariantNumeric: 'tabular-nums' }}>{formatAmount(-89012, env)}</span>（{env.negativeColor}）</>, '区分ごと'],
    ['0データ判定方法の変更', env.zeroCut ? '相殺結果が 0 円の項目を 0 データとみなす' : '相殺結果が 0 円の項目を 0 データとみなさない', '区分ごと'],
    ['和暦の 1 年の表記', env.eraGannen ? '「元年」と表記' : '「1年」と表記', '全区分共通'],
    ['試算表の費目行の計算方式', env.trialCalc, '全区分共通'],
    ...(budget ? [['予算の内部取引消去', env.budgetInternalOffset ? '内部取引を相殺する' : '内部取引を相殺しない', '全区分共通'] as [string, ReactNode, ScopeKind]] : []),
  ];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>{rows.map(([k, v, scope]) => <tr key={k}><td style={{ ...TD, width: 176, fontSize: 14, fontWeight: 700, color: '#5b6773', padding: '6px 8px' }}>{k}</td><td style={{ ...TD, fontSize: 14, padding: '6px 8px' }}>{v}</td><td style={{ ...TD, width: 190, padding: '6px 8px', textAlign: 'right' }}><ScopeBadge kind={scope} label={scope === '区分ごと' ? `区分ごと（${division}）` : undefined} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

/* ---------------- 帳票ごとの印刷ダイアログ ---------------- */
export function PrintDialog({ open, onClose, report, accent, onPreview, data, keepOpenOnPreview }: { open: boolean; onClose: () => void; report: ReportDef | null; accent: string; onPreview: (title: string, opts: { from: string; to: string; output: string; hideZero?: boolean }) => void; /** 画面の実データ（省略時は帳票ごとのサンプル表） */ data?: TableData; /** プレビューを開いてもダイアログを閉じない（プレビューを後ろに重ねて描画する呼び出し側向け） */ keepOpenOnPreview?: boolean }) {
  // 帳票は開く前に決まっている（印刷画面の中で帳票を選び直さない）
  const cur = report;
  if (!cur) return null;
  return (
    <Modal open={open} onClose={onClose} width={880} title={<>{cur.name} の印刷 <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{cur.cat}</span></>}>
      <PrintFlow key={cur.id} report={cur} accent={accent} data={data} onClose={onClose} onPreview={(title, opts) => { onPreview(title, opts); if (!keepOpenOnPreview) onClose(); }} />
    </Modal>
  );
}

/* ---------------- 各帳票画面に置く「印刷」ボタン（依頼書 5.1.1） ---------------- */
export function PrintButton({ reportName, accent, data, label = '印刷', small, solid, style }: { reportName: string; accent: string; /** 画面に表示中の表データ（省略時はサンプル表） */ data?: TableData; label?: string; small?: boolean; solid?: boolean; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ title: string; opts: { from: string; to: string; output: string; hideZero?: boolean } } | null>(null);
  const report = useMemo(() => findReport(reportName), [reportName]);
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)} title={`${report.name} を印刷（期間・詳細設定・出力先を指定）`} style={{ ...btn(accent, !!solid, small), display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></svg>
        {label}
      </button>
      <PrintDialog open={open} onClose={() => setOpen(false)} report={report} accent={accent} data={data} keepOpenOnPreview onPreview={(title, opts) => setPreview({ title, opts })} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} data={preview ? (preview.title === report.name && data ? data : sampleReportData(preview.title)) : undefined} />
    </>
  );
}

/* ---------------- プレビュー ---------------- */
export function PreviewModal({ open, onClose, title, opts, pages = 3, accent, children, data, hideZero }: { open: boolean; onClose: () => void; title: string; opts?: { from: string; to: string; output: string; hideZero?: boolean }; pages?: number; accent: string; children?: ReactNode; /** 印刷・Excel・PDF に使う表データ（省略時はサンプル表） */ data?: TableData; /** 0円行を省く（「0データを表示しない」）。省略時は印刷の流れで指定した値 */ hideZero?: boolean }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const toast = useToast();
  const s = useSession();
  const zero = hideZero ?? opts?.hideZero ?? false;
  const shown = data ? (zero ? dropZeroRows(data) : { data, dropped: 0 }) : null;
  const sample = !data && !children ? samplePageRows(page) : [];
  const sampleShown = zero ? sample.filter((r) => r.slice(1).some((v) => v !== 0)) : sample;
  const dropped = shown ? shown.dropped : sample.length - sampleShown.length;
  const pageCount = data && !children ? 1 : pages;
  const line = s.env.colorReports ? s.env.lineColor : '#9aa5b1';
  const shadeBg = s.print.items.shade ? (s.env.colorReports ? s.env.shadeColor : '#eef2f6') : '#fff';
  return (
    <Modal open={open} onClose={onClose} width={900} title={<>印刷プレビュー <span style={{ fontSize: 14, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{title}</span></>}>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid #eef2f5', background: '#f8fafc', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setPage((x) => Math.max(1, x - 1))} style={btn('#5b6773', false, true)}>前ページ</button>
        <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{Math.min(page, pageCount)} / {pageCount}</span>
        <button type="button" onClick={() => setPage((x) => Math.min(pageCount, x + 1))} style={btn('#5b6773', false, true)}>次ページ</button>
        <button type="button" onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))} style={btn('#5b6773', false, true)}>拡大</button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} style={btn('#5b6773', false, true)}>縮小</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={onClose} style={btn(accent, false, true)}>閉じる</button>
        </span>
      </div>
      <div style={{ background: '#5f6b77', padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
        <div style={{ width: 640 * zoom, minHeight: 880 * zoom, margin: '0 auto', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.35)', padding: 36 * zoom, fontSize: 12 * zoom, color: '#22303c', fontFamily: "'Noto Sans JP', serif", transformOrigin: 'top center' }}>
          {s.print.items.corp && <div style={{ fontSize: 12 * zoom, color: '#5b6773' }}>{s.env.hideCorpName ? '' : '社会福祉法人 チャイルド保育園　'}{s.division}</div>}
          <div style={{ textAlign: 'center', fontSize: 16 * zoom, fontWeight: 700, margin: `${8 * zoom}px 0 ${4 * zoom}px`, letterSpacing: '.1em' }}>{title}</div>
          {opts && <div style={{ textAlign: 'center', fontSize: 12 * zoom, color: '#5b6773', marginBottom: 12 * zoom }}>（自）{opts.from}　（至）{opts.to}　　単位：円</div>}
          {children ?? (shown ? <DataPage zoom={zoom} data={shown.data} shade={shadeBg} line={line} env={s.env} /> : <DataPage zoom={zoom} data={{ header: SAMPLE_HEADER, rows: sampleShown }} shade={shadeBg} line={line} env={s.env} groupRows />)}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 * zoom, fontSize: 12 * zoom, color: '#7a8794' }}>
            <span>{s.print.items.date ? `印刷日 2026/09/10` : ''}</span>
            {s.print.items.stamp && <span style={{ display: 'flex', gap: 4 }}>{s.print.stamps.filter(Boolean).map((n) => <span key={n} style={{ width: 44 * zoom, height: 44 * zoom, border: '1px solid #9aa5b1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}</span>}
            <span>{s.print.items.page ? `- ${(s.print.pageStart || 1) + Math.min(page, pageCount) - 1} -` : ''}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', fontSize: 12, color: '#9aa5b1', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {!children && <span style={{ color: '#5b6773' }}>金額の書式：桁区切り {s.env.thousandsSep}・負数 {formatAmount(-1234, s.env)}（{s.env.negativeColor}）　／　0円の行：{zero ? `表示しない${dropped ? `（${dropped} 行を省略）` : ''}` : '表示する'}</span>}
        <span>レイアウトはサンプルです。プレビューは確認用で、出力は印刷画面の「出力先」で選んで行います。</span>
      </div>
    </Modal>
  );
}
const SAMPLE_HEADER = ['勘定科目', '前月繰越', '借方', '貸方', '残高'];
const sampleCell = (i: number) => (i * 7919) % 1000000 + 12000;
/** サンプル帳票の1ページ分（22行）。プレビュー表示と印刷・Excel・PDF 出力で共用。0円行と負数の残高を含む */
function samplePageRows(page: number): (string | number)[][] {
  return Array.from({ length: 22 }, (_, k) => k + (page - 1) * 22).map((i) => {
    const name = i % 6 === 0 ? '流動資産' : ['現金', '普通預金', '当座預金', '事業未収金', '立替金'][i % 5];
    if (i % 11 === 7) return [name, 0, 0, 0, 0];
    const open = sampleCell(i), dr = sampleCell(i + 1) % 90000, cr = sampleCell(i + 2) % 70000;
    return i % 13 === 5 ? [name, 0, dr, dr + cr, -cr] : [name, open, dr, cr, open + dr - cr];
  });
}
/** 表データを帳票風に描画（金額は動作環境の書式、負数は指定色） */
function DataPage({ zoom, data, shade, line, env, groupRows }: { zoom: number; data: TableData; shade: string; line: string; env: EnvSettings; groupRows?: boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 * zoom }}>
      <thead><tr>{data.header.map((h, i) => <th key={i} style={{ border: '1px solid ' + line, padding: 3 * zoom, background: shade, textAlign: typeof data.rows[0]?.[i] === 'number' ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
      <tbody>{data.rows.map((r, i) => {
        const group = groupRows && r[0] === '流動資産';
        return <tr key={i} style={{ background: group ? shade : '#fff' }}>{r.map((v, k) => <td key={k} style={{ border: '1px solid ' + line, padding: 3 * zoom, paddingLeft: (k === 0 && groupRows && !group ? 12 : 3) * zoom, textAlign: typeof v === 'number' ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: group && k === 0 ? 700 : 400, color: typeof v === 'number' ? amountColor(v, env) : undefined }}>{typeof v === 'number' ? formatAmount(v, env) : v}</td>)}</tr>;
      })}</tbody>
    </table>
  );
}

/* ---------------- 決算書 共通印刷設定（確認メモ #238：全帳票共通ではなく、決算書の印刷設定にした） ---------------- */
/** 「0データを印刷しない」の除外科目（旧【0データの除外科目設定】）：0円でも印刷したい科目を指定する。法人内で共通 */
function ZeroExcludeCard({ accent }: { accent: string }) {
  const toast = useToast();
  const fundItems = Array.from(new Set(ACCOUNT_META.filter((m) => m.fund && m.fund !== '—' && m.fund !== '（支払資金）').map((m) => m.fund)));
  const bsItems = ACCOUNT_META.map((m) => m.name);
  const [fund, setFund] = useState<string[]>(['委託費収入', '利用者等利用料収入（一般）'].filter((x) => fundItems.includes(x)));
  const [bs, setBs] = useState<string[]>(['現金', '普通預金（本部）'].filter((x) => bsItems.includes(x)));
  const [open, setOpen] = useState(false);
  const toggle = (list: string[], set: (v: string[]) => void, x: string) => set(list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const col = (title: string, items: string[], list: string[], set: (v: string[]) => void) => (
    <div style={card}>
      <div style={cardHead}>{title}<span style={{ fontSize: 12, fontWeight: 600, color: '#5b6773', marginLeft: 6 }}>{list.length} 科目</span><button type="button" onClick={() => set([])} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>全て OFF</button></div>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>{items.map((x) => <label key={x} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 12px', fontSize: 14, borderTop: '1px solid #f1f4f7', background: list.includes(x) ? '#fffbe6' : '#fff', cursor: 'pointer' }}><input type="checkbox" checked={list.includes(x)} onChange={() => toggle(list, set, x)} />{x}</label>)}</div>
    </div>
  );
  return (
    <div style={card} data-zero-exclude>
      <ToastView msg={toast.msg} />
      <div style={cardHead}>「0データを印刷しない」の除外科目<ScopeBadge kind="決算書共通" /></div>
      <div style={{ padding: 14, display: 'grid', gap: 10, fontSize: 14 }}>
        <div style={{ color: '#5b6773' }}>決算書の詳細設定で「0データを表示しない」を有効にしていても、ここで指定した科目は 0 円のまま印刷します。法人内で共通の設定です。</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>資金科目 <b>{fund.length}</b> 科目</span><span>貸借・事業科目 <b>{bs.length}</b> 科目</span>
          <button type="button" onClick={() => setOpen(true)} style={{ ...btn(accent, false, true), marginLeft: 'auto' }}>除外科目を指定する</button>
        </div>
        {(fund.length > 0 || bs.length > 0) && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[...fund, ...bs].map((x) => <span key={x} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: '#fff7cc', border: '1px solid #f3e3a0' }}>{x}</span>)}</div>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} width={760} title="「0データを印刷しない」の除外科目設定">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice>印刷詳細設定「0データを印刷しない」が有効になっている場合に、0 円でも印刷を行いたい科目にチェックを付けてください。この機能を使用しない場合は「全て OFF」にします。この設定は法人内で共通です。</Notice>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{col('資金科目', fundItems, fund, setFund)}{col('貸借・事業科目', bsItems, bs, setBs)}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setOpen(false)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { setOpen(false); toast.show(`除外科目を保存しました（資金 ${fund.length}・貸借事業 ${bs.length}）`); }} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
    </div>
  );
}

function FormSelectCard() {
  const s = useSession();
  const can = omittable(s.tree);
  const set = (key: string, on: boolean) => setSession({ print: { ...s.print, forms: { ...s.print.forms, [key]: on } } });
  return (
    <div style={card} data-form-select>
      <div style={cardHead}>帳票選択（決算書・別紙・準決算書で使う様式）<span style={{ fontWeight: 500, color: '#7a8794', marginLeft: 8, fontSize: 12 }}>現行の印刷メニュー「様式設定」・旧 動作環境パネル「帳票選択」</span></div>
      <div style={{ padding: 14, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7 }}>帳票の印刷の一覧（決算書・別紙・準決算書）に出す帳票を選びます。使用にした様式だけが一覧に出ます。区分階層（事業区分・拠点区分の数）によって省略できる様式は、既定で省略しています。<br />現在の区分階層：事業区分 {can.事業区分 ? '1つ（第二様式を省略できます）' : '複数（第二様式が必要）'}／拠点区分 {can.拠点区分 ? '各1つ（第三様式を省略できます）' : '複数の事業区分あり（第三様式が必要）'}</div>
        {FORM_GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{g.title}</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {g.items.map((it) => { const on = formEnabled(s.print.forms, it.key, s.tree); const omit = !!it.omit && can[it.omit]; return (
                <label key={it.key} data-form={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '4px 8px', borderRadius: 8, background: on ? 'transparent' : '#f6f8fa', color: on ? '#22303c' : '#8290a0' }}>
                  <input type="checkbox" checked={on} onChange={() => set(it.key, !on)} /><b style={{ minWidth: 76, fontVariantNumeric: 'tabular-nums' }}>{it.label}</b>{it.name}<span style={{ fontSize: 12, color: on ? '#1f7a52' : '#8290a0', fontWeight: 700 }}>{on ? '使用' : '省略'}</span>
                  {omit && <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#eaf5ef', color: '#1f7a52' }}>省略できる様式</span>}
                  {!omit && it.omit && <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#fff7e6', color: '#8a5a00' }}>区分階層上は必要</span>}
                </label>
              ); })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 現行【共通の印刷設定】ダイアログ（マニュアル 7.1.2）と同じ並びにする */
const COMMON_DEPTHS = ['大区分まで印刷', '中区分まで印刷', '小区分まで印刷', '細区分まで印刷', '細々区分まで印刷', '個別の設定を使う'];
const COMMON_GAPS = ['上・下空き', '上のみ空き', '空きなし', '個別の設定を使う'];
const KOBETSU = '個別の設定を使う';
const FOOT_REPORTS = ['資金収支計算書（第一号第一様式）', '資金収支計算書（第一号第四様式）', '事業活動計算書', '貸借対照表'];
const STD_FORMAT = { widthName: 60, widthAmount: 28, fontHeader: 'Noto Sans JP 11pt', fontHeaderItem: 'Noto Sans JP 9pt', fontName: 'Noto Sans JP 9pt', fontAmount: 'Noto Sans JP 9pt', fontRemark: 'Noto Sans JP 9pt' };
type CommonFormat = typeof STD_FORMAT;

function RadioRow({ name, options, value, onChange, accent }: { name: string; options: string[]; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid ' + (on ? accent : '#dde4ea'), background: on ? '#f4f8f6' : '#fff', fontSize: 14, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(o)} style={{ accentColor: accent }} />{o}
          </label>
        );
      })}
    </div>
  );
}

const mmInput = (v: number, on: (n: number) => void) => <input className="field-input" value={String(v)} onChange={(e) => on(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} inputMode="numeric" style={numInput} />;
const fontSelect = (v: string, on: (x: string) => void) => <select value={v} onChange={(e) => on(e.target.value)} style={input}>{FONTS.map((o) => <option key={o}>{o}</option>)}</select>;

export function CommonPrintSettingsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const s = useSession();
  const p = s.print;
  const set = (patch: Partial<PrintCommon>) => setSession({ print: { ...p, ...patch } });
  const toast = useToast();
  // 最後に「決定」した時点の値。「中止」でここへ戻す
  const [base, setBase] = useState<PrintCommon>(p);
  const dirty = JSON.stringify(base) !== JSON.stringify(p);
  const [preview, setPreview] = useState(false);
  const [stamps, setStamps] = useState<string[] | null>(null);
  const [footList, setFootList] = useState(false);
  const [foot, setFoot] = useState<string | null>(null);
  const [footText, setFootText] = useState('');
  const [fmt, setFmt] = useState<CommonFormat | null>(null);
  const [inner, setInner] = useState<InnerFormat | null>(null);
  const item = (k: string) => !!p.items[k];
  const setItem = (k: string, v: boolean) => set({ items: { ...p.items, [k]: v } });
  const gapOff = p.lineGap === '空きなし' || p.lineGap === KOBETSU;
  const note: CSSProperties = { fontSize: 12, color: '#8290a0', lineHeight: 1.6 };
  const small = (on: boolean): CSSProperties => ({ ...btn('#5b6773', false, true), opacity: on ? 1 : 0.45, cursor: on ? 'pointer' : 'default' });
  const inn = p.inner ?? DEFAULT_INNER_FORMAT;
  const openFmt = () => setFmt({ widthName: p.widthName, widthAmount: p.widthAmount, fontHeader: p.fontHeader, fontHeaderItem: p.fontHeaderItem ?? STD_FORMAT.fontHeaderItem, fontName: p.fontName, fontAmount: p.fontAmount, fontRemark: p.fontRemark ?? STD_FORMAT.fontRemark });

  return (
    <SettingsShell variant={variant} editing={dirty} title={displayName('共通の印刷設定')} badge="印刷" desc={<>決算書の印刷に使う共通の設定です。各帳票の詳細設定にある「共通の印刷設定を反映」で、ここの値をその帳票に写します。</>} actions={<>
      <ScreenPrintMenu page="共通の印刷設定" accent={accent} />
      <IconButton icon="eye" label="プレビューで確認" data-common-preview onClick={() => setPreview(true)} />
      <LoadDivisionSettings icon accent={accent} kind="印刷設定" onDone={(from) => toast.show(`「${from}」の印刷設定を読み込みました`)} />
    </>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '16px 22px 0' }}>
        <Notice>仕訳日記帳・元帳・試算表・予算書など、決算書以外の帳票は、それぞれの詳細設定だけで印刷の内容を決めます。決算書の帳票も、帳票ごとに変えたい項目は詳細設定で変更できます。「個別の設定を使う」にした項目は、各帳票の詳細設定のとおりに印刷します。</Notice>
        {/* 中止・決定は説明文のすぐ下に置く */}
        <div data-common-actions style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12 }}>
      {dirty && <span data-common-dirty style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: '#fff7e6', color: '#8a5a00', alignSelf: 'center' }}>決定していない変更があります</span>}
      <button type="button" data-common-cancel disabled={!dirty} onClick={() => { setSession({ print: base }); toast.show('変更を取り消し、最後に決定した設定に戻しました'); }} style={{ ...btn(), opacity: dirty ? 1 : 0.45, cursor: dirty ? 'pointer' : 'default' }}>中止</button>
      <button type="button" className="submit-btn" data-common-save onClick={() => { setBase(p); toast.show('決算書 共通印刷設定を保存しました'); }} style={btn(accent, true)}>決定</button>
        </div>
      </div>
      <div data-common-main style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={card} data-common-sec="印刷位置">
            <div style={cardHead}>印刷位置</div>
            <div style={{ padding: 14, display: 'grid', gap: 8 }}>
              <div style={note}>印刷する勘定科目の範囲</div>
              <RadioRow name="印刷位置" options={COMMON_DEPTHS} value={COMMON_DEPTHS.includes(p.depth) ? p.depth : '細々区分まで印刷'} onChange={(v) => set({ depth: v })} accent={accent} />
            </div>
          </div>
          <div style={card} data-common-sec="行の間隔">
            <div style={cardHead}>行の間隔</div>
            <div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <RadioRow name="行の間隔" options={COMMON_GAPS} value={p.lineGap} onChange={(v) => set({ lineGap: v })} accent={accent} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: gapOff ? '#9aa5b1' : '#22303c' }}>空きの間隔
                <select value={p.gapSize} onChange={(e) => set({ gapSize: e.target.value })} disabled={gapOff} style={{ ...input, width: 120 }}>{['1mm', '2mm', '3mm', '4mm'].map((o) => <option key={o}>{o}</option>)}</select>
                <span style={note}>上・下空き／上のみ空きのとき選べます</span>
              </label>
            </div>
          </div>
          <div style={card} data-common-sec="内訳帳票設定">
            <div style={cardHead}>内訳帳票設定</div>
            <div style={{ padding: 14, display: 'grid', gap: 8, fontSize: 14 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={p.twoLineNames} onChange={(e) => set({ twoLineNames: e.target.checked })} style={{ accentColor: accent }} />項目名を二行で印刷する</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={p.autoFontHeader} onChange={(e) => set({ autoFontHeader: e.target.checked })} style={{ accentColor: accent }} />項目名のフォントサイズを自動調整する</label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>1ページの区分数<select value={String(p.perPage)} onChange={(e) => set({ perPage: Number(e.target.value) })} style={{ ...input, width: 90 }}>{[4, 5, 6, 7, 8].map((o) => <option key={o}>{o}</option>)}</select></label>
            </div>
          </div>
          <div style={card} data-common-sec="印刷位置調整">
            <div style={cardHead}>印刷位置調整・印刷書式</div>
            <div style={{ padding: 14, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 4, alignItems: 'center' }}>
                  <span /><button type="button" aria-label="上へ1mm" onClick={() => set({ offsetY: p.offsetY - 1 })} style={btn('#5b6773', false, true)}>↑</button><span />
                  <button type="button" aria-label="左へ1mm" onClick={() => set({ offsetX: p.offsetX - 1 })} style={btn('#5b6773', false, true)}>←</button><span />
                  <button type="button" aria-label="右へ1mm" onClick={() => set({ offsetX: p.offsetX + 1 })} style={btn('#5b6773', false, true)}>→</button>
                  <span /><button type="button" aria-label="下へ1mm" onClick={() => set({ offsetY: p.offsetY + 1 })} style={btn('#5b6773', false, true)}>↓</button><span />
                </div>
                <span style={{ fontSize: 12, color: '#5b6773', fontVariantNumeric: 'tabular-nums' }}>横 {p.offsetX}mm／縦 {p.offsetY}mm</span>
              </div>
              <div style={{ display: 'grid', gap: 10, flex: 1, minWidth: 220 }}>
                <div style={{ display: 'grid', gap: 2 }}><button type="button" data-open-format onClick={openFmt} style={{ ...btn(), justifySelf: 'start' }}>印刷書式</button><span style={note}>科目 {p.widthName}mm／金額 {p.widthAmount}mm・科目名 {p.fontName}</span></div>
                <div style={{ display: 'grid', gap: 2 }}><button type="button" data-open-inner-format onClick={() => setInner({ ...inn })} style={{ ...btn(), justifySelf: 'start' }}>内訳書の印刷書式</button><span style={note}>{inn.paper}・{inn.orient}／科目 {inn.widthName}mm／金額 {inn.widthAmount}mm</span></div>
              </div>
            </div>
          </div>
        </div>
        <div style={card} data-common-sec="印刷項目の切替え">
          <div style={cardHead}>印刷項目の切替え</div>
          <div style={{ padding: '6px 14px 10px' }}>
            {PRINT_ITEMS.map(([k, label], i) => {
              const dis = k === 'head2' && !item('top');
              return (
                <div key={k} data-print-item={k} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 0', borderTop: i ? '1px solid #f1f4f7' : 'none' }}>
                  <label style={{ flex: 1, minWidth: 240, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: dis ? '#9aa5b1' : '#22303c', cursor: dis ? 'default' : 'pointer' }}>
                    <input type="checkbox" checked={item(k)} disabled={dis} onChange={(e) => setItem(k, e.target.checked)} style={{ accentColor: accent, marginTop: 4 }} />
                    <span>{label}
                      {k === 'zero' && <span style={{ ...note, display: 'block' }}>決算書の各帳票の初期値です。帳票ごとに変更できます</span>}
                      {k === 'head2' && <span style={{ ...note, display: 'block' }}>「常に最上行の上に横線を印刷する」を有効にすると選べます</span>}
                      {k === 'stamp' && item('stamp') && <span style={{ ...note, display: 'block' }}>{p.stamps.filter(Boolean).join('・') || '氏名が未入力です'}</span>}
                    </span>
                  </label>
                  {k === 'stamp' && <button type="button" data-open-stamp disabled={!item('stamp')} onClick={() => setStamps([...p.stamps])} style={small(item('stamp'))}>捺印欄</button>}
                  {k === 'note' && <button type="button" data-open-footnote disabled={!item('note')} onClick={() => setFootList(true)} style={small(item('note'))}>脚注編集</button>}
                  {k === 'page' && <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: item('page') ? '#5b6773' : '#9aa5b1' }}>開始番号<input className="field-input" value={String(p.pageStart)} disabled={!item('page')} onChange={(e) => set({ pageStart: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1 })} inputMode="numeric" style={{ ...numInput, width: 64, padding: '4px 8px' }} /></label>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 現行では別のメニューや動作環境にある設定。決算書の印刷に関わるのでここにまとめる */}
      <div data-common-extra style={{ padding: '0 22px 22px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #e2e8ee', paddingTop: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#3d4a56' }}>あわせて使う設定</span>
          <span style={note}>現行では印刷メニューの「様式設定」や動作環境にある設定です</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'start' }}>
          <FormSelectCard />
          <div style={{ display: 'grid', gap: 18 }}>
            <ZeroExcludeCard accent={accent} />
            <div style={card}>
              <div style={cardHead}>帳票の色・印字 <span style={{ fontSize: 12, fontWeight: 500, color: '#8290a0', marginLeft: 6 }}>予算書・試算表・仕訳日記帳の罫線と網掛けにも使います</span></div>
              <div style={{ padding: 14 }}><ReportStyleSettings accent={accent} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* 捺印欄 */}
      <Modal open={!!stamps} onClose={() => setStamps(null)} width={520} title="捺印欄">
        {stamps && <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <div style={note}>捺印欄に印刷する氏名を、最大4名まで入力します。</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{stamps.map((v, i) => <Field key={i} label={`捺印欄 ${i + 1}`}><input className="field-input" value={v} onChange={(e) => setStamps(stamps.map((x, k) => (k === i ? e.target.value : x)))} style={input} /></Field>)}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setStamps(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { set({ stamps }); setStamps(null); }} style={btn(accent, true)}>OK</button></div>
        </div>}
      </Modal>

      {/* 脚注編集：帳票一覧 */}
      <Modal open={footList} onClose={() => setFootList(false)} width={620} title="脚注編集">
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
          <div style={note}>帳票をクリックすると、脚注を編集できます。</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{FOOT_REPORTS.map((r) => (
            <tr key={r} data-foot-report={r} className="row-hover" onClick={() => { setFoot(r); setFootText(p.footnotes[r] ?? ''); }}>
              <td style={{ ...TD, fontSize: 14 }}>{r}</td>
              <td style={{ ...TD, fontSize: 12, color: '#7a8794' }}>{p.footnotes[r] ? p.footnotes[r].slice(0, 24) + (p.footnotes[r].length > 24 ? '…' : '') : '（未設定）'}</td>
              <td style={{ ...TD, textAlign: 'right' }}><button type="button" onClick={() => { setFoot(r); setFootText(p.footnotes[r] ?? ''); }} style={btn('#5b6773', false, true)}>編集</button></td>
            </tr>
          ))}</tbody></table>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setFootList(false)} style={btn()}>キャンセル</button></div>
        </div>
      </Modal>
      <Modal open={!!foot} onClose={() => setFoot(null)} width={560} title={`脚注編集：${foot ?? ''}`}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
          <textarea value={footText} onChange={(e) => setFootText(e.target.value)} rows={5} placeholder="（注）予備費の充当額 ○○円 は …" style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
          <Notice tone="warn">脚注は帳票の最下部に印刷されます。改行はそのまま反映されます。長すぎると2ページ目に送られることがあります。</Notice>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setFoot(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { if (foot) set({ footnotes: { ...p.footnotes, [foot]: footText } }); setFoot(null); }} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>

      {/* 共通の印刷書式設定 */}
      <Modal open={!!fmt} onClose={() => setFmt(null)} width={600} title="共通の印刷書式設定">
        {fmt && <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="印刷幅：科目（mm）">{mmInput(fmt.widthName, (n) => setFmt({ ...fmt, widthName: n }))}</Field>
            <Field label="印刷幅：金額（mm）">{mmInput(fmt.widthAmount, (n) => setFmt({ ...fmt, widthAmount: n }))}</Field>
            {([['fontHeader', 'ヘッダー'], ['fontHeaderItem', 'ヘッダー項目名'], ['fontName', '科目名'], ['fontAmount', '金額'], ['fontRemark', '備考']] as const).map(([k, l]) => <Field key={k} label={`フォント：${l}`}>{fontSelect(fmt[k], (v) => setFmt({ ...fmt, [k]: v }))}</Field>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setFmt({ ...STD_FORMAT })} style={btn()}>リセット</button>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setFmt(null)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => { set(fmt); setFmt(null); }} style={btn(accent, true)}>OK</button>
          </div>
        </div>}
      </Modal>

      {/* 内訳書の共通の印刷書式 */}
      <Modal open={!!inner} onClose={() => setInner(null)} width={640} title="内訳書 - 共通の印刷書式設定">
        {inner && <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="用紙サイズ"><select value={inner.paper} onChange={(e) => setInner({ ...inner, paper: e.target.value as InnerFormat['paper'] })} style={input}><option value="A4">A4</option><option value="A3">A3（A3 対応プリンターのみ）</option></select></Field>
            <Field label="用紙方向"><select value={inner.orient} onChange={(e) => setInner({ ...inner, orient: e.target.value as InnerFormat['orient'] })} style={input}><option>縦</option><option>横</option></select></Field>
            {([['fontHeader', 'ヘッダー'], ['fontHeaderItem', 'ヘッダー項目名'], ['fontName', '科目名'], ['fontAmount', '金額']] as const).map(([k, l]) => <Field key={k} label={`フォント：${l}`}>{fontSelect(inner[k], (v) => setInner({ ...inner, [k]: v }))}</Field>)}
            <Field label="印刷幅：科目（mm）">{mmInput(inner.widthName, (n) => setInner({ ...inner, widthName: n }))}</Field>
            <Field label="印刷幅：金額（mm）">{mmInput(inner.widthAmount, (n) => setInner({ ...inner, widthAmount: n }))}</Field>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}><input type="checkbox" checked={inner.deptEveryPage} onChange={(e) => setInner({ ...inner, deptEveryPage: e.target.checked })} style={{ accentColor: accent }} />2ページ以降も部門名を印刷する</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setInner({ ...DEFAULT_INNER_FORMAT })} style={btn()}>リセット</button>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setInner(null)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={() => { set({ inner }); setInner(null); }} style={btn(accent, true)}>OK</button>
          </div>
        </div>}
      </Modal>

      <PreviewModal open={preview} onClose={() => setPreview(false)} title="資金収支計算書（共通設定の確認）" opts={{ from: '令和8年4月1日', to: '令和8年8月31日', output: OUTPUTS[1] }} accent={accent} hideZero={!!p.items.zero} />
    </SettingsShell>
  );
}

export function PrintTableHead({ cols }: { cols: string[] }) { return <thead><tr>{cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr></thead>; }
