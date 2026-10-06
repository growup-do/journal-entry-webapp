// 帳票の印刷（提案C／依頼書 5.1.1・5.5.1・6.3・6.5）
//   印刷の流れ「帳票選択 → 基本条件（期間・区分）→ 詳細設定 → 出力先 → 印刷／プレビュー」を、1つのダイアログ（または画面内パネル）で完結させる。
//   詳細設定は影響範囲で 3 つに分けて表示する：
//     ① この帳票のみの設定（帳票個別）　② 全帳票共通の設定（共通の印刷設定。その場で変更可）　③ 動作環境から引き継ぐ設定（全区分共通／区分ごと。確認のみ）
//   各帳票画面には PrintButton を置き、画面内から同じ流れを開く（5.1.1）。
//   金額は動作環境の金額書式（桁区切り・負数の表記と色）で表示し、0円行は「0データを表示しない」に従って省く（6.5）。

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { Modal } from './Modal';
import { TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { Field, Notice, SettingsShell, Toggle, btn, card, cardHead, input, lbl, numInput } from './ui';
import { ExportDialog, runExport, type ExportKind, type ExportSpec } from './ExportDialog';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { ACCOUNTS, displayName } from '../data';
import { PRINT_ITEMS, divisionLabel, flattenDivisions, setSession, startKindOf, useSession, type EnvSettings, type PrintCommon, type Session } from '../store/session';

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
export type ScopeKind = '帳票個別' | '全帳票共通' | '全区分共通' | '区分ごと';
const SCOPE_STYLE: Record<ScopeKind, { bg: string; fg: string; bd: string; hint: string }> = {
  帳票個別: { bg: '#e8f0fb', fg: '#2c5f9e', bd: '#c9d9ec', hint: 'この帳票の印刷だけに影響します' },
  全帳票共通: { bg: '#f1eafb', fg: '#6b3fa0', bd: '#dccdf0', hint: 'すべての帳票の印刷に影響します' },
  全区分共通: { bg: '#e4f1f0', fg: '#1f6f6b', bd: '#bfdcd9', hint: 'システム全体（すべての区分）に影響します' },
  区分ごと: { bg: '#fff3dc', fg: '#8a5a00', bd: '#f0dcae', hint: '起動中の区分だけに影響します' },
};
export function ScopeBadge({ kind, label }: { kind: ScopeKind; label?: string }) {
  const c = SCOPE_STYLE[kind];
  return <span title={c.hint} style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap', lineHeight: 1.5 }}>{label ?? kind}</span>;
}
/** 影響範囲ごとのまとまり（見出しにバッジと説明を付けた枠） */
export function ScopeBlock({ kind, title, desc, right, children }: { kind?: ScopeKind; title: string; desc?: ReactNode; right?: ReactNode; children: ReactNode }) {
  const c = kind ? SCOPE_STYLE[kind] : { bg: '#f3f6f9', bd: '#dde4ea' };
  return (
    <section style={{ border: '1px solid ' + c.bd, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: c.bg, flexWrap: 'wrap' }}>
        {kind && <ScopeBadge kind={kind} />}
        <b style={{ fontSize: 13 }}>{title}</b>
        {desc && <span style={{ fontSize: 11.5, color: '#5b6773' }}>{desc}</span>}
        {right && <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>{right}</span>}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </section>
  );
}

export interface ReportDef { id: string; name: string; cat: string; note?: string; detail: string[]; scope?: boolean; /** 年次の帳票（期間は会計年度の期首〜期末。月の指定なし） */ annual?: boolean; }
const D = {
  journal: ['伝票番号：入力番号／自動連番（番号指定）／自動連番（Seq-No）／Seq指定', '印刷順序：入力順／日付順', '印刷科目：印刷用／表示用', '伝票種別：通常伝票／移行伝票', '伝票区分を印刷する', '科目コードを印刷する', '入力予備1（2）を印刷する', 'A4縦に印刷する', '摘要のフォントサイズを自動調整する'],
  voucher: ['伝票番号の種類', '印刷順序', 'タイトル印刷', 'カラー印刷時の基調色：緑／動作環境の色指定', '科目欄：科目／入力コード・科目／科目名・資金科目', '業者名を印刷する', '複写の伝票を印刷する', '証ひょうの有無を印刷する', 'A4白紙に印刷する（上下連続）', 'A5白紙に印刷する', '元号を印字する'],
  ledger: ['残高のみも印刷する', '月計を印刷する', '合計を印刷する（年間で集計）', '月次で改頁する', '月計だけ印刷する', '残高を日計で印刷する', 'Seq番号を印刷する', '現金・預金の表題を変更する', '残高0も印刷する', '証憑の有無を印刷する', '入力予備1（2）を印刷する', 'A4白紙に印刷する', '摘要行も印刷する（空白は印刷しない）', '貸借の金額が一致する行を消し込む', '伝票入力区分名を印刷する', 'カラー印刷時の基調色：緑／青／動作環境'],
  trial: ['費目行を網掛け、太字にする', '費目下を太線にする', '区分名を印刷する', '項目・科目毎に横線を印刷する', '脚注を印刷する', '科目名のフォントサイズを自動調整する'],
  closing: ['資金収支計算書予備費充当額（円）／注記の予備費充当額を自動印刷する', '貸借対照表内訳表：連続型印刷をする', '費目行を網掛け、太字にする', '区分名を印刷する'],
  budget: ['前年度予算額を印刷する', '補正予算の内訳（月別）を印刷する', '費目行を網掛け、太字にする', '区分名を印刷する'],
  sub: ['明細表内に印刷する金額の指定（伝票を選択）', '印刷日付の指定：日付印刷しない／期首〜期末／指定月', 'タイトル（全角20文字）', '業者コード小計：同一業者コードがあった場合集計する', '合計行を網掛け、太字にする', '区分名を印刷する'],
  analysis: ['タイトル印刷', '伝票入力区分名を印刷する', '単位：円／千円／百万円', 'グラフ数（1ページ 3〜8個）', '縦軸スケールを自動調整', '平均値の表示'],
};
export const REPORTS: ReportDef[] = [
  { id: 'j1', name: '仕訳日記帳', cat: '仕訳日記帳', detail: D.journal },
  { id: 'j2', name: '仕訳伝票（伝票式）', cat: '仕訳日記帳', detail: D.voucher },
  { id: 'j3', name: '振替伝票（振替式）', cat: '仕訳日記帳', detail: D.voucher },
  { id: 'l1', name: '総勘定元帳', cat: '元帳', scope: true, detail: D.ledger },
  { id: 'l2', name: '資金元帳', cat: '元帳', scope: true, detail: [...D.ledger, '合計印刷時に予算残を印刷する'] },
  { id: 'l3', name: '業者元帳', cat: '元帳', scope: true, detail: [...D.ledger, '合計印刷時に予算残を印刷する'] },
  { id: 'l4', name: '集計元帳', cat: '元帳', scope: true, detail: D.ledger },
  { id: 't1', name: '資金収支計算書（試算表）', cat: '試算表', detail: D.trial },
  { id: 't2', name: '事業活動計算書（試算表）', cat: '試算表', detail: D.trial },
  { id: 't3', name: '貸借対照表（試算表）', cat: '試算表', detail: D.trial },
  { id: 't4', name: '資金収支残高試算表', cat: '試算表', detail: D.trial },
  { id: 't5', name: '残高試算表', cat: '試算表', detail: D.trial },
  { id: 'b1', name: '予算書', cat: '予算', detail: D.budget },
  { id: 'b2', name: '予算管理表（予算対比表）', cat: '予算', detail: D.budget },
  { id: 'c1', name: '資金収支計算書（第一号様式）', cat: '決算書', note: '帳票選択で有効にした様式のみ', detail: D.closing },
  { id: 'c2', name: '事業活動計算書（第二号様式）', cat: '決算書', detail: D.closing },
  { id: 'c3', name: '貸借対照表（第三号様式）', cat: '決算書', detail: D.closing },
  { id: 'c4', name: '財務諸表に対する注記', cat: '決算書', note: '編集と印刷は「別紙」画面', detail: ['注記の予備費充当額を自動印刷する'] },
  { id: 'c5', name: '決算附属明細書（3①〜3⑲）', cat: '決算書', note: '明細入力と印刷は「別紙」画面', detail: D.closing },
  { id: 'c6', name: '財産目録', cat: '決算書', note: '行設定と印刷は「別紙」画面', detail: ['差引純資産を網掛け、太字にする', '行送り（標準6.4mm）'] },
  { id: 'c7', name: '準決算書（C別紙6〜9／C1-5〜C3-6）', cat: '決算書', detail: D.closing },
  { id: 's1', name: '補助簿（未払金・未収金）', cat: '補助簿（明細表）', detail: D.sub },
  { id: 's2', name: '補助簿（現預金・預かり金）', cat: '補助簿（明細表）', detail: D.sub },
  { id: 'o1', name: '自動按分出力（CSV）', cat: 'その他', detail: ['出力種類：貸借対照表／事業活動計算書／資金収支計算書の按分出力', '出力する列：当年度末／前年度末／増減', '合計値を印刷', '端数の加算区分'] },
  { id: 'o2', name: '収支分析表', cat: 'その他', detail: ['金額を千円単位で表示する', '設定（科目名称・金額の決定方法・色）'] },
  { id: 'a1', name: '財務分析一覧表（5年）', cat: '経営分析', detail: D.analysis },
  { id: 'a2', name: '財務分析グラフ（10年）', cat: '経営分析', detail: D.analysis },
  { id: 'a3', name: '経年推移表／経月推移表', cat: '経営分析', detail: D.analysis },
  { id: 'a4', name: '前年度同月対比表', cat: '経営分析', detail: D.analysis },
  { id: 'a5', name: '3期連続資金収支比較表', cat: '経営分析', detail: ['当年度予算予想額の算出方法：当月より倍率／当月累計＋過去の平均', '千円単位にする', ...D.analysis] },
];
const CATS = ['仕訳日記帳', '元帳', '試算表', '予算', '決算書', '補助簿（明細表）', 'その他', '経営分析'];
export const OUTPUTS = ['プリンターから印刷する', '画面へプレビューする', 'エクセル互換ファイル（CSV）へ出力する', 'Excelファイル出力', 'PDFファイル出力'];

/** 画面の帳票名から印刷対象の帳票を探す。一覧にない名前は、その画面専用の帳票として扱う */
export function findReport(name: string): ReportDef {
  const exact = REPORTS.find((r) => r.name === name);
  if (exact) return exact;
  const part = REPORTS.find((r) => r.name.includes(name) || name.includes(r.name.replace(/（.*$/, '')));
  if (part) return part;
  const KEY: [RegExp, string][] = [[/日記帳|仕訳一覧/, 'j1'], [/資金元帳/, 'l2'], [/業者元帳|業者別支払/, 'l3'], [/元帳/, 'l1'], [/試算/, 't1'], [/予算/, 'b2'], [/決算/, 'c1'], [/推移/, 'a3']];
  const hit = KEY.find(([re]) => re.test(name));
  const base = hit ? REPORTS.find((r) => r.id === hit[1]) : undefined;
  return { id: 'screen:' + name, name, cat: base?.cat ?? '画面の帳票', scope: base?.scope, detail: base?.detail ?? ['タイトルを印刷する', '区分名を印刷する'] };
}

/* ---------------- 印刷の流れ（1つのパネルで完結） ---------------- */
const FLOW_STEPS = ['帳票選択', '基本条件', '詳細設定', '出力先', '印刷／プレビュー'];
const DESTS: { out: string; label: string; desc: string; action: string }[] = [
  { out: OUTPUTS[0], label: 'プリンター', desc: '用紙に印刷します', action: '印刷' },
  { out: OUTPUTS[4], label: 'PDF', desc: 'PDF ファイルとして保存します', action: 'PDFで保存' },
  { out: OUTPUTS[3], label: 'Excel', desc: 'Excel ファイルとして保存します', action: 'Excelで保存' },
  { out: OUTPUTS[2], label: 'CSV', desc: 'エクセル互換（カンマ区切り）で保存します', action: 'CSVで保存' },
];
const DEPTHS = ['大区分まで印刷', '中区分まで印刷', '小区分まで印刷', '細区分まで印刷', '細々区分まで印刷'];
const FONTS = ['Noto Sans JP 9pt', 'Noto Sans JP 10pt', 'Noto Sans JP 11pt', 'Noto Serif JP 10pt', 'ＭＳ 明朝 10pt', 'ＭＳ ゴシック 10pt'];
/** 備考・摘要設定を保持する単位（依頼書 3.2：1つには統合しない） */
export const REMARK_UNITS = ['法人の決算書', '拠点の決算書', 'サービス区分の資金収支計算書'];
function remarkUnitOf(s: Session): string {
  const k = flattenDivisions(s.tree).find((x) => divisionLabel(x.node) === s.division)?.node.kind;
  return k === '法人' || k === '事業区分' ? REMARK_UNITS[0] : k === 'サービス区分' || k === '小サービス区分' ? REMARK_UNITS[2] : REMARK_UNITS[1];
}
const usesRemark = (r: ReportDef) => r.cat === '決算書' || r.cat === '予算' || /資金収支計算書/.test(r.name);
const usesDepth = (r: ReportDef) => r.cat === '試算表' || r.cat === '決算書' || r.cat === '予算';

const eraYear = (fy: string) => parseInt(fy.replace(/[^0-9]/g, ''), 10) || 8;
const monthNo = (m: string) => (m === '決' ? 3 : Number(m));
const monthYear = (fy: number, m: string) => (monthNo(m) <= 3 ? fy + 1 : fy);
const monthStart = (fy: number, m: string) => `令和${monthYear(fy, m)}年${monthNo(m)}月1日`;
const monthEnd = (fy: number, m: string) => `令和${monthYear(fy, m)}年${monthNo(m)}月${new Date(2018 + monthYear(fy, m), monthNo(m), 0).getDate()}日`;

interface FlowPrefs {
  months: string[]; from: string; to: string; range: string; scope: string; target: string;
  checks: { check: boolean; red: boolean; blue: boolean; yellow: boolean; green: boolean };
  output: string; zeroHide: boolean; title: string; depthOwn: boolean; depth: string; detail: Record<string, boolean>;
}
/** 帳票ごとの印刷条件（この帳票のみの設定）。開き直しても前回の条件を引き継ぐ */
const PREFS = new Map<string, FlowPrefs>();
const defaultPrefs = (r: ReportDef, fy: number, common: PrintCommon): FlowPrefs => ({
  months: r.annual ? [] : ['8'], from: monthStart(fy, r.annual ? '4' : '8'), to: monthEnd(fy, r.annual ? '3' : '8'), range: '範囲指定の合計を印刷', scope: '全て', target: '起動中の区分',
  checks: { check: false, red: false, blue: false, yellow: false, green: false },
  output: OUTPUTS[0], zeroHide: !!common.items.zero, title: r.name, depthOwn: false, depth: DEPTHS.includes(common.depth) ? common.depth : DEPTHS[4],
  detail: Object.fromEntries(r.detail.map((d) => [d, /印刷する$|自動調整|網掛け/.test(d)])),
});

export interface PrintFlowProps {
  report: ReportDef;
  accent: string;
  /** 画面の実データ（省略時は帳票ごとのサンプル表） */
  data?: TableData;
  onPreview: (title: string, opts: { from: string; to: string; output: string; hideZero?: boolean }) => void;
  /** キャンセル／出力完了で閉じる（画面内パネルでは省略可） */
  onClose?: () => void;
  /** 帳票を固定する（別紙など、画面で帳票が決まっている場合） */
  lockReport?: boolean;
  onReportChange?: (r: ReportDef) => void;
}

export function PrintFlow({ report, accent, data, onPreview, onClose, lockReport, onReportChange }: PrintFlowProps) {
  const s = useSession();
  const toast = useToast();
  const fy = eraYear(s.fiscalYear);
  const [step, setStep] = useState(1);
  const [p, setP] = useState<FlowPrefs>(() => PREFS.get(report.id) ?? defaultPrefs(report, fy, s.print));
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const [commonOpen, setCommonOpen] = useState(false);
  const [snap] = useState<PrintCommon>(() => s.print);
  const [unit, setUnit] = useState(() => remarkUnitOf(s));
  useEffect(() => { PREFS.set(report.id, p); }, [report.id, p]);
  const set = (patch: Partial<FlowPrefs>) => setP((x) => ({ ...x, ...patch }));
  const pr = s.print;
  const setCommon = (patch: Partial<PrintCommon>) => setSession({ print: { ...pr, ...patch } });
  const changed = (Object.keys(pr) as (keyof PrintCommon)[]).filter((k) => k !== 'unitRemarks' && JSON.stringify(pr[k]) !== JSON.stringify(snap[k])).length;
  const kind = startKindOf(s);
  const myUnit = remarkUnitOf(s);
  const dest = DESTS.find((d) => d.out === p.output) ?? DESTS[0];
  const detailItems = report.detail.filter((d) => !/0データ|印刷位置|行の間隔|ページ番号|捺印欄|共通の印刷設定/.test(d));
  const onCount = detailItems.filter((d) => p.detail[d]).length;

  const toggleMonth = (m: string) => {
    const n = new Set(p.months);
    if (n.has(m)) n.delete(m); else n.add(m);
    const arr = FISCAL_MONTHS.filter((x) => n.has(x));
    set(arr.length ? { months: arr, from: monthStart(fy, arr[0]), to: monthEnd(fy, arr[arr.length - 1]) } : { months: arr });
  };
  const table = (): TableData => { const base = data ?? sampleReportData(report.name); return p.zeroHide ? dropZeroRows(base).data : base; };
  const preview = () => onPreview(report.name, { from: p.from, to: p.to, output: OUTPUTS[1], hideZero: p.zeroHide });
  const run = () => {
    const kindOut = outputKind(p.output) ?? 'print';
    const spec: ExportSpec = { kind: kindOut, title: p.title.trim() || report.name, meta: `${p.from}〜${p.to}　${s.division}${report.scope && p.scope === '科目指定' ? '　科目指定' : ''}`, ...table() };
    if (kindOut === 'print') { toast.show(runExport(spec)); onClose?.(); return; }
    // ファイル出力は【名前を付けて保存】を経由する
    setExp(spec);
  };

  const chip = (on: boolean): CSSProperties => ({ minWidth: 30, height: 26, padding: '0 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? accent : '#d3dbe3') });
  const radio = (on: boolean): CSSProperties => ({ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 8px', borderRadius: 8, background: on ? '#eef2f6' : 'transparent', fontSize: 12.5, cursor: 'pointer' });
  const summary = [
    `${report.name}`,
    `${p.from}〜${p.to}`,
    `この帳票のみ ${onCount + (p.zeroHide ? 1 : 0)} 項目${changed ? `／共通 ${changed} 項目を変更` : ''}`,
    dest.label,
    '',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ToastView msg={toast.msg} />
      {/* 手順の表示（クリックで移動できる） */}
      <div style={{ display: 'flex', gap: 0, padding: '12px 18px 0', flexWrap: 'wrap' }}>
        {FLOW_STEPS.map((label, i) => {
          const on = i === step, done = i < step;
          return (
            <button key={label} type="button" onClick={() => setStep(i)} aria-current={on ? 'step' : undefined} style={{ flex: '1 1 120px', minWidth: 0, textAlign: 'left', padding: '8px 10px 9px', border: 'none', borderBottom: '3px solid ' + (on ? accent : done ? '#b9c6d2' : '#e2e8ee'), background: on ? '#f6f8fa' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: on ? accent : done ? '#8a97a5' : '#e2e8ee', color: on || done ? '#fff' : '#8290a0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? '#22303c' : '#5b6773', whiteSpace: 'nowrap' }}>{label}</span>
              </span>
              <span style={{ display: 'block', fontSize: 10.5, color: '#8290a0', marginTop: 3, paddingLeft: 26, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 15 }}>{summary[i]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '16px 18px 4px', display: 'grid', gap: 14 }}>
        {step === 0 && (
          lockReport || !onReportChange ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ ...card, padding: '12px 14px', borderColor: accent, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{report.name}</div><div style={{ fontSize: 11.5, color: '#8290a0', marginTop: 2 }}>{report.cat}</div></div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: accent }}>印刷する帳票</span>
              </div>
              <Notice>表示中の画面の帳票を印刷します。ほかの帳票は、それぞれの帳票の画面にある「印刷」から印刷します。</Notice>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={lbl}>印刷する帳票（{report.cat}）</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                {(REPORTS.some((r) => r.cat === report.cat) ? REPORTS.filter((r) => r.cat === report.cat) : [report]).map((r) => {
                  const on = r.id === report.id;
                  return <label key={r.id} style={{ ...card, padding: '9px 12px', display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', borderColor: on ? accent : '#e2e8ee', background: on ? '#f6f9fc' : '#fff' }}><input type="radio" checked={on} onChange={() => onReportChange(r)} style={{ marginTop: 3 }} /><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{r.name}</span>{r.note && <span style={{ display: 'block', fontSize: 11, color: '#8290a0' }}>{r.note}</span>}</span></label>;
                })}
              </div>
              <div style={{ fontSize: 11.5, color: '#8290a0' }}>ほかの分類の帳票は「{displayName('印刷センター')}」の一覧、または各帳票の画面から選びます。</div>
            </div>
          )
        )}

        {step === 1 && (
          <>
            <div>
              <span style={lbl}>{report.annual ? '期間（年次の帳票のため、会計年度の期首〜期末）' : '期間（月のボタンでも指定できます。複数選ぶと最初の月〜最後の月）'}</span>
              {!report.annual && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>{FISCAL_MONTHS.map((m) => <button key={m} type="button" onClick={() => toggleMonth(m)} style={chip(p.months.includes(m))}>{m}</button>)}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><input className="field-input" value={p.from} onChange={(e) => set({ from: e.target.value })} style={{ ...input, width: 170 }} aria-label="開始日" /><span>〜</span><input className="field-input" value={p.to} onChange={(e) => set({ to: e.target.value })} style={{ ...input, width: 170 }} aria-label="終了日" /><span style={{ fontSize: 11.5, color: '#8290a0' }}>会計年度：{s.fiscalYear}</span></div>
            </div>
            <div>
              <span style={lbl}>区分</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                <b>{s.division}</b><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56' }}>{kind}で起動中</span>
                {kind !== '入力区分' && <span style={{ display: 'flex', gap: 4 }}>{['起動中の区分', '構成する区分ごと'].map((o) => <label key={o} style={radio(p.target === o)}><input type="radio" checked={p.target === o} onChange={() => set({ target: o })} />{o === '起動中の区分' ? '合計で印刷' : '構成する区分ごとに印刷'}</label>)}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: '#8290a0', marginTop: 4 }}>印刷する区分を変える場合は、画面上部の区分の切替で区分を選び直します。</div>
            </div>
            {(report.cat === '仕訳日記帳' || report.cat === '元帳') && (
              <div>
                <span style={lbl}>チェック・付箋で絞り込む（選ばなければ全件）</span>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
                  <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={p.checks.check} onChange={() => set({ checks: { ...p.checks, check: !p.checks.check } })} />チェック</label>
                  {([['red', '赤', '#c0392b'], ['blue', '青', '#2c5f9e'], ['yellow', '黄', '#b7791f'], ['green', '緑', '#1f7a52']] as const).map(([k, l, c]) => <label key={k} style={{ display: 'flex', gap: 5, alignItems: 'center', color: c }}><input type="checkbox" checked={p.checks[k]} onChange={() => set({ checks: { ...p.checks, [k]: !p.checks[k] } })} />付箋（{l}）</label>)}
                </div>
              </div>
            )}
            {report.scope && (
              <div><span style={lbl}>科目の範囲</span><div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>{['全て', '科目指定'].map((o) => <label key={o} style={radio(p.scope === o)}><input type="radio" checked={p.scope === o} onChange={() => set({ scope: o })} />{o}</label>)}{p.scope === '科目指定' && <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input className="field-input" placeholder="開始科目" style={{ ...input, width: 150 }} /><span>〜</span><input className="field-input" placeholder="終了科目" style={{ ...input, width: 150 }} /></span>}</div></div>
            )}
            {usesDepth(report) && (
              <div><span style={lbl}>範囲指定の種類</span><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{['範囲指定の合計を印刷', '範囲指定の月を連続で印刷'].map((o) => <label key={o} style={radio(p.range === o)}><input type="radio" checked={p.range === o} onChange={() => set({ range: o })} />{o}</label>)}</div></div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <ScopeBlock kind="帳票個別" title="この帳票のみの設定" desc={`「${report.name}」の印刷だけに反映されます。ほかの帳票には影響しません。`}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
                    <Toggle on={p.zeroHide} onChange={(v) => set({ zeroHide: v })} accent={accent} label="0データを表示しない" />
                    <span style={{ fontSize: 11.5, color: '#8290a0', paddingLeft: 46 }}>金額がすべて 0 円の行を印刷・プレビューから省きます。</span>
                  </div>
                  <Field label="タイトル（印刷様式）"><input className="field-input" value={p.title} onChange={(e) => set({ title: e.target.value })} style={input} /></Field>
                  {usesDepth(report) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={lbl}>印刷範囲（印刷する科目の階層）</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={radio(!p.depthOwn)}><input type="radio" checked={!p.depthOwn} onChange={() => set({ depthOwn: false })} />共通の設定に従う（{pr.depth}）</label>
                        <label style={radio(p.depthOwn)}><input type="radio" checked={p.depthOwn} onChange={() => set({ depthOwn: true })} />この帳票だけ変える</label>
                        {p.depthOwn && <select value={p.depth} onChange={(e) => set({ depth: e.target.value })} style={{ ...input, width: 200 }}>{[...DEPTHS, '科目毎に指定'].map((o) => <option key={o}>{o}</option>)}</select>}
                      </div>
                    </div>
                  )}
                </div>
                {detailItems.length > 0 && (
                  <div>
                    <span style={lbl}>この帳票の印刷項目</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '4px 12px' }}>
                      {detailItems.map((d) => <label key={d} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={!!p.detail[d]} onChange={() => set({ detail: { ...p.detail, [d]: !p.detail[d] } })} style={{ marginTop: 3 }} /><span>{d}</span></label>)}
                    </div>
                  </div>
                )}
                {usesRemark(report) && (
                  <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 12.5 }}>備考・摘要</b><span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: '#eef2f6', color: '#3d4a56' }}>単位ごとに保持</span><span style={{ fontSize: 11.5, color: '#8290a0' }}>法人・拠点・サービス区分で内容が異なる場合があるため、単位ごとに別々に保存します。</span></div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{REMARK_UNITS.map((u) => <button key={u} type="button" onClick={() => setUnit(u)} style={btn(unit === u ? accent : '#5b6773', unit === u, true)}>{u}{u === myUnit ? '（今回の印刷で使用）' : ''}</button>)}</div>
                    <textarea value={pr.unitRemarks[unit] ?? ''} onChange={(e) => setCommon({ unitRemarks: { ...pr.unitRemarks, [unit]: e.target.value } })} rows={3} placeholder={`${unit}の備考欄に印刷する文字`} style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
                    {unit !== myUnit && <div style={{ fontSize: 11.5, color: '#8a5a00' }}>起動中の区分（{s.division}）の印刷では「{myUnit}」の備考を使います。ここで編集した内容は「{unit}」を印刷するときに使われます。</div>}
                  </div>
                )}
              </div>
            </ScopeBlock>

            <ScopeBlock kind="全帳票共通" title="全帳票共通の設定" desc="共通の印刷設定（印刷位置・行間・フォント・捺印欄・ページ番号）。" right={<button type="button" onClick={() => setCommonOpen((o) => !o)} style={btn('#6b3fa0', false, true)}>{commonOpen ? '閉じる' : 'ここで変更する'}</button>}>
              {!commonOpen ? (
                <div style={{ display: 'flex', gap: '4px 16px', flexWrap: 'wrap', fontSize: 12, color: '#48565f' }}>
                  <span>印刷位置：{pr.depth}</span><span>行の間隔：{pr.lineGap}{pr.lineGap === '空きなし' ? '' : `（${pr.gapSize}）`}</span><span>位置調整：横 {pr.offsetX}mm／縦 {pr.offsetY}mm</span><span>フォント：{pr.fontName}</span><span>捺印欄：{pr.items.stamp ? pr.stamps.filter(Boolean).join('・') || '（氏名なし）' : '印刷しない'}</span><span>ページ番号：{pr.items.page ? `印刷する（${pr.pageStart} から）` : '印刷しない'}</span>
                  {changed > 0 && <span style={{ color: '#6b3fa0', fontWeight: 700 }}>{changed} 項目を変更済み（全帳票に反映）</span>}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <Notice tone="warn">ここを変更すると、この帳票だけでなく<b>すべての帳票</b>の印刷に反映されます。この帳票だけ変えたい場合は、上の「この帳票のみの設定」を使います。</Notice>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <Field label="印刷位置（印刷する科目の階層）"><select value={pr.depth} onChange={(e) => setCommon({ depth: e.target.value })} style={input}>{DEPTHS.map((o) => <option key={o}>{o}</option>)}</select></Field>
                    <Field label="行の間隔"><select value={pr.lineGap} onChange={(e) => setCommon({ lineGap: e.target.value })} style={input}>{['上・下空き', '上のみ空き', '空きなし'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                    <Field label="空きの間隔"><select value={pr.gapSize} onChange={(e) => setCommon({ gapSize: e.target.value })} style={input} disabled={pr.lineGap === '空きなし'}>{['1mm', '2mm', '3mm', '4mm'].map((o) => <option key={o}>{o}</option>)}</select></Field>
                    <Field label="印刷位置の調整：右方向（mm）"><input className="field-input" value={String(pr.offsetX)} onChange={(e) => setCommon({ offsetX: parseInt(e.target.value.replace(/[^0-9-]/g, ''), 10) || 0 })} inputMode="numeric" style={numInput} /></Field>
                    <Field label="印刷位置の調整：上方向（mm）"><input className="field-input" value={String(pr.offsetY)} onChange={(e) => setCommon({ offsetY: parseInt(e.target.value.replace(/[^0-9-]/g, ''), 10) || 0 })} inputMode="numeric" style={numInput} /></Field>
                    {(['fontHeader', 'fontName', 'fontAmount'] as const).map((k, i) => <Field key={k} label={['ヘッダー', '科目名', '金額'][i] + 'のフォント'}><select value={pr[k]} onChange={(e) => setCommon({ [k]: e.target.value } as Partial<PrintCommon>)} style={input}>{FONTS.map((o) => <option key={o}>{o}</option>)}</select></Field>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <Toggle on={!!pr.items.stamp} onChange={(v) => setCommon({ items: { ...pr.items, stamp: v } })} accent="#6b3fa0" label="捺印欄を印刷する" />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, opacity: pr.items.stamp ? 1 : 0.5 }}>{pr.stamps.map((v, i) => <input key={i} className="field-input" value={v} disabled={!pr.items.stamp} onChange={(e) => setCommon({ stamps: pr.stamps.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`捺印${i + 1}`} style={{ ...input, padding: '5px 8px', fontSize: 12 }} />)}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><Toggle on={!!pr.items.page} onChange={(v) => setCommon({ items: { ...pr.items, page: v } })} accent="#6b3fa0" label="ページ番号を印刷する" /><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6773' }}>開始番号<input className="field-input" value={String(pr.pageStart)} disabled={!pr.items.page} onChange={(e) => setCommon({ pageStart: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1 })} inputMode="numeric" style={{ ...numInput, width: 64, padding: '4px 8px' }} /></label></div>
                      <Toggle on={!!pr.items.date} onChange={(v) => setCommon({ items: { ...pr.items, date: v } })} accent="#6b3fa0" label="印刷時の日付を印刷する" />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e8e0f4', paddingTop: 10, display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6b3fa0', letterSpacing: '.04em' }}>印刷項目の切替え</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '6px 16px' }}>
                      {PRINT_ITEMS.filter(([k]) => !['stamp', 'page', 'date'].includes(k)).map(([k, label]) => <Toggle key={k} on={!!pr.items[k]} onChange={(v) => setCommon({ items: { ...pr.items, [k]: v } })} accent="#6b3fa0" label={k === 'zero' ? '0データを印刷しない（各帳票の初期値）' : label} />)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6b3fa0', letterSpacing: '.04em' }}>内訳表</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <Toggle on={pr.twoLineNames} onChange={(v) => setCommon({ twoLineNames: v })} accent="#6b3fa0" label="項目名を二行で印刷する" />
                      <Toggle on={pr.autoFontHeader} onChange={(v) => setCommon({ autoFontHeader: v })} accent="#6b3fa0" label="項目名のフォントサイズを自動調整" />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6773' }}>1ページの区分数<select value={String(pr.perPage)} onChange={(e) => setCommon({ perPage: Number(e.target.value) })} style={{ ...input, width: 70, padding: '4px 6px' }}>{[4, 5, 6, 7, 8].map((o) => <option key={o}>{o}</option>)}</select></label>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6b3fa0', letterSpacing: '.04em' }}>帳票の色・印字 <span style={{ fontWeight: 500, color: '#8290a0', marginLeft: 6 }}>動作環境から移した項目</span></div>
                    <ReportStyleSettings accent="#6b3fa0" compact />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: '#8290a0' }}>
                    <span>同じ内容は「共通の印刷設定」画面でも変更できます。</span>
                    {changed > 0 && <button type="button" onClick={() => setSession({ print: { ...snap, unitRemarks: pr.unitRemarks } })} style={{ ...btn('#5b6773', false, true), marginLeft: 'auto' }}>開いたときの設定に戻す（{changed} 項目）</button>}
                  </div>
                </div>
              )}
            </ScopeBlock>

            <ScopeBlock title="動作環境から引き継ぐ設定" desc="画面表示と印刷の両方に関わるため動作環境に残した設定です（ここでは確認のみ。区分ごと／全区分共通の別を表示）。">
              <EnvPrintSummary env={s.env} division={s.division} />
            </ScopeBlock>
          </>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={lbl}>出力先</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {DESTS.map((d) => {
                const on = p.output === d.out;
                return <label key={d.out} style={{ ...card, padding: '12px 14px', cursor: 'pointer', borderColor: on ? accent : '#e2e8ee', background: on ? '#f6f9fc' : '#fff', display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="radio" name="print-dest" checked={on} onChange={() => set({ output: d.out })} style={{ marginTop: 3 }} /><span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{d.label}</span><span style={{ display: 'block', fontSize: 11.5, color: '#8290a0', marginTop: 2 }}>{d.desc}</span></span></label>;
              })}
            </div>
            <div style={{ fontSize: 11.5, color: '#8290a0' }}>印刷前に内容を確かめるときは、右下の「プレビュー」を使います（どの手順からでも開けます）。</div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'grid', gap: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['帳票', report.name, 0],
                  ['期間', `${p.from} 〜 ${p.to}${usesDepth(report) ? `（${p.range}）` : ''}`, 1],
                  ['区分', `${s.division}${kind !== '入力区分' ? `（${p.target === '起動中の区分' ? '合計で印刷' : '構成する区分ごとに印刷'}）` : ''}`, 1],
                  ['この帳票のみの設定', `0データ：${p.zeroHide ? '表示しない' : '表示する'}／印刷項目 ${onCount} 件を有効${usesDepth(report) ? `／印刷範囲：${p.depthOwn ? p.depth : '共通の設定に従う'}` : ''}${usesRemark(report) ? `／備考：${myUnit}${pr.unitRemarks[myUnit] ? '' : '（未入力）'}` : ''}`, 2],
                  ['全帳票共通の設定', `${pr.depth}・${pr.lineGap}・${pr.fontName}${changed ? `（今回 ${changed} 項目を変更）` : ''}`, 2],
                  ['出力先', dest.label, 3],
                ] as [string, string, number][]).map(([k, v, to]) => (
                  <tr key={k}><td style={{ ...TD, width: 170, fontSize: 12, fontWeight: 700, color: '#5b6773' }}>{k}</td><td style={TD}>{v}</td><td style={{ ...TD, width: 60, textAlign: 'right' }}><button type="button" onClick={() => setStep(to)} style={{ border: 'none', background: 'transparent', color: accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>変更</button></td></tr>
                ))}
              </tbody>
            </table>
            <Notice>内容を確認して「{dest.action}」を押します。先に「プレビュー」で仕上がりを確かめることもできます。</Notice>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px 16px', flexWrap: 'wrap' }}>
        {onClose && <button type="button" onClick={onClose} style={btn()}>キャンセル</button>}
        <button type="button" onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0} style={{ ...btn(), opacity: step === 0 ? 0.45 : 1 }}>戻る</button>
        {step < FLOW_STEPS.length - 1 && <button type="button" onClick={() => setStep((x) => Math.min(FLOW_STEPS.length - 1, x + 1))} style={btn(accent)}>次へ：{FLOW_STEPS[step + 1]}</button>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="btn-outline" onClick={preview} style={btn(accent)}>プレビュー</button>
          <button type="button" className="submit-btn" onClick={run} style={btn(accent, true)}>{dest.action}</button>
        </span>
      </div>
      {/* 【名前を付けて保存】は印刷の流れの上に重ねる（DOM 上で後に置く） */}
      <ExportDialog spec={exp} onClose={() => { setExp(null); onClose?.(); }} accent={accent} />
    </div>
  );
}

/** 帳票の色・印字（全帳票共通）。動作環境にあった印刷関連の項目を、印刷の詳細設定と共通の印刷設定に集約（依頼書 5.5.1） */
export function ReportStyleSettings({ accent, compact }: { accent: string; compact?: boolean }) {
  const s = useSession();
  const e = s.env;
  const set = (patch: Partial<EnvSettings>) => setSession({ env: { ...e, ...patch } });
  const colorLbl: CSSProperties = { fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' };
  return (
    <div data-report-style style={{ display: 'grid', gap: compact ? 8 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Toggle on={e.colorReports} onChange={(v) => set({ colorReports: v })} accent={accent} label="カラー帳票を有効にする" />
        <label style={colorLbl}>罫線色<input type="color" value={e.lineColor} onChange={(ev) => set({ lineColor: ev.target.value })} disabled={!e.colorReports} /></label>
        <label style={colorLbl}>網掛け色<input type="color" value={e.shadeColor} onChange={(ev) => set({ shadeColor: ev.target.value })} disabled={!e.colorReports} /></label>
        <span style={{ fontSize: 11.5, color: '#7a8794' }}>決算書・予算書・試算表・仕訳日記帳の罫線と網掛け。元帳・伝票は帳票ごとの固定色</span>
      </div>
      <Toggle on={e.printSpeed} onChange={(v) => set({ printSpeed: v })} accent={accent} label="帳票印刷の速度を重視する（大量ページの作成を優先）" />
      <Toggle on={e.onePageRow} onChange={(v) => set({ onePageRow: v })} accent={accent} label="1行のみの改ページを抑制する（1行だけが次ページに送られないようにする）" />
      <Toggle on={e.noteOnExcel} onChange={(v) => set({ noteOnExcel: v })} accent={accent} label="Excel／PDF出力で明細書の注意書きを印字する" />
      <Field label="試算表：予備費出力の選択"><select value={e.reserveOutput} onChange={(ev) => set({ reserveOutput: ev.target.value })} style={input}>{['予備費を標準方式で印字', '予備費の差異に計算結果を印字', '予備費の1行目に充当前の予算額を印字'].map((o) => <option key={o}>{o}</option>)}</select></Field>
    </div>
  );
}

/** 動作環境のうち印刷に反映される設定の一覧（影響範囲つき・確認のみ） */
export function EnvPrintSummary({ env, division }: { env: EnvSettings; division: string }) {
  const rows: [string, ReactNode, ScopeKind][] = [
    ['金額の書式', <>桁区切り：{env.thousandsSep}／負数：<span style={{ color: amountColor(-1, env), fontVariantNumeric: 'tabular-nums' }}>{formatAmount(-89012, env)}</span>（{env.negativeColor}）</>, '区分ごと'],
    ['0項目カット', env.zeroCut ? '相殺結果が 0 円の項目を印刷しない' : '相殺結果が 0 円の項目も印刷する', '区分ごと'],
    ['和暦の 1 年の表記', env.eraGannen ? '「元年」と表記' : '「1年」と表記', '全区分共通'],
    ['試算表の費目行の計算方式', env.trialCalc, '全区分共通'],
  ];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>{rows.map(([k, v, scope]) => <tr key={k}><td style={{ ...TD, width: 150, fontSize: 12, fontWeight: 700, color: '#5b6773', padding: '6px 8px' }}>{k}</td><td style={{ ...TD, fontSize: 12.5, padding: '6px 8px' }}>{v}</td><td style={{ ...TD, width: 190, padding: '6px 8px', textAlign: 'right' }}><ScopeBadge kind={scope} label={scope === '区分ごと' ? `区分ごと（${division}）` : undefined} /></td></tr>)}</tbody>
      </table>
      <div style={{ fontSize: 11.5, color: '#8290a0', lineHeight: 1.7 }}>変更は「各種設定 ＞ {displayName('環境設定')}」で行います。「全区分共通」はすべての区分の印刷に、「区分ごと」は起動中の区分の印刷だけに反映されます。</div>
    </div>
  );
}

/* ---------------- 帳票ごとの印刷ダイアログ ---------------- */
export function PrintDialog({ open, onClose, report, accent, onPreview, data, keepOpenOnPreview, lockReport }: { open: boolean; onClose: () => void; report: ReportDef | null; accent: string; onPreview: (title: string, opts: { from: string; to: string; output: string; hideZero?: boolean }) => void; /** 画面の実データ（省略時は帳票ごとのサンプル表） */ data?: TableData; /** プレビューを開いてもダイアログを閉じない（プレビューを後ろに重ねて描画する呼び出し側向け） */ keepOpenOnPreview?: boolean; lockReport?: boolean }) {
  const [picked, setPicked] = useState<ReportDef | null>(null);
  useEffect(() => { setPicked(null); }, [report?.id, open]);
  const cur = picked ?? report;
  if (!cur) return null;
  return (
    <Modal open={open} onClose={onClose} width={880} title={<>{cur.name} の印刷 <span style={{ fontSize: 11.5, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{cur.cat}</span></>}>
      <PrintFlow key={cur.id} report={cur} accent={accent} data={cur.id === report?.id ? data : undefined} onClose={onClose} lockReport={lockReport} onReportChange={setPicked} onPreview={(title, opts) => { onPreview(title, opts); if (!keepOpenOnPreview) onClose(); }} />
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
  const out = (kind: ExportKind) => {
    const all: TableData = data ?? { header: SAMPLE_HEADER, rows: Array.from({ length: pages }, (_, i) => samplePageRows(i + 1)).flat() };
    const table = zero ? dropZeroRows(all).data : all;
    toast.show(runExport({ kind, title, meta: opts ? `（自）${opts.from}　（至）${opts.to}` : undefined, ...table }));
  };
  return (
    <Modal open={open} onClose={onClose} width={900} title={<>印刷プレビュー <span style={{ fontSize: 12, color: '#7a8794', fontWeight: 500, marginLeft: 8 }}>{title}</span></>}>
      <ToastView msg={toast.msg} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid #eef2f5', background: '#f8fafc', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => out('print')} style={btn(accent, true, true)}>印刷</button>
        <button type="button" onClick={() => setPage((x) => Math.max(1, x - 1))} style={btn('#5b6773', false, true)}>前ページ</button>
        <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{Math.min(page, pageCount)} / {pageCount}</span>
        <button type="button" onClick={() => setPage((x) => Math.min(pageCount, x + 1))} style={btn('#5b6773', false, true)}>次ページ</button>
        <button type="button" onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))} style={btn('#5b6773', false, true)}>拡大</button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} style={btn('#5b6773', false, true)}>縮小</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => out('excel')} style={btn('#1f7a52', false, true)}>Excel出力</button>
          <button type="button" onClick={() => out('pdf')} style={btn('#c0392b', false, true)}>PDF出力</button>
          <button type="button" onClick={onClose} style={btn('#5b6773', false, true)}>閉じる</button>
        </span>
      </div>
      <div style={{ background: '#5f6b77', padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
        <div style={{ width: 640 * zoom, minHeight: 880 * zoom, margin: '0 auto', background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.35)', padding: 36 * zoom, fontSize: 11 * zoom, color: '#22303c', fontFamily: "'Noto Sans JP', serif", transformOrigin: 'top center' }}>
          {s.print.items.corp && <div style={{ fontSize: 10 * zoom, color: '#5b6773' }}>{s.env.hideCorpName ? '' : '社会福祉法人 チャイルド保育園　'}{s.division}</div>}
          <div style={{ textAlign: 'center', fontSize: 15 * zoom, fontWeight: 700, margin: `${8 * zoom}px 0 ${4 * zoom}px`, letterSpacing: '.1em' }}>{title}</div>
          {opts && <div style={{ textAlign: 'center', fontSize: 10 * zoom, color: '#5b6773', marginBottom: 12 * zoom }}>（自）{opts.from}　（至）{opts.to}　　単位：円</div>}
          {children ?? (shown ? <DataPage zoom={zoom} data={shown.data} shade={shadeBg} line={line} env={s.env} /> : <DataPage zoom={zoom} data={{ header: SAMPLE_HEADER, rows: sampleShown }} shade={shadeBg} line={line} env={s.env} groupRows />)}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 * zoom, fontSize: 9 * zoom, color: '#7a8794' }}>
            <span>{s.print.items.date ? `印刷日 2026/09/10` : ''}</span>
            {s.print.items.stamp && <span style={{ display: 'flex', gap: 4 }}>{s.print.stamps.filter(Boolean).map((n) => <span key={n} style={{ width: 44 * zoom, height: 44 * zoom, border: '1px solid #9aa5b1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}</span>}
            <span>{s.print.items.page ? `- ${(s.print.pageStart || 1) + Math.min(page, pageCount) - 1} -` : ''}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', fontSize: 11.5, color: '#9aa5b1', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {!children && <span style={{ color: '#5b6773' }}>金額の書式：桁区切り {s.env.thousandsSep}・負数 {formatAmount(-1234, s.env)}（{s.env.negativeColor}）　／　0円の行：{zero ? `表示しない${dropped ? `（${dropped} 行を省略）` : ''}` : '表示する'}</span>}
        <span>レイアウトはサンプルです。</span>
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
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 * zoom }}>
      <thead><tr>{data.header.map((h, i) => <th key={i} style={{ border: '1px solid ' + line, padding: 3 * zoom, background: shade, textAlign: typeof data.rows[0]?.[i] === 'number' ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
      <tbody>{data.rows.map((r, i) => {
        const group = groupRows && r[0] === '流動資産';
        return <tr key={i} style={{ background: group ? shade : '#fff' }}>{r.map((v, k) => <td key={k} style={{ border: '1px solid ' + line, padding: 3 * zoom, paddingLeft: (k === 0 && groupRows && !group ? 12 : 3) * zoom, textAlign: typeof v === 'number' ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: group && k === 0 ? 700 : 400, color: typeof v === 'number' ? amountColor(v, env) : undefined }}>{typeof v === 'number' ? formatAmount(v, env) : v}</td>)}</tr>;
      })}</tbody>
    </table>
  );
}

/* ---------------- 帳票の印刷（帳票一覧。1帳票ずつ／まとめて印刷を画面内で切り替える） ---------------- */
export function PrintCenterPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  /** まとめて印刷（旧「一括印刷」メニュー）。帳票をチェックで選び、出力先を1回指定して順に出力する */
  const [batch, setBatch] = useState(false);
  const [cat, setCat] = useState('仕訳日記帳');
  const [target, setTarget] = useState<ReportDef | null>(null);
  const [preview, setPreview] = useState<{ title: string; batch?: boolean; opts: { from: string; to: string; output: string; hideZero?: boolean } } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(['j1', 'l1', 't1', 't2', 't3']));
  const [bOutput, setBOutput] = useState(OUTPUTS[1]);
  const [exp, setExp] = useState<ExportSpec | null>(null);
  const toast = useToast();
  const list = REPORTS.filter((r) => cat === 'すべて' || r.cat === cat);
  const picked = REPORTS.filter((r) => selected.has(r.id));
  const batchData = () => ({ header: ['帳票名', '科目', '当月', '累計'], rows: picked.flatMap((r) => sampleReportData(r.name).rows.map((row) => [r.name, ...row])) });
  const setMode = (b: boolean) => { setBatch(b); if (b) setCat('すべて'); };
  const toggle = (id: string) => setSelected((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = list.length > 0 && list.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((x) => { const n = new Set(x); list.forEach((r) => { if (allOn) n.delete(r.id); else n.add(r.id); }); return n; });
  // まとめて印刷：選んだ帳票を1つの出力にまとめる（帳票名列を付けて連結。本番では帳票ごとに改ページ）
  const runBatch = () => {
    if (!picked.length) return toast.show('まとめて印刷する帳票を選んでください');
    const title = `まとめて印刷（${picked.length}帳票）`;
    if (bOutput === OUTPUTS[1]) { setPreview({ title, batch: true, opts: { from: '令和8年8月1日', to: '令和8年8月31日', output: bOutput } }); return; }
    setExp({ kind: outputKind(bOutput) ?? 'print', title, fileName: `まとめて印刷_令和8年8月`, meta: `令和8年8月1日〜8月31日　対象：${picked.map((r) => r.name).join('、')}`, ...batchData() });
  };
  const seg = (on: boolean): CSSProperties => ({ position: 'relative', zIndex: 1, padding: '8px 18px', border: 'none', borderRadius: 8, background: on ? accent : 'transparent', color: on ? '#fff' : '#3d4a56', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  return (
    <SettingsShell variant={variant} title={displayName('印刷センター')} badge="印刷" draft={false} desc="帳票の一覧です。帳票を選ぶと「基本条件 → 詳細設定 → 出力先 → 印刷／プレビュー」を1つのダイアログで指定できます。複数の帳票は「まとめて印刷」に切り替えると、一度に出力できます。">
      <ToastView msg={toast.msg} />
      {/* 印刷のしかたの切替：1帳票ずつ／まとめて印刷（旧「一括印刷」） */}
      <div data-print-mode={batch ? 'batch' : 'single'} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid #eef2f5', background: batch ? '#f4f9f6' : '#fafbfc' }}>
        <div role="radiogroup" aria-label="印刷のしかた" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 11, background: '#e6ecf0' }}>
          <button type="button" role="radio" aria-checked={!batch} data-print-mode-btn="single" onClick={() => setMode(false)} style={seg(!batch)}>1帳票ずつ印刷</button>
          <button type="button" role="radio" aria-checked={batch} data-print-mode-btn="batch" onClick={() => setMode(true)} style={seg(batch)}>まとめて印刷</button>
        </div>
        {batch ? (
          <>
            <span style={{ fontSize: 12.5, color: '#3d4a56' }}>選択中 <b style={{ fontSize: 15, color: accent, fontVariantNumeric: 'tabular-nums' }}>{picked.length}</b> 帳票</span>
            <button type="button" className="btn-outline" onClick={toggleAll} style={btn('#5b6773', false, true)}>{allOn ? '表示中の選択を解除' : '表示中をすべて選択'}</button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#5b6773' }}>出力先</span>
              <select value={bOutput} onChange={(e) => setBOutput(e.target.value)} style={{ ...input, width: 220 }}>{OUTPUTS.map((o) => <option key={o}>{o}</option>)}</select>
              <button type="button" className="submit-btn" data-print-batch-run disabled={!picked.length} onClick={runBatch} style={{ ...btn(accent, true), opacity: picked.length ? 1 : 0.5, cursor: picked.length ? 'pointer' : 'not-allowed' }}>選んだ {picked.length} 帳票を印刷</button>
            </div>
          </>
        ) : <span style={{ fontSize: 12, color: '#7a8794' }}>帳票を押すと、その帳票の印刷条件を指定できます。</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', minHeight: 420 }}>
        <div style={{ borderRight: '1px solid #eef2f5', padding: 10 }}>
          {['すべて', ...CATS].map((c) => {
            const n = c === 'すべて' ? REPORTS.length : REPORTS.filter((r) => r.cat === c).length;
            const sel = batch ? (c === 'すべて' ? picked.length : picked.filter((r) => r.cat === c).length) : 0;
            const on = cat === c;
            return <button key={c} type="button" onClick={() => setCat(c)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderRadius: 8, background: on ? accent : 'transparent', color: on ? '#fff' : '#22303c', fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>{c}{sel > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, padding: '0 6px', borderRadius: 8, background: on ? 'rgba(255,255,255,.25)' : '#e3f1ea', color: on ? '#fff' : accent }}>選択 {sel}</span>}<span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>{n}</span></button>;
          })}
        </div>
        <div style={{ padding: 16 }}>
          {batch ? <div style={{ marginBottom: 10 }}><Notice>期間は「令和8年8月1日〜8月31日」（当月）で一括指定します。帳票ごとの詳細設定は、各帳票の設定値を使います。</Notice></div>
            : <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#5b6773' }}><span>設定の影響範囲：</span><ScopeBadge kind="帳票個別" /><span>その帳票だけ</span><ScopeBadge kind="全帳票共通" /><span>すべての帳票</span><ScopeBadge kind="全区分共通" /><ScopeBadge kind="区分ごと" /><span>動作環境から引き継ぎ</span></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {list.map((r) => {
              const on = selected.has(r.id);
              return (
                <div key={r.id} data-report={r.id} onClick={() => (batch ? toggle(r.id) : setTarget(r))} style={{ ...card, padding: '12px 14px', cursor: 'pointer', borderColor: batch && on ? accent : '#e2e8ee', background: batch && on ? '#f4f9f6' : '#fff', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {batch && <input type="checkbox" checked={on} readOnly style={{ marginTop: 3 }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#8290a0', marginTop: 2 }}>{r.cat}{r.note ? `　${r.note}` : ''}</div>
                  </div>
                  {!batch && <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>印刷 →</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <PrintDialog open={!!target} onClose={() => setTarget(null)} report={target} accent={accent} keepOpenOnPreview onPreview={(title, opts) => setPreview({ title, opts })} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} opts={preview?.opts} accent={accent} data={preview ? (preview.batch ? batchData() : sampleReportData(preview.title)) : undefined} />
      <ExportDialog spec={exp} onClose={() => setExp(null)} accent={accent} />
    </SettingsShell>
  );
}

/* ---------------- 共通の印刷設定（全帳票共通） ---------------- */
export function CommonPrintSettingsPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const s = useSession();
  const p = s.print;
  const set = (patch: Partial<typeof p>) => setSession({ print: { ...p, ...patch } });
  const toast = useToast();
  const [foot, setFoot] = useState<string | null>(null);
  const [footText, setFootText] = useState('');
  const [preview, setPreview] = useState(false);
  const FOOT_REPORTS = ['資金収支計算書（第一号第一様式）', '資金収支計算書（第一号第四様式）', '事業活動計算書', '貸借対照表'];
  return (
    <SettingsShell variant={variant} title="共通の印刷設定" badge="印刷" desc={<><ScopeBadge kind="全帳票共通" />　すべての帳票の印刷に反映される設定です。印刷に関わる設定はここと各帳票の「詳細設定」に集約し、動作環境には置きません。同じ内容は、各帳票の印刷の「詳細設定 ＞ 全帳票共通の設定」からも変更できます。</>} actions={<>
      <ScreenPrintMenu page="共通の印刷設定" accent={accent} label="備考・摘要の印刷" />
      <button type="button" className="btn-outline" onClick={() => setPreview(true)} style={btn()}>プレビューで確認</button>
      <button type="button" className="btn-outline" onClick={() => toast.show('他の区分の印刷設定を読み込みました（プロトタイプ）')} style={btn()}>他区分の設定を読込</button>
      <button type="button" className="submit-btn" onClick={() => toast.show('共通の印刷設定を保存しました')} style={btn(accent, true)}>決定</button>
    </>}>
      <ToastView msg={toast.msg} />
      <div style={{ padding: '16px 22px 0' }}><Notice>帳票ごとに変えたい項目（0データを表示しない・印刷範囲・備考など）は、各帳票の印刷の「詳細設定 ＞ この帳票のみの設定」で指定します。金額の書式やカラー帳票などは「{displayName('環境設定')}」の設定が印刷に反映されます。</Notice></div>
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={card}>
            <div style={cardHead}>印刷位置・行の間隔</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="印刷位置（印刷する勘定科目の範囲）" span={2}><select value={p.depth} onChange={(e) => set({ depth: e.target.value })} style={input}>{DEPTHS.map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="行の間隔"><select value={p.lineGap} onChange={(e) => set({ lineGap: e.target.value })} style={input}>{['上・下空き', '上のみ空き', '空きなし'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="空きの間隔"><select value={p.gapSize} onChange={(e) => set({ gapSize: e.target.value })} style={input} disabled={p.lineGap === '空きなし'}>{['1mm', '2mm', '3mm', '4mm'].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="内訳帳票：1ページの区分数"><select value={String(p.perPage)} onChange={(e) => set({ perPage: Number(e.target.value) })} style={input}>{[4, 5, 6, 7, 8].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <div style={{ display: 'grid', gap: 6, alignSelf: 'end' }}>
                <Toggle on={p.twoLineNames} onChange={(v) => set({ twoLineNames: v })} accent={accent} label="項目名を二行で印刷する" />
                <Toggle on={p.autoFontHeader} onChange={(v) => set({ autoFontHeader: v })} accent={accent} label="項目名のフォントサイズを自動調整" />
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={cardHead}>印刷位置調整・印刷書式</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="印刷位置調整（mm）">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 4, alignItems: 'center' }}>
                  <span /><button type="button" onClick={() => set({ offsetY: p.offsetY - 1 })} style={btn('#5b6773', false, true)}>↑</button><span />
                  <button type="button" onClick={() => set({ offsetX: p.offsetX - 1 })} style={btn('#5b6773', false, true)}>←</button><span style={{ fontSize: 11, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{p.offsetX},{p.offsetY}</span><button type="button" onClick={() => set({ offsetX: p.offsetX + 1 })} style={btn('#5b6773', false, true)}>→</button>
                  <span /><button type="button" onClick={() => set({ offsetY: p.offsetY + 1 })} style={btn('#5b6773', false, true)}>↓</button><span />
                </div>
              </Field>
              <div style={{ display: 'grid', gap: 8 }}>
                <Field label="印刷幅：科目（mm）"><input className="field-input" value={String(p.widthName)} onChange={(e) => set({ widthName: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} style={numInput} /></Field>
                <Field label="印刷幅：金額（mm）"><input className="field-input" value={String(p.widthAmount)} onChange={(e) => set({ widthAmount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} style={numInput} /></Field>
              </div>
              {(['fontHeader', 'fontName', 'fontAmount'] as const).map((k, i) => <Field key={k} label={['ヘッダー', '科目名', '金額'][i] + 'のフォント'}><select value={p[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<typeof p>)} style={input}>{FONTS.map((o) => <option key={o}>{o}</option>)}</select></Field>)}
              <div style={{ alignSelf: 'end' }}><button type="button" onClick={() => set({ widthName: 60, widthAmount: 28, fontHeader: 'Noto Sans JP 11pt', fontName: 'Noto Sans JP 9pt', fontAmount: 'Noto Sans JP 9pt', offsetX: 0, offsetY: 0 })} style={btn()}>リセット</button></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={card}>
            <div style={cardHead}>印刷項目の切替え</div>
            <div style={{ padding: 14, display: 'grid', gap: 8 }}>
              {PRINT_ITEMS.map(([k, label]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Toggle on={!!p.items[k]} onChange={(v) => set({ items: { ...p.items, [k]: v } })} accent={accent} label={k === 'zero' ? '0データを印刷しない（各帳票の初期値。帳票ごとに変更可）' : label} />
                  {k === 'page' && <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b6773' }}>開始番号<input className="field-input" value={String(p.pageStart)} disabled={!p.items.page} onChange={(e) => set({ pageStart: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1 })} inputMode="numeric" style={{ ...numInput, width: 64, padding: '4px 8px' }} /></label>}
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={cardHead}>帳票の色・印字 <span style={{ fontSize: 11, fontWeight: 500, color: '#8290a0', marginLeft: 6 }}>動作環境から移した項目（5.5.1）</span></div>
            <div style={{ padding: 14 }}><ReportStyleSettings accent={accent} /></div>
          </div>
          <div style={card}>
            <div style={cardHead}>捺印欄（最大4名）・脚注</div>
            <div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>{p.stamps.map((v, i) => <input key={i} className="field-input" value={v} onChange={(e) => set({ stamps: p.stamps.map((x, k) => (k === i ? e.target.value : x)) })} placeholder={`捺印${i + 1}`} style={input} />)}</div>
              <div style={{ fontSize: 12, color: '#7a8794' }}>脚注（（注）予備費の充当額等）を帳票ごとに編集：</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{FOOT_REPORTS.map((r) => <tr key={r}><td style={{ ...TD, fontSize: 12.5 }}>{r}</td><td style={{ ...TD, fontSize: 11.5, color: '#7a8794' }}>{p.footnotes[r] ? p.footnotes[r].slice(0, 28) + (p.footnotes[r].length > 28 ? '…' : '') : '（未設定）'}</td><td style={{ ...TD, textAlign: 'right' }}><button type="button" onClick={() => { setFoot(r); setFootText(p.footnotes[r] ?? ''); }} style={btn('#5b6773', false, true)}>編集</button></td></tr>)}</tbody></table>
            </div>
          </div>
        </div>
      </div>
      <Modal open={!!foot} onClose={() => setFoot(null)} width={560} title={`脚注編集：${foot ?? ''}`}>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 10 }}>
          <textarea value={footText} onChange={(e) => setFootText(e.target.value)} rows={5} placeholder="（注）予備費の充当額 ○○円 は …" style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
          <Notice tone="warn">脚注は帳票の最下部に印刷されます。改行はそのまま反映されます。長すぎると2ページ目に送られることがあります。</Notice>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setFoot(null)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { if (foot) set({ footnotes: { ...p.footnotes, [foot]: footText } }); setFoot(null); }} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
      <PreviewModal open={preview} onClose={() => setPreview(false)} title="資金収支計算書（共通設定の確認）" opts={{ from: '令和8年4月1日', to: '令和8年8月31日', output: OUTPUTS[1] }} accent={accent} hideZero={!!p.items.zero} />
    </SettingsShell>
  );
}

export function PrintTableHead({ cols }: { cols: string[] }) { return <thead><tr>{cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr></thead>; }
