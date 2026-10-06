// 推移表（科目推移表／資金推移表／業者推移表の共通部品）
//   骨格は ReportShell 共通：指定科目（業者）→ 表示切替（当年度／前年度・金額単位）→ 一覧。
//   指定した科目（業者）の月ごとの実績・累計（資金・業者は予算と残高も）を年度で一覧。値はサンプル。
//   月の行から元帳へドリルダウン：画面遷移せず右側の元帳パネルにその月の元帳を表示。全画面の元帳はパネルの「元帳の画面で開く」から（「← 戻る」で同じ科目・表示に戻る）。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { Modal } from './Modal';
import { btn } from './ui';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, Segmented, TD, TH, useMoney, useViewState } from './ReportShell';
import { useAssist } from '../hooks/useAssist';
import { seededSeries } from '../lib/hier';
import { displayName } from '../data';
import { useSession } from '../store/session';
import { LedgerDrawer, useLedgerDrawer } from './LedgerDrawer';
import { ScreenPrintMenu } from './ScreenPrintMenu';

export type TrendKind = 'account' | 'fund' | 'vendor';
/** 画面キー（ルーティング・確認メモで使用。表示名は displayName で現行の用語に合わせる） */
const KEY: Record<TrendKind, string> = { account: '科目推移', fund: '資金推移', vendor: '業者推移' };
const YEARS = ['当年度', '前年度'] as const;
const UNITS = ['円', '千円'] as const;
/** 令和N年度 → 前年度の表記 */
const prevYearOf = (y: string) => y.replace(/(\d+)/, (d) => String(Math.max(1, Number(d) - 1)));

