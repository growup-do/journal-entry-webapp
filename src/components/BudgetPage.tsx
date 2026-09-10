// 予算入力（提案B）：資金収支予算（前年度／当初／補正（月別）／次年度）と業者別予算。
//   マニュアル 3.2 に相当。予算額の設定（年度×月の一覧）・次年度予算作成ウィザード・前期末支払資金残高の表示。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { Field, Notice, SettingsShell, Tabs, btn, input, numInput, toInt, yen } from './ui';
import { VENDORS } from '../data';

type YearTab = '前年度予算' | '当初予算' | '補正予算' | '次年度予算' | '業者別予算';
const TABS: YearTab[] = ['前年度予算', '当初予算', '補正予算', '次年度予算', '業者別予算'];
const MONTHS = ['初', ...FISCAL_MONTHS];

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

type Grid = Record<string, number[]>; // code -> [初(当初), 4..3, 決] 補正額
const initGrid = (mult: number): Grid => Object.fromEntries(Object.entries(BASE).map(([c, v]) => [c, [Math.round(v * mult), ...Array(13).fill(0)]]));

export function BudgetPage({ variant, accent }: { variant: 'form' | 'sheet'; accent: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<YearTab>('当初予算');
  const [month, setMonth] = useState('初');
  const [mode, setMode] = useState<'補正額' | '補正後予算額'>('補正額');
  const [prev, setPrev] = useState<Grid>(() => initGrid(0.96));
  const [cur, setCur] = useState<Grid>(() => initGrid(1));
  const [next, setNext] = useState<Grid>(() => initGrid(0));
  const [ref, setRef] = useState<'当初予算' | '確定予算'>('当初予算');
  const [wizard, setWizard] = useState(false);
  const [wMethod, setWMethod] = useState('当年度予算をそのまま');
  const [wRate, setWRate] = useState('102');
  const [wUnit, setWUnit] = useState('1円単位');
  const [vendor, setVendor] = useState<Record<string, number[]>>(() => Object.fromEntries(VENDORS.filter((v) => v !== '（なし）').map((v, i) => [v, [300000 + i * 120000, 320000 + i * 120000, 0, 330000 + i * 120000]])));

  const grid = tab === '前年度予算' ? prev : tab === '次年度予算' ? next : cur;
  const setGrid = tab === '前年度予算' ? setPrev : tab === '次年度予算' ? setNext : setCur;
  const mi = MONTHS.indexOf(month);
  const totalOf = (g: Grid, code: string, upto = 13) => (g[code] ?? []).slice(0, upto + 1).reduce((a, b) => a + b, 0);
  const rollup = (item: BItem, f: (c: string) => number) => (item.leaf ? f(item.code) : ITEMS.filter((x) => x.leaf && x.code.startsWith(item.code + '-')).reduce((a, x) => a + f(x.code), 0));
  const sumSide = (side: '収入' | '支出', f: (c: string) => number) => ITEMS.filter((x) => x.leaf && x.side === side).reduce((a, x) => a + f(x.code), 0);
  const setCell = (code: string, val: number) => setGrid((g) => ({ ...g, [code]: g[code].map((v, i) => (i === mi ? val : v)) }));

  // 表示列
  const cols = useMemo(() => {
    if (tab === '補正予算' || (tab === '当初予算' && month !== '初')) return { ref: month === '初' ? '前年度予算額' : '現額予算額', cur: month === '初' ? '当初予算額' : mode, diff: month === '初' ? '差引予算' : '補正後予算額' };
    if (tab === '前年度予算') return { ref: '前々年度予算', cur: '前年度予算', diff: '差引' };
    if (tab === '次年度予算') return { ref: '当年度予算', cur: '次年度予算', diff: '差引' };
    return { ref: '前年度予算額', cur: '当初予算額', diff: '差引予算' };
  }, [tab, month, mode]);
  const refGrid = tab === '前年度予算' ? { g: prev, mult: 0.93 } : tab === '次年度予算' ? { g: cur, mult: 1 } : { g: prev, mult: 1 };
  const refVal = (code: string) => (tab === '補正予算' || month !== '初' ? totalOf(cur, code, Math.max(0, mi - 1)) : Math.round(totalOf(refGrid.g, code, 13) * refGrid.mult));
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
    <td style={NUM}>{editable ? <input className="field-input ring" value={yen(v)} onChange={(e) => setCell(code, toInt(e.target.value))} inputMode="numeric" style={{ ...numInput, padding: '4px 8px', fontSize: 12.5, background: '#fffbe6' }} /> : <span style={{ color: '#5b6773' }}>{yen(v)}</span>}</td>
  );
  const chip = (on: boolean): CSSProperties => ({ minWidth: 30, height: 26, padding: '0 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? accent : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? accent : '#d3dbe3') });

  return (
    <SettingsShell variant={variant} title="予算" desc="資金収支計算書の予算（前年度／当初／補正／次年度）と業者別予算を入力します。補正予算は月ごとに入力でき、収支差額と期末支払資金残高を確認しながら設定できます。" badge="予算" actions={<>
      {tab === '次年度予算' && <button type="button" className="btn-outline" onClick={() => setWizard(true)} style={btn(accent)}>次年度予算作成</button>}
      <button type="button" className="btn-outline" onClick={() => toast.show('説明：' + NOT_IMPL)} style={btn()}>説明</button>
      <button type="button" className="submit-btn" onClick={() => toast.show('予算を保存しました（プロトタイプ）')} style={btn(accent, true)}>保存</button>
    </>}>
      <ToastView msg={toast.msg} />
      <Tabs items={TABS} current={tab} onChange={(t) => { setTab(t as YearTab); setMonth('初'); }} accent={accent} />
      {tab === '業者別予算' ? (
        <div style={{ padding: 22 }}>
          <Notice>業者コードごとの支払額に対する予算です。資金収支予算と同じく、前年度／当年度当初／補正／次年度の4種類を持ち、年度更新で自動的に繰り下がります。</Notice>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
            <thead><tr><th style={TH}>業者</th><th style={{ ...TH, textAlign: 'right' }}>前年度予算</th><th style={{ ...TH, textAlign: 'right' }}>当年度当初予算</th><th style={{ ...TH, textAlign: 'right' }}>補正予算（累計）</th><th style={{ ...TH, textAlign: 'right' }}>次年度予算</th><th style={{ ...TH, textAlign: 'right' }}>実績（8月まで）</th></tr></thead>
            <tbody>
              {Object.entries(vendor).map(([v, arr]) => (
                <tr key={v}>
                  <td style={{ ...TD, fontWeight: 600 }}>{v}</td>
                  {arr.map((x, i) => <td key={i} style={NUM}><input className="field-input ring" value={yen(x)} onChange={(e) => setVendor((s) => ({ ...s, [v]: s[v].map((y, k) => (k === i ? toInt(e.target.value) : y)) }))} inputMode="numeric" style={{ ...numInput, padding: '4px 8px', fontSize: 12.5, background: '#fffbe6' }} /></td>)}
                  <td style={{ ...NUM, color: '#5b6773' }}>{yen(Math.round(arr[1] * 0.42))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: '1px solid #eef2f5', flexWrap: 'wrap' }}>
            {(tab === '当初予算' || tab === '補正予算') && (
              <>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0' }}>予算月</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{MONTHS.map((m) => <button key={m} type="button" className="chip" onClick={() => setMonth(m)} style={chip(month === m)}>{m}</button>)}</div>
                {month !== '初' && <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>{(['補正額', '補正後予算額'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} style={{ ...btn(mode === m ? accent : '#5b6773', mode === m, true) }}>{m}を入力</button>)}</div>}
              </>
            )}
            {(tab === '前年度予算' || tab === '次年度予算' || (tab === '当初予算' && month === '初')) && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#8290a0', marginRight: 4 }}>対比する予算</span>{(['当初予算', '確定予算'] as const).map((r) => <button key={r} type="button" onClick={() => setRef(r)} style={btn(ref === r ? accent : '#5b6773', ref === r, true)}>{r}</button>)}</div>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>黄色のセルが入力できます。ピンク＝設定不可（集計項目）</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...TH, width: 90 }}>コード</th><th style={TH}>科目名</th><th style={{ ...TH, textAlign: 'right', width: 150 }}>{cols.ref}</th><th style={{ ...TH, textAlign: 'right', width: 170 }}>{cols.cur}</th><th style={{ ...TH, textAlign: 'right', width: 150 }}>{cols.diff}</th><th style={{ ...TH, textAlign: 'right', width: 130 }}>実績額</th><th style={{ ...TH, width: 160 }}>摘要</th></tr></thead>
                <tbody>
                  {ITEMS.map((it) => {
                    const editable = !!it.leaf;
                    const r = rollup(it, refVal), c = rollup(it, curVal), a = rollup(it, afterVal);
                    return (
                      <tr key={it.code} style={{ background: it.level === 0 ? '#f3f6f9' : editable ? 'transparent' : '#fdf3f6' }}>
                        <td style={{ ...TD, color: '#8290a0', fontVariantNumeric: 'tabular-nums' }}>{it.code}</td>
                        <td style={{ ...TD, paddingLeft: 12 + it.level * 16, fontWeight: it.level === 0 ? 700 : it.level === 1 ? 600 : 400 }}>{it.name}</td>
                        <td style={{ ...NUM, color: '#5b6773' }}>{yen(r)}</td>
                        {editable ? cell(it.code, curVal(it.code), true) : <td style={{ ...NUM, fontWeight: 600 }}>{yen(c)}</td>}
                        <td style={{ ...NUM, fontWeight: 600 }}>{yen(a)}</td>
                        <td style={{ ...NUM, color: '#5b6773' }}>{yen(Math.round(rollup(it, (x) => totalOf(cur, x, 13)) * 0.42))}</td>
                        <td style={TD}>{editable && <input className="field-input" placeholder="摘要" style={{ ...input, padding: '4px 8px', fontSize: 12 }} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16, borderLeft: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 0 }}>
              {[['資金収入合計', inSum], ['資金支出合計', outSum], ['当期資金収支差額合計', diff]].map(([l, v]) => (
                <div key={l as string} style={{ padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd' }}><div style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>{l}</div><div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: (v as number) < 0 ? '#c0392b' : '#22303c' }}>{yen(v as number)}</div></div>
              ))}
              <div style={{ padding: '10px 12px', border: '1px solid #e2e8ee', borderRadius: 10 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0' }}>前期末支払資金残高</div><div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(PREV_END_FUND)}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8290a0', marginTop: 8 }}>当期末支払資金残高（予算）</div><div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{yen(PREV_END_FUND + diff)}</div>
              </div>
              <button type="button" className="btn-outline" onClick={() => toast.show('前期末支払資金残高＝貸借対照表の繰越残高から「流動資産－流動負債」を計算した額です')} style={btn()}>前期末支払資金残高に関して</button>
            </div>
          </div>
        </>
      )}

      <Modal open={wizard} onClose={() => setWizard(false)} width={560} title="次年度予算作成" strict>
        <div style={{ padding: '14px 22px 18px', display: 'grid', gap: 12 }}>
          <Notice tone="warn">既に次年度の予算を入力している場合、その金額は上書きされて消えます。</Notice>
          <Field label="次年度予算の作成方法">
            {['当年度予算をそのまま', '当年度予算×倍率', '当年度（8月まで）実績より倍率して作る'].map((m) => <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}><input type="radio" checked={wMethod === m} onChange={() => setWMethod(m)} />{m}</label>)}
          </Field>
          {wMethod !== '当年度予算をそのまま' && <Field label="倍率（%）"><input className="field-input ring" value={wRate} onChange={(e) => setWRate(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ ...numInput, width: 120 }} /></Field>}
          <Field label="自動設定の予算金額単位">{['1円単位', '千円単位'].map((u) => <label key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16, fontSize: 13 }}><input type="radio" checked={wUnit === u} onChange={() => setWUnit(u)} />{u}で予算を設定する</label>)}</Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setWizard(false)} style={btn()}>キャンセル</button><button type="button" className="submit-btn" onClick={runWizard} style={btn(accent, true)}>OK</button></div>
        </div>
      </Modal>
    </SettingsShell>
  );
}
