// 月次試算／月次決算（共通部品）
//   部（資産／負債／事業活動／資金）タブ、表示列のチェック、区分の深さ（大〜細々）で階層表を切替。
//   月次試算：拠点（本部／保育園）ごとの前月繰越・残高。月次決算：小計／本部／保育園／内部取引消去／社会福祉事業 の当年度末。
//   資産の部のみサンプルデータあり。他の部は「サンプル未作成」。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { CHECK, LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { BS_ASSET_ROWS } from '../data';
import { byDepth, grandTotal, rollup } from '../lib/hier';
import type { MonthFilter } from '../types';

const PARTS = ['資産の部', '負債の部', '事業活動', '資金の部'];
const DEPTHS = ['大区分', '中区分', '小区分', '細々区分'];

interface Props {
  mode: 'trial' | 'closing';
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function TrialBalancePage({ mode, variant, accent, onNavigate }: Props) {
  const [month, setMonth] = useState<MonthFilter>('8');
  const [part, setPart] = useState(0);
  const [depth, setDepth] = useState(3);
  const [cols, setCols] = useState({ carry: true, debit: false, credit: false, balance: true });
  const isClosing = mode === 'closing';
  const all = rollup(BS_ASSET_ROWS, 4);
  const rows = byDepth(all, depth);
  const total = grandTotal(all, 4);
  const toggle = (k: keyof typeof cols) => setCols((c) => ({ ...c, [k]: !c[k] }));

  // 月次決算の列：小計／本部／保育園／内部取引消去／社会福祉事業（当年度末）
  const closingCols = (v: number[]) => {
    const hq = v[1], hoiku = v[3];
    return [hq + hoiku, hq, hoiku, 0, hq + hoiku];
  };
  const trialCols = (v: number[]) => [
    ...(cols.carry ? [v[0]] : []), ...(cols.debit ? [Math.max(0, v[1] - v[0])] : []), ...(cols.credit ? [Math.max(0, v[0] - v[1])] : []), ...(cols.balance ? [v[1]] : []),
    ...(cols.carry ? [v[2]] : []), ...(cols.debit ? [Math.max(0, v[3] - v[2])] : []), ...(cols.credit ? [Math.max(0, v[2] - v[3])] : []), ...(cols.balance ? [v[3]] : []),
  ];
  const subHeads = [...(cols.carry ? ['前月繰越'] : []), ...(cols.debit ? ['借方'] : []), ...(cols.credit ? ['貸方'] : []), ...(cols.balance ? ['残高'] : [])];
  const chip = (on: boolean, color = accent): CSSProperties => ({ padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: on ? color : '#fff', color: on ? '#fff' : '#5b6773', border: '1px solid ' + (on ? color : '#d3dbe3') });

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title={isClosing ? '月次決算' : '月次試算'}
      subtitle={isClosing ? '拠点ごとの当年度末（決算）残高を、内部取引消去を含めて一覧します。' : '拠点ごとの前月繰越・当月の借方／貸方・残高を一覧します。'}
      tools={[...DEPTHS.map((d, i) => ({ label: d, onClick: () => setDepth(i), primary: depth === i })), { label: '残高' }, { label: 'ライン色' }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={LABEL}>指定年月</span>
            <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} />
            <span style={{ fontSize: 12.5, color: '#48565f' }}>令和8年 {month ?? '8'}月</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isClosing && <button type="button" className="chip" style={chip(true, '#0ea5c9')}>充実残額</button>}
            {PARTS.map((p, i) => (
              <button key={p} type="button" className="chip" onClick={() => setPart(i)} style={chip(part === i, i === 0 ? '#e8791e' : '#d9a400')}>{p}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {isClosing ? (
                <>
                  <label style={CHECK}><input type="checkbox" disabled />予算</label>
                  <label style={CHECK}><input type="checkbox" checked readOnly />当年度末(決算)</label>
                  <label style={CHECK}><input type="checkbox" disabled />前年度末</label>
                  <label style={CHECK}><input type="checkbox" disabled />増減</label>
                  <label style={CHECK}><input type="checkbox" disabled />差異</label>
                </>
              ) : (
                <>
                  <label style={CHECK}><input type="checkbox" checked={cols.carry} onChange={() => toggle('carry')} />前月繰越</label>
                  <label style={CHECK}><input type="checkbox" checked={cols.debit} onChange={() => toggle('debit')} />借方</label>
                  <label style={CHECK}><input type="checkbox" checked={cols.credit} onChange={() => toggle('credit')} />貸方</label>
                  <label style={CHECK}><input type="checkbox" checked={cols.balance} onChange={() => toggle('balance')} />残高</label>
                  <label style={CHECK}><input type="checkbox" disabled />前月累計</label>
                  <label style={CHECK}><input type="checkbox" disabled />当月</label>
                  <label style={CHECK}><input type="checkbox" disabled />累計</label>
                </>
              )}
            </div>
          </div>
        </>
      }
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
        {part !== 0 ? (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>「{PARTS[part]}」のサンプルデータは未作成です（資産の部で表の構成をご確認ください）。</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {isClosing ? (
                <>
                  <tr>
                    <th style={{ ...TH, minWidth: 220 }} rowSpan={2}>科目名</th>
                    {['小計', '本部', 'チャイルド保育園', '内部取引消去', '社会福祉事業'].map((h) => <th key={h} style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1' }}>{h}</th>)}
                  </tr>
                  <tr>{[0, 1, 2, 3, 4].map((i) => <th key={i} style={{ ...TH, textAlign: 'right', borderLeft: '1px solid #e6ecf1', fontWeight: 500 }}>当年度末(決算)</th>)}</tr>
                </>
              ) : (
                <>
                  <tr>
                    <th style={{ ...TH, minWidth: 220 }} rowSpan={2}>科目名</th>
                    <th style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1' }} colSpan={subHeads.length}>本部</th>
                    <th style={{ ...TH, textAlign: 'center', borderLeft: '1px solid #e6ecf1' }} colSpan={subHeads.length}>チャイルド保育園</th>
                  </tr>
                  <tr>
                    {[0, 1].map((g) => subHeads.map((h, i) => <th key={g + h} style={{ ...TH, textAlign: 'right', fontWeight: 500, borderLeft: i === 0 ? '1px solid #e6ecf1' : undefined }}>{h}</th>))}
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const vals = isClosing ? closingCols(r.values) : trialCols(r.values);
                const bold = r.level === 0;
                return (
                  <tr key={i} style={{ background: r.level === 0 ? '#f3f6f9' : r.level === 1 ? '#f8fafc' : 'transparent' }}>
                    <td style={{ ...TD, paddingLeft: 12 + r.level * 18, fontWeight: bold ? 700 : r.level === 1 ? 600 : 400 }}>{r.name}</td>
                    {vals.map((v, k) => <td key={k} style={{ ...NUM, fontWeight: bold ? 700 : 400, borderLeft: isClosing || k % subHeads.length === 0 ? '1px solid #f1f4f6' : undefined }}>{yen(v)}</td>)}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e9eef3' }}>
                <td style={{ ...TD, fontWeight: 700 }}>合計</td>
                {(isClosing ? closingCols(total) : trialCols(total)).map((v, k) => <td key={k} style={{ ...NUM, fontWeight: 700 }}>{yen(v)}</td>)}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </ReportShell>
  );
}
