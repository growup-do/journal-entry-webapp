// 預金残高（推移・分析）。
//   以前はホームに置いていた「銀行の預金残高」を、推移・分析に移した（確認メモ #149）。
//   上段：口座ごとの現在の残高と前日比。下段：月末残高の推移（口座別・合計）。
//   金額はすべてサンプル値。本番では預金出納（オプション）の銀行連携、または通帳残高の入力を反映する。

import type { CSSProperties } from 'react';
import { HOME_BANKS } from '../data';
import { useSession } from '../store/session';

const yen = (n: number) => n.toLocaleString('ja-JP');
const MONTHS = ['4月末', '5月末', '6月末', '7月末', '8月末'];
/** 月末残高のサンプル：現在の残高に対する比率（HOME_BANKS の並び順） */
const RATE: number[][] = [
  [0.82, 0.9, 0.94, 1.05, 1.12],
  [0.6, 1.3, 0.8, 1.1, 0.33],
  [1, 1, 1, 1, 1],
  [0.7, 1.2, 0.9, 0.6, 0.6],
];
const monthEnd = (i: number, m: number) => Math.round((HOME_BANKS[i].balance * (RATE[i]?.[m] ?? 1)) / 100) * 100;

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function BankBalancePage({ variant, accent, onNavigate }: Props) {
  const s = useSession();
  const isSheet = variant === 'sheet';
  const total = HOME_BANKS.reduce((a, b) => a + b.balance, 0);
  const totalDiff = HOME_BANKS.reduce((a, b) => a + b.diff, 0);
  const monthTotals = MONTHS.map((_, m) => HOME_BANKS.reduce((a, _b, i) => a + monthEnd(i, m), 0));
  const peak = Math.max(total, ...monthTotals);

  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const h2: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #eef2f5', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 };
  const th: CSSProperties = { padding: '9px 14px', background: '#f6f8fa', borderBottom: '1px solid #dde4ea', fontSize: 12, fontWeight: 700, color: '#5b6773', textAlign: 'right', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '9px 14px', borderBottom: '1px solid #f1f4f6', fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const diffColor = (d: number) => (d > 0 ? '#1f7a52' : d < 0 ? '#c0392b' : '#9aa5b1');
  const diffText = (d: number) => `${d > 0 ? '▲' : d < 0 ? '▼' : '±'} ${yen(Math.abs(d))}`;

  return (
    <main data-bank-page style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1280, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 21 }}>預金残高</div>
          <span style={{ fontSize: 14, color: '#7a8794' }}>{s.fiscalYear}　{s.division}</span>
          <button type="button" className="btn-outline" data-menu="残高照合" onClick={() => onNavigate('残高照合')} style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid ' + accent, borderRadius: 9, background: '#fff', color: accent, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>残高照合へ ›</button>
        </div>

        {/* 現在の残高：口座ごとの残高と前日比 */}
        <section style={card}>
          <div style={h2}>
            現在の残高
            <span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794' }}>合計 <b style={{ color: '#22303c', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{yen(total)}</b> 円</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: diffColor(totalDiff) }}>{diffText(totalDiff)}<span style={{ fontWeight: 500, color: '#9aa5b1' }}> 前日比</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, padding: 16 }}>
            {HOME_BANKS.map((b) => (
              <div key={b.name} data-bank-card style={{ border: '1px solid #e2e8ee', borderRadius: 12, padding: '12px 14px', background: '#fbfcfd' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: '#9aa5b1', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bank}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 8 }}>{yen(b.balance)}<span style={{ fontSize: 12, fontWeight: 600, color: '#7a8794', marginLeft: 4 }}>円</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                  <span style={{ color: diffColor(b.diff), fontWeight: 700 }}>{diffText(b.diff)}<span style={{ fontWeight: 500, color: '#9aa5b1' }}> 前日比</span></span>
                  <span style={{ color: '#9aa5b1' }}>更新 {b.updated}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 月末残高の推移 */}
        <section style={card}>
          <div style={h2}>月末残高の推移<span style={{ fontSize: 12, fontWeight: 500, color: '#7a8794' }}>単位：円</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table data-bank-trend style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>口座</th>
                  {MONTHS.map((m) => <th key={m} style={th}>{m}</th>)}
                  <th style={{ ...th, color: '#22303c' }}>現在</th>
                  <th style={th}>8月末との差</th>
                </tr>
              </thead>
              <tbody>
                {HOME_BANKS.map((b, i) => {
                  const d = b.balance - monthEnd(i, MONTHS.length - 1);
                  return (
                    <tr key={b.name}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{b.name}<div style={{ fontSize: 12, fontWeight: 400, color: '#9aa5b1' }}>{b.bank}</div></td>
                      {MONTHS.map((m, mi) => <td key={m} style={td}>{yen(monthEnd(i, mi))}</td>)}
                      <td style={{ ...td, fontWeight: 700 }}>{yen(b.balance)}</td>
                      <td style={{ ...td, color: diffColor(d), fontWeight: 700 }}>{diffText(d)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 800, background: '#f8fafc', borderBottom: 'none' }}>合計</td>
                  {monthTotals.map((v, mi) => (
                    <td key={mi} style={{ ...td, fontWeight: 700, background: '#f8fafc', borderBottom: 'none' }}>
                      {yen(v)}
                      <div aria-hidden style={{ height: 4, marginTop: 4, borderRadius: 2, background: '#e6ecf0' }}><div style={{ height: 4, borderRadius: 2, width: `${Math.round((v / peak) * 100)}%`, marginLeft: 'auto', background: '#9db4c8' }} /></div>
                    </td>
                  ))}
                  <td style={{ ...td, fontWeight: 800, background: '#f8fafc', borderBottom: 'none' }}>
                    {yen(total)}
                    <div aria-hidden style={{ height: 4, marginTop: 4, borderRadius: 2, background: '#e6ecf0' }}><div style={{ height: 4, borderRadius: 2, width: `${Math.round((total / peak) * 100)}%`, marginLeft: 'auto', background: accent }} /></div>
                  </td>
                  <td style={{ ...td, fontWeight: 700, background: '#f8fafc', borderBottom: 'none', color: diffColor(total - monthTotals[monthTotals.length - 1]) }}>{diffText(total - monthTotals[monthTotals.length - 1])}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ padding: '10px 16px 14px', fontSize: 12, color: '#9aa5b1', lineHeight: 1.7 }}>※ 残高はサンプル値です。本番では預金出納（オプション）の銀行連携または通帳残高の入力を反映します。帳簿残高との突き合わせは「残高照合」で行います。</div>
        </section>
      </div>
    </main>
  );
}
