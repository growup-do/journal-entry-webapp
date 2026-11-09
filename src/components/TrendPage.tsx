// 推移表（科目推移表／資金推移表／取引先推移表の共通部品）
//   骨格は ReportShell 共通：指定科目（取引先）→ 表示切替（当年度／前年度・金額単位）→ 一覧。
//   指定科目は伝票入力と同じコンボ（コード入力・候補にコード表示。確認メモ #94）。
//   行は現行と同じく「当初」（期首）→ 4月〜3月 → 「決算月」（確認メモ #95／#96／#101／#102）。資金推移表は「達成率」列も表示（確認メモ #100）。
//   指定した科目（取引先）の月ごとの実績・累計（資金・取引先は予算と残高も）を年度で一覧。値はサンプル。
//   月の行から元帳へドリルダウン：画面遷移せず右側の元帳パネルにその月の元帳を表示。全画面の元帳はパネルの「元帳の画面で開く」から（「← 戻る」で同じ科目・表示に戻る）。
//   前年度の表示中は元帳パネルを使えない（確認メモ #99）。前年度のグラフの比較は「前々年度」になる（確認メモ #97）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ComboField, EntryStyles, scopeStyle } from './EntryCommon';
import { Modal } from './Modal';
import { btn } from './ui';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, Segmented, TD, TH, useMoney, useViewState } from './ReportShell';
import { seededSeries } from '../lib/hier';
import { displayName } from '../data';
import { useSession } from '../store/session';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import type { MonthFilter } from '../types';

export type TrendKind = 'account' | 'fund' | 'vendor';
/** 画面キー（ルーティング・確認メモで使用。表示名は displayName で現行の用語に合わせる） */
const KEY: Record<TrendKind, string> = { account: '科目推移', fund: '資金推移', vendor: '業者推移' };
const YEARS = ['当年度', '前年度'] as const;
const UNITS = ['円', '千円'] as const;
/** 令和N年度 → 前年度の表記 */
const prevYearOf = (y: string, back = 1) => y.replace(/(\d+)/, (d) => String(Math.max(1, Number(d) - back)));

/** 推移表の1行。当初（期首）／月／決算月 */
interface Row {
  kind: 'opening' | 'month' | 'closing';
  /** 元帳を開く月（当初は開けないので null） */
  m: MonthFilter;
  label: string;
  d: number;
  c: number;
  accD: number;
  b: number;
  /** 予算累計（当初行は無し） */
  accB: number | null;
  bal: number;
  /** 達成率（実績累計 ÷ 予算累計。資金推移表） */
  rate: number | null;
}

