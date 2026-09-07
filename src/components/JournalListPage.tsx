// 仕訳一覧（既存「仕訳一覧」の再現）
//   会計月タブ・指定年月日、行＝Seq-No／日／伝票No／借方―貸方／摘要／金額（2段表示）
//   F1ファイル出力・F7区分色・F8区分・F9摘要・F10業者・F11計算はボタン化（プロトタイプでは動作しない）。F5検索はキーワード絞り込み。

import { useState } from 'react';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { LABEL, NUM, ReportShell, TD, TH, yen } from './ReportShell';
import { JOURNAL_ROWS } from '../data';
import type { MonthFilter } from '../types';

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  onNavigate: (label: string) => void;
}

export function JournalListPage({ variant, accent, onNavigate }: Props) {
  const [month, setMonth] = useState<MonthFilter>('8');
  const [kw, setKw] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const rows = JOURNAL_ROWS.filter((r) => (month == null || r.date.split('/')[0] === month) && (!kw || [r.kari, r.kashi, r.tekiyo, r.gyosha ?? ''].some((x) => x.includes(kw))));
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const m = month ?? '8';

  return (
    <ReportShell
      variant={variant}
      accent={accent}
      title="仕訳一覧"
      subtitle="指定月の仕訳を伝票順に一覧します。"
      tools={[{ label: 'ファイル出力' }, { label: '検索', onClick: () => setShowSearch((s) => !s), primary: true }, { label: '区分色' }, { label: '区分' }, { label: '摘要' }, { label: '業者' }, { label: '計算' }]}
      onBack={() => onNavigate('伝票入力')}
      controls={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={LABEL}>会計月</span>
            <FiscalMonthTabs current={month} accent={accent} onSelect={setMonth} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: '#48565f' }}>
            <span style={LABEL}>指定年月日</span>
            <span>令和8年 {m}月1日 〜 令和8年 {m}月末日</span>
            {showSearch && (
              <input className="search-input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="科目・摘要・業者で絞り込み" autoComplete="off" style={{ marginLeft: 12, width: 260, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
            )}
            <span style={{ marginLeft: 'auto' }}>
              <b style={{ color: '#22303c' }}>{rows.length}</b> 件　合計 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(total)}</b>
            </span>
          </div>
        </>
      }
    >
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 70 }}>Seq-No</th>
              <th style={{ ...TH, width: 70 }}>日</th>
              <th style={{ ...TH, width: 70 }}>伝票</th>
              <th style={TH}>借方 ― 貸方 ／ 摘要</th>
              <th style={{ ...TH, width: 60 }}>証憑</th>
              <th style={{ ...TH, width: 130, textAlign: 'right' }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当する仕訳がありません。</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={TD}><div style={{ fontWeight: 700 }}>{r.seq}</div><div style={{ fontSize: 10.5, color: '#9aa5b1' }}>{r.service.replace(/^\d+ /, '')}</div></td>
                <td style={TD}><div style={{ fontSize: 10.5, color: '#9aa5b1' }}>{r.kind}</div><div>{r.date}</div></td>
                <td style={TD}>{r.no}</td>
                <td style={TD}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontWeight: 500, minWidth: 180 }}>{r.kari}</span>
                    <span style={{ color: '#9aa5b1' }}>―</span>
                    <span style={{ color: '#48565f' }}>{r.kashi}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 2 }}>{r.tekiyo}{r.gyosha ? `　／ ${r.gyosha}` : ''}</div>
                </td>
                <td style={TD}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#eaf5ef', color: '#1f7a52' }}>{r.shohyo ? '有' : '無'}</span></td>
                <td style={{ ...NUM, fontWeight: 700 }}>{yen(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
