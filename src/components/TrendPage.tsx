// 推移（科目推移／資金推移／業者推移の共通部品）
//   指定した科目（業者）の月ごとの実績・累計（資金・業者は予算と残高も）を年度で一覧。値はサンプル。

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { FISCAL_MONTHS } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { useAssist } from '../hooks/useAssist';
import { seededSeries } from '../lib/hier';

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
  const assist = useAssist();
  const months = FISCAL_MONTHS.filter((m) => m !== '決');
  const debit = seededSeries(target + 'd', 12, isVendor ? 30000 : 120000);
  const credit = seededSeries(target + 'c', 12, isVendor ? 0 : 20000);
  const budget = seededSeries(target + 'b', 12, isVendor ? 35000 : 130000);
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
      subtitle={<>{isVendor ? '指定した業者' : '指定した科目'}の月ごとの推移を年度で一覧します。<span style={{ color: '#b7791f' }}>（表示中の値はサンプルです）</span></>}
      tools={[{ label: isVendor ? '業者検索' : '科目検索', onClick: () => assist.open('target', isVendor ? 'vendor' : 'account'), primary: true }]}
      onBack={() => onNavigate('伝票入力')}
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
                <tr key={r.m} style={{ background: r.m === '8' ? '#fff8d6' : 'transparent' }}>
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
    </ReportShell>
  );
}
