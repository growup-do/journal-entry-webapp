// 予算入力（提案B）：資金収支予算と取引先別予算。年度（前年度／当年度／次年度）ごとのタブ × 予算月（初・4〜3・決）。
//   マニュアル 3.2 に相当。予算額の設定（年度×月の一覧）・次年度予算作成ウィザード・前期末支払資金残高の表示。
//   タブは「前年度予算／当年度予算／次年度予算」と、その取引先別の 6 つ。どのタブでも予算月を選べる（月「初」＝当初予算、4〜3・決＝補正予算。確認メモ #169）。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { ExplainModal } from './ExplainModal';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { Field, Notice, SettingsShell, Tabs, btn, input, numInput, toInt, yen } from './ui';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { VENDORS, displayName } from '../data';
import { ScopeBadge } from './PrintCenter';
import { setSession, useSession } from '../store/session';

type YearKey = '前年度' | '当年度' | '次年度';
const YEARS: YearKey[] = ['前年度', '当年度', '次年度'];
/** 取引先別のタブの接尾辞 */
const BY_VENDOR = '（取引先別）';
type YearTab = `${YearKey}予算` | `${YearKey}予算${typeof BY_VENDOR}`;
const TABS: YearTab[] = [...YEARS.map((y): YearTab => `${y}予算`), ...YEARS.map((y): YearTab => `${y}予算${BY_VENDOR}`)];
/** 予算月：「初」＝当初予算、「4」〜「3」「決」＝その月の補正予算（どのタブでも選べる。確認メモ #169） */
const MONTHS = ['初', ...FISCAL_MONTHS];
/** 取引先別予算の対象（取引先マスターと同じ並び・コード） */
const BUDGET_VENDORS = VENDORS.filter((v) => v !== '（なし）').map((name, i) => ({ code: String(101 + i), name }));

interface BItem { code: string; name: string; side: '収入' | '支出'; level: number; leaf?: boolean }
const ITEMS: BItem[] = [
  { code: '1', name: '事業活動収入', side: '収入', level: 0 },
  { code: '1-01', name: '保育事業収入', side: '収入', level: 1 },
  { code: '1-01-01', name: '委託費収入', side: '収入', level: 2, leaf: true },
  { code: '1-01-02', name: '利用者等利用料収入', side: '収入', level: 2, leaf: true },
  { code: '1-01-03', name: 'その他の事業収入', side: '収入', level: 2, leaf: true },
  { code: '1-02', name: '補助金事業収入', side: '収入', level: 1 },
  { code: '1-02-01', name: '市区町村補助金収入', side: '収入', level: 2, leaf: true },
  { code: '1-03', name: '受取利息配当金収入', side: '収入', level: 1, leaf: true },
  { code: '1-04', name: 'その他の収入', side: '収入', level: 1, leaf: true },
  { code: '2', name: '事業活動支出', side: '支出', level: 0 },
  { code: '2-01', name: '人件費支出', side: '支出', level: 1 },
  { code: '2-01-01', name: '職員給料支出', side: '支出', level: 2, leaf: true },
  { code: '2-01-02', name: '職員賞与支出', side: '支出', level: 2, leaf: true },
  { code: '2-01-03', name: '法定福利費支出', side: '支出', level: 2, leaf: true },
  { code: '2-02', name: '事業費支出', side: '支出', level: 1 },
  { code: '2-02-01', name: '給食費支出', side: '支出', level: 2, leaf: true },
  { code: '2-02-02', name: '保育材料費支出', side: '支出', level: 2, leaf: true },
  { code: '2-02-03', name: '水道光熱費支出', side: '支出', level: 2, leaf: true },
  { code: '2-03', name: '事務費支出', side: '支出', level: 1 },
  { code: '2-03-01', name: '通信運搬費支出', side: '支出', level: 2, leaf: true },
  { code: '2-03-02', name: '賃借料支出', side: '支出', level: 2, leaf: true },
  { code: '2-03-03', name: '消耗品費支出', side: '支出', level: 2, leaf: true },
  { code: '2-09', name: '予備費支出', side: '支出', level: 1, leaf: true },
];
const BASE: Record<string, number> = { '1-01-01': 37000000, '1-01-02': 300000, '1-01-03': 200000, '1-02-01': 700000, '1-03': 5000, '1-04': 100000, '2-01-01': 18000000, '2-01-02': 4000000, '2-01-03': 4500000, '2-02-01': 2500000, '2-02-02': 600000, '2-02-03': 900000, '2-03-01': 150000, '2-03-02': 400000, '2-03-03': 300000, '2-09': 500000 };
const PREV_END_FUND = 9_800_000; // 前期末支払資金残高（貸借対照表の繰越残高から）

