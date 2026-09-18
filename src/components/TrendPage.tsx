// 推移（科目推移／資金推移／業者推移の共通部品）
//   指定した科目（業者）の月ごとの実績・累計（資金・業者は予算と残高も）を年度で一覧。値はサンプル。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { Modal } from './Modal';
import { btn } from './ui';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { useAssist } from '../hooks/useAssist';
import { seededSeries } from '../lib/hier';
import { setSession } from '../store/session';

export type TrendKind = 'account' | 'fund' | 'vendor';
const TITLE: Record<TrendKind, string> = { account: '科目推移', fund: '資金推移', vendor: '業者推移' };

interface Props {
  kind: TrendKind;
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  onNavigate: (label: string) => void;
}

export function TrendPage({ kind, variant, accent, accentRgb, onNavigate }: Props) {
  const isVendor = kind === 'vendor';
  const [target, setTarget] = useState(isVendor ? '中央リース' : '保育材料費');
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
  // 8月までが実績（9月以降は未到来として 0）
  const done = months.indexOf('8');
  let accD = 0, accB = 0;
  const rows = months.map((m, i) => {
    const d = i <= done ? debit[i] : 0;
    const c = i <= done ? credit[i] : 0;
    accD += d - c;
    accB += budget[i];
    return { m, d, c, accD, b: budget[i], accB, bal: accB - accD };
  });
  const fieldBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: 260, boxSizing: 'border-box', padding: '7px 10px', background: '#fff', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: 'inherit' };

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={TITLE[kind]}
      subtitle={<>{isVendor ? '指定した業者' : '指定した科目'}の月ごとの推移を年度で一覧します。行をクリックするとその月の元帳を開き、元帳から伝票を訂正できます。<span style={{ color: '#b7791f' }}>（表示中の値はサンプルです）</span></>}
      tools={[{ label: 'グラフ作成', onClick: () => setGraphOpen(true), primary: true }]}
      controls={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7a8794' }}>令和8年度（4月〜3月）</span>
        </div>
      }
    >
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 90 }} rowSpan={2}>月</th>
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
              return (
                <tr key={r.m} onClick={() => { if (!future) { setSession({ ledgerTarget: { account: target, month: r.m } }); onNavigate(isVendor ? '業者元帳' : kind === 'fund' ? '資金元帳' : '勘定元帳'); } }} title={future ? '' : 'クリックでこの月の元帳を開く'} style={{ background: r.m === '8' ? '#fff8d6' : 'transparent', cursor: future ? 'default' : 'pointer' }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{r.m}月{r.m === '8' && <span style={{ marginLeft: 6, fontSize: 10, color: '#b7791f' }}>当月</span>}</td>
                  {isVendor ? (
                    <>
                      <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }}>{yen(r.d)}</td>
                      <td style={{ ...NUM, ...dim }}>{yen(r.accD)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...NUM, ...dim, borderLeft: '1px solid #f1f4f6' }}>{yen(r.d)}</td>
                      <td style={{ ...NUM, ...dim }}>{yen(r.c)}</td>
                      <td style={{ ...NUM, ...dim, fontWeight: 700 }}>{yen(r.accD)}</td>
                    </>
                  )}
                  {kind !== 'account' && (
                    <>
                      <td style={{ ...NUM, borderLeft: '1px solid #f1f4f6' }}>{yen(r.b)}</td>
                      <td style={NUM}>{yen(r.accB)}</td>
                      <td style={{ ...NUM, ...dim, fontWeight: 700, borderLeft: '1px solid #f1f4f6' }}>{yen(r.bal)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* グラフ作成 */}
      <Modal open={graphOpen} onClose={() => setGraphOpen(false)} width={860} title={<>{TITLE[kind]}グラフ <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>{target || '（未指定）'}　令和8年度</span></>}>
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
            onPick={(i) => { if (i <= done) { setGraphOpen(false); setSession({ ledgerTarget: { account: target, month: months[i] } }); onNavigate(isVendor ? '業者元帳' : kind === 'fund' ? '資金元帳' : '勘定元帳'); } }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 11.5, color: '#9aa5b1' }}>
            <span>9月以降は未到来のため実績は0です。棒（または折れ線）をクリックするとその月の元帳を開きます。</span>
            <button type="button" onClick={() => setGraphOpen(false)} style={{ ...btn(accent, true, true), marginLeft: 'auto' }}>閉じる</button>
          </div>
        </div>
      </Modal>
    </ReportShell>
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