interface Props {
  kind: TrendKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

export function TrendPage({ kind, variant, accent, accentRgb, onNavigate }: Props) {
  const isVendor = kind === 'vendor';
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
  const [compare, setCompare] = useState<'なし' | '予算' | '前年度'>(kind === 'account' ? '前年度' : '予算');
  const [chart, setChart] = useState<'棒' | '折れ線'>('棒');
  const assist = useAssist();
  const months = FISCAL_MONTHS.filter((m) => m !== '決');
  const debit = seededSeries(target + 'd', 12, isVendor ? 30000 : 120000);
  const credit = seededSeries(target + 'c', 12, isVendor ? 0 : 20000);
  const budget = seededSeries(target + 'b', 12, isVendor ? 35000 : 130000);
  const prevYear = seededSeries(target + 'p', 12, isVendor ? 28000 : 110000);
  const prevCredit = seededSeries(target + 'q', 12, isVendor ? 0 : 18000);
  const prevBudget = seededSeries(target + 'r', 12, isVendor ? 33000 : 125000);
  // 当年度は8月までが実績（9月以降は未到来として 0）。前年度は12か月すべて実績
  const done = isPrev ? months.length - 1 : months.indexOf('8');
  let accD = 0, accB = 0;
  const rows = months.map((m, i) => {
    const d = isPrev ? prevYear[i] : i <= done ? debit[i] : 0;
    const c = isPrev ? prevCredit[i] : i <= done ? credit[i] : 0;
    accD += d - c;
    const b = isPrev ? prevBudget[i] : budget[i];
    accB += b;
    return { m, d, c, accD, b, accB, bal: accB - accD };
  });
  // 元帳へのドリルダウン：右側の元帳パネルにその月の元帳を出す
  const drawer = useLedgerDrawer(KEY[kind], kind);
  const openLedger = (month: string) => drawer.open({ account: target, month, kind, from: KEY[kind] });
  const picked = (month: string) => !drawer.collapsed && !!drawer.target && drawer.target.account === target && drawer.target.month === month;
  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: 260, boxSizing: 'border-box', padding: '7px 10px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };

  return (
    <>
    <ReportShell
      variant={variant}
      accent={accent}
      asideWidth={drawer.asideWidth}
      extraTools={isVendor ? <ScreenPrintMenu page="業者推移" accent={accent} /> : undefined}
      title={title}
      subtitle={<>{isVendor ? '指定した業者' : '指定した科目'}の月ごとの推移を年度で一覧します。月の行の「元帳」ボタン（または行のダブルクリック）で、右側にその月の元帳を表示します。全画面で見たいときはパネルの「元帳の画面で開く」を使います。<span style={{ color: '#b7791f' }}>（表示中の値はサンプルです）</span></>}
      tools={[{ label: isVendor ? '業者検索' : '科目検索', onClick: () => assist.open('target', isVendor ? 'vendor' : 'account') }, { label: 'グラフ作成', onClick: () => setGraphOpen(true), primary: true }]}
      period={
        <>
          <span style={LABEL}>集計期間</span>
          <span style={{ fontSize: 12.5, color: '#48565f' }}><b style={{ color: isPrev ? '#b7791f' : '#22303c' }}>{yearLabel}</b>（4月〜3月）</span>
        </>
      }
      switches={
        <>
          <Segmented label="年度" items={YEARS} value={view.year} onChange={(y) => setView({ year: y })} accent={accent} />
          <Segmented label="金額単位" items={UNITS} value={view.unit} onChange={(u) => setView({ unit: u })} accent={accent} />
        </>
      }
      notice={isPrev ? <span>前年度（{yearLabel}）の実績を表示しています。前年度の月からは元帳を開けません（当年度に切り替えると開けます）。</span> : undefined}
      target={
        <>
          <span style={LABEL}>{isVendor ? '業者指定' : kind === 'fund' ? '指定科目（費目－区分コード）' : '科目指定'}</span>
          <AssistField
            value={target}
            placeholder={isVendor ? '業者を選択' : '科目を選択'}
            open={assist.isOpen('target')}
            onOpen={() => assist.open('target', isVendor ? 'vendor' : 'account')}
            accent={accent}
            accentRgb={accentRgb}
            buttonStyle={fieldBtn}
            panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 260, zIndex: 60 }}
            groups={assist.groups}
            query={assist.query}
            empty={assist.empty}
            onInput={assist.setQuery}
            onPick={(v) => {
              setTarget(v === '（なし）' ? '' : v);
              assist.close();
            }}
          />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>単位：{view.unit}</span>
        </>
      }
    >
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 150 }} rowSpan={2}>月</th>
              <th style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1' }} colSpan={kind === 'account' ? 3 : isVendor ? 2 : 3}>実績</th>
              {kind !== 'account' && <th style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1' }} colSpan={2}>予算</th>}
              {kind !== 'account' && <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }} rowSpan={2}>残高</th>}
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
              {kind !== 'account' && (
                <>
                  <th style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }}>月次</th>
                  <th style={{ ...TH, textAlign: 'right' }}>累計</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const future = i > done;
              const dim: CSSProperties = future ? { color: '#b3bcc5' } : {};
              const canOpen = !future && !isPrev && !!target;
              const current = !isPrev && r.m === '8';
              return (
                <tr key={r.m} data-month={r.m} onDoubleClick={() => { if (canOpen) openLedger(r.m); }} title={canOpen ? 'ダブルクリックでこの月の元帳を開く' : undefined} data-picked={picked(r.m) || undefined} style={{ background: picked(r.m) ? '#eaf5ef' : current ? '#fff8d6' : 'transparent', boxShadow: picked(r.m) ? `inset 3px 0 0 ${accent}` : undefined, cursor: canOpen ? 'pointer' : 'default' }}>
                  <td style={{ ...TD, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.m}月{current && <span style={{ marginLeft: 6, fontSize: 10, color: '#b7791f' }}>当月</span>}
                    {canOpen && <button type="button" className="btn-outline" data-action="元帳" onClick={(e) => { e.stopPropagation(); openLedger(r.m); }} style={{ marginLeft: 10, padding: '1px 8px', borderRadius: 6, border: '1px solid #dde4ea', background: '#fff', color: accent, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>元帳 ›</button>}
                  </td>
                  {isVendor ? (
                    <>
                      <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }}>{amt(r.d)}</td>
                      <td style={{ ...NUM, ...dim }}>{amt(r.accD)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }}>{amt(r.d)}</td>
                      <td style={{ ...NUM, ...dim }}>{amt(r.c)}</td>
                      <td style={{ ...NUM, ...dim, fontWeight: 700 }}>{amt(r.accD)}</td>
                    </>
                  )}
                  {kind !== 'account' && (
                    <>
                      <td style={{ ...NUM, borderLeft: '1px solid #f1f4f6' }}>{amt(r.b)}</td>
                      <td style={NUM}>{amt(r.accB)}</td>
                      <td style={{ ...NUM, ...dim, fontWeight: 700, borderLeft: '1px solid #f1f4f6' }}>{amt(r.bal)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* グラフ作成 */}
      <Modal open={graphOpen} onClose={() => setGraphOpen(false)} width={860} title={<>{title} グラフ <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{target || '（未指定）'}　{yearLabel}</span></>}>
        <div style={{ padding: '12px 22px 18px' }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 12.5 }}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={LABEL}>表示</span>{(['月次', '累計'] as const).map((o) => <button key={o} type="button" onClick={() => setMode(o)} style={btn(mode === o ? accent : '#5b6773', mode === o, true)}>{o}</button>)}</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={LABEL}>比較</span>{(['なし', ...(kind === 'account' ? [] : ['予算' as const]), '前年度'] as const).map((o) => <button key={o} type="button" onClick={() => setCompare(o)} style={btn(compare === o ? accent : '#5b6773', compare === o, true)}>{o}</button>)}</span>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={LABEL}>種類</span>{(['棒', '折れ線'] as const).map((o) => <button key={o} type="button" onClick={() => setChart(o)} style={btn(chart === o ? accent : '#5b6773', chart === o, true)}>{o}</button>)}</span>
          </div>
          <TrendChart
            labels={months.map((m) => m + '月')}
            primary={{ name: `実績（${mode}）`, values: rows.map((r) => (mode === '月次' ? r.d - r.c : r.accD)), color: accent }}
            secondary={compare === 'なし' ? null : compare === '予算' ? { name: `予算（${mode}）`, values: rows.map((r) => (mode === '月次' ? r.b : r.accB)), color: '#b7791f' } : { name: `前年度（${mode}）`, values: prevYear.reduce<number[]>((acc, v, i) => { acc.push(mode === '月次' ? v : (acc[i - 1] ?? 0) + v); return acc; }, []), color: '#2c5f9e' }}
            doneIndex={done}
            line={chart === '折れ線'}
            onPick={(i) => { if (i <= done && !isPrev && target) { setGraphOpen(false); openLedger(months[i]); } }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 11.5, color: '#9aa5b1' }}>
            <span>{isPrev ? '前年度の実績です（元帳は当年度のみ開けます）。' : '9月以降は未到来のため実績は0です。棒（または折れ線）をクリックするとその月の元帳を開きます。'}</span>
            <button type="button" onClick={() => setGraphOpen(false)} style={{ ...btn(accent, true, true), marginLeft: 'auto' }}>閉じる</button>
          </div>
        </div>
      </Modal>
    </ReportShell>
    <LedgerDrawer state={drawer} accent={accent} onNavigate={onNavigate} />
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
      <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: line ? 3 : 10, background: primary.color, borderRadius: 2 }} />{primary.name}</span>
        {secondary && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: secondary.color, borderRadius: 2 }} />{secondary.name}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9aa5b1' : '#eef2f5'} /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8290a0">{fmt(t)}</text></g>)}
        {labels.map((l, i) => <text key={l} x={x(i)} y={H - B + 18} textAnchor="middle" fontSize={11.5} fill={i > doneIndex ? '#b3bcc5' : '#48565f'}>{l}</text>)}
        {!line && primary.values.map((v, i) => <rect key={i} x={x(i) - bw / 2} y={Math.min(y(v), y(0))} width={bw} height={Math.abs(y(v) - y(0))} rx={3} fill={primary.color} opacity={i > doneIndex ? 0.25 : 0.85} onClick={() => onPick(i)} style={{ cursor: i > doneIndex ? 'default' : 'pointer' }}><title>{labels[i]} {primary.name}：{v.toLocaleString('ja-JP')}</title></rect>)}
        {line && <path d={path(primary.values)} fill="none" stroke={primary.color} strokeWidth={2.5} />}
        {line && primary.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={primary.color} opacity={i > doneIndex ? 0.3 : 1} onClick={() => onPick(i)} style={{ cursor: i > doneIndex ? 'default' : 'pointer' }}><title>{labels[i]} {primary.name}：{v.toLocaleString('ja-JP')}</title></circle>)}
        {secondary && <path d={path(secondary.values)} fill="none" stroke={secondary.color} strokeWidth={2} strokeDasharray="6 4" />}
        {secondary && secondary.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#fff" stroke={secondary.color} strokeWidth={2}><title>{labels[i]} {secondary.name}：{v.toLocaleString('ja-JP')}</title></circle>)}
      </svg>
    </div>
  );
}