interface Props {
  kind: TrendKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

export function TrendPage({ kind, variant, accent, onNavigate }: Props) {
  const isVendor = kind === 'vendor';
  const isAcct = kind === 'account';
  const isFund = kind === 'fund';
  const s = useSession();
  const money = useMoney();
  const title = displayName(KEY[kind]);
  const [view, setView] = useViewState<{ target: string; year: (typeof YEARS)[number]; unit: (typeof UNITS)[number] }>(KEY[kind], { target: isVendor ? '中央リース' : '保育材料費', year: '当年度', unit: '円' });
  const target = view.target;
  const setTarget = (t: string) => setView({ target: t });
  const isPrev = view.year === '前年度';
  const yearLabel = isPrev ? prevYearOf(s.fiscalYear) : s.fiscalYear;
  /** 金額単位（千円は千円未満を四捨五入） */
  const amt = (n: number) => money(view.unit === '千円' ? Math.round(n / 1000) : n);
  const [graphOpen, setGraphOpen] = useState(false);
  const [mode, setMode] = useState<'月次' | '累計'>('月次');
  const [compare, setCompare] = useState<'なし' | '予算' | '前年度'>(isAcct ? '前年度' : '予算');
  const [chart, setChart] = useState<'棒' | '折れ線'>('棒');
  const months = FISCAL_MONTHS.filter((m) => m !== '決');
  const debit = seededSeries(target + 'd', 12, isVendor ? 30000 : 120000);
  const credit = seededSeries(target + 'c', 12, isVendor ? 0 : 20000);
  const budget = seededSeries(target + 'b', 12, isVendor ? 35000 : 130000);
  const prevYear = seededSeries(target + 'p', 12, isVendor ? 28000 : 110000);
  const prevCredit = seededSeries(target + 'q', 12, isVendor ? 0 : 18000);
  const prevBudget = seededSeries(target + 'r', 12, isVendor ? 33000 : 125000);
  /** 前々年度（前年度を表示しているときのグラフの比較用。確認メモ #97） */
  const prev2Year = seededSeries(target + 'pp', 12, isVendor ? 26000 : 100000);
  // 当年度は8月までが実績（9月以降は未到来として 0）。前年度は12か月すべて実績
  const done = isPrev ? months.length - 1 : months.indexOf('8');
  const budgetArr = isPrev ? prevBudget : budget;
  /** 当初（期首）：科目推移表は期首残高（サンプル）。資金・取引先は当初予算（年額） */
  const opening = isAcct ? seededSeries(target + 'o', 1, 600000)[0] : 0;
  const yearBudget = budgetArr.reduce((a, v) => a + v, 0);
  /** 決算月（決算整理）：当年度は未到来のため 0、前年度はサンプル */
  const closingD = isPrev ? seededSeries(target + 'kd', 1, isVendor ? 20000 : 80000)[0] : 0;
  const closingC = isPrev && !isVendor ? seededSeries(target + 'kc', 1, 30000)[0] : 0;
  let accD = opening, accB = 0;
  const monthRows: Row[] = months.map((m, i) => {
    const d = isPrev ? prevYear[i] : i <= done ? debit[i] : 0;
    const c = isPrev ? prevCredit[i] : i <= done ? credit[i] : 0;
    accD += d - c;
    const b = budgetArr[i];
    accB += b;
    return { kind: 'month', m, label: `${m}月`, d, c, accD, b, accB, bal: accB - accD, rate: accB ? accD / accB : null };
  });
  accD += closingD - closingC;
  const closingRow: Row = { kind: 'closing', m: '決', label: '決算月', d: closingD, c: closingC, accD, b: 0, accB, bal: accB - accD, rate: accB ? accD / accB : null };
  const openingRow: Row = { kind: 'opening', m: null, label: '当初', d: isAcct ? opening : 0, c: 0, accD: opening, b: isAcct ? 0 : yearBudget, accB: null, bal: isAcct ? opening : yearBudget, rate: null };
  const rows: Row[] = [openingRow, ...monthRows, closingRow];
  const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
  // 元帳へのドリルダウン：右側の元帳パネルにその月の元帳を出す
  const drawer = useLedgerDrawer(KEY[kind], kind);
  const openLedger = (month: MonthFilter) => drawer.open({ account: target, month, kind, from: KEY[kind] });
  const picked = (month: MonthFilter) => !drawer.collapsed && !!drawer.target && drawer.target.account === target && drawer.target.month === month;
  const prevNote = '前年度の表示中は元帳パネルを使えません（当年度に切り替えると使えます）';
  /** グラフの比較の表示名：前年度を表示しているときは「前年度」＝前々年度（確認メモ #97） */
  const cmpLabel = (o: string) => (o === '前年度' && isPrev ? '前々年度' : o);
  const cmpYears = isPrev ? prev2Year : prevYear;

  return (
    <>
    <ReportShell
      variant={variant}
      accent={accent}
      asideWidth={drawer.asideWidth}
      extraTools={isVendor ? <ScreenPrintMenu page="業者推移" accent={accent} /> : undefined}
      title={title}
      subtitle={<>{isVendor ? '指定した取引先' : '指定した科目'}の月ごとの推移を年度で一覧します。行は「当初」（期首）から各月、「決算月」の順です。月の行の「元帳」ボタン（または行のダブルクリック）で、右側にその月の元帳を表示します。全画面で見たいときはパネルの「元帳の画面で開く」を使います。<span style={{ color: '#b7791f' }}>（表示中の値はサンプルです）</span></>}
      tools={[{ label: isVendor ? '取引先検索' : '科目検索', onClick: () => document.getElementById('trend-target')?.focus() }, { label: 'グラフ作成', onClick: () => setGraphOpen(true), primary: true }]}
      period={
        <>
          <span style={{ fontSize: 14, color: '#48565f' }}><b style={{ color: isPrev ? '#b7791f' : '#22303c' }}>{yearLabel}</b>（4月〜3月）</span>
        </>
      }
      switches={
        <>
          <Segmented label="年度" items={YEARS} value={view.year} onChange={(y) => setView({ year: y })} accent={accent} />
          <Segmented label="金額単位" items={UNITS} value={view.unit} onChange={(u) => setView({ unit: u })} accent={accent} />
        </>
      }
      notice={isPrev ? <span>前年度（{yearLabel}）の実績を表示しています。{prevNote}。</span> : undefined}
      targetLabel={isVendor ? '指定取引先' : '指定科目'}
      target={
        <>
          {/* 伝票入力と同じコンボ：コード・名称・フリガナで絞り込み、候補にコードを表示（確認メモ #94） */}
          <div className="ef-scope" style={{ ...scopeStyle(accent), flex: '0 1 380px', minWidth: 240 }}>
            <EntryStyles />
            <div className="ef-field">
              <ComboField id="trend-target" kind={isVendor ? 'vendor' : 'account'} value={target} onChange={setTarget} placeholder={isVendor ? 'コード・取引先名で指定' : 'コード・科目名・フリガナで指定'} listWidth={400} fontSize={14} padY={7} />
            </div>
          </div>
          <span style={{ fontSize: 12, color: '#8290a0' }}>コードを入力するか、候補から選びます</span>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#7a8794' }}>単位：{view.unit}</span>
        </>
      }
    >
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 150 }} rowSpan={2}>月</th>
              <th style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1' }} colSpan={isAcct ? 3 : isVendor ? 2 : 3}>実績</th>
              {!isAcct && <th style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1' }} colSpan={2}>予算</th>}
              {!isAcct && <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }} rowSpan={2}>残高</th>}
              {isFund && <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1', width: 90 }} rowSpan={2} title="実績累計 ÷ 予算累計">達成率</th>}
            </tr>
            <tr>
              {isVendor ? (
                <>
                  <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }}>月次</th>
                  <th style={{ ...TH, textAlign: 'right' }}>累計</th>
                </>
              ) : (
                <>
                  <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }}>借方</th>
                  <th style={{ ...TH, textAlign: 'right' }}>貸方</th>
                  <th style={{ ...TH, textAlign: 'right' }}>累計</th>
                </>
              )}
              {!isAcct && (
                <>
                  <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }}>月次</th>
                  <th style={{ ...TH, textAlign: 'right' }}>累計</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const i = months.indexOf(r.m ?? '');
              const future = r.kind === 'closing' ? !isPrev : r.kind === 'month' && i > done;
              const dim: CSSProperties = future ? { color: '#b3bcc5' } : {};
              const canOpen = r.kind !== 'opening' && !future && !isPrev && !!target;
              const current = !isPrev && r.m === '8';
              const isOpening = r.kind === 'opening';
              const rowTitle = isOpening ? (isAcct ? '期首の残高（当初）' : '当初予算（年額）') : r.kind === 'closing' ? (future ? '決算整理の分。決算が確定すると表示されます' : '決算整理の分') : canOpen ? 'ダブルクリックでこの月の元帳を開く' : undefined;
              const isSel = picked(r.m);
              return (
                <tr key={r.label} data-month={r.m ?? '当初'} data-row-kind={r.kind} onDoubleClick={() => { if (canOpen) openLedger(r.m); }} title={rowTitle} data-picked={isSel || undefined} style={{ background: isSel ? '#eaf5ef' : current ? '#fff8d6' : isOpening || r.kind === 'closing' ? '#f8fafc' : 'transparent', boxShadow: isSel ? `inset 3px 0 0 ${accent}` : undefined, cursor: canOpen ? 'pointer' : 'default', borderTop: r.kind === 'closing' ? '2px solid #e2e8ee' : undefined, borderBottom: isOpening ? '2px solid #e2e8ee' : undefined }}>
                  <td style={{ ...TD, fontWeight: 700, whiteSpace: 'nowrap', color: isOpening ? '#5b6773' : undefined }}>
                    {r.label}{current && <span style={{ marginLeft: 6, fontSize: 12, color: '#b7791f' }}>当月</span>}
                    {canOpen && <button type="button" className="btn-outline" data-action="元帳" onClick={(e) => { e.stopPropagation(); openLedger(r.m); }} style={{ marginLeft: 10, padding: '1px 8px', borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', color: accent, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>元帳 ›</button>}
                  </td>
                  {isVendor ? (
                    <>
                      <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }}>{isOpening ? '' : amt(r.d)}</td>
                      <td style={{ ...NUM, ...dim }}>{isOpening ? '' : amt(r.accD)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }}>{isOpening && !isAcct ? '' : amt(r.d)}</td>
                      <td style={{ ...NUM, ...dim }}>{isOpening && !isAcct ? '' : amt(r.c)}</td>
                      <td style={{ ...NUM, ...dim, fontWeight: 700 }}>{isOpening && !isAcct ? '' : amt(r.accD)}</td>
                    </>
                  )}
                  {!isAcct && (
                    <>
                      <td style={{ ...NUM, borderLeft: '1px solid #f1f4f6' }} title={isOpening ? '当初予算（年額）' : undefined}>{amt(r.b)}</td>
                      <td style={NUM}>{r.accB == null ? '' : amt(r.accB)}</td>
                      <td style={{ ...NUM, ...dim, fontWeight: 700, borderLeft: '1px solid #f1f4f6' }}>{amt(r.bal)}</td>
                    </>
                  )}
                  {isFund && <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }} data-rate>{pct(r.rate)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* グラフ作成 */}
      <Modal open={graphOpen} onClose={() => setGraphOpen(false)} width={860} title={<>{title} グラフ <span style={{ fontSize: 14, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{target || '（未指定）'}　{yearLabel}</span></>}>
        <div style={{ padding: '12px 22px 18px' }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 14 }}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={LABEL}>表示</span>{(['月次', '累計'] as const).map((o) => <button key={o} type="button" onClick={() => setMode(o)} style={btn(mode === o ? accent : '#5b6773', mode === o, true)}>{o}</button>)}</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={LABEL}>比較</span>{(['なし', ...(isAcct ? [] : ['予算' as const]), '前年度'] as const).map((o) => <button key={o} type="button" onClick={() => setCompare(o)} style={btn(compare === o ? accent : '#5b6773', compare === o, true)}>{cmpLabel(o)}</button>)}</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={LABEL}>種類</span>{(['棒', '折れ線'] as const).map((o) => <button key={o} type="button" onClick={() => setChart(o)} style={btn(chart === o ? accent : '#5b6773', chart === o, true)}>{o}</button>)}</span>
          </div>
          <TrendChart
            labels={months.map((m) => m + '月')}
            primary={{ name: `実績（${mode}）${isPrev ? `　${yearLabel}` : ''}`, values: monthRows.map((r) => (mode === '月次' ? r.d - r.c : r.accD)), color: accent }}
            secondary={compare === 'なし' ? null : compare === '予算' ? { name: `予算（${mode}）`, values: monthRows.map((r) => (mode === '月次' ? r.b : r.accB ?? 0)), color: '#b7791f' } : { name: `${cmpLabel('前年度')}（${mode}）　${prevYearOf(s.fiscalYear, isPrev ? 2 : 1)}`, values: cmpYears.reduce<number[]>((acc, v, i) => { acc.push(mode === '月次' ? v : (acc[i - 1] ?? 0) + v); return acc; }, []), color: '#2c5f9e' }}
            doneIndex={done}
            line={chart === '折れ線'}
            onPick={(i) => { if (i <= done && !isPrev && target) { setGraphOpen(false); openLedger(months[i]); } }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 12, color: '#9aa5b1' }}>
            <span>{isPrev ? `前年度（${yearLabel}）の実績です。比較の「前々年度」は ${prevYearOf(s.fiscalYear, 2)} の値です（元帳は当年度のみ開けます）。` : '9月以降は未到来のため実績は0です。棒（または折れ線）をクリックするとその月の元帳を開きます。'}</span>
            <button type="button" onClick={() => setGraphOpen(false)} style={{ ...btn(accent, true, true), marginLeft: 'auto' }}>閉じる</button>
          </div>
        </div>
      </Modal>
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} disabled={isPrev} disabledNote={prevNote} />
    </>
  );
}