type Grid = Record<string, number[]>; // code（取引先別は取引先名） -> [初(当初), 4..3, 決] 補正額
const initGrid = (mult: number): Grid => Object.fromEntries(Object.entries(BASE).map(([c, v]) => [c, [Math.round(v * mult), ...Array(13).fill(0)]]));
/** 取引先別予算の初期値（サンプル）。base＝1 件目の当初予算額 */
const initVendorGrid = (base: number): Grid => Object.fromEntries(BUDGET_VENDORS.map((v, i) => [v.name, [base + i * 120000, ...Array(13).fill(0)]]));

export function BudgetPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<YearTab>('当年度予算');
  const [month, setMonth] = useState('初');
  const session = useSession();
  const mode = session.env.supplementMode;
  const setMode = (m: '補正額' | '補正後予算額') => { setSession((x) => ({ env: { ...x.env, supplementMode: m } })); toast.show(`補正予算の入力方法を「${m}で入力」に切り替えました`); };
  const [prev, setPrev] = useState<Grid>(() => initGrid(0.96));
  const [cur, setCur] = useState<Grid>(() => initGrid(1));
  const [next, setNext] = useState<Grid>(() => initGrid(0));
  const [ref, setRef] = useState<'当初予算' | '確定予算'>('当初予算');
  const [wizard, setWizard] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [wMethod, setWMethod] = useState('当年度予算をそのまま');
  const [wRate, setWRate] = useState('102');
  const [wUnit, setWUnit] = useState('1円単位');
  // 取引先別予算も、年度ごとに 月別（初・4〜3・決）で持つ（確認メモ #169）
  const [vPrev, setVPrev] = useState<Grid>(() => initVendorGrid(300000));
  const [vCur, setVCur] = useState<Grid>(() => initVendorGrid(320000));
  const [vNext, setVNext] = useState<Grid>(() => initVendorGrid(330000));

  /** 取引先別のタブか */
  const byVendor = tab.endsWith(BY_VENDOR);
  /** 表示中のタブの年度 */
  const year = tab.slice(0, 3) as YearKey;
  const grids: Record<YearKey, Grid> = byVendor ? { 前年度: vPrev, 当年度: vCur, 次年度: vNext } : { 前年度: prev, 当年度: cur, 次年度: next };
  const grid = grids[year];
  const setGrid = byVendor ? (year === '前年度' ? setVPrev : year === '次年度' ? setVNext : setVCur) : year === '前年度' ? setPrev : year === '次年度' ? setNext : setCur;
  const mi = MONTHS.indexOf(month);
  const totalOf = (g: Grid, code: string, upto = 13) => (g[code] ?? []).slice(0, upto + 1).reduce((a, b) => a + b, 0);
  const rollup = (item: BItem, f: (c: string) => number) => (item.leaf ? f(item.code) : ITEMS.filter((x) => x.leaf && x.code.startsWith(item.code + '-')).reduce((a, x) => a + f(x.code), 0));
  const sumSide = (side: '収入' | '支出', f: (c: string) => number) => ITEMS.filter((x) => x.leaf && x.side === side).reduce((a, x) => a + f(x.code), 0);
  /** 補正後予算額で入力しているときは、前月までの累計との差額を当月の補正額として保持する */
  const setCell = (code: string, val: number) => setGrid((g) => ({ ...g, [code]: g[code].map((v, i) => (i === mi ? (mi > 0 && mode === '補正後予算額' ? val - totalOf(g, code, mi - 1) : val) : v)) }));

  // 表示列：月「初」＝当初予算（1 つ前の年度の予算額と対比）、4〜3・決＝補正予算（前月までの現額と対比）
  const cols = useMemo(() => {
    if (month !== '初') return { ref: '現額予算額', cur: mode, diff: '補正後予算額' };
    return { ref: year === '前年度' ? '前々年度予算額' : year === '次年度' ? '当年度予算額' : '前年度予算額', cur: '当初予算額', diff: '差引予算' };
  }, [year, month, mode]);
  const refGrid = year === '前年度' ? { g: grids.前年度, mult: 0.93 } : year === '次年度' ? { g: grids.当年度, mult: 1 } : { g: grids.前年度, mult: 1 };
  const refVal = (code: string) => (month !== '初' ? totalOf(grid, code, Math.max(0, mi - 1)) : Math.round(totalOf(refGrid.g, code, 13) * refGrid.mult));
  /** 実績額（サンプル。当年度の予算額をもとにした仮の値） */
  const actualVal = (code: string) => Math.round(totalOf(grids.当年度, code, 13) * 0.42);
  /** 取引先別予算の合計 */
  const vendorSum = (f: (name: string) => number) => BUDGET_VENDORS.reduce((a, v) => a + f(v.name), 0);
  const curVal = (code: string) => (mi === 0 ? grid[code][0] : mode === '補正額' ? grid[code][mi] : totalOf(grid, code, mi));
  const afterVal = (code: string) => (mi === 0 ? grid[code][0] - refVal(code) : totalOf(grid, code, mi));

  const inSum = sumSide('収入', (c) => totalOf(grid, c, mi === 0 ? 0 : mi));
  const outSum = sumSide('支出', (c) => totalOf(grid, c, mi === 0 ? 0 : mi));
  const diff = inSum - outSum;

  const runWizard = () => {
    const rate = parseInt(wRate, 10) / 100 || 1;
    const unit = wUnit === '千円単位' ? 1000 : 1;
    const src = wMethod === '当年度予算をそのまま' ? (c: string) => totalOf(cur, c, 13) : wMethod === '当年度予算×倍率' ? (c: string) => totalOf(cur, c, 13) * rate : (c: string) => Math.round(totalOf(cur, c, 13) * 0.83 * rate);
    setNext(Object.fromEntries(Object.keys(BASE).map((c) => [c, [Math.round(src(c) / unit) * unit, ...Array(13).fill(0)]])));
    setWizard(false);
    toast.show('次年度予算を作成しました（既存の入力は上書き）');
  };

  const cell = (code: string, v: number, editable: boolean) => (
    <td style={NUM}>{editable ? <input className="field-input ring" value={yen(v)} onChange={(e) => setCell(code, toInt(e.target.value))} inputMode="numeric" style={{ ...numInput, padding: '4px 8px', fontSize: 14, background: '#fffbe6' }} /> : <span style={{ color: '#5b6773' }}>{yen(v)}</span>}</td>
  );
  const chip = (on: boolean): CSSProperties => ({ minWidth: 30, height: 26, padding: '0 8px', borderRadius: 6, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? accent : '#d3dbe3') });

  return (
    <SettingsShell variant={variant} title={displayName('予算')} desc="資金収支計算書の予算と取引先別の予算を、年度（前年度／当年度／次年度）ごとのタブで入力します。予算月の「初」が当初予算、「4」〜「3」「決」がその月の補正予算です。収支差額と期末支払資金残高を確認しながら設定できます。" badge="予算" actions={<>
      <ScreenPrintMenu page="予算" accent={accent} />
      {tab === '次年度予算' && <button type="button" className="btn-outline" onClick={() => setWizard(true)} style={btn(accent)}>次年度予算作成</button>}
      <button type="button" className="btn-outline" onClick={() => setExplainOpen(true)} style={btn()}>説明</button>
      <button type="button" className="submit-btn" onClick={() => toast.show('予算を保存しました（プロトタイプ）')} style={btn(accent, true)}>保存</button>
    </>}>
      <ToastView msg={toast.msg} />
      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} accent={accent} title="予算入力の説明" source="マニュアル 3.2 予算の入力（3.2.1 資金収支計算書の概要と設定／3.2.2 取引先別予算の概要と設定）" sections={[
        { h: '予算の種類（6つのタブ）', body: <>資金収支計算書の予算は「前年度予算」「当年度予算」「次年度予算」の3つのタブで、取引先別の予算は「前年度予算（取引先別）」「当年度予算（取引先別）」「次年度予算（取引先別）」の3つのタブで入力します。年度更新（処理年度の更新）をすると、前年度予算額→前々年度予算額、当年度予算額→前年度予算額、次年度予算額→当年度当初予算額へ自動的に移行されます。</>},
        { h: '予算月（初・4〜3・決）', body: <>どのタブでも、予算月を「初」「4」〜「3」「決」から選べます。「初」は当初予算、「4」〜「3」「決」はその月の補正予算です。</>},
        { h: '前年度予算', body: <>前年度の予算額を入力します。参考用に前々年度予算額を表示し、当初予算／確定予算（3月末時点の最終予算額）の切替ができます。運用2年目以降は年度更新で自動移行されるため、通常は初年度のみ入力します。</>},
        { h: '当年度予算', body: <>当年度の予算額を科目ごとに入力します。予算月「初」で当初予算額を入力し、参考用に前年度予算額を表示します。予算対比・予算チェック（動作環境）の基準になります。</>},
        { h: '補正予算（月別）', body: <>補正予算は、予算月で4月〜3月・決算を選んで入力します。入力方法は「補正額」（増減額）と「補正後予算額」（累計予算額）を切り替えられ、どちらで入力するかは、予算月の上に表示される「補正予算の入力方法」で切り替えます（以前は動作環境にあった設定です）。入力すると、その科目が属する資金収支差額（収入合計・支出合計）がどう変化するかを画面右で確認できます。</>},
        { h: '次年度予算', body: <>次年度の予算額を入力します。参考用に当年度予算（当初予算／確定予算）を表示します。「次年度予算作成」で当年度予算からの一括作成（率・端数単位の指定）ができ、年度更新時に当年度当初予算へ自動移行されます。</>},
        { h: '期末支払資金残高', body: <>「前期末決算額」は貸借対照表の繰越残高から「流動資産－流動負債」で計算した前期末支払資金残高です。「当期末予算額」は前期末決算額に資金収支差額合計を加算した当期末支払資金残高で、補正の結果を確認するための目安になります。</>},
        { h: '取引先別予算', body: <>取引先コードごとの支払額に対する予算です。資金収支予算と同じく、年度（前年度／当年度／次年度）ごとのタブで、当初予算（予算月「初」）と補正予算（4月〜3月・決算）を入力します。年度更新で自動的に繰り下がります。取引先推移・取引先元帳で予算との対比に使います。</>},
        { h: '登録・キャンセル', body: <>画面右上の「保存」ボタンで入力を確定します。保存せずに別の画面へ移動すると、入力した内容は破棄されます。</>},
      ]} />
      <Tabs items={TABS} current={tab} onChange={(t) => { setTab(t as YearTab); setMonth('初'); }} accent={accent} />
      {month !== '初' && (
        <div style={{ margin: '14px 22px 4px', padding: '12px 14px', border: '1px solid ' + accent, borderRadius: 12, background: '#fbfcfd', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b style={{ fontSize: 14 }}>補正予算の入力方法</b><ScopeBadge kind="区分ごと" label={`区分ごと（${session.division}）`} /></div>
          <div role="radiogroup" aria-label="補正予算の入力方法" style={{ display: 'inline-flex', border: '1px solid ' + accent, borderRadius: 9, overflow: 'hidden' }}>
            {(['補正額', '補正後予算額'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { if (mode !== m) setMode(m); }} style={{ padding: '8px 18px', border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: mode === m ? accent : '#fff', color: mode === m ? '#fff' : accent }}>{m}で入力</button>)}
          </div>
          <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7, flex: '1 1 320px' }}>
            {mode === '補正額' ? '補正額で入力：その月に増減させる金額（＋／−）を入力します。' : '補正後予算額で入力：補正した後の予算額（累計）を入力します。差額が補正額になります。'}
            <br /><span style={{ color: '#8290a0' }}>※ 以前は「{displayName('環境設定')}」にあった設定です。この画面で切り替えられるようにしました。</span>
          </div>
        </div>
      )}
      {/* 予算月（初・4〜3・決）は、6 つのタブすべてで選べる（確認メモ #169） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>予算月</span>
        <div data-budget-months style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{MONTHS.map((m) => <button key={m} type="button" className="chip" title={m === '初' ? '当初予算' : m === '決' ? '決算月の補正予算' : `${m}月の補正予算`} onClick={() => setMonth(m)} style={chip(month === m)}>{m}</button>)}</div>
        <span style={{ fontSize: 12, color: '#7a8794' }}>{month === '初' ? '当初予算' : month === '決' ? '決算月の補正予算' : `${month}月の補正予算`}</span>
        {!byVendor && month === '初' && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginRight: 4 }}>対比する予算</span>{(['当初予算', '確定予算'] as const).map((r) => <button key={r} type="button" onClick={() => setRef(r)} style={btn(ref === r ? accent : '#5b6773', ref === r, true)}>{r}</button>)}</div>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 14, color: '#7a8794' }}>{byVendor ? '黄色のセルが入力できます。' : '黄色のセルが入力できます。ピンク＝設定不可（集計項目）'}</span>
      </div>
      {byVendor ? (
        <div style={{ padding: '14px 22px 22px' }}>
          <Notice>取引先コードごとの支払額に対する予算です。資金収支予算と同じく、年度（前年度／当年度／次年度）ごとに、当初予算（予算月「初」）と補正予算（4月〜3月・決算）を入力します。年度更新で自動的に繰り下がります。</Notice>
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 470px)', marginTop: 14 }}>
            <table data-budget-vendor={year} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, width: 90 }}>コード</th><th style={{ ...TH, minWidth: 220 }}>取引先</th><th style={{ ...TH, textAlign: 'right', width: 170 }}>{cols.ref}</th><th style={{ ...TH, textAlign: 'right', width: 190 }}>{cols.cur}</th><th style={{ ...TH, textAlign: 'right', width: 170 }}>{cols.diff}</th><th style={{ ...TH, textAlign: 'right', width: 150 }}>実績額</th></tr></thead>
              <tbody>
                {BUDGET_VENDORS.map((v) => (
                  <tr key={v.name}>
                    <td style={{ ...TD, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{v.code}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{v.name}</td>
                    <td style={{ ...NUM, color: '#5b6773' }}>{yen(refVal(v.name))}</td>
                    {cell(v.name, curVal(v.name), true)}
                    <td style={{ ...NUM, fontWeight: 600 }}>{yen(afterVal(v.name))}</td>
                    <td style={{ ...NUM, color: '#5b6773' }}>{yen(actualVal(v.name))}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f3f6f9' }}>
                  <td style={{ ...TD, fontWeight: 700 }} colSpan={2}>取引先別予算の合計</td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{yen(vendorSum(refVal))}</td>
                  <td style={{ ...NUM, fontWeight: 700, paddingRight: 23 }}>{yen(vendorSum(curVal))}</td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{yen(vendorSum(afterVal))}</td>
                  <td style={{ ...NUM, fontWeight: 700 }}>{yen(vendorSum(actualVal))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 90 }}>コード</th><th style={{ ...TH, minWidth: 220 }}>科目名</th><th style={{ ...TH, textAlign: 'right', width: 150 }}>{cols.ref}</th><th style={{ ...TH, textAlign: 'right', width: 170 }}>{cols.cur}</th><th style={{ ...TH, textAlign: 'right', width: 150 }}>{cols.diff}</th><th style={{ ...TH, textAlign: 'right', width: 130 }}>実績額</th><th style={{ ...TH, width: 160 }}>摘要</th></tr></thead>
                <tbody>
                  {ITEMS.map((it) => {
                    const editable = !!it.leaf;
                    const r = rollup(it, refVal), c = rollup(it, curVal), a = rollup(it, afterVal);
                    return (
                      <tr key={it.code} style={{ background: it.level === 0 ? '#f3f6f9' : editable ? 'transparent' : '#fdf3f6' }}>
                        <td style={{ ...TD, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{it.code}</td>
                        <td style={{ ...TD, paddingLeft: 12 + it.level * 16, fontWeight: it.level === 0 ? 700 : it.level === 1 ? 600 : 400, whiteSpace: 'nowrap' }}>{it.name}</td>
                        <td style={{ ...NUM, color: '#5b6773' }}>{yen(r)}</td>
                        {editable ? cell(it.code, curVal(it.code), true) : <td style={{ ...NUM, fontWeight: 600 }}>{yen(c)}</td>}
                        <td style={{ ...NUM, fontWeight: 600 }}>{yen(a)}</td>
                        <td style={{ ...NUM, color: '#5b6773' }}>{yen(Math.round(rollup(it, (x) => totalOf(cur, x, 13)) * 0.42))}</td>
                        <td style={TD}>{editable && <input className="field-input" placeholder="摘要" style={{ ...input, padding: '4px 8px', fontSize: 14 }} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16, borderLeft: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 0 }}>
              {[['資金収入合計', inSum], ['資金支出合計', outSum], ['当期資金収支差額合計', diff]].map(([l, v]) => (
                <div key={l as string} style={{ padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>{l}</div><div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: (v as number) < 0 ? '#c0392b' : '#22303c' }}>{yen(v as number)}</div></div>
              ))}
              <div style={{ padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>前期末支払資金残高</div><div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(PREV_END_FUND)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginTop: 8 }}>当期末支払資金残高（予算）</div><div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(PREV_END_FUND + diff)}</div>
              </div>
              <button type="button" className="btn-outline" onClick={() => toast.show('前期末支払資金残高＝貸借対照表の繰越残高から「流動資産－流動負債」を計算した額です')} style={btn()}>前期末支払資金残高に関して</button>
            </div>
          </div>
      )}

      <Modal open={wizard} onClose={() => setWizard(false)} width={560} title="次年度予算作成" strict>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice tone="warn">既に次年度の予算を入力している場合、その金額は上書きされて消えます。</Notice>
          <Field label="次年度予算の作成方法">
            {['当年度予算をそのまま', '当年度予算×倍率', '当年度（8月まで）実績より倍率して作る'].map((m) => <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 14 }}><input type="radio" checked={wMethod === m} onChange={() => setWMethod(m)} />{m}</label>)}
          </Field>
          {wMethod !== '当年度予算をそのまま' && <Field label="倍率（%）"><input className="field-input ring" value={wRate} onChange={(e) => setWRate(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ ...numInput, width: 120 }} /></Field>}
          <Field label="自動設定の予算金額単位">{['1円単位', '千円単位'].map((u) => <label key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16, fontSize: 14 }}><input type="radio" checked={wUnit === u} onChange={() => setWUnit(u)} />{u}で予算を設定する</label>)}</Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setWizard(false)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={runWizard} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
    </SettingsShell>
  );
}