/** 推移グラフ（SVG）：実績を棒（または折れ線）、比較系列を折れ線で重ねる */
function TrendChart({ labels, primary, secondary, doneIndex, line, onPick }: { labels: string[]; primary: { name: string; values: number[]; color: string }; secondary: { name: string; values: number[]; color: string } | null; doneIndex: number; line: boolean; onPick: (i: number) => void }) {
  const W = 800, H = 300, L = 70, R = 20, T = 30, B = 36;
  const n = labels.length;
  const all = [...primary.values, ...(secondary?.values ?? [])];
  const maxRaw = Math.max(...all, 1);
  const minRaw = Math.min(...all, 0);
  const pow = Math.pow(10, Math.floor(Math.log10(maxRaw)));
  const step = [1, 2, 5, 10].map((k) => k * pow).find((st) => maxRaw / st <= 6) ?? pow;
  const max = Math.ceil(maxRaw / step) * step;
  const min = minRaw < 0 ? Math.floor(minRaw / step) * step : 0;
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (iw / n) * (i + 0.5);
  const y = (v: number) => T + ih - ((v - min) / (max - min)) * ih;
  const ticks: number[] = []; for (let v = min; v <= max; v += step) ticks.push(v);
  const bw = (iw / n) * 0.5;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const fmt = (v: number) => (Math.abs(v) >= 10000 ? (v / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '万' : v.toLocaleString('ja-JP'));
  return (
    <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '10px 12px 4px' }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 14, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: line ? 3 : 10, background: primary.color, borderRadius: 2 }} />{primary.name}</span>
        {secondary && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: secondary.color, borderRadius: 2 }} />{secondary.name}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9aa5b1' : '#eef2f5'} /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="#8290a0">{fmt(t)}</text></g>)}
        {labels.map((l, i) => <text key={l} x={x(i)} y={H - B + 18} textAnchor="middle" fontSize={12} fill={i > doneIndex ? '#b3bcc5' : '#48565f'}>{l}</text>)}
        {!line && primary.values.map((v, i) => <rect key={i} x={x(i) - bw / 2} y={Math.min(y(v), y(0))} width={bw} height={Math.abs(y(v) - y(0))} rx={3} fill={primary.color} opacity={i > doneIndex ? 0.25 : 0.85} onClick={() => onPick(i)} style={{ cursor: i > doneIndex ? 'default' : 'pointer' }}><title>{labels[i]} {primary.name}：{v.toLocaleString('ja-JP')}</title></rect>)}
        {line && <path d={path(primary.values)} fill="none" stroke={primary.color} strokeWidth={2.5} />}
        {line && primary.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={primary.color} opacity={i > doneIndex ? 0.3 : 1} onClick={() => onPick(i)} style={{ cursor: i > doneIndex ? 'default' : 'pointer' }}><title>{labels[i]} {primary.name}：{v.toLocaleString('ja-JP')}</title></circle>)}
        {secondary && <path d={path(secondary.values)} fill="none" stroke={secondary.color} strokeWidth={2} strokeDasharray="6 4" />}
        {secondary && secondary.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#fff" stroke={secondary.color} strokeWidth={2}><title>{labels[i]} {secondary.name}：{v.toLocaleString('ja-JP')}</title></circle>)}
      </svg>
    </div>
  );
}
